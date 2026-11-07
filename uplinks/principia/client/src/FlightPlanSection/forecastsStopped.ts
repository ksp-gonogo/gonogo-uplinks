import type { SystemUplinkHealth } from "@ksp-gonogo/sitrep-sdk";
import { useStream } from "@ksp-gonogo/sitrep-sdk";

/** The roster fact the mod sets once forecasts have stopped for this session. */
const FORECASTS_FACT = "forecasts";

/**
 * Why Principia's forecasts have stopped for this session, in the Uplink's words, or
 * null while they run. Every client reaction to a stopped copy goes through here.
 */
export function useForecastsStopped(): string | null {
  const reading = useStream<SystemUplinkHealth>("system.uplinkHealth");
  if (reading.state !== "observed" && reading.state !== "held") {
    return null;
  }
  const principia = reading.value.uplinks.find((u) => u.id === "principia");
  const stopped = principia?.health.facts.some(
    (fact) => fact.label === FORECASTS_FACT && fact.value === "stopped",
  );
  return stopped ? principia?.health.detail ?? "Stopped" : null;
}
