import {
  ErrorCode,
  ErrorSource,
  type KerbcastTransport,
} from "@ksp-gonogo/kerbcast";
import { MockSidecar } from "@ksp-gonogo/kerbcast/testing";
import {
  GAME_HOST_KEY,
  getUplinkHandle,
  resetSettingsForTests,
  type StationBroker,
  setSetting,
} from "@ksp-gonogo/sitrep-sdk";
import { act, watchStationBrokers } from "@ksp-gonogo/sitrep-sdk/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  attachStationBroker,
  BrowserRTCTransport,
  KeepaliveTransport,
  KerbcastDataSource,
  kerbcastSource,
  MAX_SLOTS,
  MIN_SLOTS,
  slotPoolFor,
  NO_H264_MESSAGE,
  sidecarUnreachableMessage,
} from "./KerbcastDataSource.js";
import {
  createMockKerbcastSession,
  kerbcastFetchImpl,
} from "./test/MockKerbcastSession.js";

// Every KerbcastDataSource subscribes to the shared gameHost in its
// constructor, so a test that never disconnect()s leaks that subscription into
// the module-scoped listener registry across tests. Build them through this
// factory and tear every instance down in afterEach so no test has to remember
// (disconnect() is idempotent, so tests that already call it stay fine).
const createdSources: KerbcastDataSource[] = [];
function makeTracked(
  ...args: ConstructorParameters<typeof KerbcastDataSource>
): KerbcastDataSource {
  const ds = new KerbcastDataSource(...args);
  createdSources.push(ds);
  return ds;
}

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(kerbcastFetchImpl());
});

afterEach(() => {
  for (const ds of createdSources.splice(0)) ds.disconnect();
  resetSettingsForTests();
  localStorage.clear();
});

describe("KerbcastDataSource", () => {
  it("maps client state-change events onto DataSource status", async () => {
    const session = createMockKerbcastSession();
    const ds = makeTracked({ port: 1 }, session.transport);
    expect(ds.status).toBe("disconnected");

    const seen: string[] = [];
    ds.onStatusChange((s) => seen.push(s));

    await ds.connect();
    session.setState("connected");

    expect(seen).toContain("reconnecting"); // "connecting" → "reconnecting"
    expect(seen).toContain("connected");
    expect(ds.status).toBe("connected");
  });

  it("dials the sidecar at the shared core gameHost", async () => {
    setSetting(GAME_HOST_KEY, "192.168.5.5");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ sdp: "answer", cameras: [] }), {
        status: 200,
      }),
    );
    const ds = makeTracked();
    await ds.relayOffer({ sdp: "offer", cameras: [] });
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://192.168.5.5:8088/offer",
      expect.anything(),
    );
    fetchSpy.mockRestore();
    ds.disconnect();
  });
});

describe("KerbcastDataSource: sidecar reachability", () => {
  const OFFER = { sdp: "offer", cameras: [] as number[] };

  it("names the sidecar address once when /offer fails at the network level, however often it retries", async () => {
    setSetting(GAME_HOST_KEY, "192.168.5.5");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ds = makeTracked();
    const changes = vi.fn();
    ds.onSidecarReachabilityChange(changes);

    expect(ds.getSidecarReachability()).toBe("unknown");
    expect(ds.readinessNote()).toBeNull();

    for (let i = 0; i < 3; i++) {
      await expect(ds.relayOffer(OFFER)).rejects.toThrow();
    }

    expect(ds.getSidecarReachability()).toBe("unreachable");
    expect(ds.readinessNote()).toBe(sidecarUnreachableMessage("192.168.5.5", 8088));
    expect(ds.readinessNote()).toMatch(/192\.168\.5\.5:8088.*BindAddress/);
    expect(changes).toHaveBeenCalledTimes(1);
    expect(
      warn.mock.calls.filter((call) => /unreachable/.test(String(call[0]))),
    ).toHaveLength(1);
  });

  it("clears the note once the sidecar answers, even with a refusal status", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed"))
      .mockResolvedValue(new Response("busy", { status: 503 }));
    const ds = makeTracked();

    await expect(ds.relayOffer(OFFER)).rejects.toThrow();
    expect(ds.getSidecarReachability()).toBe("unreachable");

    await expect(ds.relayOffer(OFFER)).rejects.toThrow(/returned 503/);
    expect(ds.getSidecarReachability()).toBe("reachable");
    expect(ds.readinessNote()).toBeNull();
    fetchSpy.mockRestore();
  });
});

