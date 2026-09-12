import {
  clearActionHandlers,
  clearAugments,
  clearUplinkHandles,
  getAugmentsForSlot,
} from "@ksp-gonogo/sitrep-sdk/testing";
/**
 * Tests for the `CameraFeed` component.
 *
 * Two halves:
 *  - the "SIGNAL LOST" overlay + zoom / pan / resize / CommNet feedback
 *    controls (carried over from the original kerbcast smoke);
 *  - the camera-selection layer (picker, Next/Previous buttons, the
 *    `nextCamera` / `prevCamera` serial-input actions, status indicator
 *    and empty state) that mirrors the OCISLY `CameraFeed`.
 *
 * Everything drives the real `KerbcastDataSource` + real `useKerbcastCameras`
 * / `useKerbcastStream` hooks through the SDK's canonical `MockSidecar`
 * (`@ksp-gonogo/kerbcast/testing`): the protocol-level fake that owns a camera
 * registry and speaks the full kerbcast wire protocol. The only thing faked is
 * the WebRTC transport, because jsdom can't produce a real `MediaStream`.
 * Multi-camera scenarios are expressed by populating the sidecar's registry
 * (`addCamera` / `setCameras`); state changes go through `updateCamera` /
 * `destroyCamera`; client commands are inspected via the parsed `commands`
 * array.
 */

import type {
  CameraKind,
  CameraLifecycle,
  CrewLocation,
  Layer,
} from "@ksp-gonogo/kerbcast";
import { type MockCameraInit, MockSidecar } from "@ksp-gonogo/kerbcast/testing";
import type { ComponentProps } from "@ksp-gonogo/sitrep-sdk";
import {
  clearRegistry,
  dispatchAction,
  getComponent,
  registerAugment,
  registerComponent,
  registerUplinkHandle,
} from "@ksp-gonogo/sitrep-sdk";
import {
  act,
  fireEvent,
  render,
  type StreamFixture,
  screen,
  setupStreamFixture,
  waitFor,
} from "@ksp-gonogo/sitrep-sdk/testing";

import {
  renderWidget,
  visibleText,
  WidgetHost,
} from "@ksp-gonogo/ui-kit/testing";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KerbcastDataSource } from "../KerbcastDataSource.js";
import {
  CameraFeed,
  type CameraFeedConfig,
  type CameraOverlayContext,
} from "./CameraFeed.js";
// Side-effect import: `registerComponent` lives in ./index, not ./CameraFeed,
// and `renderWidget`/`WidgetHost` look the widget up by id.
import "./index.js";
import { CameraFeedConfigPanel } from "./CameraFeedConfigPanel.js";

// ---------------------------------------------------------------------------
// Render helper, CameraFeed calls useActionInput, which reads its instance
// ID from the enclosing dashboard item. Rendering the component bare throws
// ("must be used inside a DashboardItemContext.Provider"), so every
// test goes through this wrapper. Mirrors CameraFeed/index.test.tsx's
// renderFeed(). The instanceId is also what dispatchAction() targets when a
// test drives the serial-input path directly.
// ---------------------------------------------------------------------------

const TEST_INSTANCE_ID = "camera-feed-test";

// Sources created during a test are torn down in afterEach AFTER the widget is
// unmounted, so the CameraFeed is already gone when disconnect() fires.
// Disconnecting a live source while the widget is still mounted triggers
// useKerbcastStream state updates outside act(): the documented anti-pattern in
// CLAUDE.md.
const createdSources: Array<{ disconnect: () => void }> = [];

// Rendered trees, tracked so afterEach can unmount them BEFORE disconnecting
// sources. RTL's auto-cleanup runs after this file's afterEach, so it can't be
// relied on to unmount first: the render helpers below push their unmount here.
const renderedTrees: Array<() => void> = [];

// Fill the config defaults so individual tests only spell out the fields they
// care about (flightId, and occasionally showDebugInfo).
function fullConfig(config: Partial<CameraFeedConfig>): CameraFeedConfig {
  return { flightId: null, showDebugInfo: false, ...config };
}

function renderFeed(
  config: Partial<CameraFeedConfig>,
): ReturnType<typeof render> {
  const result = renderWidget("camera-feed", {
    instanceId: TEST_INSTANCE_ID,
    config: fullConfig(config),
  });
  renderedTrees.push(result.unmount);
  return result;
}

// ---------------------------------------------------------------------------
// Comms-topic test double for the CommNet-degrade + signal-delay/quality
// badge tests below: those three reads (signalStrength/connected/
// signalDelay) were migrated off the legacy two-arg `useTelemetry("data",
// "comm.*")` shim onto native topics, so they need a mounted
// the stream fixture, not the `makeDataSource("data", ...)` fake the rest
// of this file's `dataRequirements` still use.
// ---------------------------------------------------------------------------

/** The three native topics CameraFeed reads its comms state off. */
const COMMS_TOPICS = ["vessel.comms", "comms.link", "comms.delay"] as const;

function renderFeedWithComms(
  config: Partial<CameraFeedConfig>,
  stream: StreamFixture,
): ReturnType<typeof render> {
  const result = renderWidget("camera-feed", {
    instanceId: TEST_INSTANCE_ID,
    config: fullConfig(config),
    wrapper: stream.Provider,
  });
  renderedTrees.push(result.unmount);
  return result;
}

/**
 * Fans a partial `{ signalStrength, connected, signalDelay }` fixture out to
 * the three native topics CameraFeed actually reads: `vessel.comms`
 * (`.signalStrength`), `comms.link` (`.connected`), `comms.delay`
 * (`.oneWaySeconds`). Mirrors the old `makeDataSource("data", { "comm.foo":
 * ... })` fixture shape one field at a time so existing call sites only need
 * their key names updated.
 */
function emitComms(
  stream: StreamFixture,
  fixture: {
    signalStrength?: number;
    connected?: boolean;
    signalDelay?: number;
  },
): void {
  if (fixture.signalStrength !== undefined) {
    stream.emit("vessel.comms", { signalStrength: fixture.signalStrength });
  }
  if (fixture.connected !== undefined) {
    stream.emit("comms.link", { connected: fixture.connected });
  }
  if (fixture.signalDelay !== undefined) {
    stream.emit("comms.delay", { oneWaySeconds: fixture.signalDelay });
  }
}

// A stateful wrapper that holds `config` in React state and feeds its own
// setter back as `onConfigChange`. Lets selection tests assert the *real*
// round-trip: pick a camera (picker, Next/Prev button, or a dispatched
// serial action) → onConfigChange persists flightId → the widget re-renders
// against the new selection: rather than just spying on the callback.
function renderStatefulFeed(
  initial: Partial<CameraFeedConfig>,
): ReturnType<typeof render> {
  function Harness() {
    const [config, setConfig] = useState<CameraFeedConfig>(fullConfig(initial));
    return (
      // `WidgetHost` rather than `renderWidget`: the config has to CHANGE in
      // response to `onConfigChange`, and `renderWidget` owns a static one.
      <WidgetHost widgetId="camera-feed" instanceId={TEST_INSTANCE_ID}>
        <CameraFeed
          config={config}
          id={TEST_INSTANCE_ID}
          onConfigChange={(next) => setConfig(next as CameraFeedConfig)}
        />
      </WidgetHost>
    );
  }
  const result = render(<Harness />);
  renderedTrees.push(result.unmount);
  return result;
}

// Note: importing KerbcastDataSource class directly (not the barrel index)
// avoids the module-level registerDataSource() side effect. Tests register
// their own instance explicitly via registerDataSource() in each fixture.

