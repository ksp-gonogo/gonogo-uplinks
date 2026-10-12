/**
 * Dish turning: the craft's switch for it, the dish it has on loan, and every
 * other craft's switch.
 *
 * A craft that holds a message for a peer it cannot see may turn an idle dish to
 * the peer, send, and turn it back. The network decides when; what an operator
 * decides is whether a craft may do it at all, and what they see is the dish
 * that is out of place while it lasts.
 */
import { useCommand, value } from "@ksp-gonogo/sitrep-sdk";
import {
  Card,
  Cluster,
  SectionTitle,
  Stack,
  Switch,
  Text,
  Unit,
} from "@ksp-gonogo/ui-kit";
import type { RealAntennasVesselRetargeting } from "../__generated__/contract.js";
import "../commands";
import "../topics";

/** The guid of a node id such as `vessel:<guid>`, or the text unchanged when it has no prefix. */
function guidOf(nodeId: string): string {
  return nodeId.startsWith("vessel:") ? nodeId.slice("vessel:".length) : nodeId;
}

/** What a node is called: a craft by its name when it is known, a ground station by its own. */
function nameOf(
  nodeId: string,
  vessels: readonly { id: string; name: string }[],
): string {
  if (nodeId.startsWith("ground:")) return nodeId.slice("ground:".length);
  const guid = guidOf(nodeId);
  return vessels.find((v) => v.id === guid)?.name ?? guid;
}

const LABEL_STYLE = {
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
};

interface SwitchRowProps {
  /** The craft's guid. */
  vesselId: string;
  name: string;
  entry: RealAntennasVesselRetargeting | undefined;
}

/**
 * One craft's switch. Off means the craft never has a dish turned on its own;
 * the change rides that craft's light-time like any other order to it, so the
 * switch shows what the craft was last known to be set to and the order sits on
 * the delay rail until it lands.
 */
function RetargetSwitch({ vesselId, name, entry }: SwitchRowProps) {
  const setAutoRetarget = useCommand("realantennas.vessel.setAutoRetarget");
  const allowed = entry?.allowed ?? true;
  return (
    <Cluster gap="related-comfortable" align="center" wrap justify="start">
      <Switch
        checked={allowed}
        label={`Automatic retargeting, ${name}`}
        onChange={(next) => {
          void setAutoRetarget
            .send({ vessel: vesselId, allow: next })
            .catch(() => undefined);
        }}
      />
    </Cluster>
  );
}

interface BorrowedProps {
  entry: RealAntennasVesselRetargeting;
  vessels: readonly { id: string; name: string }[];
}

/** The dish that is out of place, and where it goes back to. */
function BorrowedNotice({ entry, vessels }: BorrowedProps) {
  const borrowed = entry.borrowed;
  if (!borrowed) return null;
  return (
    <Text size="sm" role="status">
      Borrowed · {borrowed.dishName || "a dish"} aimed at{" "}
      {nameOf(borrowed.peerId, vessels)} since{" "}
      <Unit value={borrowed.sinceUt} /> · turns back to {borrowed.previousAim}
    </Text>
  );
}

/** The last loan that finished, in one line. */
function LastNotice({ entry, vessels }: BorrowedProps) {
  const last = entry.last;
  if (!last || entry.borrowed) return null;
  const outcome =
    last.outcome === "restored"
      ? "put back"
      : last.outcome === "taken"
        ? "taken over by the operator"
        : "gone";
  return (
    <Text size="xs" level="muted">
      Last borrowed for {nameOf(last.peerId, vessels)}, {outcome}, for{" "}
      <Unit
        value={value(
          "s",
          Math.max(0, last.endedUt.valueOf() - last.turnedUt.valueOf()),
        )}
      />
    </Text>
  );
}

interface RetargetingProps {
  /** The reported craft's guid, from the antennas' own source. */
  vesselId: string;
  /** Every craft's dish turning as `realantennas.retargeting` reports it; read by the section, which is subscribed before this appears. */
  entries: readonly RealAntennasVesselRetargeting[];
  vessels: readonly { id: string; name: string }[];
}

/**
 * The reported craft's row, and a list of every other craft with something to
 * say: one that is opted out or has a dish out. A relay can be opted out without
 * switching to it, and a craft that has borrowed a dish is shown whether or not
 * it is the one being watched.
 */
export function Retargeting({ vesselId, entries, vessels }: RetargetingProps) {
  const own = entries.find((e) => e.vesselId === vesselId);
  const others = entries.filter(
    (e) => e.vesselId !== vesselId && (!e.allowed || e.borrowed),
  );
  return (
    <Stack gap="related-dense" aria-label="Dish turning">
      <SectionTitle>Dish turning</SectionTitle>
      <Card>
        <Stack gap="related-dense">
          <Text size="xs" level="muted" style={LABEL_STYLE}>
            This craft
          </Text>
          <RetargetSwitch
            vesselId={vesselId}
            name={nameOf(`vessel:${vesselId}`, vessels)}
            entry={own}
          />
          {own ? <BorrowedNotice entry={own} vessels={vessels} /> : null}
          {own ? <LastNotice entry={own} vessels={vessels} /> : null}
        </Stack>
      </Card>
      {others.map((entry) => (
        <Card key={entry.vesselId}>
          <Stack gap="related-dense">
            <Text size="xs" level="muted" style={LABEL_STYLE}>
              {nameOf(`vessel:${entry.vesselId}`, vessels)}
            </Text>
            <RetargetSwitch
              vesselId={entry.vesselId}
              name={nameOf(`vessel:${entry.vesselId}`, vessels)}
              entry={entry}
            />
            <BorrowedNotice entry={entry} vessels={vessels} />
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
