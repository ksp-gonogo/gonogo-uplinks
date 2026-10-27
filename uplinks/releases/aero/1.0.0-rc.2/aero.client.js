// src/uplink.ts
import { defineUplinkClient } from "@ksp-gonogo/sitrep-sdk";

// src/__generated__/units.ts
var GENERATED_TYPE_UNITS = {
  "AeroState": {
    aeroModelValid: "flag",
    angleOfAttack: "\xB0",
    ballisticCoefficient: "kg/m\xB2",
    dragCoefficient: "1",
    dragForce: "kN",
    equivalentAirspeed: "m/s",
    indicatedAirspeed: "m/s",
    liftCoefficient: "1",
    liftForce: "kN",
    liftToDragRatio: "1",
    referenceArea: "m\xB2",
    sideslip: "\xB0",
    specificExcessPower: "W/kg",
    stallFraction: "ratio",
    terminalVelocity: "m/s"
  }
};
var GENERATED_TOPIC_UNITS = {
  "aero.state": {
    aeroModelValid: "flag",
    angleOfAttack: "\xB0",
    ballisticCoefficient: "kg/m\xB2",
    dragCoefficient: "1",
    dragForce: "kN",
    equivalentAirspeed: "m/s",
    indicatedAirspeed: "m/s",
    liftCoefficient: "1",
    liftForce: "kN",
    liftToDragRatio: "1",
    referenceArea: "m\xB2",
    sideslip: "\xB0",
    specificExcessPower: "W/kg",
    stallFraction: "ratio",
    terminalVelocity: "m/s"
  }
};
var GENERATED_TYPE_SHAPES = {};
var GENERATED_TOPIC_SHAPES = {};
var GENERATED_TYPE_ENUMS = {};
var GENERATED_TOPIC_ENUMS = {};
var GENERATED_TYPE_STATICS = {};
var GENERATED_TOPIC_STATICS = {};
var GENERATED_ENUM_MEMBERS = {};
var GENERATED_CONTRACT_TAGS = {
  topics: {},
  names: {},
  reckonable: []
};

// src/uplink.ts
var UPLINK_VERSION = "1.0.0-rc.2";
var AERO = defineUplinkClient({
  id: "aero",
  version: UPLINK_VERSION,
  name: "Aerodynamics",
  description: "Puts Ferram Aerospace Research's own aerodynamic numbers on the board: angle of attack, sideslip, stall, lift and drag.",
  tags: GENERATED_CONTRACT_TAGS
});

// src/units.ts
import { registerUnit } from "@ksp-gonogo/sitrep-sdk";
registerUnit({
  symbol: "kg/m\xB2",
  kind: "arealDensity",
  dimension: { kg: 1, m: -2 },
  ratio: 1
});
registerUnit({
  symbol: "W/kg",
  kind: "specificPower",
  dimension: { m: 2, s: -3 },
  ratio: 1
});

// src/topics.ts
import {
  registerUplinkTopic,
  registerEnumMembers,
  registerTopicUnits,
  registerTypeUnits
} from "@ksp-gonogo/sitrep-sdk";
var AERO_AVAILABLE_TOPIC = "aero.available";
var AERO_STATE_TOPIC = "aero.state";
registerUplinkTopic(AERO_AVAILABLE_TOPIC);
registerUplinkTopic(AERO_STATE_TOPIC);
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

