// src/topics.ts
import {
  registerUplinkTopic,
  registerEnumMembers,
  registerTopicUnits,
  registerTypeUnits
} from "@ksp-gonogo/sitrep-sdk";

// src/__generated__/units.ts
var GENERATED_TYPE_UNITS = {
  "PrincipiaAnalysis": {
    sampledAtUt: "ut",
    vesselId: "id"
  },
  "PrincipiaAngleInterval": {
    max: "\xB0",
    min: "\xB0"
  },
  "PrincipiaBurnEditArgs": {
    burnIndex: "count",
    deltaVBinormal: "m/s",
    deltaVNormal: "m/s",
    deltaVTangent: "m/s",
    ignitionUt: "ut",
    inertiallyFixed: "flag",
    requestId: "id",
    vesselId: "id"
  },
  "PrincipiaBurnRemoveArgs": {
    burnIndex: "count",
    requestId: "id",
    vesselId: "id"
  },
  "PrincipiaCoastAnalysis": {
    endsAtUt: "ut",
    index: "count",
    startsAtUt: "ut"
  },
  "PrincipiaComposedBurn": {
    deltaVBinormal: "m/s",
    deltaVNormal: "m/s",
    deltaVTangent: "m/s",
    ignitionUt: "ut",
    inertiallyFixed: "flag"
  },
  "PrincipiaLengthInterval": {
    max: "m",
    min: "m"
  },
  "PrincipiaOrbitAnalysis": {
    anomalisticPeriodSeconds: "s",
    elementsEpochUt: "ut",
    elementsPresent: "flag",
    firstCollisionRiskUt: "ut",
    firstCollisionUt: "ut",
    firstReentryUt: "ut",
    gravitationallyBound: "flag",
    lowestAltitudeMetres: "m",
    missionDurationSeconds: "s",
    nodalPeriodSeconds: "s",
    nodalPrecessionDegreesPerHour: "\xB0/h",
    primaryBody: "text",
    primaryIndex: "count",
    progressOfNextAnalysis: "ratio",
    recurrenceCycleRotations: "count",
    recurrenceEquatorialShiftDegrees: "\xB0",
    recurrenceGridIntervalDegrees: "\xB0",
    recurrenceRevolutions: "count",
    recurrenceRevolutionsPerRotation: "count",
    recurrenceSubcycleRotations: "count",
    siderealPeriodSeconds: "s"
  },
  "PrincipiaPlan": {
    actualFinalTimeUt: "ut",
    anomalousBurnCount: "count",
    desiredFinalTimeUt: "ut",
    firstFutureBurnIndex: "count",
    initialTimeUt: "ut",
    optimisationRunning: "flag",
    planCount: "count",
    planExists: "flag",
    planIntegrated: "flag",
    reachedDeadline: "flag",
    sampledAtUt: "ut",
    selectedPlan: "count",
    statusError: "enum",
    statusMessage: "text",
    vesselId: "id"
  },
  "PrincipiaPlanArmArgs": {
    requestId: "id",
    vesselId: "id"
  },
  "PrincipiaPlanHorizonArgs": {
    desiredFinalTimeUt: "ut",
    requestId: "id",
    vesselId: "id"
  },
  "PrincipiaPlanIntegrator": {
    generalizedIntegratorKind: "enum",
    integratorKind: "enum",
    lengthToleranceMetres: "m",
    maxSteps: "count",
    speedToleranceMetresPerSecond: "m/s"
  },
  "PrincipiaPlanIntegratorArgs": {
    lengthToleranceMetres: "m",
    maxSteps: "count",
    requestId: "id",
    speedToleranceMetresPerSecond: "m/s",
    vesselId: "id"
  },
  "PrincipiaPlanSendArgs": {
    composedAtViewUt: "ut",
    desiredFinalTimeUt: "ut",
    observedAtUt: "ut",
    requestId: "id",
    vesselId: "id"
  },
  "PrincipiaPlanSlotArgs": {
    finalTimeUt: "ut",
    requestId: "id",
    vesselId: "id"
  },
  "PrincipiaPlanWriteReceipt": {
    refusal: "id",
    refusalDetail: "text",
    replayed: "flag",
    requestId: "id",
    statusError: "enum",
    statusMessage: "text"
  },
  "PrincipiaPlannedBurn": {
    anomalous: "flag",
    centreBody: "text",
    coordinateSystem: "enum",
    cutoffUt: "ut",
    deltaV: "m/s",
    deltaVBinormal: "m/s",
    deltaVNormal: "m/s",
    deltaVTangent: "m/s",
    durationSeconds: "s",
    executing: "flag",
    finalMassTons: "t",
    frameEditable: "flag",
    frameType: "enum",
    ignitionUt: "ut",
    index: "count",
    inertiallyFixed: "flag",
    initialMassTons: "t",
    massFlowKilogramsPerSecond: "kg/s",
    primaryBodies: "text",
    primaryBody: "text",
    secondaryBodies: "text",
    secondaryBody: "text",
    specificImpulseSeconds: "isp",
    thrustKilonewtons: "kN",
    timeToHalfDeltaVSeconds: "s"
  },
  "PrincipiaRatioInterval": {
    max: "1",
    min: "1"
  },
  "PrincipiaReferenceFrame": {
    centreBody: "text",
    primaryBodies: "text",
    primaryBody: "text",
    secondaryBodies: "text",
    secondaryBody: "text",
    selector: "text",
    targetFrameSelected: "flag",
    targetPrimaryBody: "text",
    targetVesselId: "id",
    targetVesselName: "text",
    type: "enum"
  },
  "PrincipiaSettings": {
    analysisMissionDurationRequestedSeconds: "s",
    displayPatchedConics: "flag",
    flightPlanCount: "count",
    flushThreshold: "count",
    framesHidingUnpinnedCelestials: "count",
    framesHidingUnpinnedMarkers: "count",
    groundTrackRevolution: "count",
    historyLengthSeconds: "s",
    journaling: "flag",
    logThreshold: "count",
    observedAtUt: "ut",
    optimiserTargetAltitudeMetres: "m",
    optimiserTargetInclinationDegrees: "\xB0",
    pinnedCelestials: "text",
    planActualFinalTimeUt: "ut",
    planDesiredFinalTimeUt: "ut",
    planInitialTimeUt: "ut",
    planMaxSteps: "count",
    planToleranceMetres: "m",
    pluginVersion: "text",
    predictionMaxSteps: "count",
    predictionToleranceMetres: "m",
    predictionVesselId: "id",
    readingSuspended: "flag",
    readingSuspendedReason: "text",
    recordJournalRequested: "flag",
    recurrenceAutodetect: "flag",
    recurrenceDaysPerCycle: "count",
    recurrenceRevolutionsPerCycle: "count",
    selectedFlightPlan: "count",
    selectingTargetCelestial: "flag",
    selectingTargetVessel: "flag",
    showElementGraphs: "flag",
    showManoeuvreOnNavball: "flag",
    stabilityGridMaxEccentricityMinInclination: "flag",
    stabilityGridMinEccentricityMaxInclination: "flag",
    stderrThreshold: "count",
    targetCelestialBody: "text",
    targetPinned: "flag",
    targetVesselId: "id",
    targetVesselName: "text",
    unpinnedCelestialsHiddenHere: "flag",
    unpinnedMarkersHiddenHere: "flag",
    verboseLevel: "count"
  },
  "PrincipiaWriteSurface": {
    analysedVersion: "text",
    armed: "flag",
    available: "flag",
    burnLayoutVerified: "flag",
    detectedVersion: "text",
    integratorLayoutVerified: "flag",
    reason: "text"
  }
};
var GENERATED_TOPIC_UNITS = {
  "principia.analysis": {
    sampledAtUt: "ut",
    vesselId: "id"
  },
  "principia.plan": {
    actualFinalTimeUt: "ut",
    anomalousBurnCount: "count",
    desiredFinalTimeUt: "ut",
    firstFutureBurnIndex: "count",
    initialTimeUt: "ut",
    optimisationRunning: "flag",
    planCount: "count",
    planExists: "flag",
    planIntegrated: "flag",
    reachedDeadline: "flag",
    sampledAtUt: "ut",
    selectedPlan: "count",
    statusError: "enum",
    statusMessage: "text",
    vesselId: "id"
  },
  "principia.settings": {
    analysisMissionDurationRequestedSeconds: "s",
    displayPatchedConics: "flag",
    flightPlanCount: "count",
    flushThreshold: "count",
    framesHidingUnpinnedCelestials: "count",
    framesHidingUnpinnedMarkers: "count",
    groundTrackRevolution: "count",
    historyLengthSeconds: "s",
    journaling: "flag",
    logThreshold: "count",
    observedAtUt: "ut",
    optimiserTargetAltitudeMetres: "m",
    optimiserTargetInclinationDegrees: "\xB0",
    pinnedCelestials: "text",
    planActualFinalTimeUt: "ut",
    planDesiredFinalTimeUt: "ut",
    planInitialTimeUt: "ut",
    planMaxSteps: "count",
    planToleranceMetres: "m",
    pluginVersion: "text",
    predictionMaxSteps: "count",
    predictionToleranceMetres: "m",
    predictionVesselId: "id",
    readingSuspended: "flag",
    readingSuspendedReason: "text",
    recordJournalRequested: "flag",
    recurrenceAutodetect: "flag",
    recurrenceDaysPerCycle: "count",
    recurrenceRevolutionsPerCycle: "count",
    selectedFlightPlan: "count",
    selectingTargetCelestial: "flag",
    selectingTargetVessel: "flag",
    showElementGraphs: "flag",
    showManoeuvreOnNavball: "flag",
    stabilityGridMaxEccentricityMinInclination: "flag",
    stabilityGridMinEccentricityMaxInclination: "flag",
    stderrThreshold: "count",
    targetCelestialBody: "text",
    targetPinned: "flag",
    targetVesselId: "id",
    targetVesselName: "text",
    unpinnedCelestialsHiddenHere: "flag",
    unpinnedMarkersHiddenHere: "flag",
    verboseLevel: "count"
  }
};
var GENERATED_TYPE_SHAPES = {
  "PrincipiaAnalysis": {
    coasts: "PrincipiaCoastAnalysis[]",
    orbit: "PrincipiaOrbitAnalysis"
  },
  "PrincipiaCoastAnalysis": {
    analysis: "PrincipiaOrbitAnalysis"
  },
  "PrincipiaOrbitAnalysis": {
    ascendingCrossingDegrees: "PrincipiaAngleInterval",
    ascendingNodeSolarTimeDegrees: "PrincipiaAngleInterval",
    descendingCrossingDegrees: "PrincipiaAngleInterval",
    descendingNodeSolarTimeDegrees: "PrincipiaAngleInterval",
    meanApoapsisAltitudeMetres: "PrincipiaLengthInterval",
    meanArgumentOfPeriapsisDegrees: "PrincipiaAngleInterval",
    meanEccentricity: "PrincipiaRatioInterval",
    meanInclinationDegrees: "PrincipiaAngleInterval",
    meanLongitudeOfAscendingNodeDegrees: "PrincipiaAngleInterval",
    meanPeriapsisAltitudeMetres: "PrincipiaLengthInterval",
    meanSemimajorAxisMetres: "PrincipiaLengthInterval"
  },
  "PrincipiaPlan": {
    burns: "PrincipiaPlannedBurn[]",
    integrator: "PrincipiaPlanIntegrator",
    writeSurface: "PrincipiaWriteSurface"
  },
  "PrincipiaPlanSendArgs": {
    burns: "PrincipiaComposedBurn[]"
  },
  "PrincipiaPlanWriteReceipt": {
    plan: "PrincipiaPlan"
  },
  "PrincipiaSettings": {
    burnFrames: "PrincipiaReferenceFrame[]",
    plottingFrame: "PrincipiaReferenceFrame"
  }
};
var GENERATED_TOPIC_SHAPES = {
  "principia.analysis": {
    coasts: "PrincipiaCoastAnalysis[]",
    orbit: "PrincipiaOrbitAnalysis"
  },
  "principia.plan": {
    burns: "PrincipiaPlannedBurn[]",
    integrator: "PrincipiaPlanIntegrator",
    writeSurface: "PrincipiaWriteSurface"
  },
  "principia.settings": {
    burnFrames: "PrincipiaReferenceFrame[]",
    plottingFrame: "PrincipiaReferenceFrame"
  }
};
var GENERATED_TYPE_ENUMS = {};
var GENERATED_TOPIC_ENUMS = {};
var GENERATED_TYPE_STATICS = {};
var GENERATED_TOPIC_STATICS = {};
var GENERATED_ENUM_MEMBERS = {};
var GENERATED_CONTRACT_TAGS = {
  topics: {
    "principia.analysis": {
      "coasts.*.analysis.progressOfNextAnalysis": { kind: "continuous" },
      "orbit.progressOfNextAnalysis": { kind: "continuous" }
    }
  },
  reckonable: []
};