describe("KerbcastDataSource: ICE servers", () => {
  const STUN_DEFAULT: RTCIceServer = {
    urls: "stun:stun.l.google.com:19302",
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays on the SDK's STUN default across a failed connection, on the same client, and asks no relay for servers", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(kerbcastFetchImpl());
    const session = createMockKerbcastSession();
    const ds = makeTracked({ port: 1 }, session.transport);
    const clientBefore = ds.getClient();
    await ds.connect();
    expect(session.iceServers).toEqual([STUN_DEFAULT]);

    session.setState("failed");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_001);
    });

    expect(session.iceServers).toEqual([STUN_DEFAULT]);
    expect(ds.getClient()).toBe(clientBefore);
    const fetchSpy = vi.mocked(globalThis.fetch);
    expect(
      fetchSpy.mock.calls.some(([url]) => String(url).includes("/ice-config")),
    ).toBe(false);
    ds.disconnect();
  });
});

describe("KerbcastDataSource: keepalive + reconnect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("responds to ping with pong", async () => {
    const session = createMockKerbcastSession();
    const ds = makeTracked({ port: 1 }, session.transport);

    await ds.connect();
    session.openChannel();
    session.sentMessages.length = 0; // drop hello

    session.sendServerMessage({ type: "ping" });

    expect(session.sentMessages).toContain(JSON.stringify({ type: "pong" }));
  });

  it("ping resets the watchdog so no reconnect fires within 15s of last ping", async () => {
    const session = createMockKerbcastSession();
    const ds = makeTracked({ port: 1 }, session.transport);

    await ds.connect();
    session.setState("connected");

    const fetchSpy = vi.mocked(globalThis.fetch);
    const callsBefore = fetchSpy.mock.calls.length;

    // Advance 14s: no ping yet, watchdog hasn't fired
    await act(async () => {
      await vi.advanceTimersByTimeAsync(14_000);
    });

    // Fire a ping (resets the watchdog)
    session.sendServerMessage({ type: "ping" });

    // Advance another 14s (28s total from connect, but only 14s since the ping)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(14_000);
    });

    // No reconnect attempt should have happened
    expect(fetchSpy.mock.calls.length).toBe(callsBefore);

    ds.disconnect();
  });

  it("watchdog fires after 15s and triggers reconnect", async () => {
    const session = createMockKerbcastSession();
    const ds = makeTracked({ port: 1 }, session.transport);

    await ds.connect();
    session.setState("connected");

    const fetchSpy = vi.mocked(globalThis.fetch);
    const callsBefore = fetchSpy.mock.calls.length;

    // No ping: advance past the 15s watchdog
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_001);
    });

    // Reconnect attempt should have fired (a new /offer fetch)
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsBefore);

    ds.disconnect();
  });

  it("explicit disconnect() prevents reconnect after watchdog fires", async () => {
    const session = createMockKerbcastSession();
    const ds = makeTracked({ port: 1 }, session.transport);

    await ds.connect();
    session.setState("connected");

    ds.disconnect();

    const fetchSpy = vi.mocked(globalThis.fetch);
    const callsAfterDisconnect = fetchSpy.mock.calls.length;

    // Advance well past any watchdog or reconnect threshold
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(fetchSpy.mock.calls.length).toBe(callsAfterDisconnect);
  });

  it("WebRTC 'failed' triggers exponential backoff", async () => {
    const session = createMockKerbcastSession();
    const ds = makeTracked({ port: 1 }, session.transport);

    await ds.connect();
    session.setState("connected");

    const fetchSpy = vi.mocked(globalThis.fetch);
    const callsBefore = fetchSpy.mock.calls.length;

    // Fire a failed state: should schedule a reconnect at 2s
    session.setState("failed");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_001);
    });

    expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsBefore);

    ds.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Dynamic slot subscription: exercised against the SDK's canonical protocol
// fake (MockSidecar) rather than the local transport fake, so these tests cover
// the real subscribe → slot-map round-trip the sidecar speaks.
// ---------------------------------------------------------------------------

