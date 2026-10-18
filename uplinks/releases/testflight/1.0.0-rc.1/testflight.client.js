// src/commands.ts
import { registerUplinkCommand } from "@ksp-gonogo/sitrep-sdk";

// src/__generated__/command-map.ts
var GENERATED_COMMAND_RAIL = {
  "testflight.repair": { replies: true, delayed: true }
};
var GENERATED_COMMAND_IDS = [
  "testflight.repair"
];

// src/commands.ts
for (const id of GENERATED_COMMAND_IDS) {
  registerUplinkCommand(id, GENERATED_COMMAND_RAIL[id]);
}

// src/topics.ts
import {
  registerUplinkTopic,
  registerCollectionTopic,
  registerEnumMembers,
  registerTopicUnits,
  registerTypeUnits
} from "@ksp-gonogo/sitrep-sdk";

// src/__generated__/topic-map.ts
var GENERATED_COLLECTION_TOPIC_IDS = [
  "testflight.reliabilityParts"
];

// src/__generated__/units.ts
var GENERATED_TYPE_UNITS = {
  "TestFlightReliabilityBudget": {
    consumed: "ratio",
    id: "id",
    kind: "enum",
    label: "text",
    limitSeconds: "s",
    usedSeconds: "s"
  },
  "TestFlightReliabilityPart": {
    condition: "enum",
    conditionDetail: "text",
    configuration: "text",
    flightData: "1",
    partId: "id",
    survival: "ratio",
    survivalHorizonSeconds: "s",
    title: "text"
  },
  "TestFlightReliabilitySummary": {
    boundMembers: "text",
    coverage: "enum",
    unboundMembers: "text"
  },
  "TestFlightRepairOutcome": {
    failuresCleared: "count",
    repaired: "flag"
  },
  "TestFlightRepairPartArgs": {
    partId: "id"
  }
};
var GENERATED_TOPIC_UNITS = {
  "testflight.reliability": {
    boundMembers: "text",
    coverage: "enum",
    unboundMembers: "text"
  },
  "testflight.reliabilityParts": {
    condition: "enum",
    conditionDetail: "text",
    configuration: "text",
    flightData: "1",
    partId: "id",
    survival: "ratio",
    survivalHorizonSeconds: "s",
    title: "text"
  }
};
var GENERATED_TYPE_SHAPES = {
  "TestFlightReliabilityPart": {
    budgets: "TestFlightReliabilityBudget[]"
  }
};
var GENERATED_TOPIC_SHAPES = {
  "testflight.reliabilityParts": {
    budgets: "TestFlightReliabilityBudget[]"
  }
};
var GENERATED_TYPE_ENUMS = {
  "TestFlightReliabilityBudget": {
    kind: null
  },
  "TestFlightReliabilityPart": {
    condition: null
  },
  "TestFlightReliabilitySummary": {
    coverage: null
  }
};
var GENERATED_TOPIC_ENUMS = {
  "testflight.reliability": {
    coverage: null
  },
  "testflight.reliabilityParts": {
    condition: null
  }
};
var GENERATED_TYPE_STATICS = {};
var GENERATED_TOPIC_STATICS = {};
var GENERATED_ENUM_MEMBERS = {};
var GENERATED_CONTRACT_TAGS = {
  topics: {},
  reckonable: []
};

// src/topics.ts
var TESTFLIGHT_AVAILABLE_TOPIC = "testflight.available";
var TESTFLIGHT_RELIABILITY_TOPIC = "testflight.reliability";
var TESTFLIGHT_RELIABILITY_PARTS_TOPIC = "testflight.reliabilityParts";
registerUplinkTopic(TESTFLIGHT_AVAILABLE_TOPIC);
registerUplinkTopic(TESTFLIGHT_RELIABILITY_TOPIC);
registerUplinkTopic(TESTFLIGHT_RELIABILITY_PARTS_TOPIC);
for (const topic of GENERATED_COLLECTION_TOPIC_IDS) {
  registerCollectionTopic(topic);
}
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

// src/uplink.ts
import { defineUplinkClient, registerErrorCodes } from "@ksp-gonogo/sitrep-sdk";