// src/topics.ts
registerUplinkTopic("principia.plan");
registerUplinkTopic("principia.settings");
registerUplinkTopic("principia.analysis");
for (const topic of [
  "principia.plan",
  "principia.settings",
  "principia.analysis"
]) {
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

// src/commands.ts
import { registerUplinkCommand } from "@ksp-gonogo/sitrep-sdk";

// src/__generated__/command-map.ts
var GENERATED_COMMAND_RAIL = {
  "principia.plan.arm": { replies: true, delayed: true },
  "principia.plan.burn.insert": { replies: true, delayed: true },
  "principia.plan.burn.remove": { replies: true, delayed: true },
  "principia.plan.burn.replace": { replies: true, delayed: true },
  "principia.plan.create": { replies: true, delayed: true },
  "principia.plan.delete": { replies: true, delayed: true },
  "principia.plan.duplicate": { replies: true, delayed: true },
  "principia.plan.horizon": { replies: true, delayed: true },
  "principia.plan.integrator": { replies: true, delayed: true },
  "principia.plan.send": { replies: true, delayed: true }
};
var GENERATED_COMMAND_IDS = [
  "principia.plan.arm",
  "principia.plan.burn.insert",
  "principia.plan.burn.remove",
  "principia.plan.burn.replace",
  "principia.plan.create",
  "principia.plan.delete",
  "principia.plan.duplicate",
  "principia.plan.horizon",
  "principia.plan.integrator",
  "principia.plan.send"
];

// src/commands.ts
for (const id of GENERATED_COMMAND_IDS) {
  registerUplinkCommand(id, GENERATED_COMMAND_RAIL[id]);
}

// src/settings/registerPrincipiaSettings.ts
import {
  magnitudeOf,
  registerSetting,
  SettingKind
} from "@ksp-gonogo/sitrep-sdk";

// src/plottingFrame.ts
import { NULL_DISPLAY } from "@ksp-gonogo/ui-kit";
var FRAME_TYPE = {
  /** `BODY_CENTRED_NON_ROTATING`. Centre-bearing, so apsides exist in it. */
  bodyCentredInertial: 6e3,
  /** `BARYCENTRIC_ROTATING`. The producer's own descriptions read "DEPRECATED". */
  barycentricRotating: 6001,
  /** `BODY_CENTRED_PARENT_DIRECTION`. Illegal for a root body. */
  parentDirection: 6002,
  /** `BODY_SURFACE`. Force-selected on atmospheric entry in surface speed mode. */
  bodySurface: 6003,
  /** `ROTATING_PULSATING`. Lagrange frame; lengths in it are not lengths. */
  rotatingPulsating: 6004
};
var FRAME_NAMES = {
  [FRAME_TYPE.bodyCentredInertial]: "<centre>-Centred Inertial",
  [FRAME_TYPE.barycentricRotating]: "Barycentric rotating",
  [FRAME_TYPE.parentDirection]: "<secondary>\u2013<primary>\u2013Orbit",
  [FRAME_TYPE.bodySurface]: "<centre>-Centred <centre>-Fixed",
  [FRAME_TYPE.rotatingPulsating]: "<primary>\u2013<secondary> Lagrange"
};
var TARGET_FRAME_NAME = "Target\u2013<targetPrimary>\u2013Orbit";
var FRAME_KINDS = {
  [FRAME_TYPE.bodyCentredInertial]: "Body-centred inertial",
  [FRAME_TYPE.barycentricRotating]: "Barycentric rotating",
  [FRAME_TYPE.parentDirection]: "Body-centred parent direction",
  [FRAME_TYPE.bodySurface]: "Body surface",
  [FRAME_TYPE.rotatingPulsating]: "Rotating pulsating"
};
function plottingFrameKindLabel(ordinal, targetFrameSelected) {
  if (targetFrameSelected) return "Target frame";
  if (ordinal === null || ordinal === void 0) return NULL_DISPLAY;
  return FRAME_KINDS[ordinal] ?? `Frame ${ordinal}`;
}
function plottingFrameLabel(ordinal, bodies) {
  const named = typeof bodies === "string" ? { centre: bodies } : bodies ?? {};
  if (named.targetSelected === true) {
    return TARGET_FRAME_NAME.replace(
      /<targetPrimary>/g,
      named.targetPrimary ?? "<targetPrimary>"
    );
  }
  if (ordinal === null || ordinal === void 0) return NULL_DISPLAY;
  const template = FRAME_NAMES[ordinal];
  if (template === void 0) {
    const centre = named.centre;
    return centre ? `Frame ${ordinal}, ${centre}` : `Frame ${ordinal}`;
  }
  return template.replace(/<centre>/g, named.centre ?? "<centre>").replace(/<primary>/g, named.primary ?? "<primary>").replace(/<secondary>/g, named.secondary ?? "<secondary>");
}
function frameLengthsPulsate(ordinal) {
  return ordinal === FRAME_TYPE.rotatingPulsating;
}
function frameHasApsides(ordinal, targetFrameSelected) {
  if (targetFrameSelected) return false;
  return ordinal === FRAME_TYPE.bodyCentredInertial || ordinal === FRAME_TYPE.parentDirection || ordinal === FRAME_TYPE.bodySurface;
}

// src/settings/registerPrincipiaSettings.ts
var CATEGORY = "Principia";
var GROUP = {
  frame: "Plotting frame",
  target: "Target",
  ksp: "KSP features",
  prediction: "Prediction",
  plan: "Flight plan",
  analysis: "Analysis",
  drawing: "Drawing",
  navball: "In-game navball",
  diagnostics: "Diagnostics"
};
function settings(payload) {
  return payload ?? void 0;
}
function frame(payload) {
  return settings(payload)?.plottingFrame ?? void 0;
}
function bodyList(names) {
  if (names == null || names.length === 0) return void 0;
  return names.join(", ");
}
function burnFrameLabels(frames) {
  if (frames == null || frames.length === 0) return void 0;
  return frames.map(
    (f) => plottingFrameLabel(f.type, {
      centre: f.centreBody,
      primary: f.primaryBody,
      secondary: f.secondaryBody
    })
  ).join(", ");
}
function sameFrame(a, b) {
  return a.type === b.type && a.centreBody === b.centreBody && a.primaryBody === b.primaryBody && a.secondaryBody === b.secondaryBody;
}
var SEVERITY_NAMES = {
  0: "INFO",
  1: "WARNING",
  2: "ERROR",
  3: "FATAL"
};
function severityName(ordinal) {
  if (ordinal === void 0) return void 0;
  return SEVERITY_NAMES[ordinal] ?? `Severity ${ordinal}`;
}
function ordinalOf(v) {
  return magnitudeOf(v) ?? void 0;
}
var row = (def) => def;
var PRINCIPIA_SETTINGS = [
  // ---- The session itself ----
  row({
    id: "principia.settings.health",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => {
      const s = settings(p);
      if (s === void 0) return void 0;
      if (s.readingSuspended === true) return "Reading suspended";
      if (s.pluginVersion === void 0) return "No session bound";
      return "Reading";
    },
    category: CATEGORY,
    label: "Principia",
    description: "Whether this Uplink is reading the plugin at all. Every row below goes quiet together when it is not, so this is the row that answers why.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.suspendedReason",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => settings(p)?.readingSuspendedReason,
    category: CATEGORY,
    label: "Why reading stopped",
    description: "Present only while reading is suspended. The commonest cause is the plugin recording a journal, which our polling would write itself into.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.build",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => settings(p)?.pluginVersion,
    category: CATEGORY,
    label: "Build",
    description: "The plugin build string as the session's version gate read it. What the gate compares against when it closes.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.observedAt",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.observedAtUt,
    category: CATEGORY,
    label: "Read at",
    description: "When these settings were last read from the plugin.",
    screens: ["main"]
  }),
  // ---- Plotting frame ----
  row({
    id: "principia.settings.frame",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => {
      const f = frame(p);
      if (f === void 0) return void 0;
      return plottingFrameLabel(f.type, {
        centre: f.centreBody,
        primary: f.primaryBody,
        secondary: f.secondaryBody,
        targetPrimary: f.targetPrimaryBody,
        targetSelected: f.targetFrameSelected
      });
    },
    category: CATEGORY,
    group: GROUP.frame,
    label: "Frame",
    description: "The frame every trajectory, node and apsis on this board is expressed in, under the name the game gives it. The same vessel reads as a different orbit in a different frame.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.frameKind",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => {
      const f = frame(p);
      return f === void 0 ? void 0 : plottingFrameKindLabel(f.type, f.targetFrameSelected);
    },
    category: CATEGORY,
    group: GROUP.frame,
    label: "Frame kind",
    description: "Which sort of frame that is, undeclined by its bodies.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.frameSelector",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => frame(p)?.selector,
    category: CATEGORY,
    group: GROUP.frame,
    label: "Selector",
    description: "The plugin's own name for the selector instance this frame came from.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.frameCentre",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => frame(p)?.centreBody,
    category: CATEGORY,
    group: GROUP.frame,
    label: "Centre body",
    description: "Absent in the frames that have no centre, which is also why they have no apsides.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.framePrimary",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => frame(p)?.primaryBody,
    category: CATEGORY,
    group: GROUP.frame,
    label: "Primary body",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.frameSecondary",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => frame(p)?.secondaryBody,
    category: CATEGORY,
    group: GROUP.frame,
    label: "Secondary body",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.framePrimaries",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => bodyList(frame(p)?.primaryBodies),
    category: CATEGORY,
    group: GROUP.frame,
    label: "Primary bodies",
    description: "A rotating-pulsating frame is anchored to a whole set rather than to one body.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.frameSecondaries",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => bodyList(frame(p)?.secondaryBodies),
    category: CATEGORY,
    group: GROUP.frame,
    label: "Secondary bodies",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.frameTargetSelected",
    backing: "stream-backed",
    type: SettingKind.Bool,
    topic: "principia.settings",
    select: (p) => frame(p)?.targetFrameSelected,
    category: CATEGORY,
    group: GROUP.frame,
    label: "Target frame selected",
    description: "The target frame overrides the choice above, and clearing the target silently changes the frame back.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.frameTargetVessel",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => frame(p)?.targetVesselName,
    category: CATEGORY,
    group: GROUP.frame,
    label: "Frame target vessel",
    description: "Which vessel the target frame is anchored to.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.frameTargetPrimary",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => frame(p)?.targetPrimaryBody,
    category: CATEGORY,
    group: GROUP.frame,
    label: "Frame target primary",
    description: "The body that vessel orbits. It is what the target frame's plane is taken from, and what the game declines the frame's name with, so it is a different body from the centre above.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.frameHasApsides",
    backing: "stream-backed",
    type: SettingKind.Bool,
    topic: "principia.settings",
    select: (p) => {
      const f = frame(p);
      return f === void 0 ? void 0 : frameHasApsides(f.type, f.targetFrameSelected);
    },
    category: CATEGORY,
    group: GROUP.frame,
    label: "Apsides exist in this frame",
    description: "Off means an apsis here is undefined rather than unmeasured, which is a different thing to tell an operator hunting a missing marker.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.frameLengthsPulsate",
    backing: "stream-backed",
    type: SettingKind.Bool,
    topic: "principia.settings",
    select: (p) => {
      const f = frame(p);
      return f === void 0 ? void 0 : frameLengthsPulsate(f.type);
    },
    category: CATEGORY,
    group: GROUP.frame,
    label: "Lengths pulsate in this frame",
    description: "On means the frame's length unit varies with time, so an absolute distance quoted in it is not a distance.",
    screens: ["main"]
  }),
  // ---- Target ----
  row({
    id: "principia.settings.targetVessel",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => settings(p)?.targetVesselName,
    category: CATEGORY,
    group: GROUP.target,
    label: "Target vessel",
    description: "Not informational. It gates the target frame and every closest-approach number, and clearing it force-unsets that frame, which silently changes the plotted curve.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.targetCelestial",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => settings(p)?.targetCelestialBody,
    category: CATEGORY,
    group: GROUP.target,
    label: "Target celestial",
    description: "Set instead of a target vessel when the target is a body.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.selectingTargetVessel",
    backing: "stream-backed",
    type: SettingKind.Bool,
    topic: "principia.settings",
    select: (p) => settings(p)?.selectingTargetVessel,
    category: CATEGORY,
    group: GROUP.target,
    label: "Picking a target vessel in game",
    description: "On means the player's map is waiting for a click. The next target change comes from the map rather than from anything on this board.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.selectingTargetCelestial",
    backing: "stream-backed",
    type: SettingKind.Bool,
    topic: "principia.settings",
    select: (p) => settings(p)?.selectingTargetCelestial,
    category: CATEGORY,
    group: GROUP.target,
    label: "Picking a target celestial in game",
    description: "Arming either picker disarms the other, so both on is a state the game cannot be in.",
    screens: ["main"]
  }),
  // ---- KSP features ----
  row({
    id: "principia.settings.patchedConics",
    backing: "stream-backed",
    type: SettingKind.Bool,
    topic: "principia.settings",
    select: (p) => settings(p)?.displayPatchedConics,
    category: CATEGORY,
    group: GROUP.ksp,
    label: "Stock patched conics also drawn",
    description: "On means the game is drawing two contradictory futures at once. The plugin's own label for this setting ends: do not use for flight planning.",
    screens: ["main"]
  }),
  // ---- Prediction ----
  row({
    id: "principia.settings.predictionVessel",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => settings(p)?.predictionVesselId,
    category: CATEGORY,
    group: GROUP.prediction,
    label: "Prediction read for",
    description: "The two bounds below are per-vessel, so without this they would read as global and mislead about every other craft.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.predictionTolerance",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.predictionToleranceMetres,
    category: CATEGORY,
    group: GROUP.prediction,
    label: "In-game prediction tolerance",
    description: "Principia's own position tolerance for that vessel's prediction, read off the plugin's per-vessel integrator parameters rather than off its slider, so it is what the prediction actually held to. It bounds the curve the PLAYER sees; nothing this console draws is bounded by it.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.predictionMaxSteps",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.predictionMaxSteps,
    category: CATEGORY,
    group: GROUP.prediction,
    label: "In-game prediction step limit",
    description: "Principia's own step limit for that vessel's prediction, read off the plugin. A prediction that stopped short looks exactly like a trajectory that ended, and this is the only number separating them. It is the game's limit, not a drawing budget of ours, and it can only be changed in game.",
    screens: ["main"]
  }),
  // ---- Flight plan ----
  row({
    id: "principia.settings.flightPlanCount",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.flightPlanCount,
    category: CATEGORY,
    group: GROUP.plan,
    label: "Flight plans held",
    description: "How many the vessel is carrying, up to the plugin's ten. Every number in this group belongs to whichever of them is selected.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.selectedFlightPlan",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.selectedFlightPlan,
    category: CATEGORY,
    group: GROUP.plan,
    label: "Selected flight plan",
    description: "Counted from zero, and minus one means none is selected. That is a state rather than a low index: with none selected the rows below describe nothing.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.planInitialTime",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.planInitialTimeUt,
    category: CATEGORY,
    group: GROUP.plan,
    label: "Plan begins",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.planDesiredFinalTime",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.planDesiredFinalTimeUt,
    category: CATEGORY,
    group: GROUP.plan,
    label: "Plan asked to end",
    description: "Shortening it makes later burns vanish, and a burn that disappeared reads as a burn somebody deleted.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.planActualFinalTime",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.planActualFinalTimeUt,
    category: CATEGORY,
    group: GROUP.plan,
    label: "Plan reached",
    description: "Short of the row above exactly when the plan is in trouble, and the step limit below is the usual remedy.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.planTolerance",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.planToleranceMetres,
    category: CATEGORY,
    group: GROUP.plan,
    label: "In-game plan tolerance",
    description: "Principia's own integration tolerance for the flight plan, read off the plugin. A different setting from the prediction's despite sharing a label in game, and nothing this console draws is bounded by it.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.planMaxSteps",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.planMaxSteps,
    category: CATEGORY,
    group: GROUP.plan,
    label: "In-game plan step limit",
    description: "Principia's own step limit per plan segment, read off the plugin. Raising it in game is the remedy for the commonest reason a plan could not be drawn; nothing on this board changes it or is bounded by it.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.optimiserAltitude",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.optimiserTargetAltitudeMetres,
    category: CATEGORY,
    group: GROUP.plan,
    label: "Optimiser target altitude",
    description: "What the in-game plan optimiser is solving for. The body it is solving about is not a setting of its own: it comes from the plotting frame.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.optimiserInclination",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.optimiserTargetInclinationDegrees,
    category: CATEGORY,
    group: GROUP.plan,
    label: "Optimiser target inclination",
    description: "Absent when inclination is not an objective at all, which is a different instruction from zero: shown as zero it would read as an equatorial target nobody asked for.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.burnFrames",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => burnFrameLabels(settings(p)?.burnFrames),
    category: CATEGORY,
    group: GROUP.plan,
    label: "Man\u0153uvring frames",
    description: "Each burn's own frame, in plan order, so the delta-v triple beside it can be read.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.burnFrameDiffers",
    backing: "stream-backed",
    type: SettingKind.Bool,
    topic: "principia.settings",
    select: (p) => {
      const s = settings(p);
      const frames = s?.burnFrames;
      if (s === void 0 || frames == null || frames.length === 0) {
        return void 0;
      }
      const plotting = s.plottingFrame;
      if (plotting == null) return void 0;
      return frames.some((f) => !sameFrame(f, plotting));
    },
    category: CATEGORY,
    group: GROUP.plan,
    label: "A burn is planned in another frame",
    description: "The only in-game cue for this is suppressed while the burn editor is minimised, so on this board it is the operator's one reliable warning that a delta-v is quoted in a frame the map is not drawn in.",
    screens: ["main"]
  }),
  // ---- Analysis ----
  row({
    id: "principia.settings.analysisWindow",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.analysisMissionDurationRequestedSeconds,
    category: CATEGORY,
    group: GROUP.analysis,
    label: "Analysis window requested",
    description: "The window the in-game analyser was asked for. Widening it widens every interval it reports and can flip every adjective.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.recurrenceAutodetect",
    backing: "stream-backed",
    type: SettingKind.Bool,
    topic: "principia.settings",
    select: (p) => settings(p)?.recurrenceAutodetect,
    category: CATEGORY,
    group: GROUP.analysis,
    label: "Recurrence autodetected",
    description: "Off means the two rows below are the cycle the plugin was told to use in game.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.recurrenceRevolutions",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.recurrenceRevolutionsPerCycle,
    category: CATEGORY,
    group: GROUP.analysis,
    label: "Recurrence revolutions per cycle",
    description: "Inert for our own figures, and here for exactly that reason: it explains a disagreement between the player's screen and this one.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.recurrenceDays",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.recurrenceDaysPerCycle,
    category: CATEGORY,
    group: GROUP.analysis,
    label: "Recurrence days per cycle",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.groundTrackRevolution",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.groundTrackRevolution,
    category: CATEGORY,
    group: GROUP.analysis,
    label: "Ground-track revolution",
    description: "Which revolution the in-game equatorial-crossing longitudes are quoted for. Both change meaning with it, from a stepper off this screen.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.stabilityGridMaxEMinI",
    backing: "stream-backed",
    type: SettingKind.Bool,
    topic: "principia.settings",
    select: (p) => settings(p)?.stabilityGridMaxEccentricityMinInclination,
    category: CATEGORY,
    group: GROUP.analysis,
    label: "Stability grid: max e, min i",
    description: "Which contour family the in-game stability graph is read against. The same curve against the wrong family reads as the opposite conclusion.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.stabilityGridMinEMaxI",
    backing: "stream-backed",
    type: SettingKind.Bool,
    topic: "principia.settings",
    select: (p) => settings(p)?.stabilityGridMinEccentricityMaxInclination,
    category: CATEGORY,
    group: GROUP.analysis,
    label: "Stability grid: min e, max i",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.showElementGraphs",
    backing: "stream-backed",
    type: SettingKind.Bool,
    topic: "principia.settings",
    select: (p) => settings(p)?.showElementGraphs,
    category: CATEGORY,
    group: GROUP.analysis,
    label: "Element graphs shown in game",
    description: "A view toggle in game. Our graphs are a widget instead, so this is what explains this board having history the player's does not.",
    screens: ["main"]
  }),
  // ---- Drawing ----
  row({
    id: "principia.settings.historyLength",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.historyLengthSeconds,
    category: CATEGORY,
    group: GROUP.drawing,
    label: "History length drawn in game",
    description: "How much flown history the plugin draws, for the vessel and for every celestial. Our map keeps its own, so this exists to explain a disagreement between screens.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.markersHiddenHere",
    backing: "stream-backed",
    type: SettingKind.Bool,
    topic: "principia.settings",
    select: (p) => settings(p)?.unpinnedMarkersHiddenHere,
    category: CATEGORY,
    group: GROUP.drawing,
    label: "Markers hidden in this frame",
    description: "Apsis, node and approach markers, in the frame now selected. A marker missing in game reads as one that does not exist, which sends an operator after a physics problem that is a view setting.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.framesHidingMarkers",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.framesHidingUnpinnedMarkers,
    category: CATEGORY,
    group: GROUP.drawing,
    label: "Frames hiding unpinned markers",
    description: "Decluttering is per frame, and the map says whether this frame hides them. The total is here so that answer reads as one case of a habit.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.celestialsHiddenHere",
    backing: "stream-backed",
    type: SettingKind.Bool,
    topic: "principia.settings",
    select: (p) => settings(p)?.unpinnedCelestialsHiddenHere,
    category: CATEGORY,
    group: GROUP.drawing,
    label: "Celestial trajectories hidden in this frame",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.framesHidingCelestials",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.framesHidingUnpinnedCelestials,
    category: CATEGORY,
    group: GROUP.drawing,
    label: "Frames hiding unpinned celestials",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.pinnedCelestials",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => bodyList(settings(p)?.pinnedCelestials),
    category: CATEGORY,
    group: GROUP.drawing,
    label: "Pinned celestials",
    description: "The bodies pinned exempt from the two hide settings. Without them those settings are unfalsifiable: from outside, a hidden marker and an exempt one look the same.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.targetPinned",
    backing: "stream-backed",
    type: SettingKind.Bool,
    topic: "principia.settings",
    select: (p) => settings(p)?.targetPinned,
    category: CATEGORY,
    group: GROUP.drawing,
    label: "Target pinned",
    description: "Whether the target is exempt from hiding as well.",
    screens: ["main"]
  }),
  // ---- In-game navball ----
  row({
    id: "principia.settings.showManoeuvreOnNavball",
    backing: "stream-backed",
    type: SettingKind.Bool,
    topic: "principia.settings",
    select: (p) => settings(p)?.showManoeuvreOnNavball,
    category: CATEGORY,
    group: GROUP.navball,
    label: "Guidance shown on the in-game navball",
    description: "Whether the plugin is synthesising a stock-shaped manoeuvre node on the PLAYER's navball. It says nothing about this console's navball, which reads the guidance directly, and it is not a control: the plugin owns it and there is no writer.",
    screens: ["main"]
  }),
  // ---- Diagnostics ----
  row({
    id: "principia.settings.verboseLevel",
    backing: "stream-backed",
    type: SettingKind.Number,
    topic: "principia.settings",
    select: (p) => settings(p)?.verboseLevel,
    category: CATEGORY,
    group: GROUP.diagnostics,
    label: "Verbose level",
    description: "How much the plugin is writing, 0 to 4.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.logThreshold",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => severityName(ordinalOf(settings(p)?.logThreshold)),
    category: CATEGORY,
    group: GROUP.diagnostics,
    label: "Log file threshold",
    description: "The severity at or above which a message reaches the log file.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.stderrThreshold",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => severityName(ordinalOf(settings(p)?.stderrThreshold)),
    category: CATEGORY,
    group: GROUP.diagnostics,
    label: "Standard-error threshold",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.flushThreshold",
    backing: "stream-backed",
    type: SettingKind.Text,
    topic: "principia.settings",
    select: (p) => severityName(ordinalOf(settings(p)?.flushThreshold)),
    category: CATEGORY,
    group: GROUP.diagnostics,
    label: "Flush threshold",
    description: "The severity above which the log is flushed rather than buffered.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.recordJournalRequested",
    backing: "stream-backed",
    type: SettingKind.Bool,
    topic: "principia.settings",
    select: (p) => settings(p)?.recordJournalRequested,
    category: CATEGORY,
    group: GROUP.diagnostics,
    label: "Journal recording requested",
    description: "Takes effect on the next load, so it is deliberately not the same fact as the row below.",
    screens: ["main"]
  }),
  row({
    id: "principia.settings.journaling",
    backing: "stream-backed",
    type: SettingKind.Bool,
    topic: "principia.settings",
    select: (p) => settings(p)?.journaling,
    category: CATEGORY,
    group: GROUP.diagnostics,
    label: "Journal recording now",
    description: "On means a recorder is actually running, and we stop reading the plugin. Its journal records every call made through the plugin interface, ours included, and that journal is the artefact a bug report is made of.",
    screens: ["main"]
  })
];
for (const def of PRINCIPIA_SETTINGS) registerSetting(def);

// src/FlightPlanSection/index.tsx
import {
  registerAugment,
  useStream,
  useTelemetry,
  useViewUt
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge2,
  Cluster as Cluster2,
  Countdown as Countdown2,
  magnitudeOf as magnitudeOf4,
  NULL_DISPLAY as NULL_DISPLAY3,
  Row as Row2,
  RowName as RowName2,
  Section,
  SectionTitle as SectionTitle2,
  Stack as Stack2,
  Text as Text2,
  Unit as Unit2
} from "@ksp-gonogo/ui-kit";

// src/ignitionCountdown.ts
import { deriveReading } from "@ksp-gonogo/sitrep-sdk";
import { magnitudeOf as magnitudeOf2 } from "@ksp-gonogo/ui-kit";
function untilIgnition(plan, burnIndex, receivedUt) {
  const ignitionOf = (p) => {
    if (burnIndex === null) return void 0;
    const ignition = p.burns?.find(
      (burn) => magnitudeOf2(burn.index) === burnIndex
    )?.ignitionUt;
    return ignition?.isFinite() === true ? ignition : void 0;
  };
  return deriveReading(
    plan,
    (p) => receivedUt === void 0 ? void 0 : ignitionOf(p)?.minus(receivedUt),
    (p, atUt) => ignitionOf(p)?.minus(atUt)
  );
}

// src/PlanIntegration/index.tsx
import { useCommand, value } from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  Cluster,
  CommandButton,
  Countdown,
  MissionDate,
  MissionDateField,
  magnitudeOf as magnitudeOf3,
  NULL_DISPLAY as NULL_DISPLAY2,
  Row,
  RowName,
  SectionTitle,
  Stack,
  Stepper,
  Text,
  Unit
} from "@ksp-gonogo/ui-kit";
import { useState } from "react";

// src/__generated__/contract.ts
var PrincipiaWriteOutcome = /* @__PURE__ */ ((PrincipiaWriteOutcome2) => {
  PrincipiaWriteOutcome2[PrincipiaWriteOutcome2["Refused"] = 0] = "Refused";
  PrincipiaWriteOutcome2[PrincipiaWriteOutcome2["Rejected"] = 1] = "Rejected";
  PrincipiaWriteOutcome2[PrincipiaWriteOutcome2["Written"] = 2] = "Written";
  return PrincipiaWriteOutcome2;
})(PrincipiaWriteOutcome || {});

// src/__generated__/error-codes.ts
var PrincipiaErrorCodes = {
  /**
   * No plugin, no session, or a producer build whose write entry points were
   * never analysed. Writes fail closed to read-only.
   */
  SurfaceUnavailable: "principia.surfaceUnavailable",
  /**
   * The surface was not armed. Every plan write changes the player's saved game
   * and re-integrates on the game's own thread, so it takes a deliberate arm
   * first.
   */
  NotArmed: "principia.notArmed",
  /**
   * The struct this write passes to the plugin failed its round-trip probe, or
   * the probe has not run. A stale shape does not fail to resolve: it writes a
   * plausible wrong burn into the save.
   */
  LayoutUnverified: "principia.layoutUnverified",
  /**
   * The plugin no longer knows this vessel.
   */
  VesselUnknown: "principia.vesselUnknown",
  /**
   * The vessel holds no flight plan to edit.
   */
  NoFlightPlan: "principia.noFlightPlan",
  /**
   * A plan already exists and this write would have created a second without
   * being asked to.
   */
  PlanAlreadyExists: "principia.planAlreadyExists",
  /**
   * The vessel already holds the producer's maximum of ten plans. An eleventh
   * makes the producer's own planner window throw on every layout pass,
   * permanently, with the button that would delete it inside the part that
   * stopped rendering.
   */
  PlanSlotsFull: "principia.planSlotsFull",
  /**
   * The burn index was outside the count read in the same frame.
   */
  BurnIndexOutOfRange: "principia.burnIndexOutOfRange",
  /**
   * The burn is running right now. The plugin permits this and only the rebase
   * entry point checks, so the guard is ours.
   */
  BurnExecuting: "principia.burnExecuting",
  /**
   * The burn's manœuvring frame is one the producer's frame factory does not
   * handle, so sending the burn back would abort the game.
   */
  BurnFrameUnsupported: "principia.burnFrameUnsupported",
  /**
   * An optimisation is running on this plan and would revert the edit without
   * reporting it.
   */
  OptimisationRunning: "principia.optimisationRunning",
  /**
   * A requested value was not finite, or a Δv triple would have been.
   */
  ValueNotFinite: "principia.valueNotFinite",
  /**
   * Thrust is not positive. A zero-thrust burn has infinite duration, which the
   * producer's own singularity test does not catch: it pushes the plan's end
   * instant to infinity, spawns a thread that never terminates, and serialises
   * the infinity into the save.
   */
  ThrustNotPositive: "principia.thrustNotPositive",
  /**
   * The integrator kinds read back from the plugin were not the pair this build
   * expects, so writing them back could abort with no message. The read
   * succeeded, so this is neither unreadable nor a craft's capability.
   */
  IntegratorKindUnexpected: "principia.integratorKindUnexpected",
  /**
   * A requested integrator bound was outside the range the producer's own
   * controls offer.
   */
  IntegratorBoundsExceeded: "principia.integratorBoundsExceeded",
  /**
   * A plan cannot be created ending before it starts.
   */
  FinalTimeInPast: "principia.finalTimeInPast",
  /**
   * A field this write must set was not found on the producer's own struct, so
   * its shape is not the shape that was analysed. Nothing about the vessel was
   * established, so this is not a craft's capability.
   */
  PluginShapeChanged: "principia.pluginShapeChanged",
  /**
   * The ignition instant this write asked for had already passed by the time the
   * write arrived, which signal delay can cause with nothing done wrong at
   * either end. Distinct from `PrincipiaErrorCodes.FinalTimeInPast`, which is
   * about a plan's end and only reachable while creating one.
   */
  IgnitionInPast: "principia.ignitionInPast",
  /**
   * A composed plan that cannot be read as one: no burn list where a list was
   * required, a burn missing from the middle, more burns than a single command
   * may install, ignitions out of time order, or an end that falls before the
   * last burn. It refuses the whole plan, because a plan half-installed is a
   * trajectory nobody composed.
   */
  PlanMalformed: "principia.planMalformed",
  /**
   * A burn with no manœuvre ahead of it was asked for without the instant it
   * lights. An absent instant elsewhere means "leave it where it is", and a burn
   * with nothing ahead of it has no instant to be left at.
   */
  ComposedBurnIncomplete: "principia.composedBurnIncomplete",
  /**
   * A read a guard depends on could not be decoded from the loaded build, so the
   * guard cannot answer: whether a burn is under thrust, whether an optimisation
   * would revert the edit, or what the producer's clock reads. Refused rather
   * than permitted. Distinct from `PrincipiaErrorCodes.PluginShapeChanged`,
   * which is a field this write must set; this is a value this build could not
   * read.
   */
  GuardReadUnreadable: "principia.guardReadUnreadable"
};
var PRINCIPIA_ERROR_CODES = [
  {
    id: "principia.surfaceUnavailable",
    kind: "refusal",
    refines: "modeUnavailable",
    origin: null,
    sentence: "Principia's plan surface is not available",
    meaning: "No plugin, no session, or a producer build whose write entry points were never analysed. Writes fail closed to read-only."
  },
  {
    id: "principia.notArmed",
    kind: "refusal",
    refines: "notClearToProceed",
    origin: null,
    sentence: "plan writes are not armed",
    meaning: "The surface was not armed. Every plan write changes the player's saved game and re-integrates on the game's own thread, so it takes a deliberate arm first."
  },
  {
    id: "principia.layoutUnverified",
    kind: "refusal",
    refines: "modeUnavailable",
    origin: null,
    sentence: "this Principia build's plan layout is not verified",
    meaning: "The struct this write passes to the plugin failed its round-trip probe, or the probe has not run. A stale shape does not fail to resolve: it writes a plausible wrong burn into the save."
  },
  {
    id: "principia.vesselUnknown",
    kind: "refusal",
    refines: "noVessel",
    origin: null,
    sentence: "Principia does not know this vessel",
    meaning: "The plugin no longer knows this vessel."
  },
  {
    id: "principia.noFlightPlan",
    kind: "refusal",
    refines: "wrongState",
    origin: null,
    sentence: "the vessel has no flight plan",
    meaning: "The vessel holds no flight plan to edit."
  },
  {
    id: "principia.planAlreadyExists",
    kind: "refusal",
    refines: "wrongState",
    origin: null,
    sentence: "the vessel already has a flight plan",
    meaning: "A plan already exists and this write would have created a second without being asked to."
  },
  {
    id: "principia.planSlotsFull",
    kind: "refusal",
    refines: "limitReached",
    origin: null,
    sentence: "the vessel already holds ten flight plans",
    meaning: "The vessel already holds the producer's maximum of ten plans. An eleventh makes the producer's own planner window throw on every layout pass, permanently, with the button that would delete it inside the part that stopped rendering."
  },
  {
    id: "principia.burnIndexOutOfRange",
    kind: "refusal",
    refines: "notFound",
    origin: null,
    sentence: "the plan has no burn at that position",
    meaning: "The burn index was outside the count read in the same frame."
  },
  {
    id: "principia.burnExecuting",
    kind: "refusal",
    refines: "notClearToProceed",
    origin: null,
    sentence: "that burn is executing",
    meaning: "The burn is running right now. The plugin permits this and only the rebase entry point checks, so the guard is ours."
  },
  {
    id: "principia.burnFrameUnsupported",
    kind: "refusal",
    refines: "capabilityMismatch",
    origin: null,
    sentence: "Principia cannot take that burn's frame back",
    meaning: "The burn's man\u0153uvring frame is one the producer's frame factory does not handle, so sending the burn back would abort the game."
  },
  {
    id: "principia.optimisationRunning",
    kind: "refusal",
    refines: "notClearToProceed",
    origin: null,
    sentence: "an optimisation is running on the plan",
    meaning: "An optimisation is running on this plan and would revert the edit without reporting it."
  },
  {
    id: "principia.valueNotFinite",
    kind: "refusal",
    refines: "range",
    origin: null,
    sentence: "a value was not a finite number",
    meaning: "A requested value was not finite, or a \u0394v triple would have been."
  },
  {
    id: "principia.thrustNotPositive",
    kind: "refusal",
    refines: "range",
    origin: null,
    sentence: "the thrust is not positive",
    meaning: "Thrust is not positive. A zero-thrust burn has infinite duration, which the producer's own singularity test does not catch: it pushes the plan's end instant to infinity, spawns a thread that never terminates, and serialises the infinity into the save."
  },
  {
    id: "principia.integratorKindUnexpected",
    kind: "refusal",
    refines: "modeUnavailable",
    origin: null,
    sentence: "the plan's integrators are not a pair this Uplink expects",
    meaning: "The integrator kinds read back from the plugin were not the pair this build expects, so writing them back could abort with no message. The read succeeded, so this is neither unreadable nor a craft's capability."
  },
  {
    id: "principia.integratorBoundsExceeded",
    kind: "refusal",
    refines: "range",
    origin: null,
    sentence: "an integrator bound is outside what Principia offers",
    meaning: "A requested integrator bound was outside the range the producer's own controls offer."
  },
  {
    id: "principia.finalTimeInPast",
    kind: "refusal",
    refines: "range",
    origin: null,
    sentence: "the plan would end before it starts",
    meaning: "A plan cannot be created ending before it starts."
  },
  {
    id: "principia.pluginShapeChanged",
    kind: "refusal",
    refines: "unreadable",
    origin: null,
    sentence: "this Principia build's plan is not shaped as this Uplink expects",
    meaning: "A field this write must set was not found on the producer's own struct, so its shape is not the shape that was analysed. Nothing about the vessel was established, so this is not a craft's capability."
  },
  {
    id: "principia.ignitionInPast",
    kind: "refusal",
    refines: "range",
    origin: null,
    sentence: "the ignition time had already passed",
    meaning: "The ignition instant this write asked for had already passed by the time the write arrived, which signal delay can cause with nothing done wrong at either end. Distinct from `PrincipiaErrorCodes.FinalTimeInPast`, which is about a plan's end and only reachable while creating one."
  },
  {
    id: "principia.planMalformed",
    kind: "refusal",
    refines: "range",
    origin: null,
    sentence: "the composed plan cannot be read as one plan",
    meaning: "A composed plan that cannot be read as one: no burn list where a list was required, a burn missing from the middle, more burns than a single command may install, ignitions out of time order, or an end that falls before the last burn. It refuses the whole plan, because a plan half-installed is a trajectory nobody composed."
  },
  {
    id: "principia.composedBurnIncomplete",
    kind: "refusal",
    refines: "range",
    origin: null,
    sentence: "a first burn needs the time it lights",
    meaning: 'A burn with no man\u0153uvre ahead of it was asked for without the instant it lights. An absent instant elsewhere means "leave it where it is", and a burn with nothing ahead of it has no instant to be left at.'
  },
  {
    id: "principia.guardReadUnreadable",
    kind: "refusal",
    refines: "unreadable",
    origin: null,
    sentence: "a value a write guard needs would not read",
    meaning: "A read a guard depends on could not be decoded from the loaded build, so the guard cannot answer: whether a burn is under thrust, whether an optimisation would revert the edit, or what the producer's clock reads. Refused rather than permitted. Distinct from `PrincipiaErrorCodes.PluginShapeChanged`, which is a field this write must set; this is a value this build could not read."
  }
];

