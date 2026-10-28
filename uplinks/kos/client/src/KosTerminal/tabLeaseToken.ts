import { safeRandomUuid } from "@ksp-gonogo/sitrep-sdk";

const KEY_PREFIX = "gonogo.kos.terminal.lease.";

/**
 * The write-lease token this browser tab uses for a CPU's terminal. It is kept
 * in session storage so a reload of the tab sends the token the previous page
 * opened with and reclaims that lease. A second tab or device has its own
 * session storage and so its own token. Falls back to a fresh token when
 * storage is unavailable. Used by the kOS terminal widget.
 */
export function tabLeaseToken(coreId: number): string {
  const key = `${KEY_PREFIX}${coreId}`;
  try {
    const kept = window.sessionStorage.getItem(key);
    if (kept) return kept;
  } catch {
    return safeRandomUuid();
  }
  const fresh = safeRandomUuid();
  try {
    window.sessionStorage.setItem(key, fresh);
  } catch {
    // The token still works for this page load.
  }
  return fresh;
}
