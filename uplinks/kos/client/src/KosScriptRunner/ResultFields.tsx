import { value as quantity } from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  DataLine,
  EmptyState,
  MissionDate,
  NullValue,
  Tag,
  Unit,
} from "@ksp-gonogo/ui-kit";
import type { ReactNode } from "react";
import { styled } from "styled-components";
import type {
  KosData,
  KosDataValue,
  KosStructuredValue,
} from "../shared/kos-data.js";
import { isStructured } from "../shared/kos-data.js";

/** A number as a reader wants it: whole numbers whole, anything else to four places with no trailing zeros. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(4)));
}

function degrees(angle: number, decimals: number): ReactNode {
  return <Unit value={quantity("°", angle)} decimals={decimals} />;
}

/** The one-line figures a structured value is drawn with, each a label and a reading. */
function figures(value: KosStructuredValue): [string, ReactNode][] | null {
  switch (value.kind) {
    case "vector":
      return [
        ["x", formatNumber(value.x)],
        ["y", formatNumber(value.y)],
        ["z", formatNumber(value.z)],
        ["mag", formatNumber(value.magnitude)],
      ];
    case "direction":
      return [
        ["pitch", degrees(value.pitch, 2)],
        ["yaw", degrees(value.yaw, 2)],
        ["roll", degrees(value.roll, 2)],
      ];
    case "geo":
      return [
        ["lat", degrees(value.latitude, 4)],
        ["lng", degrees(value.longitude, 4)],
      ];
    case "timespan":
      return [
        ["span", <Unit key="span" value={quantity("s", value.seconds)} />],
      ];
    case "timestamp":
      return [["at", <MissionDate key="at" value={value.seconds} />]];
    case "part":
    case "vessel":
      return [
        ["name", value.name],
        ["id", value.id],
      ];
    default:
      return null;
  }
}

function Figures({ value }: { value: KosStructuredValue }) {
  const rows = figures(value);
  if (!rows) return null;
  return (
    <FigureGroup>
      {rows.map(([label, reading]) => (
        <DataLine key={label} label={label}>
          {reading}
        </DataLine>
      ))}
    </FigureGroup>
  );
}