// src/__generated__/error-codes.ts
var TESTFLIGHT_ERROR_CODES = [
  {
    id: "testflight.notModelled",
    kind: "refusal",
    refines: "modeUnavailable",
    origin: null,
    sentence: "TestFlight is not reporting failures for that engine",
    meaning: "TestFlight is installed and the reader could not reach its repair or failure-list members."
  },
  {
    id: "testflight.noSuchPart",
    kind: "refusal",
    refines: "notFound",
    origin: null,
    sentence: "no engine TestFlight is tracking has that id",
    meaning: "No live TestFlight core aboard has that id."
  },
  {
    id: "testflight.nothingFailed",
    kind: "refusal",
    refines: "notFound",
    origin: null,
    sentence: "that engine has no active TestFlight failure",
    meaning: "The engine is tracked and carries no active failure."
  },
  {
    id: "testflight.unrepairable",
    kind: "refusal",
    refines: "capabilityMismatch",
    origin: null,
    sentence: "TestFlight marks that failure as beyond repair",
    meaning: "Every active failure on the engine is a class TestFlight says no repair can fix: an explosion, a fired docking clamp, a snapped solar mechanism."
  },
  {
    id: "testflight.repairDeclined",
    kind: "refusal",
    refines: "modeUnavailable",
    origin: null,
    sentence: "TestFlight left the failure standing",
    meaning: "TestFlight was asked to repair and left the failure standing without saying why."
  }
];

// src/uplink.ts
var UPLINK_VERSION = "1.0.0-rc.1";
var TESTFLIGHT = defineUplinkClient({
  id: "testflight",
  version: UPLINK_VERSION,
  name: "TestFlight",
  description: "TestFlight engine reliability on the fleet roster: failed engines, rated burn nearly spent and survival odds, with TestFlight's own repair.",
  tags: GENERATED_CONTRACT_TAGS
});
registerErrorCodes(TESTFLIGHT_ERROR_CODES);

// src/Reliability/index.tsx
import {
  registerAugment,
  useCommand,
  useTelemetry
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  Card,
  Cluster,
  CommandButton,
  HeldBadge,
  Stack,
  Text,
  worstSeverity
} from "@ksp-gonogo/ui-kit";

// src/Reliability/rows.tsx
import { value } from "@ksp-gonogo/sitrep-sdk";
import { magnitudeOf, Unit } from "@ksp-gonogo/ui-kit";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var seconds = (magnitude) => value("s", magnitude);
var ratio = (magnitude) => value("ratio", magnitude);
var BURN_ATTENTION = 0.75;
var SURVIVAL_ATTENTION = 0.95;
var SURVIVAL_WARNING = 0.85;
function drivingBudget(part) {
  let best;
  let bestConsumed = -1;
  for (const budget of part.budgets ?? []) {
    const consumed = magnitudeOf(budget.consumed);
    if (consumed === null || consumed < BURN_ATTENTION) continue;
    if (consumed > bestConsumed) {
      best = budget;
      bestConsumed = consumed;
    }
  }
  return best;
}
function isNoteworthy(part) {
  if (part.condition !== "nominal") return true;
  if (drivingBudget(part)) return true;
  const survival = magnitudeOf(part.survival);
  return survival !== null && survival < SURVIVAL_ATTENTION;
}
function burnRow(budget) {
  const label = budget.label ?? "rated burn";
  const used = magnitudeOf(budget.usedSeconds);
  const limit = magnitudeOf(budget.limitSeconds);
  if (used === null || limit === null) {
    return { severity: "warn", word: "wear", clause: `${label} nearly spent` };
  }
  if (used >= limit) {
    return {
      severity: "warn",
      word: "wear",
      clause: /* @__PURE__ */ jsxs(Fragment, { children: [
        "past ",
        label,
        " rating by ",
        /* @__PURE__ */ jsx(Unit, { value: seconds(used - limit) })
      ] })
    };
  }
  return {
    severity: "warn",
    word: "wear",
    clause: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Unit, { value: seconds(limit - used) }),
      " of",
      " ",
      /* @__PURE__ */ jsx(Unit, { value: seconds(limit) }),
      " ",
      label,
      " left"
    ] })
  };
}
function rowFor(part) {
  const detail = part.conditionDetail ?? void 0;
  if (part.condition === "failed") {
    return { severity: "nogo", word: "failed", clause: detail };
  }
  if (part.condition === "nominal") {
    const budget = drivingBudget(part);
    if (budget) return burnRow(budget);
    const survival = magnitudeOf(part.survival);
    const horizon = magnitudeOf(part.survivalHorizonSeconds);
    if (survival !== null && horizon !== null) {
      return {
        severity: survival >= SURVIVAL_WARNING ? "caution" : "warn",
        word: "survival",
        clause: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Unit, { value: ratio(survival) }),
          " to survive",
          " ",
          /* @__PURE__ */ jsx(Unit, { value: seconds(horizon) }),
          " of operation"
        ] })
      };
    }
    return { severity: "caution", word: "wear", clause: void 0 };
  }
  return { severity: "offline", word: "unreadable", clause: detail };
}

