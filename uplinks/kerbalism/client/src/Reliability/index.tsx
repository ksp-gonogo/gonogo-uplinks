import type { SlotProps, TopicReading } from "@ksp-gonogo/sitrep-sdk";
import { registerAugment, useTelemetry } from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  Card,
  Cluster,
  HeldBadge,
  magnitudeOf,
  Stack,
  Text,
  worstSeverity,
} from "@ksp-gonogo/ui-kit";
import { KERBALISM } from "../uplink.js";
import { RepairControl } from "./RepairControl.js";
import { actionable, repairCostResolver } from "./repair.js";
import { isNoteworthy, rowFor } from "./rows.js";

/**
 * The value of a FACT, which stays true until an event changes it and no event
 * can reach us down a link that is not delivering. Held counts; a pending or
 * unowned reading does not.
 */
function stillTrue<T>(reading: TopicReading<T>): T | undefined {
  return reading.state === "observed" || reading.state === "held"
    ? reading.value
    : undefined;
}

/**
 * Kerbalism's reliability on the fleet roster's row for the craft it is
 * about. Neither reliability topic carries a vessel id and describes the
 * active craft, so every other row draws nothing.
 *
 * Draws nothing at all unless Kerbalism says it is breaking parts: a save
 * with failures switched off publishes no reliability, and "could not tell"
 * is an install fact rather than something to act on from a roster row. A
 * clean craft draws nothing too, so the row only speaks when a part is failed,
 * due a service, or unreadable.
 *
 * Once the link drops the last listing stays on screen under a held badge,
 * without its repair controls: a failure is a fact until something repairs it,
 * but a command cannot reach a craft that cannot be heard.
 */
export function KerbalismReliabilityUpdates({
  vesselId,
  compact,
}: SlotProps<"fleet-roster.updates">) {
  const identity = stillTrue(useTelemetry("vessel.identity"));
  const summary = stillTrue(useTelemetry("kerbalism.reliability"));
  const partsReading = useTelemetry("kerbalism.reliabilityParts");
  const crew = stillTrue(useTelemetry("vessel.crew"))?.crew ?? [];
  const stores = stillTrue(useTelemetry("vessel.inventory"))?.stores ?? [];

  if (!identity || identity.vesselId !== vesselId) return null;
  if (summary?.coverage !== "modeled") return null;

  const parts = stillTrue(partsReading);
  if (parts === undefined) return null;

  const noteworthy = parts.filter(isNoteworthy);
  if (noteworthy.length === 0) return null;

  const held = partsReading.state === "held" ? partsReading.grade : null;
  const costOf = repairCostResolver(crew, stores);
  const rows = noteworthy.map((part) => ({ part, row: rowFor(part) }));
  const severity = worstSeverity(rows.map((entry) => entry.row.severity));
  const atRisk = rows.some(
    (entry) =>
      entry.row.severity === "nogo" || entry.part.condition === "unknown",
  );

  // A wrapping Cluster: at roster width an unwrapping row would crush the badges into circles.
  return (
    <Stack role="group" aria-label="Kerbalism reliability">
      <Cluster justify="start" wrap>
        <Badge tone={severity}>
          {`${rows.length} ${atRisk ? "at risk" : "to watch"}`}
        </Badge>
        {held && <HeldBadge grade={held} subject="Kerbalism reliability" />}
      </Cluster>
      {!compact &&
        rows.map(({ part, row }, index) => (
          // The key falls back to the index, never the title: many modules share a title.
          <Card
            key={part.partId ?? `idx-${index}`}
            tone={row.severity}
            title={part.title ?? "Unknown part"}
            titleRight={<Badge tone={row.severity}>{row.word}</Badge>}
          >
            {row.clause !== undefined && (
              <Text level="muted">{row.clause}</Text>
            )}
            {!held && actionable(part.condition) && part.partId && (
              <RepairControl
                partId={part.partId}
                condition={part.condition}
                repairTrait={part.repairTrait}
                repairLevel={magnitudeOf(part.repairLevel)}
                crew={crew}
                cost={costOf(part.repairCost)}
              />
            )}
          </Card>
        ))}
    </Stack>
  );
}

registerAugment({
  id: "kerbalism-reliability-updates",
  augments: "fleet-roster.updates",
  component: KerbalismReliabilityUpdates,
  requires: "kerbalism",
  owner: KERBALISM,
});