// ---------------------------------------------------------------------------
// Camera-state fixture factory: the sidecar's CameraState has ~25 fields;
// most tests only care about a handful, so this fills the rest with sane
// "active, no-zoom, no-pan" defaults and lets callers override.
// ---------------------------------------------------------------------------

type CameraStateLike = Record<string, unknown> & { flightId: number };

function makeCamera(overrides: CameraStateLike): CameraStateLike {
  return {
    lifecycle: "active",
    partName: "mumech.MuMechModuleHullCamera",
    partTitle: "Hullcam Mk1",
    cameraName: "Camera",
    vesselName: "Kerbal X",
    layers: ["NEAR", "SCALED"],
    operatorLayers: ["NEAR", "SCALED"],
    renderWidth: 384,
    renderHeight: 384,
    operatorWidth: 384,
    operatorHeight: 384,
    supportsZoom: false,
    fov: 60,
    fovMin: 10,
    fovMax: 90,
    supportsPan: false,
    panYaw: 0,
    panPitch: 0,
    panYawMin: 0,
    panYawMax: 0,
    panPitchMin: 0,
    panPitchMax: 0,
    encoderBitrateBps: 1_500_000,
    targetBitrateBps: 0,
    degradeLevel: 0,
    ...overrides,
  };
}

// Translate a loose `CameraStateLike` (string enum values, ~25 fields) into the
// SDK's `MockCameraInit`. Every field is mapped through (not a subset) so the
// resulting camera matches the old fixture exactly and `buildCamera`'s differing
// defaults (e.g. `supportsZoom: true`, `fov: 60`, `layers: [Near]`) never leak
// in. The enum-typed fields are cast (their runtime string values already match
// the enum members); the rest are plain number/string/boolean pass-through.
function toInit(c: CameraStateLike): MockCameraInit {
  return {
    flightId: c.flightId,
    lifecycle: c.lifecycle as CameraLifecycle | undefined,
    kind: c.kind as CameraKind | undefined,
    crewLocation: c.crewLocation as CrewLocation | undefined,
    partName: c.partName as string | undefined,
    partTitle: c.partTitle as string | undefined,
    cameraName: c.cameraName as string | undefined,
    vesselName: c.vesselName as string | undefined,
    layers: c.layers as Layer[] | undefined,
    operatorLayers: c.operatorLayers as Layer[] | undefined,
    renderWidth: c.renderWidth as number | undefined,
    renderHeight: c.renderHeight as number | undefined,
    operatorWidth: c.operatorWidth as number | undefined,
    operatorHeight: c.operatorHeight as number | undefined,
    supportsZoom: c.supportsZoom as boolean | undefined,
    fov: c.fov as number | undefined,
    fovMin: c.fovMin as number | undefined,
    fovMax: c.fovMax as number | undefined,
    supportsPan: c.supportsPan as boolean | undefined,
    panYaw: c.panYaw as number | undefined,
    panPitch: c.panPitch as number | undefined,
    panYawMin: c.panYawMin as number | undefined,
    panYawMax: c.panYawMax as number | undefined,
    panPitchMin: c.panPitchMin as number | undefined,
    panPitchMax: c.panPitchMax as number | undefined,
    encoderBitrateBps: c.encoderBitrateBps as number | undefined,
    targetBitrateBps: c.targetBitrateBps as number | undefined,
    degradeLevel: c.degradeLevel as number | undefined,
  };
}

// Build a URL-aware fetch impl for the connect handshake: GET `/ice-config`
// (TURN creds) → empty server list (no relay); the SDK client's POST `/offer`
// → an SDP answer carrying the given flightIds, so the client opens a track for
// every camera it's about to learn about. `makeOfferResponse` is called per
// invocation because a `Response` body is single-use.
function kerbcastFetch(
  cameras: number[],
): (input: RequestInfo | URL) => Promise<Response> {
  return async (input) => {
    if (String(input).includes("/ice-config")) {
      return new Response(JSON.stringify({ iceServers: [] }), { status: 200 });
    }
    return MockSidecar.makeOfferResponse(cameras);
  };
}

// ---------------------------------------------------------------------------
// Global ResizeObserver stub: jsdom doesn't ship one. The resize-observer
// describe block installs a controllable version in its own beforeEach; all
// other tests just need a no-op stub so the component mounts without error.
// ---------------------------------------------------------------------------

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// ---------------------------------------------------------------------------
// Test setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(kerbcastFetch([42]));
});

// Module-load registration happens ONCE, and this file's `clearRegistry()`
// below wipes it along with the data sources it is actually there to reset. So
// the definition is captured while it exists and put back before each test,
// which is what keeps `renderWidget`'s lookup working past the first case.
const CAMERA_FEED_DEF = getComponent("camera-feed");

beforeEach(() => {
  if (CAMERA_FEED_DEF) registerComponent(CAMERA_FEED_DEF);
});

