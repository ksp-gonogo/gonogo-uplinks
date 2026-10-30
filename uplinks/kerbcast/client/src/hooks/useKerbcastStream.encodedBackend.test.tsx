/**
 * Backend 0: encoded transform on the receiver. Proves the wiring is real: when
 * the caller gives an encoded target and `RTCRtpScriptTransform` exists, this
 * backend is tried first and, on success, surfaces `raw` itself (unchanged) as
 * the delayed stream, no new track, the delay happens in place upstream of
 * decode.
 *
 * Deliberately A separate file from `useKerbcastStream.delay.test.tsx`:
 * `kerbcastDelayWorkerClient.ts` caches its shared `Worker` in module-level
 * state (`getSharedWorker()`, `sharedWorker !== undefined` short-circuit):
 * once any test in a given module graph resolves it to `null` (because
 * `Worker` was undefined in jsdom at that moment), every later test in the
 * same file inherits that cached `null`, even after stubbing `Worker`.
 * Vitest gives each test file its own fresh module graph by default, so a
 * separate file is the correct isolation boundary here, not reordering
 * (fragile to future edits) and not `vi.resetModules()` (this module has no
 * exported reset hook, and reaching into its internals would be more
 * fragile than just not sharing the file).
 */

import type { DelayClockLike } from "@ksp-gonogo/sitrep-sdk";
import { clearRegistry, registerUplinkHandle } from "@ksp-gonogo/sitrep-sdk";
import {
  clearUplinkHandles,
  render,
  waitFor,
} from "@ksp-gonogo/sitrep-sdk/testing";
import {
  type CaptureClockSample,
  DEFAULT_PACING_MAX_LEAD_SECONDS,
  type EncodedFrameDelayHandle,
} from "@ksp-gonogo/sitrep-sdk/media";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FRAME_DELAY_STATS_KEY } from "../frameDelayStats.js";
import {
  type DelayedPlayoutResult,
  type EncodedDelayTarget,
  useDelayedPlayout,
  useEncodedDelayTarget,
  useKerbcastStream,
} from "./useKerbcastStream.js";

// Testing Library auto-cleans the DOM after every test, no manual
// cleanup() needed here, only the registry/global teardown this file
// actually owns.
afterEach(() => {
  clearRegistry();
  clearUplinkHandles();
  vi.unstubAllGlobals();
});

function manualClock(initialEdge = Number.NEGATIVE_INFINITY): DelayClockLike & {
  setEdge(v: number): void;
  snapshot(): unknown;
} {
  let edge = initialEdge;
  const listeners = new Set<(viewUt: number) => void>();
  return {
    confirmedEdgeUt: () => edge,
    onFrame: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    setEdge(v: number) {
      edge = v;
      listeners.forEach((cb) => {
        cb(v);
      });
    },
    // Backend 0 (like backend 2) only attempts when the clock is
    // snapshot()-capable: see useKerbcastStream.ts's module doc.
    snapshot: () => ({
      epoch: 0,
      anchorWall: undefined,
      anchorUt: undefined,
      maxSampleUt: Number.NEGATIVE_INFINITY,
      delaySeconds: 0,
      warpRate: 1,
      slackSeconds: 0,
    }),
  };
}

/**
 * Minimal fake `Worker`: `getSharedWorker()` is shared, module-level
 * state (`kerbcastDelayWorkerClient.ts`), so stubbing `Worker` to make
 * Backend 0 reachable also makes Backend 2 (`createWorkerFrameDelayStream`)
 * reachable if Backend 0 falls through: it awaits a `pipelineReady`/
 * `pipelineError` reply that a truly no-op fake would never send, hanging
 * the test forever at `{kind: "connecting"}`. Replying `pipelineError`
 * immediately to any `createPipeline` message keeps Backend 2 resolving
 * to `"unavailable"` quickly instead, matching what a real browser without
 * genuine worker-side track support would do. Backend 0
 * (`attachEncodedWorkerFrameDelay`) never awaits a reply at all (see
 * `kerbcastDelayWorkerClient.ts`'s doc on why that attach is effectively
 * synchronous), so this only matters for tests that fall through to
 * Backend 2.
 */
