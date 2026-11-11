import { registerAugment, useProcessor } from "@ksp-gonogo/sitrep-sdk";
import { Stack, Text, useWidgetScope } from "@ksp-gonogo/ui-kit";
import { useMemo } from "react";
import { buildLedger } from "../ecosystem.js";
import { LedgerBody, LedgerReadingContext } from "../ShipSystems/index.js";
import { SHIP_SYSTEMS } from "../processor.js";
import { KERBALISM } from "../uplink.js";

const ELECTRIC_CHARGE = "ElectricCharge";

/**
 * Kerbalism's own electric-charge ledger under Power Systems: the processes
 * and crew rules drawing it, the net rate Kerbalism reports, and what is
 * left over. Drawn only while Power Systems is showing electric charge, and
 * only once Kerbalism has reported either a rate or a process for the craft.
 * Used by the Power Systems widget.
 */
function PowerFeed() {
  const scope = useWidgetScope("power-systems");
  const shipReading = useProcessor(SHIP_SYSTEMS);
  const ship =
    shipReading?.state === "observed" || shipReading?.state === "held"
      ? shipReading.value
      : undefined;
  const ledger = useMemo(
    () =>
      ship
        ? buildLedger({
            resource: ELECTRIC_CHARGE,
            profile: ship.profile,
            lifeSupport: ship.lifeSupport,
            crew: ship.crew,
          })
        : undefined,
    [ship],
  );
  if (scope?.resource !== ELECTRIC_CHARGE || !ledger) return null;
  if (ledger.terms.length === 0 && ledger.reportedNet === undefined) {
    return null;
  }
  return (
    <LedgerReadingContext.Provider value={shipReading}>
      <Stack>
        <Text level="muted" size="xs">
          KERBALISM
        </Text>
        <LedgerBody ledger={ledger} />
      </Stack>
    </LedgerReadingContext.Provider>
  );
}

registerAugment({
  id: "power-systems-kerbalism",
  augments: "power-systems.sections",
  component: PowerFeed,
  owner: KERBALISM,
});

export { PowerFeed };
