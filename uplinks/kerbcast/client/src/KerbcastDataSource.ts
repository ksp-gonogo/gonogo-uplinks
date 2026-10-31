import {
  BrowserKerbcastTransport,
  CameraKind,
  type CameraState,
  type ClientMessage,
  type EncodedTransformPath,
  ErrorCode,
  KerbcastClient,
  type KerbcastConnectionState,
  type KerbcastDataChannel,
  type KerbcastPeer,
  type KerbcastPeerOptions,
  type KerbcastTransport,
} from "@ksp-gonogo/kerbcast";
import type {
  DataSourceStatus,
  EventOccurrence,
  StationBroker,
} from "@ksp-gonogo/sitrep-sdk";
import type { FrameStamp, FrameStampFeed } from "@ksp-gonogo/sitrep-sdk/media";
import {
  createPerfBudget,
  GAME_HOST_KEY,
  getGameHost,
  logger,
  registerStationBroker,
  registerUplinkHandle,
  subscribeSetting,
} from "@ksp-gonogo/sitrep-sdk";
import {
  type KerbcastEventKind,
  KerbcastEventProducer,
} from "./KerbcastEventProducer.js";

/**
 * gonogo `DataSource` wrapper around `KerbcastClient`. Surfaces the
 * sidecar connection in the Data Sources widget and re-exposes the
 * cached camera registry under the `kerbcast.cameras` data key.
 *
 * Video frames bind via {@link useKerbcastStream} (returns a
 * `MediaStream` directly: not a value channel) and the camera list
 * via {@link useKerbcastCameras}, both of which reach into the
 * underlying client via {@link getClient}.
 */

export interface KerbcastConfig extends Record<string, unknown> {
  port: number;
}

/**
 * Station-side broker. A station can't reach the sidecar's address, so instead
 * of the default localhost handshake the data source relays the WebRTC
 * offer→answer through the main screen. The answer is the sidecar's own for a
 * station on the main screen's network, whose media then flows to the sidecar
 * directly, and the relay endpoint's for a station that joined through it,
 * whose media the endpoint carries on to the sidecar. Built from the station's
 * broker, see {@link attachStationBroker}.
 */
export interface KerbcastBroker {
  /** Relay one offer to the sidecar via the host; resolve with the answer. */
  negotiate(offer: {
    sdp: string;
    cameras: number[];
    slots?: number;
  }): Promise<NegotiateAnswer>;
  /**
   * Relay a re-offer that adds video slots to the live connection named by
   * `session`; resolve with the answer. Without it the pool grows only by
   * reconnecting.
   */
  renegotiate?(offer: RenegotiateOffer): Promise<{ sdp: string }>;
}

/**
 * The sidecar's answer to an offer. `session` names the connection for a later
 * re-offer and is absent from a sidecar older than 1.12.
 */
export interface NegotiateAnswer {
  sdp: string;
  cameras: number[];
  session?: string;
}

/** A re-offer that grows the slot pool of the connection named by `session` to `slots`. */
export interface RenegotiateOffer {
  session: string;
  sdp: string;
  slots: number;
}

/** How long the main screen waits for the sidecar to answer a re-offer. */
const RENEGOTIATE_TIMEOUT_MS = 10_000;

const DEFAULT_CONFIG: KerbcastConfig = { port: 8088 };

const STORAGE_KEY = "gonogo.datasource.kerbcast";

const PING_WATCHDOG_MS = 15_000;
const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 30_000;

// The slot pool is the set of recv-only video transceivers offered to the
// sidecar on each connection. Each camera shown on screen (a camera tile, a
// crew bar avatar, the docking-camera augment) binds one free slot at runtime
// through subscribeCamera().
//
// An unbound slot is not free: every transceiver is offered as its own media
// line, which the sidecar answers and, for a station on another network, the
// relay's endpoint carries on both of its sides. So the pool is sized to the
// cameras mounted when the connection is made plus a little headroom, and
// when a camera is mounted that does not fit it the connection is made again
// with a larger one (see growPool). The sidecar has no pool cap of its own: it
// builds exactly as many transceivers as the offer asks for.
//
// A sidecar from 1.12 on adds slots to the live peer: the SDK re-offers when
// a subscribe finds every slot taken, and running feeds keep theirs. That
// needs the connection's `session` from the offer's answer and a re-offer
// path, which a station relays through the main screen like its offer. A
// station bridged through the relay's endpoint has neither, and an older
// sidecar offers no re-offer, so for them growing the pool is a reconnect:
// every feed drops and re-binds from the initial set, and cameras mounted
// together grow it once. MAX_SLOTS bounds both, and a camera past that waits
// for a slot another feed gives up.

/**
 * How long a camera's slot is kept after its last feed goes, in milliseconds,
 * so a feed mounted anew for the same camera takes the subscription over
 * instead of freeing it and binding it again.
 */
export const RELEASE_GRACE_MS = 500;

/** Slots negotiated when nothing, or little, is mounted. */
export const MIN_SLOTS = 4;

/** Slots kept free beyond the cameras mounted, so one more camera needs no reconnect. */
const SLOT_HEADROOM = 2;

/** The most slots ever negotiated. */
export const MAX_SLOTS = 32;

/** How long cameras mounted one after another are gathered before the pool grows. */
const POOL_GROWTH_DEBOUNCE_MS = 50;

/** The pool to negotiate for `mounted` cameras. */
export function slotPoolFor(mounted: number): number {
  return Math.min(MAX_SLOTS, Math.max(MIN_SLOTS, mounted + SLOT_HEADROOM));
}

/**
 * The wording of a refusal from a sidecar older than 1.10.0, which sent no
 * `code` and no `flightId`. Matched only when the code is absent.
 */
const NO_LIVE_CAMERA = /^no live camera with flight_id=(\d+)/;
const NO_FREE_SLOT = /^no free slot/;

/** Why the sidecar declined to bind a camera into a slot. */
export type KerbcastRefusal = ErrorCode;

/**
 * Who made a relayed call to this Uplink's handle on the main screen, as the
 * app passes it: the station, and on a station that joined through the relay's
 * endpoint, a bridge that carries the station's camera connection on to the
 * sidecar. Spelled here so the Uplink builds against an SDK that does not name
 * it yet.
 */
