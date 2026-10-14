import {
  type ContributedEntries,
  Contribution,
  Meter,
  MeterStack,
} from "@ksp-gonogo/ui-kit";

function MeterList({ entries }: ContributedEntries<"meters">) {
  return (
    <MeterStack role="group" aria-label="meters">
      {entries.map((entry) => (
        <Meter
          key={entry.id}
          label={entry.label}
          value={entry.value}
          tone={entry.tone}
          valueLabel={entry.valueLabel}
        />
      ))}
    </MeterStack>
  );
}

/** The meters contributed to the mounting widget for one roster row, drawn as the crew status roster draws them. */
export function RowMeters({ row }: { row: string }) {
  return (
    <Contribution
      slot="meters"
      component={MeterList}
      filter={(entry) => entry.row === row}
    />
  );
}
