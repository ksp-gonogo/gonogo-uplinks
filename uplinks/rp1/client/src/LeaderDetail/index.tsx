import {
  type CareerStatus,
  registerAugment,
  useCommand,
  useTelemetry,
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  Cluster,
  CommandButton,
  EmptyState,
  FilterRegion,
  Grid,
  MissionDate,
  magnitudeOf,
  NULL_DISPLAY,
  Readout,
  ReadoutCaption,
  Row,
  RowName,
  Section,
  SectionTitle,
  SelectableRow,
  type Severity,
  Stack,
  SubjectHeading,
  Text,
  Unit,
  useRowFilter,
} from "@ksp-gonogo/ui-kit";
import { useState } from "react";
import type { Rp1LeaderEntry } from "../__generated__/contract.js";
import { LEADERS_SCREEN_ID } from "../AdminBuilding/leadersScreen.js";
import { current } from "../shared/current.js";
import { RP1 } from "../uplink.js";
import "../topics.js";

/** Appoint a leader. Must match `Rp1StrategyCommands.AppointCommand`. */
export const RP1_LEADER_APPOINT_COMMAND = "rp1.leader.appoint";

/**
 * Dismiss a leader. Core's own deactivate, which RP-1's Harmony patch routes to
 * `StrategyRP0.DeactivateOverride`: that charges the dismissal reputation and
 * starts the re-hire cooldown with the building shut, so no RP-1 command is
 * needed for it.
 */
export const DISMISS_COMMAND = "career.strategy.deactivate";

/** The core strategy entry a leader row joins to, for its effect lines and dismissal verdict. */
type CareerStrategyEntry = NonNullable<
  NonNullable<CareerStatus["strategies"]>["all"]
>[number];

/**
 * One RP-1 leader, and what appointing or dismissing it costs.
 *
 * <para>The BODY of the Administration Building's Leaders screen, contributed
 * as an augment on `strategies.screen-body`. The host lists the leader cards
 * above without verbs; this carries them, each with its cost beside it in the
 * currency it costs. Appointing charges nothing on RP-1's shipped leaders, and
 * says so. Dismissing costs reputation, a share of what the career holds now,
 * so the figure beside Dismiss is RP-1's own at this moment, with what that
 * reputation pays in subsidy per day and the re-hire cooldown that follows.</para>
 *
 * <para>Only leaders RP-1 would offer can be appointed. RP-1 leaves a leader
 * whose requirements are unmet, or who was dismissed within the cooldown, off
 * its own list; here it stays listed, marked, with the reason on its dark
 * control, because a leader missing from the catalogue and one that does not
 * exist would look the same.</para>
 */
export function LeaderDetail({ screenId }: { screenId: string }) {
  const available = current(useTelemetry("rp1.available"));
  const leaders = current(useTelemetry("rp1.leaders"));
  const careerReading = useTelemetry("career.status");
  const career = current(careerReading);
  const [picked, setPicked] = useState<string | null>(null);

  /* Unconditional and above the early returns, so the hook count never changes. */
  const appoint = useCommand(RP1_LEADER_APPOINT_COMMAND);
  const dismiss = useCommand(DISMISS_COMMAND);

  const rows = leaders ?? [];
  const chosen = choose(rows, picked ?? "");

  if (screenId !== LEADERS_SCREEN_ID) {
    return null;
  }
  if (available !== true) {
    return null;
  }

  const strategies = career?.strategies?.all ?? [];
  const entry = strategies.find((s) => s.id === chosen?.strategyId);

  return (
    <Section gap="related-comfortable">
      <SectionTitle>LEADER DETAIL</SectionTitle>
      {/* Reputation, because it is the one currency a leader costs: dismissal
          takes a share of it. */}
      <Stack gap="caption">
        <ReadoutCaption>Reputation</ReadoutCaption>
        <Readout>
          <Unit value={careerReading.economy.reputation} />
        </Readout>
      </Stack>

      {chosen === undefined ? (
        <EmptyState>RP-1 has not sent its leader roster</EmptyState>
      ) : (
        <Grid
          cols={MASTER_DETAIL_COLUMNS}
          gap="related-comfortable"
          align="start"
        >
          <LeaderCatalogue chosen={chosen} leaders={rows} onPick={setPicked} />
          <ChosenLeader
            appoint={appoint}
            dismiss={dismiss}
            entry={entry}
            leader={chosen}
          />
        </Grid>
      )}
    </Section>
  );
}

