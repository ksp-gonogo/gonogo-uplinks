import type { SlotProps, TopicReading } from "@ksp-gonogo/sitrep-sdk";
import {
  registerAugment,
  useCommand,
  useTelemetry,
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  Card,
  Cluster,
  CommandButton,
  HeldBadge,
  Stack,
  Text,
  worstSeverity,
} from "@ksp-gonogo/ui-kit";
import type { TestFlightReliabilityPart } from "../__generated__/contract.js";
import { TESTFLIGHT } from "../uplink.js";
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

/** The engine's name as an RO operator knows it: the flying config beside the part title. */
function titleOf(part: TestFlightReliabilityPart): string {
  const title = part.title ?? "Unknown engine";
  return part.configuration && part.configuration !== title
    ? `${title} (${part.configuration})`
    : title;
}

/**
 * TestFlight's own repair for one failed engine. It takes no crew, no item and
 * no time, so there is nobody to pick and no cost to state: one confirmed press
 * is the whole of it.
 */
function RepairEngine({ partId, title }: { partId: string; title: string }) {
  const repair = useCommand("testflight.repair");
  return (
    <Cluster justify="start">
      <CommandButton
        handle={repair}
        args={{ partId }}
        size="sm"
        commandLabel={`Repair ${title}`}
        label="Repair"
        confirmLabel="Confirm"
        pendingLabel="Repair..."
      />
    </Cluster>
  );
}

/**
 * TestFlight's engine reliability on the fleet roster's row for the craft it is
 * about. Neither topic carries a vessel id and both describe the active craft, so
 * every other row draws nothing.
 *
 * Draws nothing unless TestFlight is reporting and an engine is failed,
 * unreadable, nearly through a rated burn or unlikely to survive its next one.
 * Once the link drops the last listing stays under a held badge without its
 * repair buttons: a failure is a fact until something repairs it, but a command
 * cannot reach a craft that cannot be heard.
 */
export function TestFlightReliabilityUpdates({
  vesselId,
  compact,
}: SlotProps<"fleet-roster.updates">) {
  const identity = stillTrue(useTelemetry("vessel.identity"));
  const summary = stillTrue(useTelemetry("testflight.reliability"));
  const partsReading = useTelemetry("testflight.reliabilityParts");

  if (!identity || identity.vesselId !== vesselId) return null;
  if (summary?.coverage !== "modeled") return null;

  const parts = stillTrue(partsReading);
  if (parts === undefined) return null;

  const noteworthy = parts.filter(isNoteworthy);
  if (noteworthy.length === 0) return null;

  const held = partsReading.state === "held" ? partsReading.grade : null;
  const rows = noteworthy.map((part) => ({ part, row: rowFor(part) }));
  const severity = worstSeverity(rows.map((entry) => entry.row.severity));
  const atRisk = rows.some(
    (entry) =>
      entry.row.severity === "nogo" || entry.part.condition === "unknown",
  );

  return (
    <Stack role="group" aria-label="TestFlight reliability">
      <Cluster justify="start" wrap>
        <Badge tone={severity}>
          {`${rows.length} ${atRisk ? "at risk" : "to watch"}`}
        </Badge>
        {held && <HeldBadge grade={held} subject="TestFlight reliability" />}
      </Cluster>
      {!compact &&
        rows.map(({ part, row }, index) => (
          // The key falls back to the index, never the title: a cluster of identical engines shares one.
          <Card
            key={part.partId ?? `idx-${index}`}
            tone={row.severity}
            title={titleOf(part)}
            titleRight={<Badge tone={row.severity}>{row.word}</Badge>}
          >
            {row.clause !== undefined && (
              <Text level="muted">{row.clause}</Text>
            )}
            {!held && part.condition === "failed" && part.partId && (
              <RepairEngine partId={part.partId} title={titleOf(part)} />
            )}
          </Card>
        ))}
    </Stack>
  );
}

registerAugment({
  id: "testflight-reliability-updates",
  augments: "fleet-roster.updates",
  component: TestFlightReliabilityUpdates,
  requires: "testflight",
  owner: TESTFLIGHT,
});
