import { value } from "@ksp-gonogo/sitrep-sdk";
import { writeQuantity } from "@ksp-gonogo/ui-kit";
import { useSyncExternalStore } from "react";

/**
 * How the command centre knows where the craft a command camera is aimed at
 * is: `heard` through radio telemetry, `seen` through a ground station's line
 * of sight, `modelled` by carrying the last known orbit forward, `held` as the
 * last known position only, `blackout` as held while the craft is out of
 * contact. Useful for marking a camera's target brackets the way every other
 * widget marks a figure that is not a reading of now. Used by
 * {@link buildTargetBracketOverlay}.
 */
export type CommandNetworkState =
  | "heard"
  | "seen"
  | "modelled"
  | "held"
  | "blackout";

/**
 * What the command centre knew of a command camera's target from `ut` onward,
 * until the next sample. `lastKnownUt` is the mission time of the last fix and
 * is `null` for `heard` and `seen`, which are current. `uncertaintyM` is the
 * radius of the region the craft may be in, in metres.
 */
export interface CommandKnowledgeSample {
  ut: number;
  network: CommandNetworkState;
  lastKnownUt: number | null;
  uncertaintyM: number;
}

const timelines = new Map<number, CommandKnowledgeSample[]>();
const listeners = new Set<() => void>();
let version = 0;

function changed(): void {
  version += 1;
  for (const listener of listeners) listener();
}

/**
 * Records what the command centre knows of a command camera's target from
 * `sample.ut`, replacing any sample at the same time. Samples may arrive in
 * any order; each is kept in time order so a read at a frame's UT finds the
 * state in force then.
 */
export function publishCommandKnowledge(
  flightId: number,
  sample: CommandKnowledgeSample,
): void {
  const list = timelines.get(flightId) ?? [];
  const next = list.filter((s) => s.ut !== sample.ut);
  next.push(sample);
  next.sort((a, b) => a.ut - b.ut);
  timelines.set(flightId, next);
  changed();
}

/** Forgets what is known of one command camera's target, or of all of them. */
export function clearCommandKnowledge(flightId?: number): void {
  if (flightId === undefined) timelines.clear();
  else timelines.delete(flightId);
  changed();
}

/**
 * The knowledge in force for a camera at mission time `ut`: the latest sample
 * at or before it. Null when nothing was known by then, which reads as a
 * camera with no command centre behind it.
 */
export function commandKnowledgeAt(
  flightId: number,
  ut: number,
): CommandKnowledgeSample | null {
  const list = timelines.get(flightId);
  if (!list) return null;
  let found: CommandKnowledgeSample | null = null;
  for (const sample of list) {
    if (sample.ut > ut) break;
    found = sample;
  }
  return found;
}

/** The newest knowledge of a camera, whatever the UT of the frame on screen. */
export function latestCommandKnowledge(
  flightId: number,
): CommandKnowledgeSample | null {
  const list = timelines.get(flightId);
  return list && list.length > 0 ? list[list.length - 1] : null;
}

/** Re-renders the caller whenever any camera's knowledge changes. */
export function useCommandKnowledgeVersion(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
    () => version,
  );
}

/** A span of mission time, written the way every other widget writes a duration. */
export function formatKnowledgeAge(seconds: number): string {
  return writeQuantity(value("s", Math.max(0, Math.floor(seconds))));
}
