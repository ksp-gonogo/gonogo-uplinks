import { Badge, Tag } from "@ksp-gonogo/ui-kit";
import { styled } from "styled-components";
import type { KosLogEntry } from "../__generated__/contract.js";
import type { KosDataValue } from "../shared/kos-data.js";
import { summarize, ValueView } from "./ResultFields.js";

/** Entries kept for one run; the oldest go first. */
export const LOG_KEPT = 200;

/** Entries listed under the latest value. */
export const LOG_SHOWN = 10;

/**
 * The entries of a run in `seq` order, with `entry` added. An entry that
 * arrives late (its channel is not ordered against the run's result) slots in
 * by its `seq`; one already held is not added twice.
 */
export function withEntry(
  entries: readonly KosLogEntry[],
  entry: KosLogEntry,
): KosLogEntry[] {
  if (entries.some((e) => e.seq === entry.seq)) return [...entries];
  const next = [...entries, entry].sort((a, b) => a.seq - b.seq);
  return next.length > LOG_KEPT ? next.slice(next.length - LOG_KEPT) : next;
}

/**
 * What a running script handed to `ADDONS:GONOGO:LOG`: the latest value in
 * full, then the last few as one line each, newest first.
 */
export function LogStream({
  entries,
  dropped,
}: {
  entries: readonly KosLogEntry[];
  dropped: number;
}) {
  if (entries.length === 0) return null;
  const latest = entries[entries.length - 1];
  const history = entries.slice(-LOG_SHOWN).reverse();
  return (
    <Block aria-label="Log">
      <Head>
        <Tag label="log" />
        <Faint>{entries.length === 1 ? "1 value" : `${entries.length} values`}</Faint>
        {dropped > 0 && <Badge size="sm" tone="warn">{dropped} dropped</Badge>}
      </Head>
      <Latest>
        <ValueView value={latest.value as KosDataValue} />
      </Latest>
      <History>
        {history.map((entry) => (
          <HistoryRow key={entry.seq}>
            <Seq>#{entry.seq}</Seq>
            <Line>{summarize(entry.value as KosDataValue)}</Line>
          </HistoryRow>
        ))}
      </History>
    </Block>
  );
}

const Block = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--gap-related);
  padding-bottom: var(--gap-related);
  border-bottom: 1px solid var(--color-border-subtle);
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: var(--gap-related);
`;

const Faint = styled.span`
  font-size: var(--font-size-compact);
  color: var(--color-text-muted);
`;

const Latest = styled.div`
  font-size: var(--font-size-compact);
`;

const History = styled.ul`
  display: flex;
  flex-direction: column;
  gap: var(--gap-related-dense, 2px);
  margin: 0;
  padding: 0;
  list-style: none;
`;

const HistoryRow = styled.li`
  display: flex;
  gap: var(--gap-related);
  font-family: var(--font-family-mono, monospace);
  font-size: var(--font-size-compact);
  color: var(--color-text-muted);
`;

const Seq = styled.span`
  min-width: 4ch;
  color: var(--color-text-faint);
`;

const Line = styled.span`
  overflow-wrap: anywhere;
`;