function Composite({
  kind,
  count,
  leaf,
  children,
}: {
  kind: string;
  count?: string;
  /** Draws the type and its figures on one line, for a value with no rows of its own. */
  leaf?: boolean;
  children?: ReactNode;
}) {
  const head = (
    <CompositeHead>
      <Tag label={kind} />
      {count && <Faint>{count}</Faint>}
    </CompositeHead>
  );
  if (leaf) {
    return (
      <LeafBlock>
        {head}
        {children}
      </LeafBlock>
    );
  }
  return (
    <CompositeBlock>
      {head}
      {children}
    </CompositeBlock>
  );
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function omittedRow(omitted: number): ReactNode {
  return omitted > 0 ? <Faint>+{omitted} more</Faint> : null;
}

export function ValueView({ value }: { value: KosDataValue }): ReactNode {
  if (value === null) return <NullValue />;
  if (typeof value === "number") return <Num>{formatNumber(value)}</Num>;
  if (typeof value === "boolean") {
    return (
      <Badge size="sm" tone={value ? "go" : undefined}>
        {value ? "TRUE" : "FALSE"}
      </Badge>
    );
  }
  if (typeof value === "string") {
    return value === "" ? <Faint>{'""'}</Faint> : <Str>{value}</Str>;
  }
  return <StructuredView value={value} />;
}

function StructuredView({ value }: { value: KosStructuredValue }): ReactNode {
  switch (value.kind) {
    case "list":
      return (
        <Composite
          kind={value.type}
          count={
            value.items.length === 0
              ? "empty"
              : count(value.items.length + value.omitted, "item", "items")
          }
        >
          {value.items.length > 0 && (
            <Rows
              rows={value.items.map((item, i) => ({
                key: `[${i}]`,
                value: item,
              }))}
            />
          )}
          {omittedRow(value.omitted)}
        </Composite>
      );
    case "lexicon":
      return (
        <Composite
          kind="lexicon"
          count={
            value.entries.length === 0
              ? "empty"
              : count(value.entries.length + value.omitted, "entry", "entries")
          }
        >
          {value.entries.length > 0 && <Rows rows={value.entries} />}
          {omittedRow(value.omitted)}
        </Composite>
      );
    case "other":
      return (
        <Composite kind={value.type} leaf>
          <Str>{value.text}</Str>
        </Composite>
      );
    default:
      return (
        <Composite kind={value.kind} leaf>
          <Figures value={value} />
        </Composite>
      );
  }
}

function Rows({ rows }: { rows: { key: string; value: KosDataValue }[] }) {
  return (
    <List>
      {rows.map((row, i) => (
        <Pair key={`${i}:${row.key}`}>
          <Key>{row.key}</Key>
          <Reading>
            <ValueView value={row.value} />
          </Reading>
        </Pair>
      ))}
    </List>
  );
}

/**
 * What a script handed back with `ADDONS:GONOGO:RETURN`, as one row per field.
 * A value with structure draws as a typed block under its key: a lexicon as
 * its own rows, a list by index, a vector, direction, position or time by its
 * figures.
 */
export function ResultFields({ data }: { data: KosData }) {
  const rows = Object.entries(data).map(([key, value]) => ({ key, value }));
  if (rows.length === 0) return <EmptyState>No fields returned.</EmptyState>;
  return <Rows rows={rows} />;
}

const List = styled.dl`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: var(--gap-related-comfortable, 12px);
  row-gap: var(--gap-related);
  align-items: baseline;
  margin: 0;
  min-width: 0;
  font-size: var(--font-size-compact);
`;

const Pair = styled.div`
  display: contents;
`;

const Key = styled.dt`
  font-family: var(--font-family-mono, monospace);
  color: var(--color-text-muted);
  overflow-wrap: anywhere;
`;

const Reading = styled.dd`
  margin: 0;
  min-width: 0;
  color: var(--color-text-primary);
`;

const Num = styled.span`
  font-family: var(--font-family-mono, monospace);
  font-variant-numeric: tabular-nums;
`;

const Str = styled.span`
  font-family: var(--font-family-mono, monospace);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

const Faint = styled.span`
  color: var(--color-text-faint);
  font-size: var(--font-size-compact);
`;

const CompositeBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--gap-related);
  padding-left: var(--gap-related);
  border-left: 1px solid var(--color-border-subtle);
`;

const LeafBlock = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: var(--gap-related);
  row-gap: var(--gap-related-dense, 2px);
`;

const CompositeHead = styled.div`
  display: flex;
  align-items: center;
  gap: var(--gap-related);
`;

const FigureGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  column-gap: var(--gap-related);
`;

/** A value in one line, for a history row: a scalar as itself, anything with structure by its kind and size. */
export function summarize(value: KosDataValue): string {
  if (value === null) return "null";
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "string") return value === "" ? '""' : value;
  switch (value.kind) {
    case "list":
      return `${value.type.toUpperCase()} of ${value.items.length + value.omitted}`;
    case "lexicon":
      return `LEXICON of ${value.entries.length + value.omitted}`;
    case "vector":
      return `V(${formatNumber(value.x)}, ${formatNumber(value.y)}, ${formatNumber(value.z)})`;
    case "direction":
      return `R(${formatNumber(value.pitch)}, ${formatNumber(value.yaw)}, ${formatNumber(value.roll)})`;
    case "geo":
      return `LATLNG(${formatNumber(value.latitude)}, ${formatNumber(value.longitude)})`;
    case "timespan":
    case "timestamp":
      return `${value.kind.toUpperCase()}(${formatNumber(value.seconds)})`;
    case "part":
    case "vessel":
      return `${value.kind.toUpperCase()} ${value.name}`;
    default:
      return value.text;
  }
}
