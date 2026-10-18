// src/uplink.ts
import { defineUplinkClient } from "@ksp-gonogo/sitrep-sdk";

// src/__generated__/units.ts
var GENERATED_TYPE_UNITS = {
  "RealFuelsBoiloff": {
    boiloffRate: "kg/s",
    cryogenicTankCount: "count"
  },
  "RealFuelsEngineEntry": {
    feedPressureOk: "flag",
    groundIgnitionOnly: "flag",
    ignitionProbability: "ratio",
    ignitionsRemaining: "count",
    ignitionsUnlimited: "flag",
    literalZeroIgnitions: "flag",
    partId: "id",
    partName: "text",
    predictedMaximumResiduals: "ratio",
    pressureFed: "flag",
    ratedBurnTimeSeconds: "s",
    ratedContinuousBurnTimeSeconds: "s",
    ullageModelled: "flag",
    ullageStability: "ratio"
  },
  "RealFuelsEngines": {
    ignitionsLimited: "flag",
    ullageSimulated: "flag"
  }
};
var GENERATED_TOPIC_UNITS = {
  "realfuels.boiloff": {
    boiloffRate: "kg/s",
    cryogenicTankCount: "count"
  },
  "realfuels.engines": {
    ignitionsLimited: "flag",
    ullageSimulated: "flag"
  }
};
var GENERATED_TYPE_SHAPES = {
  "RealFuelsEngines": {
    engines: "RealFuelsEngineEntry[]"
  }
};
var GENERATED_TOPIC_SHAPES = {
  "realfuels.engines": {
    engines: "RealFuelsEngineEntry[]"
  }
};
var GENERATED_TYPE_ENUMS = {};
var GENERATED_TOPIC_ENUMS = {};
var GENERATED_TYPE_STATICS = {
  "RealFuelsEngineEntry": ["ratedBurnTimeSeconds", "ratedContinuousBurnTimeSeconds"]
};
var GENERATED_TOPIC_STATICS = {};
var GENERATED_ENUM_MEMBERS = {};
var GENERATED_CONTRACT_TAGS = {
  topics: {
    "realfuels.engines": {
      "engines.*.ignitionProbability": { kind: "continuous" },
      "engines.*.ullageStability": { kind: "continuous" }
    }
  },
  reckonable: []
};

// src/uplink.ts
var UPLINK_VERSION = "1.0.0-rc.1";
var REALFUELS = defineUplinkClient({
  id: "realfuels",
  version: UPLINK_VERSION,
  name: "RealFuels",
  description: "Reports per-engine RealFuels limits: ignitions remaining, ullage stability and pressure feed, plus cryogenic boiloff.",
  tags: GENERATED_CONTRACT_TAGS
});

// src/topics.ts
import {
  registerUplinkTopic,
  registerEnumMembers,
  registerTopicUnits,
  registerTypeUnits
} from "@ksp-gonogo/sitrep-sdk";
var REALFUELS_AVAILABLE_TOPIC = "realfuels.available";
var REALFUELS_ENGINES_TOPIC = "realfuels.engines";
var REALFUELS_BOILOFF_TOPIC = "realfuels.boiloff";
registerUplinkTopic(REALFUELS_AVAILABLE_TOPIC);
registerUplinkTopic(REALFUELS_ENGINES_TOPIC);
registerUplinkTopic(REALFUELS_BOILOFF_TOPIC);
for (const topic of /* @__PURE__ */ new Set([
  ...Object.keys(GENERATED_TOPIC_UNITS),
  ...Object.keys(GENERATED_TOPIC_SHAPES)
])) {
  registerTopicUnits(
    topic,
    GENERATED_TOPIC_UNITS[topic] ?? {},
    GENERATED_TOPIC_SHAPES[topic] ?? {},
    GENERATED_TOPIC_STATICS[topic] ?? [],
    GENERATED_TOPIC_ENUMS[topic] ?? {}
  );
}
for (const [typeName, units] of Object.entries(GENERATED_TYPE_UNITS)) {
  registerTypeUnits(
    typeName,
    units,
    GENERATED_TYPE_SHAPES[typeName] ?? {},
    GENERATED_TYPE_STATICS[typeName] ?? [],
    GENERATED_TYPE_ENUMS[typeName] ?? {}
  );
}
for (const [enumName, members] of Object.entries(GENERATED_ENUM_MEMBERS)) {
  registerEnumMembers(enumName, members);
}

