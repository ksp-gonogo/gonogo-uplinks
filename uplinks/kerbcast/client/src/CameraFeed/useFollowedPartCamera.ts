import type { CameraState } from "@ksp-gonogo/kerbcast";
import { logger } from "@ksp-gonogo/sitrep-sdk";
import { useEffect, useRef } from "react";
import { followedPartCameraId } from "./cameraPicker.js";

/**
 * How long the camera a tile holds must stay gone, with the same replacement
 * available, before the tile moves to the replacement, in milliseconds.
 */
export const FOLLOW_SETTLE_MS = 1500;

/**
 * Moves a tile that holds a part camera to the live camera of the same name
 * when the held one is gone for good, by calling `onFollow` with the
 * replacement's id. A part camera comes back under a new id after a relaunch,
 * so a tile holding the old id would show static for good. The move is saved
 * by the caller, so it is made only after the camera has stayed gone, with the
 * same replacement, for {@link FOLLOW_SETTLE_MS}: a camera list that empties or
 * shows the camera as destroyed for a moment while a scene changes must not
 * change the tile. Used by {@link CameraFeed}.
 */
export function useFollowedPartCamera(
  cameras: readonly CameraState[],
  requested: number | null,
  onFollow: (flightId: number) => void,
): void {
  const held = useRef<CameraState | undefined>(undefined);
  const latest = useRef({ cameras, requested, onFollow });
  latest.current = { cameras, requested, onFollow };

  const next = (() => {
    if (requested === null) return null;
    const current = cameras.find((c) => c.flightId === requested);
    if (current) held.current = current;
    else if (held.current?.flightId !== requested) held.current = undefined;
    return followedPartCameraId(cameras, held.current);
  })();
  if (requested === null) held.current = undefined;

  useEffect(() => {
    if (next === null) return;
    const timer = setTimeout(() => {
      const now = latest.current;
      const again =
        now.requested === null
          ? null
          : followedPartCameraId(now.cameras, held.current);
      if (again !== next) return;
      logger.tag("kerbcast:subscriptions").info("tile follows its camera", {
        from: now.requested,
        to: next,
        listed: now.cameras.map((c) => c.flightId),
      });
      now.onFollow(next);
    }, FOLLOW_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [next]);
}