describe("KerbcastDataSource: dynamic slot subscription", () => {
  function mockFetch(): void {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
      Promise.resolve(MockSidecar.makeOfferResponse([])),
    );
  }

  async function connectedSidecar(
    flightIds: number[] = [42, 43],
  ): Promise<{ ds: KerbcastDataSource; sidecar: MockSidecar }> {
    const sidecar = new MockSidecar();
    flightIds.forEach((flightId) => {
      sidecar.addCamera({ flightId });
    });
    mockFetch();
    const ds = makeTracked({ port: 1 }, sidecar.createTransport());
    await ds.connect();
    sidecar.open();
    sidecar.setConnectionState("connected");
    return { ds, sidecar };
  }

  function subscribeCount(sidecar: MockSidecar, flightId: number): number {
    return sidecar.commands.filter(
      (c) => c.type === "subscribe" && c.content.flightId === flightId,
    ).length;
  }

  it("binds a slot when a camera is subscribed while connected", async () => {
    const { ds, sidecar } = await connectedSidecar();

    ds.subscribeCamera(42);

    expect(sidecar.lastCommand("subscribe", 42)).toBeTruthy();
    expect(sidecar.slotMidFor(42)).toBeDefined();

    ds.disconnect();
  });

  it("refcounts subscribers: one slot shared, freed only on the last release", async () => {
    const { ds, sidecar } = await connectedSidecar();

    ds.subscribeCamera(42);
    ds.subscribeCamera(42); // a second widget shows the same camera

    expect(subscribeCount(sidecar, 42)).toBe(1); // one slot, not two

    ds.unsubscribeCamera(42); // first widget gone: still shown elsewhere
    expect(sidecar.lastCommand("unsubscribe", 42)).toBeUndefined();
    expect(sidecar.slotMidFor(42)).toBeDefined();

    ds.unsubscribeCamera(42); // last widget gone: slot frees
    expect(sidecar.lastCommand("unsubscribe", 42)).toBeTruthy();
    expect(sidecar.slotMidFor(42)).toBeUndefined();

    ds.disconnect();
  });

  it("switching cameras frees the old slot and binds the new one", async () => {
    const { ds, sidecar } = await connectedSidecar();

    ds.subscribeCamera(42);
    expect(sidecar.slotMidFor(42)).toBeDefined();

    // The flightId change useKerbcastStream drives: release old, bind new.
    ds.unsubscribeCamera(42);
    ds.subscribeCamera(43);

    expect(sidecar.slotMidFor(42)).toBeUndefined();
    expect(sidecar.slotMidFor(43)).toBeDefined();

    ds.disconnect();
  });

  it.each([
    ["an old-shape error with an em dash and no code", { message: "no free slot \u2014 every transceiver is bound" }],
    ["a hyphenated message with no code", { message: "no free slot - every transceiver is bound" }],
    ["a coded refusal carrying its flightId", { message: "no free slot", flightId: 42, code: ErrorCode.NoFreeSlot }],
  ])("a refused subscribe as %s leaves the connection up and later binds working", async (_name, payload) => {
    const { ds, sidecar } = await connectedSidecar();

    ds.subscribeCamera(42);
    sidecar.fireError({ source: ErrorSource.Sidecar, ...payload });

    expect(ds.status).toBe("connected");
    ds.subscribeCamera(43);
    expect(sidecar.slotMidFor(43)).toBeDefined();

    ds.disconnect();
  });

  it("an old-shape camera-not-found error still releases the bind it was about", async () => {
    const { ds, sidecar } = await connectedSidecar();

    ds.subscribeCamera(42);
    sidecar.fireError({ source: ErrorSource.Sidecar, message: "no live camera with flight_id=42" });

    expect(ds.status).toBe("connected");
    ds.unsubscribeCamera(42);
    ds.subscribeCamera(42);
    expect(sidecar.slotMidFor(42)).toBeDefined();

    ds.disconnect();
  });

  describe("refusals", () => {
    it("a coded no-free-slot refusal names its camera, whatever order binds were asked in", async () => {
      const { ds, sidecar } = await connectedSidecar();
      ds.subscribeCamera(42);
      ds.subscribeCamera(43);
      const changes = vi.fn();
      ds.onRefusalsChange(changes);

      sidecar.fireError({
        message: "no free slot - negotiate more video transceivers",
        source: ErrorSource.Sidecar,
        flightId: 43,
        code: ErrorCode.NoFreeSlot,
      });

      expect(ds.refusalFor(43)).toBe(ErrorCode.NoFreeSlot);
      expect(ds.refusalFor(42)).toBeUndefined();
      expect(changes).toHaveBeenCalledTimes(1);

      ds.unsubscribeCamera(43);
      expect(ds.refusalFor(43)).toBeUndefined();

      ds.disconnect();
    });

    it("a no-free-slot error from a sidecar older than 1.10.0 is read as the oldest unanswered bind", async () => {
      const sidecar = new MockSidecar();
      mockFetch();
      const inner = sidecar.createTransport();
      // Subscribes go unanswered, the way they are until the sidecar replies.
      const transport: KerbcastTransport = {
        createPeer: (ice) => {
          const peer = inner.createPeer(ice);
          return {
            ...peer,
            createDataChannel: (label) => {
              const channel = peer.createDataChannel(label);
              return {
                ...channel,
                send: (payload) => {
                  if (!payload.includes('"subscribe"')) channel.send(payload);
                },
              };
            },
          };
        },
      };
      const ds = makeTracked({ port: 1 }, transport);
      await ds.connect();
      sidecar.open();
      sidecar.setConnectionState("connected");
      ds.subscribeCamera(42);
      ds.subscribeCamera(43);

      sidecar.fireError({ message: "no free slot", source: ErrorSource.Sidecar });

      expect(ds.refusalFor(42)).toBe(ErrorCode.NoFreeSlot);
      expect(ds.refusalFor(43)).toBeUndefined();

      ds.disconnect();
    });

    it("a camera-destroyed refusal is reported against its camera", async () => {
      const { ds, sidecar } = await connectedSidecar();
      ds.subscribeCamera(42);

      sidecar.fireError({
        message: "camera destroyed",
        source: ErrorSource.Sidecar,
        flightId: 42,
        code: ErrorCode.CameraDestroyed,
      });

      expect(ds.refusalFor(42)).toBe(ErrorCode.CameraDestroyed);

      ds.disconnect();
    });

    it("a camera named at connect that is not there yet is not refused, and binds once it registers", async () => {
      const { ds, sidecar } = await connectedSidecar([42]);
      ds.subscribeCamera(99);
      const before = subscribeCount(sidecar, 99);

      sidecar.fireError({
        message: "no live camera with flight_id=99",
        source: ErrorSource.Sidecar,
        flightId: 99,
        code: ErrorCode.CameraNotFound,
      });
      expect(ds.refusalFor(99)).toBeUndefined();

      sidecar.setCameras([{ flightId: 42 }, { flightId: 99 }]);

      expect(subscribeCount(sidecar, 99)).toBe(before + 1);
      expect(sidecar.slotMidFor(99)).toBeDefined();

      ds.disconnect();
    });

    it("a camera-not-found refusal for a camera nobody shows any more is not retried", async () => {
      const { ds, sidecar } = await connectedSidecar([42]);
      ds.subscribeCamera(99);
      sidecar.fireError({
        message: "no live camera with flight_id=99",
        source: ErrorSource.Sidecar,
        flightId: 99,
        code: ErrorCode.CameraNotFound,
      });
      ds.unsubscribeCamera(99);
      const before = subscribeCount(sidecar, 99);

      sidecar.setCameras([{ flightId: 42 }, { flightId: 99 }]);

      expect(subscribeCount(sidecar, 99)).toBe(before);

      ds.disconnect();
    });
  });

  it("re-binds on-screen cameras via the initial offer set (cold start / reconnect)", async () => {
    const sidecar = new MockSidecar();
    sidecar.addCamera({ flightId: 42 });
    mockFetch();
    const fetchSpy = vi.mocked(globalThis.fetch);
    const ds = makeTracked({ port: 1 }, sidecar.createTransport());

    // A widget mounts before the sidecar is reachable.
    ds.subscribeCamera(42);
    // Nothing can be sent over a closed channel, no live subscribe yet.
    expect(sidecar.commands.some((c) => c.type === "subscribe")).toBe(false);

    // The fetch spy accumulates calls across tests in this file; drop the
    // history so the /offer we inspect below is unambiguously this connect's.
    fetchSpy.mockClear();
    await ds.connect();

    // The desired camera rides along as the offer's initial bound set, so the
    // sidecar pushes its SlotMap on Hello without a client-side round-trip.
    const offerCall = fetchSpy.mock.calls.find(([url]) =>
      String(url).includes("/offer"),
    );
    const body = JSON.parse(String(offerCall?.[1]?.body ?? "{}")) as {
      slots?: number;
      cameras?: number[];
    };
    expect(body.slots).toBe(slotPoolFor(1));
    expect(body.cameras).toEqual([42]);

    ds.disconnect();
  });
});

