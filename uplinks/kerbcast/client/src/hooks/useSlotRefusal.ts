import { getUplinkHandle } from "@ksp-gonogo/sitrep-sdk";
import { useCallback, useSyncExternalStore } from "react";
import type { KerbcastDataSource, SlotRefusal } from "../KerbcastDataSource.js";

const NEVER_CHANGES = () => () => {};

/** Operator-facing wording for a refused bind, shared by every binding surface. */
export function describeSlotRefusal(refusal: SlotRefusal): string {
  return `No video slot free (${refusal.slotsInUse} in use)`;
}

/**
 * The sidecar's refusal to bind `flightId` into a video slot, or `null` when
 * there is none. Re-renders when the refusal is issued or lifted.
 *
 * Reads through the registered kerbcast handle and treats one that lacks the
 * slot-refusal methods as never refusing, so a test double that only stands in
 * for the stream still renders.
 */
export function useSlotRefusal(flightId: number | null): SlotRefusal | null {
  const ds = getUplinkHandle<Partial<KerbcastDataSource>>("kerbcast");
  const subscribe = useCallback(
    (cb: () => void) => ds?.onSlotRefusalChange?.(cb) ?? NEVER_CHANGES(),
    [ds],
  );
  const read = () =>
    flightId === null ? null : (ds?.getSlotRefusal?.(flightId) ?? null);
  return useSyncExternalStore(subscribe, read);
}
