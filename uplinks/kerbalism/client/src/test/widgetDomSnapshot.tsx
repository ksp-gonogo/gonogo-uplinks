/**
 * The DOM-snapshot support this package's widgets need: the volatile-attribute
 * strip, a ResizeObserver that reports a real box, and the `_stream`-block
 * replay a fixture's declared wire is fed through.
 *
 * All of it came out of `@ksp-gonogo/components`'s `src/test/
 * widgetDomSnapshot.tsx` with the SpaceWeather move, minus everything that
 * serves the legacy `MockDataSource` fixtures this package has none of.
 */
import {
  act,
  type StreamFixture,
  type StreamFixtureOptions,
  stopArriving,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { installFixedSizeResizeObserver } from "@ksp-gonogo/ui-kit/testing";

/**
 * A fixture's own declaration of what it puts on the wire, and the only
 * authority for what a scene shows. The same `_stream` block the render
 * harness reads (`@ksp-gonogo/ui-kit`'s `render/scenes.ts`), so one fixture
 * drives both the PNG scene and the DOM snapshot rather than two formats
 * drifting apart.
 */
export interface StreamFixtureBlock {
  /**
   * UT to pin the view clock at. Under `delaySeconds` the clock is left live
   * and this is instead the instant an emit naming no `validAt` was sent.
   */
  pinnedUt?: number;
  /**
   * A one-way light time in seconds: each emit is delivered this long after
   * its `validAt`, the view time is the received edge and the craft's present
   * runs one light time ahead of it. Zero is the same as absent.
   */
  delaySeconds?: number;
  /** Stage the link dropping once the emits have landed: see `stopArriving`. */
  stopsArriving?: boolean;
  /**
   * Replayed one `StubTransport.emit` per entry, post-mount, in the order
   * written, or in the order sent under `delaySeconds`. An entry naming a
   * `validAt` is stamped with it, which is how a scene carries a history for a
   * model to fit; one naming none keeps the stub's default when undelayed.
   */
  emits: Array<{ topic: string; payload: unknown; validAt?: number }>;
}

/** The render harness's own default for a scene naming no `pinnedUt`, so one fixture draws the same instant in both. */
const DEFAULT_PINNED_UT = 1_000_000;

/** A block's light time, or `undefined` when it has none. */
function lightTime(block: StreamFixtureBlock): number | undefined {
  const delay = block.delaySeconds;
  return delay === undefined || delay === 0 ? undefined : delay;
}

/**
 * The clock half of `setupStreamFixture`'s options for a block: pinned at
 * `pinnedUt` when undelayed, live under a light time, because a pinned clock
 * wins outright over the delay and would turn it into a no-op.
 */
export function streamClockOptions(
  block: StreamFixtureBlock,
): Pick<StreamFixtureOptions, "pinnedUt" | "delaySeconds"> {
  const delaySeconds = lightTime(block);
  return delaySeconds === undefined
    ? { pinnedUt: block.pinnedUt }
    : { delaySeconds };
}

/** Extracts and narrows the `_stream` block off a fixture. */
export function resolveStreamBlock(
  fixture: Record<string, unknown>,
): StreamFixtureBlock | undefined {
  const raw = fixture._stream;
  if (typeof raw !== "object" || raw === null) return undefined;
  return Array.isArray(Reflect.get(raw, "emits"))
    ? (raw as StreamFixtureBlock)
    : undefined;
}

/**
 * `StubTransport.emit` silently DROPS a sample for a topic nothing has
 * subscribed to yet, and a widget subscribes inside React *passive* effects
 * that no single flush is guaranteed to have run. Poll until the subscription
 * lands so the replay is deterministic instead of a race the fixture loses on
 * some runs. A topic the widget never reads simply times out, and is then
 * emitted-and-dropped.
 */
async function waitForSubscription(
  transport: { isSubscribed(topic: string): boolean },
  topic: string,
  maxFrames = 30,
): Promise<void> {
  for (let i = 0; i < maxFrames; i++) {
    if (transport.isSubscribed(topic)) return;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
}

/**
 * Replay a fixture's declared emits, each after its topic is subscribed. The
 * stream must have been built with {@link streamClockOptions} for the same
 * block, or a light time is staged against a pinned clock and shows nothing.
 */
export async function replayStreamBlock(
  stream: StreamFixture,
  block: StreamFixtureBlock,
): Promise<void> {
  const delay = lightTime(block);
  const sentAt = (e: StreamFixtureBlock["emits"][number]): number =>
    e.validAt ?? block.pinnedUt ?? DEFAULT_PINNED_UT;
  // A link delivers in the order it sent, and a delayed clock re-anchors on each delivery.
  const emits =
    delay === undefined
      ? block.emits
      : [...block.emits].sort((a, b) => sentAt(a) - sentAt(b));
  await act(async () => {
    for (const e of emits) {
      await waitForSubscription(stream.transport, e.topic);
      stream.emit(e.topic, e.payload, emitMeta(e, delay, sentAt(e)));
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }
    if (block.stopsArriving === true) stopArriving(stream);
  });
}

function emitMeta(
  e: StreamFixtureBlock["emits"][number],
  delay: number | undefined,
  sentAt: number,
): { validAt: number; deliveredAt: number } | undefined {
  if (delay !== undefined) {
    return { validAt: sentAt, deliveredAt: sentAt + delay };
  }
  if (e.validAt === undefined) return undefined;
  return { validAt: e.validAt, deliveredAt: e.validAt };
}

/**
 * Grid-unit to pixel conversion, the same arithmetic the components package's
 * render harness sizes its iframe with, so a mode means the same shape in both.
 */
const COL_WIDTH = 32;
const ROW_HEIGHT = 25;
const GRID_MARGIN = 8;

export function modePixels(mode: { w: number; h: number }): {
  w: number;
  h: number;
} {
  return {
    w: mode.w * COL_WIDTH + (mode.w - 1) * GRID_MARGIN,
    h: mode.h * ROW_HEIGHT + (mode.h - 1) * GRID_MARGIN,
  };
}

/**
 * Install a `ResizeObserver` that actually reports a size, for the length of
 * one render, and return the restore.
 *
 * The shared jsdom shim is a no-op in all three methods: it exists to stop a
 * mount crashing and never calls its callback, so any widget gating content on
 * a measured box renders that content NEVER under a snapshot harness. The
 * reported box is the mode's own pixel size rather than a constant, so the
 * modes stay distinguishable and a size-gated branch is exercised at the size
 * it is gated on.
 */
export function installSizedResizeObserver(size: {
  w: number;
  h: number;
}): () => void {
  // Asynchronous, like the real one: a synchronous callback would run inside
  // the observing effect and set state during render.
  return installFixedSizeResizeObserver({
    width: size.w,
    height: size.h,
    deliver: "macrotask",
  });
}

/**
 * Let the sized-observer callbacks above land and the resulting re-render
 * commit. Two macrotask turns: the first drains the `setTimeout(0)` queue, the
 * second covers an observer a re-render only then attached.
 */
export async function flushResizeObservers(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

/**
 * Flush two rAF ticks so the provider's ingest -> beginFrame() applies the
 * emitted values to React state before the DOM is read. `useViewUt`'s scrubbed
 * value only lands via `ViewClock.onFrame`'s rAF loop, and the provider's own
 * ingest is scheduled the same way, so a plain `render()` + `act()` can commit
 * before either has reached React state.
 */
export async function flushProviderFrame(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

/**
 * Strip styled-components hashes, testing-library auto-ids, and any `sc-*`
 * class or id attribute that changes per build. Without this the snapshot
 * churns on every styled-components release and file edit.
 */
export function stripVolatile(html: string): string {
  return html
    .replace(/\sclass="[^"]*\bsc-[^"]*"/g, "")
    .replace(/\sid="[^"]*\bsc-[^"]*"/g, "")
    .replace(/\sdata-testid="[^"]+"/g, "")
    .replace(/\sdata-sc[a-z-]*="[^"]*"/g, "");
}
