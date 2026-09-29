import {
  combineReadings,
  type FieldReading,
  isValue,
  type Reading,
  registerAugment,
  type TopicReading,
  useTelemetry,
  type Value,
  value,
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  Cluster,
  DataTable,
  type DataTableColumn,
  Disclosure,
  EmptyState,
  MissionDate,
  magnitudeOf,
  Section,
  Stat,
  StatStrip,
  ToggleButton,
  Unit,
  useElementSize,
  VisuallyHidden,
} from "@ksp-gonogo/ui-kit";
import type { ReactNode } from "react";
import { useState } from "react";
import type {
  Rp1Budget,
  Rp1BudgetBreakdown,
  Rp1BudgetHorizons,
  Rp1BudgetPeriod,
} from "../__generated__/contract.js";
import { FINANCES_SCREEN_ID } from "../AdminBuilding/financesScreen.js";
import { latest } from "../shared/current.js";
import { facilityLabel } from "../shared/facilityLabels.js";
import { RP1 } from "../uplink.js";
import "../topics.js";

type Period = "day" | "month" | "year";

const PERIODS: readonly { id: Period; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];

/** Below this width the Budget table shows one period, picked by the operator. */
const ALL_PERIODS_MIN_WIDTH = 460;

/** A Julian year, the span RP-1's Year column and forecast step are built on. */
const JULIAN_YEAR = 31_557_600;

type Funds = Value<"funds">;
type FundsReading = Reading<Funds>;
type Amount = Funds | FundsReading | null | undefined;
type PeriodKey = Exclude<keyof Rp1BudgetPeriod, "span">;
type Drill = "facilities" | "astronauts" | "programs";
type BudgetReading = TopicReading<Rp1Budget>;
type BreakdownReading = TopicReading<Rp1BudgetBreakdown>;

interface BudgetRow {
  id: string;
  label: string;
  /** The same row under each period: a wire reading, or a figure derived from them. */
  at: (period: Period) => FundsReading;
  drill?: Drill;
  /** Money RP-1 does not pay out, drawn unsigned so it never reads as income. */
  unsigned?: boolean;
}

const RP1_ROWS: readonly { key: PeriodKey; label: string; drill?: Drill }[] = [
  { key: "facilities", label: "Facilities", drill: "facilities" },
  { key: "integrationTeams", label: "Integration Teams" },
  { key: "researchTeams", label: "Research Teams" },
  { key: "astronauts", label: "Astronauts", drill: "astronauts" },
  { key: "upkeep", label: "Total upkeep" },
  { key: "subsidy", label: "Avg. Subsidy" },
  { key: "net", label: "Net (after subsidy)" },
  { key: "rollout", label: "Rollout / Airlaunch Prep" },
  { key: "constructions", label: "Constructions" },
  { key: "programBudget", label: "Program Budget", drill: "programs" },
  { key: "balance", label: "Balance" },
  { key: "unlockCredit", label: "Unlock Credit" },
];

/**
 * RP-1's finances: its own net over a day, a month and a year, the Budget tab's
 * rows with the lines under them, what leaders and strategies change in upkeep,
 * the subsidy reputation buys, Unlock Credit, and the forecast to five years.
 *
 * <para>The body of the Administration Building's Finances screen. It draws no
 * funds balance: the building's balance rail sits directly above the tabs.</para>
 *
 * <para>Every figure is handed to the kit as its reading, so while RP-1 is not
 * being heard the last budget it sent stays up with each figure marked held.</para>
 */
export function Finances({ screenId }: { screenId: string }) {
  const availableReading = useTelemetry("rp1.available");
  const available = latest(availableReading);
  const budgetReading = useTelemetry("rp1.budget");
  const budget = latest(budgetReading);
  const breakdownReading = useTelemetry("rp1.budgetBreakdown");
  const training = latest(useTelemetry("rp1.training"));
  const research = latest(useTelemetry("rp1.research"));

  const { ref, size } = useElementSize<HTMLDivElement>({
    w: 1024,
    h: 0,
  });
  const [picked, setPicked] = useState<Period>("month");

  if (screenId !== FINANCES_SCREEN_ID) {
    return null;
  }
  if (available !== true) {
    return null;
  }

  const periods: readonly Period[] =
    size.w < ALL_PERIODS_MIN_WIDTH ? [picked] : ["day", "month", "year"];

  return (
    <div ref={ref}>
      {budget === undefined ? (
        <EmptyState>
          {availableReading.state === "held"
            ? "RP-1 had sent no budget when the link dropped"
            : "RP-1 has not sent a budget"}
        </EmptyState>
      ) : (
        <Section gap="section-compact">
          <FundsChange budget={budgetReading} />
          <Section gap="related-dense" title="BUDGET">
            {periods.length === 1 && (
              <PeriodPicker picked={picked} onPick={setPicked} />
            )}
            <BudgetTable
              breakdown={breakdownReading}
              budget={budgetReading}
              courseNames={namesById(training, "id")}
              periods={periods}
            />
          </Section>
          <Modifiers budget={budgetReading} />
          <Reputation budget={budgetReading} />
          <UnlockCredit
            budget={budgetReading}
            researchIdle={research !== undefined && research.length === 0}
          />
          <Forecast budget={budgetReading} />
        </Section>
      )}
    </div>
  );
}

