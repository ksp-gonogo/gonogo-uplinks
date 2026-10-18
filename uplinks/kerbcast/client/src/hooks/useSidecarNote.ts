import { getUplinkHandle } from "@ksp-gonogo/sitrep-sdk";
import { useSyncExternalStore } from "react";
import type { KerbcastDataSource } from "../KerbcastDataSource.js";

const NEVER = () => () => {};

/**
 * The sentence naming an unreachable kerbcast sidecar, or null while it answers
 * or has not been tried. Used by {@link CameraFeed} to replace its empty state.
 */
export function useSidecarNote(): string | null {
  const ds = getUplinkHandle<KerbcastDataSource>("kerbcast");
  return useSyncExternalStore(
    ds ? (cb) => ds.onReadinessNoteChange(cb) : NEVER,
    () => ds?.readinessNote() ?? null,
  );
}