describe("KerbcastDataSource: the slot pool is sized to what is mounted", () => {
  function offerBodies(): Array<{ slots?: number; cameras?: number[] }> {
    return vi
      .mocked(globalThis.fetch)
      .mock.calls.filter(([url]) => String(url).includes("/offer"))
      .map(
        ([, init]) =>
          JSON.parse(String(init?.body ?? "{}")) as {
            slots?: number;
            cameras?: number[];
          },
      );
  }

  function mockFetch(): void {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
      Promise.resolve(MockSidecar.makeOfferResponse([])),
    );
    vi.mocked(globalThis.fetch).mockClear();
  }

  async function connected(flightIds: number[]) {
    const sidecar = new MockSidecar();
    flightIds.forEach((flightId) => {
      sidecar.addCamera({ flightId });
    });
    mockFetch();
    const ds = makeTracked({ port: 1 }, sidecar.createTransport());
    await ds.connect();
    sidecar.open();
    sidecar.setConnectionState("connected");
    return { ds, sidecar };
  }

  it("negotiates only the minimum pool when nothing is mounted", async () => {
    const { ds } = await connected([42]);

    expect(offerBodies().map((b) => b.slots)).toEqual([MIN_SLOTS]);
    expect(MIN_SLOTS).toBeLessThan(MAX_SLOTS);

    ds.disconnect();
  });

  it("sizes the pool to the mounted cameras and a little headroom", () => {
    expect(slotPoolFor(0)).toBe(MIN_SLOTS);
    expect(slotPoolFor(MIN_SLOTS)).toBeGreaterThan(MIN_SLOTS);
    expect(slotPoolFor(MIN_SLOTS + 3)).toBeGreaterThan(MIN_SLOTS + 3);
    expect(slotPoolFor(1_000)).toBe(MAX_SLOTS);
  });

  it("renegotiates a larger pool when more cameras are mounted than it holds", async () => {
    const ids = Array.from({ length: MIN_SLOTS + 2 }, (_, i) => 100 + i);
    const { ds, sidecar } = await connected(ids);
    expect(offerBodies()).toHaveLength(1);

    for (const id of ids) ds.subscribeCamera(id);
    await vi.waitFor(() => expect(offerBodies()).toHaveLength(2));

    const grown = offerBodies()[1];
    expect(grown.slots).toBe(slotPoolFor(ids.length));
    expect(grown.slots).toBeGreaterThanOrEqual(ids.length);
    expect(grown.cameras).toEqual(ids);
    expect(sidecar.commands.some((c) => c.type === "subscribe" && c.content.flightId === ids[MIN_SLOTS])).toBe(false);

    ds.disconnect();
  });

  it("renegotiates once for cameras mounted together", async () => {
    const ids = Array.from({ length: MIN_SLOTS + 4 }, (_, i) => 200 + i);
    const { ds } = await connected(ids);

    for (const id of ids) ds.subscribeCamera(id);
    await vi.waitFor(() => expect(offerBodies()).toHaveLength(2));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(offerBodies()).toHaveLength(2);

    ds.disconnect();
  });

  it("does not renegotiate while the mounted cameras fit the pool", async () => {
    const { ds } = await connected([301, 302]);

    ds.subscribeCamera(301);
    ds.subscribeCamera(302);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(offerBodies()).toHaveLength(1);

    ds.disconnect();
  });

  it("never asks for more than the ceiling, and leaves the rest to the sidecar's refusal", async () => {
    const ids = Array.from({ length: MAX_SLOTS + 3 }, (_, i) => 400 + i);
    const { ds } = await connected(ids);

    for (const id of ids) ds.subscribeCamera(id);
    await vi.waitFor(() => expect(offerBodies()).toHaveLength(2));

    expect(offerBodies()[1].slots).toBe(MAX_SLOTS);

    ds.disconnect();
  });

  it("a reconnect sizes the pool from what is mounted then, not from what it once was", async () => {
    const ids = Array.from({ length: MIN_SLOTS + 2 }, (_, i) => 500 + i);
    const { ds } = await connected(ids);
    for (const id of ids) ds.subscribeCamera(id);
    await vi.waitFor(() => expect(offerBodies()).toHaveLength(2));
    for (const id of ids) ds.unsubscribeCamera(id);

    await ds.connect();

    expect(offerBodies().at(-1)?.slots).toBe(MIN_SLOTS);

    ds.disconnect();
  });
});

