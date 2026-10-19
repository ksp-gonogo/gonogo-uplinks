import type { SlotProps } from "@ksp-gonogo/sitrep-sdk";
import { registerAugment, useTelemetry } from "@ksp-gonogo/sitrep-sdk";
import { Badge, HeldBadge, Inline } from "@ksp-gonogo/ui-kit";
import { readKerbalismScienceInstrumentExt } from "../science.js";
import { KERBALISM } from "../uplink.js";

/** The badge tone for each run state Kerbalism reports; anything else draws neutral. */
const TONE: Record<string, "go" | "nogo" | undefined> = {
  Running: "go",
  Forced: "go",
  Broken: "nogo",
};

/**
 * A Kerbalism experiment's run state under its row in the Experiments widget.
 * Kerbalism experiments sample continuously and have no one-shot flag, so the
 * run state ("Running", "Stopped", "Broken") is what says what the instrument is
 * doing. Draws nothing for an instrument Kerbalism does not own, and for a
 * Kerbalism scanner, which has no run state.
 */
export function KerbalismInstrumentRunState({
  instrument,
}: SlotProps<"experiments.instrument">) {
  const reading = useTelemetry("science.instruments");
  // A run state stays true until something changes it, so a held one still counts.
  const entries =
    reading.state === "observed" || reading.state === "held"
      ? reading.value
      : undefined;
  const entry = entries?.find(
    (candidate) =>
      String(candidate.partId) === instrument.partId &&
      (candidate.experimentId ?? "") === instrument.expId,
  );
  const ext = readKerbalismScienceInstrumentExt(entry);
  if (ext?.kind !== "experiment" || !ext.runningState) return null;

  return (
    <li>
      <Inline wrap>
        <Badge tone={TONE[ext.runningState]}>
          {ext.runningState.toUpperCase()}
        </Badge>
        {reading.state === "held" && (
          <HeldBadge grade={reading.grade} subject="Experiment run state" />
        )}
      </Inline>
    </li>
  );
}

registerAugment({
  id: "kerbalism-science-instrument-run-state",
  augments: "experiments.instrument",
  component: KerbalismInstrumentRunState,
  requires: "kerbalism",
  owner: KERBALISM,
});
