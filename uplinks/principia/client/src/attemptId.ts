import { useCallback, useState } from "react";

function freshNonce(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

/**
 * The request id for one attempt at a plan write, and the call that ends the
 * attempt.
 *
 * <p>The mod answers a repeated request id from the receipt of a write it
 * already made instead of writing again, so the id has to name one attempt: a
 * resend of that attempt keeps it, and the next attempt gets its own. `intent`
 * is what the attempt would write, so changing what is about to be sent is a
 * different attempt even before the last one has settled. Call `settle` once a
 * write has been answered; the id is then new, including across a page reload,
 * which an id counted from zero would not be.</p>
 */
export function useAttemptId(intent: string): {
  requestId: string;
  settle: () => void;
} {
  const [nonce, setNonce] = useState(freshNonce);
  const settle = useCallback(() => setNonce(freshNonce()), []);
  return { requestId: `${intent}#${nonce}`, settle };
}