// src/EngineRealism/index.tsx
import {
  observedValue,
  registerAugment,
  useTelemetry
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  Grid,
  NULL_DISPLAY,
  ReadoutCaption,
  Stack,
  Text,
  Unit
} from "@ksp-gonogo/ui-kit";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var STABILITY_BANDS = [
  { floor: 0.996, label: "SETTLED", severity: "go" },
  { floor: 0.95, label: "STABLE", severity: "go" },
  { floor: 0.75, label: "RISKY", severity: "caution" },
  { floor: 0.3, label: "VERY RISKY", severity: "warn" },
  { floor: 0.15, label: "UNSTABLE", severity: "nogo" }
];
var VERY_UNSTABLE = {
  label: "VERY UNSTABLE",
  severity: "nogo"
};
function bandFor(stability) {
  return STABILITY_BANDS.find((b) => stability >= b.floor) ?? VERY_UNSTABLE;
}
function IgnitionState({ engine }) {
  if (engine.ignitionsUnlimited === true) {
    return /* @__PURE__ */ jsx(Badge, { tone: "go", size: "sm", children: "UNLIMITED" });
  }
  if (engine.groundIgnitionOnly === true) {
    return /* @__PURE__ */ jsx(Badge, { tone: "warn", size: "sm", children: "GROUND ONLY" });
  }
  if (engine.groundIgnitionOnly !== false || engine.ignitionsRemaining == null) {
    return /* @__PURE__ */ jsx(Text, { size: "xs", level: "muted", children: NULL_DISPLAY });
  }
  return /* @__PURE__ */ jsxs(
    Badge,
    {
      tone: engine.ignitionsRemaining.magnitude > 1 ? "go" : "caution",
      size: "sm",
      children: [
        /* @__PURE__ */ jsx(Unit, { value: engine.ignitionsRemaining, decimals: 0 }),
        " LEFT"
      ]
    }
  );
}
function UllageState({
  engine,
  simulated
}) {
  if (simulated === false) {
    return /* @__PURE__ */ jsx(Text, { size: "xs", level: "muted", children: "not simulated" });
  }
  if (simulated == null) {
    return /* @__PURE__ */ jsx(Text, { size: "xs", level: "muted", children: NULL_DISPLAY });
  }
  if (engine.ullageModelled === false) {
    return /* @__PURE__ */ jsx(Text, { size: "xs", level: "muted", children: "not subject" });
  }
  if (engine.ullageStability == null) {
    return /* @__PURE__ */ jsx(Text, { size: "xs", level: "muted", children: NULL_DISPLAY });
  }
  const band = bandFor(engine.ullageStability.magnitude);
  return /* @__PURE__ */ jsxs(Badge, { tone: band.severity, size: "sm", children: [
    band.label,
    engine.ignitionProbability != null && /* @__PURE__ */ jsxs(Fragment, { children: [
      " ",
      /* @__PURE__ */ jsx(Unit, { value: engine.ignitionProbability, decimals: 0 })
    ] })
  ] });
}
function EngineRow({
  engine,
  simulated
}) {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(Text, { size: "xs", level: "muted", children: engine.partName ?? NULL_DISPLAY }),
    /* @__PURE__ */ jsx(IgnitionState, { engine }),
    /* @__PURE__ */ jsx(UllageState, { engine, simulated })
  ] });
}
function BoiloffRow({ boiloff }) {
  const tanks = boiloff.cryogenicTankCount?.magnitude;
  if (tanks === 0) return null;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(Text, { size: "xs", level: "muted", children: "Boiloff" }),
    /* @__PURE__ */ jsx(Text, { size: "sm", children: boiloff.boiloffRate == null ? NULL_DISPLAY : /* @__PURE__ */ jsx(Unit, { value: boiloff.boiloffRate, decimals: 2 }) }),
    /* @__PURE__ */ jsx(Text, { size: "xs", level: "muted", children: tanks == null ? NULL_DISPLAY : `${tanks} cryo tank${tanks === 1 ? "" : "s"}` })
  ] });
}
function EngineRealismSection() {
  const engines = observedValue(useTelemetry("realfuels.engines"));
  const boiloff = observedValue(useTelemetry("realfuels.boiloff"));
  const rows = engines?.engines;
  if (rows == null || rows.length === 0) return null;
  return /* @__PURE__ */ jsxs(Stack, { gap: "caption", children: [
    /* @__PURE__ */ jsx(ReadoutCaption, { children: "Ignition & ullage" }),
    /* @__PURE__ */ jsxs(
      Grid,
      {
        cols: "minmax(0, 1fr) auto auto",
        gap: "related-dense",
        align: "baseline",
        children: [
          rows.map((engine, index) => /* @__PURE__ */ jsx(
            EngineRow,
            {
              engine,
              simulated: engines?.ullageSimulated
            },
            engine.partId?.toString() ?? `engine-${index}`
          )),
          boiloff != null && /* @__PURE__ */ jsx(BoiloffRow, { boiloff })
        ]
      }
    )
  ] });
}
registerAugment({
  id: "realfuels-fuel-status-section",
  augments: "fuel-status.sections",
  requires: "realfuels",
  channels: ["realfuels.engines", "realfuels.boiloff"],
  component: EngineRealismSection,
  owner: REALFUELS
});
export {
  EngineRealismSection
};