// ---------------------------------------------------------------------------
// relayOffer: the main screen's half of the station broker. Forwards a
// station's offer to the local sidecar's /offer and returns the answer.
// ---------------------------------------------------------------------------

describe("KerbcastDataSource: relayOffer (station broker)", () => {
  it("POSTs the offer to the sidecar /offer and returns the answer", async () => {
    setSetting(GAME_HOST_KEY, "sidehost");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ sdp: "answer-sdp", cameras: [42, 43] }), {
        status: 200,
      }),
    );
    fetchSpy.mockClear();

    const ds = makeTracked({ port: 9090 });
    const answer = await ds.relayOffer({
      sdp: "offer-sdp",
      cameras: [42, 43],
      slots: 6,
    });

    expect(answer).toEqual({ sdp: "answer-sdp", cameras: [42, 43] });
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(String(url)).toBe("http://sidehost:9090/offer");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      sdp: "offer-sdp",
      cameras: [42, 43],
      slots: 6,
    });
  });

  it("throws when the sidecar returns a non-OK status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("unavailable", { status: 503 }),
    );

    const ds = makeTracked({ port: 1 });
    await expect(ds.relayOffer({ sdp: "o", cameras: [] })).rejects.toThrow(
      /503/,
    );
  });
});

// ---------------------------------------------------------------------------
// registerUplinkHandle("kerbcast", ...): the host-side relay handle a
// station's peer-relayed negotiate() call dispatches through (see
// PeerHostService.handleUplinkRelay). Delegates to the module singleton's
// relayOffer(), unchanged.
// ---------------------------------------------------------------------------

