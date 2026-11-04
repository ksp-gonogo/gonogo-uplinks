import type { LiftoffCountdown } from "@ksp-gonogo/sitrep-sdk";
import { useEffect, useRef } from "react";

/** The args of the launch countdown command, which the generated contract types. */
export interface LaunchCountdownMessage {
  running: boolean;
  remainingSeconds: number;
  lengthSeconds: number;
}

/**
 * Tells the Uplink when a countdown to liftoff starts and when it is called
 * off, so the launchpad cameras can frame the craft wider over the time left.
 * A countdown that runs out is not called off: the cameras hold wide until the
 * craft is off the ground. Mount it on the main screen only, so one command
 * goes out per countdown however many screens are open.
 */
export function useLaunchCountdownSender(
  liftoff: LiftoffCountdown | null,
  send: (message: LaunchCountdownMessage) => void,
): void {
  const sendRef = useRef(send);
  sendRef.current = send;
  const sent = useRef(false);
  const lastRemaining = useRef(0);

  useEffect(() => {
    if (liftoff === null) {
      if (sent.current) {
        sent.current = false;
        sendRef.current({
          running: false,
          remainingSeconds: 0,
          lengthSeconds: 0,
        });
      }
      return;
    }
    const restarted = liftoff.remainingSeconds > lastRemaining.current + 0.5;
    lastRemaining.current = liftoff.remainingSeconds;
    if (sent.current && !restarted) return;
    sent.current = true;
    sendRef.current({
      running: true,
      remainingSeconds: liftoff.remainingSeconds,
      lengthSeconds: liftoff.lengthSeconds,
    });
  }, [liftoff]);
}