// src/planWrite.ts
function planWriteReceipt(reply) {
  const payload = reply.payload;
  if (typeof payload !== "object" || payload === null) return null;
  const candidate = payload;
  if (typeof candidate.outcome !== "number") return null;
  if (candidate.refusal != null && typeof candidate.refusal !== "string") {
    return null;
  }
  return candidate;
}
function nothingWasWritten(receipt) {
  if (receipt === null) return false;
  return receipt.replayed === true || receipt.outcome !== 2 /* Written */;
}
function planWriteRefusalLine(receipt) {
  if (receipt.outcome === 2 /* Written */) return null;
  const outcome = PrincipiaWriteOutcome[receipt.outcome] ?? receipt.outcome;
  const detail = receipt.refusalDetail;
  const codes = `${outcome}${refusalOf(receipt)}`;
  return detail ? `${codes}: ${detail}` : codes;
}
function refusalOf(receipt) {
  if (receipt.refusal) return ` / ${receipt.refusal}`;
  if (receipt.outcome !== 0 /* Refused */) return "";
  return ` / ${PrincipiaErrorCodes.SurfaceUnavailable}`;
}

// src/PlanIntegration/index.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var MAX_STEPS_OPTIONS = [
  64,
  256,
  1024,
  4096,
  16384,
  65536,
  262144,
  1048576
];
function frozenBecause(plan) {
  if (plan.optimisationRunning === true) {
    return "Principia is optimising this plan. A write made now is reverted without being reported: the optimiser publishes a new candidate plan and Principia's own planner swaps it over the live one every frame.";
  }
  if (plan.writeSurface?.armed !== true) {
    return plan.writeSurface?.reason ?? "The flight-plan write surface is not armed, so neither of these can be sent.";
  }
  return null;
}
function PlanIntegrationBlock({ plan }) {
  const integratorCmd = useCommand("principia.plan.integrator");
  const horizonCmd = useCommand("principia.plan.horizon");
  const [draftSteps, setDraftSteps] = useState(null);
  const [draftEndUt, setDraftEndUt] = useState(null);
  const [lastWrite, setLastWrite] = useState(
    null
  );
  if (plan == null) {
    return null;
  }
  const maxSteps = magnitudeOf3(plan.integrator?.maxSteps);
  const chosen = draftSteps ?? maxSteps;
  const desired = magnitudeOf3(plan.desiredFinalTimeUt);
  const actual = magnitudeOf3(plan.actualFinalTimeUt);
  const shortfall = desired === null || actual === null ? null : desired - actual;
  const frozenReason = frozenBecause(plan);
  const frozen = frozenReason !== null;
  const stepParametersUnverified = plan.writeSurface?.integratorLayoutVerified !== true;
  const endUt = draftEndUt ?? desired;
  const strandedBurns = endUt === null ? 0 : (plan.burns ?? []).filter((burn) => {
    const ignition = magnitudeOf3(burn.ignitionUt);
    return ignition !== null && ignition >= endUt;
  }).length;
  const startUt = magnitudeOf3(plan.initialTimeUt);
  const endsBeforeStart = endUt !== null && startUt !== null && endUt <= startUt;
  return /* @__PURE__ */ jsxs(Stack, { gap: "caption", "data-plan-integration": "", children: [
    /* @__PURE__ */ jsxs(Row, { as: "div", children: [
      /* @__PURE__ */ jsx(RowName, { children: "PLAN ENDS" }),
      plan.desiredFinalTimeUt == null ? /* @__PURE__ */ jsx(Text, { children: NULL_DISPLAY2 }) : /* @__PURE__ */ jsx(MissionDate, { value: plan.desiredFinalTimeUt })
    ] }),
    /* @__PURE__ */ jsxs(Row, { as: "div", children: [
      /* @__PURE__ */ jsx(RowName, { children: "REACHED" }),
      plan.actualFinalTimeUt == null ? /* @__PURE__ */ jsx(Text, { children: NULL_DISPLAY2 }) : /* @__PURE__ */ jsx(MissionDate, { value: plan.actualFinalTimeUt })
    ] }),
    shortfall !== null && shortfall > 0 && /* @__PURE__ */ jsxs(Text, { level: "faint", size: "sm", children: [
      "Stopped ",
      /* @__PURE__ */ jsx(Countdown, { value: shortfall }),
      " short of the requested end."
    ] }),
    endUt !== null && /* @__PURE__ */ jsxs(Stack, { gap: "caption", "data-plan-horizon": "", children: [
      /* @__PURE__ */ jsx(SectionTitle, { children: "PLAN END" }),
      /* @__PURE__ */ jsx(
        MissionDateField,
        {
          label: "Plan end",
          value: endUt,
          disabled: frozen,
          onChange: setDraftEndUt
        }
      ),
      /* @__PURE__ */ jsxs(Row, { as: "div", children: [
        /* @__PURE__ */ jsx(RowName, { children: "BURNS DROPPED" }),
        /* @__PURE__ */ jsx(Unit, { value: value("count", strandedBurns), decimals: 0 })
      ] }),
      /* @__PURE__ */ jsx(Cluster, { justify: "end", gap: "related-dense", wrap: true, children: /* @__PURE__ */ jsx(
        CommandButton,
        {
          size: "sm",
          handle: horizonCmd,
          args: {
            vesselId: plan.vesselId ?? void 0,
            requestId: `horizon-${plan.vesselId ?? "none"}-${endUt}`,
            desiredFinalTimeUt: endUt
          },
          commandLabel: "Move the flight plan's end instant",
          label: "SET END",
          confirmLabel: "CONFIRM",
          pendingLabel: "Setting...",
          disabled: frozen || endUt === desired || endsBeforeStart,
          "aria-label": "Move the flight plan's end instant",
          confirmAriaLabel: "Confirm moving the flight plan's end instant",
          onConfirmed: (result) => setLastWrite(planWriteReceipt(result))
        }
      ) }),
      strandedBurns > 0 && /* @__PURE__ */ jsx(Text, { tone: "warn", size: "sm", children: "Every burn igniting at or after this end is removed. Principia reports the write as a success and the burns are simply gone." }),
      endsBeforeStart && /* @__PURE__ */ jsx(Text, { tone: "warn", size: "sm", children: "A plan cannot end at or before it starts." })
    ] }),
    /* @__PURE__ */ jsxs(Row, { as: "div", children: [
      /* @__PURE__ */ jsx(RowName, { children: "POSITION TOL" }),
      plan.integrator?.lengthToleranceMetres == null ? /* @__PURE__ */ jsx(Text, { children: NULL_DISPLAY2 }) : /* @__PURE__ */ jsx(Unit, { value: plan.integrator.lengthToleranceMetres, decimals: 3 })
    ] }),
    /* @__PURE__ */ jsxs(Row, { as: "div", children: [
      /* @__PURE__ */ jsx(RowName, { children: "SPEED TOL" }),
      plan.integrator?.speedToleranceMetresPerSecond == null ? /* @__PURE__ */ jsx(Text, { children: NULL_DISPLAY2 }) : /* @__PURE__ */ jsx(
        Unit,
        {
          value: plan.integrator.speedToleranceMetresPerSecond,
          decimals: 3
        }
      )
    ] }),
    /* @__PURE__ */ jsxs(Row, { as: "div", children: [
      /* @__PURE__ */ jsx(RowName, { children: "MAX STEPS" }),
      /* @__PURE__ */ jsxs(Cluster, { justify: "end", gap: "related-dense", wrap: true, children: [
        /* @__PURE__ */ jsx(
          Stepper,
          {
            options: MAX_STEPS_OPTIONS,
            value: chosen,
            disabled: frozen,
            onChange: setDraftSteps,
            label: "Max integration steps per segment",
            format: (steps) => steps === null ? NULL_DISPLAY2 : steps.toLocaleString("en-GB")
          }
        ),
        /* @__PURE__ */ jsx(
          CommandButton,
          {
            size: "sm",
            handle: integratorCmd,
            args: {
              vesselId: plan.vesselId ?? void 0,
              requestId: `integrator-${plan.vesselId ?? "none"}-${chosen}`,
              // `undefined`, never a number, for a limit nobody stated: the mod
              // leaves an omitted step parameter at the plugin's own value. The
              // control is held shut in that state anyway, so this is the shape
              // of the args rather than a write that happens.
              maxSteps: chosen ?? void 0
            },
            commandLabel: "Set the flight plan's step limit",
            label: "SET",
            confirmLabel: "CONFIRM",
            pendingLabel: "Setting...",
            disabled: frozen || stepParametersUnverified || chosen === null || chosen === maxSteps,
            "aria-label": "Set the flight plan's step limit",
            confirmAriaLabel: "Confirm setting the flight plan's step limit",
            onConfirmed: (result) => setLastWrite(planWriteReceipt(result))
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx(Text, { level: "faint", size: "sm", children: "Raise this when the plan stops short of its requested end." }),
    maxSteps === null && /* @__PURE__ */ jsx(Text, { tone: "warn", size: "sm", children: "The plan's current step limit was not read, so there is nothing to raise it from. Stepping to a value sends that value as the new limit rather than an increase on the old one." }),
    plan.writeSurface?.armed === true && stepParametersUnverified && /* @__PURE__ */ jsx(Text, { tone: "warn", size: "sm", children: "Principia's step parameters have not survived a round trip in this session, so the step limit cannot be written. The plan's end can." }),
    nothingWasWritten(lastWrite) && /* @__PURE__ */ jsxs(Stack, { gap: "caption", role: "status", "aria-live": "polite", children: [
      /* @__PURE__ */ jsx(Cluster, { justify: "start", children: /* @__PURE__ */ jsx(Badge, { tone: "warn", children: "NOTHING WAS WRITTEN" }) }),
      lastWrite.replayed === true ? /* @__PURE__ */ jsx(Text, { level: "faint", size: "sm", children: "This matched a request already sent, so the mod answered with the earlier receipt instead of writing again. The plan still holds whatever the last write that DID land put there." }) : /* @__PURE__ */ jsx(Text, { level: "faint", size: "sm", children: planWriteRefusalLine(lastWrite) })
    ] }),
    frozenReason !== null && /* @__PURE__ */ jsx(Text, { level: "faint", size: "sm", children: frozenReason })
  ] });
}

// src/uplink.ts
import { defineUplinkClient, registerErrorCodes } from "@ksp-gonogo/sitrep-sdk";
var UPLINK_VERSION = "1.0.0-rc.1";
var PRINCIPIA = defineUplinkClient({
  id: "principia",
  version: UPLINK_VERSION,
  name: "Principia",
  description: "Principia's n-body flight on the dashboard: how far each trajectory holds, the flight plan and its burns, the reference frame they are quoted in, and the integrator settings.",
  tags: GENERATED_CONTRACT_TAGS
});
registerErrorCodes(PRINCIPIA_ERROR_CODES);

// src/FlightPlanSection/index.tsx
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function planView(reading) {
  switch (reading.state) {
    /**
     * The three absences are grouped on purpose: this section renders the contents
     * of a plan, and none of them has anything different to say about a plan there
     * is no content for. Which absence it is belongs to the widget frame around this
     * section, which says it once for the whole widget rather than once per section.
     */
    case "pending":
    case "absent":
    case "unowned":
      return { kind: "unread" };
    case "observed":
      return {
        kind: "seen",
        plan: reading.value,
        sampledAtUt: magnitudeOf4(reading.value.sampledAtUt) ?? magnitudeOf4(reading.atUt)
      };
    case "held":
      return {
        kind: "seen",
        plan: reading.value,
        sampledAtUt: magnitudeOf4(reading.value.sampledAtUt) ?? magnitudeOf4(reading.asOfUt)
      };
  }
}
function integrationBadge(plan) {
  if (plan.planIntegrated === false) {
    return /* @__PURE__ */ jsx2(Badge2, { tone: "nogo", children: "INTEGRATION FAILED" });
  }
  if (plan.planIntegrated == null) {
    return /* @__PURE__ */ jsx2(Badge2, { tone: "caution", children: "INTEGRATION STATUS UNKNOWN" });
  }
  return /* @__PURE__ */ jsx2(Badge2, { tone: "go", children: "INTEGRATED" });
}
function BurnRow({
  burn,
  planReading,
  receivedUt,
  isNext
}) {
  const index = magnitudeOf4(burn.index);
  return (
    // The burn number anchors left and everything else groups right, rather than
    // four values spread evenly across the row: evenly spaced columns drift out of
    // alignment between rows as the values change width, so a reader cannot scan
    // down one quantity. `Row` pins the group instead.
    /* @__PURE__ */ jsxs2(Row2, { as: "div", "data-burn-row": "", children: [
      /* @__PURE__ */ jsx2(RowName2, { children: index === null ? NULL_DISPLAY3 : `#${index + 1}` }),
      /* @__PURE__ */ jsxs2(Cluster2, { justify: "end", gap: "related-dense", children: [
        /* @__PURE__ */ jsx2(
          Countdown2,
          {
            value: untilIgnition(planReading, index, receivedUt),
            clock: true
          }
        ),
        burn.deltaV == null ? /* @__PURE__ */ jsx2(Text2, { children: NULL_DISPLAY3 }) : /* @__PURE__ */ jsx2(Unit2, { value: burn.deltaV, decimals: 0 }),
        burn.durationSeconds == null ? /* @__PURE__ */ jsx2(Text2, { children: NULL_DISPLAY3 }) : /* @__PURE__ */ jsx2(Countdown2, { value: burn.durationSeconds }),
        isNext && /* @__PURE__ */ jsx2(Badge2, { tone: "info", children: "NEXT" }),
        burn.anomalous === true && /* @__PURE__ */ jsx2(Badge2, { tone: "warn", children: "ANOM" }),
        burn.anomalous == null && /* @__PURE__ */ jsx2(Badge2, { tone: "caution", children: "ANOM UNREAD" })
      ] })
    ] })
  );
}
function buildBadge(roster) {
  const entry = roster?.uplinks.find((u) => u.id === PRINCIPIA.id);
  if (entry?.health.state !== "degraded") {
    return null;
  }
  return /* @__PURE__ */ jsx2(Badge2, { tone: "caution", children: "UNVETTED PRINCIPIA BUILD" });
}
function FlightPlanSection() {
  const planReading = useTelemetry("principia.plan");
  const view = planView(planReading);
  const identity = useTelemetry("vessel.identity");
  const healthReading = useStream("system.uplinkHealth");
  const buildHealth = healthReading.state === "observed" || healthReading.state === "held" ? healthReading.value : void 0;
  const receivedUt = useViewUt();
  const viewUt = magnitudeOf4(receivedUt);
  if (view.kind === "unread") {
    return /* @__PURE__ */ jsxs2(Section, { "data-flight-plan-section": "", children: [
      /* @__PURE__ */ jsx2(SectionTitle2, { children: "N-BODY FLIGHT PLAN" }),
      /* @__PURE__ */ jsxs2(Stack2, { role: "status", "aria-live": "polite", children: [
        /* @__PURE__ */ jsx2(Cluster2, { justify: "start", children: /* @__PURE__ */ jsx2(Badge2, { tone: "caution", children: "NO PLAN READING" }) }),
        /* @__PURE__ */ jsx2(Text2, { level: "faint", size: "sm", children: "No vessel, or no session with the integrator." })
      ] })
    ] });
  }
  const { plan, sampledAtUt } = view;
  const age = sampledAtUt === null || viewUt === null ? null : viewUt - sampledAtUt;
  const activeVesselId = vesselIdOf(identity);
  const isOtherVessel = activeVesselId !== null && plan.vesselId != null && plan.vesselId !== activeVesselId;
  return /* @__PURE__ */ jsxs2(Section, { "data-flight-plan-section": "", children: [
    /* @__PURE__ */ jsx2(SectionTitle2, { children: "N-BODY FLIGHT PLAN" }),
    /* @__PURE__ */ jsxs2(Stack2, { children: [
      /* @__PURE__ */ jsxs2(Cluster2, { wrap: true, justify: "start", gap: "related-dense", children: [
        age === null ? /* @__PURE__ */ jsx2(Badge2, { tone: "caution", children: "READ AT AN UNKNOWN TIME" }) : age <= 0 ? /* @__PURE__ */ jsx2(Badge2, { tone: "go", children: "READ NOW" }) : /* @__PURE__ */ jsxs2(Badge2, { tone: "caution", children: [
          "READ ",
          /* @__PURE__ */ jsx2(Countdown2, { value: age }),
          " AGO"
        ] }),
        plan.reachedDeadline === true && /* @__PURE__ */ jsx2(Badge2, { tone: "warn", children: "PLAN INCOMPLETE" }),
        integrationBadge(plan),
        buildBadge(buildHealth)
      ] }),
      isOtherVessel && /* @__PURE__ */ jsx2(Text2, { children: "This plan belongs to another vessel, not the active one." }),
      /* @__PURE__ */ jsx2(PlanIntegrationBlock, { plan }),
      plan.planExists === false ? (
        // A POSITIVE observation of no plan: the plugin was asked and said the
        // vessel holds none. Distinct from the unread case above, and safe to
        // state.
        /* @__PURE__ */ jsx2(Text2, { children: "No flight plan for this vessel." })
      ) : /* @__PURE__ */ jsxs2(Stack2, { children: [
        (plan.burns ?? []).map((burn) => /* @__PURE__ */ jsx2(
          BurnRow,
          {
            burn,
            planReading,
            receivedUt,
            isNext: isNextBurn(burn, plan)
          },
          magnitudeOf4(burn.index) ?? String(burn.ignitionUt)
        )),
        (plan.burns ?? []).length === 0 && /* @__PURE__ */ jsx2(Text2, { children: "A plan with no burns committed yet." })
      ] })
    ] })
  ] });
}
function isNextBurn(burn, plan) {
  const index = magnitudeOf4(burn.index);
  const next = magnitudeOf4(plan.firstFutureBurnIndex);
  return index !== null && next !== null && index === next;
}
function vesselIdOf(reading) {
  switch (reading.state) {
    case "observed":
      return reading.value.vesselId ?? null;
    case "held":
      return reading.value.vesselId ?? null;
    default:
      return null;
  }
}
registerAugment({
  id: "principia-flight-plan",
  augments: "maneuver-planner.sections",
  component: FlightPlanSection,
  owner: PRINCIPIA
});

// src/PlanSlots/index.tsx
import {
  registerAugment as registerAugment2,
  useCommand as useCommand3,
  useTelemetry as useTelemetry2,
  useViewUt as useViewUt3,
  value as value3
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge3,
  Cluster as Cluster3,
  CommandButton as CommandButton2,
  Countdown as Countdown3,
  MissionDate as MissionDate2,
  MissionDateField as MissionDateField2,
  magnitudeOf as magnitudeOf5,
  NULL_DISPLAY as NULL_DISPLAY4,
  Row as Row3,
  RowName as RowName3,
  Section as Section2,
  SectionTitle as SectionTitle3,
  Stack as Stack3,
  Text as Text3,
  Unit as Unit3
} from "@ksp-gonogo/ui-kit";
import { useState as useState3 } from "react";

// src/commandWindow.ts
import { value as value2 } from "@ksp-gonogo/sitrep-sdk";
var COMPOSING_MARGIN_SECONDS = 600;
function seededIgnitionUt(previous, viewUt, oneWaySeconds) {
  const roundTrip = oneWaySeconds === null ? 0 : 2 * Math.max(oneWaySeconds, 0);
  const flyable = viewUt.plus(value2("s", roundTrip + COMPOSING_MARGIN_SECONDS));
  if (previous === null) return flyable;
  const after = previous.plus(value2("s", COMPOSING_MARGIN_SECONDS));
  return after.greaterThan(flyable) ? after : flyable;
}
function commandWindow(targetUt, viewUt, oneWaySeconds) {
  if (targetUt === null || viewUt === null) return null;
  if (oneWaySeconds === null || oneWaySeconds <= 0) return null;
  const deadlineUt = targetUt - 2 * oneWaySeconds;
  const remainingSeconds = deadlineUt - viewUt;
  return {
    oneWaySeconds,
    deadlineUt,
    remainingSeconds,
    shut: remainingSeconds <= 0
  };
}

// src/planDrafts.ts
import {
  classifyCommandRejection,
  useCommand as useCommand2,
  useViewUt as useViewUt2
} from "@ksp-gonogo/sitrep-sdk";
import { useCallback, useState as useState2, useSyncExternalStore } from "react";
var PLAN_SEND_COMMAND = "principia.plan.send";
var WIRE_FIELDS = [
  "burns",
  "observedAt",
  "vesselId",
  "desiredFinalTimeUt"
];
var PlanDraftStore = class {
  drafts = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Set();
  nextId = 1;
  /** Rebuilt only on change, because `useSyncExternalStore` compares by identity. */
  snapshot = [];
  list() {
    return this.snapshot;
  }
  create(draft) {
    const created = { ...draft, id: `draft-${this.nextId}`, revision: 1 };
    this.nextId += 1;
    this.drafts.set(created.id, created);
    this.changed();
    return created;
  }
  update(id, changes) {
    const existing = this.drafts.get(id);
    if (existing === void 0) return void 0;
    const touchesTheWire = WIRE_FIELDS.some((field) => field in changes);
    const updated = {
      ...existing,
      ...changes,
      id,
      revision: existing.revision + (touchesTheWire ? 1 : 0)
    };
    this.drafts.set(id, updated);
    this.changed();
    return updated;
  }
  remove(id) {
    const had = this.drafts.delete(id);
    if (had) this.changed();
    return had;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  changed() {
    this.snapshot = [...this.drafts.values()];
    for (const listener of this.listeners) listener();
  }
};
var PLAN_DRAFTS = new PlanDraftStore();
function usePlanDrafts() {
  const subscribe = useCallback(
    (listener) => PLAN_DRAFTS.subscribe(listener),
    []
  );
  const drafts = useSyncExternalStore(
    subscribe,
    () => PLAN_DRAFTS.list(),
    () => PLAN_DRAFTS.list()
  );
  return { store: PLAN_DRAFTS, drafts };
}
function composedBurn(burn) {
  return {
    ignitionUt: burn.ignitionUt.magnitude,
    deltaVTangent: burn.deltaVTangent.magnitude,
    deltaVNormal: burn.deltaVNormal.magnitude,
    deltaVBinormal: burn.deltaVBinormal.magnitude,
    inertiallyFixed: burn.inertiallyFixed,
    profile: 0 /* Unchanged */
  };
}
function useSendDraft() {
  const command = useCommand2(PLAN_SEND_COMMAND);
  const viewUt = useViewUt2();
  const [pending, setPending] = useState2(false);
  const [outcome, setOutcome] = useState2(null);
  const send = useCallback(
    async (draft) => {
      const composedAtViewUt = viewUt?.magnitude;
      const refusal = whyNotSendable(draft, composedAtViewUt);
      if (refusal) {
        const refused = { accepted: false, refusal };
        setOutcome(refused);
        return refused;
      }
      setPending(true);
      try {
        const reply = await command.send({
          vesselId: draft.vesselId,
          requestId: `${draft.id}@${draft.revision}`,
          composedAtViewUt,
          observedAtUt: draft.observedAt.magnitude,
          desiredFinalTimeUt: draft.desiredFinalTimeUt,
          burns: draft.burns.map(composedBurn)
        });
        const next = outcomeOfReply(
          reply
        );
        setOutcome(next);
        return next;
      } catch (error) {
        const failed = refusalFromError(error);
        setOutcome(failed);
        return failed;
      } finally {
        setPending(false);
      }
    },
    [command, viewUt]
  );
  return { send, pending, outcome };
}
function whyNotSendable(draft, composedAtViewUt) {
  if (composedAtViewUt === void 0) {
    return "No view clock is mounted, so there is nothing to record as the instant this plan was composed against.";
  }
  if (draft.observedAt.magnitude > composedAtViewUt) {
    return "This plan was built from a state later than the view it was composed at, which cannot have been seen from here.";
  }
  return void 0;
}
function outcomeOfReply(reply) {
  if (reply?.success) return { accepted: true };
  return {
    accepted: false,
    refusal: reply?.detail && reply.detail.length > 0 ? reply.detail : "The vessel declined the plan and gave no reason. Check the flight-plan write surface is armed."
  };
}
function refusalFromError(error) {
  const rejection = classifyCommandRejection(error);
  if (rejection.kind === "refused") {
    return { accepted: false, refusal: rejection.detail ?? rejection.message };
  }
  if (rejection.kind === "lost") {
    return {
      accepted: false,
      refusal: `No answer to the plan arrived: ${rejection.message}. It may have been installed anyway.`
    };
  }
  return {
    accepted: false,
    refusal: `The plan did not reach the game: ${rejection.message}`
  };
}

// src/planReading.ts
function planView2(reading) {
  switch (reading.state) {
    case "pending":
      return { kind: "none", reason: "Waiting for Principia." };
    case "unowned":
      return {
        kind: "none",
        reason: "Nothing publishes this plan. The Principia Uplink declared no plan channel, so waiting will not help: check KSP's log for an Uplink load error."
      };
    case "absent":
      return {
        kind: "none",
        reason: "No plan reading. Principia is not running, or the console has no vessel."
      };
    case "observed":
      return { kind: "plan", plan: reading.value, outOfContact: null };
    case "held":
      return {
        kind: "plan",
        plan: reading.value,
        outOfContact: outOfContactReason(reading.grade)
      };
  }
}
function outOfContactReason(grade) {
  switch (grade) {
    case "held":
      return "This plan's updates stopped arriving. The burns below are the last set that did, and the burn count they are numbered against may have moved since.";
    case "disconnected":
      return "The stream is down. The burns below are the last set that reached us, and the burn count they are numbered against may have moved since.";
    case "last-before-blackout":
      return "This craft is out of contact. The burns below are the last set that got out before the blackout, and the burn count they are numbered against may have moved since.";
    case "recorded":
      return "The burns below came off this craft's own recording of the time it was out of contact, so they are exact for the moment shown and not for now. The burn count they are numbered against may have moved since.";
    case "loading":
      return "The game is loading a scene. The burns below are the last set sent before it began, and the burn count they are numbered against may have moved since.";
    case "no-game":
      return "No game is loaded. The burns below are the last set the game sent while one was.";
  }
}

// src/PlanSlots/index.tsx
import { Fragment, jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var MAX_FLIGHT_PLANS = 10;
var DEFAULT_PLAN_LENGTH_SECONDS = 3600;
function PlanSlots() {
  const view = planView2(useTelemetry2("principia.plan"));
  const viewUt = useViewUt3();
  const createCmd = useCommand3("principia.plan.create");
  const duplicateCmd = useCommand3("principia.plan.duplicate");
  const deleteCmd = useCommand3("principia.plan.delete");
  const sendCmd = useCommand3("principia.plan.send");
  const { drafts } = usePlanDrafts();
  const [endDraft, setEndDraft] = useState3(null);
  const [lastWrite, setLastWrite] = useState3(
    null
  );
  if (view.kind === "none") {
    return /* @__PURE__ */ jsxs3(Section2, { "data-plan-slots": "", children: [
      /* @__PURE__ */ jsx3(SectionTitle3, { children: "PLAN SLOTS" }),
      /* @__PURE__ */ jsxs3(Stack3, { role: "status", "aria-live": "polite", children: [
        /* @__PURE__ */ jsx3(Cluster3, { justify: "start", children: /* @__PURE__ */ jsx3(Badge3, { tone: "caution", children: "NO PLAN READING" }) }),
        /* @__PURE__ */ jsx3(Text3, { level: "faint", size: "sm", children: view.reason })
      ] })
    ] });
  }
  const { plan, outOfContact } = view;
  const surface = plan.writeSurface;
  const armed = surface?.armed === true;
  const planExists = plan.planExists === true;
  const vesselId = plan.vesselId ?? void 0;
  const burns = plan.burns ?? [];
  const planCount = magnitudeOf5(plan.planCount) ?? 0;
  const slotsFull = planCount >= MAX_FLIGHT_PLANS;
  const oneWaySeconds = createCmd.effectiveDelaySeconds;
  const roundTrip = oneWaySeconds === null ? 0 : 2 * Math.max(oneWaySeconds, 0);
  const arrival = viewUt === void 0 ? null : viewUt.plus(value3("s", roundTrip));
  const arrivalUt = magnitudeOf5(arrival);
  const seededEndUt = magnitudeOf5(
    arrival?.plus(value3("s", DEFAULT_PLAN_LENGTH_SECONDS))
  );
  const viewUtNumber = magnitudeOf5(viewUt);
  const endUt = planExists ? magnitudeOf5(plan.desiredFinalTimeUt) : endDraft ?? seededEndUt;
  const frozen = !armed || outOfContact !== null || plan.optimisationRunning === true;
  const installable = drafts.filter(
    (draft) => draft.vesselId === vesselId && draft.saved === true
  );
  return /* @__PURE__ */ jsxs3(Section2, { "data-plan-slots": "", children: [
    /* @__PURE__ */ jsx3(SectionTitle3, { children: "PLAN SLOTS" }),
    /* @__PURE__ */ jsxs3(Stack3, { children: [
      /* @__PURE__ */ jsxs3(Cluster3, { wrap: true, justify: "start", gap: "related-dense", children: [
        planExists ? /* @__PURE__ */ jsx3(Badge3, { tone: "info", children: `PLAN ${(magnitudeOf5(plan.selectedPlan) ?? -1) + 1} OF ${planCount}` }) : /* @__PURE__ */ jsx3(Badge3, { tone: "caution", children: "NO PLAN ON THIS VESSEL" }),
        slotsFull && /* @__PURE__ */ jsx3(Badge3, { tone: "warn", children: `SLOTS FULL AT ${MAX_FLIGHT_PLANS}` }),
        plan.optimisationRunning === true && /* @__PURE__ */ jsx3(Badge3, { tone: "warn", children: "OPTIMISING" }),
        armed ? /* @__PURE__ */ jsx3(Badge3, { tone: "go", children: "ARMED" }) : /* @__PURE__ */ jsx3(Badge3, { tone: "caution", children: "NOT ARMED" }),
        outOfContact !== null && /* @__PURE__ */ jsx3(Badge3, { tone: "warn", children: "OUT OF CONTACT" })
      ] }),
      surface?.reason && /* @__PURE__ */ jsx3(Text3, { level: "faint", size: "sm", children: surface.reason }),
      outOfContact !== null && /* @__PURE__ */ jsx3(Text3, { level: "faint", size: "sm", children: outOfContact }),
      /* @__PURE__ */ jsxs3(Stack3, { gap: "caption", children: [
        /* @__PURE__ */ jsxs3(Row3, { as: "div", children: [
          /* @__PURE__ */ jsx3(RowName3, { children: "PLAN STARTS" }),
          plan.initialTimeUt == null ? /* @__PURE__ */ jsx3(Text3, { children: NULL_DISPLAY4 }) : /* @__PURE__ */ jsx3(MissionDate2, { value: plan.initialTimeUt })
        ] }),
        /* @__PURE__ */ jsxs3(Row3, { as: "div", children: [
          /* @__PURE__ */ jsx3(RowName3, { children: "PLAN RUNS FOR" }),
          plan.initialTimeUt == null || plan.desiredFinalTimeUt == null ? /* @__PURE__ */ jsx3(Text3, { children: NULL_DISPLAY4 }) : /* @__PURE__ */ jsx3(
            Countdown3,
            {
              value: plan.desiredFinalTimeUt.minus(plan.initialTimeUt)
            }
          )
        ] }),
        /* @__PURE__ */ jsxs3(Row3, { as: "div", children: [
          /* @__PURE__ */ jsx3(RowName3, { children: "BURNS" }),
          /* @__PURE__ */ jsx3(Unit3, { value: value3("count", burns.length), decimals: 0 })
        ] })
      ] }),
      planExists ? /* @__PURE__ */ jsx3(
        ExistingPlan,
        {
          plan,
          vesselId,
          frozen,
          slotsFull,
          planCount,
          burnCount: burns.length,
          nextIgnitionUt: nextIgnitionUt(plan),
          viewUt: viewUtNumber,
          oneWaySeconds,
          duplicateCmd,
          deleteCmd,
          onWrite: setLastWrite
        }
      ) : null,
      !planExists && /* @__PURE__ */ jsxs3(Stack3, { gap: "caption", children: [
        /* @__PURE__ */ jsx3(SectionTitle3, { children: "NEW PLAN ENDS AT" }),
        endUt === null ? /* @__PURE__ */ jsx3(Text3, { level: "faint", size: "sm", children: "No view clock, so there is no instant to measure a plan's end against." }) : /* @__PURE__ */ jsxs3(Fragment, { children: [
          /* @__PURE__ */ jsx3(
            MissionDateField2,
            {
              label: "New plan end",
              value: endUt,
              disabled: frozen,
              onChange: setEndDraft
            }
          ),
          /* @__PURE__ */ jsxs3(Row3, { as: "div", children: [
            /* @__PURE__ */ jsx3(RowName3, { children: "LENGTH FROM ARRIVAL" }),
            arrivalUt === null ? /* @__PURE__ */ jsx3(Text3, { children: NULL_DISPLAY4 }) : /* @__PURE__ */ jsx3(Countdown3, { value: value3("s", endUt - arrivalUt) })
          ] }),
          arrivalUt !== null && endUt <= arrivalUt && /* @__PURE__ */ jsx3(Text3, { tone: "warn", size: "sm", children: "This end instant has already passed by the time the write arrives, and Principia asserts on a plan that ends before it starts rather than answering an error. Move it later." })
        ] }),
        /* @__PURE__ */ jsx3(Cluster3, { gap: "related-dense", wrap: true, justify: "start", children: /* @__PURE__ */ jsx3(
          CommandButton2,
          {
            size: "sm",
            tone: "go",
            handle: createCmd,
            args: {
              vesselId,
              requestId: `create-${vesselId ?? "none"}-${endUt ?? "none"}`,
              finalTimeUt: endUt ?? void 0
            },
            commandLabel: "Create a flight plan",
            label: "CREATE EMPTY PLAN",
            confirmLabel: "CONFIRM CREATE",
            confirmTone: "nogo",
            pendingLabel: "Creating...",
            onConfirmed: (result) => setLastWrite(planWriteReceipt(result)),
            disabled: frozen || endUt === null || arrivalUt !== null && endUt <= arrivalUt,
            "aria-label": "Create a flight plan for this vessel",
            confirmAriaLabel: "Confirm creating a flight plan for this vessel"
          }
        ) })
      ] }),
      /* @__PURE__ */ jsx3(
        InstallDrafts,
        {
          drafts: installable,
          plan,
          vesselId,
          endUt,
          arrivalUt,
          viewUt: viewUtNumber,
          oneWaySeconds,
          frozen,
          burnCount: burns.length,
          sendCmd,
          onWrite: setLastWrite
        }
      ),
      nothingWasWritten(lastWrite) && /* @__PURE__ */ jsxs3(Stack3, { gap: "caption", role: "status", "aria-live": "polite", children: [
        /* @__PURE__ */ jsx3(Cluster3, { justify: "start", children: /* @__PURE__ */ jsx3(Badge3, { tone: "warn", children: "NOTHING WAS WRITTEN" }) }),
        lastWrite.replayed === true ? /* @__PURE__ */ jsx3(Text3, { level: "faint", size: "sm", children: "This matched a request already sent, so the mod answered with the earlier receipt instead of writing again. The slot still holds whatever the last write that DID land put there." }) : /* @__PURE__ */ jsx3(Text3, { level: "faint", size: "sm", children: planWriteRefusalLine(lastWrite) })
      ] }),
      /* @__PURE__ */ jsxs3(Text3, { level: "faint", size: "sm", children: [
        "Slot state as read at",
        " ",
        plan.sampledAtUt == null ? NULL_DISPLAY4 : /* @__PURE__ */ jsx3(MissionDate2, { value: plan.sampledAtUt }),
        "."
      ] })
    ] })
  ] });
}
function ExistingPlan({
  plan,
  vesselId,
  frozen,
  slotsFull,
  planCount,
  burnCount,
  nextIgnitionUt: nextIgnitionUt2,
  viewUt,
  oneWaySeconds,
  duplicateCmd,
  deleteCmd,
  onWrite
}) {
  const executing = (plan.burns ?? []).some((burn) => burn.executing === true);
  const executionUnread = (plan.burns ?? []).some(
    (burn) => burn.executing == null
  );
  const nextBurnWindow = commandWindow(nextIgnitionUt2, viewUt, oneWaySeconds);
  return /* @__PURE__ */ jsxs3(Stack3, { gap: "caption", "data-plan-slots-existing": "", children: [
    /* @__PURE__ */ jsxs3(Cluster3, { gap: "related-dense", wrap: true, justify: "start", children: [
      /* @__PURE__ */ jsx3(
        CommandButton2,
        {
          size: "sm",
          handle: duplicateCmd,
          args: {
            vesselId,
            requestId: `duplicate-${vesselId ?? "none"}-${planCount}`
          },
          commandLabel: "Copy this flight plan into a new slot",
          label: "COPY TO A NEW SLOT",
          confirmLabel: "CONFIRM COPY",
          confirmTone: "nogo",
          pendingLabel: "Copying...",
          onConfirmed: (result) => onWrite(planWriteReceipt(result)),
          disabled: frozen || slotsFull,
          "aria-label": "Copy this flight plan into a new slot",
          confirmAriaLabel: "Confirm copying this flight plan into a new slot"
        }
      ),
      /* @__PURE__ */ jsx3(
        CommandButton2,
        {
          size: "sm",
          handle: deleteCmd,
          args: { vesselId, requestId: `delete-${vesselId ?? "none"}` },
          commandLabel: "Delete this flight plan",
          label: "DELETE PLAN",
          confirmLabel: "CONFIRM DELETE",
          confirmTone: "nogo",
          pendingLabel: "Deleting...",
          onConfirmed: (result) => onWrite(planWriteReceipt(result)),
          disabled: frozen,
          "aria-label": "Delete this flight plan",
          confirmAriaLabel: "Confirm deleting this flight plan"
        }
      )
    ] }),
    burnCount > 0 && /* @__PURE__ */ jsx3(Text3, { level: "faint", size: "sm", children: "Deleting this slot discards the burns above with it. Copying it first leaves the original in place." }),
    executing && /* @__PURE__ */ jsx3(Cluster3, { justify: "start", children: /* @__PURE__ */ jsx3(Badge3, { tone: "nogo", children: "A BURN IS RUNNING" }) }),
    !executing && executionUnread && /* @__PURE__ */ jsx3(Cluster3, { justify: "start", children: /* @__PURE__ */ jsx3(Badge3, { tone: "caution", children: "A BURN HERE MAY BE RUNNING, UNREAD" }) }),
    nextBurnWindow?.shut === true && /* @__PURE__ */ jsxs3(Text3, { tone: "warn", size: "sm", children: [
      "The next burn lights before a write sent now reaches Principia, so it flies whatever this slot holds. The window shut at",
      " ",
      /* @__PURE__ */ jsx3(MissionDate2, { value: value3("ut", nextBurnWindow.deadlineUt) }),
      "."
    ] })
  ] });
}
function InstallDrafts({
  drafts,
  plan,
  vesselId,
  endUt,
  arrivalUt,
  viewUt,
  oneWaySeconds,
  frozen,
  burnCount,
  sendCmd,
  onWrite
}) {
  return /* @__PURE__ */ jsxs3(Stack3, { gap: "caption", "data-plan-slots-install": "", children: [
    /* @__PURE__ */ jsx3(SectionTitle3, { children: "INSTALL A COMPOSED PLAN" }),
    drafts.length === 0 ? /* @__PURE__ */ jsx3(Text3, { level: "faint", size: "sm", children: "No saved plan for this craft. A composed plan reaches Principia's flight plan from here, with the end instant above, or whole from the composer's own upload." }) : null,
    drafts.map((draft, index) => /* @__PURE__ */ jsx3(
      InstallRow,
      {
        draft,
        ordinal: index + 1,
        plan,
        vesselId,
        endUt,
        arrivalUt,
        viewUt,
        oneWaySeconds,
        frozen,
        burnCount,
        sendCmd,
        onWrite
      },
      draft.id
    ))
  ] });
}
function InstallRow({
  draft,
  ordinal,
  plan,
  vesselId,
  endUt,
  arrivalUt,
  viewUt,
  oneWaySeconds,
  frozen,
  burnCount,
  sendCmd,
  onWrite
}) {
  const first = draft.burns[0];
  const window = commandWindow(
    magnitudeOf5(first?.ignitionUt),
    viewUt,
    oneWaySeconds
  );
  const lastIgnitionUt = magnitudeOf5(
    draft.burns[draft.burns.length - 1]?.ignitionUt
  );
  const planEndUt = draft.desiredFinalTimeUt ?? endUt;
  const endsBeforeLastBurn = planEndUt !== null && lastIgnitionUt !== null && planEndUt <= lastIgnitionUt;
  const burnStructUnusable = burnCount > 0 && plan.writeSurface?.burnLayoutVerified !== true;
  const blocked = frozen || burnStructUnusable || planEndUt === null || endsBeforeLastBurn || window?.shut === true || arrivalUt !== null && planEndUt <= arrivalUt;
  return /* @__PURE__ */ jsxs3(Stack3, { gap: "caption", children: [
    /* @__PURE__ */ jsxs3(Row3, { as: "div", children: [
      /* @__PURE__ */ jsx3(RowName3, { children: `SAVED PLAN ${ordinal}` }),
      /* @__PURE__ */ jsxs3(Cluster3, { justify: "end", gap: "related-dense", children: [
        /* @__PURE__ */ jsx3(Unit3, { value: value3("count", draft.burns.length), decimals: 0 }),
        first ? /* @__PURE__ */ jsx3(MissionDate2, { value: first.ignitionUt }) : null
      ] })
    ] }),
    /* @__PURE__ */ jsx3(
      CommandButton2,
      {
        size: "sm",
        tone: "go",
        handle: sendCmd,
        args: {
          vesselId,
          /*
           * The draft's CONTENT is the intent, never its id alone: the mod
           * answers a request id it has already seen out of its replay cache
           * without looking at the plan that came with it, so a corrected plan
           * resent under the id its earlier version went under is answered
           * "aboard" about a trajectory the craft has never seen. `revision`
           * counts the content, and the end instant is stated here rather than
           * in the draft, so it joins the key.
           */
          requestId: `send-${draft.id}@${draft.revision}-${planEndUt ?? "none"}`,
          composedAtViewUt: viewUt ?? void 0,
          observedAtUt: magnitudeOf5(draft.observedAt) ?? void 0,
          desiredFinalTimeUt: planEndUt ?? void 0,
          burns: draft.burns.map(composedBurn)
        },
        commandLabel: "Install this plan as Principia's flight plan",
        label: "INSTALL AS FLIGHT PLAN",
        confirmLabel: "CONFIRM INSTALL",
        confirmTone: "nogo",
        pendingLabel: "Installing...",
        onConfirmed: (result) => onWrite(planWriteReceipt(result)),
        disabled: blocked,
        "aria-label": "Install this plan as Principia's flight plan",
        confirmAriaLabel: "Confirm installing this plan as Principia's flight plan"
      }
    ),
    burnCount > 0 && plan.planExists === true && /* @__PURE__ */ jsx3(Text3, { level: "faint", size: "sm", children: "This overwrites the burns the slot holds now, whole." }),
    burnStructUnusable && /* @__PURE__ */ jsx3(Text3, { tone: "warn", size: "sm", children: "Principia's burn struct has not survived a round trip in this session, and this slot already holds burns to copy from, so the mod refuses the install. A slot holding none builds its head burn instead and is not held to the verdict." }),
    endsBeforeLastBurn && /* @__PURE__ */ jsx3(Text3, { tone: "warn", size: "sm", children: "The plan end above is at or before this plan's last ignition, so the plan would not reach its own last manoeuvre." }),
    window?.shut === true && /* @__PURE__ */ jsxs3(Text3, { tone: "warn", size: "sm", children: [
      "The first burn lights before this plan could reach the craft, and the mod refuses the whole plan rather than installing the burns still ahead. The window shut at",
      " ",
      /* @__PURE__ */ jsx3(MissionDate2, { value: value3("ut", window.deadlineUt) }),
      ",",
      " ",
      /* @__PURE__ */ jsx3(Countdown3, { value: value3("s", 2 * window.oneWaySeconds) }),
      " before ignition: one light time because the reading is that old, and a second because the plan has the same distance to travel back."
    ] })
  ] });
}
function nextIgnitionUt(plan) {
  const index = magnitudeOf5(plan.firstFutureBurnIndex);
  if (index === null) return null;
  const burn = (plan.burns ?? []).find(
    (candidate) => magnitudeOf5(candidate.index) === index
  );
  return burn === void 0 ? null : magnitudeOf5(burn.ignitionUt);
}
registerAugment2({
  id: "principia-plan-slots",
  augments: "maneuver-planner.sections",
  component: PlanSlots,
  owner: PRINCIPIA
});

// src/OrbitAnalysis/index.tsx
import {
  readingOf,
  registerAugment as registerAugment3,
  useTelemetry as useTelemetry3,
  useViewUt as useViewUt4,
  value as value4
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge4,
  Band,
  Cluster as Cluster4,
  Countdown as Countdown4,
  magnitudeOf as magnitudeOf7,
  NULL_DISPLAY as NULL_DISPLAY5,
  Row as Row4,
  RowName as RowName4,
  Section as Section3,
  SectionTitle as SectionTitle4,
  Stack as Stack4,
  Text as Text4,
  Unit as Unit4
} from "@ksp-gonogo/ui-kit";

// src/orbitDescription.ts
import { magnitudeOf as magnitudeOf6 } from "@ksp-gonogo/ui-kit";
function orbitDescription(analysis) {
  if (analysis == null || analysis.elementsPresent !== true) {
    return null;
  }
  if (analysis.gravitationallyBound === false) {
    return null;
  }
  const eccentricityMin = magnitudeOf6(analysis.meanEccentricity?.min);
  const eccentricityMax = magnitudeOf6(analysis.meanEccentricity?.max);
  const inclinationMin = magnitudeOf6(analysis.meanInclinationDegrees?.min);
  const inclinationMax = magnitudeOf6(analysis.meanInclinationDegrees?.max);
  const adjectives = [];
  if (eccentricityMax !== null && eccentricityMax < CIRCULAR_ECCENTRICITY) {
    adjectives.push("circular");
  }
  if (eccentricityMin !== null && eccentricityMin > HIGHLY_ELLIPTICAL_ECCENTRICITY) {
    adjectives.push("highly elliptical");
  }
  if (inclinationMin !== null && inclinationMax !== null && (inclinationMax < EQUATORIAL_DEGREES || inclinationMin > 180 - EQUATORIAL_DEGREES)) {
    adjectives.push("equatorial");
  }
  if (inclinationMin !== null && inclinationMax !== null && inclinationMin > 90 - POLAR_TOLERANCE_DEGREES && inclinationMax < 90 + POLAR_TOLERANCE_DEGREES) {
    adjectives.push("polar");
  }
  if (inclinationMin !== null && inclinationMin > 90) {
    adjectives.push("retrograde");
  }
  if (isSunSynchronous(analysis)) adjectives.push("sun-synchronous");
  const synchronicity = synchronicityOf(analysis, {
    circular: adjectives.includes("circular"),
    equatorial: adjectives.includes("equatorial")
  });
  if (synchronicity !== null) {
    if (synchronicity === "stationary") {
      adjectives.length = 0;
    }
    adjectives.push(synchronicity);
  }
  const body = analysis.primaryBody;
  const words = [...adjectives, body, "orbit"].filter(
    (word) => typeof word === "string" && word.length > 0
  );
  return words.length > 1 ? words.join(" ") : null;
}
var CIRCULAR_ECCENTRICITY = 0.01;
var HIGHLY_ELLIPTICAL_ECCENTRICITY = 0.5;
var EQUATORIAL_DEGREES = 5;
var POLAR_TOLERANCE_DEGREES = 10;
var SYNCHRONOUS_DRIFT_DEGREES_PER_ROTATION = 0.1;
function synchronicityOf(analysis, shape) {
  const cycleRotations = magnitudeOf6(analysis.recurrenceCycleRotations);
  const revolutionsPerRotation = magnitudeOf6(
    analysis.recurrenceRevolutionsPerRotation
  );
  const revolutions = magnitudeOf6(analysis.recurrenceRevolutions);
  const ascending = analysis.ascendingCrossingDegrees;
  const descending = analysis.descendingCrossingDegrees;
  const missionDuration = magnitudeOf6(analysis.missionDurationSeconds);
  const nodalPeriod = magnitudeOf6(analysis.nodalPeriodSeconds);
  if (cycleRotations === null || revolutionsPerRotation === null || revolutions === null || missionDuration === null || nodalPeriod === null || nodalPeriod <= 0) {
    return null;
  }
  const spans = [
    span(ascending?.min, ascending?.max),
    span(descending?.min, descending?.max)
  ].filter((value9) => value9 !== null);
  if (spans.length === 0) return null;
  const drift = Math.max(...spans);
  if (drift <= 0) return null;
  const revolutionsPerCycle = revolutions / cycleRotations;
  if (revolutionsPerCycle <= 0) return null;
  const rotations = missionDuration / nodalPeriod / revolutionsPerCycle;
  if (rotations <= 0) return null;
  if (drift / rotations >= SYNCHRONOUS_DRIFT_DEGREES_PER_ROTATION) return null;
  if (cycleRotations !== 1) return null;
  if (revolutionsPerRotation === 1) {
    return shape.circular && shape.equatorial ? "stationary" : "synchronous";
  }
  if (revolutionsPerRotation === 2) return "semi-synchronous";
  return null;
}
var SUN_SYNCHRONOUS_DRIFT_DEGREES_PER_REVOLUTION = 1e-3;
function isSunSynchronous(analysis) {
  const ascending = analysis.ascendingNodeSolarTimeDegrees;
  const descending = analysis.descendingNodeSolarTimeDegrees;
  const missionDuration = magnitudeOf6(analysis.missionDurationSeconds);
  const nodalPeriod = magnitudeOf6(analysis.nodalPeriodSeconds);
  if (missionDuration === null || nodalPeriod === null || nodalPeriod <= 0) {
    return false;
  }
  const spans = [
    span(ascending?.min, ascending?.max),
    span(descending?.min, descending?.max)
  ].filter((value9) => value9 !== null);
  if (spans.length === 0) return false;
  const drift = Math.max(...spans);
  if (drift <= 0) return false;
  const revolutions = missionDuration / nodalPeriod;
  if (revolutions <= 0) return false;
  return drift / revolutions < SUN_SYNCHRONOUS_DRIFT_DEGREES_PER_REVOLUTION;
}
function span(min, max) {
  const low = magnitudeOf6(min);
  const high = magnitudeOf6(max);
  return low === null || high === null ? null : high - low;
}
var UNREACHABLE_ADJECTIVES = [];

// src/OrbitAnalysis/index.tsx
import { Fragment as Fragment2, jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
function datedBy(reading) {
  return (figure) => figure == null ? null : readingOf(reading, () => figure);
}
function HeldTag() {
  return /* @__PURE__ */ jsx4(Badge4, { tone: "caution", size: "sm", children: "HELD" });
}
function analysisView(reading) {
  switch (reading.state) {
    case "pending":
    case "absent":
    case "unowned":
      return { kind: "unobserved" };
    default: {
      const orbit = reading.value.orbit;
      return orbit == null ? { kind: "notAnalysing" } : { kind: "analysed", orbit };
    }
  }
}
function AgeLine({
  orbit,
  viewUt,
  dated
}) {
  const epochUt = magnitudeOf7(orbit.elementsEpochUt);
  if (epochUt === null || viewUt === null) {
    return /* @__PURE__ */ jsx4(Text4, { tone: "warn", size: "sm", "data-elements-age": "unknown", children: "Elements of unknown age" });
  }
  const age = viewUt - epochUt;
  if (age === 0) {
    return /* @__PURE__ */ jsx4(Text4, { tone: "go", size: "sm", "data-elements-age": "current", children: "Measured from now" });
  }
  if (age < 0) {
    return /* @__PURE__ */ jsxs4(Text4, { tone: "info", size: "sm", "data-elements-age": "ahead", children: [
      "Measured from ",
      /* @__PURE__ */ jsx4(Countdown4, { value: dated(value4("s", -age)) }),
      " ahead"
    ] });
  }
  const period = magnitudeOf7(orbit.siderealPeriodSeconds);
  const withinOneRevolution = period !== null && age < period;
  return /* @__PURE__ */ jsxs4(
    Text4,
    {
      tone: withinOneRevolution ? "info" : "warn",
      size: "sm",
      "data-elements-age": withinOneRevolution ? "current" : "stale",
      children: [
        "Measured from ",
        /* @__PURE__ */ jsx4(Countdown4, { value: dated(value4("s", age)) }),
        " ago"
      ]
    }
  );
}
function GroundTrackRows({
  orbit,
  dated
}) {
  const hasRecurrence = orbit.recurrenceCycleRotations != null;
  const hasCrossings = orbit.ascendingCrossingDegrees != null;
  const hasSolarTimes = orbit.ascendingNodeSolarTimeDegrees != null;
  if (!hasRecurrence && !hasCrossings && !hasSolarTimes) return null;
  return /* @__PURE__ */ jsxs4(Fragment2, { children: [
    hasRecurrence && /* @__PURE__ */ jsxs4(Fragment2, { children: [
      /* @__PURE__ */ jsxs4(Row4, { as: "div", children: [
        /* @__PURE__ */ jsx4(RowName4, { children: "REPEATS IN" }),
        /* @__PURE__ */ jsxs4(Cluster4, { children: [
          /* @__PURE__ */ jsx4(Unit4, { value: dated(orbit.recurrenceCycleRotations) }),
          /* @__PURE__ */ jsx4(Text4, { level: "faint", size: "sm", children: "turns" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs4(Row4, { as: "div", children: [
        /* @__PURE__ */ jsx4(RowName4, { children: "REVS/CYCLE" }),
        /* @__PURE__ */ jsx4(Unit4, { value: dated(orbit.recurrenceRevolutions) })
      ] }),
      /* @__PURE__ */ jsxs4(Row4, { as: "div", children: [
        /* @__PURE__ */ jsx4(RowName4, { children: "SUBCYCLE" }),
        /* @__PURE__ */ jsxs4(Cluster4, { children: [
          /* @__PURE__ */ jsx4(Unit4, { value: dated(orbit.recurrenceSubcycleRotations) }),
          /* @__PURE__ */ jsx4(Text4, { level: "faint", size: "sm", children: "turns" })
        ] })
      ] })
    ] }),
    hasCrossings && /* @__PURE__ */ jsxs4(Fragment2, { children: [
      /* @__PURE__ */ jsxs4(Row4, { as: "div", children: [
        /* @__PURE__ */ jsx4(RowName4, { children: "ASC NODE" }),
        /* @__PURE__ */ jsx4(
          Band,
          {
            min: orbit.ascendingCrossingDegrees?.min,
            max: orbit.ascendingCrossingDegrees?.max,
            wrapsAt: 360
          }
        )
      ] }),
      /* @__PURE__ */ jsxs4(Row4, { as: "div", children: [
        /* @__PURE__ */ jsx4(RowName4, { children: "DESC NODE" }),
        /* @__PURE__ */ jsx4(
          Band,
          {
            min: orbit.descendingCrossingDegrees?.min,
            max: orbit.descendingCrossingDegrees?.max,
            wrapsAt: 360
          }
        )
      ] })
    ] }),
    hasSolarTimes && /* An angle over a full turn with 180 degrees at local noon, which is
       what the producer stores. Shown as the angle rather than as a clock
       because a clock reading needs a unit this contract does not have, and
       a number formatted as a time it cannot promise is worse than an
       honest angle. */
    /* @__PURE__ */ jsxs4(Row4, { as: "div", children: [
      /* @__PURE__ */ jsx4(RowName4, { children: "SUN ANGLE" }),
      /* @__PURE__ */ jsx4(
        Band,
        {
          min: orbit.ascendingNodeSolarTimeDegrees?.min,
          max: orbit.ascendingNodeSolarTimeDegrees?.max,
          wrapsAt: 360
        }
      )
    ] })
  ] });
}
function OrbitAnalysisRows({
  orbit,
  viewUt,
  source
}) {
  const dated = datedBy(source);
  if (orbit.elementsPresent !== true) {
    return /* @__PURE__ */ jsxs4(Stack4, { children: [
      /* @__PURE__ */ jsxs4(Cluster4, { justify: "start", gap: "related-dense", children: [
        /* @__PURE__ */ jsx4(Text4, { tone: "warn", size: "sm", children: "Elements not determined" }),
        source.state === "held" && /* @__PURE__ */ jsx4(HeldTag, {})
      ] }),
      /* @__PURE__ */ jsx4(AgeLine, { orbit, viewUt, dated }),
      /* @__PURE__ */ jsx4(Text4, { level: "faint", size: "sm", children: orbit.gravitationallyBound === false ? "This trajectory is bound to nothing over the analysed span." : "The analysed span does not yet cover one full revolution." })
    ] });
  }
  return /* @__PURE__ */ jsxs4(Stack4, { children: [
    /* @__PURE__ */ jsx4(AgeLine, { orbit, viewUt, dated }),
    orbit.gravitationallyBound === false && /* @__PURE__ */ jsx4(Text4, { tone: "warn", size: "sm", children: "Not gravitationally bound" }),
    /* @__PURE__ */ jsxs4(Row4, { as: "div", children: [
      /* @__PURE__ */ jsx4(RowName4, { children: "OVER" }),
      orbit.missionDurationSeconds == null ? /* @__PURE__ */ jsx4(Text4, { children: NULL_DISPLAY5 }) : /* @__PURE__ */ jsx4(Countdown4, { value: dated(orbit.missionDurationSeconds) })
    ] }),
    /* @__PURE__ */ jsx4(
      PeriodRow,
      {
        name: "SIDEREAL",
        seconds: orbit.siderealPeriodSeconds,
        dated
      }
    ),
    /* @__PURE__ */ jsx4(
      PeriodRow,
      {
        name: "NODAL",
        seconds: orbit.nodalPeriodSeconds,
        relativeTo: orbit.siderealPeriodSeconds,
        dated
      }
    ),
    /* @__PURE__ */ jsx4(
      PeriodRow,
      {
        name: "ANOMALISTIC",
        seconds: orbit.anomalisticPeriodSeconds,
        relativeTo: orbit.siderealPeriodSeconds,
        dated
      }
    ),
    /* @__PURE__ */ jsxs4(Row4, { as: "div", children: [
      /* @__PURE__ */ jsx4(RowName4, { children: "NODE DRIFT" }),
      orbit.nodalPrecessionDegreesPerHour == null ? /* @__PURE__ */ jsx4(Text4, { children: NULL_DISPLAY5 }) : (
        // Four decimals, because two would print a fifth of a degree an hour
        // and a near-polar orbit's much smaller drift as the same number, and
        // "does this orbit precess" is the question the row answers.
        /* @__PURE__ */ jsx4(
          Unit4,
          {
            value: dated(orbit.nodalPrecessionDegreesPerHour),
            decimals: 4
          }
        )
      )
    ] }),
    /* @__PURE__ */ jsxs4(Row4, { as: "div", children: [
      /* @__PURE__ */ jsx4(RowName4, { children: "SMA" }),
      /* @__PURE__ */ jsx4(
        Band,
        {
          min: orbit.meanSemimajorAxisMetres?.min,
          max: orbit.meanSemimajorAxisMetres?.max
        }
      )
    ] }),
    /* @__PURE__ */ jsxs4(Row4, { as: "div", children: [
      /* @__PURE__ */ jsx4(RowName4, { children: "ECC" }),
      /* @__PURE__ */ jsx4(
        Band,
        {
          min: orbit.meanEccentricity?.min,
          max: orbit.meanEccentricity?.max,
          decimals: 4
        }
      )
    ] }),
    /* @__PURE__ */ jsxs4(Row4, { as: "div", children: [
      /* @__PURE__ */ jsx4(RowName4, { children: "INC" }),
      /* @__PURE__ */ jsx4(
        Band,
        {
          min: orbit.meanInclinationDegrees?.min,
          max: orbit.meanInclinationDegrees?.max,
          wrapsAt: 360
        }
      )
    ] }),
    /* @__PURE__ */ jsxs4(Row4, { as: "div", children: [
      /* @__PURE__ */ jsx4(RowName4, { children: "LAN" }),
      /* @__PURE__ */ jsx4(
        Band,
        {
          min: orbit.meanLongitudeOfAscendingNodeDegrees?.min,
          max: orbit.meanLongitudeOfAscendingNodeDegrees?.max,
          wrapsAt: 360
        }
      )
    ] }),
    /* @__PURE__ */ jsxs4(Row4, { as: "div", children: [
      /* @__PURE__ */ jsx4(RowName4, { children: "ARG PE" }),
      /* @__PURE__ */ jsx4(
        Band,
        {
          min: orbit.meanArgumentOfPeriapsisDegrees?.min,
          max: orbit.meanArgumentOfPeriapsisDegrees?.max,
          wrapsAt: 360
        }
      )
    ] }),
    /* @__PURE__ */ jsxs4(Row4, { as: "div", children: [
      /* @__PURE__ */ jsx4(RowName4, { children: "PE" }),
      /* @__PURE__ */ jsx4(
        Band,
        {
          min: orbit.meanPeriapsisAltitudeMetres?.min,
          max: orbit.meanPeriapsisAltitudeMetres?.max
        }
      )
    ] }),
    /* @__PURE__ */ jsxs4(Row4, { as: "div", children: [
      /* @__PURE__ */ jsx4(RowName4, { children: "AP" }),
      /* @__PURE__ */ jsx4(
        Band,
        {
          min: orbit.meanApoapsisAltitudeMetres?.min,
          max: orbit.meanApoapsisAltitudeMetres?.max
        }
      )
    ] }),
    /* @__PURE__ */ jsxs4(Row4, { as: "div", children: [
      /* @__PURE__ */ jsx4(RowName4, { children: "LOWEST" }),
      orbit.lowestAltitudeMetres == null ? /* @__PURE__ */ jsx4(Text4, { children: NULL_DISPLAY5 }) : /* @__PURE__ */ jsx4(Unit4, { value: dated(orbit.lowestAltitudeMetres) })
    ] }),
    /* @__PURE__ */ jsx4(GroundTrackRows, { orbit, dated }),
    /* @__PURE__ */ jsx4(
      HazardRow,
      {
        label: "COLLISION",
        ut: orbit.firstCollisionUt,
        viewUt,
        dated,
        tone: "nogo"
      }
    ),
    /* @__PURE__ */ jsx4(
      HazardRow,
      {
        label: "COLLISION RISK",
        ut: orbit.firstCollisionRiskUt,
        viewUt,
        dated,
        tone: "warn"
      }
    ),
    /* @__PURE__ */ jsx4(
      HazardRow,
      {
        label: "REENTRY",
        ut: orbit.firstReentryUt,
        viewUt,
        dated,
        tone: "warn"
      }
    )
  ] });
}
function PeriodRow({
  name,
  seconds,
  relativeTo,
  dated
}) {
  const own = magnitudeOf7(seconds);
  const reference = magnitudeOf7(relativeTo);
  const offset = own === null || reference === null ? null : own - reference;
  return /* @__PURE__ */ jsxs4(Row4, { as: "div", children: [
    /* @__PURE__ */ jsx4(RowName4, { children: name }),
    seconds == null ? /* @__PURE__ */ jsx4(Text4, { children: NULL_DISPLAY5 }) : /* @__PURE__ */ jsxs4(Cluster4, { justify: "end", gap: "related-dense", children: [
      /* @__PURE__ */ jsx4(Countdown4, { value: dated(seconds) }),
      offset !== null && offset !== 0 && /* @__PURE__ */ jsxs4(Text4, { level: "faint", size: "sm", children: [
        offset > 0 ? "+" : "\u2212",
        /* @__PURE__ */ jsx4(Countdown4, { value: dated(value4("s", Math.abs(offset))) })
      ] })
    ] })
  ] });
}
function HazardRow({
  label,
  ut,
  viewUt,
  dated,
  tone
}) {
  const instant = magnitudeOf7(ut);
  if (instant === null || viewUt === null) {
    return null;
  }
  return /* @__PURE__ */ jsxs4(Row4, { as: "div", children: [
    /* @__PURE__ */ jsx4(RowName4, { children: label }),
    /* @__PURE__ */ jsxs4(Cluster4, { justify: "end", gap: "related-dense", children: [
      /* @__PURE__ */ jsx4(Countdown4, { value: dated(value4("s", instant - viewUt)), clock: true }),
      /* @__PURE__ */ jsx4(Badge4, { tone, children: label })
    ] })
  ] });
}
function OrbitAnalysisSection() {
  const reading = useTelemetry3("principia.analysis");
  const view = analysisView(reading);
  const viewUt = magnitudeOf7(useViewUt4());
  if (view.kind === "unobserved") {
    return /* @__PURE__ */ jsxs4(Section3, { "data-orbit-analysis": "", children: [
      /* @__PURE__ */ jsx4(SectionTitle4, { children: "N-BODY ORBIT ANALYSIS" }),
      /* @__PURE__ */ jsxs4(Stack4, { role: "status", "aria-live": "polite", children: [
        /* @__PURE__ */ jsx4(Text4, { tone: "warn", size: "sm", children: "Analysis not observed" }),
        /* @__PURE__ */ jsx4(Text4, { level: "faint", size: "sm", children: "No n-body analysis has reached this console for the active craft." })
      ] })
    ] });
  }
  if (view.kind === "notAnalysing") {
    return /* @__PURE__ */ jsxs4(Section3, { "data-orbit-analysis": "", children: [
      /* @__PURE__ */ jsx4(SectionTitle4, { children: "N-BODY ORBIT ANALYSIS" }),
      /* @__PURE__ */ jsxs4(Stack4, { role: "status", "aria-live": "polite", children: [
        /* @__PURE__ */ jsxs4(Cluster4, { justify: "start", gap: "related-dense", children: [
          /* @__PURE__ */ jsx4(Text4, { tone: "warn", size: "sm", children: "Not being analysed" }),
          reading.state === "held" && /* @__PURE__ */ jsx4(HeldTag, {})
        ] }),
        /* @__PURE__ */ jsx4(Text4, { level: "faint", size: "sm", children: "Principia analyses one craft at a time, while its own window is open. Open it on this craft and the elements will appear here." })
      ] })
    ] });
  }
  const { orbit } = view;
  const description = orbitDescription(orbit);
  return /* @__PURE__ */ jsxs4(Section3, { "data-orbit-analysis": "", children: [
    /* @__PURE__ */ jsx4(SectionTitle4, { children: "N-BODY ORBIT ANALYSIS" }),
    /* @__PURE__ */ jsxs4(Stack4, { children: [
      description !== null && /* @__PURE__ */ jsx4(Text4, { tone: "info", weight: "semibold", children: description }),
      /* @__PURE__ */ jsx4(OrbitAnalysisRows, { orbit, viewUt, source: reading }),
      description !== null && UNREACHABLE_ADJECTIVES.length > 0 && /* @__PURE__ */ jsx4(Text4, { level: "faint", size: "sm", children: `Cannot say ${UNREACHABLE_ADJECTIVES.join(", ")}.` })
    ] })
  ] });
}
registerAugment3({
  id: "principia-orbit-analysis",
  augments: "current-orbit.sections",
  component: OrbitAnalysisSection,
  owner: PRINCIPIA
});

// src/CoastAnalysis/index.tsx
import {
  registerAugment as registerAugment4,
  useTelemetry as useTelemetry4,
  useViewUt as useViewUt5,
  value as value5
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge5,
  Cluster as Cluster5,
  Countdown as Countdown5,
  Disclosure,
  magnitudeOf as magnitudeOf8,
  Row as Row5,
  RowName as RowName5,
  Section as Section4,
  SectionTitle as SectionTitle5,
  Stack as Stack5,
  Text as Text5
} from "@ksp-gonogo/ui-kit";
import { jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
function coastsOf(reading) {
  switch (reading.state) {
    case "pending":
    case "absent":
    case "unowned":
      return null;
    default:
      return reading.value.coasts ?? [];
  }
}
function CoastRow({
  coast,
  isFinal,
  viewUt,
  source
}) {
  const dated = datedBy(source);
  const index = magnitudeOf8(coast.index);
  const starts = magnitudeOf8(coast.startsAtUt);
  const ends = magnitudeOf8(coast.endsAtUt);
  const duration = starts === null || ends === null ? null : ends - starts;
  const description = coast.analysis == null ? null : orbitDescription(coast.analysis);
  const name = isFinal ? "the final coast" : index === null ? "this coast" : `coast ${index + 1}`;
  const label = /* @__PURE__ */ jsxs5(Cluster5, { justify: "start", gap: "related-dense", wrap: true, children: [
    /* @__PURE__ */ jsx5(RowName5, { children: isFinal ? "FINAL" : name.toUpperCase() }),
    description === null ? (
      // An absence with a reason. A coast that follows a burn the integrator
      // could not compute has no valid initial state to analyse from, so the
      // producer has nothing to describe, and a blank row would read as a
      // coast in no particular orbit.
      /* @__PURE__ */ jsx5(Text5, { level: "faint", size: "sm", children: coast.analysis == null ? "no analysis for this coast" : "orbit not described" })
    ) : /* @__PURE__ */ jsx5(Badge5, { tone: "info", children: description.toUpperCase() }),
    duration !== null && /* @__PURE__ */ jsx5(Text5, { level: "faint", size: "sm", children: /* @__PURE__ */ jsx5(Countdown5, { value: dated(value5("s", duration)) }) })
  ] });
  if (coast.analysis == null) {
    return /* @__PURE__ */ jsx5(Row5, { as: "div", children: label });
  }
  return /* @__PURE__ */ jsx5(
    Disclosure,
    {
      variant: "inline",
      panelHeight: "auto",
      label,
      "aria-label": `Show the mean elements of ${name}`,
      children: /* @__PURE__ */ jsx5(
        OrbitAnalysisRows,
        {
          orbit: coast.analysis,
          viewUt,
          source
        }
      )
    }
  );
}
function CoastAnalysisSection() {
  const reading = useTelemetry4("principia.analysis");
  const coasts = coastsOf(reading);
  const viewUt = magnitudeOf8(useViewUt5());
  if (coasts === null) {
    return /* @__PURE__ */ jsxs5(Section4, { "data-coast-analysis": "", children: [
      /* @__PURE__ */ jsx5(SectionTitle5, { children: "PLANNED ORBITS" }),
      /* @__PURE__ */ jsxs5(Stack5, { role: "status", "aria-live": "polite", children: [
        /* @__PURE__ */ jsx5(Cluster5, { justify: "start", children: /* @__PURE__ */ jsx5(Badge5, { tone: "caution", children: "ANALYSIS NOT OBSERVED" }) }),
        /* @__PURE__ */ jsx5(Text5, { level: "faint", size: "sm", children: "No n-body analysis has reached this console for the active craft." })
      ] })
    ] });
  }
  if (coasts.length === 0) {
    return /* @__PURE__ */ jsxs5(Section4, { "data-coast-analysis": "", children: [
      /* @__PURE__ */ jsx5(SectionTitle5, { children: "PLANNED ORBITS" }),
      /* @__PURE__ */ jsxs5(Cluster5, { justify: "start", gap: "related-dense", children: [
        /* @__PURE__ */ jsx5(Text5, { level: "faint", size: "sm", children: "No flight plan, so no planned orbits." }),
        reading.state === "held" && /* @__PURE__ */ jsx5(HeldTag, {})
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxs5(Section4, { "data-coast-analysis": "", children: [
    /* @__PURE__ */ jsx5(SectionTitle5, { children: "PLANNED ORBITS" }),
    /* @__PURE__ */ jsx5(Stack5, { gap: "caption", children: coasts.map((coast, position) => /* @__PURE__ */ jsx5(
      CoastRow,
      {
        coast,
        isFinal: position === coasts.length - 1 && coasts.length > 1,
        viewUt,
        source: reading
      },
      magnitudeOf8(coast.index) ?? position
    )) })
  ] });
}
registerAugment4({
  id: "principia-coast-analysis",
  augments: "maneuver-planner.sections",
  component: CoastAnalysisSection,
  owner: PRINCIPIA
});

// src/BurnEditor/index.tsx
import {
  registerAugment as registerAugment5,
  useCommand as useCommand4,
  useTelemetry as useTelemetry5,
  useViewUt as useViewUt6,
  value as value6
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge6,
  BinormalIcon,
  Cluster as Cluster6,
  CommandButton as CommandButton3,
  Countdown as Countdown6,
  FieldLabel,
  FrenetNormalIcon,
  Input,
  MissionDate as MissionDate3,
  MissionDateField as MissionDateField3,
  magnitudeOf as magnitudeOf9,
  NULL_DISPLAY as NULL_DISPLAY6,
  Row as Row6,
  RowName as RowName6,
  Section as Section5,
  SectionTitle as SectionTitle6,
  SelectableRow,
  Stack as Stack6,
  TangentIcon,
  Text as Text6,
  ToggleButton,
  Unit as Unit5
} from "@ksp-gonogo/ui-kit";
import { useState as useState4 } from "react";
import { jsx as jsx6, jsxs as jsxs6 } from "react/jsx-runtime";
var editWindow = commandWindow;
function draftOf(burn) {
  return {
    burnIndex: magnitudeOf9(burn.index) ?? 0,
    ignitionUt: magnitudeOf9(burn.ignitionUt),
    tangent: magnitudeOf9(burn.deltaVTangent),
    normal: magnitudeOf9(burn.deltaVNormal),
    binormal: magnitudeOf9(burn.deltaVBinormal),
    inertiallyFixed: burn.inertiallyFixed === true,
    instantImpulse: false
  };
}
function statedTriple(draft) {
  const { tangent, normal, binormal } = draft;
  if (tangent === null || normal === null || binormal === null) return null;
  return { tangent, normal, binormal };
}
function DeltaVRow({
  id,
  icon: Icon,
  label,
  hint,
  value: value9,
  disabled,
  unitKnown = true,
  onChange
}) {
  return /* @__PURE__ */ jsxs6(Cluster6, { gap: "related-dense", justify: "start", children: [
    /* @__PURE__ */ jsxs6(FieldLabel, { htmlFor: id, children: [
      /* @__PURE__ */ jsx6(Icon, { size: 14 }),
      label,
      hint ? ` / ${hint}` : ""
    ] }),
    /* @__PURE__ */ jsx6(
      Input,
      {
        id,
        type: "number",
        inputMode: "decimal",
        step: 0.1,
        style: { width: "8rem" },
        disabled,
        value: value9 === null ? "" : value9,
        onChange: (event) => {
          if (event.target.value === "") {
            onChange(null);
            return;
          }
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }
      }
    ),
    unitKnown && /* @__PURE__ */ jsx6(Unit5, { children: "m/s" })
  ] });
}
function ProfileRow({
  name,
  value: value9,
  decimals
}) {
  return /* @__PURE__ */ jsxs6(Row6, { as: "div", children: [
    /* @__PURE__ */ jsx6(RowName6, { children: name }),
    value9 == null ? /* @__PURE__ */ jsx6(Text6, { children: NULL_DISPLAY6 }) : /* @__PURE__ */ jsx6(Unit5, { value: value9, decimals })
  ] });
}
function deltaVMagnitude(draft) {
  const stated = statedTriple(draft);
  if (stated === null) return null;
  return Math.sqrt(
    stated.tangent * stated.tangent + stated.normal * stated.normal + stated.binormal * stated.binormal
  );
}
function BurnEditor() {
  const planReading = useTelemetry5("principia.plan");
  const view = planView2(planReading);
  const receivedUt = useViewUt6();
  const viewUt = magnitudeOf9(receivedUt);
  const armCmd = useCommand4("principia.plan.arm");
  const replaceCmd = useCommand4("principia.plan.burn.replace");
  const insertCmd = useCommand4("principia.plan.burn.insert");
  const removeCmd = useCommand4("principia.plan.burn.remove");
  const [draft, setDraft] = useState4(null);
  const [lastWrite, setLastWrite] = useState4(
    null
  );
  const [lastArm, setLastArm] = useState4(
    null
  );
  if (view.kind === "none") {
    return /* @__PURE__ */ jsxs6(Section5, { "data-burn-editor": "", children: [
      /* @__PURE__ */ jsx6(SectionTitle6, { children: "BURN EDITOR" }),
      /* @__PURE__ */ jsxs6(Stack6, { role: "status", "aria-live": "polite", children: [
        /* @__PURE__ */ jsx6(Cluster6, { justify: "start", children: /* @__PURE__ */ jsx6(Badge6, { tone: "caution", children: "NO PLAN READING" }) }),
        /* @__PURE__ */ jsx6(Text6, { level: "faint", size: "sm", children: view.reason })
      ] })
    ] });
  }
  const { plan, outOfContact } = view;
  const surface = plan.writeSurface;
  const armed = surface?.armed === true;
  const available = surface?.available === true;
  const burns = plan.burns ?? [];
  const vesselId = plan.vesselId ?? void 0;
  const oneWaySeconds = replaceCmd.effectiveDelaySeconds;
  const draftWindow = editWindow(
    draft?.ignitionUt ?? null,
    viewUt,
    oneWaySeconds
  );
  const selected = draft === null ? void 0 : burns.find((burn) => magnitudeOf9(burn.index) === draft.burnIndex);
  const CARTESIAN_TNB = 1;
  const componentsUnreadable = selected !== void 0 && magnitudeOf9(selected.coordinateSystem) !== CARTESIAN_TNB;
  const notKnownIdle = selected !== void 0 && selected.executing !== false;
  const frozen = !armed || selected?.frameEditable !== true || componentsUnreadable || notKnownIdle || outOfContact !== null;
  const burnStructUnverified = surface?.burnLayoutVerified !== true;
  const tripleUnstated = draft !== null && statedTriple(draft) === null;
  const ignitionUnstated = draft !== null && draft.ignitionUt === null;
  const draftMagnitude = draft === null ? null : deltaVMagnitude(draft);
  const tooLate = draftWindow?.shut === true;
  return /* @__PURE__ */ jsxs6(Section5, { "data-burn-editor": "", children: [
    /* @__PURE__ */ jsx6(SectionTitle6, { children: "BURN EDITOR" }),
    /* @__PURE__ */ jsxs6(Stack6, { children: [
      /* @__PURE__ */ jsxs6(Cluster6, { wrap: true, justify: "start", gap: "related-dense", children: [
        /* @__PURE__ */ jsx6(Badge6, { tone: "info", children: `PLAN ${(magnitudeOf9(plan.selectedPlan) ?? -1) + 1} OF ${magnitudeOf9(plan.planCount) ?? 0}` }),
        plan.planExists === false && /* @__PURE__ */ jsx6(Badge6, { tone: "caution", children: "NO PLAN ON THIS VESSEL" }),
        plan.optimisationRunning === true && /* @__PURE__ */ jsx6(Badge6, { tone: "warn", children: "OPTIMISING" }),
        armed ? /* @__PURE__ */ jsx6(Badge6, { tone: "go", children: "ARMED" }) : /* @__PURE__ */ jsx6(Badge6, { tone: "caution", children: "NOT ARMED" }),
        outOfContact !== null && /* @__PURE__ */ jsx6(Badge6, { tone: "warn", children: "OUT OF CONTACT" })
      ] }),
      outOfContact !== null && /* @__PURE__ */ jsx6(Text6, { level: "faint", size: "sm", children: outOfContact }),
      /* @__PURE__ */ jsxs6(Stack6, { gap: "caption", children: [
        /* @__PURE__ */ jsxs6(Cluster6, { gap: "related-dense", wrap: true, justify: "start", children: [
          /* @__PURE__ */ jsx6(
            CommandButton3,
            {
              size: "sm",
              tone: "go",
              handle: armCmd,
              args: { vesselId, requestId: `arm-${vesselId ?? "none"}` },
              commandLabel: "Arm the flight-plan write surface",
              label: "ARM WRITES",
              confirmLabel: "CONFIRM ARM",
              confirmTone: "nogo",
              pendingLabel: "Arming...",
              disabled: !available,
              "aria-label": "Arm the flight-plan write surface",
              confirmAriaLabel: "Confirm arming the flight-plan write surface",
              onConfirmed: (result) => setLastArm(planWriteReceipt(result))
            }
          ),
          surface?.reason && /* @__PURE__ */ jsx6(Text6, { level: "faint", size: "sm", children: surface.reason })
        ] }),
        nothingWasWritten(lastArm) && /* @__PURE__ */ jsxs6(Stack6, { gap: "caption", role: "status", "aria-live": "polite", children: [
          /* @__PURE__ */ jsx6(Cluster6, { justify: "start", children: /* @__PURE__ */ jsx6(Badge6, { tone: "warn", children: "NOTHING WAS WRITTEN" }) }),
          lastArm.replayed === true ? /* @__PURE__ */ jsx6(Text6, { level: "faint", size: "sm", children: "This arm matched one already sent, so the mod answered with the earlier receipt instead of arming again. The badge above is what the surface actually holds." }) : /* @__PURE__ */ jsx6(Text6, { level: "faint", size: "sm", children: planWriteRefusalLine(lastArm) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs6(Stack6, { gap: "caption", children: [
        /* @__PURE__ */ jsxs6(Text6, { level: "faint", size: "sm", children: [
          `PLAN ENDS ${plan.desiredFinalTimeUt == null ? NULL_DISPLAY6 : ""}`,
          plan.desiredFinalTimeUt != null && /* @__PURE__ */ jsx6(MissionDate3, { value: plan.desiredFinalTimeUt })
        ] }),
        burns.length === 0 && /* @__PURE__ */ jsx6(Text6, { children: "This plan has no burns. Compose one below and send it: the editor here changes burns that already exist." }),
        burns.map((burn) => {
          const index = magnitudeOf9(burn.index);
          const ignition = magnitudeOf9(burn.ignitionUt);
          return /* @__PURE__ */ jsxs6(
            SelectableRow,
            {
              selected: draft?.burnIndex === index,
              onClick: () => setDraft(draftOf(burn)),
              "aria-label": `Burn ${(index ?? 0) + 1}`,
              children: [
                /* @__PURE__ */ jsx6(RowName6, { children: index === null ? NULL_DISPLAY6 : `#${index + 1}` }),
                /* @__PURE__ */ jsxs6(Cluster6, { justify: "end", gap: "related-dense", children: [
                  /* @__PURE__ */ jsx6(
                    Countdown6,
                    {
                      value: untilIgnition(planReading, index, receivedUt),
                      clock: true
                    }
                  ),
                  burn.deltaV == null ? /* @__PURE__ */ jsx6(Text6, { children: NULL_DISPLAY6 }) : /* @__PURE__ */ jsx6(Unit5, { value: burn.deltaV, decimals: 1 }),
                  editWindow(ignition, viewUt, oneWaySeconds)?.shut === true && /* @__PURE__ */ jsx6(Badge6, { tone: "warn", children: "TOO LATE TO EDIT" }),
                  burn.executing === true && /* @__PURE__ */ jsx6(Badge6, { tone: "nogo", children: "BURNING" }),
                  burn.executing == null && /* @__PURE__ */ jsx6(Badge6, { tone: "caution", children: "BURN STATE UNREAD" }),
                  burn.frameEditable === false && /* @__PURE__ */ jsx6(Badge6, { tone: "warn", children: "FRAME LOCKED" }),
                  burn.frameEditable == null && /* @__PURE__ */ jsx6(Badge6, { tone: "caution", children: "FRAME UNREAD" }),
                  burn.anomalous === true && /* @__PURE__ */ jsx6(Badge6, { tone: "warn", children: "ANOM" }),
                  burn.anomalous == null && /* @__PURE__ */ jsx6(Badge6, { tone: "caution", children: "ANOM UNREAD" })
                ] })
              ]
            },
            index ?? String(burn.ignitionUt)
          );
        })
      ] }),
      draft !== null && selected && /* @__PURE__ */ jsxs6(Stack6, { gap: "related-comfortable", "data-burn-editor-form": "", children: [
        /* @__PURE__ */ jsxs6(Cluster6, { wrap: true, justify: "start", gap: "related-dense", children: [
          /* @__PURE__ */ jsx6(Badge6, { tone: "info", children: `BURN ${draft.burnIndex + 1}` }),
          /* @__PURE__ */ jsx6(Text6, { level: "faint", size: "sm", children: plottingFrameLabel(magnitudeOf9(selected.frameType), {
            centre: selected.centreBody,
            primary: selected.primaryBody,
            secondary: selected.secondaryBody
          }) }),
          selected.frameEditable === false && /* @__PURE__ */ jsx6(Badge6, { tone: "warn", children: "THIS FRAME CANNOT BE WRITTEN BACK" }),
          selected.frameEditable == null && /* @__PURE__ */ jsx6(Badge6, { tone: "caution", children: "THIS FRAME COULD NOT BE READ" }),
          selected.executing == null && /* @__PURE__ */ jsx6(Badge6, { tone: "caution", children: "WHETHER THIS BURN IS RUNNING COULD NOT BE READ" }),
          componentsUnreadable && /* @__PURE__ */ jsx6(Badge6, { tone: "warn", children: "DELTA-V NOT IN COMPONENTS" })
        ] }),
        /* @__PURE__ */ jsxs6(Stack6, { gap: "caption", children: [
          /* @__PURE__ */ jsx6(
            ProfileRow,
            {
              name: "THRUST",
              value: selected.thrustKilonewtons,
              decimals: 1
            }
          ),
          /* @__PURE__ */ jsx6(
            ProfileRow,
            {
              name: "MASS FLOW",
              value: selected.massFlowKilogramsPerSecond,
              decimals: 2
            }
          ),
          /* @__PURE__ */ jsx6(
            ProfileRow,
            {
              name: "ISP",
              value: selected.specificImpulseSeconds,
              decimals: 0
            }
          ),
          /* @__PURE__ */ jsx6(
            ProfileRow,
            {
              name: "MASS AT IGNITION",
              value: selected.initialMassTons,
              decimals: 2
            }
          ),
          /* @__PURE__ */ jsx6(
            ProfileRow,
            {
              name: "MASS AT CUTOFF",
              value: selected.finalMassTons,
              decimals: 2
            }
          )
        ] }),
        draftWindow !== null && /* @__PURE__ */ jsxs6(Stack6, { gap: "caption", "data-edit-window": "", children: [
          /* @__PURE__ */ jsx6(Cluster6, { gap: "related-dense", wrap: true, justify: "start", children: draftWindow.shut ? /* @__PURE__ */ jsx6(Badge6, { tone: "warn", children: "EDIT WINDOW SHUT" }) : /* @__PURE__ */ jsxs6(Badge6, { tone: "caution", children: [
            "EDIT WINDOW",
            " ",
            /* @__PURE__ */ jsx6(Countdown6, { value: draftWindow.remainingSeconds, clock: true })
          ] }) }),
          /* @__PURE__ */ jsxs6(Text6, { level: "faint", size: "sm", children: [
            draftWindow.shut ? "An edit sent now reaches Principia after this burn has ignited, so the burn flies as it stands. Move the ignition later, or edit a later burn." : "Past this the edit arrives after ignition and the burn flies as it stands.",
            " ",
            "The window shuts at",
            " ",
            /* @__PURE__ */ jsx6(MissionDate3, { value: value6("ut", draftWindow.deadlineUt) }),
            ",",
            " ",
            /* @__PURE__ */ jsx6(Countdown6, { value: 2 * draftWindow.oneWaySeconds }),
            " before the ignition above: one light time because the plan on screen is that old, and a second because the edit has the same distance to travel back."
          ] })
        ] }),
        /* @__PURE__ */ jsxs6(Stack6, { gap: "caption", children: [
          /* @__PURE__ */ jsx6(SectionTitle6, { children: "IGNITION" }),
          /* @__PURE__ */ jsx6(
            MissionDateField3,
            {
              label: "Ignition",
              value: draft.ignitionUt,
              disabled: frozen,
              onChange: (ut) => setDraft({ ...draft, ignitionUt: ut })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs6(Stack6, { gap: "caption", children: [
          /* @__PURE__ */ jsx6(SectionTitle6, { children: "DELTA-V" }),
          componentsUnreadable && /* @__PURE__ */ jsx6(Text6, { level: "faint", size: "sm", children: "This burn states its delta-v in one of Principia's spherical coordinate systems, which carries a magnitude and two angles rather than three components. The three numbers below are that triple, so they are not metres per second and cannot be edited here. Switch the burn to Cartesian in-game first." }),
          /* @__PURE__ */ jsx6(
            DeltaVRow,
            {
              id: "burn-dv-tangent",
              icon: TangentIcon,
              label: "TANGENT",
              hint: "prograde",
              value: draft.tangent,
              disabled: frozen,
              unitKnown: !componentsUnreadable,
              onChange: (next) => setDraft({ ...draft, tangent: next })
            }
          ),
          /* @__PURE__ */ jsx6(
            DeltaVRow,
            {
              id: "burn-dv-normal",
              icon: FrenetNormalIcon,
              label: "NORMAL",
              value: draft.normal,
              disabled: frozen,
              unitKnown: !componentsUnreadable,
              onChange: (next) => setDraft({ ...draft, normal: next })
            }
          ),
          /* @__PURE__ */ jsx6(
            DeltaVRow,
            {
              id: "burn-dv-binormal",
              icon: BinormalIcon,
              label: "BINORMAL",
              value: draft.binormal,
              disabled: frozen,
              unitKnown: !componentsUnreadable,
              onChange: (next) => setDraft({ ...draft, binormal: next })
            }
          ),
          /* @__PURE__ */ jsxs6(Row6, { as: "div", children: [
            /* @__PURE__ */ jsx6(RowName6, { children: "MAGNITUDE" }),
            componentsUnreadable || draftMagnitude === null ? /* @__PURE__ */ jsx6(Text6, { children: NULL_DISPLAY6 }) : /* @__PURE__ */ jsx6(Unit5, { value: value6("m/s", draftMagnitude), decimals: 1 })
          ] })
        ] }),
        /* @__PURE__ */ jsxs6(Cluster6, { gap: "related-dense", wrap: true, justify: "start", children: [
          /* @__PURE__ */ jsx6(
            ToggleButton,
            {
              size: "sm",
              pressed: draft.inertiallyFixed,
              disabled: frozen,
              onClick: () => setDraft({
                ...draft,
                inertiallyFixed: !draft.inertiallyFixed
              }),
              children: draft.inertiallyFixed ? "INERTIALLY FIXED" : "FRAME-RELATIVE"
            }
          ),
          /* @__PURE__ */ jsx6(
            ToggleButton,
            {
              size: "sm",
              pressed: draft.instantImpulse,
              disabled: frozen,
              onClick: () => setDraft({ ...draft, instantImpulse: !draft.instantImpulse }),
              children: "INSTANT IMPULSE"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs6(Cluster6, { gap: "related-dense", wrap: true, justify: "start", children: [
          /* @__PURE__ */ jsx6(
            CommandButton3,
            {
              size: "sm",
              tone: "go",
              handle: replaceCmd,
              args: {
                vesselId,
                requestId: `replace-${draft.burnIndex}-${draft.ignitionUt}-${draft.tangent}-${draft.normal}-${draft.binormal}-${draft.inertiallyFixed}-${draft.instantImpulse}`,
                burnIndex: draft.burnIndex,
                // `undefined` rather than a zero for an instant nobody stated, the
                // same as the components below. Both controls are held shut in
                // that state, so this is the shape of the args rather than a
                // write that happens.
                ignitionUt: draft.ignitionUt ?? void 0,
                // `undefined`, never a zero, for a component the operator has not
                // stated: the mod leaves an omitted component at the plugin's own
                // value, which is the only honest thing to say about one nobody
                // could read. Both controls are held shut in that state anyway.
                deltaVTangent: draft.tangent ?? void 0,
                deltaVNormal: draft.normal ?? void 0,
                deltaVBinormal: draft.binormal ?? void 0,
                inertiallyFixed: draft.inertiallyFixed,
                profile: draft.instantImpulse ? 1 /* InstantImpulse */ : 0 /* Unchanged */
              },
              commandLabel: `Apply burn ${draft.burnIndex + 1}`,
              label: "APPLY",
              confirmLabel: "CONFIRM APPLY",
              confirmTone: "nogo",
              pendingLabel: "Applying...",
              onConfirmed: (result) => setLastWrite(planWriteReceipt(result)),
              disabled: frozen || tooLate || burnStructUnverified || tripleUnstated || ignitionUnstated,
              "aria-label": "Apply the edited burn",
              confirmAriaLabel: "Confirm applying the edited burn"
            }
          ),
          /* @__PURE__ */ jsx6(
            CommandButton3,
            {
              size: "sm",
              handle: insertCmd,
              args: {
                vesselId,
                /*
                 * The whole draft, as APPLY's is. A repeated id is answered
                 * out of the mod's receipt cache without a write, so an id
                 * keyed on the index and the instant alone made every press
                 * after the first at one index and instant a silent no-op.
                 */
                requestId: `insert-${draft.burnIndex}-${draft.ignitionUt}-${draft.tangent}-${draft.normal}-${draft.binormal}-${draft.inertiallyFixed}-${draft.instantImpulse}`,
                burnIndex: draft.burnIndex,
                // `undefined` rather than a zero for an instant nobody stated, the
                // same as the components below. Both controls are held shut in
                // that state, so this is the shape of the args rather than a
                // write that happens.
                ignitionUt: draft.ignitionUt ?? void 0,
                // `undefined`, never a zero, for a component the operator has not
                // stated: the mod leaves an omitted component at the plugin's own
                // value, which is the only honest thing to say about one nobody
                // could read. Both controls are held shut in that state anyway.
                deltaVTangent: draft.tangent ?? void 0,
                deltaVNormal: draft.normal ?? void 0,
                deltaVBinormal: draft.binormal ?? void 0,
                /*
                 * The same two fields APPLY sends, because this control copies
                 * the burn ON SCREEN and both are part of it. Insert leaves an
                 * unstated field at the TEMPLATE's value and the template is
                 * the SAVED burn, so omitting them added the draft back with
                 * the attitude and the profile it had before the operator
                 * touched either.
                 */
                inertiallyFixed: draft.inertiallyFixed,
                profile: draft.instantImpulse ? 1 /* InstantImpulse */ : 0 /* Unchanged */
              },
              commandLabel: "Add a burn",
              label: "ADD BURN",
              confirmLabel: "CONFIRM ADD",
              confirmTone: "nogo",
              pendingLabel: "Adding...",
              onConfirmed: (result) => setLastWrite(planWriteReceipt(result)),
              disabled: frozen || tooLate || burnStructUnverified || tripleUnstated || ignitionUnstated,
              "aria-label": "Add a burn from these values",
              confirmAriaLabel: "Confirm adding a burn from these values"
            }
          ),
          /* @__PURE__ */ jsx6(
            CommandButton3,
            {
              size: "sm",
              handle: removeCmd,
              args: {
                vesselId,
                requestId: `remove-${draft.burnIndex}`,
                burnIndex: draft.burnIndex
              },
              commandLabel: `Remove burn ${draft.burnIndex + 1}`,
              label: "REMOVE",
              confirmLabel: "CONFIRM REMOVE",
              confirmTone: "nogo",
              pendingLabel: "Removing...",
              onConfirmed: (result) => setLastWrite(planWriteReceipt(result)),
              disabled: !armed || notKnownIdle || outOfContact !== null,
              "aria-label": "Remove this burn from the plan",
              confirmAriaLabel: "Confirm removing this burn from the plan"
            }
          )
        ] }),
        armed && burnStructUnverified && /* @__PURE__ */ jsx6(Text6, { tone: "warn", size: "sm", children: "Principia's burn struct has not survived a round trip in this session. APPLY and ADD write one and are refused; REMOVE writes none." }),
        tripleUnstated && /* @__PURE__ */ jsx6(Text6, { tone: "warn", size: "sm", children: "At least one delta-v component is unstated, so there is no triple to send: an edit keeps whichever components it omits, and Principia holds none this Uplink could read for those. Type all three to mend the burn. REMOVE sends the index alone and is unaffected." }),
        ignitionUnstated && /* @__PURE__ */ jsx6(Text6, { tone: "warn", size: "sm", children: "This burn's ignition instant could not be read, so there is no date to edit and no deadline to measure a write against. Type an instant to state one, or REMOVE the burn: REMOVE sends the index alone and is unaffected." }),
        nothingWasWritten(lastWrite) && /* @__PURE__ */ jsxs6(Stack6, { gap: "caption", role: "status", "aria-live": "polite", children: [
          /* @__PURE__ */ jsx6(Cluster6, { justify: "start", children: /* @__PURE__ */ jsx6(Badge6, { tone: "warn", children: "NOTHING WAS WRITTEN" }) }),
          lastWrite.replayed === true ? /* @__PURE__ */ jsx6(Text6, { level: "faint", size: "sm", children: "This edit matched one already sent, so the mod answered with the earlier receipt instead of writing again. The plan still holds whatever the last write that DID land put there. Change a value and send again." }) : /* @__PURE__ */ jsx6(Text6, { level: "faint", size: "sm", children: planWriteRefusalLine(lastWrite) })
        ] }),
        /* @__PURE__ */ jsxs6(Text6, { level: "faint", size: "sm", children: [
          "Editing the plan as read at",
          " ",
          plan.sampledAtUt == null ? NULL_DISPLAY6 : /* @__PURE__ */ jsx6(MissionDate3, { value: plan.sampledAtUt }),
          "."
        ] })
      ] })
    ] })
  ] });
}
registerAugment5({
  id: "principia-burn-editor",
  augments: "maneuver-planner.sections",
  component: BurnEditor,
  owner: PRINCIPIA
});

// src/PlanComposer/index.tsx
import {
  observedAt,
  readingOf as readingOf2,
  registerAugment as registerAugment6,
  useCommand as useCommand5,
  useTelemetry as useTelemetry6,
  useViewUt as useViewUt7,
  value as value7,
  vectorMagnitude,
  withoutReckoning
} from "@ksp-gonogo/sitrep-sdk";
import {
  Button,
  CommandButton as CommandButton4,
  Countdown as Countdown7,
  FieldLabel as FieldLabel2,
  MissionDate as MissionDate4,
  Row as Row7,
  RowName as RowName7,
  Section as Section6,
  SectionTitle as SectionTitle7,
  Stack as Stack7,
  Text as Text7,
  Unit as Unit6,
  UnitInput
} from "@ksp-gonogo/ui-kit";
import { useState as useState5 } from "react";
import { Fragment as Fragment3, jsx as jsx7, jsxs as jsxs7 } from "react/jsx-runtime";
function PlanComposer() {
  const identity = withoutReckoning(useTelemetry6("vessel.identity"));
  const orbit = withoutReckoning(useTelemetry6("vessel.orbit"));
  const vesselId = knownId(identity);
  const seenAt = observedAt(orbit);
  const { store, drafts } = usePlanDrafts();
  const send = useSendDraft();
  const viewUt = useViewUt7();
  const [sent, setSent] = useState5(null);
  const planCommand = useCommand5(PLAN_SEND_COMMAND, { rail: false });
  if (vesselId === void 0 || seenAt === void 0) {
    return /* @__PURE__ */ jsxs7(Section6, { children: [
      /* @__PURE__ */ jsx7(SectionTitle7, { children: "Compose a plan" }),
      /* @__PURE__ */ jsx7(Text7, { level: "faint", size: "sm", children: "No vessel is being read, so there is nothing to plan for." })
    ] });
  }
  const mine = drafts.filter((draft) => draft.vesselId === vesselId);
  const edit = (draft, burns) => store.update(draft.id, { burns, observedAt: seenAt });
  const setComponent = (draft, index, changes) => {
    const burns = draft.burns.slice();
    burns[index] = { ...burns[index], ...changes };
    edit(draft, burns);
  };
  const composing = mine.filter((draft) => draft.saved !== true);
  const ready = mine.filter((draft) => draft.saved === true);
  return /* @__PURE__ */ jsxs7(Fragment3, { children: [
    /* @__PURE__ */ jsxs7(Section6, { children: [
      /* @__PURE__ */ jsx7(SectionTitle7, { children: "Ready to upload" }),
      /* @__PURE__ */ jsxs7(Stack7, { gap: "related-dense", children: [
        ready.length === 0 ? /* @__PURE__ */ jsx7(Text7, { level: "faint", size: "sm", children: "Nothing saved. A plan reaches the vessel only from here." }) : null,
        ready.map((draft, index) => /* @__PURE__ */ jsx7(
          ReadyPlan,
          {
            draft,
            ordinal: index + 1,
            viewUt: viewUt?.magnitude ?? null,
            source: orbit,
            command: planCommand,
            oneWaySeconds: planCommand.effectiveDelaySeconds,
            pending: send.pending,
            outcome: sent === draft.id ? send.outcome : null,
            onReopen: () => store.update(draft.id, { saved: false }),
            onSend: () => {
              setSent(draft.id);
              return send.send(draft);
            }
          },
          draft.id
        ))
      ] })
    ] }),
    /* @__PURE__ */ jsxs7(Section6, { children: [
      /* @__PURE__ */ jsx7(SectionTitle7, { children: "Composing" }),
      /* @__PURE__ */ jsxs7(Stack7, { gap: "related-dense", children: [
        /* @__PURE__ */ jsx7(
          Button,
          {
            variant: "primary",
            onClick: () => store.create({
              name: `Plan ${mine.length + 1}`,
              vesselId,
              burns: [],
              observedAt: seenAt
            }),
            children: "Draft plan"
          }
        ),
        composing.length === 0 ? /* @__PURE__ */ jsx7(Text7, { level: "faint", size: "sm", children: "Nothing being composed." }) : null,
        composing.map((draft, planIndex) => /* @__PURE__ */ jsxs7(Stack7, { gap: "caption", children: [
          /* @__PURE__ */ jsx7(Row7, { children: /* @__PURE__ */ jsxs7(RowName7, { children: [
            "Draft ",
            planIndex + 1
          ] }) }),
          draft.burns.map((burn, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: position IS a burn's identity in a plan; two burns can share an instant and every other field
            /* @__PURE__ */ jsxs7(Stack7, { gap: "caption", children: [
              /* @__PURE__ */ jsxs7(FieldLabel2, { children: [
                "Burn ",
                index + 1
              ] }),
              /* @__PURE__ */ jsx7(
                UnitInput,
                {
                  label: "Ignition",
                  unit: "ut",
                  value: burn.ignitionUt,
                  rate: { step: 60, stepsPerSecond: 60 },
                  onChange: (next) => setComponent(draft, index, { ignitionUt: next })
                }
              ),
              /* @__PURE__ */ jsx7(
                UnitInput,
                {
                  label: "Tangent",
                  unit: "m/s",
                  value: burn.deltaVTangent,
                  onChange: (next) => setComponent(draft, index, { deltaVTangent: next })
                }
              ),
              /* @__PURE__ */ jsx7(
                UnitInput,
                {
                  label: "Normal",
                  unit: "m/s",
                  value: burn.deltaVNormal,
                  onChange: (next) => setComponent(draft, index, { deltaVNormal: next })
                }
              ),
              /* @__PURE__ */ jsx7(
                UnitInput,
                {
                  label: "Binormal",
                  unit: "m/s",
                  value: burn.deltaVBinormal,
                  onChange: (next) => setComponent(draft, index, { deltaVBinormal: next })
                }
              )
            ] }, `${draft.id}-${index}`)
          )),
          /* @__PURE__ */ jsx7(
            Button,
            {
              variant: "primary",
              onClick: () => edit(draft, [
                ...draft.burns,
                emptyBurn(
                  seededIgnitionUt(
                    draft.burns.length === 0 ? null : draft.burns[draft.burns.length - 1].ignitionUt,
                    viewUt ?? seenAt,
                    planCommand.effectiveDelaySeconds
                  )
                )
              ]),
              children: "Add burn"
            }
          ),
          /* @__PURE__ */ jsxs7(Row7, { children: [
            /* @__PURE__ */ jsx7(RowName7, { children: "Total \u0394v" }),
            /* @__PURE__ */ jsx7(Unit6, { value: totalDeltaV(draft) })
          ] }),
          /* @__PURE__ */ jsx7(
            Button,
            {
              variant: "primary",
              onClick: () => store.update(draft.id, { saved: true }),
              children: "Save draft"
            }
          )
        ] }, draft.id))
      ] })
    ] })
  ] });
}
function ReadyPlan({
  draft,
  ordinal,
  viewUt,
  source,
  command,
  oneWaySeconds,
  pending,
  outcome,
  onSend,
  onReopen
}) {
  const first = draft.burns[0];
  const window = commandWindow(
    first ? first.ignitionUt.magnitude : null,
    viewUt,
    oneWaySeconds
  );
  const upload = {
    ...command,
    send: async () => {
      const answer = await onSend();
      if (!answer.accepted) {
        throw new Error(answer.refusal ?? "The vessel declined the plan.");
      }
      return answer;
    }
  };
  return /* @__PURE__ */ jsxs7(Stack7, { gap: "caption", children: [
    /* @__PURE__ */ jsxs7(Row7, { children: [
      /* @__PURE__ */ jsxs7(RowName7, { children: [
        "Plan ",
        ordinal
      ] }),
      /* @__PURE__ */ jsx7(Unit6, { value: totalDeltaV(draft) })
    ] }),
    first ? /* @__PURE__ */ jsxs7(Row7, { children: [
      /* @__PURE__ */ jsx7(RowName7, { children: "First burn" }),
      /* @__PURE__ */ jsx7(MissionDate4, { value: first.ignitionUt.magnitude })
    ] }) : null,
    window ? /* @__PURE__ */ jsxs7(Row7, { children: [
      /* @__PURE__ */ jsx7(RowName7, { children: window.shut ? "Too late" : "Send within" }),
      window.shut ? /* @__PURE__ */ jsx7(Text7, { tone: "warn", size: "sm", children: "arrives after ignition" }) : /* @__PURE__ */ jsx7(
        Countdown7,
        {
          value: readingOf2(
            source,
            () => value7("s", window.remainingSeconds)
          )
        }
      )
    ] }) : null,
    /* @__PURE__ */ jsx7(
      CommandButton4,
      {
        size: "sm",
        tone: "go",
        handle: upload,
        commandLabel: "Upload the flight plan",
        label: "Upload to vessel",
        confirmLabel: "CONFIRM UPLOAD",
        confirmTone: "nogo",
        pendingLabel: "Uploading...",
        disabled: pending || window?.shut === true,
        "aria-label": "Upload this flight plan to the vessel",
        confirmAriaLabel: "Confirm uploading this flight plan to the vessel"
      }
    ),
    /* @__PURE__ */ jsx7(Button, { variant: "primary", onClick: onReopen, children: "Reopen" }),
    outcome === null ? null : /* @__PURE__ */ jsx7(
      Text7,
      {
        role: "status",
        tone: outcome.accepted ? void 0 : "warn",
        size: "sm",
        children: outcome.accepted ? "Aboard. The vessel is flying this plan." : outcome.refusal
      }
    )
  ] });
}
function totalDeltaV(draft) {
  return draft.burns.reduce(
    (sum, burn) => sum.plus(
      vectorMagnitude({
        x: burn.deltaVTangent,
        y: burn.deltaVNormal,
        z: burn.deltaVBinormal
      })
    ),
    value7("m/s", 0)
  );
}
function emptyBurn(ignitionUt) {
  return {
    ignitionUt,
    deltaVTangent: value7("m/s", 0),
    deltaVNormal: value7("m/s", 0),
    deltaVBinormal: value7("m/s", 0),
    inertiallyFixed: false
  };
}
function knownId(reading) {
  if (reading.state === "observed" || reading.state === "held") {
    return reading.value.vesselId;
  }
  return void 0;
}
registerAugment6({
  id: "principia-plan-composer",
  augments: "maneuver-planner.sections",
  component: PlanComposer,
  owner: PRINCIPIA
});

// src/LibrationPoints/index.tsx
import { registerComponent } from "@ksp-gonogo/sitrep-sdk";

// src/LibrationPoints/config.ts
var AUTO_PAIR = "auto";
var librationPointsActions = [
  {
    id: "cyclePair",
    label: "Cycle Pair",
    accepts: ["button"],
    description: "Step to the next body pair, with Auto in the cycle."
  }
];

// src/LibrationPoints/LibrationPointsConfigForm.tsx
import {
  librationPairLabel,
  librationPairsOf
} from "@ksp-gonogo/sitrep-sdk/frames";
import {
  ConfigForm,
  Field,
  FieldHint,
  FieldLabel as FieldLabel3,
  Select,
  useModalSaveBar
} from "@ksp-gonogo/ui-kit";
import { useMemo, useState as useState6 } from "react";

// src/LibrationPoints/useCatalogue.ts
import {
  CELESTIAL_FACTS,
  useProcessor
} from "@ksp-gonogo/sitrep-sdk";
function useCatalogue() {
  const reading = useProcessor(CELESTIAL_FACTS);
  if (reading?.state === "observed" || reading?.state === "held") {
    return reading.value;
  }
  return void 0;
}

// src/LibrationPoints/LibrationPointsConfigForm.tsx
import { jsx as jsx8, jsxs as jsxs8 } from "react/jsx-runtime";
function LibrationPointsConfigForm({
  config,
  onSave
}) {
  const facts = useCatalogue();
  const candidates = useMemo(() => librationPairsOf(facts), [facts]);
  const [pair, setPair] = useState6(config?.pair ?? AUTO_PAIR);
  const candidate = useMemo(() => ({ pair }), [pair]);
  useModalSaveBar({
    onSave: () => onSave(candidate),
    value: candidate,
    saved: config ?? {}
  });
  return /* @__PURE__ */ jsx8(ConfigForm, { children: /* @__PURE__ */ jsxs8(Field, { children: [
    /* @__PURE__ */ jsx8(FieldLabel3, { htmlFor: "libration-pair", children: "Body pair" }),
    /* @__PURE__ */ jsxs8(
      Select,
      {
        id: "libration-pair",
        value: pair,
        onChange: (e) => setPair(e.target.value),
        children: [
          /* @__PURE__ */ jsx8("option", { value: AUTO_PAIR, children: "Auto (the in-game pair, else the nearest)" }),
          candidates.map((p) => /* @__PURE__ */ jsx8("option", { value: p.secondaryName ?? "", children: librationPairLabel(p) }, p.secondaryIndex))
        ]
      }
    ),
    /* @__PURE__ */ jsx8(FieldHint, { children: 'The pair is also the frame. Five libration points stand still only in the frame that turns with the two bodies they belong to, so choosing the pair is choosing what the picture holds still, and there is nothing else to choose. "Auto" follows the in-game view when it turns with one of these pairs, and otherwise follows the craft to whichever pair it is nearest to.' })
  ] }) });
}

// src/LibrationPoints/LibrationPointsView.tsx
import {
  buildElements,
  CELESTIAL_FACTS as CELESTIAL_FACTS2,
  stillTrue,
  useActionInput,
  useProcessor as useProcessor2,
  useStream as useStream2,
  useSystemInstant,
  useTelemetry as useTelemetry7,
  useViewUt as useViewUt8
} from "@ksp-gonogo/sitrep-sdk";
import {
  CONTROL_FRAME_TOPIC,
  LIBRATION_REFUSALS,
  librationPairLabel as librationPairLabel2,
  librationPairsOf as librationPairsOf2,
  systemInstantAt,
  TRAJECTORY_SCALE_CONVENTIONS,
  TrajectoryFrameKindLike as TrajectoryFrameKindLike2,
  trajectoryFrameLabel,
  useOrbitTrajectory
} from "@ksp-gonogo/sitrep-sdk/frames";
import {
  DeclinedEmptyState,
  derivedMarking,
  ephemerisFigureOf,
  FieldLabel as FieldLabel4,
  FramedDisplay,
  Panel,
  Section as Section7,
  Select as Select2,
  Text as Text9
} from "@ksp-gonogo/ui-kit";
import { useMemo as useMemo2, useState as useState7 } from "react";

// src/LibrationPoints/LibrationDiagram.tsx
import {
  TrajectoryFrameKindLike
} from "@ksp-gonogo/sitrep-sdk/frames";
import { jsx as jsx9, jsxs as jsxs9 } from "react/jsx-runtime";
var HALF_WIDTH_UNITS = 1.5;
var HALF_HEIGHT_UNITS = 1.2;
var PX_PER_UNIT = 100;
var VIEW_BOX = [
  -HALF_WIDTH_UNITS * PX_PER_UNIT,
  -HALF_HEIGHT_UNITS * PX_PER_UNIT,
  2 * HALF_WIDTH_UNITS * PX_PER_UNIT,
  2 * HALF_HEIGHT_UNITS * PX_PER_UNIT
].join(" ");
var MIN_BODY_RADIUS = 3;
var MAX_BODY_RADIUS = 16;
var KEEPING_COLOUR = {
  "on-station": "var(--color-accent-fg)",
  drifting: "var(--color-tag-yellow-fg)",
  elsewhere: "var(--color-text-muted)"
};
function plot(x, y) {
  return { x: x * PX_PER_UNIT, y: -y * PX_PER_UNIT };
}
function bodyRadius(radiusMetres, unitLength) {
  if (radiusMetres === null || !Number.isFinite(radiusMetres) || !(unitLength > 0)) {
    return MIN_BODY_RADIUS;
  }
  const scaled = radiusMetres / unitLength * PX_PER_UNIT;
  return Math.min(MAX_BODY_RADIUS, Math.max(MIN_BODY_RADIUS, scaled));
}
var LABEL_OFFSET = {
  L1: { dx: 0, dy: -12 },
  L2: { dx: 0, dy: -12 },
  L3: { dx: 0, dy: -12 },
  L4: { dx: 0, dy: -12 },
  L5: { dx: 0, dy: 20 }
};
var BODY_LABEL_SIZE = 13;
var VESSEL_LABEL_SIZE = 12;
var LABEL_ROW = 15;
var LABEL_GAP = 6;
var GLYPH_ADVANCE = 0.6;
function overlaps(a, b) {
  const halfWidths = (a.text.length * a.size + b.text.length * b.size) * (GLYPH_ADVANCE / 2);
  return Math.abs(a.x - b.x) < halfWidths + LABEL_GAP && Math.abs(a.y - b.y) < Math.max(a.size, b.size);
}
function vesselLabelY(wanted, bodies) {
  let y = wanted.y;
  while (bodies.some((body) => overlaps({ ...wanted, y }, body))) {
    y += LABEL_ROW;
  }
  return y;
}
function collinearLabelX(points) {
  const l1 = points.find((p) => p.name === "L1");
  const l2 = points.find((p) => p.name === "L2");
  if (l1 === void 0 || l2 === void 0) return {};
  const x1 = plot(...pointXy(l1.frame)).x;
  const x2 = plot(...pointXy(l2.frame)).x;
  const nameWidth = "L1".length * BODY_LABEL_SIZE * GLYPH_ADVANCE;
  if (Math.abs(x2 - x1) >= nameWidth + LABEL_GAP) return {};
  const mid = (x1 + x2) / 2;
  const [left, right] = x1 <= x2 ? ["L1", "L2"] : ["L2", "L1"];
  return {
    [left]: { x: mid - LABEL_GAP / 2, anchor: "end" },
    [right]: { x: mid + LABEL_GAP / 2, anchor: "start" }
  };
}
function LibrationDiagram({
  answer,
  offset,
  primaryRadius,
  secondaryRadius,
  vesselName,
  trajectory
}) {
  const frame2 = answer.frame;
  if (frame2 === null) return null;
  const massRatio = answer.massRatio;
  const primary = plot(-massRatio, 0);
  const secondary = plot(1 - massRatio, 0);
  const primaryR = bodyRadius(primaryRadius, frame2.unitLength);
  const secondaryR = bodyRadius(secondaryRadius, frame2.unitLength);
  const nearest = offset === null ? null : answer.points.find((p) => p.name === offset.nearest) ?? null;
  const vessel = offset === null ? null : plot(offset.vesselFrame[0], offset.vesselFrame[1]);
  const nearestPlot = nearest === null ? null : plot(...pointXy(nearest.frame));
  const path = trajectory !== null && trajectory.shape === "arc" && trajectory.frame.kind === TrajectoryFrameKindLike.RotatingPulsating && trajectory.points.length > 1 ? trajectory : null;
  const primaryLabel = {
    x: primary.x,
    y: primary.y + primaryR + LABEL_ROW,
    text: answer.pair?.primaryName ?? "primary",
    size: BODY_LABEL_SIZE
  };
  const secondaryLabel = {
    x: secondary.x,
    y: secondary.y + secondaryR + LABEL_ROW,
    text: answer.pair?.secondaryName ?? "secondary",
    size: BODY_LABEL_SIZE
  };
  const vesselLabel = vessel === null || vesselName === null ? null : {
    x: vessel.x,
    y: vesselLabelY(
      {
        x: vessel.x,
        y: vessel.y + 18,
        text: vesselName,
        size: VESSEL_LABEL_SIZE
      },
      [primaryLabel, secondaryLabel]
    ),
    text: vesselName,
    size: VESSEL_LABEL_SIZE
  };
  const partedLabels = collinearLabelX(answer.points);
  const pathPoints = path === null ? null : path.points.map((p) => {
    const at = plot(p.x, p.y);
    return `${at.x},${at.y}`;
  }).join(" ");
  return /* @__PURE__ */ jsxs9(
    "svg",
    {
      viewBox: VIEW_BOX,
      preserveAspectRatio: "xMidYMid meet",
      role: "img",
      "aria-label": `The five libration points of the ${answer.pair?.primaryName ?? "primary"}-${answer.pair?.secondaryName ?? "secondary"} pair, drawn in the frame that turns with it.`,
      style: { display: "block", width: "100%", height: "100%" },
      "data-libration-frame": "rotating-pulsating",
      "data-libration-pair": `${answer.pair?.primaryName ?? "?"}-${answer.pair?.secondaryName ?? "?"}`,
      "data-libration-unit-length": frame2.unitLength,
      "data-libration-mass-ratio": massRatio,
      children: [
        /* @__PURE__ */ jsx9(
          "circle",
          {
            cx: primary.x,
            cy: primary.y,
            r: PX_PER_UNIT,
            fill: "none",
            stroke: "var(--color-border-subtle)",
            strokeWidth: 0.7,
            strokeDasharray: "4 5"
          }
        ),
        /* @__PURE__ */ jsx9(
          "line",
          {
            x1: -HALF_WIDTH_UNITS * PX_PER_UNIT,
            y1: 0,
            x2: HALF_WIDTH_UNITS * PX_PER_UNIT,
            y2: 0,
            stroke: "var(--color-border-subtle)",
            strokeWidth: 0.7
          }
        ),
        /* @__PURE__ */ jsxs9("g", { stroke: "var(--color-text-faint)", strokeWidth: 0.9, children: [
          /* @__PURE__ */ jsx9("line", { x1: -5, y1: 0, x2: 5, y2: 0 }),
          /* @__PURE__ */ jsx9("line", { x1: 0, y1: -5, x2: 0, y2: 5 })
        ] }),
        pathPoints !== null && /* @__PURE__ */ jsx9(
          "polyline",
          {
            points: pathPoints,
            fill: "none",
            stroke: "var(--color-info-mark)",
            strokeWidth: 1.2,
            opacity: 0.8,
            "data-libration-path": "arc",
            "data-trajectory-frame": path?.frame.kind
          }
        ),
        nearestPlot !== null && vessel !== null && /* @__PURE__ */ jsx9(
          "line",
          {
            x1: vessel.x,
            y1: vessel.y,
            x2: nearestPlot.x,
            y2: nearestPlot.y,
            stroke: KEEPING_COLOUR[offset?.keeping ?? "elsewhere"],
            strokeWidth: 1,
            strokeDasharray: "3 3",
            "data-libration-offset-line": offset?.nearest
          }
        ),
        answer.points.map((point) => {
          const at = plot(...pointXy(point.frame));
          const label = LABEL_OFFSET[point.name];
          const parted = partedLabels[point.name];
          const highlighted = offset?.nearest === point.name;
          return /* @__PURE__ */ jsxs9("g", { children: [
            /* @__PURE__ */ jsx9(
              "circle",
              {
                cx: at.x,
                cy: at.y,
                r: highlighted ? 5 : 3.5,
                fill: "none",
                stroke: highlighted ? "var(--color-accent-fg)" : "var(--color-info-mark)",
                strokeWidth: 1.4,
                "data-libration-point": point.name
              }
            ),
            /* @__PURE__ */ jsx9(
              "text",
              {
                x: parted?.x ?? at.x + label.dx,
                y: at.y + label.dy,
                textAnchor: parted?.anchor ?? "middle",
                fontSize: BODY_LABEL_SIZE,
                fill: highlighted ? "var(--color-accent-fg)" : "var(--color-text-muted)",
                children: point.name
              }
            )
          ] }, point.name);
        }),
        /* @__PURE__ */ jsx9(
          "circle",
          {
            cx: primary.x,
            cy: primary.y,
            r: primaryR,
            fill: "var(--color-text-primary)",
            "data-libration-body": "primary"
          }
        ),
        /* @__PURE__ */ jsx9(
          "text",
          {
            x: primaryLabel.x,
            y: primaryLabel.y,
            textAnchor: "middle",
            fontSize: primaryLabel.size,
            fill: "var(--color-text-primary)",
            children: primaryLabel.text
          }
        ),
        /* @__PURE__ */ jsx9(
          "circle",
          {
            cx: secondary.x,
            cy: secondary.y,
            r: secondaryR,
            fill: "var(--color-text-muted)",
            "data-libration-body": "secondary"
          }
        ),
        /* @__PURE__ */ jsx9(
          "text",
          {
            x: secondaryLabel.x,
            y: secondaryLabel.y,
            textAnchor: "middle",
            fontSize: secondaryLabel.size,
            fill: "var(--color-text-muted)",
            children: secondaryLabel.text
          }
        ),
        vessel !== null && /* @__PURE__ */ jsxs9("g", { "data-libration-vessel": offset?.keeping, children: [
          /* @__PURE__ */ jsx9(
            "path",
            {
              d: `M ${vessel.x} ${vessel.y - 6} L ${vessel.x + 5} ${vessel.y + 4} L ${vessel.x - 5} ${vessel.y + 4} Z`,
              fill: KEEPING_COLOUR[offset?.keeping ?? "elsewhere"]
            }
          ),
          vesselLabel !== null && /* @__PURE__ */ jsx9(
            "text",
            {
              x: vesselLabel.x,
              y: vesselLabel.y,
              textAnchor: "middle",
              fontSize: vesselLabel.size,
              fill: KEEPING_COLOUR[offset?.keeping ?? "elsewhere"],
              children: vesselLabel.text
            }
          )
        ] })
      ]
    }
  );
}
function pointXy(frame2) {
  return [frame2[0], frame2[1]];
}

// src/LibrationPoints/LibrationReadouts.tsx
import { staticValue, value as value8 } from "@ksp-gonogo/sitrep-sdk";
import {
  Row as Row8,
  RowName as RowName8,
  Text as Text8,
  Unit as Unit7
} from "@ksp-gonogo/ui-kit";
import { Fragment as Fragment4, jsx as jsx10, jsxs as jsxs10 } from "react/jsx-runtime";
var KEEPING_TONE = {
  "on-station": "go",
  drifting: "warn",
  elsewhere: "neutral"
};
var KEEPING_WORDS = {
  "on-station": "holding station",
  drifting: "drifting off station",
  elsewhere: "not stationkeeping on it"
};
function LibrationReadouts({
  answer,
  offset,
  hasCraft,
  craftMarking,
  ephemerisFigure
}) {
  return /* @__PURE__ */ jsxs10(Fragment4, { children: [
    /* @__PURE__ */ jsxs10(Row8, { children: [
      /* @__PURE__ */ jsx10(RowName8, { children: "Separation" }),
      /* @__PURE__ */ jsx10(Text8, { children: /* @__PURE__ */ jsx10(
        Unit7,
        {
          value: ephemerisFigure(value8("m", answer.frame?.unitLength ?? 0))
        }
      ) })
    ] }),
    /* @__PURE__ */ jsxs10(Row8, { children: [
      /* @__PURE__ */ jsx10(RowName8, { children: "Mass ratio" }),
      /* @__PURE__ */ jsx10(Text8, { children: /* @__PURE__ */ jsx10(Unit7, { value: staticValue("%", answer.massRatio * 100), decimals: 3 }) })
    ] }),
    hasCraft && /* @__PURE__ */ jsx10(CraftOffsetRows, { offset, marking: craftMarking })
  ] });
}
function CraftOffsetRows({
  offset,
  marking
}) {
  if (offset === null) {
    return /* @__PURE__ */ jsxs10(Row8, { children: [
      /* @__PURE__ */ jsx10(RowName8, { children: "Craft" }),
      /* @__PURE__ */ jsx10(Text8, { level: "muted", children: "not placeable in this frame" })
    ] });
  }
  return /* @__PURE__ */ jsxs10(Fragment4, { children: [
    /* @__PURE__ */ jsxs10(Row8, { children: [
      /* @__PURE__ */ jsx10(RowName8, { children: "Nearest" }),
      /* @__PURE__ */ jsxs10(Text8, { tone: KEEPING_TONE[offset.keeping], level: "muted", children: [
        offset.nearest,
        " \xB7 ",
        KEEPING_WORDS[offset.keeping]
      ] })
    ] }),
    /* @__PURE__ */ jsxs10(Row8, { children: [
      /* @__PURE__ */ jsx10(RowName8, { children: "Off station" }),
      /* @__PURE__ */ jsx10(Text8, { tone: KEEPING_TONE[offset.keeping], level: "muted", children: /* @__PURE__ */ jsx10(Unit7, { value: value8("m", offset.distanceMetres), marked: marking }) })
    ] })
  ] });
}

// src/LibrationPoints/pairResolution.ts
import {
  ControlFrameKind,
  solve
} from "@ksp-gonogo/sitrep-sdk";
import {
  lagrangePointsAt,
  librationOffsetOf
} from "@ksp-gonogo/sitrep-sdk/frames";
function vesselInertialAt(elements, referenceBodyIndex, system) {
  if (elements === null || referenceBodyIndex == null) return null;
  if (!(elements.ecc >= 0 && elements.ecc < 1)) return null;
  const parent = system.positionByIndex.get(referenceBodyIndex);
  if (parent === void 0) return null;
  const state = solve(elements, system.ut);
  return [
    parent[0] + state.position[0],
    parent[1] + state.position[1],
    parent[2] + state.position[2]
  ];
}
function resolveFor(facts, secondaryIndex, ut, system, vesselInertial) {
  const answer = lagrangePointsAt(
    facts,
    secondaryIndex,
    ut,
    system ?? void 0
  );
  return { answer, offset: librationOffsetOf(answer, vesselInertial) };
}
function controlFramePair(frame2, candidates) {
  if (frame2 == null) return null;
  if (frame2.kind !== ControlFrameKind.BarycentricRotating && frame2.kind !== ControlFrameKind.RotatingPulsating) {
    return null;
  }
  const pair = candidates.find(
    (p) => p.secondaryName === frame2.secondaryBody && p.primaryName === frame2.primaryBody
  );
  return pair?.secondaryIndex ?? null;
}
function autoPair(facts, candidates, ut, system, vesselInertial, vesselBodyIndex, controlFrame) {
  if (candidates.length === 0) return null;
  const followed = controlFramePair(controlFrame, candidates);
  if (followed !== null) return followed;
  if (vesselInertial !== null && system !== null) {
    let best = null;
    for (const pair of candidates) {
      const { offset } = resolveFor(
        facts,
        pair.secondaryIndex,
        ut,
        system,
        vesselInertial
      );
      if (offset === null) continue;
      if (best === null || offset.distanceUnits < best.units) {
        best = { index: pair.secondaryIndex, units: offset.distanceUnits };
      }
    }
    if (best !== null) return best.index;
  }
  const own = candidates.find((p) => p.secondaryIndex === vesselBodyIndex);
  return own?.secondaryIndex ?? candidates[0].secondaryIndex;
}

// src/LibrationPoints/LibrationPointsView.tsx
import { jsx as jsx11, jsxs as jsxs11 } from "react/jsx-runtime";
var UT_BUCKET_SECONDS = 1;
function orbitOfNow(reading) {
  if (reading.state === "observed") {
    return reading.reckoning.status === "available" ? { ...reading.value, ...reading.reckoning.value } : reading.value;
  }
  if (reading.state === "held" && reading.reckoning.status === "available") {
    return { ...reading.value, ...reading.reckoning.value };
  }
  return void 0;
}
function refusalCopy(answer) {
  if (answer.refusal === LIBRATION_REFUSALS.NotAttempted) {
    return "No pair chosen yet, so no libration points have been sought. Pick one above.";
  }
  return answer.because;
}
function LibrationPointsComponent({
  config,
  id
}) {
  const catalogue = useProcessor2(CELESTIAL_FACTS2);
  const poses = useSystemInstant();
  const facts = catalogue?.state === "observed" || catalogue?.state === "held" ? catalogue.value : void 0;
  const viewUt = useViewUt8()?.magnitude;
  const ut = typeof viewUt === "number" && Number.isFinite(viewUt) ? Math.floor(viewUt / UT_BUCKET_SECONDS) * UT_BUCKET_SECONDS : 0;
  const orbitReading = useTelemetry7("vessel.orbit");
  const orbit = orbitOfNow(orbitReading);
  const orbitMarking = orbitReading.state === "observed" || orbitReading.state === "held" ? derivedMarking(orbitReading) : null;
  const identityReading = useTelemetry7("vessel.identity");
  const identity = stillTrue(identityReading, void 0);
  const candidates = useMemo2(() => librationPairsOf2(facts), [facts]);
  const frameReading = useStream2(CONTROL_FRAME_TOPIC);
  const controlFrame = frameReading.state === "observed" || frameReading.state === "held" ? frameReading.value : void 0;
  const [chosen, setChosen] = useState7(config?.pair ?? AUTO_PAIR);
  const chosenIndex = chosen === AUTO_PAIR ? null : facts?.indexByName[chosen] ?? null;
  const chosenIsMissing = chosen !== AUTO_PAIR && chosenIndex === null;
  useActionInput({
    cyclePair: (payload) => {
      if (payload.kind === "button" && payload.value !== true) return void 0;
      const order = [
        AUTO_PAIR,
        ...candidates.flatMap(
          (pair) => pair.secondaryName ? [pair.secondaryName] : []
        )
      ];
      const next = order[(order.indexOf(chosen) + 1) % order.length];
      setChosen(next);
      return { pair: next };
    }
  });
  const system = useMemo2(
    () => facts === void 0 || ut == null ? null : systemInstantAt(facts, ut),
    [facts, ut]
  );
  const elements = useMemo2(
    () => orbit?.sma.isFinite() ? buildElements(orbit) : null,
    [orbit]
  );
  const vesselInertial = useMemo2(
    () => system === null ? null : vesselInertialAt(elements, orbit?.referenceBodyIndex, system),
    [elements, orbit?.referenceBodyIndex, system]
  );
  const secondaryIndex = useMemo2(() => {
    if (chosen !== AUTO_PAIR) return chosenIndex;
    if (ut == null) return null;
    return autoPair(
      facts,
      candidates,
      ut,
      system,
      vesselInertial,
      identity?.parentBodyIndex,
      controlFrame
    );
  }, [
    chosen,
    chosenIndex,
    facts,
    candidates,
    ut,
    system,
    vesselInertial,
    identity?.parentBodyIndex,
    controlFrame
  ]);
  const { answer, offset } = useMemo2(
    () => resolveFor(
      facts,
      secondaryIndex,
      ut ?? Number.NaN,
      system,
      vesselInertial
    ),
    [facts, secondaryIndex, ut, system, vesselInertial]
  );
  const drawn = answer.refusal === LIBRATION_REFUSALS.NotRefused;
  const readFrame = useMemo2(
    () => facts !== void 0 && drawn ? { readFrame: { choice: answer.frameChoice, facts } } : void 0,
    [facts, drawn, answer.frameChoice]
  );
  const trajectory = useOrbitTrajectory(
    orbit,
    readFrame
  );
  const trajectoryWithheld = trajectory !== null && trajectory.shape === "withheld" ? trajectory : null;
  const secondaryBody = answer.pair === null ? null : facts?.bodies.find((b) => b.index === answer.pair?.secondaryIndex) ?? null;
  const primaryBody = answer.pair?.primaryIndex == null ? null : facts?.bodies.find((b) => b.index === answer.pair?.primaryIndex) ?? null;
  return /* @__PURE__ */ jsx11(
    Panel,
    {
      panelTitle: "LIBRATION",
      panelSidebar: drawn ? /* @__PURE__ */ jsx11(Section7, { as: "ul", gap: "rows", style: READOUTS, children: /* @__PURE__ */ jsx11(
        LibrationReadouts,
        {
          answer,
          offset,
          hasCraft: orbit !== void 0,
          craftMarking: orbitMarking,
          ephemerisFigure: ephemerisFigureOf(poses, [
            primaryBody,
            secondaryBody
          ])
        }
      ) }) : void 0,
      panelToolbar: /* @__PURE__ */ jsxs11("div", { style: PAIR_LABEL, children: [
        /* @__PURE__ */ jsx11(FieldLabel4, { htmlFor: `${id}-libration-pair`, children: "Pair" }),
        /* @__PURE__ */ jsxs11(
          Select2,
          {
            id: `${id}-libration-pair`,
            value: chosen,
            onChange: (e) => setChosen(e.target.value),
            children: [
              /* @__PURE__ */ jsx11("option", { value: AUTO_PAIR, children: "Auto" }),
              candidates.map((pair) => /* @__PURE__ */ jsx11(
                "option",
                {
                  value: pair.secondaryName ?? "",
                  children: librationPairLabel2(pair)
                },
                pair.secondaryIndex
              )),
              chosenIsMissing && // The saved pair stays the choice when this save has no such body, so the control never shows a pair not being drawn.
              /* @__PURE__ */ jsxs11("option", { value: chosen, children: [
                chosen,
                " (not in this system)"
              ] })
            ]
          }
        )
      ] }),
      sections: [
        /* @__PURE__ */ jsxs11(Section7, { full: true, children: [
          /* @__PURE__ */ jsx11(Text9, { level: "muted", size: "xs", children: trajectoryFrameLabel(
            {
              kind: TrajectoryFrameKindLike2.RotatingPulsating,
              primaryBodyIndex: answer.pair?.primaryIndex ?? void 0,
              secondaryBodyIndex: answer.pair?.secondaryIndex,
              lengthsPulsate: true,
              scaleConvention: TRAJECTORY_SCALE_CONVENTIONS.separationAtPointInstant,
              unitLength: answer.frame?.unitLength
            },
            facts
          ) }),
          drawn && trajectoryWithheld && /* @__PURE__ */ jsx11(DeclinedEmptyState, { declined: trajectoryWithheld.declined })
        ] }, "frame"),
        /* @__PURE__ */ jsx11(Section7, { fill: true, children: !drawn ? /* @__PURE__ */ jsx11("div", { style: REFUSAL, role: "status", "aria-live": "polite", children: /* @__PURE__ */ jsx11(Text9, { level: "muted", size: "sm", children: refusalCopy(answer) }) }) : /* @__PURE__ */ jsx11(FramedDisplay, { style: DIAGRAM_FRAME, children: /* @__PURE__ */ jsx11(
          LibrationDiagram,
          {
            answer,
            offset,
            primaryRadius: primaryBody?.radius ?? null,
            secondaryRadius: secondaryBody?.radius ?? null,
            vesselName: typeof identity?.name === "string" ? identity.name : null,
            trajectory
          }
        ) }) }, "view")
      ]
    }
  );
}
var PAIR_LABEL = {
  display: "flex",
  alignItems: "center",
  gap: "var(--gap-related)"
};
var DIAGRAM_FRAME = { flex: 1, minWidth: 0, minHeight: 0 };
var READOUTS = { flex: "0 0 auto" };
var REFUSAL = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: "var(--inset-refusal)"
};

// src/LibrationPoints/index.tsx
registerComponent({
  id: "libration-points",
  name: "Libration Points",
  description: "The five libration points of a body pair, drawn in the frame that turns with it so they hold still, with the craft's offset from the one it is nearest.",
  tags: ["telemetry", "navigation"],
  defaultSize: { w: 6, h: 10 },
  minSize: { w: 4, h: 7 },
  component: LibrationPointsComponent,
  configComponent: LibrationPointsConfigForm,
  channels: ["trackingStation.bodies"],
  optionalChannels: ["vessel.orbit", "vessel.identity"],
  defaultConfig: { pair: AUTO_PAIR },
  actions: librationPointsActions,
  pushable: true,
  owner: PRINCIPIA
});
export {
  BurnEditor,
  CoastAnalysisSection,
  FRAME_TYPE,
  FlightPlanSection,
  LibrationDiagram,
  LibrationPointsComponent,
  MAX_STEPS_OPTIONS,
  OrbitAnalysisRows,
  OrbitAnalysisSection,
  PlanComposer,
  PlanIntegrationBlock,
  PlanSlots,
  GENERATED_COMMAND_IDS as UPLINK_COMMAND_IDS,
  frameHasApsides,
  frameLengthsPulsate,
  orbitDescription,
  outOfContactReason,
  planView2 as planView,
  plottingFrameLabel
};