/** Side by side while there is width for two panes, stacked when there is not. */
const MASTER_DETAIL_COLUMNS = "repeat(auto-fit, minmax(min(15rem, 100%), 1fr))";

/** RP-1 ships sixty leaders, so the catalogue scrolls on its own rather than pushing the detail off the panel. */
const CATALOGUE_SCROLL = { maxHeight: "16rem", overflowY: "auto" } as const;

/** A Row renders an `<li>`. */
const LIST_STYLE = { listStyle: "none", margin: 0, padding: 0 } as const;

type Standing = "serving" | "offered" | "cooldown" | "locked";

/**
 * Where a leader stands, from what RP-1 answered: serving, offered for
 * appointment, waiting out a re-hire cooldown, or not offered at all.
 */
function standingOf(leader: Rp1LeaderEntry): Standing {
  if (leader.active === true) return "serving";
  if (leader.canAppoint === true) return "offered";
  if (leader.rehireFromUt != null) return "cooldown";
  return "locked";
}

const STANDING_ORDER: Record<Standing, number> = {
  serving: 0,
  offered: 1,
  cooldown: 2,
  locked: 3,
};

const STANDING_TONE: Record<Standing, Severity> = {
  serving: "info",
  offered: "go",
  cooldown: "caution",
  locked: "caution",
};

function ordered(leaders: readonly Rp1LeaderEntry[]): Rp1LeaderEntry[] {
  return [...leaders].sort(
    (a, b) => STANDING_ORDER[standingOf(a)] - STANDING_ORDER[standingOf(b)],
  );
}

/** The operator's pick when it still exists, else the first serving leader, else the first row. */
function choose(
  rows: readonly Rp1LeaderEntry[],
  wanted: string,
): Rp1LeaderEntry | undefined {
  const named = rows.find((l) => l.strategyId === wanted && wanted !== "");
  return named ?? ordered(rows)[0];
}

function label(leader: Rp1LeaderEntry): string {
  return leader.title ?? leader.strategyId ?? NULL_DISPLAY;
}

function StandingBadge({ leader }: Readonly<{ leader: Rp1LeaderEntry }>) {
  const standing = standingOf(leader);
  return <Badge tone={STANDING_TONE[standing]}>{standing.toUpperCase()}</Badge>;
}

/**
 * Every leader on the roster, serving ones first, filterable by name or
 * standing, standing open beside the detail of the one picked.
 */
function LeaderCatalogue({
  chosen,
  leaders,
  onPick,
}: Readonly<{
  chosen: Rp1LeaderEntry;
  leaders: readonly Rp1LeaderEntry[];
  onPick: (id: string) => void;
}>) {
  const filter = useRowFilter({
    label: "Filter leaders",
    placeholder: "Name or standing...",
  });
  const shown = ordered(leaders).filter((leader) =>
    filter.matches(`${label(leader)} ${standingOf(leader)}`),
  );

  return (
    <Section gap="caption">
      <SectionTitle>ROSTER</SectionTitle>
      <FilterRegion filter={filter}>
        {shown.length === 0 ? (
          <EmptyState>No leader matches the filter</EmptyState>
        ) : (
          <Stack
            aria-label="Leader roster"
            gap="caption"
            role="group"
            style={CATALOGUE_SCROLL}
          >
            {shown.map((leader) => (
              <SelectableRow
                key={leader.strategyId ?? ""}
                onClick={() => onPick(leader.strategyId ?? "")}
                selected={leader.strategyId === chosen.strategyId}
              >
                <SubjectHeading status={<StandingBadge leader={leader} />}>
                  <Text size="xs">{label(leader)}</Text>
                </SubjectHeading>
              </SelectableRow>
            ))}
          </Stack>
        )}
      </FilterRegion>
    </Section>
  );
}

