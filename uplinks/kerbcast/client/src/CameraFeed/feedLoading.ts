import type { DataSourceStatus } from "@ksp-gonogo/sitrep-sdk";

/**
 * Whether a feed with no picture is waiting on the link to the cameras, which
 * is being made or made again: false once the link is up, has failed, or says
 * why it is unreachable (`unreachableNote` set). Useful for presenting a feed
 * that is still loading as loading rather than as broken. Used by
 * {@link CameraFeed}.
 */
export function feedLoading(
  status: DataSourceStatus | undefined,
  unreachableNote: string | null,
): boolean {
  if (unreachableNote !== null) return false;
  return status === "reconnecting" || status === "disconnected";
}

/** The words a feed that is still loading shows: in the picture's badge, and as the empty-list message. */
export const FEED_LOADING_TEXT = {
  badge: "CONNECTING",
  empty: "Connecting to cameras",
} as const;