class FakeWorker {
  static posted: Array<{ type?: string; pipelineId?: string }> = [];
  static instances: FakeWorker[] = [];
  onmessage: ((ev: MessageEvent) => void) | null = null;
  constructor() {
    FakeWorker.instances.push(this);
  }

  /** Reports a lead limit for a pipeline, as the worker's pacer does. */
  static reportLeadLimit(pipelineId: string, seconds: number) {
    for (const worker of FakeWorker.instances) {
      worker.onmessage?.({
        data: { type: "pipelineLeadLimit", pipelineId, seconds },
      } as MessageEvent);
    }
  }
  postMessage(msg: { type?: string; pipelineId?: string }) {
    FakeWorker.posted.push(msg);
    if (msg?.type === "createPipeline") {
      queueMicrotask(() => {
        this.onmessage?.({
          data: {
            type: "pipelineError",
            pipelineId: msg.pipelineId,
            reason: "fake worker: no real pipeline support in this test",
          },
        } as MessageEvent);
      });
    }
  }
}

function TargetedStreamProbe({
  shown,
  target,
  clock,
  onResult,
}: {
  shown: MediaStream | null;
  target: EncodedDelayTarget | null;
  clock: DelayClockLike;
  onResult: (r: DelayedPlayoutResult) => void;
}): null {
  const result = useDelayedPlayout(shown, {
    view: clock,
    captureUt: () => 10,
    encodedTarget: target,
  });
  onResult(result);
  return null;
}

/** A camera shown through kerbcast's noise canvas: `shown` is the canvas, and the delay is wanted on the WebRTC track behind it. */
function CameraProbe({
  flightId,
  clock,
  onResult,
  getCaptureSample,
}: {
  flightId: number;
  clock: DelayClockLike;
  onResult: (r: DelayedPlayoutResult) => void;
  getCaptureSample?: () => CaptureClockSample;
}): null {
  const shown = useKerbcastStream(flightId);
  const target = useEncodedDelayTarget(flightId);
  const result = useDelayedPlayout(shown, {
    view: clock,
    captureUt: () => 10,
    getCaptureSample,
    encodedTarget: target,
  });
  onResult(result);
  return null;
}

function stubTransforms() {
  class FakeRTCRtpScriptTransform {
    static instances: FakeRTCRtpScriptTransform[] = [];
    constructor(
      public worker: unknown,
      public options: unknown,
    ) {
      FakeRTCRtpScriptTransform.instances.push(this);
    }
  }
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("RTCRtpScriptTransform", FakeRTCRtpScriptTransform);
  return FakeRTCRtpScriptTransform;
}

const fakeStream = () =>
  ({ getVideoTracks: () => [{}] }) as unknown as MediaStream;
const fakeReceiver = () =>
  ({ transform: null }) as unknown as RTCRtpReceiver & { transform: unknown };
const targetOn = (receiver: RTCRtpReceiver & { transform: unknown }) => ({
  key: {},
  receiver,
  attach: (install: (r: RTCRtpReceiver) => EncodedFrameDelayHandle | null) =>
    install(receiver),
});