/** Everything about the leader the operator picked. */
function ChosenLeader({
  appoint,
  dismiss,
  entry,
  leader,
}: Readonly<{
  appoint: Parameters<typeof CommandButton>[0]["handle"];
  dismiss: Parameters<typeof CommandButton>[0]["handle"];
  entry: CareerStrategyEntry | undefined;
  leader: Rp1LeaderEntry;
}>) {
  const effects = effectLines(entry?.effect);
  return (
    <Stack gap="related-comfortable">
      <SubjectHeading status={<StandingBadge leader={leader} />}>
        <Text weight="semibold">{label(leader)}</Text>
      </SubjectHeading>

      {leader.active === true ? (
        <DismissControl entry={entry} handle={dismiss} leader={leader} />
      ) : (
        <AppointControl handle={appoint} leader={leader} />
      )}

      {/* RP-1's own effect lines, which core carries on the strategy entry:
          what the leader changes while it serves, which is the rest of its
          cost. */}
      {effects.length > 0 && (
        <Section>
          <SectionTitle>EFFECTS</SectionTitle>
          <Stack as="ul" gap="rows" style={LIST_STYLE}>
            {effects.map((line) => (
              <Row key={line} wrap>
                <Text>{line}</Text>
              </Row>
            ))}
          </Stack>
        </Section>
      )}
    </Stack>
  );
}

/**
 * The bullet lines of RP-1's effect text, without the Unity rich-text markup
 * it is authored in or its "Effects:" heading.
 */
function effectLines(raw: string | null | undefined): string[] {
  if (raw == null) return [];
  return raw
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !/^effects?:/i.test(line))
    .map((line) => line.replace(/^\*\s*/, ""));
}

/**
 * Appoint, and what it costs: nothing, on every leader RP-1 ships, which is
 * stated rather than left to an absent price. A leader RP-1 would not offer
 * keeps a dark control with RP-1's reason on it and, while it waits out a
 * cooldown, the date it can be hired again.
 */
function AppointControl({
  handle,
  leader,
}: Readonly<{
  handle: Parameters<typeof CommandButton>[0]["handle"];
  leader: Rp1LeaderEntry;
}>) {
  const name = label(leader);
  const offered = leader.canAppoint === true;
  return (
    <Section>
      <SectionTitle>APPOINT</SectionTitle>
      <Cluster gap="related-dense" justify="start" wrap>
        <Text size="sm" level="muted">
          <SetupCost leader={leader} />
        </Text>
        <CommandButton
          args={{ strategyId: leader.strategyId ?? "" }}
          aria-label={offered ? `Appoint ${name}` : undefined}
          commandLabel={`Appoint ${name}`}
          confirmAriaLabel={`Confirm appointing ${name}`}
          confirmLabel={<SetupCost leader={leader} verb />}
          disabled={!offered}
          handle={handle}
          label="Appoint"
          size="sm"
          title={
            offered ? undefined : (leader.appointBlockedReason ?? undefined)
          }
        />
      </Cluster>
      <Stack as="ul" gap="rows" style={LIST_STYLE}>
        {!offered && leader.appointBlockedReason != null && (
          <Row wrap>
            <RowName>Not offered</RowName>
            <Text>{leader.appointBlockedReason}</Text>
          </Row>
        )}
        {leader.rehireFromUt != null && (
          <Row wrap>
            <RowName>Re-hire from</RowName>
            <Text>
              <MissionDate value={leader.rehireFromUt} />
            </Text>
          </Row>
        )}
        <Row wrap>
          <RowName>After dismissal</RowName>
          <Text>
            <AfterDismissal leader={leader} />
          </Text>
        </Row>
      </Stack>
    </Section>
  );
}

/**
 * The setup price RP-1 charges, in each currency it names, or "No cost" when
 * every one is zero. Absent figures say so rather than reading as free.
 */
