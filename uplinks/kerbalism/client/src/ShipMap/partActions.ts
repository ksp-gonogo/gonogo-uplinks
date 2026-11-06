import type {
  ContributionEntry,
  InstrumentEntry,
} from "@ksp-gonogo/sitrep-sdk";
import { lastValue } from "../lastValue.js";
import { readKerbalismScienceInstrumentExt } from "../science.js";
import { KERBALISM } from "../uplink.js";

type PartActionEntry = ContributionEntry<"ship-map.part-actions">;

/**
 * The buttons Kerbalism's experiments give a part's menu on the Vessel
 * Schematic: Start while an experiment is stopped, Stop while it is running.
 * Kerbalism builds its own part-window buttons only while that window is open,
 * so the part's own list never carries them; these are read from the
 * experiment's state on `science.instruments` and sent through the science
 * commands.
 *
 * Exported so a test can call it against plain fixtures.
 */
export function computeKerbalismPartActions(
  instruments: readonly InstrumentEntry[] | null | undefined,
): PartActionEntry[] {
  const entries: PartActionEntry[] = [];
  for (const instrument of instruments ?? []) {
    const ext = readKerbalismScienceInstrumentExt(instrument);
    // A scanner is switched from its own widget, and a stock row has no Kerbalism namespace at all.
    if (ext?.kind !== "experiment") continue;
    if (!instrument.partId || !instrument.experimentId) continue;
    // Neither Start nor Stop is offered for a state that is unknown.
    if (typeof instrument.running !== "boolean") continue;

    const title = instrument.title || instrument.experimentId;
    const running = instrument.running;
    entries.push({
      partId: instrument.partId,
      name: `${instrument.experimentId}.${running ? "stop" : "start"}`,
      label: `${running ? "Stop" : "Start"} ${title}`,
      group: "Science",
      // A broken experiment cannot be switched.
      active: ext.runningState !== "Broken" && ext.expStatus !== "Broken",
      command: running ? "science.experiment.stop" : "science.experiment.start",
      args: {
        partId: instrument.partId,
        experimentId: instrument.experimentId,
      },
    });
  }
  return entries;
}

KERBALISM.registerContribution({
  id: "ship-map-part-actions",
  contributes: "ship-map.part-actions",
  deps: ["science.instruments"],
  requires: "kerbalism",
  compute: (topics) =>
    computeKerbalismPartActions(lastValue(topics["science.instruments"])),
});