describe("KerbcastDataSource module: registerUplinkHandle('kerbcast', ...) registration", () => {
  it("delegates the 'negotiate' relay method to the kerbcastSource singleton's relayOffer", async () => {
    setSetting(GAME_HOST_KEY, "sidehost");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ sdp: "answer-sdp", cameras: [1] }), {
        status: 200,
      }),
    );
    fetchSpy.mockClear();

    const handle = getUplinkHandle<{
      relay: (method: string, args: unknown) => Promise<unknown>;
    }>("kerbcast");
    expect(handle).toBeDefined();

    const answer = await handle?.relay("negotiate", {
      sdp: "offer-sdp",
      cameras: [1],
    });
    expect(answer).toEqual({ sdp: "answer-sdp", cameras: [1] });
    // Prove it went through the real relayOffer(), not a stub.
    expect(fetchSpy).toHaveBeenCalledWith(
      `http://sidehost:${kerbcastSource.getConfig().port}/offer`,
      expect.anything(),
    );
  });

  it("rejects an unknown relay method", async () => {
    const handle = getUplinkHandle<{
      relay: (method: string, args: unknown) => Promise<unknown>;
    }>("kerbcast");
    await expect(handle?.relay("bogus", {})).rejects.toThrow(
      /unknown method "bogus"/,
    );
  });

  it("registers the full kerbcastSource instance, not a narrower relay-only object", () => {
    const handle = getUplinkHandle<KerbcastDataSource>("kerbcast");
    expect(handle).toBe(kerbcastSource);
    expect(typeof handle?.getClient).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Brokered (station) mode: the station relays the handshake through the host,
// never touching localhost.
// ---------------------------------------------------------------------------

describe("KerbcastDataSource: brokered (station) mode", () => {
  it("routes the handshake through the broker and skips the localhost fetch", async () => {
    const sidecar = new MockSidecar();
    sidecar.addCamera({ flightId: 42 });
    // A station has no relay on localhost, any fetch here is a bug.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("no localhost relay on a station"));
    fetchSpy.mockClear();

    const negotiate = vi.fn((offer: { sdp: string; cameras: number[] }) =>
      sidecar.negotiate(offer),
    );
    const ds = makeTracked({ port: 1 }, sidecar.createTransport());
    ds.attachBroker({ negotiate });

    await ds.connect();

    // No /offer was fetched, the broker handled signaling.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(negotiate).toHaveBeenCalledTimes(1);

    ds.disconnect();
  });

  it("stays idle until a camera is wanted, then lazily connects via the broker", async () => {
    const sidecar = new MockSidecar();
    sidecar.addCamera({ flightId: 42 });
    // A station has no localhost relay, any fetch would be the wrong path.
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no localhost"));
    const negotiate = vi.fn((offer: { sdp: string; cameras: number[] }) =>
      sidecar.negotiate(offer),
    );

    const ds = makeTracked({ port: 1 }, sidecar.createTransport());
    ds.attachBroker({ negotiate });

    // Brokered but no camera wanted yet → no connection, no negotiate.
    expect(ds.status).toBe("disconnected");
    expect(negotiate).not.toHaveBeenCalled();

    // First camera widget asks for a stream → lazy connect through the broker.
    ds.subscribeCamera(42);
    await vi.waitFor(() => {
      expect(negotiate).toHaveBeenCalledTimes(1);
    });

    ds.disconnect();
  });
});

describe("KerbcastDataSource: the station broker it registers", () => {
  it("registers one for kerbcast, so a station hands it a broker", () => {
    const seen: string[] = [];
    const stop = watchStationBrokers((uplinkId) => seen.push(uplinkId));
    stop();
    expect(seen).toContain("kerbcast");
  });

  it("relays the handshake through the station's relay", async () => {
    const sidecar = new MockSidecar();
    sidecar.addCamera({ flightId: 42 });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("no localhost relay on a station"));
    fetchSpy.mockClear();

    const relay = vi.fn((method: string, args?: unknown) => {
      expect(method).toBe("negotiate");
      return sidecar.negotiate(args as { sdp: string; cameras: number[] });
    });
    // Typed loosely: an older SDK's StationBroker still names iceServers, which this Uplink no longer reads.
    const broker = { relay } as unknown as StationBroker;
    const ds = makeTracked({ port: 1 }, sidecar.createTransport());
    attachStationBroker(ds, broker);

    await ds.connect();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(relay).toHaveBeenCalledTimes(1);
  });
});

describe("KerbcastDataSource: a station's offer on the main screen", () => {
  const OFFER = { sdp: "v=station-offer", cameras: [42], slots: 2 };

  it("goes to the sidecar as it is for a station on this network", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ sdp: "v=sidecar", cameras: [42] })),
      );
    const ds = makeTracked();
    await expect(
      ds.relay("negotiate", OFFER, { station: "station-a" }),
    ).resolves.toEqual({ sdp: "v=sidecar", cameras: [42] });
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual(OFFER);
    fetchSpy.mockRestore();
  });

  it("is bridged for a station on the relay's endpoint: the endpoint's offer goes to the sidecar and the station gets the endpoint's answer", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ sdp: "v=sidecar", cameras: [42] })),
      );
    const bridgeMedia = vi.fn(
      async (offer: string, upstream: (o: string) => Promise<string>) => {
        expect(offer).toBe("v=station-offer");
        expect(await upstream("v=endpoint-offer")).toBe("v=sidecar");
        return "v=endpoint-answer";
      },
    );
    const ds = makeTracked();
    await expect(
      ds.relay("negotiate", OFFER, { station: "station-a", bridgeMedia }),
    ).resolves.toEqual({ sdp: "v=endpoint-answer", cameras: [42] });
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({
      ...OFFER,
      sdp: "v=endpoint-offer",
    });
    fetchSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// The browser peer connection: one transport for every media line, and closed