afterEach(() => {
  // Unmount every rendered tree first so the widget is gone before disconnect()
  // fires (RTL auto-cleanup runs after this hook, too late for that ordering).
  for (const unmount of renderedTrees) unmount();
  renderedTrees.length = 0;
  // Disconnect tracked sources AFTER unmount so the widget is unmounted first.
  for (const ds of createdSources) ds.disconnect();
  createdSources.length = 0;
  clearActionHandlers(); // tests share one instanceId: handlers would leak
  clearRegistry(); // resets all registries: tests register their own instance
  clearUplinkHandles(); // resets the narrow uplink-handle registry too
  clearAugments(); // wipe any test augment so it never leaks into other suites
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Test fixture: builds and registers a KerbcastDataSource with a fake
// transport, connects it, opens the control channel, and pushes an initial
// camera snapshot. Defaults to a single active "Starboard Cam" (flightId 42)
// matching the original single-camera fixture; pass `cameras` for the
// multi-camera selection scenarios.
// ---------------------------------------------------------------------------

async function buildConnectedSource(
  cameras: CameraStateLike[] = [
    makeCamera({ flightId: 42, cameraName: "Starboard Cam" }),
  ],
): Promise<{ ds: KerbcastDataSource; sidecar: MockSidecar }> {
  const sidecar = new MockSidecar();
  for (const c of cameras) {
    sidecar.addCamera(toInit(c));
  }
  const ds = new KerbcastDataSource({ port: 1 }, sidecar.createTransport());

  registerUplinkHandle("kerbcast", ds);

  // Keep the /offer answer's `cameras` array in sync with the snapshot so the
  // client opens a track for every flightId it's about to learn about.
  vi.spyOn(globalThis, "fetch").mockImplementation(
    kerbcastFetch(cameras.map((c) => c.flightId)),
  );

  await act(async () => {
    await ds.connect();
  });

  // Complete the WebRTC handshake: open() fires the channel-open handler and
  // pushes hello + camera-snapshot (built from the cameras added above).
  await act(async () => {
    sidecar.open();
    sidecar.setConnectionState("connected");
  });

  createdSources.push(ds);
  return { ds, sidecar };
}

// ---------------------------------------------------------------------------
// Camera selection: picker, Next/Previous, serial actions, empty/status
// ---------------------------------------------------------------------------

describe("CameraFeed: camera selection", () => {
  const TWO_CAMERAS = [
    makeCamera({
      flightId: 42,
      cameraName: "Starboard Cam",
      vesselName: "Kerbal X",
    }),
    makeCamera({
      flightId: 43,
      cameraName: "Nose Cam",
      vesselName: "Kerbal X",
    }),
    makeCamera({
      flightId: 44,
      cameraName: "Tail Cam",
      vesselName: "Kerbal X",
    }),
  ];

  it("excludes kerbal face cameras from the picker (facecam kind separation)", async () => {
    // Kerbal face cams get their own crew surfaces (CrewStatus's avatar
    // augment, eventually a dedicated facecam wall) and should never also show
    // up in this general part-camera picker and auto-latch.
    await buildConnectedSource([
      ...TWO_CAMERAS,
      makeCamera({
        flightId: 99,
        kind: "kerbal",
        cameraName: "Jebediah Kerman",
        vesselName: "Kerbal X",
      }),
    ]);

    renderFeed({ flightId: null });

    fireEvent.click(screen.getByRole("button", { name: /starboard cam/i }));
    const labels = screen
      .getAllByRole("menuitemradio")
      .map((item) => item.textContent);
    expect(labels).toEqual([
      "Starboard Cam (Kerbal X)",
      "Nose Cam (Kerbal X)",
      "Tail Cam (Kerbal X)",
    ]);
  });

  it("lists every available camera in the menu", async () => {
    await buildConnectedSource(TWO_CAMERAS);

    renderFeed({ flightId: null });

    // The title is the menu trigger; open it to reveal the camera list.
    fireEvent.click(screen.getByRole("button", { name: /starboard cam/i }));

    const labels = screen
      .getAllByRole("menuitemradio")
      .map((item) => item.textContent);
    expect(labels).toEqual([
      "Starboard Cam (Kerbal X)",
      "Nose Cam (Kerbal X)",
      "Tail Cam (Kerbal X)",
    ]);
  });

  it("disambiguates same-named cameras (e.g. docking ports) by part title", async () => {
    // Hullcam names every docking-port camera "NavCam", colliding with the
    // dedicated NavCam. The colliding pair gets its part title appended; the
    // non-colliding camera (and the NavCam whose title equals its name) stay
    // plain.
    await buildConnectedSource([
      makeCamera({
        flightId: 42,
        cameraName: "NavCam",
        vesselName: "Kerbal X",
        partTitle: "NavCam",
      }),
      makeCamera({
        flightId: 43,
        cameraName: "NavCam",
        vesselName: "Kerbal X",
        partTitle: "Clamp-O-Tron Docking Port Jr.",
      }),
      makeCamera({
        flightId: 44,
        cameraName: "Tail Cam",
        vesselName: "Kerbal X",
        partTitle: "Some Other Part",
      }),
    ]);

    renderFeed({ flightId: null });

    fireEvent.click(screen.getByRole("button", { name: /navcam/i }));
    const labels = screen
      .getAllByRole("menuitemradio")
      .map((item) => item.textContent);
    expect(labels).toEqual([
      "NavCam (Kerbal X)",
      "NavCam - Clamp-O-Tron Docking Port Jr. (Kerbal X)",
      "Tail Cam (Kerbal X)",
    ]);
  });

  it("auto-selects the first available camera when flightId is null", async () => {
    await buildConnectedSource(TWO_CAMERAS);

    renderFeed({ flightId: null });

    // Title reflects the first camera; the menu marks it as the checked item.
    expect(screen.getByRole("heading", { name: "Starboard Cam" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /starboard cam/i }));
    const checked = screen.getByRole("menuitemradio", { checked: true });
    expect(checked.textContent).toBe("Starboard Cam (Kerbal X)");
  });

  it("honours an explicitly-configured non-top camera", async () => {
    await buildConnectedSource(TWO_CAMERAS);

    // flightId 44 is the THIRD camera, not the top of the list.
    renderFeed({ flightId: 44 });

    expect(screen.getByRole("heading", { name: "Tail Cam" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /tail cam/i }));
    const checked = screen.getByRole("menuitemradio", { checked: true });
    expect(checked.textContent).toBe("Tail Cam (Kerbal X)");
  });

  it("selecting a different camera in the menu persists the choice and switches", async () => {
    await buildConnectedSource(TWO_CAMERAS);

    renderStatefulFeed({ flightId: 42 });

    expect(screen.getByRole("heading", { name: "Starboard Cam" })).toBeTruthy();

    // Open the menu and pick a different camera.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /starboard cam/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitemradio", { name: /nose cam/i }));
    });

    // Stateful harness persisted the new flightId → widget re-rendered.
    expect(screen.getByRole("heading", { name: "Nose Cam" })).toBeTruthy();
    // Selecting a camera closes the menu.
    expect(screen.queryByRole("menu")).toBeNull();

    // Re-open: the menu now marks the newly-chosen camera as checked.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /nose cam/i }));
    });
    expect(
      screen.getByRole("menuitemradio", { checked: true }).textContent,
    ).toBe("Nose Cam (Kerbal X)");
  });

  it("Next button advances to the next camera and wraps round", async () => {
    await buildConnectedSource(TWO_CAMERAS);

    renderStatefulFeed({ flightId: 42 });

    const next = screen.getByRole("button", { name: /next camera/i });

    await act(async () => {
      fireEvent.click(next);
    });
    expect(screen.getByRole("heading", { name: "Nose Cam" })).toBeTruthy();

    await act(async () => {
      fireEvent.click(next);
    });
    expect(screen.getByRole("heading", { name: "Tail Cam" })).toBeTruthy();

    // Wrap: third → first.
    await act(async () => {
      fireEvent.click(next);
    });
    expect(screen.getByRole("heading", { name: "Starboard Cam" })).toBeTruthy();
  });

  it("Previous button steps backward and wraps round", async () => {
    await buildConnectedSource(TWO_CAMERAS);

    renderStatefulFeed({ flightId: 42 });

    const prev = screen.getByRole("button", { name: /previous camera/i });

    // From the first camera, Previous wraps to the last.
    await act(async () => {
      fireEvent.click(prev);
    });
    expect(screen.getByRole("heading", { name: "Tail Cam" })).toBeTruthy();
  });

  it("nextCamera / prevCamera serial actions switch cameras", async () => {
    await buildConnectedSource(TWO_CAMERAS);

    renderStatefulFeed({ flightId: 42 });

    // Fire the serial-input action straight through the dispatcher, the same
    // path InputDispatcher uses for a mapped hardware button.
    await act(async () => {
      dispatchAction(TEST_INSTANCE_ID, "nextCamera", {
        kind: "button",
        value: true,
      });
    });
    expect(screen.getByRole("heading", { name: "Nose Cam" })).toBeTruthy();

    await act(async () => {
      dispatchAction(TEST_INSTANCE_ID, "prevCamera", {
        kind: "button",
        value: true,
      });
    });
    expect(screen.getByRole("heading", { name: "Starboard Cam" })).toBeTruthy();
  });

  it("a button-release payload (value=false) does not switch cameras", async () => {
    await buildConnectedSource(TWO_CAMERAS);

    renderStatefulFeed({ flightId: 42 });

    await act(async () => {
      dispatchAction(TEST_INSTANCE_ID, "nextCamera", {
        kind: "button",
        value: false,
      });
    });
    // Still on the first camera: release events are ignored.
    expect(screen.getByRole("heading", { name: "Starboard Cam" })).toBeTruthy();
  });

  it("falls back to the first camera when the configured one disappears", async () => {
    const { sidecar } = await buildConnectedSource(TWO_CAMERAS);

    renderFeed({ flightId: 44 });
    expect(screen.getByRole("heading", { name: "Tail Cam" })).toBeTruthy();

    // The vessel changes, only flightId 42 survives.
    await act(async () => {
      sidecar.setCameras([
        toInit(makeCamera({ flightId: 42, cameraName: "Starboard Cam" })),
      ]);
    });

    // Configured 44 is gone → widget falls back to the surviving first camera
    // rather than wedging on a dead id.
    expect(screen.getByRole("heading", { name: "Starboard Cam" })).toBeTruthy();
  });

  it("step buttons are disabled when only one camera is available", async () => {
    await buildConnectedSource();

    renderFeed({ flightId: 42 });

    // jest-dom's toBeDisabled() isn't wired into the kerbcast setup, so assert
    // the underlying `disabled` property directly.
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /next camera/i })
        .disabled,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: /previous camera/i,
      }).disabled,
    ).toBe(true);
  });

  it("Escape closes the open camera menu", async () => {
    await buildConnectedSource(TWO_CAMERAS);

    renderFeed({ flightId: 42 });

    fireEvent.click(screen.getByRole("button", { name: /starboard cam/i }));
    expect(screen.getByRole("menu")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Debug-info toggle (resolution + bitrate readouts gated behind the menu)
// ---------------------------------------------------------------------------

describe("CameraFeed: debug info toggle", () => {
  it("hides the resolution/bitrate readout by default", async () => {
    await buildConnectedSource([
      makeCamera({
        flightId: 42,
        cameraName: "Starboard Cam",
        vesselName: "Kerbal X",
        renderWidth: 640,
        renderHeight: 360,
      }),
    ]);

    renderFeed({ flightId: 42 });

    // showDebugInfo defaults to false → resolution string is not rendered.
    expect(screen.queryByText(/640×360/)).toBeNull();
  });

  it("shows the resolution/bitrate readout when showDebugInfo is true", async () => {
    await buildConnectedSource([
      makeCamera({
        flightId: 42,
        cameraName: "Starboard Cam",
        vesselName: "Kerbal X",
        renderWidth: 640,
        renderHeight: 360,
      }),
    ]);

    renderFeed({ flightId: 42, showDebugInfo: true });

    expect(screen.getByText(/640×360/)).toBeTruthy();
  });

  it("the Settings-tab config panel persists the toggle without dropping the camera pick", () => {
    // The toggle lives in the gear modal's Settings tab now, not the in-feed
    // dropdown. Saving must thread the current flightId back through so it
    // can't wipe the selected camera.
    const onSave = vi.fn();
    render(
      <CameraFeedConfigPanel
        config={{ flightId: 42, showDebugInfo: false }}
        onSave={onSave}
      />,
    );

    const toggle = screen.getByRole("checkbox", { name: /show debug info/i });
    expect((toggle as HTMLInputElement).checked).toBe(false);

    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(onSave).toHaveBeenCalledWith({ flightId: 42, showDebugInfo: true });
  });
});

describe("CameraFeed: empty state and status", () => {
  it("shows the no-cameras empty state and hides the menu trigger when connected with no cameras", async () => {
    await buildConnectedSource([]);

    renderFeed({ flightId: null });

    // No menu trigger (the title is plain text) when there are no cameras.
    expect(screen.queryByRole("button", { name: /camera feed/i })).toBeNull();
    // No <video> element either.
    expect(document.querySelector("video")).toBeNull();
    // Neutral empty-state copy: connection/transport detail is intentionally
    // NOT shown here (it lives in the Data Sources widget).
    expect(screen.getByText(/start a vessel with hullcam parts/i)).toBeTruthy();
  });

  it("renders the empty state gracefully when the source is disconnected", async () => {
    // A kerbcast source that never connects (status stays disconnected): build
    // the transport but never call connect()/open(). The widget shows the same
    // neutral empty state and surfaces no in-widget connection status.
    const sidecar = new MockSidecar();
    const ds = new KerbcastDataSource({ port: 1 }, sidecar.createTransport());
    registerUplinkHandle("kerbcast", ds);
    createdSources.push(ds);

    renderFeed({ flightId: null });

    expect(screen.getByText(/start a vessel with hullcam parts/i)).toBeTruthy();
    // No in-widget sidecar status indicator (removed: lives in Data Sources).
    expect(
      screen.queryByRole("status", { name: /connected|disconnected/i }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Serial-action dispatch (zoom / pan) -- wrapper binding tests
//
// These tests drive the serial-input path: dispatchAction -> useActionInput
// handler -> feedRef.current.setZoomRate / setPanAxis -> PanZoomController
// -> client.camera(42).setZoomRate / setPanRate -> MockSidecar wire command.
// The shared package tests cover the handle directly; these tests cover the
// gonogo wrapper's useActionInput binding.
//
// Every test here mounts a comms stream and says what the link is doing, because
// the binding ROUTES on it: pan and zoom reach the camera only below the staged
// delay threshold, and above it they turn the staged setpoint instead. A test
// that emitted no delay at all would be asserting the live path from inside
// `no-path`, which is the mode an absent `comms.delay` resolves to.
// ---------------------------------------------------------------------------

/** A link short enough that the camera itself is still what a control aims. */
const LIVE_DELAY_S = 0.2;

describe("CameraFeed -- serial-action dispatch (zoom/pan), live link", () => {
  it("zoomIn serial action holds a +1 zoom rate, releases to 0", async () => {
    const { sidecar } = await buildConnectedSource();

    await act(async () => {
      sidecar.updateCamera(42, { supportsZoom: true, fov: 60 });
    });

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);
    act(() => {
      emitComms(stream, { connected: true, signalDelay: LIVE_DELAY_S });
    });

    // Press: +rate = zoom in (FoV decreases). The plugin integrates per frame.
    await act(async () => {
      dispatchAction(TEST_INSTANCE_ID, "zoomIn", {
        kind: "button",
        value: true,
      });
    });
    expect(sidecar.lastCommand("set-zoom-rate")?.content).toMatchObject({
      flightId: 42,
      rate: 1,
    });

    // Release: stop zooming.
    await act(async () => {
      dispatchAction(TEST_INSTANCE_ID, "zoomIn", {
        kind: "button",
        value: false,
      });
    });
    expect(sidecar.lastCommand("set-zoom-rate")?.content.rate).toBe(0);
  });

  it("zoomOut serial action holds a -1 zoom rate, releases to 0", async () => {
    const { sidecar } = await buildConnectedSource();

    await act(async () => {
      sidecar.updateCamera(42, { supportsZoom: true, fov: 60 });
    });

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);
    act(() => {
      emitComms(stream, { connected: true, signalDelay: LIVE_DELAY_S });
    });

    await act(async () => {
      dispatchAction(TEST_INSTANCE_ID, "zoomOut", {
        kind: "button",
        value: true,
      });
    });
    expect(sidecar.lastCommand("set-zoom-rate")?.content).toMatchObject({
      flightId: 42,
      rate: -1,
    });

    await act(async () => {
      dispatchAction(TEST_INSTANCE_ID, "zoomOut", {
        kind: "button",
        value: false,
      });
    });
    expect(sidecar.lastCommand("set-zoom-rate")?.content.rate).toBe(0);
  });

  it("zoom serial actions are no-ops when camera does not support zoom", async () => {
    // Default camera fixture has supportsZoom: false -- handle guard blocks the command.
    const { sidecar } = await buildConnectedSource();

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);
    act(() => {
      emitComms(stream, { connected: true, signalDelay: LIVE_DELAY_S });
    });

    await act(async () => {
      dispatchAction(TEST_INSTANCE_ID, "zoomIn", {
        kind: "button",
        value: true,
      });
    });

    expect(sidecar.lastCommand("set-zoom-rate")).toBeUndefined();
  });

  it("panYaw serial action sends a set-pan-rate on the yaw axis", async () => {
    const { sidecar } = await buildConnectedSource();

    // Enable pan with a non-zero pitch range so supportsPitch is true and the
    // pitch axis is available (panPitchMax - panPitchMin > 0).
    await act(async () => {
      sidecar.updateCamera(42, {
        supportsPan: true,
        panYawMin: -45,
        panYawMax: 45,
        panPitchMin: -30,
        panPitchMax: 30,
      });
    });

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);
    act(() => {
      emitComms(stream, { connected: true, signalDelay: LIVE_DELAY_S });
    });

    await act(async () => {
      dispatchAction(TEST_INSTANCE_ID, "panYaw", {
        kind: "analog",
        value: 0.5,
      });
    });

    expect(sidecar.lastCommand("set-pan-rate")?.content).toMatchObject({
      flightId: 42,
      yawRate: 0.5,
      pitchRate: 0,
    });
  });

  it("panPitch serial action sends a set-pan-rate on the pitch axis", async () => {
    const { sidecar } = await buildConnectedSource();

    await act(async () => {
      sidecar.updateCamera(42, {
        supportsPan: true,
        panYawMin: -45,
        panYawMax: 45,
        panPitchMin: -30,
        panPitchMax: 30,
      });
    });

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);
    act(() => {
      emitComms(stream, { connected: true, signalDelay: LIVE_DELAY_S });
    });

    await act(async () => {
      dispatchAction(TEST_INSTANCE_ID, "panPitch", {
        kind: "analog",
        value: 0.5,
      });
    });

    expect(sidecar.lastCommand("set-pan-rate")?.content).toMatchObject({
      flightId: 42,
      yawRate: 0,
      pitchRate: 0.5,
    });
  });

  it("pan serial actions are no-ops when camera does not support pan", async () => {
    // Default camera fixture has supportsPan: false -- handle guard blocks the command.
    const { sidecar } = await buildConnectedSource();

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);
    act(() => {
      emitComms(stream, { connected: true, signalDelay: LIVE_DELAY_S });
    });

    await act(async () => {
      dispatchAction(TEST_INSTANCE_ID, "panYaw", { kind: "analog", value: 1 });
    });

    expect(sidecar.lastCommand("set-pan-rate")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Serial-action dispatch above the staged threshold.
//
// The operator's ruling: the input here PLANS a movement, it does not report
// where the camera is. So a held stick turns the staged wheel and nothing
// leaves the widget until the commit. Same dispatch path as the block above,
// routed to the setpoint cluster instead of the feed handle.
// ---------------------------------------------------------------------------

const STAGED_DELAY_S = 1.4;

/** The angle a wheel is showing, off its own slider semantics. */
function wheelValue(name: RegExp): number {
  return Number(
    screen.getByRole("slider", { name }).getAttribute("aria-valuenow"),
  );
}

describe("CameraFeed -- serial-action dispatch, staged link", () => {
  beforeEach(() => {
    // Only the ticker. Faking setTimeout as well would take the sidecar
    // handshake and RTL's own async settling with it, and the thing under test
    // is one interval.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function stagedFeed(): Promise<{ sidecar: MockSidecar }> {
    const { sidecar } = await buildConnectedSource([STEERABLE]);
    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);
    act(() => {
      emitComms(stream, { connected: true, signalDelay: STAGED_DELAY_S });
    });
    await screen.findByRole("slider", { name: /yaw/i });
    return { sidecar };
  }

  /** Let a held input run for `ms`, at the tick the surface actually uses. */
  async function heldFor(ms: number): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  it("a held yaw stick turns the staged wheel and keeps turning it", async () => {
    await stagedFeed();
    expect(wheelValue(/yaw/i)).toBe(STEERABLE.panYaw);

    act(() => {
      dispatchAction(TEST_INSTANCE_ID, "panYaw", { kind: "analog", value: 1 });
    });
    await heldFor(600);
    const moved = wheelValue(/yaw/i);
    expect(moved).toBeGreaterThan(STEERABLE.panYaw as number);

    await heldFor(600);
    expect(wheelValue(/yaw/i)).toBeGreaterThan(moved);
  });

  it("releasing the stick stops the wheel where it is", async () => {
    await stagedFeed();

    act(() => {
      dispatchAction(TEST_INSTANCE_ID, "panYaw", { kind: "analog", value: -1 });
    });
    await heldFor(600);

    act(() => {
      dispatchAction(TEST_INSTANCE_ID, "panYaw", { kind: "analog", value: 0 });
    });
    const atRelease = wheelValue(/yaw/i);
    await heldFor(3000);

    expect(wheelValue(/yaw/i)).toBe(atRelease);
  });

  it("sends the camera nothing while the stick is held: this is a draft", async () => {
    const { sidecar } = await stagedFeed();

    act(() => {
      dispatchAction(TEST_INSTANCE_ID, "panYaw", { kind: "analog", value: 1 });
    });
    await heldFor(2000);

    // Not one live pan command, however long the input is held. The whole
    // point of the staged mode is that ONE absolute command goes out, on the
    // operator's commit.
    expect(sidecar.lastCommand("set-pan-rate")).toBeUndefined();
    expect(wheelValue(/yaw/i)).not.toBe(STEERABLE.panYaw);
  });

  it("holds zoom-in on the field-of-view wheel, narrowing it", async () => {
    const { sidecar } = await stagedFeed();
    const before = wheelValue(/field of view/i);

    act(() => {
      dispatchAction(TEST_INSTANCE_ID, "zoomIn", { kind: "button", value: true });
    });
    await heldFor(600);

    expect(wheelValue(/field of view/i)).toBeLessThan(before);
    expect(sidecar.lastCommand("set-zoom-rate")).toBeUndefined();
  });

  it("holds zoom-out the other way", async () => {
    await stagedFeed();
    const before = wheelValue(/field of view/i);

    act(() => {
      dispatchAction(TEST_INSTANCE_ID, "zoomOut", {
        kind: "button",
        value: true,
      });
    });
    await heldFor(600);

    expect(wheelValue(/field of view/i)).toBeGreaterThan(before);
  });

  it("stops on a release even while the pitch stick is still held", async () => {
    // Two axes at once, because a stick has two and an operator holds both.
    await stagedFeed();

    act(() => {
      dispatchAction(TEST_INSTANCE_ID, "panYaw", { kind: "analog", value: 1 });
      dispatchAction(TEST_INSTANCE_ID, "panPitch", {
        kind: "analog",
        value: 1,
      });
    });
    await heldFor(600);
    const yawHeld = wheelValue(/yaw/i);
    const pitchHeld = wheelValue(/pitch/i);
    expect(yawHeld).toBeGreaterThan(STEERABLE.panYaw as number);
    expect(pitchHeld).toBeGreaterThan(STEERABLE.panPitch as number);

    act(() => {
      dispatchAction(TEST_INSTANCE_ID, "panYaw", { kind: "analog", value: 0 });
    });
    await heldFor(600);

    expect(wheelValue(/yaw/i)).toBe(yawHeld);
    expect(wheelValue(/pitch/i)).toBeGreaterThan(pitchHeld);
  });

  it("stops the wheel when the link goes live under a held stick", async () => {
    // Crossing back under the threshold takes the whole surface off the
    // picture, and with it the timer that was turning the wheel.
    const { sidecar } = await buildConnectedSource([STEERABLE]);
    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);
    act(() => {
      emitComms(stream, { connected: true, signalDelay: STAGED_DELAY_S });
    });
    await screen.findByRole("slider", { name: /yaw/i });

    act(() => {
      dispatchAction(TEST_INSTANCE_ID, "panYaw", { kind: "analog", value: 1 });
    });
    await heldFor(600);

    act(() => {
      emitComms(stream, { connected: true, signalDelay: LIVE_DELAY_S });
    });
    await waitFor(() =>
      expect(screen.queryByLabelText("Delayed camera control")).toBeNull(),
    );
    await heldFor(3000);

    // And the live camera was never driven by the stale rate either: the
    // gesture that crossed the threshold was consumed by the staged side.
    expect(sidecar.lastCommand("set-pan-rate")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// The SDK's own live pan/zoom, against the staged cluster.
//
// Two controls that aim the same camera cannot both be on the picture above the
// delay threshold: one of them steers at where the craft is now while the
// picture shows where it was a light-time ago, and nothing on screen says which
// one an operator is holding. So the staged cluster appearing and the live pad
// disappearing are ONE event, and this asserts them together rather than
// separately.
// ---------------------------------------------------------------------------

describe("CameraFeed -- live pan/zoom against the staged cluster", () => {
  async function feedAtDelay(oneWaySeconds: number): Promise<void> {
    await buildConnectedSource([STEERABLE]);
    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);
    await act(async () => {
      emitComms(stream, { connected: true, signalDelay: oneWaySeconds });
    });
  }

  it("leaves the SDK's pan pad and zoom pair in charge below the threshold", async () => {
    await feedAtDelay(LIVE_DELAY_S);

    expect(screen.getByLabelText("Pan camera")).toBeTruthy();
    expect(screen.getByLabelText("Zoom in")).toBeTruthy();
    expect(screen.getByLabelText("Zoom out")).toBeTruthy();
    expect(screen.queryByRole("slider", { name: /yaw/i })).toBe(null);
  });

  it("stands both of them down while the staged cluster is up", async () => {
    await feedAtDelay(STAGED_DELAY_S);

    await screen.findByRole("slider", { name: /yaw/i });
    expect(screen.queryByLabelText("Pan camera")).toBe(null);
    expect(screen.queryByLabelText("Zoom in")).toBe(null);
    expect(screen.queryByLabelText("Zoom out")).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// CommNet degrade
// ---------------------------------------------------------------------------

describe("CameraFeed: CommNet degrade", () => {
  beforeEach(() => {
    // `requestAnimationFrame` isn't in vitest's default fake-timer set, but
    // the migrated `vessel.comms`/`comms.link` reads only become visible
    // once the provider's rAF-scheduled frame commit runs. Fake it too so
    // `vi.advanceTimersByTime`'s 500ms debounce-advance also flushes that
    // commit, instead of leaving it waiting on the real (unmocked) clock.
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "requestAnimationFrame",
        "cancelAnimationFrame",
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("CommNet degrade 0 when signal is full strength", async () => {
    const { sidecar } = await buildConnectedSource();

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);

    // Reads are native topics now: emit after mount so the widget's already
    // subscribed, then let the rAF-scheduled store frame commit land.
    await act(async () => {
      emitComms(stream, { signalStrength: 1.0, connected: true });
    });

    // Two SEPARATE advances, not one bulk one: the first flushes the rAF
    // frame commit that makes the emitted comms data visible (the debounce
    // effect can only schedule ITS OWN 500ms timer once React has actually
    // committed that re-render); the second flushes that debounce. A single
    // `advanceTimersByTime` spanning both doesn't work: it fires every timer
    // due within its virtual window in one synchronous sweep, but the
    // debounce timer doesn't exist yet at the moment that sweep computes its
    // schedule; it's created by the effect commit, which needs the `act()`
    // boundary. Bundling both into one act() silently drops the second half.
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
    await act(async () => {
      vi.advanceTimersByTime(501);
    });

    const degradeMsg = sidecar.lastCommand("set-degrade");
    expect(degradeMsg).toBeTruthy();
    expect(degradeMsg?.content.flightId).toBe(42);
    // 1 - 1.0 = 0
    expect(degradeMsg?.content.level).toBe(0);
  });

  it("weak signal maps to a proportional degrade level (1 - signalStrength)", async () => {
    const { sidecar } = await buildConnectedSource();

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);

    await act(async () => {
      emitComms(stream, { signalStrength: 0.3, connected: true });
    });
    // Two separate advances: see the first test in this describe block for
    // why the rAF-then-debounce cascade needs its own act() boundary.
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
    await act(async () => {
      vi.advanceTimersByTime(501);
    });

    const degradeMsg = sidecar.lastCommand("set-degrade");
    expect(degradeMsg?.content.flightId).toBe(42);
    // 1 - 0.3 = 0.7, clamped to [0, 1]
    expect(degradeMsg?.content.level).toBeCloseTo(0.7);
  });

  it("comm disconnected applies maximum degrade (level 1.0)", async () => {
    const { sidecar } = await buildConnectedSource();

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);

    await act(async () => {
      emitComms(stream, { signalStrength: 1.0, connected: false });
    });
    // Two separate advances: see the first test in this describe block for
    // why the rAF-then-debounce cascade needs its own act() boundary.
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
    await act(async () => {
      vi.advanceTimersByTime(501);
    });

    const degradeMsg = sidecar.lastCommand("set-degrade");
    expect(degradeMsg?.content.flightId).toBe(42);
    // commConnected === false -> level 1.0 regardless of signalStrength
    expect(degradeMsg?.content.level).toBe(1.0);
  });

  it("auto-mode (flightId: null) degrade targets the auto-picked camera", async () => {
    // When config.flightId is null, the wrapper resolves effectiveFlightId
    // independently (same latch algorithm as the shared component) and routes
    // degrade to the camera actually on screen, not to a null/undefined id.
    const { sidecar } = await buildConnectedSource([
      makeCamera({ flightId: 42, cameraName: "Starboard Cam" }),
    ]);

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    // Auto mode: no explicit flightId configured.
    renderFeedWithComms({ flightId: null }, stream);

    await act(async () => {
      emitComms(stream, { signalStrength: 0.5, connected: true });
    });
    // Two separate advances: see the first test in this describe block for
    // why the rAF-then-debounce cascade needs its own act() boundary.
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
    await act(async () => {
      vi.advanceTimersByTime(501);
    });

    const degradeMsg = sidecar.lastCommand("set-degrade");
    // The wrapper should have resolved effectiveFlightId = 42 (the auto-pick)
    // and routed the degrade command there.
    expect(degradeMsg?.content.flightId).toBe(42);
    expect(degradeMsg?.content.level).toBeCloseTo(0.5);
  });

  it("resets degrade to 0 when signal returns with no strength reading (asymmetric-reset regression)", async () => {
    // Reproduces the wedged-decoder bug: a blackout sets degrade to 1.0, then
    // signal returns but no signalStrength value ever arrives on this
    // install (mod load order, RemoteTech override, vanilla CommNet variant
    // -- CommSignal's own comment above documents this same gap). The old
    // branching only reset degrade inside the `typeof signalStrength ===
    // "number"` branch, so this exact case left the browser's H.264 decoder
    // wedged at full degrade forever. The combined level must always resolve
    // once connected, falling back to 0 with no strength reading.
    const { sidecar } = await buildConnectedSource();

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);

    await act(async () => {
      emitComms(stream, { connected: false });
    });
    // Two separate advances: see the first test in this describe block for
    // why the rAF-then-debounce cascade needs its own act() boundary.
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
    await act(async () => {
      vi.advanceTimersByTime(501);
    });

    expect(sidecar.lastCommand("set-degrade")?.content.level).toBe(1.0);

    // Signal returns; signalStrength is never published for this install.
    await act(async () => {
      emitComms(stream, { connected: true });
    });
    // Two separate advances: see the first test in this describe block for
    // why the rAF-then-debounce cascade needs its own act() boundary.
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
    await act(async () => {
      vi.advanceTimersByTime(501);
    });

    const degradeMsg = sidecar.lastCommand("set-degrade");
    expect(degradeMsg?.content.flightId).toBe(42);
    expect(degradeMsg?.content.level).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Signal delay + signal quality badges: always-on header chrome, distinct
// from the CommNet-degrade effect above (that drives the SDK's video
// degradation; these are purely readouts). `comm.signalDelay` maps to
// `comms.delay.oneWaySeconds`: the badge is ONE-WAY, never doubled for
// round-trip (that's only for interactive command paths like the kOS
// terminal, which a camera downlink is not).
// ---------------------------------------------------------------------------

describe("CameraFeed: signal delay + signal quality badges", () => {
  it("shows the one-way signal delay badge as a one-decimal readout (sub-minute)", async () => {
    await buildConnectedSource();

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);

    act(() => {
      // A delay is a readout, not a countdown: sub-minute keeps one decimal
      // (3.8 -> "3.8 s"), NOT the time ladder's whole-unit truncation, so the
      // operator sees the real light-time. The space is SI's and comes from
      // the shared formatter, where the hand-rolled string had none.
      emitComms(stream, {
        signalStrength: 1.0,
        connected: true,
        signalDelay: 3.8,
      });
    });

    expect(await screen.findByText("3.8 s")).toBeTruthy();
    expect(screen.getByLabelText("Signal delay: 3.8 s one-way")).toBeTruthy();
  });

  it("shows a multi-unit one-way signal delay (e.g. deep-space distances)", async () => {
    await buildConnectedSource();

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);

    act(() => {
      emitComms(stream, {
        signalStrength: 1.0,
        connected: true,
        signalDelay: 80,
      });
    });

    expect(await screen.findByText("1min 20s")).toBeTruthy();
    expect(
      screen.getByLabelText("Signal delay: 1min 20s one-way"),
    ).toBeTruthy();
  });

  it("hides the delay badge when the delay is zero (LAN / no delay authority)", async () => {
    await buildConnectedSource();

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);

    act(() => {
      emitComms(stream, {
        signalStrength: 1.0,
        connected: true,
        signalDelay: 0,
      });
    });

    await screen.findByRole("button", { name: /starboard cam/i });
    expect(screen.queryByLabelText(/signal delay/i)).toBeNull();
  });

  it("hides the delay badge when no delay data has ever arrived", async () => {
    await buildConnectedSource();

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);

    act(() => {
      emitComms(stream, { signalStrength: 1.0, connected: true });
    });

    await screen.findByRole("button", { name: /starboard cam/i });
    expect(screen.queryByLabelText(/signal delay/i)).toBeNull();
  });

  it("shows the signal quality badge as a percentage", async () => {
    await buildConnectedSource();

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);

    act(() => {
      emitComms(stream, { signalStrength: 0.72, connected: true });
    });

    // `visibleText`, not `findByText`: <Unit> puts the number and its symbol in
    // separate elements with a thin space between, so no single node holds the
    // whole reading. The accessible name is the SPOKEN form, which is the
    // point of routing it through speakQuantity: a screen reader announcing
    // "72 percent" beats one announcing "72 percent-sign".
    await waitFor(() => expect(visibleText()).toContain("72 %"));
    expect(screen.getByLabelText("Signal quality: 72 percent")).toBeTruthy();
  });

  it("shows a clear no-signal state when comm.connected is false", async () => {
    await buildConnectedSource();

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);

    act(() => {
      emitComms(stream, { signalStrength: 0.72, connected: false });
    });

    expect(await screen.findByText("NO SIGNAL")).toBeTruthy();
    expect(screen.getByLabelText("Signal quality: no signal")).toBeTruthy();
    // The stale strength percentage is not shown alongside a lost link.
    expect(visibleText()).not.toContain("72 %");
  });
});

// ---------------------------------------------------------------------------
// Station (brokered) mode: the widget runs the SAME hooks, but the data source
// is in brokered mode: the WebRTC handshake relays through the host (the
// `negotiate` seam) and TURN comes from the relay broadcast. Driven by the
// SDK's canonical `MockSidecar` (the protocol-level fake), proving the camera
// UI works on a station, not just the main screen.
// ---------------------------------------------------------------------------

describe("CameraFeed: station (brokered) mode", () => {
  async function buildBrokeredSource(
    cams: Array<{ flightId: number; cameraName: string; vesselName: string }>,
  ): Promise<{ ds: KerbcastDataSource; sidecar: MockSidecar }> {
    const sidecar = new MockSidecar();
    for (const c of cams) {
      sidecar.addCamera({
        flightId: c.flightId,
        cameraName: c.cameraName,
        vesselName: c.vesselName,
        supportsZoom: false,
      });
    }
    const ds = new KerbcastDataSource({ port: 1 }, sidecar.createTransport());
    // Brokered: the offer→answer round-trips through the (faked) host instead
    // of a localhost POST; TURN would come from the relay broadcast (none here).
    ds.attachBroker({
      negotiate: (offer) => sidecar.negotiate(offer),
      iceServers: () => [],
      onIceServersChange: () => () => {},
    });
    registerUplinkHandle("kerbcast", ds);

    await act(async () => {
      await ds.connect();
    });
    await act(async () => {
      sidecar.open(); // hello + camera-snapshot
      sidecar.setConnectionState("connected");
    });
    createdSources.push(ds);
    return { ds, sidecar };
  }

  it("lists the host-relayed cameras and shows the selected one", async () => {
    await buildBrokeredSource([
      { flightId: 42, cameraName: "Starboard Cam", vesselName: "Kerbal X" },
      { flightId: 43, cameraName: "Nose Cam", vesselName: "Kerbal X" },
    ]);

    renderFeed({ flightId: 42 });

    expect(screen.getByRole("heading", { name: "Starboard Cam" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /starboard cam/i }));
    const labels = screen
      .getAllByRole("menuitemradio")
      .map((item) => item.textContent);
    expect(labels).toEqual(["Starboard Cam (Kerbal X)", "Nose Cam (Kerbal X)"]);
  });

  it("subscribes the displayed camera through the broker (slot bound)", async () => {
    const { sidecar } = await buildBrokeredSource([
      { flightId: 42, cameraName: "Starboard Cam", vesselName: "Kerbal X" },
    ]);

    renderFeed({ flightId: 42 });

    // The mounted widget's useKerbcastStream subscribed flightId 42, which the
    // sidecar answered with a slot binding: same dynamic path as the main
    // screen, but every message rode the brokered connection.
    await waitFor(() => {
      expect(sidecar.slotMidFor(42)).toBeDefined();
    });
    expect(sidecar.lastCommand("subscribe", 42)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Augment slot. CameraFeed exposes an OVERLAY
// slot (`camera-feed.overlay`, over the video). No first-party augment fills it
// (P3/P6): an empty slot renders cleanly, and a test augment registered into it
// appears, receiving the displayed camera's flightID as typed slot props.
// ---------------------------------------------------------------------------

describe("CameraFeed: augment slots (spec §4)", () => {
  it("exposes the slot (empty until an augment registers)", () => {
    // No augment bound → the registry lists none for the slot.
    expect(getAugmentsForSlot("camera-feed.overlay")).toEqual([]);
  });

  it("renders the feed with no augment bound (an empty slot is inert)", async () => {
    await buildConnectedSource();
    renderFeed({ flightId: 42 });

    // The stock feed renders; an empty slot adds nothing over the video.
    await screen.findByRole("button", { name: /starboard cam/i });
    expect(screen.queryByTestId("cam-overlay-augment")).toBeNull();
  });

  it("renders a test augment bound to the overlay slot, passing the displayed camera as slot props", async () => {
    function OverlayAugment({ flightId, width, height }: CameraOverlayContext) {
      return (
        <div data-testid="cam-overlay-augment">
          HUD:{flightId ?? "none"}:{width}x{height}
        </div>
      );
    }
    await buildConnectedSource();
    renderFeed({ flightId: 42 });

    act(() => {
      registerAugment({
        id: "test-cam-overlay",
        augments: "camera-feed.overlay",
        component: OverlayAugment,
      });
    });

    const augment = await screen.findByTestId("cam-overlay-augment");
    // The slot passed the displayed camera's flightID down. The
    // measured size is 0×0 under jsdom's no-op ResizeObserver stub.
    await waitFor(() => expect(augment.textContent).toBe("HUD:42:0x0"));
  });
});

// ---------------------------------------------------------------------------
// Delayed aim controls (#35), drawn OVER the picture.
//
// The widget is media-first: the video is the content and everything else is a
// layer on top of it that stays out of the way until the operator reaches for
// it. These cover the two halves of that: WHEN an aim surface exists at all,
// and when it is visible once it does.
// ---------------------------------------------------------------------------

const STEERABLE = makeCamera({
  flightId: 42,
  cameraName: "Starboard Cam",
  supportsPan: true,
  supportsZoom: true,
  panYaw: 18,
  panPitch: -10,
  panYawMin: -90,
  panYawMax: 90,
  panPitchMin: -45,
  panPitchMax: 45,
  fov: 45,
  fovMin: 10,
  fovMax: 90,
});

/** The layer the aim controls fade on, found from a control inside it. */
function aimLayer(): HTMLElement {
  const bar = screen.getByLabelText("Delayed camera control");
  const layer = bar.closest<HTMLElement>("[data-camera-aim]");
  if (!layer) throw new Error("aim controls are not on a reveal layer");
  return layer;
}

describe("CameraFeed: delayed aim controls", () => {
  it("is a panel, so the aim it commands has a delay rail to travel in", async () => {
    // The widget was a bare `FramedDisplay` and had no rail band, no status
    // dots, no `panelBadges` and neither universal augment segment. There is no
    // media exemption from `Panel`. What it does NOT take from the panel is a
    // title: the picker inside the picture already names the instrument, and a
    // panel title beside it is a second name for the same thing, paid for in
    // picture. The rail is the half that has to survive that, and it does: it
    // moves into the container's own top band rather than the header's.
    await buildConnectedSource([STEERABLE]);

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);

    await screen.findByRole("button", { name: /starboard cam/i });
    expect(document.querySelector("[data-panel-rail-frame]")).toBeTruthy();
  });

  it("takes no panel title, because the picker already names it", async () => {
    await buildConnectedSource([STEERABLE]);

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);

    // The name is the picker's, and it is a real control rather than a label:
    // the only route to the camera list is through the thing that names the
    // widget. It is also the widget's ONLY heading, which is what dropping the
    // panel title was for: two headings for one instrument, one of them a name
    // the operator cannot act on.
    const picker = await screen.findByRole("button", { name: /starboard cam/i });
    expect(picker.getAttribute("aria-haspopup")).toBe("menu");
    const headings = screen.getAllByRole("heading");
    expect(headings).toHaveLength(1);
    expect(headings[0]?.contains(picker)).toBe(true);
    // The panel takes its headerless path rather than drawing an empty header
    // row, which is the half the picture is paid out of: an empty row would
    // cost the same 47px of height while naming nothing.
    expect(document.querySelector("[data-panel-sticky-top]")).toBeNull();
  });

  it("still names itself when there is no camera to name", async () => {
    // The state where the picker has no camera name to show. The SDK falls back
    // to the words "Camera Feed" as the same heading, so the widget that has
    // given up its panel title still says what it is once it is reached for.
    // (Reached for is the caveat, and it is the SDK's rule rather than ours:
    // the whole top overlay is revealed on hover, focus or a pinning click.)
    await buildConnectedSource([]);

    renderFeed({ flightId: null });

    const heading = await screen.findByRole("heading", { name: "Camera Feed" });
    expect(heading).toBeTruthy();
    expect(document.querySelector("[data-panel-sticky-top]")).toBeNull();
  });

  it("gives a steerable camera an aim surface once the link is delayed", async () => {
    await buildConnectedSource([STEERABLE]);

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);

    act(() => {
      emitComms(stream, { connected: true, signalDelay: 1.4 });
    });

    expect(
      await screen.findByRole("slider", { name: /field of view/i }),
    ).toBeTruthy();
  });

  it("gives a FIXED camera none, however delayed the link is", async () => {
    // A fixed Hullcam has no aim to give it, and its pan bounds are a set of
    // zeroes rather than an absence, so a gate that only asked whether bounds
    // existed drew three dead 0-degree tapes across every fixed camera's shot.
    await buildConnectedSource([
      makeCamera({ flightId: 42, cameraName: "Nose Cam" }),
    ]);

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);

    act(() => {
      emitComms(stream, { connected: true, signalDelay: 1.4 });
    });

    await screen.findByRole("button", { name: /nose cam/i });
    expect(screen.queryByLabelText("Delayed camera control")).toBeNull();
  });

  it("keeps the aim controls off the picture until the pointer moves over it", async () => {
    await buildConnectedSource([STEERABLE]);

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);

    act(() => {
      emitComms(stream, { connected: true, signalDelay: 1.4 });
    });

    const bar = await screen.findByLabelText("Delayed camera control");
    expect(aimLayer().style.opacity).toBe("0");

    // Fired on a descendant and read on the layer: the reveal is held on the
    // feed, which is what makes it the same signal the kerbcast SDK's own
    // controls come back on, so the two clusters appear together.
    fireEvent.pointerMove(bar);
    expect(aimLayer().style.opacity).toBe("1");

    fireEvent.pointerLeave(bar);
    expect(aimLayer().style.opacity).toBe("0");
  });

  it("reveals them for the keyboard too, and never takes them out of the tree", async () => {
    // The fade is opacity and nothing else. A pointer-only affordance would
    // leave a keyboard operator dialling a camera they cannot see, and a
    // `display: none` one would leave them unable to reach it at all.
    await buildConnectedSource([STEERABLE]);

    const stream = setupStreamFixture({ carriedChannels: COMMS_TOPICS });
    renderFeedWithComms({ flightId: 42 }, stream);

    act(() => {
      emitComms(stream, { connected: true, signalDelay: 1.4 });
    });

    const yaw = await screen.findByRole("slider", { name: /yaw/i });
    expect(aimLayer().style.opacity).toBe("0");
    // Reachable while faded out, so it is still announced and still tabbable.
    expect(yaw.tabIndex).toBe(0);

    act(() => yaw.focus());
    expect(aimLayer().style.opacity).toBe("1");
  });
});
