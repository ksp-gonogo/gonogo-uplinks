// src/MechJeb/index.tsx
import {
  registerComponent,
  useActionInput,
  useCommand,
  useStream,
  useTelemetry,
  value
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  Button,
  Cluster,
  Field,
  FieldLabel,
  Input,
  Panel,
  Section,
  Text,
  writeQuantity
} from "@ksp-gonogo/ui-kit";
import { useId, useState } from "react";

// src/uplink.ts
import { defineUplinkClient } from "@ksp-gonogo/sitrep-sdk";

// src/__generated__/units.ts
var GENERATED_CONTRACT_TAGS = {
  topics: {},
  reckonable: []
};

// src/uplink.ts
var UPLINK_VERSION = "1.0.0-rc.1";
var MECHJEB = defineUplinkClient({
  id: "mechjeb",
  version: UPLINK_VERSION,
  name: "MechJeb",
  description: "Flies the vessel from the console: engage MechJeb's ascent autopilot, execute the next node, or land at the selected target, over the delayed command path.",
  tags: GENERATED_CONTRACT_TAGS
});

// src/MechJeb/index.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var DEFAULT_ASCENT_ALTITUDE_KM = 100;
var mechjebActions = [
  {
    id: "engage-ascent",
    label: "Engage ascent autopilot",
    accepts: ["button"],
    description: "Commands the ascent autopilot to fly to the set target altitude."
  },
  {
    id: "execute-node",
    label: "Execute next node",
    accepts: ["button"],
    description: "Commands execution of the next maneuver node."
  },
  {
    id: "land-at-target",
    label: "Land at target",
    accepts: ["button"],
    description: "Commands an autopilot landing at the selected target."
  }
];
function commandChip(phase) {
  switch (phase) {
    case "in-flight":
      return { severity: "warn", text: "awaiting reply" };
    case "confirmed":
      return { severity: "go", text: "confirmed" };
    case "failed":
      return { severity: "nogo", text: "rejected" };
    case "refused":
      return { severity: "nogo", text: "refused" };
    case "lost":
      return { severity: "nogo", text: "no reply" };
    case "undelivered":
      return { severity: "nogo", text: "not sent" };
    case "found":
      return { severity: "info", text: "found" };
    case "idle":
      return void 0;
  }
  const unhandled = phase;
  return unhandled;
}
function unavailableReason(roster) {
  const entry = roster?.uplinks.find((u) => u.id === MECHJEB.id);
  if (entry == null || entry.health.state !== "unavailable") {
    return null;
  }
  return entry.health.detail ?? entry.reason ?? "MechJeb2 is not reachable from the mod.";
}
function CommandRow({
  label,
  phase,
  disabled,
  onFire
}) {
  const chip = commandChip(phase);
  return /* @__PURE__ */ jsxs(Cluster, { justify: "between", gap: "related-dense", children: [
    /* @__PURE__ */ jsx(
      Button,
      {
        type: "button",
        onClick: onFire,
        disabled,
        "aria-label": label,
        children: label
      }
    ),
    /* @__PURE__ */ jsx("span", { role: "status", "aria-live": "polite", children: chip ? /* @__PURE__ */ jsx(Badge, { tone: chip.severity, size: "sm", children: chip.text }) : null })
  ] });
}
function MechJebComponent({ config }) {
  const engage = useCommand("mechjeb.engageAscentAutopilot");
  const executeNode = useCommand("mechjeb.executeNextNode");
  const land = useCommand("mechjeb.landAtTarget");
  const delay = useTelemetry("comms.delay");
  const oneWay = delay.state === "observed" ? delay.value.oneWaySeconds : void 0;
  const healthReading = useStream("system.uplinkHealth");
  const unavailable = unavailableReason(
    healthReading.state === "observed" || healthReading.state === "held" ? healthReading.value : void 0
  );
  const [altitudeText, setAltitudeText] = useState(
    String(config?.defaultAscentAltitudeKm ?? DEFAULT_ASCENT_ALTITUDE_KM)
  );
  const altitudeInputId = useId();
  const altitudeNoteId = useId();
  const parsedAltitude = Number(altitudeText);
  const altitudeKm = altitudeText.trim() !== "" && Number.isFinite(parsedAltitude) && parsedAltitude > 0 ? parsedAltitude : void 0;
  const fireEngage = () => {
    if (altitudeKm == null || unavailable != null) return;
    void engage.send(
      { targetAltitudeKm: altitudeKm },
      { label: `Engage ascent to ${writeQuantity(value("km", altitudeKm))}` }
    );
  };
  const fireExecuteNode = () => {
    if (unavailable != null) return;
    void executeNode.send({}, { label: "Execute next node" });
  };
  const fireLand = () => {
    if (unavailable != null) return;
    void land.send({}, { label: "Land at target" });
  };
  useActionInput({
    "engage-ascent": (payload) => {
      if (payload.kind === "button" && payload.value !== true) return void 0;
      fireEngage();
      return void 0;
    },
    "execute-node": (payload) => {
      if (payload.kind === "button" && payload.value !== true) return void 0;
      fireExecuteNode();
      return void 0;
    },
    "land-at-target": (payload) => {
      if (payload.kind === "button" && payload.value !== true) return void 0;
      fireLand();
      return void 0;
    }
  });
  return /* @__PURE__ */ jsx(
    Panel,
    {
      panelTitle: "MechJeb",
      sections: [
        /* The link caption qualifies every command below it rather than sitting
           beside one, so it spans the section grid. */
        /* @__PURE__ */ jsxs(Section, { full: true, children: [
          /* @__PURE__ */ jsx(Text, { level: "faint", size: "xs", children: oneWay != null ? `Remote autopilot (${writeQuantity(oneWay, { decimals: 1 })} one-way delay)` : "Remote autopilot" }),
          unavailable != null ? /* @__PURE__ */ jsxs("span", { role: "status", "aria-live": "polite", children: [
            /* @__PURE__ */ jsx(Badge, { tone: "nogo", size: "sm", children: "MECHJEB NOT REACHABLE" }),
            /* @__PURE__ */ jsx(Text, { tone: "warn", size: "xs", children: unavailable })
          ] }) : null
        ] }, "link"),
        /* @__PURE__ */ jsxs(Section, { title: "Ascent", children: [
          /* @__PURE__ */ jsxs(Field, { children: [
            /* @__PURE__ */ jsx(FieldLabel, { htmlFor: altitudeInputId, children: "Target altitude (km)" }),
            /* @__PURE__ */ jsx(
              Input,
              {
                id: altitudeInputId,
                type: "number",
                min: 0,
                step: 5,
                value: altitudeText,
                "aria-invalid": altitudeKm == null ? true : void 0,
                "aria-describedby": altitudeKm == null ? altitudeNoteId : void 0,
                onChange: (e) => setAltitudeText(e.target.value)
              }
            )
          ] }),
          altitudeKm == null ? /* @__PURE__ */ jsx(Text, { id: altitudeNoteId, tone: "warn", size: "xs", children: "No target altitude read from the field, so there is nothing to engage to" }) : null,
          /* @__PURE__ */ jsx(
            CommandRow,
            {
              label: "Engage ascent autopilot",
              phase: engage.status.phase,
              disabled: altitudeKm == null || unavailable != null,
              onFire: fireEngage
            }
          )
        ] }, "ascent"),
        /* @__PURE__ */ jsxs(Section, { title: "Maneuvers", children: [
          /* @__PURE__ */ jsx(
            CommandRow,
            {
              label: "Execute next node",
              phase: executeNode.status.phase,
              disabled: unavailable != null,
              onFire: fireExecuteNode
            }
          ),
          /* @__PURE__ */ jsx(
            CommandRow,
            {
              label: "Land at target",
              phase: land.status.phase,
              disabled: unavailable != null,
              onFire: fireLand
            }
          )
        ] }, "maneuvers")
      ]
    }
  );
}
registerComponent({
  id: "mechjeb",
  name: "MechJeb",
  description: "Engage MechJeb's ascent autopilot, execute the next node, or land at the target. Shows the one-way light time each command costs and which commands are still in flight.",
  tags: ["control"],
  defaultSize: { w: 5, h: 7 },
  minSize: { w: 4, h: 5 },
  component: MechJebComponent,
  // Command-only widget: MechJeb readouts are derivable, so the only READ is
  // comms.delay (for the delay-context subtitle). The mechjeb.* COMMAND topics
  // route through the command layer, not dataRequirements.
  dataRequirements: ["comms.delay"],
  defaultConfig: { defaultAscentAltitudeKm: DEFAULT_ASCENT_ALTITUDE_KM },
  actions: mechjebActions,
  requires: ["flight"],
  owner: MECHJEB
});

// src/commands.ts
import { registerUplinkCommand } from "@ksp-gonogo/sitrep-sdk";

// src/__generated__/command-map.ts
var GENERATED_COMMAND_RAIL = {
  "mechjeb.engageAscentAutopilot": { replies: true, delayed: true },
  "mechjeb.executeNextNode": { replies: true, delayed: true },
  "mechjeb.landAtTarget": { replies: true, delayed: true }
};
var GENERATED_COMMAND_IDS = [
  "mechjeb.engageAscentAutopilot",
  "mechjeb.executeNextNode",
  "mechjeb.landAtTarget"
];

// src/commands.ts
for (const id of GENERATED_COMMAND_IDS) {
  registerUplinkCommand(id, GENERATED_COMMAND_RAIL[id]);
}
export {
  MechJebComponent,
  GENERATED_COMMAND_IDS as UPLINK_COMMAND_IDS
};