/** RP-1's own net at each horizon, named rather than signed. */
function FundsChange({ budget }: Readonly<{ budget: BudgetReading }>) {
  return (
    <Section gap="related-dense" title="FUNDS CHANGE">
      <StatStrip>
        {PERIODS.map(({ id, label }) => {
          const delta = budget[id].fundsDelta;
          const size = unsignedOf(delta);
          const sign = magnitudeOf(delta.value);
          return (
            <Stat
              detail={sign === null ? undefined : sign < 0 ? "Drain" : "Gain"}
              key={id}
              label={label}
            >
              <Unit value={size} />
            </Stat>
          );
        })}
      </StatStrip>
    </Section>
  );
}

function PeriodPicker({
  picked,
  onPick,
}: Readonly<{ picked: Period; onPick: (period: Period) => void }>) {
  return (
    <Cluster
      aria-label="Budget period"
      gap="related-dense"
      justify="start"
      role="group"
    >
      {PERIODS.map(({ id, label }) => (
        <ToggleButton
          active={picked === id}
          key={id}
          onClick={() => onPick(id)}
          size="sm"
        >
          {label}
        </ToggleButton>
      ))}
    </Cluster>
  );
}

function BudgetTable({
  budget,
  breakdown,
  periods,
  courseNames,
}: Readonly<{
  budget: BudgetReading;
  breakdown: BreakdownReading;
  periods: readonly Period[];
  courseNames: ReadonlyMap<string, string>;
}>) {
  const rows: BudgetRow[] = RP1_ROWS.map(({ key, label, drill }) => ({
    id: key,
    label,
    at: (period: Period) => budget[period][key] as FundsReading,
    drill,
  }));

  const unused = (period: Period) => unusedSubsidy(budget[period]);
  const clampBit = periods.some((p) => (magnitudeOf(unused(p).value) ?? 0) > 0);
  if (clampBit) {
    const netAt = rows.findIndex((row) => row.id === "net");
    rows.splice(netAt + 1, 0, {
      id: "unusedSubsidy",
      label: "Unused subsidy",
      at: unused,
      unsigned: true,
    });
  }

  const columns: DataTableColumn<BudgetRow>[] = [
    {
      key: "row",
      header: <VisuallyHidden>Row</VisuallyHidden>,
      rowHeader: true,
      render: (row) => row.label },
    ...periods.map(
      (period): DataTableColumn<BudgetRow> => ({
        key: period,
        header: periodLabel(period),
        align: "end",
        render: (row) =>
          row.unsigned ? (
            <Unit value={row.at(period)} />
          ) : (
            <Signed amount={row.at(period)} />
          ),
      }),
    ),
  ];

  return (
    <DataTable
      caption="RP-1 budget by period"
      columns={columns}
      rowDetail={(row) =>
        row.drill === undefined || latest(breakdown) === undefined ? null : (
          <DrillDown
            breakdown={breakdown}
            courseNames={courseNames}
            drill={row.drill}
            periods={periods}
          />
        )
      }
      rowKey={(row) => row.id}
      rows={rows}
    />
  );
}

type Horizons = FieldReading<Rp1BudgetHorizons>;

interface Line {
  id: string;
  label: ReactNode;
  amounts: Horizons;
}

/** The lines under one Budget row, from `rp1.budgetBreakdown`. */
function DrillDown({
  drill,
  breakdown,
  periods,
  courseNames,
}: Readonly<{
  drill: Drill;
  breakdown: BreakdownReading;
  periods: readonly Period[];
  courseNames: ReadonlyMap<string, string>;
}>) {
  const { lines, summary } = linesFor(drill, breakdown, courseNames);
  if (lines.length === 0) {
    return null;
  }

  const columns: DataTableColumn<Line>[] = [
    {
      key: "line",
      header: <VisuallyHidden>Line</VisuallyHidden>,
      rowHeader: true,
      render: (line) => line.label },
    ...periods.map(
      (period): DataTableColumn<Line> => ({
        key: period,
        header: periodLabel(period),
        align: "end",
        render: (line) => (
          <Signed amount={line.amounts[period] as FundsReading} />
        ),
      }),
    ),
  ];

  return (
    <Disclosure asButton chevron={false} label={summary} variant="inline">
      <DataTable
        caption={summary}
        columns={columns}
        rowKey={(line) => line.id}
        rows={lines}
      />
    </Disclosure>
  );
}

