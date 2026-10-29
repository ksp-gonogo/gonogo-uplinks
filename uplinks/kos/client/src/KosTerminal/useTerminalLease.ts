import {
  classifyCommandRejection,
  describeErrorCode,
} from "@ksp-gonogo/sitrep-sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { KosErrorCodes } from "../__generated__/error-codes.js";

/** First wait between open attempts; each retry doubles it up to the cap. */
const RETRY_FIRST_MS = 500;
const RETRY_CAP_MS = 5000;

/**
 * What the terminal tells the operator about its lease on the CPU's terminal:
 * `waiting` while an open is being retried, `refused` when the open was refused
 * for a reason that will not clear by itself, `keystroke` when a typed line was
 * refused. `text` is a sentence in the operator's words.
 */
export interface TerminalLeaseNotice {
  kind: "waiting" | "refused" | "keystroke";
  text: string;
}

interface Options {
  readOnly: boolean;
  /** Re-acquire when the stream this terminal rides returns after being held. */
  streamHeld: boolean;
  sendOpen: () => Promise<unknown>;
  sendResize: () => Promise<unknown>;
  sendClose: () => Promise<unknown>;
}

interface Refusal {
  text: string;
  /** Whether asking again can succeed without anything else changing. */
  transient: boolean;
  /** The refusal is that another screen holds the terminal. */
  heldElsewhere: boolean;
}

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function readRefusal(error: unknown): Refusal {
  const rejection = classifyCommandRejection(error);
  if (rejection.kind === "refused") {
    const declared =
      rejection.reason === undefined
        ? undefined
        : describeErrorCode(rejection.reason)?.sentence;
    const text = sentence(declared ?? rejection.detail ?? rejection.message);
    const heldElsewhere = rejection.reason === KosErrorCodes.TerminalHeld;
    const transient =
      !heldElsewhere &&
      (rejection.errorCode === "wrongState" ||
        rejection.errorCode === "notFound" ||
        rejection.errorCode === "noConnection" ||
        rejection.reason === KosErrorCodes.CpuBusy);
    return { text, transient, heldElsewhere };
  }
  return {
    text: sentence(rejection.message),
    transient: true,
    heldElsewhere: false,
  };
}

/**
 * Holds the terminal lease for as long as the widget is mounted: opens it,
 * retries an open the game refused for a reason that passes (the flight scene
 * still loading, the CPU not there yet, the CPU busy, no link to the craft yet,
 * no answer), asks again at the slowest pace while another screen holds the
 * terminal so it takes over when that screen lets go, stops at any other
 * refusal that will not clear by itself and says so, and reopens when a
 * keystroke finds the lease gone or the stream returns, and releases the lease
 * when the page is closed.
 * Used by the kOS terminal widget.
 *
 * `onKeystrokeRefused` takes the error a keystroke's send rejected with and
 * `onKeystrokeAccepted` clears the notice it left.
 */
export function useTerminalLease({
  readOnly,
  streamHeld,
  sendOpen,
  sendResize,
  sendClose,
}: Readonly<Options>) {
  const [attempt, setAttempt] = useState(0);
  const [lease, setLease] = useState<TerminalLeaseNotice | null>(null);
  const [keystroke, setKeystroke] = useState<TerminalLeaseNotice | null>(null);
  const heldRef = useRef(false);
  const wasStreamHeld = useRef(streamHeld);

  useEffect(() => {
    if (wasStreamHeld.current && !streamHeld) setAttempt((n) => n + 1);
    wasStreamHeld.current = streamHeld;
  }, [streamHeld]);

  // `attempt` is the effect's restart switch, so it is read nowhere inside.
  // biome-ignore lint/correctness/useExhaustiveDependencies: restart switch
  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const open = (wait: number) => {
      sendOpen().then(
        () => {
          if (cancelled) return;
          heldRef.current = true;
          setLease(null);
          // The widget's fixed size is imposed once the lease is held, since a
          // resize before it is refused the same way the open was.
          void sendResize().catch(() => {});
        },
        (error: unknown) => {
          if (cancelled) return;
          heldRef.current = false;
          const refusal = readRefusal(error);
          if (refusal.heldElsewhere) {
            setLease({ kind: "refused", text: refusal.text });
            timer = setTimeout(() => open(RETRY_CAP_MS), RETRY_CAP_MS);
            return;
          }
          if (!refusal.transient) {
            setLease({ kind: "refused", text: refusal.text });
            return;
          }
          setLease({ kind: "waiting", text: refusal.text });
          timer = setTimeout(
            () => open(Math.min(wait * 2, RETRY_CAP_MS)),
            wait,
          );
        },
      );
    };
    open(RETRY_FIRST_MS);

    /*
     * Closing the tab never runs the effect cleanup, and the game frees a lease
     * only when it is closed or has sat idle for a minute, so the release is
     * also sent as the page goes away. A reload sends the same token again.
     */
    const onPageHide = () => {
      if (heldRef.current) void sendClose().catch(() => {});
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      heldRef.current = false;
      setLease(null);
      void sendClose().catch(() => {});
    };
  }, [readOnly, sendOpen, sendResize, sendClose, attempt]);

  const onKeystrokeRefused = useCallback((error: unknown) => {
    const refusal = readRefusal(error);
    setKeystroke({ kind: "keystroke", text: refusal.text });
    // A refusal that says another screen holds the terminal, after this one
    // held it, means the lease was lost with the scene: ask for it again, and
    // the open says whether another screen really has it.
    if (refusal.heldElsewhere && heldRef.current) {
      heldRef.current = false;
      setAttempt((n) => n + 1);
    }
  }, []);

  const onKeystrokeAccepted = useCallback(() => setKeystroke(null), []);

  return {
    notice: lease ?? keystroke,
    onKeystrokeRefused,
    onKeystrokeAccepted,
  };
}
