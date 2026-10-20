import type { CameraState, KerbcastClient } from "@ksp-gonogo/kerbcast";
import { isCameraDestroyed } from "@ksp-gonogo/kerbcast-react";

/**
 * The cameras in picker order: live cameras first, grouped by craft in the
 * order each craft first appears, then destroyed cameras. Order within a craft
 * is the registry's, so camera numbering stays stable.
 */
export function orderCamerasForPicker<T extends CameraState>(
  cameras: readonly T[],
): T[] {
  const craftRank = new Map<string, number>();
  for (const c of cameras) {
    if (!craftRank.has(c.vesselName)) craftRank.set(c.vesselName, craftRank.size);
  }
  const rank = (c: T) =>
    (isCameraDestroyed(c) ? 1 : 0) * craftRank.size +
    (craftRank.get(c.vesselName) ?? 0);
  return [...cameras].sort((a, b) => rank(a) - rank(b));
}

/**
 * The flight ids the picker may offer. A destroyed camera is offered only while
 * it is the selected one (it keeps its last frame under SIGNAL LOST) or when no
 * camera is live, so lost cameras never crowd the live ones.
 */
export function selectableFlightIds(
  cameras: readonly CameraState[],
  selectedFlightId: number | null,
): Set<number> {
  const anyLive = cameras.some((c) => !isCameraDestroyed(c));
  return new Set(
    cameras
      .filter(
        (c) =>
          !anyLive || !isCameraDestroyed(c) || c.flightId === selectedFlightId,
      )
      .map((c) => c.flightId),
  );
}

/**
 * A view of the client whose camera registry is in picker order. The shared
 * feed lists cameras in the order its client reports them and offers no
 * ordering of its own, so the order is applied where it reads them.
 */
export function withPickerOrder(client: KerbcastClient): KerbcastClient {
  return new Proxy(client, {
    get(target, prop) {
      if (prop === "cameras") return orderCamerasForPicker(target.cameras);
      if (prop === "on") {
        return (event: string, handler: (...args: unknown[]) => void) =>
          (target.on as (e: string, h: (...a: unknown[]) => void) => () => void)(
            event,
            event === "cameras-change"
              ? (next: unknown) =>
                  handler(orderCamerasForPicker(next as CameraState[]))
              : handler,
          );
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