// when it fails, so nothing holds a path for a peer that is gone.
// ---------------------------------------------------------------------------

/** A receiver class with the `transform` property a browser with script transforms has. */
class ScriptCapableReceiver {
  get transform(): unknown {
    return null;
  }
}

describe("BrowserRTCTransport: its peer connection", () => {
  class FakePeerConnection {
    static instances: FakePeerConnection[] = [];
    readonly config: RTCConfiguration;
    closed = false;
    connectionState: RTCPeerConnectionState = "new";
    iceGatheringState: RTCIceGatheringState = "complete";
    localDescription = { sdp: "v=0" };
    onconnectionstatechange: (() => void) | null = null;
    ontrack: unknown = null;

    constructor(config: RTCConfiguration) {
      this.config = config;
      FakePeerConnection.instances.push(this);
    }

    addTransceiver(): void {}
    createDataChannel(): object {
      return { send: () => {}, close: () => {} };
    }
    async createOffer(): Promise<{ sdp: string }> {
      return { sdp: "v=0" };
    }
    async setLocalDescription(): Promise<void> {}
    async setRemoteDescription(): Promise<void> {}
    addEventListener(): void {}
    removeEventListener(): void {}
    close(): void {
      this.closed = true;
    }
  }

  beforeEach(() => {
    FakePeerConnection.instances = [];
    vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates every peer with the max-bundle policy and the given ICE servers", () => {
    const servers = [{ urls: "stun:stun.example:19302" }];

    new BrowserRTCTransport().createPeer(servers);

    expect(FakePeerConnection.instances).toHaveLength(1);
    expect(FakePeerConnection.instances[0].config).toEqual({
      iceServers: servers,
      bundlePolicy: "max-bundle",
    });
  });

  it("closes a peer whose connection state goes failed", () => {
    const peer = new BrowserRTCTransport().createPeer([]);
    const states: string[] = [];
    peer.onStateChange((s) => states.push(s));
    const pc = FakePeerConnection.instances[0];

    pc.connectionState = "connected";
    pc.onconnectionstatechange?.();
    expect(pc.closed).toBe(false);

    pc.connectionState = "failed";
    pc.onconnectionstatechange?.();

    expect(states).toEqual(["connected", "failed"]);
    expect(pc.closed).toBe(true);
  });

  it("does not close a peer that is merely disconnected", () => {
    new BrowserRTCTransport().createPeer([]);
    const pc = FakePeerConnection.instances[0];

    pc.connectionState = "disconnected";
    pc.onconnectionstatechange?.();

    expect(pc.closed).toBe(false);
  });

  it("closes the peer when the sidecar refuses the offer", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
      Promise.resolve(
        new Response("unavailable", { status: 503 }),
      ),
    );
    const ds = makeTracked({ port: 1 });

    await expect(ds.connect()).rejects.toThrow();

    expect(FakePeerConnection.instances.length).toBeGreaterThan(0);
    expect(FakePeerConnection.instances[0].closed).toBe(true);
    expect(FakePeerConnection.instances[0].config.bundlePolicy).toBe(
      "max-bundle",
    );
  });

  it("gives every receiver a passthrough transform from creation when encoded transforms are on", () => {
    class FakeScriptTransform {}
    vi.stubGlobal("RTCRtpScriptTransform", FakeScriptTransform);
    vi.stubGlobal("RTCRtpReceiver", ScriptCapableReceiver);
    vi.stubGlobal("Worker", class {});
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:passthrough");
    const receivers: Array<{ transform: unknown }> = [];
    vi.spyOn(FakePeerConnection.prototype, "addTransceiver").mockImplementation(
      () => {
        const receiver = { transform: null };
        receivers.push(receiver);
        return { receiver } as unknown as void;
      },
    );

    const transport = new BrowserRTCTransport();
    expect(transport.encodedTransformPath({ encodedTransforms: true })).toBe(
      "script",
    );
    const peer = transport.createPeer([], { encodedTransforms: true });
    peer.addRecvOnlyTransceiver();

    expect(receivers[0]?.transform).toBeInstanceOf(FakeScriptTransform);
    expect(peer.setReceiverTransform).toBeTypeOf("function");
  });

  it("builds its client with encoded transforms on, so a camera's delay can go before decode", () => {
    vi.stubGlobal("RTCRtpScriptTransform", class {});
    vi.stubGlobal("RTCRtpReceiver", ScriptCapableReceiver);
    const ds = makeTracked({ port: 1 });

    expect(ds.getClient().encodedTransformPath).toBe("script");
  });

  it("closes the peer when the host refuses a station's offer", async () => {
    const ds = makeTracked({ port: 1 });
    ds.attachBroker({
      negotiate: () => Promise.reject(new Error("host unreachable")),
    });

    await expect(ds.connect()).rejects.toThrow(/host unreachable/);

    expect(FakePeerConnection.instances[0].closed).toBe(true);
  });
});

