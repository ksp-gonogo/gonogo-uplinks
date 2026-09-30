import type { CrewMember } from "@ksp-gonogo/sitrep-sdk";
import { useCommand } from "@ksp-gonogo/sitrep-sdk";
import {
  Button,
  Cluster,
  CommandButton,
  SelectableRow,
  Stack,
  Text,
} from "@ksp-gonogo/ui-kit";
import { useState } from "react";
import { type CostLine, carriedOf, mayAct, verbFor } from "./repair.js";

/** "2 × EVA Repair Kit", for every line of the stated cost. */
function costWords(cost: readonly CostLine[]): string {
  return cost.map((line) => `${line.needed} × ${line.label}`).join(", ");
}

/** Why Kerbalism would refuse, stated before sending it, or null when nothing known stands in the way. */
function refusalFor(
  eligibleCount: number,
  requirement: string | null,
  short: { needed: number; label: string; reachable: number } | undefined,
): string | null {
  if (eligibleCount === 0 && requirement) {
    return `Needs ${requirement}, and nobody aboard qualifies`;
  }
  if (eligibleCount === 0) return "Nobody is aboard to do it";
  if (short) {
    return `Needs ${short.needed} ${short.label}, and ${short.reachable} can be reached`;
  }
  return null;
}

/**
 * The action for one part: repair a failure, or clear a service. Collapsed
 * until asked, so a row does not become a form, but the cost is beside the
 * button even then, in the repair kits Kerbalism actually takes. Every known
 * refusal is shown on a disabled control, since under delay each costs a round
 * trip.
 */
export function RepairControl({
  partId,
  condition,
  repairTrait,
  repairLevel,
  crew,
  cost,
}: {
  partId: string;
  condition: string | null | undefined;
  repairTrait: string | null | undefined;
  repairLevel: number | null | undefined;
  crew: readonly CrewMember[];
  cost: readonly CostLine[];
}) {
  const repair = useCommand("kerbalism.repair");
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);

  const verb = verbFor(condition);
  const price = cost.length > 0 ? `Costs ${costWords(cost)}` : null;

  // Default to whoever can act with NO fetch, ranked on the first stated item; with no cost stated, roster order stands.
  const rankOn = cost[0]?.name;
  const eligible = crew.filter((c) => mayAct(c, repairTrait, repairLevel));
  const readiest = rankOn
    ? eligible
        .slice()
        .sort((a, b) => carriedOf(b, rankOn) - carriedOf(a, rankOn))[0]
    : eligible[0];
  const performer = chosen ?? readiest?.name ?? null;
  const acting = eligible.find((c) => c.name === performer);

  const lines = cost.map((line) => {
    const carried = acting ? carriedOf(acting, line.name) : 0;
    return { ...line, carried, reachable: carried + line.reserve };
  });
  const short = lines.find((line) => line.reachable < line.needed);

  const requirement = repairTrait
    ? `${repairTrait}${repairLevel != null ? ` level ${repairLevel}` : ""}`
    : null;
  const refusal = refusalFor(eligible.length, requirement, short);

  if (!open) {
    return (
      <Cluster justify="start" align="baseline">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          {verb}
        </Button>
        {price && <Text level="muted">{price}</Text>}
      </Cluster>
    );
  }

  return (
    <Stack>
      {lines.map((line) => (
        <span key={line.name}>
          {`${line.needed} × ${line.label} · ${line.carried} carried · ${line.reserve} aboard`}
        </span>
      ))}
      {eligible.map((member) => (
        <SelectableRow
          key={member.name ?? "unknown"}
          selected={member.name === performer}
          onClick={() => setChosen(member.name ?? null)}
        >
          {rankOn
            ? `${member.name ?? "Unknown"} · ${carriedOf(member, rankOn)} carried`
            : (member.name ?? "Unknown")}
        </SelectableRow>
      ))}
      {refusal && <span>{refusal}</span>}
      <CommandButton
        handle={repair}
        args={{ partId, crewName: performer ?? "" }}
        size="sm"
        commandLabel={`${verb} with ${performer ?? "nobody"}`}
        label={verb}
        confirmLabel={price ? `Confirm, ${price.toLowerCase()}` : "Confirm"}
        pendingLabel={`${verb}...`}
        disabled={refusal !== null}
        title={refusal ?? undefined}
      />
    </Stack>
  );
}