/**
 * The lines under one Budget row. Labels come from the payload and amounts from
 * the same reading's fields, so a held line keeps its mark.
 */
function linesFor(
  drill: Drill,
  reading: BreakdownReading,
  courseNames: ReadonlyMap<string, string>,
): { lines: Line[]; summary: string } {
  const breakdown = latest(reading) ?? {};
  if (drill === "facilities") {
    const buildings = breakdown.buildings ?? [];
    const complexes = breakdown.complexes ?? [];
    // RP-1's Facilities tab heads each centre's complexes with the centre's
    // name. One centre needs no heading, and two can each have an LC-1.
    const centres = new Set(complexes.map((c) => c.kscName));
    const named = (c: (typeof complexes)[number]) =>
      centres.size > 1
        ? `${c.name} · ${c.kscDisplayName ?? c.kscName}`
        : c.name;
    return {
      summary: `${count(buildings.length, "building")}, ${count(complexes.length, "complex", "complexes")}`,
      lines: [
        ...buildings.map((b, i) => ({
          id: `building:${b.facility ?? i}`,
          label: facilityLabel(b.facility ?? ""),
          amounts: reading.buildings[i].upkeep,
        })),
        ...complexes.map((c, i) => ({
          id: `complex:${c.lcId ?? i}`,
          label:
            c.operational === false ? (
              <>
                {named(c)} <Badge tone="info">UNDER CONSTRUCTION</Badge>
              </>
            ) : (
              named(c)
            ),
          amounts: reading.complexes[i].upkeep,
        })),
      ],
    };
  }
  if (drill === "astronauts") {
    const crew = breakdown.crew ?? [];
    const courses = breakdown.courses ?? [];
    // RP-1's Astronauts tab closes on these three, the row's own parts.
    const subtotal = (
      key: "astronautBase" | "astronautOperational" | "astronautTraining",
      label: string,
    ): Line[] =>
      breakdown[key] == null ? [] : [{ id: key, label, amounts: reading[key] }];
    return {
      summary: `${count(crew.length, "crew member")}, ${count(courses.length, "course")}`,
      lines: [
        ...crew.map((k, i) => ({
          id: `crew:${k.name ?? i}`,
          label:
            k.inFlight === true ? (
              <>
                {k.name} <Badge tone="info">IN FLIGHT</Badge>
              </>
            ) : (
              k.name
            ),
          amounts: reading.crew[i].cost,
        })),
        ...subtotal("astronautBase", "Astronaut base cost"),
        ...subtotal("astronautOperational", "Astronaut operational cost"),
        ...courses.map((c, i) => ({
          id: `course:${c.id ?? i}`,
          label: (
            <>
              {courseNames.get(c.id ?? "") ?? c.id} ·{" "}
              <Unit value={c.students} /> students
            </>
          ),
          amounts: reading.courses[i].cost,
        })),
        ...subtotal("astronautTraining", "Astronaut training cost"),
      ],
    };
  }
  const running = breakdown.programs ?? [];
  return {
    summary: count(running.length, "Program"),
    lines: running.map((p, i) => ({
      id: `program:${p.name ?? i}`,
      label: (
        <>
          {p.title ?? p.name}
          {p.deadlineUt != null && (
            <>
              {" · deadline "}
              <MissionDate value={p.deadlineUt} />
            </>
          )}
        </>
      ),
      amounts: reading.programs[i].funding,
    })),
  };
}

/**
 * What the career's leaders and strategies change in upkeep a day, beside the
 * upkeep as it would be without them. Both are RP-1's figures, carried whole,
 * and named rather than signed as the funds change is.
 */
function Modifiers({ budget }: Readonly<{ budget: BudgetReading }>) {
  const change = budget.day.upkeepModifiers as FundsReading;
  const sign = magnitudeOf(change.value);
  return (
    <Section gap="related-dense" title="MODIFIERS">
      <StatStrip>
        <Stat label="Upkeep before modifiers, day">
          <Unit
            value={unsignedOf(budget.day.upkeepBeforeModifiers as FundsReading)}
          />
        </Stat>
        <Stat
          detail={
            sign === null || sign === 0 ? undefined : sign > 0 ? "Saved" : "Added"
          }
          label="Leaders and strategies, day"
        >
          <Unit value={unsignedOf(change)} />
        </Stat>
      </StatStrip>
    </Section>
  );
}