describe("KerbcastDataSource: browser without an H.264 decoder", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const receiverWith = (mimeTypes: string[]) => ({
    getCapabilities: () => ({
      codecs: mimeTypes.map((mimeType) => ({ mimeType, clockRate: 90000 })),
    }),
  });

  it("says plainly that the browser cannot play the camera video and does not connect", async () => {
    vi.stubGlobal("RTCRtpReceiver", receiverWith(["video/VP8", "video/VP9"]));
    const ds = makeTracked();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockClear();

    await ds.connect();

    expect(ds.readinessNote()).toBe(NO_H264_MESSAGE);
    expect(fetchSpy.mock.calls.map((c) => String(c[0]))).toEqual([]);
    fetchSpy.mockRestore();
  });

  it("stays quiet when H.264 is listed, in any letter case", () => {
    vi.stubGlobal("RTCRtpReceiver", receiverWith(["video/VP8", "video/h264"]));
    expect(makeTracked().readinessNote()).toBeNull();
  });
});

describe("KeepaliveTransport: encoded transforms", () => {
  it("passes the peer options, the install path and receiver transforms through to the transport it wraps", () => {
    const created: unknown[] = [];
    const installed: Array<[string, unknown]> = [];
    const inner = {
      encodedTransformPath: (opts: { encodedTransforms?: boolean }) =>
        opts.encodedTransforms ? ("script" as const) : null,
      createPeer: (_servers: RTCIceServer[], opts?: unknown) => {
        created.push(opts);
        return {
          setReceiverTransform: (mid: string, t: unknown) => {
            installed.push([mid, t]);
          },
        } as unknown as ReturnType<KerbcastTransport["createPeer"]>;
      },
    };
    const keepalive = new KeepaliveTransport(inner, () => {});

    expect(keepalive.encodedTransformPath({ encodedTransforms: true })).toBe(
      "script",
    );
    const peer = keepalive.createPeer([], { encodedTransforms: true });
    const transform = {};
    peer.setReceiverTransform?.("3", transform as RTCRtpScriptTransform);

    expect(created).toEqual([{ encodedTransforms: true }]);
    expect(installed).toEqual([["3", transform]]);
  });
});

describe("KerbcastDataSource: per-frame capture stamps", () => {
  async function connectedSidecar(): Promise<{
    ds: KerbcastDataSource;
    sidecar: MockSidecar;
  }> {
    const sidecar = new MockSidecar();
    sidecar.addCamera({ flightId: 42 });
    vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
      Promise.resolve(
        String(input).includes("/ice-config")
          ? new Response(JSON.stringify({ iceServers: [] }), { status: 200 })
          : MockSidecar.makeOfferResponse([]),
      ),
    );
    const ds = makeTracked({ port: 1 }, sidecar.createTransport());
    await ds.connect();
    return { ds, sidecar };
  }

  it("offers no feed until the sidecar says it sends stamps", async () => {
    const { ds, sidecar } = await connectedSidecar();
    expect(ds.frameStampFeed(42)).toBeNull();

    sidecar.open();
    sidecar.setConnectionState("connected");

    expect(ds.frameStampFeed(42)).not.toBeNull();
  });

  it("asks the sidecar to send stamps when its hello offers them", async () => {
    const { sidecar } = await connectedSidecar();
    sidecar.open();
    sidecar.setConnectionState("connected");

    expect(sidecar.commands.some((c) => c.type === "set-frame-stamps")).toBe(
      true,
    );
  });

  it("delivers each stamp of a camera to its feed, in the units the delay reads", async () => {
    const { ds, sidecar } = await connectedSidecar();
    sidecar.open();
    sidecar.setConnectionState("connected");

    const seen: unknown[] = [];
    const stop = ds.frameStampFeed(42)?.subscribe((s) => seen.push(s));
    sidecar.fireFrameStamp({
      flightId: 42,
      rtpTimestamp: 9000,
      captureUt: 1234.5,
      captureEpoch: 3,
    });
    sidecar.fireFrameStamp({
      flightId: 43,
      rtpTimestamp: 9000,
      captureUt: 1,
      captureEpoch: 3,
    });

    expect(seen).toEqual([{ rtpTimestamp: 9000, ut: 1234.5, epoch: 3 }]);

    stop?.();
    sidecar.fireFrameStamp({
      flightId: 42,
      rtpTimestamp: 12000,
      captureUt: 1234.6,
      captureEpoch: 3,
    });
    expect(seen).toHaveLength(1);
  });
});