// src/Aerodynamics/index.tsx
import { registerComponent, useTelemetry, value } from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  Cluster,
  NULL_DISPLAY,
  Panel,
  Readout,
  ReadoutCaption,
  Row,
  RowName,
  Section,
  Unit
} from "@ksp-gonogo/ui-kit";
import { jsx, jsxs } from "react/jsx-runtime";
var ROW_LIST = { listStyle: "none", margin: 0, padding: 0 };
function Q({
  value: value3,
  decimals
}) {
  return value3 == null ? NULL_DISPLAY : (
    // biome-ignore lint/suspicious/noExplicitAny: one readout over fifteen unit tokens
    /* @__PURE__ */ jsx(Unit, { value: value3, decimals })
  );
}
var DEPARTING = value("ratio", 0.5);
var NOTICEABLE = value("ratio", 0.02);
function stallBand(fraction) {
  if (fraction.greaterThanOrEqual(DEPARTING)) {
    return { label: "STALLED", tone: "nogo" };
  }
  if (fraction.greaterThan(NOTICEABLE)) {
    return { label: "PARTIAL STALL", tone: "warn" };
  }
  return { label: "ATTACHED", tone: "go" };
}
function AerodynamicsComponent(_props) {
  const reading = useTelemetry("aero.state");
  const s = reading.state === "observed" ? reading.value : void 0;
  const stall = s?.stallFraction;
  const band = stall == null ? null : stallBand(stall);
  const modelStale = s?.aeroModelValid === false;
  return /* @__PURE__ */ jsx(
    Panel,
    {
      panelTitle: "Aerodynamics",
      compactTitle: ["AERO"],
      sections: [
        /* @__PURE__ */ jsxs(
          Section,
          {
            full: true,
            gap: "related-dense",
            role: "status",
            "aria-live": "polite",
            children: [
              /* @__PURE__ */ jsxs(Cluster, { wrap: true, children: [
                /* @__PURE__ */ jsx(Badge, { tone: band?.tone ?? "neutral", children: band?.label ?? "NO AERO DATA" }),
                modelStale && /* @__PURE__ */ jsx(Badge, { tone: "warn", children: "MODEL OUTDATED" })
              ] }),
              /* @__PURE__ */ jsxs(Cluster, { wrap: true, children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx(Readout, { size: "hero", children: /* @__PURE__ */ jsx(Q, { value: s?.angleOfAttack, decimals: 1 }) }),
                  /* @__PURE__ */ jsx(ReadoutCaption, { children: "Angle of attack" })
                ] }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx(Readout, { size: "hero", tone: band?.tone, children: /* @__PURE__ */ jsx(Q, { value: stall, decimals: 0 }) }),
                  /* @__PURE__ */ jsx(ReadoutCaption, { children: "Stalled" })
                ] }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx(Readout, { size: "hero", children: /* @__PURE__ */ jsx(Q, { value: s?.liftToDragRatio, decimals: 2 }) }),
                  /* @__PURE__ */ jsx(ReadoutCaption, { children: "Lift / drag" })
                ] })
              ] })
            ]
          },
          "state"
        ),
        /* @__PURE__ */ jsxs(Section, { as: "ul", style: ROW_LIST, children: [
          /* @__PURE__ */ jsxs(Row, { children: [
            /* @__PURE__ */ jsx(RowName, { children: "Sideslip" }),
            /* @__PURE__ */ jsx(Q, { value: s?.sideslip, decimals: 1 })
          ] }),
          /* @__PURE__ */ jsxs(Row, { children: [
            /* @__PURE__ */ jsx(RowName, { children: "Indicated airspeed" }),
            /* @__PURE__ */ jsx(Q, { value: s?.indicatedAirspeed, decimals: 0 })
          ] }),
          /* @__PURE__ */ jsxs(Row, { children: [
            /* @__PURE__ */ jsx(RowName, { children: "Equivalent airspeed" }),
            /* @__PURE__ */ jsx(Q, { value: s?.equivalentAirspeed, decimals: 0 })
          ] }),
          /* @__PURE__ */ jsxs(Row, { children: [
            /* @__PURE__ */ jsx(RowName, { children: "Lift coefficient" }),
            /* @__PURE__ */ jsx(Q, { value: s?.liftCoefficient, decimals: 3 })
          ] }),
          /* @__PURE__ */ jsxs(Row, { children: [
            /* @__PURE__ */ jsx(RowName, { children: "Drag coefficient" }),
            /* @__PURE__ */ jsx(Q, { value: s?.dragCoefficient, decimals: 3 })
          ] }),
          /* @__PURE__ */ jsxs(Row, { children: [
            /* @__PURE__ */ jsx(RowName, { children: "Reference area" }),
            /* @__PURE__ */ jsx(Q, { value: s?.referenceArea, decimals: 2 })
          ] }),
          /* @__PURE__ */ jsxs(Row, { children: [
            /* @__PURE__ */ jsx(RowName, { children: "Lift" }),
            /* @__PURE__ */ jsx(Q, { value: s?.liftForce, decimals: 1 })
          ] }),
          /* @__PURE__ */ jsxs(Row, { children: [
            /* @__PURE__ */ jsx(RowName, { children: "Drag" }),
            /* @__PURE__ */ jsx(Q, { value: s?.dragForce, decimals: 1 })
          ] }),
          /* @__PURE__ */ jsxs(Row, { children: [
            /* @__PURE__ */ jsx(RowName, { children: "Terminal velocity" }),
            /* @__PURE__ */ jsx(Q, { value: s?.terminalVelocity, decimals: 0 })
          ] }),
          /* @__PURE__ */ jsxs(Row, { children: [
            /* @__PURE__ */ jsx(RowName, { children: "Ballistic coefficient" }),
            /* @__PURE__ */ jsx(Q, { value: s?.ballisticCoefficient, decimals: 0 })
          ] }),
          /* @__PURE__ */ jsxs(Row, { children: [
            /* @__PURE__ */ jsx(RowName, { children: "Specific excess power" }),
            /* @__PURE__ */ jsx(Q, { value: s?.specificExcessPower, decimals: 1 })
          ] })
        ] }, "rows")
      ]
    }
  );
}
registerComponent({
  id: "aerodynamics",
  name: "Aerodynamics",
  description: "Angle of attack, sideslip, stall fraction, lift, drag and dynamic pressure as Ferram Aerospace Research computes them. Shows that FAR is unavailable instead of zeros when it is not installed.",
  tags: ["flight", "ro"],
  defaultSize: { w: 4, h: 7 },
  minSize: { w: 4, h: 5 },
  component: AerodynamicsComponent,
  channels: ["aero.state"],
  defaultConfig: {},
  actions: [],
  requires: ["flight"],
  owner: AERO
});

