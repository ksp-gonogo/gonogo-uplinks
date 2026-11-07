import type { SystemUplinkHealth } from "@ksp-gonogo/sitrep-sdk";
import {
  clearUplinkBanner,
  raiseUplinkBanner,
  useStream,
} from "@ksp-gonogo/sitrep-sdk";
import { useEffect } from "react";
import { PRINCIPIA } from "../uplink.js";

/** The roster fact the mod sets once forecasts have stopped for this session. */
const FORECASTS_FACT = "forecasts";

const BANNER_ID = "forecasts-stopped";

/** What the banner says while forecasts are stopped. */
export const FORECASTS_STOPPED_BANNER =
  "Principia's forecasts stopped after an internal error. Restart the game to bring them back.";

/*
 * The banner has one id, so every surface that calls this raises the same banner, and
 * it comes down when the roster no longer says stopped, as it does after a restart.
 */
let raised = false;

/**
 * Why Principia's forecasts have stopped for this session, in the Uplink's words, or
 * null while they run. Raises the forecasts-stopped banner while they are stopped.
 */
export function useForecastsStopped(): string | null {
  const reading = useStream<SystemUplinkHealth>("system.uplinkHealth");
  let reason: string | null = null;
  if (reading.state === "observed" || reading.state === "held") {
    const principia = reading.value.uplinks.find((u) => u.id === "principia");
    const stopped = principia?.health.facts.some(
      (fact) => fact.label === FORECASTS_FACT && fact.value === "stopped",
    );
    reason = stopped ? (principia?.health.detail ?? "Stopped") : null;
  }
  const isStopped = reason !== null;
  const known = reading.state === "observed" || reading.state === "held";

  useEffect(() => {
    if (isStopped) {
      raised = true;
      raiseUplinkBanner(PRINCIPIA, {
        id: BANNER_ID,
        severity: "warning",
        text: FORECASTS_STOPPED_BANNER,
      });
      return;
    }
    if (known && raised) {
      raised = false;
      clearUplinkBanner(PRINCIPIA, BANNER_ID);
    }
  }, [isStopped, known]);

  return reason;
}
