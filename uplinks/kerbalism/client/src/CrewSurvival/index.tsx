import type { SlotProps, Value } from "@ksp-gonogo/sitrep-sdk";
import { registerAugment, useProcessor, value } from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  ModelledAlongside,
  modelledBeyondReceived,
  type Severity,
  writeQuantity,
} from "@ksp-gonogo/ui-kit";
import { KERBALISM } from "../uplink.js";
// Side-effect: registers the per-kerbal survival METERS, which were the
// `crew-status.survival` augment in this file until they became data. See that
// module's own header for why a stack of bars is a contribution.
import "./meters.js";
import { ruleLabel } from "./meters.js";
import {
  CREW_SURVIVAL,
  type CrewSurvival,
  criticalCause,
  type KerbalSurvival,
  marginSecondsOf,
  survivalFrom,
} from "./processor.js";

/**
 * Shared lookup: matched by `crewIndex` first (the row order CrewStatus
 * renders IS `vessel.crew.crew`'s own order, and so is `CREW_SURVIVAL.kerbals`,
 * both built from the same array), falling back to a name search only if that
 * position's name has drifted (e.g. a future base-widget change that
 * filters/reorders the roster).
 */
function findKerbal(
  survival: CrewSurvival,
  crewName: string,
  crewIndex: number,
): KerbalSurvival | undefined {
  const byIndex = survival.kerbals[crewIndex];
  return byIndex?.name === crewName
    ? byIndex
    : survival.kerbals.find((k) => k.name === crewName);
}

/**
 * The consequence a kerbal's derived state implies, never a restated meter
 * number: only fires in the danger band (`tone === "nogo"`, the same
 * threshold `processor.ts`'s `kerbalTone` uses for an imminent death clock
 * or a rule past its critical fraction). A merely-elevated ("warn") kerbal
 * is already flagged by the meter's own colour in the row's meter stack; this badge
 * exists for the case that actually threatens the kerbal, so a nominal or
 * warn-tier kerbal carries no redundant badge next to their name.
 */
function warningFor(kerbal: KerbalSurvival): {
  label: string;
  severity: Severity;
  observed?: Value<"s">;
  modelled?: Value<"s">;
} | null {
  if (kerbal.tone !== "nogo") return null;
  const margin = marginSecondsOf(kerbal);
  if (margin !== null) {
    // A command sent now would land after the deadline, so there is no margin left to count.
    if (margin <= 0) {
      return { label: "too late", severity: "critical" };
    }
    /**
     * The margin is a DURATION, so it renders on the composite time ladder
     * ("2h 15m"), never as a scalar with a symbol beside it: "~4M TO ACT"
     * would be an "M" indistinguishable from metres once the Badge's
     * `text-transform: uppercase` gets hold of it.
     *
     * `writeQuantity` rather than `<Unit>` because a Badge label is a STRING
     * here, and the `time` kind is exactly where the two agree: the ladder
     * interleaves its own parts with the number, so the symbol comes back
     * empty and nothing is appended. The unit is game seconds (`s`, a
     * six-hour KSP day), not `irl:s`: the margin is a span of UT measured to
     * the mod's `deathClockUt`, not desk time.
     */
    return {
      label: `~${writeQuantity(value("s", margin))} to act`,
      severity: "critical",
      observed: value("s", margin),
      modelled: modelledBeyondReceived(kerbal.marginToAct),
    };
  }
  if (kerbal.worstRule) {
    return {
      label: `${ruleLabel(kerbal.worstRule.name)} critical`,
      severity: "critical",
    };
  }
  return null;
}

/**
 * CrewStatus's `crew-status.row-badges` augment: the name-adjacent per-row
 * slot (renders inline in the roster row's `Cluster`, right next to the
 * kerbal's name, per `CrewBadgeContext`'s own doc comment: "a future
 * Kerbalism Habitat/Radiation Uplink can badge each kerbal"). Fed by the
 * SAME `CREW_SURVIVAL` Processor the survival METERS read (`./meters`) and the
 * panel badge reads (`./badge`): one per-frame derivation, three consumers.
 *
 * Still an augment, unlike the meters: what it draws is a CONSEQUENCE, and it
 * is the one thing here whose rendering the host has no rule for.
 *
 * A reading that has stopped arriving is drawn and says so in the label, in
 * the short words a badge has room for; a row of badges clips a long one.
 * The host marks its own figures in the same row, and a death clock left
 * unmarked beside them would read as current on the strength of their marks.
 */
function CrewSurvivalBadgeAugment({
  crewName,
  crewIndex,
}: SlotProps<"crew-status.row-badges">) {
  const answer = survivalFrom(useProcessor(CREW_SURVIVAL));
  if (!answer) return null;
  const kerbal = findKerbal(answer.survival, crewName, crewIndex);
  if (!kerbal) return null;
  const warning = warningFor(kerbal);
  if (!warning) return null;
  /*
   * A carried answer is preferred to a held one: the held figure stays
   * reachable through the reading's own marks, and the carried one can still
   * change. A death clock is never carried, though. It is Kerbalism's own
   * deadline from its last turn, so it is the held figure even when the rules
   * beside it were carried forward.
   */
  const modelled =
    answer.stale &&
    marginSecondsOf(kerbal) === null &&
    criticalCause(kerbal) === "carried-rule"
      ? answer.basis
      : undefined;
  const label = !answer.stale
    ? warning.label
    : modelled
      ? `${warning.label} · modelled`
      : `${warning.label} · held`;
  return (
    <Badge
      severity={warning.severity}
      size="sm"
      data-reckoning-basis={modelled}
    >
      {label}
      <ModelledAlongside
        observed={warning.observed}
        modelled={warning.modelled}
        write={writeMargin}
      />
    </Badge>
  );
}

function writeMargin(margin: Value<"s">): string {
  return `~${writeQuantity(margin)}`;
}

registerAugment({
  id: "crew-status-survival-badge",
  augments: "crew-status.row-badges",
  component: CrewSurvivalBadgeAugment,
  requires: "kerbalism",
  owner: KERBALISM,
});

export { CrewSurvivalBadgeAugment };