// src/DescentEnvelope/index.ts
import {
  getBody,
  projectDescent,
  relativeDensityCurve,
  terminalVelocityCurve,
  value as value2
} from "@ksp-gonogo/sitrep-sdk";
import { writeQuantity } from "@ksp-gonogo/ui-kit";

// src/drawnFrom.ts
import {
  datedFrom,
  observedAt
} from "@ksp-gonogo/sitrep-sdk";
function drawnFrom(readings) {
  return datedFrom(
    readings.map((reading) => ({
      state: reading.state,
      instant: observedAt(reading),
      grade: reading.state === "held" ? reading.grade : void 0
    })),
    void 0
  );
}

// src/lastValue.ts
function lastValue(reading) {
  return reading.state === "observed" || reading.state === "held" ? reading.value : void 0;
}

// src/DescentEnvelope/index.ts
var CURVE_DISAGREEMENT = 0.05;
var MODEL_CURVE_STEPS = 28;
var STALL_WARNING_FRACTION = 0.12;
var STALL_SEVERE_FRACTION = 0.35;
function fmtBeta(v) {
  return writeQuantity(value2("kg/m\xB2", v), { decimals: 0 });
}
function aeroDescentLayers(inputs) {
  const {
    stall,
    modelTerminal,
    ballistic,
    stale,
    held,
    noReading,
    plotTerminal,
    plotTouchdown,
    altitude,
    speed,
    surfaceGravity
  } = inputs;
  const layers = [];
  const emphasis = stale || held ? "faint" : "normal";
  if (noReading) {
    layers.push({
      kind: "caption",
      id: "no-reading",
      anchor: "left-edge",
      text: "NO AERO DATA",
      tone: "warn",
      description: "aerodynamics: no reading for this vessel"
    });
    return layers;
  }
  if (held) {
    layers.push({
      kind: "caption",
      id: "held",
      anchor: "left-edge",
      text: "HELD",
      tone: "warn",
      description: "aerodynamics held"
    });
  }
  if (stale) {
    layers.push({
      kind: "caption",
      id: "stale",
      anchor: "left-edge",
      text: "MODEL OUTDATED",
      tone: "warn",
      description: "aerodynamic model outdated, these marks describe the previous shape"
    });
  }
  if (stall != null && stall >= STALL_WARNING_FRACTION) {
    layers.push({
      kind: "caption",
      id: "stall",
      anchor: "left-edge",
      text: "STALL",
      tone: stall >= STALL_SEVERE_FRACTION ? "nogo" : "warn",
      description: `stall fraction ${writeQuantity(value2("ratio", stall), {
        decimals: 0
      })}`
    });
  }
  const usable = (v) => v != null && Number.isFinite(v) && v > 0;
  if (!usable(modelTerminal) || !usable(plotTerminal) || !usable(plotTouchdown) || !usable(altitude)) {
    return layers;
  }
  const anchors = {
    speedNow: plotTerminal,
    altitudeNow: altitude,
    groundSpeed: plotTouchdown
  };
  const density = relativeDensityCurve(anchors);
  const plotTerminalAt = terminalVelocityCurve(anchors);
  const densityHere = density(altitude);
  if (!(densityHere > 0)) return layers;
  const modelTerminalAt = (altitudeM) => {
    const rho = density(altitudeM);
    return rho > 0 ? modelTerminal * Math.sqrt(densityHere / rho) : modelTerminal;
  };
  const modelGround = modelTerminalAt(0);
  const plotGround = plotTerminalAt(0);
  const disagree = plotGround > 0 && Math.abs(modelGround - plotGround) / plotGround > CURVE_DISAGREEMENT;
  if (disagree) {
    layers.push({
      kind: "series",
      id: "reference-terminal",
      points: Array.from({ length: MODEL_CURVE_STEPS + 1 }, (_, i) => {
        const y = altitude * i / MODEL_CURVE_STEPS;
        return { x: plotTerminalAt(y), y };
      }),
      tone: "neutral",
      emphasis: "faint",
      description: "terminal velocity backed out of measured drag, for comparison"
    });
    layers.push({
      kind: "series",
      id: "model-terminal",
      points: Array.from({ length: MODEL_CURVE_STEPS + 1 }, (_, i) => {
        const y = altitude * i / MODEL_CURVE_STEPS;
        return { x: modelTerminalAt(y), y };
      }),
      tone: "info",
      emphasis,
      dashed: true,
      description: `modelled terminal velocity ${writeQuantity(
        value2("m/s", modelTerminal),
        { decimals: 0 }
      )}, parting from the plot's own back-out`
    });
  }
  if (!usable(surfaceGravity) || !usable(speed)) return layers;
  const modelDescent = projectDescent({
    startSpeed: speed,
    startAltitude: altitude,
    surfaceGravity,
    terminalVelocityAt: modelTerminalAt
  });
  const plotDescent = projectDescent({
    startSpeed: speed,
    startAltitude: altitude,
    surfaceGravity,
    terminalVelocityAt: plotTerminalAt
  });
  const settle = modelDescent.settleAltitude;
  if (settle == null || plotDescent.settleAltitude != null && Math.abs(settle - plotDescent.settleAltitude) <= altitude * CURVE_DISAGREEMENT) {
    return layers;
  }
  layers.push({
    kind: "annotation",
    id: "model-settle",
    at: { x: modelTerminalAt(settle), y: settle },
    across: "x",
    tone: "info",
    emphasis,
    label: ballistic != null ? `\u03B2 ${fmtBeta(ballistic)}` : void 0,
    description: `modelled descent settles at ${writeQuantity(
      value2("m", settle),
      { decimals: 1 }
    )}${ballistic != null ? `, ballistic coefficient ${fmtBeta(ballistic)}` : ""}`
  });
  return layers;
}
function aeroBadges(state, held = false) {
  if (!state) return null;
  const badges = [];
  const alpha = state.angleOfAttack?.magnitude;
  const stall = state.stallFraction?.magnitude;
  const stale = state.aeroModelValid === false;
  if (alpha != null && Number.isFinite(alpha)) {
    badges.push({
      id: "alpha",
      label: `\u03B1 ${writeQuantity(value2("\xB0", alpha), { decimals: 0 })}`,
      tone: stale || held ? "neutral" : "info"
    });
  }
  if (stall != null && Number.isFinite(stall)) {
    badges.push({
      id: "stall",
      label: `STALL ${writeQuantity(value2("ratio", stall), { decimals: 0 })}`,
      tone: stall >= STALL_SEVERE_FRACTION ? "nogo" : stall >= STALL_WARNING_FRACTION ? "warn" : "neutral"
    });
  }
  if (badges.length === 0) return null;
  if (held) badges.push({ id: "held", label: "HELD", tone: "warn" });
  return badges;
}
function heightAboveTerrain(surface, flight) {
  return surface?.heightFromTerrain?.magnitude ?? flight?.altitudeTerrain?.magnitude ?? null;
}
function surfaceGravityOf(identity, bodies) {
  const index = identity?.parentBodyIndex;
  if (index == null || !bodies) return null;
  const entry = bodies.bodies.find((b) => b.index === index);
  if (!entry) return null;
  const reported = entry.surfaceGravity?.in("m/s\xB2").magnitude;
  if (reported != null && Number.isFinite(reported) && reported > 0) {
    return reported;
  }
  const body = entry.name ? getBody(entry.name) : void 0;
  return body?.gm != null && body.radius > 0 ? body.gm / (body.radius * body.radius) : null;
}
AERO.registerContribution({
  id: "descent-envelope",
  contributes: "plots",
  requires: "aero",
  deps: [
    "aero.state",
    "vessel.landing",
    "vessel.flight",
    "vessel.surface",
    "vessel.identity",
    "trackingStation.bodies"
  ],
  compute: (topics) => {
    const reading = topics["aero.state"];
    const state = lastValue(reading);
    const landing = lastValue(topics["vessel.landing"]);
    const flight = lastValue(topics["vessel.flight"]);
    const alpha = state?.angleOfAttack?.magnitude ?? null;
    const stall = state?.stallFraction?.magnitude ?? null;
    const modelTerminal = state?.terminalVelocity?.magnitude ?? null;
    const inputs = {
      alpha,
      stall,
      modelTerminal,
      ballistic: state?.ballisticCoefficient?.magnitude ?? null,
      stale: state != null && state.aeroModelValid === false,
      held: reading?.state === "held",
      noReading: state == null || alpha == null && stall == null && modelTerminal == null,
      plotTerminal: landing?.terminalVelocity?.magnitude ?? null,
      plotTouchdown: landing?.projectedTouchdownSpeed?.magnitude ?? null,
      altitude: heightAboveTerrain(lastValue(topics["vessel.surface"]), flight),
      speed: flight?.surfaceSpeed?.magnitude ?? null,
      surfaceGravity: surfaceGravityOf(
        lastValue(topics["vessel.identity"]),
        lastValue(topics["trackingStation.bodies"])
      )
    };
    const layers = aeroDescentLayers(inputs);
    if (layers.length === 0) return null;
    return [
      {
        subject: "descent-profile",
        layers,
        held: drawnFrom([
          reading,
          topics["vessel.landing"],
          topics["vessel.flight"],
          topics["vessel.surface"]
        ])
      }
    ];
  }
});
AERO.registerContribution({
  id: "descent-envelope-badges",
  contributes: "landing-status.badges",
  requires: "aero",
  deps: ["aero.state"],
  compute: (topics) => {
    const reading = topics["aero.state"];
    return aeroBadges(lastValue(reading), reading.state === "held");
  }
});
export {
  AERO,
  AERO_AVAILABLE_TOPIC,
  AERO_STATE_TOPIC,
  AerodynamicsComponent,
  aeroBadges,
  aeroDescentLayers
};