interface RelayCaller {
  station: string;
  bridgeMedia?(
    offer: string,
    upstream: (offer: string) => Promise<string>,
  ): Promise<string>;
}

const KERBCAST_CAMERAS_BUDGET = createPerfBudget({
  name: "KerbcastDataSource cameras updates/sec",
  threshold: 50,
  windowMs: 1000,
  unit: "updates",
});

function loadConfig(): KerbcastConfig {
  if (typeof localStorage === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<KerbcastConfig>;
    return {
      port: typeof parsed.port === "number" ? parsed.port : DEFAULT_CONFIG.port,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function persistConfig(cfg: KerbcastConfig): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* localStorage full / disabled: config still applies in-memory */
  }
}

/**
 * The browser WebRTC transport: Kerbcast's own `BrowserKerbcastTransport`,
 * which installs encoded transforms on its receivers, with two additions. A
 * peer whose connection fails is closed, since a failed peer never recovers and
 * keeps its relay allocations until it is closed, and the most recent peer can
 * be closed on demand through {@link releaseCurrentPeer}.
 */
export class BrowserRTCTransport implements KerbcastTransport {
  private readonly inner = new BrowserKerbcastTransport();
  /** The peer connection most recently created, for {@link releaseCurrentPeer}. */
  private current: KerbcastPeer | null = null;

  /**
   * Close the most recent peer connection. A peer that gathered candidates for
   * an offer that was then refused is otherwise held open, with its relay
   * allocations, until the next connect closes it.
   */
  releaseCurrentPeer(): void {
    this.current?.close();
    this.current = null;
  }

  encodedTransformPath(opts: KerbcastPeerOptions): EncodedTransformPath | null {
    return this.inner.encodedTransformPath(opts);
  }

  createPeer(iceServers: RTCIceServer[], opts?: KerbcastPeerOptions): KerbcastPeer {
    const peer = this.inner.createPeer(iceServers, opts);
    this.current = peer;
    let onStateChange: ((state: KerbcastConnectionState) => void) | null = null;
    peer.onStateChange((state) => {
      onStateChange?.(state);
      if (state === "failed") peer.close();
    });
    return {
      ...peer,
      onStateChange: (h) => {
        onStateChange = h;
      },
    };
  }
}

/**
 * Wraps any inner `KerbcastTransport` and intercepts ping messages on the data
 * channel, answering pong automatically. Non-ping messages pass through to the
 * SDK handler unchanged, after `onServerMessage` has seen them.
 *
 * Ping-and-pong belongs in `@ksp-gonogo/kerbcast` itself and lives here only
 * because the SDK exposes no reconnect-policy hook to hang it on.
 */
export class KeepaliveTransport implements KerbcastTransport {
  constructor(
    private readonly inner: KerbcastTransport,
    private readonly onPingReceived: (
      sendFn: (msg: ClientMessage) => void,
    ) => void,
    private readonly onServerMessage?: (msg: {
      type?: string;
      content?: unknown;
    }) => void,
  ) {}

  encodedTransformPath(opts: KerbcastPeerOptions): EncodedTransformPath | null {
    return this.inner.encodedTransformPath?.(opts) ?? null;
  }

  createPeer(
    iceServers: RTCIceServer[],
    opts?: KerbcastPeerOptions,
  ): KerbcastPeer {
    const peer = this.inner.createPeer(iceServers, opts);
    const wrapChannel = (ch: KerbcastDataChannel): KerbcastDataChannel => {
      let sdkHandler: ((raw: string) => void) | null = null;

      // Install our ping filter on the inner channel immediately so
      // the test's captured.onMessage points at this filter, not the SDK.
      ch.onMessage((raw: string) => {
        let msg: { type?: string; content?: unknown } | null = null;
        try {
          msg = JSON.parse(raw) as { type?: string; content?: unknown };
        } catch {
          sdkHandler?.(raw);
          return;
        }
        if (msg?.type === "ping") {
          this.onPingReceived((pongMsg) => {
            ch.send(JSON.stringify(pongMsg));
          });
          // Do NOT forward ping to SDK handler.
          return;
        }
        if (msg) this.onServerMessage?.(msg);
        sdkHandler?.(raw);
      });

      return {
        send: (s) => ch.send(s),
        onOpen: (h) => ch.onOpen(h),
        onMessage: (h) => {
          sdkHandler = h;
        },
        onClose: (h) => ch.onClose(h),
      };
    };

    return {
      addRecvOnlyTransceiver: () => peer.addRecvOnlyTransceiver(),
      createDataChannel: (label) => wrapChannel(peer.createDataChannel(label)),
      onTrack: (h) => peer.onTrack(h),
      onStateChange: (h) => peer.onStateChange(h),
      createOffer: async () => peer.createOffer(),
      setLocalDescription: async (sdp) => peer.setLocalDescription(sdp),
      setRemoteAnswer: async (sdp) => peer.setRemoteAnswer(sdp),
      waitForIceComplete: async () => peer.waitForIceComplete(),
      localSdp: () => peer.localSdp(),
      close: () => peer.close(),
      rollback: peer.rollback?.bind(peer),
      getStats: peer.getStats?.bind(peer),
      setReceiverTransform:
        peer.setReceiverTransform &&
        ((mid, transform) => peer.setReceiverTransform?.(mid, transform)),
      setReceiverTap: peer.setReceiverTap?.bind(peer),
    };
  }
}

// ---------------------------------------------------------------------------
// KerbcastDataSource
// ---------------------------------------------------------------------------

/** Whether the browser's last POST to the sidecar's `/offer` got any answer. */
export type SidecarReachability = "unknown" | "reachable" | "unreachable";

export class KerbcastDataSource {
  id = "kerbcast";
  name = "Kerbcast";
  status: DataSourceStatus = "disconnected";
  /**
   * Kerbcast streams are independent of CommNet, losing the in-game
   * antenna doesn't affect the WebRTC connection to the sidecar.
   * Camera widgets visualise signal loss via `set-degrade` instead.
   */
  affectedBySignalLoss = false;

  private cfg: KerbcastConfig;
  private baseTransport: KerbcastTransport | undefined;
  /** The `BrowserRTCTransport` `buildClient()` wired up, `undefined` when a test supplied another transport. */
  private rtcTransport: BrowserRTCTransport | undefined;
  private client: KerbcastClient;
  private clientUnsubs: Array<() => void> = [];
  /**
   * Monotonic id stamped on every `KerbcastClient` we build, so the
   * `kerbcast:clock` diagnostic can tell whether the instance that receives
   * `settings-state` (this data source's connected client) is the same one
   * `CameraFeed`'s provider holds and `useKerbcastClock` reads. A mismatch
   * means a reconnect rebuild orphaned the clock onto a dead instance.
   */
  private static clientInstanceSeq = 0;
  // Set on a station via attachBroker(); switches connect() off the sidecar's
  // /offer and onto the host-relayed handshake.
  private broker: KerbcastBroker | undefined;
  private statusListeners = new Set<(status: DataSourceStatus) => void>();
  private sidecarReachability: SidecarReachability = "unknown";
  private reachabilityListeners = new Set<() => void>();
  // flightId -> refcount of widgets currently displaying that camera. Drives
  // the dynamic slot subscription: 0->1 binds a slot, 1->0 frees it. Passed as
  // the initial set on (re)connect so a reconnect re-binds whatever's on screen
  // without a client-side round-trip (the sidecar pushes the SlotMaps on Hello).
  private desiredSubs = new Map<number, number>();

  /** Slots offered on the current connection. */
  private poolSlots = MIN_SLOTS;
  /** The current connection's name for a re-offer, from the offer's answer. */
  private session: string | null = null;
  /** Whether the connected sidecar's hello offered re-offers. */
  private renegotiateOffered = false;
  private poolGrowth: ReturnType<typeof setTimeout> | null = null;

  /**
   * `subscribe`s sent and not yet answered, in send order. The sidecar answers
   * each one in turn with a `slot-map` or an `error`, and its "no free slot"
   * error carries no flightId, so the oldest unanswered bind is the one it
   * refers to.
   */
  private awaitingSlot: number[] = [];

  /**
   * Cameras the sidecar declined to bind and why, until the camera binds,
   * is released, or the peer is lost. `camera-not-found` is not recorded
   * here: it means the camera is not registered yet, so it waits in
   * {@link notThereYet} instead of being reported as refused.
   */
  private refusals = new Map<number, KerbcastRefusal>();

  /** Cameras the sidecar said it does not have yet, subscribed again once they register. */
  private notThereYet = new Set<number>();

  /** The kind each camera in the list last reported, for ids that have since left it. */
  private lastKindSeen = new Map<number, CameraKind | undefined>();
  /** Whether the connected sidecar sends per-frame capture stamps (its hello offered them). */
  private frameStampsOffered = false;
  private readonly stampListeners = new Map<number, Set<(stamp: FrameStamp) => void>>();
  private readonly stampFeeds = new Map<number, FrameStampFeed>();

  private refusalListeners = new Set<() => void>();

  /**
   * Subscribed command cameras that have left the camera list. The sidecar
   * keeps their slot for a return under the same id, but the track in it does
   * not necessarily carry frames again, so a return is re-subscribed.
   */
  private departedCommand = new Set<number>();
  /**
   * Cameras whose last display reference has been released, and the timer that
   * frees their slot. A camera shown again before it fires keeps its slot and
   * its stream, which is what a feed does when it is mounted anew in the same
   * place, as the dashboard does when a tile moves.
   */
  private releasing = new Map<number, ReturnType<typeof setTimeout>>();
  /** Cameras whose slot is being bound again after a return, until the sidecar answers. */
  private reacquiring = new Set<number>();
  private reacquiringListeners = new Set<() => void>();

  private pingWatchdog: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private reconnectEnabled = false;
  private unsubGameHost: (() => void) | null = null;
  /**
   * Synthesises the reveal-gated `event` primitive from this uplink's discrete
   * edges (camera add/remove, adaptive-shed, scene/connection loss). Re-attached
   * to each rebuilt client in `buildClient`, detached in `teardownClient`.
   */
  private readonly eventProducer = new KerbcastEventProducer();

  constructor(config?: KerbcastConfig, transport?: KerbcastTransport) {
    this.cfg = config ?? loadConfig();
    this.baseTransport = transport;
    this.client = this.buildClient();
    this.unsubGameHost = subscribeSetting(GAME_HOST_KEY, () => {
      // Host moved, same effect as a reconfigure: rebuild the client against
      // the new host, preserving the connected/disconnected state.
      this.applyConfig({ ...this.cfg });
    });
  }

  /** Underlying client (hooks reach in directly via this). */
  getClient(): KerbcastClient {
    return this.client;
  }

  /**
   * Reveal-gated `event`-primitive occurrences synthesised from this uplink's
   * discrete edges, at the operator's (delayed) view UT `now`. Backs the alarm
   * host's `RevealedEventsReader` for the `KERBCAST_EVENTS_TOPIC` topic. Empty
   * when `now` is unknown (no stream mounted).
   */
  revealedEvents(
    now: number | null | undefined,
  ): readonly EventOccurrence<KerbcastEventKind>[] {
    return this.eventProducer.revealed(now);
  }

  /**
   * The capture stamps of camera `flightId`'s frames, as the sidecar sends them
   * on the control channel, or `null` when the connected sidecar does not send
   * stamps. The client asks for them itself when the sidecar offers them, so
   * listening here costs nothing extra. The same feed is returned for the same
   * camera for as long as the sidecar offers stamps.
   */
  frameStampFeed(flightId: number): FrameStampFeed | null {
    if (!this.frameStampsOffered) return null;
    let feed = this.stampFeeds.get(flightId);
    if (!feed) {
      feed = {
        subscribe: (listener) => {
          let listeners = this.stampListeners.get(flightId);
          if (!listeners) {
            listeners = new Set();
            this.stampListeners.set(flightId, listeners);
          }
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      };
      this.stampFeeds.set(flightId, feed);
    }
    return feed;
  }

  /**
   * Dev diagnostic: a JSON-serialisable snapshot of the stream-routing state,
   * for chasing black-feed / no-track issues. Reaches into the SDK client's
   * internals (private: read-only, best-effort).
   */
  debugDump(): unknown {
    const c = this.client as unknown as {
      dynamicMode?: boolean;
      cameras?: Array<{ flightId: number }>;
      trackByMid?: Map<string, MediaStreamTrack>;
      flightByMid?: Map<string, number>;
      handles?: Map<number, { mediaStream?: MediaStream | null }>;
      peer?: unknown;
    };
    const trackInfo = (t?: MediaStreamTrack | null) =>
      t
        ? { readyState: t.readyState, muted: t.muted, enabled: t.enabled }
        : null;
    return {
      status: this.status,
      reconnectEnabled: this.reconnectEnabled,
      brokered: !!this.broker,
      desiredSubs: [...this.desiredSubs.entries()],
      dynamicMode: c.dynamicMode ?? null,
      cameras: c.cameras?.map((cam) => cam.flightId) ?? null,
      slotTracks: c.trackByMid
        ? [...c.trackByMid.entries()].map(([mid, t]) => [mid, trackInfo(t)])
        : null,
      slotBindings: c.flightByMid ? [...c.flightByMid.entries()] : null,
      handles: c.handles
        ? [...c.handles.entries()].map(([fid, h]) => [
            fid,
            {
              hasStream: !!h.mediaStream,
              tracks: h.mediaStream?.getTracks().map(trackInfo) ?? [],
            },
          ])
        : null,
    };
  }

  // -- DataSource contract --

  async connect(): Promise<void> {
    this.reconnectEnabled = true;
    // The sidecar sends H.264 only, so an offer from a browser that cannot
    // decode it fails at the sidecar with an opaque 500.
    if (!browserCanPlayH264()) return;
    this.awaitingSlot = [];
    this.poolSlots = slotPoolFor(this.desiredSubs.size);
    try {
      await this.client.connect([...this.desiredSubs.keys()], {
        slots: this.poolSlots,
      });
    } catch (err) {
      this.scheduleReconnect();
      throw err;
    }
  }

  /**
   * Open the connection if nothing has yet, the lazy entry point for a mounted
   * camera widget that needs the camera list + slot pool *before* it can pick a
   * specific camera to display. Without this a brokered (station) source
   * deadlocks: the widget only subscribes once it has a flightId, but the
   * flightId comes from the camera list, which only arrives after connecting.
   * A no-op once connecting/connected; on the main screen the data-source
   * manager connects eagerly, so this just returns.
   */
  ensureConnected(): void {
    if (!this.reconnectEnabled) {
      void this.connect().catch(() => {});
    }
  }

  /**
   * Bind a camera to a slot for display (dynamic-mode subscription).
   * Refcounted: the first widget to show `flightId` sends `subscribe` to the
   * sidecar (allocating a slot and starting render/encode for that camera)
   * and the last one to stop showing it frees the slot. Called by
   * {@link useKerbcastStream} on mount/unmount.
   *
   * Safe to call while disconnected: the camera is recorded and bound via the
   * initial set on the next connect, so a widget that mounts before the sidecar
   * is up still gets its feed once the connection lands.
   *
   * On a brokered (station) source this also drives the **lazy connect**, the
   * source stays disconnected until the first camera widget asks for a stream,
   * so a station with no camera widget never opens a sidecar peer.
   */
  subscribeCamera(flightId: number): void {
    const pending = this.releasing.get(flightId);
    if (pending !== undefined) {
      /* The reference being released passes to this holder: the slot, the
         stream and the holder count are all left as they are. */
      clearTimeout(pending);
      this.releasing.delete(flightId);
      logger
        .tag("kerbcast:subscriptions")
        .debug("subscribe picked up a pending release", { flightId });
      return;
    }
    /* A different camera being shown is a switch, not a remount: the slots
       waiting to be freed go first, as they did when release was immediate, so
       the new bind never meets a pool the old camera still holds. */
    this.flushReleasing();
    const count = this.desiredSubs.get(flightId) ?? 0;
    this.desiredSubs.set(flightId, count + 1);
    logger
      .tag("kerbcast:subscriptions")
      .debug("subscribe", { flightId, holders: count + 1, status: this.status });
    if (this.status === "connected") {
      if (count === 0) {
        if (
          !this.canGrowLive() &&
          this.desiredSubs.size > this.poolSlots &&
          this.poolSlots < MAX_SLOTS
        ) {
          this.growPool();
        } else {
          this.requestSlot(flightId);
        }
      }
      return;
    }
    // Not connected. A brokered station source isn't eager-connected anywhere,
    // so the first widget that wants a stream triggers the connect; the camera
    // binds via the initial set (desiredSubs). The main screen connects all
    // sources up front (no broker set), so this stays a no-op there.
    if (this.broker && !this.reconnectEnabled) {
      void this.connect().catch(() => {});
    }
  }

  /** Release a display reference taken by {@link subscribeCamera}. */
  unsubscribeCamera(flightId: number): void {
    const count = this.desiredSubs.get(flightId) ?? 0;
    if (count === 0) return;
    logger
      .tag("kerbcast:subscriptions")
      .debug("unsubscribe", { flightId, holders: count - 1, status: this.status });
    if (count > 1) {
      this.desiredSubs.set(flightId, count - 1);
      return;
    }
    if (this.releasing.has(flightId)) return;
    this.releasing.set(
      flightId,
      setTimeout(() => {
        this.releasing.delete(flightId);
        this.releaseSlot(flightId);
      }, RELEASE_GRACE_MS),
    );
  }

  private flushReleasing(): void {
    for (const [flightId, timer] of [...this.releasing]) {
      clearTimeout(timer);
      this.releasing.delete(flightId);
      this.releaseSlot(flightId);
    }
  }

  private releaseSlot(flightId: number): void {
    this.desiredSubs.delete(flightId);
    this.departedCommand.delete(flightId);
    this.setReacquiring(flightId, false);
    this.notThereYet.delete(flightId);
    this.dropAwaiting(flightId);
    this.setRefusal(flightId, undefined);
    if (this.status === "connected") {
      void this.client.unsubscribe(flightId).catch(() => {
        /* already tearing down */
      });
    }
  }

  /**
   * Main-screen half of the station broker: forward a station's WebRTC offer to
   * the sidecar's HTTP `/offer` (only the main screen can reach the sidecar's
   * address) and return the answer. Signaling only, the answer's ICE
   * candidates let the station's PeerConnection reach the sidecar directly for
   * media, so video frames never cross PeerJS. Mirrors the SDK's internal
   * `httpNegotiate`; kept here (not on the client) because the host relays on
   * behalf of a remote peer, independent of its own connection.
   */
  async relayOffer(offer: {
    sdp: string;
    cameras: number[];
    slots?: number;
  }): Promise<NegotiateAnswer> {
    let res: Response;
    try {
      res = await fetch(`http://${getGameHost()}:${this.cfg.port}/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(offer),
      });
    } catch (err) {
      this.setSidecarReachability("unreachable");
      throw err;
    }
    this.setSidecarReachability("reachable");
    if (!res.ok) {
      throw new Error(`kerbcast /offer returned ${res.status}`);
    }
    return (await res.json()) as NegotiateAnswer;
  }

  /**
   * Main-screen half of a re-offer: forward it to the sidecar's HTTP
   * `/renegotiate`, for this screen's own connection or a station's. A refusal
   * keeps the sidecar's status in the error's message.
   */
  async relayRenegotiate(offer: RenegotiateOffer): Promise<{ sdp: string }> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), RENEGOTIATE_TIMEOUT_MS);
    try {
      const res = await fetch(
        `http://${getGameHost()}:${this.cfg.port}/renegotiate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(offer),
          signal: abort.signal,
        },
      );
      if (!res.ok) {
        throw new Error(`kerbcast /renegotiate returned ${res.status}`);
      }
      return (await res.json()) as { sdp: string };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Whether the sidecar answered the last `/offer` this screen posted. Stays
   * `"unknown"` until the first attempt, and on a station, whose offers go
   * through the main screen.
   */
  getSidecarReachability(): SidecarReachability {
    return this.sidecarReachability;
  }

  /** Subscribe to changes of {@link getSidecarReachability}; returns the unsubscribe. */
  onSidecarReachabilityChange(cb: () => void): () => void {
    this.reachabilityListeners.add(cb);
    return () => this.reachabilityListeners.delete(cb);
  }

  /**
   * The sentence naming an unreachable sidecar, or null while it is not. An
   * unreachable sidecar on a remote KSP machine is almost always a bind
   * address left at its loopback default.
   */
  readinessNote(): string | null {
    if (!browserCanPlayH264()) return NO_H264_MESSAGE;
    return this.sidecarReachability === "unreachable"
      ? sidecarUnreachableMessage(getGameHost(), this.cfg.port)
      : null;
  }

  /** Subscribe to changes of {@link readinessNote}; returns the unsubscribe. */
  onReadinessNoteChange(cb: () => void): () => void {
    return this.onSidecarReachabilityChange(cb);
  }

  private setSidecarReachability(next: SidecarReachability): void {
    const prev = this.sidecarReachability;
    if (prev === next) return;
    this.sidecarReachability = next;
    if (next === "unreachable") {
      logger.warn(sidecarUnreachableMessage(getGameHost(), this.cfg.port));
    } else if (prev === "unreachable") {
      logger.info("kerbcast sidecar reachable again");
    }
    for (const cb of this.reachabilityListeners) cb();
  }

  /**
   * Host-side dispatch entry point for station peer-relayed calls (see
   * PeerHostService.handleUplinkRelay / PeerClientDataSource.relay). The
   * methods are `negotiate` and `renegotiate`. A station that joined through
   * the relay's endpoint cannot reach the sidecar, so its offer is bridged: the
   * endpoint's own offer goes to the sidecar, and the station is answered by
   * the endpoint without a `session`, so it never re-offers. Any other
   * station's offer and re-offer go to the sidecar as they are.
   */
  async relay(
    method: string,
    args: unknown,
    caller?: RelayCaller,
  ): Promise<unknown> {
    if (method === "renegotiate") {
      if (caller?.bridgeMedia) {
        throw new Error("kerbcast relay handle: a bridged station cannot re-offer");
      }
      return this.relayRenegotiate(args as RenegotiateOffer);
    }
    if (method !== "negotiate") {
      throw new Error(`kerbcast relay handle: unknown method "${method}"`);
    }
    const offer = args as { sdp: string; cameras: number[]; slots?: number };
    if (!caller?.bridgeMedia) return this.relayOffer(offer);
    let cameras: number[] = [];
    const sdp = await caller.bridgeMedia(offer.sdp, async (upstream) => {
      const answer = await this.relayOffer({ ...offer, sdp: upstream });
      cameras = answer.cameras;
      return answer.sdp;
    });
    return { sdp, cameras };
  }

  /**
   * Switch this source into station/brokered mode: route the WebRTC handshake
   * through the host (no sidecar address needed). Called on
   * a station through {@link attachStationBroker}. Rebuilds the
   * client so the camera hooks rebind to the brokered instance; if a connection
   * was already live it reconnects through the broker.
   *
   * (Named `attachBroker`, not `useBroker`, to avoid the React-hook naming
   * heuristic: it's a plain method, safe to call outside render.)
   */
  attachBroker(broker: KerbcastBroker): void {
    this.broker = broker;
    const wasEnabled = this.reconnectEnabled;
    this.teardownClient();
    this.client = this.buildClient();
    // Connect through the broker if a connection was already live, OR if a
    // camera widget already wants a stream: it may have mounted and subscribed
    // before this ran (React runs child effects before the parent's). Swallow
    // the initial rejection (the reconnect loop retries); without this an
    // immediate WebRTC failure would surface as an unhandled rejection.
    if (wasEnabled || this.desiredSubs.size > 0) {
      void this.connect().catch(() => {});
    }
  }

  disconnect(): void {
    this.reconnectEnabled = false;
    this.flushReleasing();
    this.clearTimers();
    this.client.disconnect();
    this.forgetSlotState();
    this.unsubGameHost?.();
  }

  onStatusChange(cb: (status: DataSourceStatus) => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  getConfig(): KerbcastConfig {
    return { ...this.cfg };
  }

  configure(config: Partial<KerbcastConfig>): void {
    const next: KerbcastConfig = {
      port: typeof config.port === "number" ? config.port : this.cfg.port,
    };
    persistConfig(next);
    this.applyConfig(next);
  }

  private applyConfig(next: KerbcastConfig): void {
    const wasEnabled = this.reconnectEnabled;
    this.cfg = next;
    this.reconnectEnabled = false;
    this.teardownClient();
    this.client = this.buildClient();
    if (wasEnabled) void this.connect().catch(() => {});
  }

  // -- private --

  private buildClient(): KerbcastClient {
    // Same transport instance for main-screen AND station/broker mode,
    // only `negotiate` below differs by mode; the RTCPeerConnection/ontrack
    // wiring (and therefore the receiver registry) is identical either way.
    const innerTransport = this.baseTransport ?? new BrowserRTCTransport();
    this.rtcTransport =
      innerTransport instanceof BrowserRTCTransport
        ? innerTransport
        : undefined;
    const keepaliveTransport = new KeepaliveTransport(
      innerTransport,
      (sendFn) => {
        sendFn({ type: "pong" });
        this.startWatchdog();
      },
      (msg) => this.observeSlotMessage(msg),
    );

    // Capture the broker locally so the negotiate closure is stable across a
    // later rebuild and doesn't re-read `this.broker` after a teardown.
    const broker = this.broker;
    const rtcTransport = this.rtcTransport;
    const renegotiate: ((offer: RenegotiateOffer) => Promise<{ sdp: string }>) | undefined =
      broker
        ? broker.renegotiate?.bind(broker)
        : (offer) => this.relayRenegotiate(offer);
    const client = new KerbcastClient(
      {
        host: getGameHost(),
        port: this.cfg.port,
        // Lets a camera's video delay be installed on its receiver, ahead of
        // decode and the static canvas (`useEncodedDelayTarget`). Fixed for a
        // peer's life, so it is on from the start.
        encodedTransforms: true,
        // Brokered (station) mode routes the offer→answer through the host;
        // main mode POSTs the sidecar's /offer, the same request the SDK's
        // built-in negotiation makes. Both are taken over here because the
        // answer's `cameras` is the only place the sidecar reports which of the
        // initial cameras it bound, and the SDK drops it in dynamic mode.
        negotiate: async (offer) => {
          try {
            const answer = broker
              ? await broker.negotiate(offer)
              : await this.relayOffer(offer);
            this.session = answer.session ?? null;
            return answer;
          } catch (err) {
            rtcTransport?.releaseCurrentPeer();
            throw err;
          }
        },
        renegotiate: renegotiate && ((offer) => renegotiate(offer)),
      },
      keepaliveTransport,
    );
    const instanceId = ++KerbcastDataSource.clientInstanceSeq;
    (client as unknown as { __kcInstanceId?: number }).__kcInstanceId =
      instanceId;
    logger.tag("kerbcast:clock").debug("built KerbcastClient", { instanceId });
    const reportDisplaySize = client.reportDisplaySize.bind(client);
    client.reportDisplaySize = (flightId, width, height) => {
      logger
        .tag("kerbcast:subscriptions")
        .debug("report-display-size", { flightId, width, height });
      return reportDisplaySize(flightId, width, height);
    };
    this.clientUnsubs.push(
      client.on("state-change", (s) => {
        // The slot pool belongs to the peer, so a lost peer takes every
        // binding with it; the next answer restates them.
        if (s === "disconnected" || s === "failed") this.forgetSlotState(false);
        const status = mapStatus(s);
        this.setStatus(status);
        if (s === "connected") {
          this.retryNotThereYet();
          this.reconnectAttempts = 0;
          if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          this.startWatchdog();
        } else if (s === "failed" && this.reconnectEnabled) {
          this.scheduleReconnect();
        }
      }),
      client.on("cameras-change", () => {
        KERBCAST_CAMERAS_BUDGET.record();
        this.releaseDepartedCameras();
        this.reacquireReturnedCameras();
        this.retryNotThereYet();
      }),
    );
    // Synthesise `event`-primitive occurrences from this client's discrete
    // edges. Its own listeners live/die with the client instance (detached in
    // teardownClient), so a rebuild re-attaches cleanly onto the new client.
    this.eventProducer.attach(client);
    return client;
  }

  private teardownClient(): void {
    this.clearTimers();
    this.eventProducer.detach();
    this.client.disconnect();
    this.clientUnsubs.forEach((off) => {
      off();
    });
    this.clientUnsubs = [];
  }

  /**
   * Make the connection again with a pool sized to the cameras now mounted,
   * once cameras mounted together have been gathered. The camera that did not
   * fit is bound by the new connection's initial set, never by a subscribe the
   * sidecar would refuse.
   */
  private growPool(): void {
    if (this.poolGrowth !== null) return;
    this.poolGrowth = setTimeout(() => {
      this.poolGrowth = null;
      if (!this.reconnectEnabled || this.status !== "connected") return;
      if (this.desiredSubs.size <= this.poolSlots) return;
      void this.attemptReconnect();
    }, POOL_GROWTH_DEBOUNCE_MS);
  }

  /** Ask the connected sidecar to bind `flightId` into a free slot. */
  private requestSlot(flightId: number): void {
    // Queued before the send because the answer can arrive before the send's
    // promise settles.
    this.awaitingSlot.push(flightId);
    void this.client.subscribe(flightId).catch(() => {
      // Channel raced closed, so no answer is coming. Re-bound on the next
      // connect via the initial set.
      this.dropAwaiting(flightId);
    });
  }

  /** Why the sidecar declined to bind `flightId`, or undefined when it has not. */
  refusalFor(flightId: number): KerbcastRefusal | undefined {
    return this.refusals.get(flightId);
  }

  /** Called whenever a camera is refused or stops being refused. */
  onRefusalsChange(cb: () => void): () => void {
    this.refusalListeners.add(cb);
    return () => this.refusalListeners.delete(cb);
  }

  private setRefusal(flightId: number, reason: KerbcastRefusal | undefined): void {
    if (this.refusals.get(flightId) === reason) return;
    if (reason === undefined) this.refusals.delete(flightId);
    else this.refusals.set(flightId, reason);
    this.refusalListeners.forEach((cb) => {
      cb();
    });
  }

  /**
   * Subscribe again to every camera that was reported missing and has since
   * registered. Runs on each camera-list change, so a camera named at connect
   * before KSP had it is bound the moment it appears.
   */
  private retryNotThereYet(): void {
    if (this.status !== "connected" || this.notThereYet.size === 0) return;
    const registered = new Set(this.client.cameras.map((c) => c.flightId));
    for (const flightId of [...this.notThereYet]) {
      if (!registered.has(flightId)) continue;
      this.notThereYet.delete(flightId);
      if (this.desiredSubs.has(flightId)) this.requestSlot(flightId);
    }
  }

  /**
   * Free the slot of every subscribed camera that has left the camera list.
   * The sidecar keeps a slot for a subscribed id so a camera returning under
   * the same id can rebind, which only command cameras do; a part camera comes
   * back under a new id after a relaunch, so its old slot would stay taken and
   * a later relaunch would find none free. An id never seen in the list is
   * left alone: it is a camera named before KSP had it.
   */
  private releaseDepartedCameras(): void {
    const present = new Set<number>();
    for (const camera of this.client.cameras) {
      present.add(camera.flightId);
      this.lastKindSeen.set(camera.flightId, camera.kind);
    }
    for (const [flightId, kind] of [...this.lastKindSeen]) {
      if (present.has(flightId)) continue;
      this.lastKindSeen.delete(flightId);
      if (!this.desiredSubs.has(flightId)) continue;
      if (kind === CameraKind.Command) {
        this.departedCommand.add(flightId);
        continue;
      }
      logger
        .tag("kerbcast:subscriptions")
        .debug("release departed", { flightId, status: this.status });
      this.desiredSubs.delete(flightId);
      this.notThereYet.delete(flightId);
      this.dropAwaiting(flightId);
      this.setRefusal(flightId, undefined);
      if (this.status === "connected") {
        void this.client.unsubscribe(flightId).catch(() => {
          /* already tearing down */
        });
      }
    }
  }

  /**
   * Bind again every subscribed command camera that was off the camera list
   * and is back on it. The slot is released and requested afresh, so the
   * camera gets a new track rather than the one that stopped carrying frames
   * when the scene it was in ended.
   */
  private reacquireReturnedCameras(): void {
    if (this.departedCommand.size === 0) return;
    const present = new Set(this.client.cameras.map((c) => c.flightId));
    for (const flightId of [...this.departedCommand]) {
      if (!this.desiredSubs.has(flightId)) {
        this.departedCommand.delete(flightId);
        continue;
      }
      if (!present.has(flightId)) continue;
      this.departedCommand.delete(flightId);
      if (this.status !== "connected") continue;
      logger
        .tag("kerbcast:subscriptions")
        .info("re-acquire returned camera", { flightId });
      this.setReacquiring(flightId, true);
      void this.client
        .unsubscribe(flightId)
        .catch(() => {
          /* already tearing down */
        })
        .then(() => {
          if (this.desiredSubs.has(flightId) && this.status === "connected") {
            this.requestSlot(flightId);
          } else {
            this.setReacquiring(flightId, false);
          }
        });
    }
  }

  /** Whether `flightId` is being bound again after returning to the camera list. */
  isReacquiring(flightId: number): boolean {
    return this.reacquiring.has(flightId);
  }

  /** Called whenever a camera starts or finishes being bound again. */
  onReacquiringChange(cb: () => void): () => void {
    this.reacquiringListeners.add(cb);
    return () => this.reacquiringListeners.delete(cb);
  }

  private setReacquiring(flightId: number, on: boolean): void {
    if (this.reacquiring.has(flightId) === on) return;
    if (on) this.reacquiring.add(flightId);
    else this.reacquiring.delete(flightId);
    this.reacquiringListeners.forEach((cb) => {
      cb();
    });
  }

  private dropAwaiting(flightId: number): void {
    const at = this.awaitingSlot.indexOf(flightId);
    if (at !== -1) this.awaitingSlot.splice(at, 1);
  }

  /**
   * Follow the sidecar's answers to `subscribe`. The SDK surfaces neither a
   * `slot-map` nor which camera an `error` was about, so both are read off the
   * control channel here, in wire order, ahead of the SDK.
   */
  private observeSlotMessage(msg: { type?: string; content?: unknown }): void {
    if (msg.type === "frame-stamp") {
      const stamp = msg.content as {
        flightId: number;
        rtpTimestamp: number;
        captureUt: number;
        captureEpoch: number;
      };
      for (const listener of this.stampListeners.get(stamp.flightId) ?? []) {
        listener({
          rtpTimestamp: stamp.rtpTimestamp,
          ut: stamp.captureUt,
          epoch: stamp.captureEpoch,
        });
      }
      return;
    }
    if (msg.type === "hello") {
      const hello = msg.content as
        | { frameStamps?: boolean; renegotiate?: boolean }
        | undefined;
      this.frameStampsOffered = hello?.frameStamps === true;
      this.renegotiateOffered = hello?.renegotiate === true;
      return;
    }
    if (msg.type === "slot-map") {
      const { flightId } = (msg.content ?? {}) as { flightId?: number | null };
      if (flightId != null) {
        this.dropAwaiting(flightId);
        this.notThereYet.delete(flightId);
        this.setRefusal(flightId, undefined);
        this.setReacquiring(flightId, false);
      }
      return;
    }
    if (msg.type !== "error") return;
    const refusal = this.readRefusal(
      (msg.content ?? {}) as { message?: unknown; flightId?: unknown; code?: unknown },
    );
    if (!refusal) return;
    this.dropAwaiting(refusal.flightId);
    if (refusal.reason === ErrorCode.CameraNotFound) {
      this.notThereYet.add(refusal.flightId);
      // The camera may already be registered by the time the refusal is read.
      this.retryNotThereYet();
    } else {
      this.setRefusal(refusal.flightId, refusal.reason);
    }
  }

  /**
   * Which camera a refusal is about and why. A sidecar from 1.10.0 states both
   * as `flightId` and `code`. Older ones state neither, so the wording says why,
   * and the camera is the one named in the wording or, for a missing slot, the
   * oldest bind still unanswered because the sidecar answers in send order.
   */
  private readRefusal(content: {
    message?: unknown;
    flightId?: unknown;
    code?: unknown;
  }): { flightId: number; reason: KerbcastRefusal } | undefined {
    const coded = Object.values(ErrorCode).find((c) => c === content.code);
    if (coded && typeof content.flightId === "number") {
      return { flightId: content.flightId, reason: coded };
    }
    const message = typeof content.message === "string" ? content.message : "";
    const missing = NO_LIVE_CAMERA.exec(message);
    if (missing) {
      return { flightId: Number(missing[1]), reason: ErrorCode.CameraNotFound };
    }
    const oldest = this.awaitingSlot[0];
    if ((coded === ErrorCode.NoFreeSlot || NO_FREE_SLOT.test(message)) && oldest !== undefined) {
      return { flightId: oldest, reason: ErrorCode.NoFreeSlot };
    }
    return undefined;
  }

  /**
   * Whether the SDK can add slots to the live connection, so a camera that
   * does not fit is subscribed and the pool grows under it instead of the
   * connection being made again.
   */
  private canGrowLive(): boolean {
    return (
      this.renegotiateOffered &&
      this.session !== null &&
      (!this.broker || this.broker.renegotiate !== undefined)
    );
  }

  /*
   * `sessionEnded` is false for a connection that dropped and may recover on
   * the same sidecar session: the sidecar sends its hello once, when the
   * control channel opens, so what it offered (frame stamps, renegotiation)
   * and the stamp feeds delayed pipelines already hold stay valid, and
   * forgetting them would leave a recovered connection without stamps for the
   * rest of the session. A new connection reads its own hello.
   */
  private forgetSlotState(sessionEnded = true): void {
    if (sessionEnded) {
      this.frameStampsOffered = false;
      this.renegotiateOffered = false;
      this.stampFeeds.clear();
    }
    this.session = null;
    this.awaitingSlot = [];
    this.notThereYet.clear();
    this.departedCommand.clear();
    for (const flightId of [...this.reacquiring]) this.setReacquiring(flightId, false);
    if (this.refusals.size > 0) {
      this.refusals.clear();
      this.refusalListeners.forEach((cb) => {
        cb();
      });
    }
  }

  private setStatus(status: DataSourceStatus): void {
    this.status = status;
    this.statusListeners.forEach((cb) => {
      cb(status);
    });
  }

  private clearTimers(): void {
    if (this.poolGrowth !== null) {
      clearTimeout(this.poolGrowth);
      this.poolGrowth = null;
    }
    if (this.pingWatchdog !== null) {
      clearTimeout(this.pingWatchdog);
      this.pingWatchdog = null;
    }
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startWatchdog(): void {
    if (this.pingWatchdog !== null) {
      clearTimeout(this.pingWatchdog);
      this.pingWatchdog = null;
    }
    this.pingWatchdog = setTimeout(() => {
      this.pingWatchdog = null;
      if (this.reconnectEnabled) {
        void this.attemptReconnect();
      }
    }, PING_WATCHDOG_MS);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempts,
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.reconnectEnabled) {
        void this.attemptReconnect();
      }
    }, delay);
  }

  private async attemptReconnect(): Promise<void> {
    this.awaitingSlot = [];
    this.poolSlots = slotPoolFor(this.desiredSubs.size);
    try {
      await this.client.connect([...this.desiredSubs.keys()], {
        slots: this.poolSlots,
      });
    } catch {
      this.scheduleReconnect();
    }
  }
}

/** The operator-facing sentence for a browser with no H.264 decoder. */
export const NO_H264_MESSAGE =
  "This browser cannot play the camera video: it has no H.264 decoder. " +
  "Use a browser with H.264 support (in Firefox, enable OpenH264).";

/**
 * Whether this browser can receive H.264 video. True when the browser cannot
 * be asked, so a missing capability query never blocks a working browser.
 */
export function browserCanPlayH264(): boolean {
  const codecs =
    typeof RTCRtpReceiver !== "undefined" &&
    typeof RTCRtpReceiver.getCapabilities === "function"
      ? RTCRtpReceiver.getCapabilities("video")?.codecs
      : undefined;
  if (!codecs) return true;
  return codecs.some((c) => c.mimeType.toLowerCase() === "video/h264");
}

/** The operator-facing sentence for a sidecar the browser cannot reach. */
export function sidecarUnreachableMessage(host: string, port: number): string {
  return (
    `The kerbcast sidecar at ${host}:${port} is unreachable. If KSP runs on ` +
    "another machine, kerbcast's BindAddress must allow this machine."
  );
}

function mapStatus(s: KerbcastConnectionState): DataSourceStatus {
  switch (s) {
    case "connected":
      return "connected";
    case "connecting":
      return "reconnecting";
    case "disconnected":
      return "disconnected";
    case "failed":
      return "error";
  }
}

export const kerbcastSource = new KerbcastDataSource();

// Registers the FULL instance (not a narrower object) so both the host-side
// relay dispatch (PeerHostService.handleUplinkRelay, via .relay()) and every
// client-access call site (CameraFeed, useKerbcastStream, useKerbcastCameras,
// DockingCameraAugment, SettingsModal) can resolve the same handle through this
// ONE registry instead of two.
registerUplinkHandle("kerbcast", kerbcastSource);

/**
 * Switch `source` into station mode off the broker a station hands this Uplink:
 * the offer relays to the main screen's own kerbcast handle, whose `relay`
 * answers `negotiate`.
 */
export function attachStationBroker(
  source: KerbcastDataSource,
  broker: StationBroker,
): void {
  source.attachBroker({
    negotiate: (offer) =>
      broker.relay("negotiate", offer) as Promise<NegotiateAnswer>,
    renegotiate: (offer) =>
      broker.relay("renegotiate", offer) as Promise<{ sdp: string }>,
  });
}

registerStationBroker("kerbcast", (broker) =>
  attachStationBroker(kerbcastSource, broker),
);

// Dev-only debug handle: inspect the live stream-routing state from the console
// (or via automation) to diagnose black-feed / no-track issues.
//   __kerbcast.debugDump()  →  status, desiredSubs, slot routing, per-camera tracks
if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
  (globalThis as unknown as { __kerbcast?: KerbcastDataSource }).__kerbcast =
    kerbcastSource;
}

export type { CameraState };
