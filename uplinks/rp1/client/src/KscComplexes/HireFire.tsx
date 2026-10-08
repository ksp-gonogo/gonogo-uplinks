import { value } from "@ksp-gonogo/sitrep-sdk";
import {
  Cluster,
  CommandButton,
  Disclosure,
  magnitudeOf,
  Row,
  Stack,
  Switch,
  Text,
  Unit,
  UnitInput,
} from "@ksp-gonogo/ui-kit";
import { useState } from "react";
import type {
  Rp1CentreEntry,
  Rp1Personnel,
} from "../__generated__/contract.js";
import { HireSpend } from "./HireTarget.js";

/** Hire by a count. Must match `Rp1PersonnelCommands.HireCommand`. */
export const RP1_PERSONNEL_HIRE_COMMAND = "rp1.personnel.hire";

/** Fire by a count. Must match `Rp1PersonnelCommands.FireCommand`. */
export const RP1_PERSONNEL_FIRE_COMMAND = "rp1.personnel.fire";

/**
 * Hire or fire staff now, by a count: the two buttons of RP-1's Staffing window.
 *
 * <para><b>Hiring is paid up front and refused on affordability</b>, so the
 * one-off cost is stated against the balance and the press is darkened when the
 * balance does not cover it. The cost is applicant-netted, because RP-1 hires
 * waiting applicants free. <b>Firing costs nothing</b>; what it changes is the
 * payroll, so both halves carry the salary per day they add or save.</para>
 *
 * <para><b>Engineers are hired into and fired from the active centre's
 * unassigned pool</b>, as RP-1's own window does, so the engineer half names
 * that centre and a pooled engineer's salary is the idle fraction. Assigning
 * them to a complex is the crew stepper on each complex card.</para>
 *
 * <para>Absent on a save with no funding, where RP-1 draws no hire or fire
 * either.</para>
 */
export function HireFireControl({
  centres,
  fire,
  funds,
  hire,
  personnel,
}: Readonly<{
  centres: readonly Rp1CentreEntry[];
  fire: Parameters<typeof CommandButton>[0]["handle"];
  /** The career balance. Null takes the whole control off. */
  funds: number | null;
  hire: Parameters<typeof CommandButton>[0]["handle"];
  personnel: Rp1Personnel | undefined;
}>) {
  const [research, setResearch] = useState(true);
  const [wanted, setWanted] = useState(value("count", 1));

  if (funds === null) {
    return null;
  }

  const active = centres.find((centre) => centre.isActive === true);
  const activeName = active?.kscDisplayName ?? active?.kscName;
  const engineers = !research && active?.kscName != null;
  const kind = engineers ? "engineers" : "researchers";
  const where = engineers ? ` at ${activeName}` : "";

  const count = Math.max(0, Math.round(magnitudeOf(wanted) ?? 0));
  const firable = engineers
    ? magnitudeOf(active?.unassignedEngineers)
    : magnitudeOf(personnel?.researchers);
  const perHead = magnitudeOf(
    engineers
      ? personnel?.pooledEngineerSalaryPerDay
      : personnel?.researcherSalaryPerHeadPerDay,
  );
  const salary = perHead === null ? null : count * perHead;

  const charge = magnitudeOf(personnel?.hireCost);
  const applicants = magnitudeOf(personnel?.applicants) ?? 0;
  const cost =
    charge === null ? null : Math.max(0, count - applicants) * charge;
  const short = cost !== null && cost > funds;
  const tooMany = firable !== null && count > firable;

  const args = engineers
    ? { count, kscName: active?.kscName ?? "", research: false }
    : { count, research: true };
  const hirePress = `Hire ${count} ${kind}${where}`;
  const firePress = `Fire ${count} ${kind}${where}`;

  return (
    <Disclosure
      aria-label="Hire or fire staff"
      asButton
      buttonSize="sm"
      chevron={false}
      label={(open: boolean) => (open ? "Hide hire or fire" : "Hire or fire")}
      panelHeight="auto"
      variant="inline"
    >
      <Stack gap="related-dense">
        <Cluster gap="related-packed" wrap>
          <Switch
            checked={!engineers}
            label="researchers"
            onChange={() => setResearch(true)}
          />
          {active?.kscName != null && (
            <Switch
              checked={engineers}
              label={`engineers at ${activeName}`}
              onChange={() => setResearch(false)}
            />
          )}
        </Cluster>

        <UnitInput
          label="How many"
          onChange={setWanted}
          unit="count"
          value={wanted}
        />

        {/* Hire: the one-off cost against the balance, then the payroll it adds. */}
        <HireSpend
          isResearch={!engineers}
          leftToHire={count}
          personnel={personnel}
        />
        <Row as="div">
          <Text size="xs" level="muted">
            {cost === null ? null : (
              <>
                <Unit decimals={0} value={value("funds", cost)} /> of{" "}
                <Unit decimals={0} value={value("funds", funds)} /> ·{" "}
              </>
            )}
            <SalaryDelta sign="+" salary={salary} />
          </Text>
          <CommandButton
            args={args}
            aria-label={hirePress}
            commandLabel={hirePress}
            confirmAriaLabel={`Confirm hiring ${count} ${kind}${where}`}
            confirmLabel="Confirm"
            disabled={count <= 0 || short}
            handle={hire}
            label="Hire"
            size="sm"
          />
        </Row>
        {short && (
          <Text size="xs" tone="warn">
            more than the balance, so RP-1 will refuse it
          </Text>
        )}

        {/* Fire: no fee, and the payroll it saves. */}
        <Row as="div">
          <Text size="xs" level="muted">
            no fee · <SalaryDelta sign="-" salary={salary} />
          </Text>
          <CommandButton
            args={args}
            aria-label={firePress}
            commandLabel={firePress}
            confirmAriaLabel={`Confirm firing ${count} ${kind}${where}`}
            confirmLabel="Confirm"
            disabled={count <= 0 || tooMany}
            handle={fire}
            label="Fire"
            size="sm"
          />
        </Row>
        {tooMany && (
          <Text size="xs" tone="warn">
            {engineers ? (
              <>
                only <Unit value={value("count", firable ?? 0)} /> unassigned
                {where} can be fired
              </>
            ) : (
              <>
                only <Unit value={value("count", firable ?? 0)} /> researchers
                to fire
              </>
            )}
          </Text>
        )}
      </Stack>
    </Disclosure>
  );
}

/**
 * The payroll change per day, signed. Absent rather than zero when RP-1 has
 * given no per-head rate: a hire drawn as adding nothing to the payroll is
 * worse than one drawn with no figure.
 */
function SalaryDelta({
  salary,
  sign,
}: Readonly<{ salary: number | null; sign: "+" | "-" }>) {
  if (salary === null) {
    return <>salary per day unknown</>;
  }
  return (
    <>
      {sign}
      <Unit decimals={1} value={value("f/day", salary)} /> salary
    </>
  );
}