function SetupCost({
  leader,
  verb = false,
}: Readonly<{ leader: Rp1LeaderEntry; verb?: boolean }>) {
  const parts = [
    leader.setupFunds,
    leader.setupScience,
    leader.setupReputation,
    leader.setupConfidence,
  ];
  if (parts.some((part) => part == null)) {
    return <>{NULL_DISPLAY} RP-1 did not send the setup cost</>;
  }
  const charged = parts.filter((part) => (magnitudeOf(part) ?? 0) !== 0);
  if (charged.length === 0) {
    return <>{verb ? "Appoint for no cost" : "No cost"}</>;
  }
  return (
    <>
      {verb ? "Spend " : ""}
      {charged.map((part, index) => (
        <span key={index}>
          {index > 0 && " + "}
          <Unit value={part} />
        </span>
      ))}
    </>
  );
}

/** What a dismissal leaves: a cooldown before re-hiring, or no way back. */
function AfterDismissal({ leader }: Readonly<{ leader: Rp1LeaderEntry }>) {
  if (leader.removeOnDeactivate === false) {
    return <>can be re-hired at once</>;
  }
  const cooldown = magnitudeOf(leader.reactivateCooldown);
  if (cooldown === null) return <>{NULL_DISPLAY}</>;
  if (cooldown === 0) return <>cannot be hired again</>;
  return (
    <>
      <Unit value={leader.reactivateCooldown} /> before re-hiring
    </>
  );
}

/**
 * Dismiss, and what it costs right now: RP-1's reputation charge, a share of
 * the career's current reputation, with the subsidy per day that reputation
 * pays and the re-hire cooldown it starts. Dark while stock's least duration
 * holds, with core's reason on it.
 */
function DismissControl({
  entry,
  handle,
  leader,
}: Readonly<{
  entry: CareerStrategyEntry | undefined;
  handle: Parameters<typeof CommandButton>[0]["handle"];
  leader: Rp1LeaderEntry;
}>) {
  const name = label(leader);
  const blocked = entry?.canDeactivate === false;
  const costs = (magnitudeOf(leader.deactivateReputation) ?? 0) > 0;
  return (
    <Section>
      <SectionTitle>DISMISS</SectionTitle>
      <Cluster gap="related-dense" justify="start" wrap>
        {/* Named, because reputation renders as a bare count and a bare count
            beside a funds rate reads as funds. */}
        <Text size="sm" level="muted">
          <Unit value={leader.deactivateReputation} /> reputation now, costing{" "}
          <Unit value={leader.dismissSubsidyLossPerDay} /> of subsidy
        </Text>
        <CommandButton
          args={{ strategyId: leader.strategyId ?? "" }}
          aria-label={blocked ? undefined : `Dismiss ${name}`}
          commandLabel={`Dismiss ${name}`}
          confirmAriaLabel={`Confirm dismissing ${name}`}
          confirmLabel={
            <>
              Lose <Unit value={leader.deactivateReputation} /> reputation
            </>
          }
          disabled={blocked}
          handle={handle}
          label="Dismiss"
          size="sm"
          title={
            blocked ? (entry?.deactivateBlockedReason ?? undefined) : undefined
          }
        />
      </Cluster>
      <Stack as="ul" gap="rows" style={LIST_STYLE}>
        {blocked && leader.canRemoveFromUt != null && (
          <Row wrap>
            <RowName>Can dismiss</RowName>
            <Text>
              <MissionDate value={leader.canRemoveFromUt} />
            </Text>
          </Row>
        )}
        {costs && leader.freeToRemoveFromUt != null && (
          <Row wrap>
            <RowName>Free to dismiss</RowName>
            <Text>
              <MissionDate value={leader.freeToRemoveFromUt} />
            </Text>
          </Row>
        )}
        <Row wrap>
          <RowName>After dismissal</RowName>
          <Text>
            <AfterDismissal leader={leader} />
          </Text>
        </Row>
      </Stack>
    </Section>
  );
}

registerAugment({
  id: "rp1-leader-detail",
  augments: "strategies.screen-body",
  component: LeaderDetail,
  channels: [
    "rp1.available",
    "rp1.leaders",
    /* Reputation, the currency a dismissal spends, and the effect lines and
       deactivation verdict core carries per strategy. */
    "career.status",
  ],
  requires: "rp1",
  owner: RP1,
});