/** The subsidy the reputation buys, its floor and cap, and what reputation loses. */
function Reputation({ budget }: Readonly<{ budget: BudgetReading }>) {
  return (
    <Section gap="related-dense" title="REPUTATION AND SUBSIDY">
      <StatStrip>
        <Stat label="Subsidy">
          <Unit value={budget.subsidyPerDay} />
        </Stat>
        <Stat label="Floor">
          <Unit value={budget.subsidyMinPerDay} />
        </Stat>
        <Stat label="Cap">
          <Unit value={budget.subsidyMaxPerDay} />
        </Stat>
        <Stat label="Cap reached at">
          <Unit value={budget.subsidyMaxRep} />
        </Stat>
        <Stat label="Decay">
          <Unit value={budget.reputationDecayPerDay} />
        </Stat>
        <Stat label="Decay, year">
          <Unit value={budget.reputationDecayPerYear} />
        </Stat>
      </StatStrip>
    </Section>
  );
}

function UnlockCredit({
  budget,
  researchIdle,
}: Readonly<{ budget: BudgetReading; researchIdle: boolean }>) {
  const accrual = budget.day.unlockCredit;
  const idle = researchIdle && magnitudeOf(accrual.value) === 0;
  return (
    <Section gap="related-dense" title="UNLOCK CREDIT">
      <StatStrip>
        <Stat label="Balance">
          <Unit value={budget.unlockCreditBalance} />
        </Stat>
        <Stat
          detail={idle ? "research queue idle" : undefined}
          label="Accrual, day"
        >
          <Unit value={accrual} />
        </Stat>
      </StatStrip>
    </Section>
  );
}

/** RP-1's net at each whole year to five, the furthest it forecasts. */
function Forecast({ budget }: Readonly<{ budget: BudgetReading }>) {
  const samples = latest(budget)?.forecast ?? [];
  const years = samples.flatMap((sample, i) => {
    const horizon = magnitudeOf(sample.horizon);
    if (horizon === null) return [];
    const year = horizon / JULIAN_YEAR;
    if (Math.abs(year - Math.round(year)) > 1e-6) return [];
    return [{ year: Math.round(year), change: budget.forecast[i].fundsDelta }];
  });

  type Point = (typeof years)[number];
  const columns: DataTableColumn<Point>[] = [
    {
      key: "horizon",
      header: "Years ahead",
      rowHeader: true,
      render: (p) => <Unit value={value("count", p.year)} />,
    },
    {
      key: "change",
      header: "Funds change",
      align: "end",
      render: (p) => <Signed amount={p.change as FundsReading} />,
    },
  ];

  return (
    <Section gap="related-dense" title="FORECAST">
      <DataTable
        caption="RP-1 funds forecast"
        columns={columns}
        empty={<EmptyState>RP-1 would not forecast</EmptyState>}
        rowKey={(p) => String(p.year)}
        rows={years}
      />
    </Section>
  );
}

/**
 * A funds change as RP-1 prints it: a cost in parentheses, a gain with a plus.
 */
function Signed({ amount }: Readonly<{ amount: Amount }>) {
  const raw = isValue(amount) ? amount : amount?.value;
  const sign = magnitudeOf(raw);
  const shown = <Unit value={unsignedOf(amount)} />;
  if (sign === null || sign === 0) return shown;
  if (sign < 0) return <>({shown})</>;
  return <>+{shown}</>;
}

function unsignedOf(amount: Amount): Funds | FundsReading | null | undefined {
  if (amount === null || amount === undefined) return amount;
  if (isValue(amount)) return amount.abs() as Funds;
  return combineReadings([amount], (v) => v.abs() as Funds);
}

/** The subsidy the Net row's clamp withheld: zero whenever the clamp did not bite. */
function unusedSubsidy(period: BudgetReading["day"]): FundsReading {
  return combineReadings(
    [
      period.facilities,
      period.integrationTeams,
      period.researchTeams,
      period.astronauts,
      period.subsidy,
    ],
    (...rows) =>
      value(
        "funds",
        Math.max(
          0,
          rows.reduce((sum, row) => sum + row.magnitude, 0),
        ),
      ),
  );
}

function periodLabel(period: Period): string {
  return PERIODS.find((p) => p.id === period)?.label ?? period;
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function namesById<T extends object>(
  rows: readonly T[] | undefined,
  key: keyof T,
  label: keyof T = "name" as keyof T,
): ReadonlyMap<string, string> {
  return new Map(
    (rows ?? []).flatMap((row) => {
      const id = row[key];
      const name = row[label];
      return typeof id === "string" && typeof name === "string"
        ? [[id, name] as const]
        : [];
    }),
  );
}

registerAugment({
  id: "rp1-finances",
  augments: "strategies.screen-body",
  component: Finances,
  channels: [
    "rp1.available",
    "rp1.budget",
    "rp1.budgetBreakdown",
    "rp1.training",
    "rp1.research",
  ],
  requires: "rp1",
  owner: RP1,
});