// src/Reliability/index.tsx
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function stillTrue(reading) {
  return reading.state === "observed" || reading.state === "held" ? reading.value : void 0;
}
function titleOf(part) {
  const title = part.title ?? "Unknown engine";
  return part.configuration && part.configuration !== title ? `${title} (${part.configuration})` : title;
}
function RepairEngine({ partId, title }) {
  const repair = useCommand("testflight.repair");
  return /* @__PURE__ */ jsx2(Cluster, { justify: "start", children: /* @__PURE__ */ jsx2(
    CommandButton,
    {
      handle: repair,
      args: { partId },
      size: "sm",
      commandLabel: `Repair ${title}`,
      label: "Repair",
      confirmLabel: "Confirm",
      pendingLabel: "Repair..."
    }
  ) });
}
function TestFlightReliabilityUpdates({
  vesselId,
  compact
}) {
  const identity = stillTrue(useTelemetry("vessel.identity"));
  const summary = stillTrue(useTelemetry("testflight.reliability"));
  const partsReading = useTelemetry("testflight.reliabilityParts");
  if (!identity || identity.vesselId !== vesselId) return null;
  if (summary?.coverage !== "modeled") return null;
  const parts = stillTrue(partsReading);
  if (parts === void 0) return null;
  const noteworthy = parts.filter(isNoteworthy);
  if (noteworthy.length === 0) return null;
  const held = partsReading.state === "held" ? partsReading.grade : null;
  const rows = noteworthy.map((part) => ({ part, row: rowFor(part) }));
  const severity = worstSeverity(rows.map((entry) => entry.row.severity));
  const atRisk = rows.some(
    (entry) => entry.row.severity === "nogo" || entry.part.condition === "unknown"
  );
  return /* @__PURE__ */ jsxs2(Stack, { role: "group", "aria-label": "TestFlight reliability", children: [
    /* @__PURE__ */ jsxs2(Cluster, { justify: "start", wrap: true, children: [
      /* @__PURE__ */ jsx2(Badge, { tone: severity, children: `${rows.length} ${atRisk ? "at risk" : "to watch"}` }),
      held && /* @__PURE__ */ jsx2(HeldBadge, { grade: held, subject: "TestFlight reliability" })
    ] }),
    !compact && rows.map(({ part, row }, index) => (
      // The key falls back to the index, never the title: a cluster of identical engines shares one.
      /* @__PURE__ */ jsxs2(
        Card,
        {
          tone: row.severity,
          title: titleOf(part),
          titleRight: /* @__PURE__ */ jsx2(Badge, { tone: row.severity, children: row.word }),
          children: [
            row.clause !== void 0 && /* @__PURE__ */ jsx2(Text, { level: "muted", children: row.clause }),
            !held && part.condition === "failed" && part.partId && /* @__PURE__ */ jsx2(RepairEngine, { partId: part.partId, title: titleOf(part) })
          ]
        },
        part.partId ?? `idx-${index}`
      )
    ))
  ] });
}
registerAugment({
  id: "testflight-reliability-updates",
  augments: "vessel-catalog.updates",
  component: TestFlightReliabilityUpdates,
  requires: "testflight",
  owner: TESTFLIGHT
});
export {
  TESTFLIGHT_AVAILABLE_TOPIC,
  TESTFLIGHT_RELIABILITY_PARTS_TOPIC,
  TESTFLIGHT_RELIABILITY_TOPIC,
  GENERATED_COMMAND_IDS as UPLINK_COMMAND_IDS
};