describe("useDelayedPlayout with an encoded target behind the shown stream", () => {
  it("attaches the transform to the target's receiver and surfaces the shown stream unchanged", async () => {
    const Transform = stubTransforms();
    const shown = fakeStream();
    const receiver = fakeReceiver();

    let latest: DelayedPlayoutResult | "unset" = "unset";
    render(
      <TargetedStreamProbe
        shown={shown}
        target={targetOn(receiver)}
        clock={manualClock()}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await waitFor(() => {
      expect(latest).toMatchObject({ kind: "delayed" });
    });
    expect(Transform.instances).toHaveLength(1);
    expect(receiver.transform).toBe(Transform.instances[0]);
    expect((latest as unknown as { stream: MediaStream }).stream).toBe(shown);
  });

  it("asks the worker for frame totals only while the stats flag is on", async () => {
    const Transform = stubTransforms();
    const attach = async (flag: boolean) => {
      if (flag) localStorage.setItem(FRAME_DELAY_STATS_KEY, "1");
      else localStorage.removeItem(FRAME_DELAY_STATS_KEY);
      let latest: DelayedPlayoutResult | "unset" = "unset";
      const { unmount } = render(
        <TargetedStreamProbe
          shown={fakeStream()}
          target={targetOn(fakeReceiver())}
          clock={manualClock()}
          onResult={(r) => {
            latest = r;
          }}
        />,
      );
      await waitFor(() => {
        expect(latest).toMatchObject({ kind: "delayed" });
      });
      unmount();
    };

    await attach(false);
    await attach(true);

    const [off, on] = Transform.instances as unknown as Array<{
      options: { statsIntervalMs?: number };
    }>;
    expect(off?.options.statsIntervalMs).toBeUndefined();
    expect(on?.options.statsIntervalMs).toBeGreaterThan(0);
    localStorage.clear();
  });

  it("falls through to the next backend, never throwing, when the transform cannot be built", async () => {
    class ThrowingTransform {
      constructor() {
        throw new Error("receiver already has a transform");
      }
    }
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("RTCRtpScriptTransform", ThrowingTransform);

    let latest: DelayedPlayoutResult | "unset" = "unset";
    expect(() => {
      render(
        <TargetedStreamProbe
          shown={fakeStream()}
          target={targetOn(fakeReceiver())}
          clock={manualClock()}
          onResult={(r) => {
            latest = r;
          }}
        />,
      );
    }).not.toThrow();

    // No WebCodecs here either, so every backend is out.
    await waitFor(() => {
      expect(latest).toMatchObject({ kind: "unavailable" });
    });
  });

  it("does not try the encoded transform without a target", async () => {
    const Transform = stubTransforms();

    let latest: DelayedPlayoutResult | "unset" = "unset";
    render(
      <TargetedStreamProbe
        shown={fakeStream()}
        target={null}
        clock={manualClock()}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await waitFor(() => {
      expect(latest).toMatchObject({ kind: "unavailable" });
    });
    expect(Transform.instances).toHaveLength(0);
  });

  it("moves the delay to the new receiver when the target changes behind the same canvas", async () => {
    const Transform = stubTransforms();
    const canvas = fakeStream();
    const first = targetOn(fakeReceiver());
    const second = targetOn(fakeReceiver());
    const clock = manualClock();

    let latest: DelayedPlayoutResult | "unset" = "unset";
    const onResult = (r: DelayedPlayoutResult) => {
      latest = r;
    };
    const { rerender } = render(
      <TargetedStreamProbe
        shown={canvas}
        target={first}
        clock={clock}
        onResult={onResult}
      />,
    );
    await waitFor(() => {
      expect(first.receiver.transform).not.toBeNull();
    });

    rerender(
      <TargetedStreamProbe
        shown={canvas}
        target={second}
        clock={clock}
        onResult={onResult}
      />,
    );
    await waitFor(() => {
      expect(second.receiver.transform).toBe(Transform.instances[1]);
    });
    expect(first.receiver.transform).toBeNull();
    expect((latest as unknown as { stream: MediaStream }).stream).toBe(canvas);
  });

  it("keeps one attachment while the canvas behind it is replaced, and shows the new canvas", async () => {
    const Transform = stubTransforms();
    const target = targetOn(fakeReceiver());
    const clock = manualClock();
    const before = fakeStream();
    const after = fakeStream();

    let latest: DelayedPlayoutResult | "unset" = "unset";
    const onResult = (r: DelayedPlayoutResult) => {
      latest = r;
    };
    const { rerender } = render(
      <TargetedStreamProbe
        shown={before}
        target={target}
        clock={clock}
        onResult={onResult}
      />,
    );
    await waitFor(() => {
      expect(latest).toMatchObject({ kind: "delayed" });
    });
    rerender(
      <TargetedStreamProbe
        shown={after}
        target={target}
        clock={clock}
        onResult={onResult}
      />,
    );
    expect((latest as unknown as { stream: MediaStream }).stream).toBe(after);
    expect(Transform.instances).toHaveLength(1);
  });

  it("is connecting while the target is known and nothing is shown yet", async () => {
    stubTransforms();

    let latest: DelayedPlayoutResult | "unset" = "unset";
    render(
      <TargetedStreamProbe
        shown={null}
        target={targetOn(fakeReceiver())}
        clock={manualClock()}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );
    await waitFor(() => {
      expect(latest).toEqual({ kind: "connecting" });
    });
  });
});


describe("useEncodedDelayTarget, through Kerbcast's setEncodedTransform", () => {
  type Factory = (ctx: { flightId: number; path: string }) => unknown;

  /** A Kerbcast client whose camera shows `canvas` and records what it is told to install. */
  function registerKerbcast(opts: {
    canvas: MediaStream;
    path: "script" | "streams" | null;
  }) {
    const installs: Array<Factory | null> = [];
    const options: Array<{ holdMs?: () => number } | undefined> = [];
    const cam = {
      mediaStream: opts.canvas,
      on: () => () => {},
      setEncodedTransform: (
        factory: Factory | null,
        opt?: { holdMs?: () => number },
      ) => {
        installs.push(factory);
        options.push(opt);
      },
    };
    const client = { encodedTransformPath: opts.path, camera: () => cam };
    registerUplinkHandle("kerbcast", {
      id: "kerbcast",
      getClient: () => client,
      subscribeCamera: () => {},
      unsubscribeCamera: () => {},
    });
    return { installs, options };
  }

  it("with static on, hands Kerbcast the delay for the camera's receiver and shows the canvas", async () => {
    const Transform = stubTransforms();
    const canvas = fakeStream();
    const { installs } = registerKerbcast({ canvas, path: "script" });

    let latest: DelayedPlayoutResult | "unset" = "unset";
    render(
      <CameraProbe
        flightId={7}
        clock={manualClock()}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await waitFor(() => {
      expect(latest).toMatchObject({ kind: "delayed" });
    });
    expect((latest as unknown as { stream: MediaStream }).stream).toBe(canvas);
    expect(installs).toHaveLength(1);
    const installed = installs[0]?.({ flightId: 7, path: "script" });
    expect(installed).toBeInstanceOf(Transform);
    expect(Transform.instances).toHaveLength(2);
    expect(installed).toBe(Transform.instances[1]);
    expect(installed).not.toBe(Transform.instances[0]);
  });

  it("tells Kerbcast how long a frame can be held: the delay from the clock edge and warp rate, plus the default lead limit before a pipeline is installed", async () => {
    stubTransforms();
    const { options } = registerKerbcast({ canvas: fakeStream(), path: "script" });
    const clock = manualClock(6);
    // atMs in the future keeps the interpolated capture UT at the sample's own 10
    const sample = { ut: 10, warpRate: 2, atMs: performance.now() + 1e9 };

    render(
      <CameraProbe
        flightId={7}
        clock={clock}
        getCaptureSample={() => sample}
        onResult={() => {}}
      />,
    );

    await waitFor(() => {
      expect(options[0]?.holdMs).toBeTypeOf("function");
    });
    const lead = DEFAULT_PACING_MAX_LEAD_SECONDS * 1000;
    expect(options[0]?.holdMs?.()).toBe(2000 + lead);
    clock.setEdge(8);
    expect(options[0]?.holdMs?.()).toBe(1000 + lead);
    clock.setEdge(12);
    expect(options[0]?.holdMs?.()).toBe(lead);
  });

  it("holds for the delay plus the lead limit the installed pipeline reports", async () => {
    const Transform = stubTransforms();
    const { installs, options } = registerKerbcast({
      canvas: fakeStream(),
      path: "script",
    });
    const clock = manualClock(6);
    const sample = { ut: 10, warpRate: 2, atMs: performance.now() + 1e9 };

    render(
      <CameraProbe
        flightId={7}
        clock={clock}
        getCaptureSample={() => sample}
        onResult={() => {}}
      />,
    );

    await waitFor(() => {
      expect(options[0]?.holdMs).toBeTypeOf("function");
    });
    expect(options[0]?.holdMs?.()).toBe(2000 + 2000);

    installs[0]?.({ flightId: 7, path: "script" });
    const { pipelineId } = Transform.instances[
      Transform.instances.length - 1
    ]?.options as { pipelineId: string };
    FakeWorker.reportLeadLimit(pipelineId, 2);
    expect(options[0]?.holdMs?.()).toBe(2000 + 2000);

    FakeWorker.reportLeadLimit(pipelineId, 9.5);
    expect(options[0]?.holdMs?.()).toBe(2000 + 9500);
  });

  it("reports the hold as unknown while the capture clock has no time", async () => {
    stubTransforms();
    const { options } = registerKerbcast({ canvas: fakeStream(), path: "script" });

    render(<CameraProbe flightId={7} clock={manualClock(6)} onResult={() => {}} />);

    await waitFor(() => {
      expect(options[0]?.holdMs).toBeTypeOf("function");
    });
    expect(options[0]?.holdMs?.()).toBeNaN();
  });

  it("makes a fresh transform for each receiver the camera lands on, retiring the previous pipeline", async () => {
    const Transform = stubTransforms();
    FakeWorker.posted = [];
    const { installs } = registerKerbcast({
      canvas: fakeStream(),
      path: "script",
    });

    render(<CameraProbe flightId={7} clock={manualClock()} onResult={() => {}} />);
    await waitFor(() => {
      expect(installs).toHaveLength(1);
    });
    const factory = installs[0];
    const first = factory?.({ flightId: 7, path: "script" });
    const second = factory?.({ flightId: 7, path: "script" });

    expect(second).toBeInstanceOf(Transform);
    expect(second).not.toBe(first);
    const [firstOptions] = Transform.instances.map(
      (t) => (t as unknown as { options: { pipelineId: string } }).options,
    );
    expect(FakeWorker.posted).toContainEqual({
      type: "dispose",
      pipelineId: firstOptions?.pipelineId,
    });
  });

  it("detaches from Kerbcast when the last consumer goes", async () => {
    stubTransforms();
    const { installs } = registerKerbcast({
      canvas: fakeStream(),
      path: "script",
    });

    const { unmount } = render(
      <CameraProbe flightId={7} clock={manualClock()} onResult={() => {}} />,
    );
    await waitFor(() => {
      expect(installs).toHaveLength(1);
    });
    unmount();

    expect(installs).toHaveLength(2);
    expect(installs[1]).toBeNull();
  });

  it.each([
    "streams",
    null,
  ] as const)("leaves the delay to the shown stream where Kerbcast's install path is %s", async (path) => {
    const Transform = stubTransforms();
    const { installs } = registerKerbcast({ canvas: fakeStream(), path });

    let latest: DelayedPlayoutResult | "unset" = "unset";
    render(
      <CameraProbe
        flightId={7}
        clock={manualClock()}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await waitFor(() => {
      expect(latest).toMatchObject({ kind: "unavailable" });
    });
    expect(installs).toHaveLength(0);
    expect(Transform.instances).toHaveLength(0);
  });
});
