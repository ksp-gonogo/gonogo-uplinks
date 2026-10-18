// src/uplink.ts
import { defineUplinkClient, registerErrorCodes } from "@ksp-gonogo/sitrep-sdk";

// src/__generated__/error-codes.ts
var RP1_ERROR_CODES = [
  {
    id: "rp1.notManaging",
    kind: "refusal",
    refines: "careerModeRequired",
    origin: null,
    sentence: "RP-1 is not managing this save",
    meaning: "RP-1 is installed but is not managing this save, so none of its career commands apply to it. A property of the save rather than of the moment."
  },
  {
    id: "rp1.spaceCentreNotLoaded",
    kind: "refusal",
    refines: "modeUnavailable",
    origin: null,
    sentence: "RP-1's space centre is not loaded",
    meaning: "RP-1's space centre, which holds every queue and complex these commands act on, is not loaded in the current scene."
  },
  {
    id: "rp1.notReady",
    kind: "refusal",
    refines: "wrongState",
    origin: null,
    sentence: "the vehicle is not ready to fly yet",
    meaning: "The vehicle or the complex it needs has RP-1 work outstanding: never integrated, still integrating, not rolled out, or on a pad still being reconditioned. Nothing is over a limit and nothing is broken, the work simply has not been done. The detail says which."
  },
  {
    id: "rp1.buildUnrecognised",
    kind: "refusal",
    refines: "unreadable",
    origin: null,
    sentence: "this RP-1 build is not one this Uplink recognises",
    meaning: "The installed RP-1 build lacks a member this Uplink reads or calls, so the command could not be carried out. The detail names which one."
  }
];

// src/__generated__/units.ts
var GENERATED_TYPE_UNITS = {
  "Rp1Avionics": {
    limitedByNonInterplanetary: "flag",
    lockLevel: "enum",
    supportedMassTons: "t",
    vesselMassTons: "t"
  },
  "Rp1Budget": {
    refreshedAt: "ut",
    reputation: "rep",
    reputationDecayPerDay: "rep/day",
    reputationDecayPerYear: "rep",
    subsidyMaxPerDay: "f/day",
    subsidyMaxRep: "rep",
    subsidyMinPerDay: "f/day",
    subsidyPerDay: "f/day",
    unlockCreditBalance: "funds"
  },
  "Rp1BudgetBreakdown": {
    refreshedAt: "ut"
  },
  "Rp1BudgetForecastSample": {
    fundsDelta: "funds",
    horizon: "s"
  },
  "Rp1BudgetHorizons": {
    day: "funds",
    month: "funds",
    year: "funds"
  },
  "Rp1BudgetPeriod": {
    astronauts: "funds",
    balance: "funds",
    constructions: "funds",
    facilities: "funds",
    fundsDelta: "funds",
    integrationTeams: "funds",
    net: "funds",
    programBudget: "funds",
    researchTeams: "funds",
    rollout: "funds",
    span: "s",
    subsidy: "funds",
    unlockCredit: "funds",
    upkeep: "funds",
    upkeepBeforeModifiers: "funds",
    upkeepModifiers: "funds"
  },
  "Rp1BuildCost": {
    rolloutCost: "funds",
    toolingCost: "funds",
    unlockCost: "funds",
    untooledSurcharge: "funds",
    vehicleCost: "funds"
  },
  "Rp1BuildItemEntry": {
    cost: "funds",
    humanRated: "flag",
    id: "id",
    kscName: "id",
    launchSite: "id",
    lcId: "id",
    mass: "t",
    progress: "bp",
    progressRatio: "ratio",
    projectType: "enum",
    rate: "bp/s",
    shipId: "id",
    shipName: "text",
    stalled: "flag",
    timeLeftSeconds: "s",
    totalPoints: "bp"
  },
  "Rp1BuildQuote": {
    affordable: "flag",
    balance: "funds",
    price: "funds"
  },
  "Rp1BuildQuoteArgs": {
    craftFile: "id",
    facility: "enum",
    lcId: "id"
  },
  "Rp1BuildRepeatArgs": {
    id: "id"
  },
  "Rp1BuildStartArgs": {
    craftFile: "id",
    facility: "enum",
    lcId: "id"
  },
  "Rp1BuildableComplex": {
    eligible: "flag",
    kscDisplayName: "text",
    kscName: "id",
    lcId: "id",
    name: "text",
    refusals: "text"
  },
  "Rp1BuildableCraftEntry": {
    craftFile: "id",
    facility: "enum",
    lockedParts: "text",
    mass: "t",
    missingParts: "text",
    partCount: "count",
    shipName: "text",
    unpurchasedParts: "text"
  },
  "Rp1BuildingUpkeepEntry": {
    facility: "enum"
  },
  "Rp1CareerEventEntry": {
    builtAt: "enum",
    cost: "funds",
    detail: "enum",
    isAdd: "flag",
    kind: "enum",
    launchId: "id",
    name: "text",
    repChange: "rep",
    ut: "ut"
  },
  "Rp1CareerEvents": {
    enabled: "flag"
  },
  "Rp1CareerLedger": {
    enabled: "flag"
  },
  "Rp1CentreEntry": {
    anyOperational: "flag",
    engineers: "count",
    groundStation: "id",
    idleSalaryPerDay: "f/day",
    isActive: "flag",
    kscDisplayName: "text",
    kscName: "id",
    launchComplexCount: "count",
    salaryPerDay: "f/day",
    unassignedEngineers: "count",
    upkeepPerDay: "f/day"
  },
  "Rp1ComplexDismantleArgs": {
    lcId: "id"
  },
  "Rp1ComplexEntry": {
    canIntegrate: "flag",
    efficiency: "ratio",
    efficiencyGroupKey: "id",
    efficiencySharedWith: "id",
    engineers: "count",
    humanRated: "flag",
    isOperational: "flag",
    isRushing: "flag",
    kscDisplayName: "text",
    kscName: "id",
    launchPadCount: "count",
    lcId: "id",
    lcType: "enum",
    massMax: "t",
    massMin: "t",
    massOrig: "t",
    maxEngineers: "count",
    name: "text",
    newPadCost: "funds",
    rate: "bp/s",
    resourcesHandled: "id",
    rushSalaryDeltaPerDay: "f/day",
    salaryPerDay: "f/day",
    sizeMaxDepth: "m",
    sizeMaxHeight: "m",
    sizeMaxWidth: "m",
    upkeepPerDay: "f/day"
  },
  "Rp1ComplexModifyArgs": {
    assignEngineersOnComplete: "flag",
    humanRated: "flag",
    lcId: "id",
    massMax: "t"
  },
  "Rp1ComplexNewArgs": {
    assignEngineersOnComplete: "flag",
    humanRated: "flag",
    kscName: "id",
    massMax: "t",
    name: "id"
  },
  "Rp1ComplexRenameArgs": {
    lcId: "id",
    name: "id"
  },
  "Rp1ComplexRushArgs": {
    lcId: "id",
    rushing: "flag"
  },
  "Rp1ComplexSizeArgs": {
    sizeMaxDepth: "m",
    sizeMaxHeight: "m",
    sizeMaxWidth: "m"
  },
  "Rp1ComplexUpkeepEntry": {
    kscDisplayName: "text",
    kscName: "id",
    lcId: "id",
    name: "text",
    operational: "flag"
  },
  "Rp1Confidence": {
    confidence: "confidence",
    earned: "confidence"
  },
  "Rp1ConstructionCancelArgs": {
    id: "id"
  },
  "Rp1ConstructionCostEntry": {
    id: "id",
    kind: "enum",
    kscDisplayName: "text",
    kscName: "id",
    name: "text"
  },
  "Rp1ConstructionEntry": {
    affordableFraction: "ratio",
    cost: "funds",
    currentLevel: "count",
    engineersToReadd: "count",
    facilityType: "enum",
    id: "id",
    isModify: "flag",
    kind: "enum",
    kscName: "id",
    lcId: "id",
    name: "text",
    padId: "id",
    progress: "bp",
    progressRatio: "ratio",
    rate: "bp/s",
    spentCost: "funds",
    spentRushCost: "funds",
    stalled: "flag",
    targetLevel: "count",
    timeLeftSeconds: "s",
    totalPoints: "bp",
    workRate: "ratio"
  },
  "Rp1ConstructionRateArgs": {
    id: "id",
    workRate: "ratio"
  },
  "Rp1ConstructionRateStep": {
    costMultiplier: "ratio",
    costPerDay: "f/day",
    finishesAt: "ut",
    workRate: "ratio"
  },
  "Rp1ConstructionRateTable": {
    id: "id"
  },
  "Rp1ConstructionRates": {
    refreshedAt: "ut"
  },
  "Rp1ContractPayloadArgs": {
    commsPayload: "kg",
    weatherPayload: "kg"
  },
  "Rp1CourseCostEntry": {
    id: "id",
    students: "count"
  },
  "Rp1CrewCostEntry": {
    inFlight: "flag",
    name: "id"
  },
  "Rp1CrewEntry": {
    latestRetiresAtUt: "ut",
    name: "id",
    nextTrainingExpiryTarget: "text",
    nextTrainingExpiryUt: "ut",
    retired: "flag",
    retirementExtensionUsedSeconds: "s",
    retiresAtUt: "ut",
    trainingCourse: "text",
    trainingExpiryCount: "count",
    trainingFinishesAtUt: "ut",
    trainingFractionComplete: "ratio",
    trainingStarted: "flag",
    trainingTarget: "text",
    trainingType: "text"
  },
  "Rp1CrewProgram": {
    courses: "count",
    coursesStarted: "count",
    crewInTraining: "count",
    crewRnREnabled: "flag",
    missionTrainingRate: "1",
    proficiencyTrainingRate: "1",
    retirementExtensionCapSeconds: "s"
  },
  "Rp1FacilityEntry": {
    currentTier: "count",
    facility: "enum",
    maxTier: "count",
    upgradeCost: "funds",
    upgradedByRp1: "flag"
  },
  "Rp1FacilityUpgradeArgs": {
    facility: "id"
  },
  "Rp1FacilityUpgradeRate": {
    buildSeconds: "s",
    costPerDay: "f/day",
    facility: "enum"
  },
  "Rp1FundTarget": {
    active: "flag",
    originalFunds: "funds",
    targetFunds: "funds",
    timeLeft: "s"
  },
  "Rp1FundingCurveEntry": {
    isDefault: "flag",
    name: "id"
  },
  "Rp1FundingCurveKey": {
    frac: "ratio",
    inTangent: "1",
    outTangent: "1",
    paidFraction: "ratio"
  },
  "Rp1HireTarget": {
    active: "flag",
    currentCount: "count",
    isResearch: "flag",
    lcId: "id",
    leftToHire: "count",
    targetCount: "count",
    timeLeft: "s"
  },
  "Rp1HireTargetSetArgs": {
    lcId: "id",
    reserveFunds: "funds",
    targetCount: "count"
  },
  "Rp1IntegrationTeamCostEntry": {
    engineers: "count",
    kscDisplayName: "text",
    kscName: "id",
    lcId: "id",
    name: "text",
    unassigned: "flag"
  },
  "Rp1LcPricing": {
    additionalPadCostMult: "ratio"
  },
  "Rp1LcResourcePrice": {
    name: "id",
    padCostPerUnit: "funds"
  },
  "Rp1LeaderAppointArgs": {
    factor: "ratio",
    strategyId: "id"
  },
  "Rp1LeaderEntry": {
    active: "flag",
    appointBlockedReason: "text",
    canAppoint: "flag",
    canRemoveFromUt: "ut",
    deactivateReputation: "rep",
    department: "text",
    dismissSubsidyLossPerDay: "f/day",
    freeToRemoveFromUt: "ut",
    reactivateCooldown: "s",
    rehireFromUt: "ut",
    removeOnDeactivate: "flag",
    setupConfidence: "confidence",
    setupFunds: "funds",
    setupReputation: "rep",
    setupScience: "science",
    strategyId: "id",
    title: "text"
  },
  "Rp1LedgerPeriodEntry": {
    confidenceAtClose: "confidence",
    constructionFees: "funds",
    endUt: "ut",
    engineersAtClose: "count",
    entryCosts: "funds",
    facilityMaintenance: "funds",
    fundsAtClose: "funds",
    hiringEngineers: "funds",
    hiringResearchers: "funds",
    launchFees: "funds",
    lcMaintenance: "funds",
    maintenanceFees: "funds",
    open: "flag",
    otherFees: "funds",
    otherFundsEarned: "funds",
    programFunds: "funds",
    repFromPrograms: "rep",
    reputationAtClose: "rep",
    researchersAtClose: "count",
    salaryCrew: "funds",
    salaryEngineers: "funds",
    salaryResearchers: "funds",
    scienceAtClose: "science",
    scienceEarnedAtClose: "science",
    spentUnlockCredit: "funds",
    startUt: "ut",
    subsidyPaidOut: "funds",
    subsidySize: "funds",
    toolingFees: "funds",
    trainingFees: "funds",
    unlockCreditAtClose: "funds",
    vesselPurchase: "funds",
    vesselRecovery: "funds"
  },
  "Rp1NextCompletion": {
    basis: "enum",
    kind: "enum",
    label: "text",
    ut: "ut"
  },
  "Rp1OperationEntry": {
    associatedVesselId: "id",
    blockingPeers: "count",
    cost: "funds",
    costRemaining: "funds",
    kscName: "id",
    launchPadId: "id",
    lcId: "id",
    progress: "bp",
    progressRatio: "ratio",
    rate: "bp/s",
    stalled: "flag",
    timeLeftSeconds: "s",
    totalPoints: "bp",
    type: "enum"
  },
  "Rp1PadDismantleArgs": {
    lcId: "id",
    padId: "id"
  },
  "Rp1PadEntry": {
    fractionalLevel: "ratio",
    hasVesselWaiting: "flag",
    isOperational: "flag",
    kscName: "id",
    launchSiteName: "id",
    lcId: "id",
    level: "count",
    name: "text",
    padId: "id",
    status: "enum",
    waitingVesselName: "text"
  },
  "Rp1PadNewArgs": {
    lcId: "id",
    name: "id"
  },
  "Rp1PadRenameArgs": {
    lcId: "id",
    name: "id",
    padId: "id"
  },
  "Rp1Personnel": {
    applicants: "count",
    engineerHireQuote: "funds",
    engineerSalaryPerDay: "f/day",
    engineerSalaryPerYear: "funds",
    hireCost: "funds",
    idleSalaryMult: "ratio",
    pooledEngineerSalaryPerDay: "f/day",
    researcherHireQuote: "funds",
    researcherSalaryPerDay: "f/day",
    researcherSalaryPerHeadPerDay: "f/day",
    researcherSalaryPerYear: "funds",
    researchers: "count",
    totalEngineers: "count"
  },
  "Rp1PersonnelAssignArgs": {
    engineers: "count",
    lcId: "id"
  },
  "Rp1PersonnelHeadcountArgs": {
    count: "count",
    kscName: "id",
    research: "flag"
  },
  "Rp1ProgramAcceptArgs": {
    speed: "enum",
    strategyId: "id"
  },
  "Rp1ProgramCompleteArgs": {
    strategyId: "id"
  },
  "Rp1ProgramEntry": {
    acceptedUt: "ut",
    canAccept: "flag",
    canComplete: "flag",
    completedUt: "ut",
    confidenceCost: "confidence",
    deadlineUt: "ut",
    durationSeconds: "s",
    fracElapsed: "ratio",
    fundingCurve: "text",
    fundsPaidOut: "funds",
    fundsRemaining: "funds",
    isHumanSpaceflight: "flag",
    lastPaymentUt: "ut",
    name: "id",
    nominalDurationSeconds: "s",
    objectivesCompletedUt: "ut",
    objectivesMet: "flag",
    objectivesText: "text",
    programsToDisableOnAccept: "id",
    repDeltaOnCompletePerYearEarly: "rep",
    repForComplete: "rep",
    repPenaltyAssessed: "rep",
    repPenaltyPerYearLate: "rep",
    requirementsMet: "flag",
    requirementsText: "text",
    slots: "count",
    speed: "enum",
    status: "enum",
    title: "text",
    totalFunding: "funds"
  },
  "Rp1ProgramFundingEntry": {
    deadlineUt: "ut",
    name: "id",
    title: "text"
  },
  "Rp1ProgramPaymentEntry": {
    cumulativeFunds: "funds",
    funds: "funds",
    year: "count"
  },
  "Rp1ProgramSlots": {
    activeCount: "count",
    completedCount: "count",
    freeSlots: "count",
    maxSlots: "count",
    usedSlots: "count"
  },
  "Rp1ProgramSpeedOption": {
    confidenceCost: "confidence",
    durationSeconds: "s",
    fundingPerDay: "f/day",
    label: "text",
    speed: "enum"
  },
  "Rp1RequiredTechEntry": {
    id: "id",
    parts: "text",
    title: "text"
  },
  "Rp1ResearchEntry": {
    endYear: "count",
    progress: "count",
    progressRatio: "ratio",
    rate: "count",
    scienceCost: "count",
    stalled: "flag",
    startYear: "count",
    techId: "id",
    techName: "text",
    timeLeftSeconds: "s",
    workRate: "ratio"
  },
  "Rp1ResearchRateArgs": {
    workRate: "ratio"
  },
  "Rp1ResearchRateStep": {
    finishesAt: "ut",
    researcherSalaryPerDay: "f/day",
    unlockCreditPerDay: "f/day",
    workRate: "ratio"
  },
  "Rp1ResearchRates": {
    refreshedAt: "ut",
    techId: "id"
  },
  "Rp1RolloutArgs": {
    id: "id",
    pad: "id"
  },
  "Rp1RolloutCostEntry": {
    associatedVesselId: "id",
    kscDisplayName: "text",
    kscName: "id",
    launchPadId: "id",
    lcId: "id",
    lcName: "text",
    type: "enum",
    vesselName: "text"
  },
  "Rp1RushTerms": {
    rateMult: "ratio",
    salaryMult: "ratio"
  },
  "Rp1Simulation": {
    active: "flag",
    kind: "enum"
  },
  "Rp1TechResearchArgs": {
    techId: "id"
  },
  "Rp1Tooling": {
    toolAllCost: "funds",
    untooledCount: "count"
  },
  "Rp1ToolingEntry": {
    parameterSummary: "text",
    partId: "id",
    partTitle: "text",
    refittable: "flag",
    symmetryCounterparts: "count",
    tooled: "flag",
    toolingCost: "funds",
    toolingType: "id",
    toolingTypeTitle: "text",
    untooledSurcharge: "funds"
  },
  "Rp1ToolingRefitArgs": {
    diameter: "m",
    length: "m",
    partId: "id",
    rfType: "id"
  },
  "Rp1ToolingRefitTarget": {
    diameter: "m",
    length: "m",
    rfType: "id"
  },
  "Rp1TrainingCourseEntry": {
    completed: "flag",
    completesAtUt: "ut",
    description: "text",
    id: "id",
    isTemporary: "flag",
    name: "text",
    queued: "flag",
    seatMax: "count",
    seatMin: "count",
    started: "flag",
    students: "id",
    studentsAvailableAtUt: "ut",
    target: "id",
    type: "enum"
  },
  "Rp1TrainingEnrolArgs": {
    crew: "id",
    templateId: "id"
  },
  "Rp1TrainingFeeEntry": {
    templateId: "id"
  },
  "Rp1TrainingLeaveArgs": {
    crewName: "id"
  },
  "Rp1TrainingTemplateEntry": {
    baseTime: "s",
    description: "text",
    id: "id",
    isTemporary: "flag",
    name: "text",
    seatMax: "count",
    seatMin: "count",
    target: "id",
    type: "enum",
    unlocked: "flag"
  },
  "Rp1VehicleArgs": {
    id: "id"
  },
  "Rp1WarehouseItemEntry": {
    cost: "funds",
    humanRated: "flag",
    id: "id",
    kscName: "id",
    launchSite: "id",
    lcId: "id",
    mass: "t",
    projectType: "enum",
    rolloutCost: "funds",
    rolloutRefusals: "text",
    shipId: "id",
    shipName: "text"
  }
};
var GENERATED_TOPIC_UNITS = {
  "rp1.avionics": {
    limitedByNonInterplanetary: "flag",
    lockLevel: "enum",
    supportedMassTons: "t",
    vesselMassTons: "t"
  },
  "rp1.budget": {
    refreshedAt: "ut",
    reputation: "rep",
    reputationDecayPerDay: "rep/day",
    reputationDecayPerYear: "rep",
    subsidyMaxPerDay: "f/day",
    subsidyMaxRep: "rep",
    subsidyMinPerDay: "f/day",
    subsidyPerDay: "f/day",
    unlockCreditBalance: "funds"
  },
  "rp1.budgetBreakdown": {
    refreshedAt: "ut"
  },
  "rp1.buildCost": {
    rolloutCost: "funds",
    toolingCost: "funds",
    unlockCost: "funds",
    untooledSurcharge: "funds",
    vehicleCost: "funds"
  },
  "rp1.buildQueue": {
    cost: "funds",
    humanRated: "flag",
    id: "id",
    kscName: "id",
    launchSite: "id",
    lcId: "id",
    mass: "t",
    progress: "bp",
    progressRatio: "ratio",
    projectType: "enum",
    rate: "bp/s",
    shipId: "id",
    shipName: "text",
    stalled: "flag",
    timeLeftSeconds: "s",
    totalPoints: "bp"
  },
  "rp1.buildable": {
    craftFile: "id",
    facility: "enum",
    lockedParts: "text",
    mass: "t",
    missingParts: "text",
    partCount: "count",
    shipName: "text",
    unpurchasedParts: "text"
  },
  "rp1.careerEvents": {
    enabled: "flag"
  },
  "rp1.careerLedger": {
    enabled: "flag"
  },
  "rp1.centres": {
    anyOperational: "flag",
    engineers: "count",
    groundStation: "id",
    idleSalaryPerDay: "f/day",
    isActive: "flag",
    kscDisplayName: "text",
    kscName: "id",
    launchComplexCount: "count",
    salaryPerDay: "f/day",
    unassignedEngineers: "count",
    upkeepPerDay: "f/day"
  },
  "rp1.complexes": {
    canIntegrate: "flag",
    efficiency: "ratio",
    efficiencyGroupKey: "id",
    efficiencySharedWith: "id",
    engineers: "count",
    humanRated: "flag",
    isOperational: "flag",
    isRushing: "flag",
    kscDisplayName: "text",
    kscName: "id",
    launchPadCount: "count",
    lcId: "id",
    lcType: "enum",
    massMax: "t",
    massMin: "t",
    massOrig: "t",
    maxEngineers: "count",
    name: "text",
    newPadCost: "funds",
    rate: "bp/s",
    resourcesHandled: "id",
    rushSalaryDeltaPerDay: "f/day",
    salaryPerDay: "f/day",
    sizeMaxDepth: "m",
    sizeMaxHeight: "m",
    sizeMaxWidth: "m",
    upkeepPerDay: "f/day"
  },
  "rp1.confidence": {
    confidence: "confidence",
    earned: "confidence"
  },
  "rp1.constructionRates": {
    refreshedAt: "ut"
  },
  "rp1.constructions": {
    affordableFraction: "ratio",
    cost: "funds",
    currentLevel: "count",
    engineersToReadd: "count",
    facilityType: "enum",
    id: "id",
    isModify: "flag",
    kind: "enum",
    kscName: "id",
    lcId: "id",
    name: "text",
    padId: "id",
    progress: "bp",
    progressRatio: "ratio",
    rate: "bp/s",
    spentCost: "funds",
    spentRushCost: "funds",
    stalled: "flag",
    targetLevel: "count",
    timeLeftSeconds: "s",
    totalPoints: "bp",
    workRate: "ratio"
  },
  "rp1.crew": {
    latestRetiresAtUt: "ut",
    name: "id",
    nextTrainingExpiryTarget: "text",
    nextTrainingExpiryUt: "ut",
    retired: "flag",
    retirementExtensionUsedSeconds: "s",
    retiresAtUt: "ut",
    trainingCourse: "text",
    trainingExpiryCount: "count",
    trainingFinishesAtUt: "ut",
    trainingFractionComplete: "ratio",
    trainingStarted: "flag",
    trainingTarget: "text",
    trainingType: "text"
  },
  "rp1.crewProgram": {
    courses: "count",
    coursesStarted: "count",
    crewInTraining: "count",
    crewRnREnabled: "flag",
    missionTrainingRate: "1",
    proficiencyTrainingRate: "1",
    retirementExtensionCapSeconds: "s"
  },
  "rp1.facilities": {
    currentTier: "count",
    facility: "enum",
    maxTier: "count",
    upgradeCost: "funds",
    upgradedByRp1: "flag"
  },
  "rp1.fundTarget": {
    active: "flag",
    originalFunds: "funds",
    targetFunds: "funds",
    timeLeft: "s"
  },
  "rp1.lcPricing": {
    additionalPadCostMult: "ratio"
  },
  "rp1.leaders": {
    active: "flag",
    appointBlockedReason: "text",
    canAppoint: "flag",
    canRemoveFromUt: "ut",
    deactivateReputation: "rep",
    department: "text",
    dismissSubsidyLossPerDay: "f/day",
    freeToRemoveFromUt: "ut",
    reactivateCooldown: "s",
    rehireFromUt: "ut",
    removeOnDeactivate: "flag",
    setupConfidence: "confidence",
    setupFunds: "funds",
    setupReputation: "rep",
    setupScience: "science",
    strategyId: "id",
    title: "text"
  },
  "rp1.nextCompletion": {
    basis: "enum",
    kind: "enum",
    label: "text",
    ut: "ut"
  },
  "rp1.operations": {
    associatedVesselId: "id",
    blockingPeers: "count",
    cost: "funds",
    costRemaining: "funds",
    kscName: "id",
    launchPadId: "id",
    lcId: "id",
    progress: "bp",
    progressRatio: "ratio",
    rate: "bp/s",
    stalled: "flag",
    timeLeftSeconds: "s",
    totalPoints: "bp",
    type: "enum"
  },
  "rp1.pads": {
    fractionalLevel: "ratio",
    hasVesselWaiting: "flag",
    isOperational: "flag",
    kscName: "id",
    launchSiteName: "id",
    lcId: "id",
    level: "count",
    name: "text",
    padId: "id",
    status: "enum",
    waitingVesselName: "text"
  },
  "rp1.personnel": {
    applicants: "count",
    engineerHireQuote: "funds",
    engineerSalaryPerDay: "f/day",
    engineerSalaryPerYear: "funds",
    hireCost: "funds",
    idleSalaryMult: "ratio",
    pooledEngineerSalaryPerDay: "f/day",
    researcherHireQuote: "funds",
    researcherSalaryPerDay: "f/day",
    researcherSalaryPerHeadPerDay: "f/day",
    researcherSalaryPerYear: "funds",
    researchers: "count",
    totalEngineers: "count"
  },
  "rp1.programFundingCurves": {
    isDefault: "flag",
    name: "id"
  },
  "rp1.programSlots": {
    activeCount: "count",
    completedCount: "count",
    freeSlots: "count",
    maxSlots: "count",
    usedSlots: "count"
  },
  "rp1.programs": {
    acceptedUt: "ut",
    canAccept: "flag",
    canComplete: "flag",
    completedUt: "ut",
    confidenceCost: "confidence",
    deadlineUt: "ut",
    durationSeconds: "s",
    fracElapsed: "ratio",
    fundingCurve: "text",
    fundsPaidOut: "funds",
    fundsRemaining: "funds",
    isHumanSpaceflight: "flag",
    lastPaymentUt: "ut",
    name: "id",
    nominalDurationSeconds: "s",
    objectivesCompletedUt: "ut",
    objectivesMet: "flag",
    objectivesText: "text",
    programsToDisableOnAccept: "id",
    repDeltaOnCompletePerYearEarly: "rep",
    repForComplete: "rep",
    repPenaltyAssessed: "rep",
    repPenaltyPerYearLate: "rep",
    requirementsMet: "flag",
    requirementsText: "text",
    slots: "count",
    speed: "enum",
    status: "enum",
    title: "text",
    totalFunding: "funds"
  },
  "rp1.research": {
    endYear: "count",
    progress: "count",
    progressRatio: "ratio",
    rate: "count",
    scienceCost: "count",
    stalled: "flag",
    startYear: "count",
    techId: "id",
    techName: "text",
    timeLeftSeconds: "s",
    workRate: "ratio"
  },
  "rp1.researchRates": {
    refreshedAt: "ut",
    techId: "id"
  },
  "rp1.rushTerms": {
    rateMult: "ratio",
    salaryMult: "ratio"
  },
  "rp1.simulation": {
    active: "flag",
    kind: "enum"
  },
  "rp1.tooling": {
    toolAllCost: "funds",
    untooledCount: "count"
  },
  "rp1.training": {
    completed: "flag",
    completesAtUt: "ut",
    description: "text",
    id: "id",
    isTemporary: "flag",
    name: "text",
    queued: "flag",
    seatMax: "count",
    seatMin: "count",
    started: "flag",
    students: "id",
    studentsAvailableAtUt: "ut",
    target: "id",
    type: "enum"
  },
  "rp1.trainingCatalogue": {
    baseTime: "s",
    description: "text",
    id: "id",
    isTemporary: "flag",
    name: "text",
    seatMax: "count",
    seatMin: "count",
    target: "id",
    type: "enum",
    unlocked: "flag"
  },
  "rp1.warehouse": {
    cost: "funds",
    humanRated: "flag",
    id: "id",
    kscName: "id",
    launchSite: "id",
    lcId: "id",
    mass: "t",
    projectType: "enum",
    rolloutCost: "funds",
    rolloutRefusals: "text",
    shipId: "id",
    shipName: "text"
  }
};
var GENERATED_TYPE_SHAPES = {
  "Rp1Budget": {
    day: "Rp1BudgetPeriod",
    forecast: "Rp1BudgetForecastSample[]",
    month: "Rp1BudgetPeriod",
    year: "Rp1BudgetPeriod"
  },
  "Rp1BudgetBreakdown": {
    astronautBase: "Rp1BudgetHorizons",
    astronautOperational: "Rp1BudgetHorizons",
    astronautTraining: "Rp1BudgetHorizons",
    buildings: "Rp1BuildingUpkeepEntry[]",
    complexes: "Rp1ComplexUpkeepEntry[]",
    constructions: "Rp1ConstructionCostEntry[]",
    courses: "Rp1CourseCostEntry[]",
    crew: "Rp1CrewCostEntry[]",
    integrationTeams: "Rp1IntegrationTeamCostEntry[]",
    nautBaseSalary: "Rp1BudgetHorizons",
    programs: "Rp1ProgramFundingEntry[]",
    rollouts: "Rp1RolloutCostEntry[]",
    trainingFees: "Rp1TrainingFeeEntry[]"
  },
  "Rp1BuildCost": {
    requiredTechs: "Rp1RequiredTechEntry[]"
  },
  "Rp1BuildableCraftEntry": {
    complexes: "Rp1BuildableComplex[]"
  },
  "Rp1BuildingUpkeepEntry": {
    upkeep: "Rp1BudgetHorizons"
  },
  "Rp1CareerEvents": {
    events: "Rp1CareerEventEntry[]"
  },
  "Rp1CareerLedger": {
    periods: "Rp1LedgerPeriodEntry[]"
  },
  "Rp1ComplexModifyArgs": {
    size: "Rp1ComplexSizeArgs"
  },
  "Rp1ComplexNewArgs": {
    size: "Rp1ComplexSizeArgs"
  },
  "Rp1ComplexUpkeepEntry": {
    upkeep: "Rp1BudgetHorizons"
  },
  "Rp1ConstructionCostEntry": {
    cost: "Rp1BudgetHorizons"
  },
  "Rp1ConstructionRateTable": {
    steps: "Rp1ConstructionRateStep[]"
  },
  "Rp1ConstructionRates": {
    constructions: "Rp1ConstructionRateTable[]",
    facilityUpgrades: "Rp1FacilityUpgradeRate[]"
  },
  "Rp1CourseCostEntry": {
    cost: "Rp1BudgetHorizons"
  },
  "Rp1CrewCostEntry": {
    cost: "Rp1BudgetHorizons"
  },
  "Rp1FundingCurveEntry": {
    keys: "Rp1FundingCurveKey[]"
  },
  "Rp1IntegrationTeamCostEntry": {
    cost: "Rp1BudgetHorizons"
  },
  "Rp1LcPricing": {
    resources: "Rp1LcResourcePrice[]"
  },
  "Rp1Personnel": {
    hireTarget: "Rp1HireTarget"
  },
  "Rp1ProgramEntry": {
    fundingPayments: "Rp1ProgramPaymentEntry[]",
    speedOptions: "Rp1ProgramSpeedOption[]"
  },
  "Rp1ProgramFundingEntry": {
    funding: "Rp1BudgetHorizons"
  },
  "Rp1ResearchRates": {
    steps: "Rp1ResearchRateStep[]"
  },
  "Rp1RolloutCostEntry": {
    cost: "Rp1BudgetHorizons"
  },
  "Rp1Tooling": {
    parts: "Rp1ToolingEntry[]"
  },
  "Rp1ToolingEntry": {
    refitTargets: "Rp1ToolingRefitTarget[]"
  },
  "Rp1TrainingFeeEntry": {
    perStudent: "Rp1BudgetHorizons"
  }
};
var GENERATED_TOPIC_SHAPES = {
  "rp1.budget": {
    day: "Rp1BudgetPeriod",
    forecast: "Rp1BudgetForecastSample[]",
    month: "Rp1BudgetPeriod",
    year: "Rp1BudgetPeriod"
  },
  "rp1.budgetBreakdown": {
    astronautBase: "Rp1BudgetHorizons",
    astronautOperational: "Rp1BudgetHorizons",
    astronautTraining: "Rp1BudgetHorizons",
    buildings: "Rp1BuildingUpkeepEntry[]",
    complexes: "Rp1ComplexUpkeepEntry[]",
    constructions: "Rp1ConstructionCostEntry[]",
    courses: "Rp1CourseCostEntry[]",
    crew: "Rp1CrewCostEntry[]",
    integrationTeams: "Rp1IntegrationTeamCostEntry[]",
    nautBaseSalary: "Rp1BudgetHorizons",
    programs: "Rp1ProgramFundingEntry[]",
    rollouts: "Rp1RolloutCostEntry[]",
    trainingFees: "Rp1TrainingFeeEntry[]"
  },
  "rp1.buildCost": {
    requiredTechs: "Rp1RequiredTechEntry[]"
  },
  "rp1.buildable": {
    complexes: "Rp1BuildableComplex[]"
  },
  "rp1.careerEvents": {
    events: "Rp1CareerEventEntry[]"
  },
  "rp1.careerLedger": {
    periods: "Rp1LedgerPeriodEntry[]"
  },
  "rp1.constructionRates": {
    constructions: "Rp1ConstructionRateTable[]",
    facilityUpgrades: "Rp1FacilityUpgradeRate[]"
  },
  "rp1.lcPricing": {
    resources: "Rp1LcResourcePrice[]"
  },
  "rp1.personnel": {
    hireTarget: "Rp1HireTarget"
  },
  "rp1.programFundingCurves": {
    keys: "Rp1FundingCurveKey[]"
  },
  "rp1.programs": {
    fundingPayments: "Rp1ProgramPaymentEntry[]",
    speedOptions: "Rp1ProgramSpeedOption[]"
  },
  "rp1.researchRates": {
    steps: "Rp1ResearchRateStep[]"
  },
  "rp1.tooling": {
    parts: "Rp1ToolingEntry[]"
  }
};
var GENERATED_TYPE_ENUMS = {
  "Rp1Avionics": {
    lockLevel: null
  },
  "Rp1BuildItemEntry": {
    projectType: null
  },
  "Rp1BuildQuoteArgs": {
    facility: "KspEditorFacility"
  },
  "Rp1BuildStartArgs": {
    facility: "KspEditorFacility"
  },
  "Rp1BuildableCraftEntry": {
    facility: "KspEditorFacility"
  },
  "Rp1BuildingUpkeepEntry": {
    facility: null
  },
  "Rp1CareerEventEntry": {
    builtAt: null,
    detail: null,
    kind: null
  },
  "Rp1ComplexEntry": {
    lcType: null
  },
  "Rp1ConstructionCostEntry": {
    kind: null
  },
  "Rp1ConstructionEntry": {
    facilityType: null,
    kind: null
  },
  "Rp1FacilityEntry": {
    facility: null
  },
  "Rp1FacilityUpgradeRate": {
    facility: null
  },
  "Rp1NextCompletion": {
    basis: null,
    kind: null
  },
  "Rp1OperationEntry": {
    type: null
  },
  "Rp1PadEntry": {
    status: null
  },
  "Rp1ProgramAcceptArgs": {
    speed: null
  },
  "Rp1ProgramEntry": {
    speed: null,
    status: null
  },
  "Rp1ProgramSpeedOption": {
    speed: null
  },
  "Rp1RolloutCostEntry": {
    type: null
  },
  "Rp1Simulation": {
    kind: null
  },
  "Rp1TrainingCourseEntry": {
    type: null
  },
  "Rp1TrainingTemplateEntry": {
    type: null
  },
  "Rp1WarehouseItemEntry": {
    projectType: null
  }
};
var GENERATED_TOPIC_ENUMS = {
  "rp1.avionics": {
    lockLevel: null
  },
  "rp1.buildQueue": {
    projectType: null
  },
  "rp1.buildable": {
    facility: "KspEditorFacility"
  },
  "rp1.complexes": {
    lcType: null
  },
  "rp1.constructions": {
    facilityType: null,
    kind: null
  },
  "rp1.facilities": {
    facility: null
  },
  "rp1.nextCompletion": {
    basis: null,
    kind: null
  },
  "rp1.operations": {
    type: null
  },
  "rp1.pads": {
    status: null
  },
  "rp1.programs": {
    speed: null,
    status: null
  },
  "rp1.simulation": {
    kind: null
  },
  "rp1.training": {
    type: null
  },
  "rp1.trainingCatalogue": {
    type: null
  },
  "rp1.warehouse": {
    projectType: null
  }
};
var GENERATED_TYPE_STATICS = {};
var GENERATED_TOPIC_STATICS = {};
var GENERATED_ENUM_MEMBERS = {
  "KspEditorFacility": {
    0: "None",
    1: "VAB",
    2: "SPH"
  }
};
var GENERATED_CONTRACT_TAGS = {
  topics: {
    "rp1.avionics": {
      "vesselMassTons": { kind: "continuous" }
    },
    "rp1.budget": {
      "reputation": { kind: "continuous" }
    },
    "rp1.crew": {
      "*.trainingFractionComplete": { kind: "continuous" }
    },
    "rp1.fundTarget": {
      "timeLeft": { kind: "continuous" }
    }
  },
  reckonable: []
};

// src/uplink.ts
var UPLINK_VERSION = "1.0.0-rc.3";
var RP1 = defineUplinkClient({
  id: "rp1",
  version: UPLINK_VERSION,
  name: "RP-1",
  description: "Brings RP-1's career layer to the dashboard: Programs with their objectives, deadlines, funding curves and the Confidence price at each speed.",
  tags: GENERATED_CONTRACT_TAGS
});
registerErrorCodes(RP1_ERROR_CODES);

// src/units.ts
import { registerUnit } from "@ksp-gonogo/sitrep-sdk";
var RP1_UNIT_SYMBOLS = ["bp", "bp/s", "confidence"];
registerUnit({
  symbol: "bp",
  kind: "buildPoints",
  dimension: { bp: 1 },
  ratio: 1,
  decimals: 0,
  display: ""
});
registerUnit({
  symbol: "bp/s",
  kind: "buildRate",
  dimension: { bp: 1, s: -1 },
  ratio: 1,
  decimals: 0,
  display: ""
});
registerUnit({
  symbol: "confidence",
  kind: "confidence",
  dimension: { confidence: 1 },
  ratio: 1,
  decimals: 0,
  display: ""
});

// src/topics.ts
import {
  registerUplinkTopic,
  registerDynamicTopicPrefix,
  registerEnumMembers,
  registerTopicUnits,
  registerTypeUnits
} from "@ksp-gonogo/sitrep-sdk";
var RP1_AVAILABLE_TOPIC = "rp1.available";
var RP1_CENTRES_TOPIC = "rp1.centres";
var RP1_COMPLEXES_TOPIC = "rp1.complexes";
var RP1_BUILD_QUEUE_TOPIC = "rp1.buildQueue";
var RP1_WAREHOUSE_TOPIC = "rp1.warehouse";
var RP1_BUILDABLE_TOPIC = "rp1.buildable";
var RP1_PADS_TOPIC = "rp1.pads";
var RP1_OPERATIONS_TOPIC = "rp1.operations";
var RP1_CONSTRUCTIONS_TOPIC = "rp1.constructions";
var RP1_FACILITIES_TOPIC = "rp1.facilities";
var RP1_RESEARCH_TOPIC = "rp1.research";
var RP1_PERSONNEL_TOPIC = "rp1.personnel";
var RP1_RUSH_TERMS_TOPIC = "rp1.rushTerms";
var RP1_LC_PRICING_TOPIC = "rp1.lcPricing";
var RP1_CONFIDENCE_TOPIC = "rp1.confidence";
var RP1_PROGRAMS_TOPIC = "rp1.programs";
var RP1_PROGRAM_SLOTS_TOPIC = "rp1.programSlots";
var RP1_PROGRAM_FUNDING_CURVES_TOPIC = "rp1.programFundingCurves";
var RP1_CREW_TOPIC = "rp1.crew";
var RP1_CREW_PROGRAM_TOPIC = "rp1.crewProgram";
var RP1_FUND_TARGET_TOPIC = "rp1.fundTarget";
var RP1_TRAINING_TOPIC = "rp1.training";
var RP1_TRAINING_CATALOGUE_TOPIC = "rp1.trainingCatalogue";
var RP1_TOOLING_TOPIC = "rp1.tooling";
var RP1_BUILD_COST_TOPIC = "rp1.buildCost";
var RP1_CAREER_EVENTS_TOPIC = "rp1.careerEvents";
var RP1_AVIONICS_TOPIC = "rp1.avionics";
var RP1_SIMULATION_TOPIC = "rp1.simulation";
var RP1_BUDGET_TOPIC = "rp1.budget";
var RP1_BUDGET_BREAKDOWN_TOPIC = "rp1.budgetBreakdown";
var RP1_FUNDS_REACHED_AT_PREFIX = "rp1.fundsReachedAt.";
function fundsReachedAtTopic(funds) {
  return `${RP1_FUNDS_REACHED_AT_PREFIX}${Math.round(funds)}`;
}
var RP1_CONSTRUCTION_RATES_TOPIC = "rp1.constructionRates";
var RP1_RESEARCH_RATES_TOPIC = "rp1.researchRates";
var RP1_LEADERS_TOPIC = "rp1.leaders";
var RP1_CAREER_LEDGER_TOPIC = "rp1.careerLedger";
registerUplinkTopic(RP1_AVAILABLE_TOPIC);
registerUplinkTopic(RP1_CENTRES_TOPIC);
registerUplinkTopic(RP1_COMPLEXES_TOPIC);
registerUplinkTopic(RP1_BUILD_QUEUE_TOPIC);
registerUplinkTopic(RP1_WAREHOUSE_TOPIC);
registerUplinkTopic(RP1_BUILDABLE_TOPIC);
registerUplinkTopic(RP1_PADS_TOPIC);
registerUplinkTopic(RP1_OPERATIONS_TOPIC);
registerUplinkTopic(RP1_CONSTRUCTIONS_TOPIC);
registerUplinkTopic(RP1_FACILITIES_TOPIC);
registerUplinkTopic(RP1_RESEARCH_TOPIC);
registerUplinkTopic(RP1_PERSONNEL_TOPIC);
registerUplinkTopic(RP1_RUSH_TERMS_TOPIC);
registerUplinkTopic(RP1_LC_PRICING_TOPIC);
registerUplinkTopic(RP1_CONFIDENCE_TOPIC);
registerUplinkTopic(RP1_PROGRAMS_TOPIC);
registerUplinkTopic(RP1_PROGRAM_SLOTS_TOPIC);
registerUplinkTopic(RP1_PROGRAM_FUNDING_CURVES_TOPIC);
registerUplinkTopic(RP1_CREW_TOPIC);
registerUplinkTopic(RP1_CREW_PROGRAM_TOPIC);
registerUplinkTopic(RP1_FUND_TARGET_TOPIC);
registerUplinkTopic(RP1_TRAINING_TOPIC);
registerUplinkTopic(RP1_TRAINING_CATALOGUE_TOPIC);
registerUplinkTopic(RP1_TOOLING_TOPIC);
registerUplinkTopic(RP1_BUILD_COST_TOPIC);
registerUplinkTopic(RP1_CAREER_EVENTS_TOPIC);
registerUplinkTopic(RP1_AVIONICS_TOPIC);
registerUplinkTopic(RP1_SIMULATION_TOPIC);
registerUplinkTopic(RP1_BUDGET_TOPIC);
registerUplinkTopic(RP1_BUDGET_BREAKDOWN_TOPIC);
registerUplinkTopic(RP1_CONSTRUCTION_RATES_TOPIC);
registerUplinkTopic(RP1_RESEARCH_RATES_TOPIC);
registerUplinkTopic(RP1_LEADERS_TOPIC);
registerUplinkTopic(RP1_CAREER_LEDGER_TOPIC);
registerDynamicTopicPrefix(RP1_FUNDS_REACHED_AT_PREFIX);
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

// src/lastValue.ts
function lastValue(reading) {
  return reading.state === "observed" || reading.state === "held" ? reading.value : void 0;
}

// src/Avionics/badge.ts
function avionicsBadges(avionics, held) {
  const level = avionics?.lockLevel;
  if (level !== "Locked" && level !== "Axial") return null;
  return [
    {
      id: "rp1-avionics-lock",
      label: level === "Locked" ? "No control" : "Roll only",
      tone: level === "Locked" ? "nogo" : "warn",
      ...held === void 0 ? {} : { held }
    }
  ];
}
RP1.registerContribution({
  id: "rp1-avionics-badge",
  contributes: "navball.badges",
  requires: "rp1",
  deps: ["rp1.avionics"],
  compute: (topics) => avionicsBadges(lastValue(topics["rp1.avionics"]), topics["rp1.avionics"])
});

// src/AdminBuilding/financesScreen.ts
var FINANCES_SCREEN_ID = "finances";
var FINANCES_SCREEN = Object.freeze([
  Object.freeze({
    id: FINANCES_SCREEN_ID,
    label: "Finances",
    /* After Programs and the leader departments RP-1 declares. */
    order: 90
  })
]);

// src/AdminBuilding/leadersScreen.ts
var LEADERS_SCREEN_ID = "leaders";
var LEADERS_SCREEN = Object.freeze([
  Object.freeze({
    id: LEADERS_SCREEN_ID,
    label: "Leaders",
    /* After Programs, as RP-1's own building tabs them. */
    order: 20,
    departments: Object.freeze([
      "Administration",
      "Engineering",
      "FlightDirector",
      "Science",
      "MainContractor",
      "Contractor1",
      "Contractor2"
    ]),
    drawsOwnActions: true
  })
]);

// src/AdminBuilding/programsScreen.ts
var PROGRAMS_SCREEN_ID = "programs";
var PROGRAMS_SCREEN = Object.freeze([
  Object.freeze({
    id: PROGRAMS_SCREEN_ID,
    /*
     * "Programs", not the department's own `title` of "Select Programs". The
     * title is the instruction printed over KSP's own department panel; a tab is
     * a place, and a place is a noun.
     */
    label: "Programs",
    /* First, as it is in Departments.cfg, and as the building opens on it. */
    order: 10,
    departments: ["Programs"],
    /*
     * The body carries Accept and Complete, so the host draws these cards with
     * no Activate or Deactivate of its own: core's deactivate on a Program only
     * unregisters it, and the Uplink refuses it for that reason.
     */
    drawsOwnActions: true
  })
]);
var RP1_ADMIN_SCREENS = Object.freeze([
  ...PROGRAMS_SCREEN,
  ...LEADERS_SCREEN,
  ...FINANCES_SCREEN
]);
RP1.registerContribution({
  id: "programs-screen",
  contributes: "administration-building.screens",
  /*
   * The domain gate rather than a dep on the topic: the aggregation subscribes
   * `rp1.available` itself for anything naming `requires`, so the screen appears
   * and disappears with RP-1 while the contribution stays a constant. Returning
   * the same frozen array every call is what keeps it off the slot's recompute
   * budget: the aggregation compares entries by reference.
   */
  requires: "rp1",
  compute: () => RP1_ADMIN_SCREENS
});

// src/CrewSchedule/index.tsx
import { registerAugment, useTelemetry } from "@ksp-gonogo/sitrep-sdk";
import { DataLine, MissionDate, magnitudeOf as magnitudeOf2, Stack } from "@ksp-gonogo/ui-kit";

// src/shared/current.ts
function current(reading) {
  if (reading.reckoning.status === "available") return reading.reckoning.value;
  if (reading.state === "observed") return reading.value;
  return void 0;
}
function latest(reading) {
  const now = current(reading);
  if (now !== void 0) return now;
  return reading.state === "held" ? reading.value : void 0;
}

// src/CrewSchedule/retirementSetting.ts
import { useModSettings } from "@ksp-gonogo/sitrep-sdk";
function useRp1Switch(key) {
  const model = current(useModSettings("rp1"));
  const row = model?.settings.find((s) => s.id === key);
  if (row?.value === "False") {
    return false;
  }
  return row?.value === "True" ? true : void 0;
}
function useRetirementEnabled() {
  return useRp1Switch("retirementEnabled");
}
function useMissionTrainingEnabled() {
  return useRp1Switch("missionTrainingEnabled");
}

// src/CrewSchedule/template.tsx
import { magnitudeOf, Unit } from "@ksp-gonogo/ui-kit";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
function kindOf(type) {
  if (type === "Mission") return "Mission training";
  if (type === "Proficiency") return "Proficiency";
  return type ?? null;
}
function titleOf(training) {
  const kind = kindOf(training.type);
  if (kind !== null && training.target) {
    return `${kind}: ${training.target}`;
  }
  return training.name ?? training.target ?? training.id ?? "";
}
function lapseRule(template) {
  if (template.type === "Mission") return "Lapses after completion";
  if (template.type === "Proficiency") return "Permanent once complete";
  return null;
}
function Seats({
  template
}) {
  const min = magnitudeOf(template.seatMin);
  if (min === null) {
    return null;
  }
  const max = magnitudeOf(template.seatMax);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    " \xB7 seats ",
    /* @__PURE__ */ jsx(Unit, { value: template.seatMin }),
    max !== null && max <= 0 && ", no maximum",
    max !== null && max > min && /* @__PURE__ */ jsxs(Fragment, { children: [
      " to ",
      /* @__PURE__ */ jsx(Unit, { value: template.seatMax })
    ] })
  ] });
}

// src/CrewSchedule/index.tsx
import { Fragment as Fragment2, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function CrewSchedule({
  kerbalName
}) {
  const available = current(useTelemetry("rp1.available"));
  const crew = current(useTelemetry("rp1.crew"));
  const missionTrainingEnabled = useMissionTrainingEnabled();
  const retirementEnabled = useRetirementEnabled();
  if (available !== true) {
    return null;
  }
  const name = typeof kerbalName === "string" ? kerbalName : "";
  if (name === "") {
    return null;
  }
  const row = (crew ?? []).find((c) => c.name === name);
  if (!row) {
    return null;
  }
  if (row.retired === true) {
    return retiredLine(row);
  }
  const retirement = retirementLine(row, retirementEnabled);
  const training = trainingLine(row);
  const expiry = expiryLine(row, missionTrainingEnabled);
  if (!retirement && !training && !expiry) {
    return null;
  }
  return /* @__PURE__ */ jsxs2(Stack, { gap: "caption", children: [
    retirement,
    training,
    expiry
  ] });
}
function retirementLine(row, retirementEnabled) {
  if (retirementEnabled === false) {
    return null;
  }
  const retires = magnitudeOf2(row.retiresAtUt);
  if (retires === null) {
    return null;
  }
  const latest2 = magnitudeOf2(row.latestRetiresAtUt);
  const extendable = latest2 !== null && latest2 > retires;
  return /* @__PURE__ */ jsxs2(DataLine, { aligned: true, label: "Retires", children: [
    /* @__PURE__ */ jsx2(MissionDate, { value: row.retiresAtUt }),
    extendable && /* @__PURE__ */ jsxs2(Fragment2, { children: [
      " \xB7 flights and training push this to ",
      /* @__PURE__ */ jsx2(MissionDate, { value: row.latestRetiresAtUt })
    ] })
  ] }, "retirement");
}
function retiredLine(row) {
  if (magnitudeOf2(row.retiresAtUt) === null) {
    return null;
  }
  return /* @__PURE__ */ jsx2(DataLine, { aligned: true, label: "Retired", children: /* @__PURE__ */ jsx2(MissionDate, { value: row.retiresAtUt }) }, "retired");
}
function trainingLine(row) {
  const target = row.trainingTarget ?? row.trainingCourse;
  if (!target) {
    return null;
  }
  const kind = kindOf(row.trainingType);
  return /* @__PURE__ */ jsxs2(DataLine, { aligned: true, label: "Course", children: [
    kind === null ? "" : `${kind}: `,
    target
  ] }, "training");
}
function expiryLine(row, missionTrainingEnabled) {
  if (missionTrainingEnabled === false) {
    return null;
  }
  const at = magnitudeOf2(row.nextTrainingExpiryUt);
  if (at === null) {
    return null;
  }
  const count2 = magnitudeOf2(row.trainingExpiryCount) ?? 0;
  return (
    /* `tone="warn"`, and only on this line. It is the one reading here an
       operator acts on: a retirement date is years out and a course finishes on
       its own, while mission training lapsing turns a qualified crew into an
       unqualified one while the vehicle is still being integrated. A column
       where every line is coloured is a column with no emphasis left to spend. */
    /* @__PURE__ */ jsxs2(DataLine, { aligned: true, label: "Lapses", tone: "warn", children: [
      "Mission training",
      row.nextTrainingExpiryTarget ? ` for ${row.nextTrainingExpiryTarget}` : "",
      " \xB7 ",
      /* @__PURE__ */ jsx2(MissionDate, { value: row.nextTrainingExpiryUt }),
      count2 > 1 && ` (+${count2 - 1} more)`
    ] }, "expiry")
  );
}
registerAugment({
  id: "rp1-crew-schedule",
  augments: "astronaut-complex.crew",
  component: CrewSchedule,
  owner: RP1
});

// src/CrewSchedule/badge.tsx
import { registerAugment as registerAugment2, useTelemetry as useTelemetry2 } from "@ksp-gonogo/sitrep-sdk";
import { Badge } from "@ksp-gonogo/ui-kit";
import { jsx as jsx3 } from "react/jsx-runtime";
function CrewTrainingBadge({
  kerbalName
}) {
  const available = current(useTelemetry2("rp1.available"));
  const crew = current(useTelemetry2("rp1.crew"));
  if (available !== true) {
    return null;
  }
  const name = typeof kerbalName === "string" ? kerbalName : "";
  if (name === "") {
    return null;
  }
  const row = (crew ?? []).find((c) => c.name === name);
  if (row?.retired === true) {
    return /* @__PURE__ */ jsx3(Badge, { tone: "neutral", size: "sm", title: "Retired", children: "RETIRED" });
  }
  const target = row?.trainingTarget ?? row?.trainingCourse;
  if (!row || !target) {
    return null;
  }
  const started = row.trainingStarted === true;
  const kind = kindOf(row.trainingType);
  return /* @__PURE__ */ jsx3(
    Badge,
    {
      tone: started ? "go" : "caution",
      size: "sm",
      title: kind === null ? target : `${kind}: ${target}`,
      children: started ? "TRAINING" : "ENROLLED"
    }
  );
}
registerAugment2({
  id: "rp1-crew-training-badge",
  augments: "astronaut-complex.crew-badge",
  channels: ["rp1.available", "rp1.crew"],
  component: CrewTrainingBadge,
  owner: RP1
});

// src/CrewSchedule/coreStats.ts
import { modSettingDep, value } from "@ksp-gonogo/sitrep-sdk";
import { heldFigureOf, magnitudeOf as magnitudeOf3 } from "@ksp-gonogo/ui-kit";
function coursesDetail(program) {
  const courses = magnitudeOf3(program?.courses);
  if (courses === null || courses === 0) return void 0;
  const noun = courses === 1 ? "course" : "courses";
  const started = magnitudeOf3(program?.coursesStarted);
  if (started === null || started >= courses) return `${courses} ${noun}`;
  return `${courses} ${noun} \xB7 ${courses - started} not started`;
}
function lapsingCrew(crew) {
  return crew.filter((c) => magnitudeOf3(c.nextTrainingExpiryUt) !== null).length;
}
function nautSalaryStat(breakdown, held) {
  const perDay = magnitudeOf3(breakdown?.nautBaseSalary?.day);
  if (perDay === null) return null;
  return {
    id: "naut-salary",
    label: "Salary per Naut",
    value: heldFigureOf(value("f/day", -perDay), held),
    detail: "added by each hire"
  };
}
function crewCoreStats(program, crew, held = {}, missionTrainingEnabled) {
  const stats = [];
  const inTraining = magnitudeOf3(program?.crewInTraining);
  if (inTraining !== null) {
    stats.push({
      id: "in-training",
      label: "In Training",
      value: heldFigureOf(value("count", inTraining), held.program),
      detail: coursesDetail(program)
    });
  }
  if (crew !== void 0 && missionTrainingEnabled !== false) {
    const lapsing = lapsingCrew(crew);
    stats.push({
      id: "training-lapsing",
      label: "Training Lapsing",
      value: heldFigureOf(value("count", lapsing), held.crew),
      // Toned only when there is something to act on. A permanent amber zero
      // is an alarm about nothing, and it spends the emphasis the strip needs
      // for the case where the figure is real.
      tone: lapsing > 0 ? "warn" : "neutral"
    });
  }
  return stats;
}
RP1.registerContribution({
  id: "crew-core-stats",
  contributes: "astronaut-complex.readouts",
  deps: [
    "rp1.crew",
    "rp1.crewProgram",
    "rp1.budgetBreakdown",
    modSettingDep("rp1", "missionTrainingEnabled")
  ],
  /*
   * The domain gate rather than a dep on `rp1.available`: the aggregation
   * subscribes it itself for anything naming `requires`, so the cells appear and
   * disappear with RP-1 while this stays a plain function of the three channels.
   */
  requires: "rp1",
  compute: (topics) => {
    const program = topics["rp1.crewProgram"];
    const crew = topics["rp1.crew"];
    const breakdown = topics["rp1.budgetBreakdown"];
    const salary = nautSalaryStat(lastValue(breakdown), breakdown);
    const stats = crewCoreStats(
      lastValue(program),
      lastValue(crew),
      { program, crew },
      topics["settings.rp1.missionTrainingEnabled"]
    );
    return salary === null ? stats : [salary, ...stats];
  }
});

// src/CrewSchedule/courses.tsx
import {
  registerAugment as registerAugment3,
  useCommand,
  useTelemetry as useTelemetry3
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge2,
  Card,
  DataLine as DataLine3,
  MissionDate as MissionDate2,
  magnitudeOf as magnitudeOf5,
  Section,
  SectionTitle,
  Stack as Stack2,
  SubjectHeading,
  Text,
  Unit as Unit2
} from "@ksp-gonogo/ui-kit";

// src/CrewSchedule/training.tsx
import {
  Cluster,
  CommandButton,
  DataLine as DataLine2,
  magnitudeOf as magnitudeOf4
} from "@ksp-gonogo/ui-kit";
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
var RP1_TRAINING_ENROL_COMMAND = "rp1.training.enrol";
var RP1_TRAINING_CANCEL_COMMAND = "rp1.training.cancel";
var RP1_TRAINING_REMOVE_COMMAND = "rp1.training.remove";
function CourseControls({
  course,
  cancel,
  remove
}) {
  const students2 = course.students ?? [];
  const queued = course.queued === true;
  const seatMin = magnitudeOf4(course.seatMin);
  const stranded = seatMin !== null && seatMin > 1 ? `This course seats ${seatMin} at least, so one student cannot leave it` : null;
  return (
    /* No Card of its own: the courses section already carries one around each
       course, and a second would draw a border inside a border. */
    /* @__PURE__ */ jsxs3(Cluster, { gap: "related-dense", justify: "start", wrap: true, children: [
      /* @__PURE__ */ jsx4(
        CommandButton,
        {
          args: { crewName: students2[0] },
          "aria-label": "Cancel this course",
          commandLabel: "Cancel this course",
          confirmAriaLabel: "Confirm cancelling this course",
          confirmLabel: queued ? "Leaves the queue, leave unaffected" : students2.length > 1 ? `All ${students2.length} off, no credit` : "Course ends, no credit",
          disabled: students2.length === 0,
          handle: cancel,
          label: "Cancel course",
          size: "sm",
          title: students2.length === 0 ? "RP-1 addresses a course by one of its students and this one has none" : void 0,
          tone: "warn"
        }
      ),
      !queued && students2.map((student) => /* @__PURE__ */ jsx4(
        CommandButton,
        {
          args: { crewName: student },
          "aria-label": stranded === null ? `Take ${student} off the course` : void 0,
          commandLabel: `Take ${student} off the course`,
          confirmAriaLabel: `Confirm taking ${student} off the course`,
          confirmLabel: `${student} off, no credit`,
          disabled: stranded !== null,
          handle: remove,
          label: `${student} off`,
          size: "sm",
          title: stranded ?? void 0
        },
        student
      ))
    ] })
  );
}
function Students({
  course
}) {
  const students2 = course.students ?? [];
  return /* @__PURE__ */ jsx4(DataLine2, { aligned: true, label: "Students", children: students2.length === 0 ? "Nobody on it yet" : students2.join(", ") });
}

// src/CrewSchedule/courses.tsx
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function TrainingCourses() {
  const available = current(useTelemetry3("rp1.available"));
  const courses = current(useTelemetry3("rp1.training"));
  const crew = current(useTelemetry3("rp1.crew"));
  const cancel = useCommand(RP1_TRAINING_CANCEL_COMMAND);
  const remove = useCommand(RP1_TRAINING_REMOVE_COMMAND);
  if (available !== true) {
    return null;
  }
  const live = (courses ?? []).filter((course) => course.completed !== true);
  if (live.length === 0) {
    return null;
  }
  return /* @__PURE__ */ jsxs4(Section, { children: [
    /* @__PURE__ */ jsx5(SectionTitle, { children: "TRAINING COURSES" }),
    /* @__PURE__ */ jsx5(Stack2, { gap: "related-dense", children: live.map((course) => /* @__PURE__ */ jsx5(
      Course,
      {
        cancel,
        course,
        crew,
        remove
      },
      `${course.id ?? ""}:${(course.students ?? []).join()}`
    )) })
  ] });
}
function Course({
  cancel,
  course,
  crew,
  remove
}) {
  const started = course.started === true;
  const queued = course.queued === true;
  const fraction = progressOf(course, crew);
  const finishes = magnitudeOf5(course.completesAtUt);
  const free = magnitudeOf5(course.studentsAvailableAtUt);
  return /* @__PURE__ */ jsx5(Card, { children: /* @__PURE__ */ jsxs4(Stack2, { gap: "related-dense", children: [
    /* @__PURE__ */ jsx5(
      SubjectHeading,
      {
        align: "start",
        status: /* @__PURE__ */ jsx5(Badge2, { tone: started ? "go" : "caution", size: "sm", children: started ? "TRAINING" : queued ? "QUEUED" : "NOT STARTED" }),
        children: /* @__PURE__ */ jsx5(Text, { size: "base", weight: "semibold", children: titleOf(course) })
      }
    ),
    /* @__PURE__ */ jsxs4(Stack2, { gap: "caption", children: [
      fraction !== null && started && /* @__PURE__ */ jsx5(DataLine3, { aligned: true, label: "Progress", children: /* @__PURE__ */ jsx5(Unit2, { value: fraction }) }, "progress"),
      finishes !== null && /* @__PURE__ */ jsx5(DataLine3, { aligned: true, label: "Finishes", children: /* @__PURE__ */ jsx5(MissionDate2, { value: course.completesAtUt }) }, "finishes"),
      free !== null && /* @__PURE__ */ jsx5(DataLine3, { aligned: true, label: "Crew free", children: /* @__PURE__ */ jsx5(MissionDate2, { value: course.studentsAvailableAtUt }) }, "free"),
      /* @__PURE__ */ jsx5(Students, { course })
    ] }),
    /* @__PURE__ */ jsx5(CourseControls, { cancel, course, remove })
  ] }) });
}
function progressOf(course, crew) {
  for (const student of course.students ?? []) {
    const row = (crew ?? []).find((entry) => entry.name === student);
    if (row && magnitudeOf5(row.trainingFractionComplete) !== null) {
      return row.trainingFractionComplete;
    }
  }
  return null;
}
registerAugment3({
  id: "rp1-training-courses",
  augments: "astronaut-complex.tab",
  label: "Training",
  channels: ["rp1.available", "rp1.training", "rp1.crew"],
  component: TrainingCourses,
  // Before the way onto a course: an operator reads what is already running
  // before deciding to start another.
  priority: 10,
  owner: RP1
});

// src/CrewSchedule/enrolment.tsx
import {
  CrewStanding,
  isFatality,
  registerAugment as registerAugment4,
  useCommand as useCommand2,
  useTelemetry as useTelemetry4,
  value as value2
} from "@ksp-gonogo/sitrep-sdk";
import {
  Card as Card2,
  Cluster as Cluster2,
  CommandButton as CommandButton2,
  DataLine as DataLine4,
  magnitudeOf as magnitudeOf6,
  ReadoutCaption,
  Section as Section2,
  SectionTitle as SectionTitle2,
  SelectableRow,
  Stack as Stack3,
  Text as Text2,
  ToggleButton,
  Unit as Unit3
} from "@ksp-gonogo/ui-kit";
import { useState } from "react";
import { Fragment as Fragment3, jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
function TrainingEnrolment() {
  const available = current(useTelemetry4("rp1.available"));
  const catalogue = current(useTelemetry4("rp1.trainingCatalogue"));
  const roster = current(useTelemetry4("spaceCenter.crewRoster"));
  const crew = current(useTelemetry4("rp1.crew"));
  const courses = current(useTelemetry4("rp1.training"));
  const missionTrainingEnabled = useMissionTrainingEnabled();
  const breakdown = current(useTelemetry4("rp1.budgetBreakdown"));
  const [pickedTemplate, setPickedTemplate] = useState(null);
  const [picked, setPicked] = useState(NOBODY);
  const enrol = useCommand2(RP1_TRAINING_ENROL_COMMAND);
  if (available !== true) {
    return null;
  }
  if (catalogue === void 0) {
    return null;
  }
  const offered = catalogue.filter(
    (template) => template.unlocked === true && template.id && !(template.type === "Mission" && missionTrainingEnabled === false)
  );
  const candidates = candidatesOf(roster, crew, courses);
  if (offered.length === 0 || candidates.length === 0) {
    return null;
  }
  const selected = offered.find((template) => template.id === pickedTemplate) ?? offered[0];
  const name = titleOf(selected);
  const chosen = candidates.filter((candidate) => picked.has(candidate.name));
  const refusal = enrolRefusal(selected, chosen);
  const queues = chosen.some((candidate) => candidate.onLeave);
  const verb = queues ? "Queue" : "Enrol";
  return /* @__PURE__ */ jsxs5(Section2, { children: [
    /* @__PURE__ */ jsx6(SectionTitle2, { children: "START A TRAINING" }),
    /* @__PURE__ */ jsx6(Card2, { children: /* @__PURE__ */ jsxs5(Stack3, { gap: "related-comfortable", children: [
      /* @__PURE__ */ jsxs5(Stack3, { gap: "caption", children: [
        /* @__PURE__ */ jsx6(ReadoutCaption, { children: "Training" }),
        /* @__PURE__ */ jsx6(Stack3, { "aria-label": "Training to start", gap: "caption", role: "group", children: offered.map((template) => /* @__PURE__ */ jsx6(
          SelectableRow,
          {
            onClick: () => setPickedTemplate(template.id ?? null),
            selected: template.id === selected.id,
            children: titleOf(template)
          },
          template.id
        )) }),
        /* @__PURE__ */ jsxs5(ReadoutCaption, { children: [
          lapseRule(selected) === null ? "" : `${lapseRule(selected)} \xB7 `,
          /* @__PURE__ */ jsx6(Unit3, { value: selected.baseTime }),
          " at standard rate",
          /* @__PURE__ */ jsx6(Seats, { template: selected })
        ] })
      ] }),
      /* @__PURE__ */ jsxs5(Stack3, { gap: "caption", children: [
        /* @__PURE__ */ jsx6(ReadoutCaption, { children: "Students" }),
        /* @__PURE__ */ jsx6(
          Cluster2,
          {
            "aria-label": `Students for ${name}`,
            gap: "related-packed",
            justify: "start",
            role: "group",
            wrap: true,
            children: candidates.map((candidate) => /* @__PURE__ */ jsx6(
              Student,
              {
                candidate,
                onToggle: () => setPicked(toggled(picked, candidate.name)),
                picked: picked.has(candidate.name)
              },
              candidate.name
            ))
          }
        )
      ] }),
      /* @__PURE__ */ jsxs5(Stack3, { gap: "caption", children: [
        /* @__PURE__ */ jsx6(TrainingUpkeep, { breakdown }),
        /* @__PURE__ */ jsx6(
          CourseCost,
          {
            breakdown,
            students: chosen.length,
            template: selected
          }
        ),
        refusal !== null && /* @__PURE__ */ jsx6(Text2, { size: "xs", tone: "warn", children: refusal }),
        /* @__PURE__ */ jsx6(Cluster2, { gap: "related-dense", justify: "start", wrap: true, children: /* @__PURE__ */ jsx6(
          CommandButton2,
          {
            args: {
              crew: chosen.map((candidate) => candidate.name),
              templateId: selected.id ?? void 0
            },
            "aria-label": refusal === null ? `${verb} ${students(chosen.length)} on ${name}` : void 0,
            commandLabel: `${verb} ${students(chosen.length)} on ${name}`,
            confirmAriaLabel: `Confirm ${queues ? "queueing" : "enrolling"} ${students(chosen.length)} on ${name}`,
            confirmLabel: `${verb} ${students(chosen.length)} on ${name}`,
            disabled: refusal !== null,
            handle: enrol,
            label: verb,
            size: "sm",
            title: refusal ?? void 0
          }
        ) })
      ] })
    ] }) })
  ] });
}
function TrainingUpkeep({
  breakdown
}) {
  const perDay = magnitudeOf6(breakdown?.astronautTraining?.day);
  if (perDay === null) {
    return null;
  }
  return /* @__PURE__ */ jsx6(DataLine4, { aligned: true, label: "Upkeep", children: /* @__PURE__ */ jsx6(Unit3, { value: value2("f/day", -perDay) }) });
}
function CourseCost({
  breakdown,
  students: students2,
  template
}) {
  const fee = breakdown?.trainingFees?.find(
    (row) => row.templateId === template.id
  );
  const perDay = magnitudeOf6(fee?.perStudent?.day);
  if (perDay === null) {
    return null;
  }
  const perStudent = /* @__PURE__ */ jsx6(Unit3, { decimals: 0, value: value2("f/day", -perDay) });
  return /* @__PURE__ */ jsx6(DataLine4, { aligned: true, label: "Course", children: students2 === 0 ? /* @__PURE__ */ jsxs5(Fragment3, { children: [
    perStudent,
    " per student"
  ] }) : /* @__PURE__ */ jsxs5(Fragment3, { children: [
    /* @__PURE__ */ jsx6(Unit3, { decimals: 0, value: value2("f/day", -perDay * students2) }),
    students2 > 1 && /* @__PURE__ */ jsxs5(Fragment3, { children: [
      " \xB7 ",
      perStudent,
      " per student"
    ] })
  ] }) });
}
function Student({
  candidate,
  onToggle,
  picked
}) {
  return /* @__PURE__ */ jsxs5(
    ToggleButton,
    {
      pressed: picked,
      disabled: candidate.refusal !== null && !picked,
      onClick: onToggle,
      size: "sm",
      title: candidate.refusal?.sentence ?? (candidate.onLeave ? `${candidate.name} is on leave, so the course is queued and starts when they are back` : void 0),
      tone: candidate.refusal === null ? void 0 : "nogo",
      children: [
        candidate.name,
        candidate.refusal !== null && ` \xB7 ${candidate.refusal.tag}`,
        candidate.refusal === null && candidate.onLeave && " \xB7 on leave"
      ]
    }
  );
}
function candidatesOf(roster, crew, courses) {
  const training = trainingNames(crew, courses);
  const retired = new Set(
    (crew ?? []).filter((entry) => entry.retired === true).map((entry) => entry.name)
  );
  const candidates = [];
  for (const row of roster ?? []) {
    const name = row.name;
    if (!name || row.isApplicant === true || isFatality(row.standing) || retired.has(name)) {
      continue;
    }
    candidates.push({
      name,
      refusal: studentRefusal(row, training),
      onLeave: row.standing === CrewStanding.Resting
    });
  }
  return [
    ...candidates.filter((candidate) => candidate.refusal === null),
    ...candidates.filter((candidate) => candidate.refusal !== null)
  ];
}
function studentRefusal(row, training) {
  const name = row.name ?? "";
  if (training.has(name)) {
    return {
      sentence: `${name} is already on a training course`,
      tag: "in training"
    };
  }
  if (row.standing === CrewStanding.Assigned) {
    return { sentence: `${name} is off-world`, tag: "off-world" };
  }
  return null;
}
function trainingNames(crew, courses) {
  const names = /* @__PURE__ */ new Set();
  for (const course of courses ?? []) {
    if (course.completed === true) {
      continue;
    }
    for (const student of course.students ?? []) {
      names.add(student);
    }
  }
  for (const row of crew ?? []) {
    if (row.name && (row.trainingTarget ?? row.trainingCourse)) {
      names.add(row.name);
    }
  }
  return names;
}
function enrolRefusal(template, chosen) {
  if (template.id == null) {
    return "RP-1 reported this course without an id, so it cannot be started from here";
  }
  const blocked = chosen.filter((candidate) => candidate.refusal !== null);
  if (blocked.length > 0) {
    return `${blocked.map((candidate) => candidate.name).join(", ")} cannot take this training, and RP-1 refuses the whole crew rather than starting a seat short`;
  }
  const name = titleOf(template);
  const min = magnitudeOf6(template.seatMin);
  if (chosen.length === 0) {
    return min === null || min <= 1 ? "Nobody is picked, and RP-1 has no such thing as an empty course" : `${name} needs ${min} students and nobody is picked`;
  }
  if (min !== null && chosen.length < min) {
    return `${name} needs ${min} students and ${students(chosen.length)} ${chosen.length === 1 ? "is" : "are"} picked`;
  }
  const max = magnitudeOf6(template.seatMax);
  if (max !== null && max > 0 && chosen.length > max) {
    return `${name} seats ${max} and ${students(chosen.length)} are picked`;
  }
  return null;
}
function students(count2) {
  return count2 === 1 ? "1 student" : `${count2} students`;
}
function toggled(picked, name) {
  const next = new Set(picked);
  if (!next.delete(name)) {
    next.add(name);
  }
  return next;
}
var NOBODY = /* @__PURE__ */ new Set();
registerAugment4({
  id: "rp1-training-enrolment",
  augments: "astronaut-complex.tab",
  label: "Training",
  channels: [
    "rp1.available",
    "rp1.trainingCatalogue",
    "rp1.crew",
    "rp1.training",
    /* The roster the command itself keys on. Named here rather than taken from
       the host, so this section carries its own reads the way ProgramDetail
       names `career.status`. */
    "spaceCenter.crewRoster",
    /* What training draws from the career per day and each training's fee per
       student; see `TrainingUpkeep` and `CourseCost`. */
    "rp1.budgetBreakdown"
  ],
  component: TrainingEnrolment,
  // After the running courses. An operator opens the tab to read what is
  // already under way; starting another is what they do once they have, which
  // is the order Buildable takes below the build queue.
  priority: 20,
  owner: RP1
});

// src/ContractPayload/index.tsx
import {
  registerAugment as registerAugment5,
  useCommand as useCommand3,
  useTelemetry as useTelemetry5,
  value as value3
} from "@ksp-gonogo/sitrep-sdk";
import {
  CommandButton as CommandButton3,
  Inline,
  Stack as Stack4,
  Text as Text3,
  Unit as Unit4,
  UnitInput
} from "@ksp-gonogo/ui-kit";
import { useState as useState2 } from "react";
import { Fragment as Fragment4, jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
var RP1_CONTRACT_PAYLOAD_COMMAND = "rp1.contracts.setPayload";
var MIN_PAYLOAD = 400;
var MAX_PAYLOAD = 1e4;
var PAYLOAD_STEP = 100;
function ContractPayload() {
  const available = current(useTelemetry5("rp1.available"));
  const setPayload = useCommand3(RP1_CONTRACT_PAYLOAD_COMMAND);
  const [comms, setComms] = useState2(MIN_PAYLOAD);
  const [weather, setWeather] = useState2(MIN_PAYLOAD);
  if (available !== true) {
    return null;
  }
  const legalPair = legal(comms) && legal(weather);
  return /* @__PURE__ */ jsxs6(Stack4, { gap: "related-dense", children: [
    /* @__PURE__ */ jsx7(Text3, { size: "xs", level: "muted", children: "the payload a repeating satellite contract will require" }),
    /* @__PURE__ */ jsxs6(Inline, { gap: "related-dense", wrap: true, children: [
      /* @__PURE__ */ jsx7(
        UnitInput,
        {
          label: "CommSat payload",
          onChange: (next) => setComms(kilograms(next)),
          unit: "kg",
          value: value3("kg", comms)
        }
      ),
      /* @__PURE__ */ jsx7(
        UnitInput,
        {
          label: "WeatherSat payload",
          onChange: (next) => setWeather(kilograms(next)),
          unit: "kg",
          value: value3("kg", weather)
        }
      )
    ] }),
    /* @__PURE__ */ jsx7(Text3, { size: "xs", tone: legalPair ? void 0 : "warn", level: "muted", children: legalPair ? "changing either withdraws the matching pending contract offers, once each, so they regenerate against the new requirement" : /* @__PURE__ */ jsxs6(Fragment4, { children: [
      "each figure must be between",
      " ",
      /* @__PURE__ */ jsx7(Unit4, { value: value3("kg", MIN_PAYLOAD) }),
      " and",
      " ",
      /* @__PURE__ */ jsx7(Unit4, { value: value3("kg", MAX_PAYLOAD) }),
      ", in steps of",
      " ",
      PAYLOAD_STEP
    ] }) }),
    /* @__PURE__ */ jsx7(
      CommandButton3,
      {
        args: { commsPayload: comms, weatherPayload: weather },
        "aria-label": legalPair ? `Require ${comms} kilograms for CommSat contracts and ${weather} kilograms for WeatherSat contracts, withdrawing the matching pending offers` : "One of the payload figures is outside the range RP-1 accepts",
        commandLabel: "Set contract payload requirements",
        confirmAriaLabel: "Confirm the new payload requirements and withdraw the matching pending offers",
        confirmLabel: "Confirm",
        confirmTone: "nogo",
        disabled: !legalPair,
        handle: setPayload,
        label: "Set payload",
        size: "sm",
        tone: "warn"
      }
    )
  ] });
}
function kilograms(mass) {
  return Math.round(mass.magnitude);
}
function legal(payload) {
  return Number.isFinite(payload) && payload >= MIN_PAYLOAD && payload <= MAX_PAYLOAD && payload % PAYLOAD_STEP === 0;
}
registerAugment5({
  id: "rp1-contract-payload",
  augments: "contract-manager.sections",
  component: ContractPayload,
  priority: 0,
  owner: RP1
});

// src/FacilityUpgrades/index.tsx
import {
  magnitudeOf as magnitudeOf7,
  registerAugment as registerAugment6,
  useCommand as useCommand4,
  useTelemetry as useTelemetry6
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge3,
  Cluster as Cluster4,
  CommandButton as CommandButton4,
  EmptyState,
  MissionDate as MissionDate3,
  NULL_DISPLAY,
  Readout,
  ReadoutCaption as ReadoutCaption2,
  Section as Section3,
  SectionTitle as SectionTitle3,
  Text as Text5,
  Unit as Unit5
} from "@ksp-gonogo/ui-kit";

// src/shared/facilityLabels.ts
var FACILITY_LABEL = {
  Administration: "Administration",
  AstronautComplex: "Astronaut Complex",
  LaunchPad: "Launch Pad",
  MissionControl: "Mission Control",
  ResearchAndDevelopment: "Research and Development",
  Runway: "Runway",
  SpaceplaneHangar: "Spaceplane Hangar",
  TrackingStation: "Tracking Station",
  VehicleAssemblyBuilding: "Vehicle Assembly Building"
};
function facilityLabel(name) {
  return FACILITY_LABEL[name] ?? name;
}

// src/shared/ProjectCard.tsx
import { value as value4 } from "@ksp-gonogo/sitrep-sdk";
import { Card as Card3, Cluster as Cluster3, Meter, Stack as Stack5, Text as Text4 } from "@ksp-gonogo/ui-kit";
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
function ProjectCard({
  name,
  badge,
  detail,
  progress,
  tone,
  children
}) {
  return /* @__PURE__ */ jsx8(Card3, { as: "li", tone, children: /* @__PURE__ */ jsxs7(Stack5, { gap: "related-dense", children: [
    /* @__PURE__ */ jsxs7(Cluster3, { align: "start", gap: "related-dense", wrap: true, children: [
      /* @__PURE__ */ jsx8(Text4, { children: name }),
      badge
    ] }),
    detail !== void 0 && /* @__PURE__ */ jsx8(Text4, { size: "xs", level: "muted", children: detail }),
    progress !== void 0 && progress.ratio !== null && /* @__PURE__ */ jsx8(
      Meter,
      {
        hideLabel: true,
        label: progress.label,
        value: value4("ratio", progress.ratio)
      }
    ),
    children
  ] }) });
}
function ProjectCardList({
  children
}) {
  return /* @__PURE__ */ jsx8(Stack5, { as: "ul", gap: "related-comfortable", style: LIST_STYLE, children });
}
var LIST_STYLE = { listStyle: "none", margin: 0, padding: 0 };

// src/FacilityUpgrades/index.tsx
import { Fragment as Fragment5, jsx as jsx9, jsxs as jsxs8 } from "react/jsx-runtime";
var RP1_FACILITY_UPGRADE_COMMAND = "rp1.facility.upgrade";
function FacilityUpgrades() {
  const available = current(useTelemetry6("rp1.available"));
  const careerReading = useTelemetry6("career.status");
  const stockTiers = current(useTelemetry6("career.facilities"));
  const constructions = current(useTelemetry6("rp1.constructions"));
  const facilityTiers2 = current(useTelemetry6("rp1.facilities"));
  const rates = current(useTelemetry6("rp1.constructionRates"));
  const upgrade = useCommand4(RP1_FACILITY_UPGRADE_COMMAND);
  if (available !== true) {
    return null;
  }
  const queued = new Set(
    (constructions ?? []).flatMap(
      (row) => row.kind === "FacilityUpgrade" && row.facilityType !== void 0 && row.facilityType !== null ? [row.facilityType] : []
    )
  );
  const stockFacilities = stockTiers?.facilities ?? {};
  const rp1Tiers = new Map(
    (facilityTiers2 ?? []).flatMap(
      (row) => row.facility === void 0 || row.facility === null ? [] : [[row.facility, row]]
    )
  );
  const upgradeRates = new Map(
    (rates?.facilityUpgrades ?? []).flatMap(
      (row) => row.facility == null ? [] : [[row.facility, row]]
    )
  );
  const pricedAt = rates?.refreshedAt;
  const names = Array.from(
    /* @__PURE__ */ new Set([...rp1Tiers.keys(), ...Object.keys(stockFacilities)])
  ).sort((a, b) => facilityLabel(a).localeCompare(facilityLabel(b)));
  const rows = names.flatMap((name) => {
    const rp1 = rp1Tiers.get(name);
    if (rp1?.upgradedByRp1 === false) {
      return [];
    }
    const step = rp1 === void 0 ? nextTier(stockFacilities[name]) : nextTier(rp1) ?? nextTier(stockFacilities[name]);
    return step === null || queued.has(name) ? [] : [{ name, step, rate: upgradeRates.get(name) }];
  });
  const answered = names.some(
    (name) => answersTiers(rp1Tiers.get(name)) || answersTiers(stockFacilities[name])
  );
  if (names.length > 0 && !answered) {
    return null;
  }
  return /* @__PURE__ */ jsxs8(Section3, { gap: "related-dense", children: [
    /* @__PURE__ */ jsx9(SectionTitle3, { children: "FACILITY UPGRADES" }),
    /* @__PURE__ */ jsxs8(Readout, { children: [
      /* @__PURE__ */ jsx9(ReadoutCaption2, { children: "Funds" }),
      /* @__PURE__ */ jsx9(Unit5, { value: careerReading.balances.funds })
    ] }),
    rows.length === 0 ? (
      /* A real answer and worth stating: a career whose buildings are all at
         their ceiling, or all already queued, reads the same as a section
         that failed to draw if this is left out. */
      /* @__PURE__ */ jsx9(EmptyState, { children: "Nothing left to queue" })
    ) : /* @__PURE__ */ jsx9(ProjectCardList, { children: rows.map(({ name, step, rate }) => /* @__PURE__ */ jsx9(
      UpgradeCard,
      {
        facility: name,
        handle: upgrade,
        pricedAt,
        rate,
        step
      },
      name
    )) })
  ] });
}
function nextTier(entry) {
  const tier = magnitudeOf7(entry?.currentTier);
  const max = magnitudeOf7(entry?.maxTier);
  if (tier === null || max === null || tier >= max) {
    return null;
  }
  return { current: tier + 1, cost: entry?.upgradeCost };
}
function answersTiers(entry) {
  return magnitudeOf7(entry?.currentTier) !== null && magnitudeOf7(entry?.maxTier) !== null;
}
function UpgradeCard({
  facility,
  handle,
  step,
  rate,
  pricedAt
}) {
  const label3 = facilityLabel(facility);
  return /* @__PURE__ */ jsxs8(
    ProjectCard,
    {
      badge: /* @__PURE__ */ jsxs8(Badge3, { tone: "info", children: [
        "TIER ",
        step.current
      ] }),
      name: label3,
      tone: "go",
      children: [
        /* @__PURE__ */ jsxs8(Cluster4, { gap: "related-dense", justify: "start", wrap: true, children: [
          /* @__PURE__ */ jsx9(Text5, { size: "xs", level: "muted", children: step.cost == null ? /* @__PURE__ */ jsxs8(Fragment5, { children: [
            NULL_DISPLAY,
            " not priced"
          ] }) : /* @__PURE__ */ jsxs8(Fragment5, { children: [
            /* @__PURE__ */ jsx9(Unit5, { decimals: 0, value: step.cost }),
            " over the build"
          ] }) }),
          /* @__PURE__ */ jsx9(
            CommandButton4,
            {
              args: { facility },
              "aria-label": `Queue ${label3} upgrade`,
              commandLabel: `Queue ${label3} upgrade`,
              confirmAriaLabel: `Confirm queueing ${label3} tier ${step.current + 1}`,
              confirmLabel: `Commit tier ${step.current + 1}`,
              handle,
              label: "Queue upgrade",
              size: "sm"
            }
          )
        ] }),
        /* @__PURE__ */ jsx9(UpgradeRate, { pricedAt, rate })
      ]
    }
  );
}
function UpgradeRate({
  rate,
  pricedAt
}) {
  const seconds = magnitudeOf7(rate?.buildSeconds);
  const from = magnitudeOf7(pricedAt);
  if (rate?.costPerDay == null || seconds === null || from === null) {
    return null;
  }
  return /* @__PURE__ */ jsxs8(Text5, { size: "xs", level: "muted", children: [
    "draws ",
    /* @__PURE__ */ jsx9(Unit5, { decimals: 0, value: rate.costPerDay }),
    " at full rate, done",
    " ",
    /* @__PURE__ */ jsx9(MissionDate3, { value: from + seconds }),
    " if queued now; a short balance slows it"
  ] });
}
registerAugment6({
  id: "rp1-facility-upgrades",
  augments: "space-center-status.sections",
  component: FacilityUpgrades,
  channels: [
    "rp1.available",
    /* The balance rides this one, and naming it here is what makes the section
       independent of whatever the host happens to subscribe. */
    "career.status",
    /* The stock tiers and prices, which stop arriving away from the space
       centre and are read as the fallback below. */
    "career.facilities",
    /* What is already being built, so a facility with a project in flight is
       not offered a second one the command would refuse. */
    "rp1.constructions",
    /* The tiers and prices again, read through RP-1 rather than through the
       scene. The only one of these that answers away from the space centre. */
    "rp1.facilities",
    /* The draw per day and build time beside each Queue press. */
    "rp1.constructionRates"
  ],
  requires: "rp1",
  /** Immediately above the construction queue this feeds; see `KscConstruction`
   *  for why the order is declared rather than left to import order. */
  priority: -0.5,
  owner: RP1
});

// src/FacilityUpgrades/facilityTiers.ts
import { magnitudeOf as magnitudeOf8 } from "@ksp-gonogo/sitrep-sdk";
function facilityTiers(rows, held) {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const facility = row.facility;
    const currentTier = magnitudeOf8(row.currentTier);
    const maxTier = magnitudeOf8(row.maxTier);
    if (typeof facility !== "string" || currentTier === null || maxTier === null) {
      return [];
    }
    const upgradeCost = row.upgradedByRp1 === false ? null : magnitudeOf8(row.upgradeCost);
    return [
      {
        facility,
        currentTier,
        maxTier,
        ...upgradeCost === null ? {} : { upgradeCost },
        ...held === void 0 ? {} : { held }
      }
    ];
  });
}
RP1.registerContribution({
  id: "facility-tiers",
  contributes: "space-center-status.facilities",
  requires: "rp1",
  deps: ["rp1.facilities"],
  compute: (topics) => facilityTiers(
    lastValue(topics["rp1.facilities"]),
    topics["rp1.facilities"]
  )
});

// src/Finances/index.tsx
import {
  combineReadings,
  isValue,
  registerAugment as registerAugment7,
  useTelemetry as useTelemetry8,
  value as value6
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge4,
  Cluster as Cluster5,
  DataTable,
  Disclosure,
  EmptyState as EmptyState2,
  Grid,
  MissionDate as MissionDate5,
  magnitudeOf as magnitudeOf10,
  Section as Section5,
  Stat,
  ToggleButton as ToggleButton2,
  Unit as Unit6,
  useElementSize,
  VisuallyHidden
} from "@ksp-gonogo/ui-kit";
import { useState as useState4 } from "react";

// src/Finances/FundsAlarm.tsx
import {
  useAlarmRequest,
  useStream,
  useTelemetry as useTelemetry7,
  value as value5
} from "@ksp-gonogo/sitrep-sdk";
import {
  Button,
  MissionDate as MissionDate4,
  magnitudeOf as magnitudeOf9,
  NULL_DISPLAY as NULL_DISPLAY2,
  Row,
  RowName,
  Section as Section4,
  Text as Text6,
  UnitInput as UnitInput2
} from "@ksp-gonogo/ui-kit";
import { useEffect, useState as useState3 } from "react";
import { jsx as jsx10, jsxs as jsxs9 } from "react/jsx-runtime";
var CAREER_TOPIC = "career.status";
var FUNDS_PATH = "balances.funds";
var ALARM_KEY = "fund-target";
var ASK_AFTER_MS = 400;
function FundsAlarm() {
  const requestAlarm = useAlarmRequest(RP1);
  const fundTarget = current(useTelemetry7("rp1.fundTarget"));
  const balance = magnitudeOf9(current(useTelemetry7("career.status"))?.balances?.funds);
  const [typed, setTyped] = useState3(null);
  const standing = fundTarget?.active === true;
  const wanted = typed ?? value5("funds", standing && magnitudeOf9(fundTarget?.targetFunds) || 0);
  const wantedFunds = Math.round(magnitudeOf9(wanted) ?? 0);
  const spoken = wantedFunds.toLocaleString("en-GB");
  const settledTyped = useSettled(wantedFunds, ASK_AFTER_MS);
  const asked = typed === null ? wantedFunds : settledTyped;
  const forecast = useStream(
    asked > 0 ? fundsReachedAtTopic(asked) : RP1_AVAILABLE_TOPIC
  );
  return /* @__PURE__ */ jsxs9(Section4, { gap: "related-dense", title: "FUNDS ALARM", children: [
    /* @__PURE__ */ jsx10(
      UnitInput2,
      {
        label: "Target balance",
        onChange: setTyped,
        unit: "funds",
        value: wanted
      }
    ),
    /* @__PURE__ */ jsxs9(Row, { as: "div", children: [
      /* @__PURE__ */ jsx10(RowName, { children: "Balance reaches it" }),
      /* @__PURE__ */ jsx10(
        ReachedAt,
        {
          balance,
          figure: wantedFunds,
          forecast: asked === wantedFunds ? forecast : void 0
        }
      )
    ] }),
    /* @__PURE__ */ jsx10(Row, { as: "div", children: /* @__PURE__ */ jsx10(
      Button,
      {
        variant: "ghost",
        size: "sm",
        "aria-label": `Stop the warp when the balance reaches ${spoken} funds`,
        disabled: wantedFunds <= 0,
        onClick: () => requestAlarm({
          key: ALARM_KEY,
          name: `Balance reaches ${spoken} funds`,
          trigger: {
            kind: "threshold",
            topic: CAREER_TOPIC,
            fieldPath: FUNDS_PATH,
            op: ">=",
            value: wantedFunds,
            /*
             * The active command centre, not the craft's clock: the
             * balance belongs to the career, not to a craft. The
             * simulation judges the alarm against what that centre has
             * been told and stops the warp on the tick it learns the
             * balance, with no command from the client.
             */
            vantage: "command"
          }
        }),
        type: "button",
        children: "Set alarm"
      }
    ) })
  ] });
}
function ReachedAt({
  balance,
  figure,
  forecast
}) {
  if (figure <= 0) return /* @__PURE__ */ jsx10(Text6, { children: NULL_DISPLAY2 });
  if (balance !== null && balance >= figure) {
    return /* @__PURE__ */ jsx10(Text6, { children: "already" });
  }
  if (forecast === void 0) return /* @__PURE__ */ jsx10(Text6, { children: NULL_DISPLAY2 });
  if (forecast.state === "absent") return /* @__PURE__ */ jsx10(Text6, { children: "beyond RP-1's forecast" });
  const reachedAt = latest(forecast);
  if (reachedAt === void 0 || reachedAt === null) {
    return /* @__PURE__ */ jsx10(Text6, { children: NULL_DISPLAY2 });
  }
  return /* @__PURE__ */ jsx10(MissionDate4, { value: value5("ut", reachedAt) });
}
function useSettled(next, ms) {
  const [settled2, setSettled] = useState3(next);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(next), ms);
    return () => clearTimeout(timer);
  }, [next, ms]);
  return settled2;
}

// src/Finances/index.tsx
import { Fragment as Fragment6, jsx as jsx11, jsxs as jsxs10 } from "react/jsx-runtime";
var PERIODS = [
  { id: "day", label: "Day" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" }
];
var ALL_PERIODS_MIN_WIDTH = 460;
var JULIAN_YEAR = 31557600;
var RECENT_MONTHS = 12;
var RP1_ROWS = [
  { key: "facilities", label: "Facilities", drill: "facilities" },
  { key: "integrationTeams", label: "Integration Teams", drill: "integration" },
  { key: "researchTeams", label: "Research Teams" },
  { key: "astronauts", label: "Astronauts", drill: "astronauts" },
  { key: "upkeep", label: "Total upkeep" },
  { key: "subsidy", label: "Avg. Subsidy" },
  { key: "net", label: "Net (after subsidy)" },
  { key: "rollout", label: "Rollout / Airlaunch Prep", drill: "rollouts" },
  { key: "constructions", label: "Constructions", drill: "constructions" },
  { key: "programBudget", label: "Program Budget", drill: "programs" },
  { key: "balance", label: "Balance" },
  { key: "unlockCredit", label: "Unlock Credit" }
];
function Finances({ screenId }) {
  const availableReading = useTelemetry8("rp1.available");
  const available = latest(availableReading);
  const budgetReading = useTelemetry8("rp1.budget");
  const budget = latest(budgetReading);
  const breakdownReading = useTelemetry8("rp1.budgetBreakdown");
  const ledgerReading = useTelemetry8("rp1.careerLedger");
  const training = latest(useTelemetry8("rp1.training"));
  const research = latest(useTelemetry8("rp1.research"));
  const { ref, size } = useElementSize({
    w: 1024,
    h: 0
  });
  const [picked, setPicked] = useState4("month");
  if (screenId !== FINANCES_SCREEN_ID) {
    return null;
  }
  if (available !== true) {
    return null;
  }
  const periods = size.w < ALL_PERIODS_MIN_WIDTH ? [picked] : ["day", "month", "year"];
  return /* @__PURE__ */ jsx11("div", { ref, children: budget === void 0 ? /* @__PURE__ */ jsxs10(Section5, { gap: "section-compact", children: [
    /* @__PURE__ */ jsx11(EmptyState2, { children: availableReading.state === "held" ? "RP-1 had sent no budget when the link dropped" : "RP-1 has not sent a budget" }),
    /* @__PURE__ */ jsx11(FundsAlarm, {})
  ] }) : /* @__PURE__ */ jsxs10(Section5, { gap: "section-compact", children: [
    /* @__PURE__ */ jsx11(FundsChange, { budget: budgetReading }),
    /* @__PURE__ */ jsxs10(Section5, { gap: "related-dense", title: "BUDGET", children: [
      periods.length === 1 && /* @__PURE__ */ jsx11(PeriodPicker, { picked, onPick: setPicked }),
      /* @__PURE__ */ jsx11(
        BudgetTable,
        {
          breakdown: breakdownReading,
          budget: budgetReading,
          courseNames: namesById(training, "id"),
          periods
        }
      )
    ] }),
    /* @__PURE__ */ jsx11(Modifiers, { budget: budgetReading }),
    /* @__PURE__ */ jsx11(Reputation, { budget: budgetReading }),
    /* @__PURE__ */ jsx11(
      UnlockCredit,
      {
        budget: budgetReading,
        researchIdle: research !== void 0 && research.length === 0
      }
    ),
    /* @__PURE__ */ jsx11(Forecast, { budget: budgetReading }),
    /* @__PURE__ */ jsx11(
      CareerLog,
      {
        ledger: ledgerReading,
        wide: size.w >= ALL_PERIODS_MIN_WIDTH
      }
    ),
    /* @__PURE__ */ jsx11(FundsAlarm, {})
  ] }) });
}
function FundsChange({ budget }) {
  return /* @__PURE__ */ jsx11(Section5, { gap: "related-dense", title: "FUNDS CHANGE", children: /* @__PURE__ */ jsx11(Grid, { minColWidth: "7rem", fit: true, align: "stretch", gap: "related-compact", children: PERIODS.map(({ id, label: label3 }) => {
    const delta = budget[id].fundsDelta;
    const size = unsignedOf(delta);
    const sign = magnitudeOf10(delta.value);
    return /* @__PURE__ */ jsx11(
      Stat,
      {
        detail: sign === null ? void 0 : sign < 0 ? "Drain" : "Gain",
        label: label3,
        children: /* @__PURE__ */ jsx11(Unit6, { value: size })
      },
      id
    );
  }) }) });
}
function PeriodPicker({
  picked,
  onPick
}) {
  return /* @__PURE__ */ jsx11(
    Cluster5,
    {
      "aria-label": "Budget period",
      gap: "related-dense",
      justify: "start",
      role: "group",
      children: PERIODS.map(({ id, label: label3 }) => /* @__PURE__ */ jsx11(
        ToggleButton2,
        {
          pressed: picked === id,
          onClick: () => onPick(id),
          size: "sm",
          children: label3
        },
        id
      ))
    }
  );
}
function BudgetTable({
  budget,
  breakdown,
  periods,
  courseNames
}) {
  const rows = RP1_ROWS.map(({ key, label: label3, drill }) => ({
    id: key,
    label: label3,
    at: (period) => budget[period][key],
    drill
  }));
  const unused = (period) => unusedSubsidy(budget[period]);
  const clampBit = periods.some((p) => (magnitudeOf10(unused(p).value) ?? 0) > 0);
  if (clampBit) {
    const netAt = rows.findIndex((row) => row.id === "net");
    rows.splice(netAt + 1, 0, {
      id: "unusedSubsidy",
      label: "Unused subsidy",
      at: unused,
      unsigned: true
    });
  }
  const columns = [
    {
      key: "row",
      header: /* @__PURE__ */ jsx11(VisuallyHidden, { children: "Row" }),
      rowHeader: true,
      render: (row) => row.label
    },
    ...periods.map(
      (period) => ({
        key: period,
        header: periodLabel(period),
        align: "end",
        render: (row) => row.unsigned ? /* @__PURE__ */ jsx11(Unit6, { value: row.at(period) }) : /* @__PURE__ */ jsx11(Signed, { amount: row.at(period) })
      })
    )
  ];
  return /* @__PURE__ */ jsx11(
    DataTable,
    {
      caption: "RP-1 budget by period",
      columns,
      rowDetail: (row) => row.drill === void 0 || latest(breakdown) === void 0 ? null : /* @__PURE__ */ jsx11(
        DrillDown,
        {
          breakdown,
          courseNames,
          drill: row.drill,
          periods
        }
      ),
      rowKey: (row) => row.id,
      rows
    }
  );
}
function DrillDown({
  drill,
  breakdown,
  periods,
  courseNames
}) {
  const { lines, summary } = linesFor(drill, breakdown, courseNames);
  if (lines.length === 0) {
    return null;
  }
  const columns = [
    {
      key: "line",
      header: /* @__PURE__ */ jsx11(VisuallyHidden, { children: "Line" }),
      rowHeader: true,
      render: (line) => line.label
    },
    ...periods.map(
      (period) => ({
        key: period,
        header: periodLabel(period),
        align: "end",
        render: (line) => line.amounts === void 0 ? null : /* @__PURE__ */ jsx11(Signed, { amount: line.amounts[period] })
      })
    )
  ];
  return /* @__PURE__ */ jsx11(Disclosure, { asButton: true, chevron: false, label: summary, variant: "inline", children: /* @__PURE__ */ jsx11(
    DataTable,
    {
      caption: summary,
      columns,
      rowKey: (line) => line.id,
      rows: lines
    }
  ) });
}
function linesFor(drill, reading, courseNames) {
  const breakdown = latest(reading) ?? {};
  if (drill === "facilities") {
    const buildings = breakdown.buildings ?? [];
    const complexes = breakdown.complexes ?? [];
    const complexLine = (i) => {
      const c = complexes[i];
      return {
        id: `complex:${c.lcId ?? i}`,
        label: c.operational === false ? /* @__PURE__ */ jsxs10(Fragment6, { children: [
          c.name,
          " ",
          /* @__PURE__ */ jsx11(Badge4, { tone: "info", children: "UNDER CONSTRUCTION" })
        ] }) : c.name,
        amounts: reading.complexes[i].upkeep
      };
    };
    const grouped = byCentre(complexes, complexLine);
    return {
      summary: `${count(buildings.length, "building")}, ${count(complexes.length, "complex", "complexes")}`,
      lines: [
        ...buildings.map((b, i) => ({
          id: `building:${b.facility ?? i}`,
          label: facilityLabel(b.facility ?? ""),
          amounts: reading.buildings[i].upkeep
        })),
        ...grouped
      ]
    };
  }
  if (drill === "astronauts") {
    const crew = breakdown.crew ?? [];
    const courses = breakdown.courses ?? [];
    const subtotal = (key, label3) => breakdown[key] == null ? [] : [{ id: key, label: label3, amounts: reading[key] }];
    return {
      summary: `${count(crew.length, "crew member")}, ${count(courses.length, "course")}`,
      lines: [
        ...crew.map((k, i) => ({
          id: `crew:${k.name ?? i}`,
          label: k.inFlight === true ? /* @__PURE__ */ jsxs10(Fragment6, { children: [
            k.name,
            " ",
            /* @__PURE__ */ jsx11(Badge4, { tone: "info", children: "IN FLIGHT" })
          ] }) : k.name,
          amounts: reading.crew[i].cost
        })),
        ...subtotal("astronautBase", "Astronaut base cost"),
        ...subtotal("astronautOperational", "Astronaut operational cost"),
        ...courses.map((c, i) => ({
          id: `course:${c.id ?? i}`,
          label: /* @__PURE__ */ jsxs10(Fragment6, { children: [
            courseNames.get(c.id ?? "") ?? c.id,
            " \xB7",
            " ",
            /* @__PURE__ */ jsx11(Unit6, { value: c.students }),
            " students"
          ] }),
          amounts: reading.courses[i].cost
        })),
        ...subtotal("astronautTraining", "Astronaut training cost")
      ]
    };
  }
  if (drill === "integration") {
    const teams = breakdown.integrationTeams ?? [];
    const complexes = teams.filter((t) => t.unassigned !== true).length;
    return {
      summary: count(complexes, "complex", "complexes"),
      lines: byCentre(teams, (i) => {
        const t = teams[i];
        return {
          id: t.unassigned === true ? `idle:${t.kscName ?? i}` : `team:${t.lcId ?? i}`,
          label: /* @__PURE__ */ jsxs10(Fragment6, { children: [
            t.unassigned === true ? "Unassigned" : t.name,
            " \xB7",
            " ",
            /* @__PURE__ */ jsx11(Unit6, { value: t.engineers }),
            " engineers"
          ] }),
          amounts: reading.integrationTeams[i].cost
        };
      })
    };
  }
  if (drill === "rollouts") {
    const operations = breakdown.rollouts ?? [];
    return {
      summary: count(operations.length, "operation"),
      lines: operations.map((r, i) => {
        const kind = rolloutLabel(r.type);
        return {
          id: `rollout:${i}`,
          label: r.vesselName == null ? /* @__PURE__ */ jsxs10(Fragment6, { children: [
            kind,
            " \xB7 ",
            r.lcName
          ] }) : /* @__PURE__ */ jsxs10(Fragment6, { children: [
            r.vesselName,
            " \xB7 ",
            kind,
            " \xB7 ",
            r.lcName
          ] }),
          amounts: reading.rollouts[i].cost
        };
      })
    };
  }
  if (drill === "constructions") {
    const projects = breakdown.constructions ?? [];
    return {
      summary: count(projects.length, "construction"),
      lines: byCentre(projects, (i) => ({
        id: `construction:${projects[i].id ?? i}`,
        label: projects[i].name,
        amounts: reading.constructions[i].cost
      }))
    };
  }
  const running = breakdown.programs ?? [];
  return {
    summary: count(running.length, "Program"),
    lines: running.map((p, i) => ({
      id: `program:${p.name ?? i}`,
      label: /* @__PURE__ */ jsxs10(Fragment6, { children: [
        p.title ?? p.name,
        p.deadlineUt != null && /* @__PURE__ */ jsxs10(Fragment6, { children: [
          " \xB7 deadline ",
          /* @__PURE__ */ jsx11(MissionDate5, { value: p.deadlineUt })
        ] })
      ] }),
      amounts: reading.programs[i].funding
    }))
  };
}
function byCentre(rows, line) {
  const centres = /* @__PURE__ */ new Map();
  rows.forEach((r, i) => {
    centres.set(r.kscName, [...centres.get(r.kscName) ?? [], i]);
  });
  if (centres.size <= 1) {
    return rows.map((_, i) => line(i));
  }
  return [...centres].flatMap(([centre, at]) => [
    {
      id: `centre:${centre ?? at[0]}`,
      label: /* @__PURE__ */ jsx11("strong", { children: rows[at[0]].kscDisplayName ?? centre })
    },
    ...at.map(line)
  ]);
}
function rolloutLabel(type) {
  switch (type) {
    case "Rollout":
      return "Rollout";
    case "Reconditioning":
      return "Reconditioning";
    case "AirlaunchMount":
      return "Airlaunch prep";
    default:
      return type ?? "Operation";
  }
}
function Modifiers({ budget }) {
  const change = budget.day.upkeepModifiers;
  const sign = magnitudeOf10(change.value);
  return /* @__PURE__ */ jsx11(Section5, { gap: "related-dense", title: "MODIFIERS", children: /* @__PURE__ */ jsxs10(Grid, { minColWidth: "7rem", fit: true, align: "stretch", gap: "related-compact", children: [
    /* @__PURE__ */ jsx11(Stat, { label: "Upkeep before modifiers, day", children: /* @__PURE__ */ jsx11(
      Unit6,
      {
        value: unsignedOf(budget.day.upkeepBeforeModifiers)
      }
    ) }),
    /* @__PURE__ */ jsx11(
      Stat,
      {
        detail: sign === null || sign === 0 ? void 0 : sign > 0 ? "Saved" : "Added",
        label: "Leaders and strategies, day",
        children: /* @__PURE__ */ jsx11(Unit6, { value: unsignedOf(change) })
      }
    )
  ] }) });
}
function Reputation({ budget }) {
  return /* @__PURE__ */ jsx11(Section5, { gap: "related-dense", title: "REPUTATION AND SUBSIDY", children: /* @__PURE__ */ jsxs10(Grid, { minColWidth: "7rem", fit: true, align: "stretch", gap: "related-compact", children: [
    /* @__PURE__ */ jsx11(Stat, { label: "Subsidy", children: /* @__PURE__ */ jsx11(Unit6, { value: budget.subsidyPerDay }) }),
    /* @__PURE__ */ jsx11(Stat, { label: "Floor", children: /* @__PURE__ */ jsx11(Unit6, { value: budget.subsidyMinPerDay }) }),
    /* @__PURE__ */ jsx11(Stat, { label: "Cap", children: /* @__PURE__ */ jsx11(Unit6, { value: budget.subsidyMaxPerDay }) }),
    /* @__PURE__ */ jsx11(Stat, { label: "Cap reached at", children: /* @__PURE__ */ jsx11(Unit6, { value: budget.subsidyMaxRep }) }),
    /* @__PURE__ */ jsx11(Stat, { label: "Decay", children: /* @__PURE__ */ jsx11(Unit6, { value: budget.reputationDecayPerDay }) }),
    /* @__PURE__ */ jsx11(Stat, { label: "Decay, year", children: /* @__PURE__ */ jsx11(Unit6, { value: budget.reputationDecayPerYear }) })
  ] }) });
}
function UnlockCredit({
  budget,
  researchIdle
}) {
  const accrual = budget.day.unlockCredit;
  const idle = researchIdle && magnitudeOf10(accrual.value) === 0;
  return /* @__PURE__ */ jsx11(Section5, { gap: "related-dense", title: "UNLOCK CREDIT", children: /* @__PURE__ */ jsxs10(Grid, { minColWidth: "7rem", fit: true, align: "stretch", gap: "related-compact", children: [
    /* @__PURE__ */ jsx11(Stat, { label: "Balance", children: /* @__PURE__ */ jsx11(Unit6, { value: budget.unlockCreditBalance }) }),
    /* @__PURE__ */ jsx11(
      Stat,
      {
        detail: idle ? "research queue idle" : void 0,
        label: "Accrual, day",
        children: /* @__PURE__ */ jsx11(Unit6, { value: accrual })
      }
    )
  ] }) });
}
function Forecast({ budget }) {
  const samples = latest(budget)?.forecast ?? [];
  const years = samples.flatMap((sample, i) => {
    const horizon = magnitudeOf10(sample.horizon);
    if (horizon === null) return [];
    const year = horizon / JULIAN_YEAR;
    if (Math.abs(year - Math.round(year)) > 1e-6) return [];
    return [{ year: Math.round(year), change: budget.forecast[i].fundsDelta }];
  });
  const columns = [
    {
      key: "horizon",
      header: "Years ahead",
      rowHeader: true,
      render: (p) => /* @__PURE__ */ jsx11(Unit6, { value: value6("count", p.year) })
    },
    {
      key: "change",
      header: "Funds change",
      align: "end",
      render: (p) => /* @__PURE__ */ jsx11(Signed, { amount: p.change })
    }
  ];
  return /* @__PURE__ */ jsx11(Section5, { gap: "related-dense", title: "FORECAST", children: /* @__PURE__ */ jsx11(
    DataTable,
    {
      caption: "RP-1 funds forecast",
      columns,
      empty: /* @__PURE__ */ jsx11(EmptyState2, { children: "RP-1 would not forecast" }),
      rowKey: (p) => String(p.year),
      rows: years
    }
  ) });
}
var LEDGER_IN = [
  { key: "programFunds", label: "Program funds" },
  { key: "subsidyPaidOut", label: "Subsidy paid out" },
  { key: "vesselRecovery", label: "Vessel recovery" },
  { key: "otherFundsEarned", label: "Other funds earned" },
  { key: "repFromPrograms", label: "Reputation from Programs" }
];
var LEDGER_OUT = [
  { key: "salaryEngineers", label: "Salary, engineers" },
  { key: "salaryResearchers", label: "Salary, researchers" },
  { key: "salaryCrew", label: "Salary, crew" },
  { key: "facilityMaintenance", label: "Facility maintenance" },
  { key: "lcMaintenance", label: "LC maintenance" },
  { key: "trainingFees", label: "Training" },
  { key: "maintenanceFees", label: "Maintenance, net of subsidy" },
  { key: "launchFees", label: "Launch fees" },
  { key: "vesselPurchase", label: "Vessel purchase" },
  { key: "toolingFees", label: "Tooling" },
  { key: "entryCosts", label: "Entry costs" },
  { key: "constructionFees", label: "Construction" },
  { key: "hiringEngineers", label: "Hiring engineers" },
  { key: "hiringResearchers", label: "Hiring researchers" },
  { key: "otherFees", label: "Other fees" },
  { key: "spentUnlockCredit", label: "Unlock Credit spent, in tooling and entry costs" }
];
var LEDGER_CLOSE = [
  { key: "fundsAtClose", label: "Funds" },
  { key: "unlockCreditAtClose", label: "Unlock Credit" },
  { key: "subsidySize", label: "Subsidy size" },
  { key: "scienceAtClose", label: "Science" },
  { key: "scienceEarnedAtClose", label: "Science earned, career" },
  { key: "engineersAtClose", label: "Engineers" },
  { key: "researchersAtClose", label: "Researchers" },
  { key: "confidenceAtClose", label: "Confidence" },
  { key: "reputationAtClose", label: "Reputation" }
];
function CareerLog({
  ledger,
  wide
}) {
  const [all, setAll] = useState4(false);
  const log = latest(ledger);
  const months = (log?.periods ?? []).map((p, at) => ({
    at,
    startUt: magnitudeOf10(p.startUt),
    open: p.open === true
  })).reverse();
  const shown = all ? months : months.slice(0, RECENT_MONTHS);
  const figure = (m, key) => ledger.periods[m.at][key];
  const allColumns = [
    {
      key: "month",
      header: "Month from",
      rowHeader: true,
      render: (m) => /* @__PURE__ */ jsxs10(Fragment6, { children: [
        /* @__PURE__ */ jsx11(MissionDate5, { value: ledger.periods[m.at].startUt }),
        m.open && /* @__PURE__ */ jsxs10(Fragment6, { children: [
          " ",
          /* @__PURE__ */ jsx11(Badge4, { tone: "info", children: "SO FAR" })
        ] })
      ] })
    },
    {
      key: "programs",
      header: "Program funds",
      align: "end",
      render: (m) => /* @__PURE__ */ jsx11(Unit6, { value: figure(m, "programFunds") })
    },
    {
      key: "maintenance",
      header: "Maintenance",
      align: "end",
      render: (m) => /* @__PURE__ */ jsx11(Unit6, { value: figure(m, "maintenanceFees") })
    },
    {
      key: "funds",
      header: "Funds at close",
      align: "end",
      render: (m) => /* @__PURE__ */ jsx11(Unit6, { value: figure(m, "fundsAtClose") })
    }
  ];
  const columns = wide ? allColumns : allColumns.filter((c) => c.key === "month" || c.key === "funds");
  const empty = log === void 0 ? ledger.state === "held" ? "RP-1 had sent no career log when the link dropped" : "RP-1 has not sent its career log" : log.enabled === false ? "RP-1 is not keeping a career log in this save" : "RP-1 has logged no months yet";
  return /* @__PURE__ */ jsxs10(Section5, { gap: "related-dense", title: "CAREER LOG", children: [
    months.length > RECENT_MONTHS && /* @__PURE__ */ jsx11(Cluster5, { gap: "related-dense", justify: "start", children: /* @__PURE__ */ jsxs10(ToggleButton2, { pressed: all, onClick: () => setAll(!all), size: "sm", children: [
      "All ",
      months.length,
      " months"
    ] }) }),
    /* @__PURE__ */ jsx11(
      DataTable,
      {
        caption: "RP-1 career log by month",
        columns,
        empty: /* @__PURE__ */ jsx11(EmptyState2, { children: empty }),
        rowDetail: (m) => /* @__PURE__ */ jsx11(MonthDetail, { ledger, month: m }),
        rowKey: (m) => String(m.startUt ?? `undated-${m.at}`),
        rows: shown
      }
    )
  ] });
}
function MonthDetail({
  ledger,
  month
}) {
  const period = ledger.periods[month.at];
  const columns = [
    {
      key: "line",
      header: /* @__PURE__ */ jsx11(VisuallyHidden, { children: "Line" }),
      rowHeader: true,
      render: (line) => line.label
    },
    {
      key: "amount",
      header: /* @__PURE__ */ jsx11(VisuallyHidden, { children: "Amount" }),
      align: "end",
      render: (line) => /* @__PURE__ */ jsx11(Unit6, { value: period[line.key] })
    }
  ];
  const sections = [
    { id: "in", title: "In", rows: [...LEDGER_IN] },
    { id: "out", title: "Out", rows: [...LEDGER_OUT] },
    ...month.open ? [] : [{ id: "close", title: "Closed on", rows: [...LEDGER_CLOSE] }]
  ];
  return /* @__PURE__ */ jsx11(
    Disclosure,
    {
      asButton: true,
      chevron: false,
      label: month.open ? "The month so far" : "Every line",
      variant: "inline",
      children: /* @__PURE__ */ jsx11(
        DataTable,
        {
          caption: "RP-1 career log, one month",
          columns,
          rowKey: (line) => line.key,
          sections
        }
      )
    }
  );
}
function Signed({ amount }) {
  const raw = isValue(amount) ? amount : amount?.value;
  const sign = magnitudeOf10(raw);
  const shown = /* @__PURE__ */ jsx11(Unit6, { value: unsignedOf(amount) });
  if (sign === null || sign === 0) return shown;
  if (sign < 0) return /* @__PURE__ */ jsxs10(Fragment6, { children: [
    "(",
    shown,
    ")"
  ] });
  return /* @__PURE__ */ jsxs10(Fragment6, { children: [
    "+",
    shown
  ] });
}
function unsignedOf(amount) {
  if (amount === null || amount === void 0) return amount;
  if (isValue(amount)) return amount.abs();
  return combineReadings([amount], (v) => v.abs());
}
function unusedSubsidy(period) {
  return combineReadings(
    [
      period.facilities,
      period.integrationTeams,
      period.researchTeams,
      period.astronauts,
      period.subsidy
    ],
    (...rows) => value6(
      "funds",
      Math.max(
        0,
        rows.reduce((sum, row) => sum + row.magnitude, 0)
      )
    )
  );
}
function periodLabel(period) {
  return PERIODS.find((p) => p.id === period)?.label ?? period;
}
function count(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
function namesById(rows, key, label3 = "name") {
  return new Map(
    (rows ?? []).flatMap((row) => {
      const id = row[key];
      const name = row[label3];
      return typeof id === "string" && typeof name === "string" ? [[id, name]] : [];
    })
  );
}
registerAugment7({
  id: "rp1-finances",
  augments: "administration-building.screen-body",
  component: Finances,
  channels: [
    "rp1.available",
    "rp1.budget",
    "rp1.budgetBreakdown",
    "rp1.careerLedger",
    "rp1.training",
    "rp1.research"
  ],
  requires: "rp1",
  owner: RP1
});

// src/LeaderDetail/index.tsx
import {
  registerAugment as registerAugment8,
  useCommand as useCommand5,
  useTelemetry as useTelemetry9
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge5,
  Cluster as Cluster6,
  CommandButton as CommandButton5,
  EmptyState as EmptyState3,
  FilterRegion,
  Grid as Grid2,
  MissionDate as MissionDate6,
  magnitudeOf as magnitudeOf11,
  NULL_DISPLAY as NULL_DISPLAY3,
  Readout as Readout2,
  ReadoutCaption as ReadoutCaption3,
  Row as Row2,
  RowName as RowName2,
  Section as Section6,
  SectionTitle as SectionTitle4,
  SelectableRow as SelectableRow2,
  Stack as Stack6,
  SubjectHeading as SubjectHeading2,
  Text as Text7,
  Unit as Unit7,
  useRowFilter
} from "@ksp-gonogo/ui-kit";
import { useState as useState5 } from "react";
import { Fragment as Fragment7, jsx as jsx12, jsxs as jsxs11 } from "react/jsx-runtime";
var RP1_LEADER_APPOINT_COMMAND = "rp1.leader.appoint";
var DISMISS_COMMAND = "career.strategy.deactivate";
function LeaderDetail({ screenId }) {
  const available = current(useTelemetry9("rp1.available"));
  const leaders = current(useTelemetry9("rp1.leaders"));
  const careerReading = useTelemetry9("career.status");
  const career = current(careerReading);
  const [picked, setPicked] = useState5(null);
  const appoint = useCommand5(RP1_LEADER_APPOINT_COMMAND);
  const dismiss = useCommand5(DISMISS_COMMAND);
  const rows = leaders ?? [];
  const chosen = choose(rows, picked ?? "");
  if (screenId !== LEADERS_SCREEN_ID) {
    return null;
  }
  if (available !== true) {
    return null;
  }
  const strategies = career?.strategies?.all ?? [];
  const entry = strategies.find((s) => s.id === chosen?.strategyId);
  return /* @__PURE__ */ jsxs11(Section6, { gap: "related-comfortable", children: [
    /* @__PURE__ */ jsx12(SectionTitle4, { children: "LEADER DETAIL" }),
    /* @__PURE__ */ jsxs11(Stack6, { gap: "caption", children: [
      /* @__PURE__ */ jsx12(ReadoutCaption3, { children: "Reputation" }),
      /* @__PURE__ */ jsx12(Readout2, { children: /* @__PURE__ */ jsx12(Unit7, { value: careerReading.balances.reputation }) })
    ] }),
    chosen === void 0 ? /* @__PURE__ */ jsx12(EmptyState3, { children: "RP-1 has not sent its leader roster" }) : /* @__PURE__ */ jsxs11(
      Grid2,
      {
        cols: MASTER_DETAIL_COLUMNS,
        gap: "related-comfortable",
        align: "start",
        children: [
          /* @__PURE__ */ jsx12(LeaderCatalogue, { chosen, leaders: rows, onPick: setPicked }),
          /* @__PURE__ */ jsx12(
            ChosenLeader,
            {
              appoint,
              dismiss,
              entry,
              leader: chosen
            }
          )
        ]
      }
    )
  ] });
}
var MASTER_DETAIL_COLUMNS = "repeat(auto-fit, minmax(min(15rem, 100%), 1fr))";
var CATALOGUE_SCROLL = { maxHeight: "16rem", overflowY: "auto" };
var LIST_STYLE2 = { listStyle: "none", margin: 0, padding: 0 };
function standingOf(leader) {
  if (leader.active === true) return "serving";
  if (leader.canAppoint === true) return "offered";
  if (leader.rehireFromUt != null) return "cooldown";
  return "locked";
}
var STANDING_ORDER = {
  serving: 0,
  offered: 1,
  cooldown: 2,
  locked: 3
};
var STANDING_TONE = {
  serving: "info",
  offered: "go",
  cooldown: "caution",
  locked: "caution"
};
function ordered(leaders) {
  return [...leaders].sort(
    (a, b) => STANDING_ORDER[standingOf(a)] - STANDING_ORDER[standingOf(b)]
  );
}
function choose(rows, wanted) {
  const named = rows.find((l) => l.strategyId === wanted && wanted !== "");
  return named ?? ordered(rows)[0];
}
function label(leader) {
  return leader.title ?? leader.strategyId ?? NULL_DISPLAY3;
}
function StandingBadge({ leader }) {
  const standing = standingOf(leader);
  return /* @__PURE__ */ jsx12(Badge5, { tone: STANDING_TONE[standing], children: standing.toUpperCase() });
}
function LeaderCatalogue({
  chosen,
  leaders,
  onPick
}) {
  const filter = useRowFilter({
    label: "Filter leaders",
    placeholder: "Name or standing..."
  });
  const shown = ordered(leaders).filter(
    (leader) => filter.matches(`${label(leader)} ${standingOf(leader)}`)
  );
  return /* @__PURE__ */ jsxs11(Section6, { gap: "caption", children: [
    /* @__PURE__ */ jsx12(SectionTitle4, { children: "ROSTER" }),
    /* @__PURE__ */ jsx12(FilterRegion, { filter, children: shown.length === 0 ? /* @__PURE__ */ jsx12(EmptyState3, { children: "No leader matches the filter" }) : /* @__PURE__ */ jsx12(
      Stack6,
      {
        "aria-label": "Leader roster",
        gap: "caption",
        role: "group",
        style: CATALOGUE_SCROLL,
        children: shown.map((leader) => /* @__PURE__ */ jsx12(
          SelectableRow2,
          {
            onClick: () => onPick(leader.strategyId ?? ""),
            selected: leader.strategyId === chosen.strategyId,
            children: /* @__PURE__ */ jsx12(SubjectHeading2, { status: /* @__PURE__ */ jsx12(StandingBadge, { leader }), children: /* @__PURE__ */ jsx12(Text7, { size: "xs", children: label(leader) }) })
          },
          leader.strategyId ?? ""
        ))
      }
    ) })
  ] });
}
function ChosenLeader({
  appoint,
  dismiss,
  entry,
  leader
}) {
  const effects = effectLines(entry?.effect);
  return /* @__PURE__ */ jsxs11(Stack6, { gap: "related-comfortable", children: [
    /* @__PURE__ */ jsx12(SubjectHeading2, { status: /* @__PURE__ */ jsx12(StandingBadge, { leader }), children: /* @__PURE__ */ jsx12(Text7, { weight: "semibold", children: label(leader) }) }),
    leader.active === true ? /* @__PURE__ */ jsx12(DismissControl, { entry, handle: dismiss, leader }) : /* @__PURE__ */ jsx12(AppointControl, { handle: appoint, leader }),
    effects.length > 0 && /* @__PURE__ */ jsxs11(Section6, { children: [
      /* @__PURE__ */ jsx12(SectionTitle4, { children: "EFFECTS" }),
      /* @__PURE__ */ jsx12(Stack6, { as: "ul", gap: "rows", style: LIST_STYLE2, children: effects.map((line) => /* @__PURE__ */ jsx12(Row2, { wrap: true, children: /* @__PURE__ */ jsx12(Text7, { children: line }) }, line)) })
    ] })
  ] });
}
function effectLines(raw) {
  if (raw == null) return [];
  return raw.replace(/<[^>]+>/g, "").split("\n").map((line) => line.trim()).filter((line) => line !== "" && !/^effects?:/i.test(line)).map((line) => line.replace(/^\*\s*/, ""));
}
function AppointControl({
  handle,
  leader
}) {
  const name = label(leader);
  const offered = leader.canAppoint === true;
  return /* @__PURE__ */ jsxs11(Section6, { children: [
    /* @__PURE__ */ jsx12(SectionTitle4, { children: "APPOINT" }),
    /* @__PURE__ */ jsxs11(Cluster6, { gap: "related-dense", justify: "start", wrap: true, children: [
      /* @__PURE__ */ jsx12(Text7, { size: "sm", level: "muted", children: /* @__PURE__ */ jsx12(SetupCost, { leader }) }),
      /* @__PURE__ */ jsx12(
        CommandButton5,
        {
          args: { strategyId: leader.strategyId ?? "" },
          "aria-label": offered ? `Appoint ${name}` : void 0,
          commandLabel: `Appoint ${name}`,
          confirmAriaLabel: `Confirm appointing ${name}`,
          confirmLabel: /* @__PURE__ */ jsx12(SetupCost, { leader, verb: true }),
          disabled: !offered,
          handle,
          label: "Appoint",
          size: "sm",
          title: offered ? void 0 : leader.appointBlockedReason ?? void 0
        }
      )
    ] }),
    /* @__PURE__ */ jsxs11(Stack6, { as: "ul", gap: "rows", style: LIST_STYLE2, children: [
      !offered && leader.appointBlockedReason != null && /* @__PURE__ */ jsxs11(Row2, { wrap: true, children: [
        /* @__PURE__ */ jsx12(RowName2, { children: "Not offered" }),
        /* @__PURE__ */ jsx12(Text7, { children: leader.appointBlockedReason })
      ] }),
      leader.rehireFromUt != null && /* @__PURE__ */ jsxs11(Row2, { wrap: true, children: [
        /* @__PURE__ */ jsx12(RowName2, { children: "Re-hire from" }),
        /* @__PURE__ */ jsx12(Text7, { children: /* @__PURE__ */ jsx12(MissionDate6, { value: leader.rehireFromUt }) })
      ] }),
      /* @__PURE__ */ jsxs11(Row2, { wrap: true, children: [
        /* @__PURE__ */ jsx12(RowName2, { children: "After dismissal" }),
        /* @__PURE__ */ jsx12(Text7, { children: /* @__PURE__ */ jsx12(AfterDismissal, { leader }) })
      ] })
    ] })
  ] });
}
function SetupCost({
  leader,
  verb = false
}) {
  const parts = [
    leader.setupFunds,
    leader.setupScience,
    leader.setupReputation,
    leader.setupConfidence
  ];
  if (parts.some((part) => part == null)) {
    return /* @__PURE__ */ jsxs11(Fragment7, { children: [
      NULL_DISPLAY3,
      " RP-1 did not send the setup cost"
    ] });
  }
  const charged = parts.filter((part) => (magnitudeOf11(part) ?? 0) !== 0);
  if (charged.length === 0) {
    return /* @__PURE__ */ jsx12(Fragment7, { children: verb ? "Appoint for no cost" : "No cost" });
  }
  return /* @__PURE__ */ jsxs11(Fragment7, { children: [
    verb ? "Spend " : "",
    charged.map((part, index) => /* @__PURE__ */ jsxs11("span", { children: [
      index > 0 && " + ",
      /* @__PURE__ */ jsx12(Unit7, { value: part })
    ] }, index))
  ] });
}
function AfterDismissal({ leader }) {
  if (leader.removeOnDeactivate === false) {
    return /* @__PURE__ */ jsx12(Fragment7, { children: "can be re-hired at once" });
  }
  const cooldown = magnitudeOf11(leader.reactivateCooldown);
  if (cooldown === null) return /* @__PURE__ */ jsx12(Fragment7, { children: NULL_DISPLAY3 });
  if (cooldown === 0) return /* @__PURE__ */ jsx12(Fragment7, { children: "cannot be hired again" });
  return /* @__PURE__ */ jsxs11(Fragment7, { children: [
    /* @__PURE__ */ jsx12(Unit7, { value: leader.reactivateCooldown }),
    " before re-hiring"
  ] });
}
function DismissControl({
  entry,
  handle,
  leader
}) {
  const name = label(leader);
  const blocked = entry?.canDeactivate === false;
  const costs = (magnitudeOf11(leader.deactivateReputation) ?? 0) > 0;
  return /* @__PURE__ */ jsxs11(Section6, { children: [
    /* @__PURE__ */ jsx12(SectionTitle4, { children: "DISMISS" }),
    /* @__PURE__ */ jsxs11(Cluster6, { gap: "related-dense", justify: "start", wrap: true, children: [
      /* @__PURE__ */ jsxs11(Text7, { size: "sm", level: "muted", children: [
        /* @__PURE__ */ jsx12(Unit7, { value: leader.deactivateReputation }),
        " reputation now, costing",
        " ",
        /* @__PURE__ */ jsx12(Unit7, { value: leader.dismissSubsidyLossPerDay }),
        " of subsidy"
      ] }),
      /* @__PURE__ */ jsx12(
        CommandButton5,
        {
          args: { strategyId: leader.strategyId ?? "" },
          "aria-label": blocked ? void 0 : `Dismiss ${name}`,
          commandLabel: `Dismiss ${name}`,
          confirmAriaLabel: `Confirm dismissing ${name}`,
          confirmLabel: /* @__PURE__ */ jsxs11(Fragment7, { children: [
            "Lose ",
            /* @__PURE__ */ jsx12(Unit7, { value: leader.deactivateReputation }),
            " reputation"
          ] }),
          disabled: blocked,
          handle,
          label: "Dismiss",
          size: "sm",
          title: blocked ? entry?.deactivateBlockedReason ?? void 0 : void 0
        }
      )
    ] }),
    /* @__PURE__ */ jsxs11(Stack6, { as: "ul", gap: "rows", style: LIST_STYLE2, children: [
      blocked && leader.canRemoveFromUt != null && /* @__PURE__ */ jsxs11(Row2, { wrap: true, children: [
        /* @__PURE__ */ jsx12(RowName2, { children: "Can dismiss" }),
        /* @__PURE__ */ jsx12(Text7, { children: /* @__PURE__ */ jsx12(MissionDate6, { value: leader.canRemoveFromUt }) })
      ] }),
      costs && leader.freeToRemoveFromUt != null && /* @__PURE__ */ jsxs11(Row2, { wrap: true, children: [
        /* @__PURE__ */ jsx12(RowName2, { children: "Free to dismiss" }),
        /* @__PURE__ */ jsx12(Text7, { children: /* @__PURE__ */ jsx12(MissionDate6, { value: leader.freeToRemoveFromUt }) })
      ] }),
      /* @__PURE__ */ jsxs11(Row2, { wrap: true, children: [
        /* @__PURE__ */ jsx12(RowName2, { children: "After dismissal" }),
        /* @__PURE__ */ jsx12(Text7, { children: /* @__PURE__ */ jsx12(AfterDismissal, { leader }) })
      ] })
    ] })
  ] });
}
registerAugment8({
  id: "rp1-leader-detail",
  augments: "administration-building.screen-body",
  component: LeaderDetail,
  channels: [
    "rp1.available",
    "rp1.leaders",
    /* Reputation, the currency a dismissal spends, and the effect lines and
       deactivation verdict core carries per strategy. */
    "career.status"
  ],
  requires: "rp1",
  owner: RP1
});

// src/KscComplexes/index.tsx
import {
  registerAugment as registerAugment9,
  useCommand as useCommand6,
  useTelemetry as useTelemetry10
} from "@ksp-gonogo/sitrep-sdk";
import {
  EmptyState as EmptyState4,
  magnitudeOf as magnitudeOf20,
  Row as Row10,
  RowName as RowName7,
  Section as Section7,
  SectionTitle as SectionTitle5,
  Stack as Stack14,
  Text as Text15,
  Unit as Unit15
} from "@ksp-gonogo/ui-kit";

// src/KscComplexes/Centre.tsx
import { value as value9 } from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge7,
  Cluster as Cluster8,
  Grid as Grid3,
  Inline as Inline4,
  magnitudeOf as magnitudeOf16,
  NULL_DISPLAY as NULL_DISPLAY7,
  Row as Row6,
  RowName as RowName4,
  Stack as Stack10,
  Text as Text11,
  Unit as Unit11
} from "@ksp-gonogo/ui-kit";

// src/KscComplexes/ComplexCard.tsx
import { value as value8 } from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge6,
  Card as Card4,
  Cluster as Cluster7,
  CommandButton as CommandButton8,
  Disclosure as Disclosure3,
  Inline as Inline3,
  Meter as Meter2,
  magnitudeOf as magnitudeOf15,
  NULL_DISPLAY as NULL_DISPLAY6,
  Row as Row5,
  RowName as RowName3,
  Stack as Stack9,
  Stepper,
  Text as Text10,
  Unit as Unit10
} from "@ksp-gonogo/ui-kit";
import { useState as useState8 } from "react";

// src/KscComplexes/Lifecycle.tsx
import {
  Button as Button2,
  CommandButton as CommandButton6,
  Inline as Inline2,
  magnitudeOf as magnitudeOf12,
  NULL_DISPLAY as NULL_DISPLAY4,
  Row as Row3,
  Stack as Stack7,
  Text as Text8,
  TextField,
  Unit as Unit8
} from "@ksp-gonogo/ui-kit";
import { useState as useState6 } from "react";
import { jsx as jsx13, jsxs as jsxs12 } from "react/jsx-runtime";
var RP1_COMPLEX_DISMANTLE_COMMAND = "rp1.complex.dismantle";
var RP1_PAD_DISMANTLE_COMMAND = "rp1.pad.dismantle";
var RP1_PAD_NEW_COMMAND = "rp1.pad.new";
var RP1_COMPLEX_RENAME_COMMAND = "rp1.complex.rename";
var RP1_PAD_RENAME_COMMAND = "rp1.pad.rename";
function DismantleControl({
  complex,
  name,
  handle
}) {
  const lcId = complex.lcId;
  if (lcId === void 0 || lcId === null) {
    return null;
  }
  if (complex.lcType === "Hangar") {
    return null;
  }
  return /* @__PURE__ */ jsx13(
    CommandButton6,
    {
      args: { lcId },
      "aria-label": `Dismantle ${name}`,
      commandLabel: `Dismantle ${name}`,
      confirmAriaLabel: `Confirm dismantling ${name}: removes the whole complex, its pads and its crew rating`,
      confirmLabel: "Warning: removes complex, pads and crew rating",
      confirmTone: "nogo",
      handle,
      label: "Dismantle",
      size: "sm",
      tone: "warn"
    }
  );
}
function PadDismantleControl({
  complex,
  pad,
  handle
}) {
  const lcId = complex.lcId;
  const padId = pad.padId;
  if (lcId === void 0 || lcId === null || padId === void 0 || padId === null) {
    return null;
  }
  const padName = pad.name ?? NULL_DISPLAY4;
  const operational = magnitudeOf12(complex.launchPadCount);
  const inService = pad.isOperational === true;
  const last = operational !== null && operational < 2;
  const blockedBecause = !inService ? `${padName} is not in service yet, so cancel its construction instead` : last ? `${padName} is the last working pad at this complex, and a complex must keep one` : null;
  return /* @__PURE__ */ jsx13(Inline2, { gap: "related-packed", children: /* @__PURE__ */ jsx13(
    CommandButton6,
    {
      args: { lcId, padId },
      "aria-label": blockedBecause ?? `Dismantle ${padName}, permanently`,
      commandLabel: `Dismantle ${padName}`,
      confirmAriaLabel: `Confirm dismantling ${padName}`,
      confirmLabel: "Confirm",
      confirmTone: "nogo",
      disabled: blockedBecause !== null,
      handle,
      label: "Dismantle",
      size: "sm",
      title: blockedBecause ?? void 0,
      tone: "warn"
    }
  ) });
}
function PadNewControl({
  complex,
  funds,
  handle,
  taken
}) {
  const [name, setName] = useState6("");
  const lcId = complex.lcId;
  const cost = magnitudeOf12(complex.newPadCost);
  if (lcId === void 0 || lcId === null || cost === null) {
    return null;
  }
  const trimmed = name.trim();
  const duplicate = taken.some(
    (existing) => existing.toLowerCase() === trimmed.toLowerCase()
  );
  const invalid = duplicate ? "a pad at this complex already has that name" : void 0;
  const short = funds !== null && funds < cost;
  return /* @__PURE__ */ jsxs12(Stack7, { gap: "caption", children: [
    /* @__PURE__ */ jsx13(
      TextField,
      {
        invalid,
        label: `New pad at ${complex.name ?? NULL_DISPLAY4}`,
        maxLength: 64,
        onChange: setName,
        placeholder: "pad name",
        value: name
      }
    ),
    /* @__PURE__ */ jsxs12(Row3, { as: "div", children: [
      /* @__PURE__ */ jsxs12(Text8, { size: "xs", tone: short ? "warn" : void 0, level: "muted", children: [
        /* @__PURE__ */ jsx13(Unit8, { value: complex.newPadCost }),
        short && " \xB7 more than the balance, so it builds slower"
      ] }),
      /* @__PURE__ */ jsx13(
        CommandButton6,
        {
          args: { lcId, name: trimmed },
          "aria-label": trimmed === "" ? "Name the pad before building it" : `Build ${trimmed} at ${complex.name ?? NULL_DISPLAY4}`,
          commandLabel: `Build ${trimmed} at ${complex.name ?? NULL_DISPLAY4}`,
          confirmAriaLabel: `Confirm building ${trimmed}, committing the career to its cost as it builds`,
          confirmLabel: "Confirm",
          disabled: trimmed === "" || duplicate,
          handle,
          label: "Build",
          size: "sm"
        }
      )
    ] })
  ] });
}
function RenameControl({
  args,
  currentName,
  handle,
  label: label3,
  onDone,
  open: controlled,
  taken
}) {
  const [ownOpen, setOwnOpen] = useState6(false);
  const [next, setNext] = useState6(currentName);
  const open = controlled === true || ownOpen;
  const close = () => {
    setOwnOpen(false);
    onDone?.();
  };
  if (!open) {
    return (
      // A small ghost Button, the kit's compact bordered control, which matches
      // the Dismantle, Build and Rush presses this sits among. It was a
      // TextButton: bare lowercase text with no chrome next to a row of bordered
      // buttons, which is the "why is the rename button a different form to the
      // other buttons?" the operator asked. Not a CommandButton, because opening
      // an editor dispatches nothing.
      /* @__PURE__ */ jsx13(
        Button2,
        {
          variant: "ghost",
          size: "sm",
          "aria-label": `Rename ${label3}`,
          onClick: () => {
            setNext(currentName);
            setOwnOpen(true);
          },
          type: "button",
          children: "Rename"
        }
      )
    );
  }
  const trimmed = next.trim();
  const duplicate = taken.some(
    (existing) => existing.toLowerCase() === trimmed.toLowerCase() && existing.toLowerCase() !== currentName.toLowerCase()
  );
  const unchanged = trimmed === currentName;
  return /* @__PURE__ */ jsxs12(Stack7, { gap: "caption", children: [
    /* @__PURE__ */ jsx13(
      TextField,
      {
        invalid: duplicate ? "that name is already in use here" : void 0,
        label: `New name for ${label3}`,
        maxLength: 64,
        onChange: setNext,
        value: next
      }
    ),
    /* @__PURE__ */ jsxs12(Inline2, { gap: "related-packed", children: [
      /* @__PURE__ */ jsx13(
        CommandButton6,
        {
          args: { ...args, name: trimmed },
          "aria-label": trimmed === "" ? `Give ${label3} a name` : unchanged ? `${label3} is already called that` : `Rename ${label3} to ${trimmed}`,
          commandLabel: `Rename ${label3} to ${trimmed}`,
          disabled: trimmed === "" || duplicate || unchanged,
          handle,
          label: "Rename",
          size: "sm"
        }
      ),
      /* @__PURE__ */ jsx13(
        Button2,
        {
          variant: "ghost",
          size: "sm",
          "aria-label": `Leave ${label3} named ${currentName}`,
          onClick: close,
          type: "button",
          children: "Cancel"
        }
      )
    ] })
  ] });
}
function PadRow({
  complex,
  dismantlePad,
  lcId,
  pad,
  renamePad,
  taken
}) {
  const [renaming, setRenaming] = useState6(false);
  const padName = pad.name ?? NULL_DISPLAY4;
  const canRename = pad.padId != null && lcId != null;
  if (renaming && canRename) {
    return /* @__PURE__ */ jsx13(Row3, { as: "li", children: /* @__PURE__ */ jsx13(
      RenameControl,
      {
        args: { lcId, padId: pad.padId },
        currentName: padName,
        handle: renamePad,
        label: padName,
        onDone: () => setRenaming(false),
        open: true,
        taken
      }
    ) });
  }
  return /* @__PURE__ */ jsxs12(Row3, { children: [
    /* @__PURE__ */ jsxs12(Text8, { size: "xs", children: [
      padName,
      " at level ",
      /* @__PURE__ */ jsx13(Unit8, { value: pad.level }),
      pad.isOperational === false && " \xB7 not in service"
    ] }),
    /* @__PURE__ */ jsxs12(Inline2, { gap: "related-packed", children: [
      canRename && /* @__PURE__ */ jsx13(
        Button2,
        {
          variant: "ghost",
          size: "sm",
          "aria-label": `Rename ${padName}`,
          onClick: () => setRenaming(true),
          type: "button",
          children: "Rename"
        }
      ),
      /* @__PURE__ */ jsx13(
        PadDismantleControl,
        {
          complex,
          handle: dismantlePad,
          pad
        }
      )
    ] })
  ] });
}
function PadRows({
  complex,
  pads,
  dismantlePad,
  funds,
  newPad,
  renamePad
}) {
  const lcId = complex.lcId;
  const taken = pads.map((pad) => pad.name).filter((padName) => padName != null);
  if (pads.length === 0) {
    return /* @__PURE__ */ jsxs12(Stack7, { gap: "caption", children: [
      /* @__PURE__ */ jsx13(Text8, { size: "xs", level: "muted", children: "no pads" }),
      /* @__PURE__ */ jsx13(
        PadNewControl,
        {
          complex,
          funds,
          handle: newPad,
          taken
        }
      )
    ] });
  }
  return /* @__PURE__ */ jsxs12(Stack7, { gap: "caption", children: [
    /* @__PURE__ */ jsxs12(Text8, { size: "xs", level: "muted", children: [
      "pads \xB7 ",
      /* @__PURE__ */ jsx13(Unit8, { value: complex.launchPadCount }),
      " operational"
    ] }),
    /* @__PURE__ */ jsx13(Stack7, { as: "ul", gap: "rows", style: LIST_STYLE3, children: pads.map((pad, index) => /* @__PURE__ */ jsx13(
      PadRow,
      {
        complex,
        dismantlePad,
        lcId,
        pad,
        renamePad,
        taken
      },
      pad.padId ?? pad.name ?? String(index)
    )) }),
    /* @__PURE__ */ jsx13(
      PadNewControl,
      {
        complex,
        funds,
        handle: newPad,
        taken
      }
    )
  ] });
}
var LIST_STYLE3 = { listStyle: "none", margin: 0, padding: 0 };

// src/KscComplexes/Modify.tsx
import { value as value7 } from "@ksp-gonogo/sitrep-sdk";
import {
  CommandButton as CommandButton7,
  Disclosure as Disclosure2,
  magnitudeOf as magnitudeOf14,
  NULL_DISPLAY as NULL_DISPLAY5,
  Row as Row4,
  Stack as Stack8,
  Switch,
  Text as Text9,
  Unit as Unit9,
  UnitInput as UnitInput3
} from "@ksp-gonogo/ui-kit";
import { useState as useState7 } from "react";

// src/KscComplexes/lcCost.ts
import { magnitudeOf as magnitudeOf13 } from "@ksp-gonogo/ui-kit";
function quoteNewComplex(spec, pricing) {
  const resources = quoteResources(spec, pricing);
  if (resources === null) {
    return null;
  }
  const stats = costStats(spec);
  if (stats === null) {
    return null;
  }
  return {
    integration: stats.integration,
    pad: stats.pad,
    resources,
    total: stats.pad + stats.integration + resources
  };
}
function costStats(spec) {
  const x = spec.sizeMaxWidth;
  let y = spec.sizeMaxHeight;
  const z = spec.sizeMaxDepth;
  if (![spec.massMax, x, y, z].every((n) => Number.isFinite(n) && n >= 0)) {
    return null;
  }
  let pad = 0;
  if (spec.isHangar) {
    y *= 5;
  } else {
    const m = spec.massMax;
    pad = Math.max(0, m ** 0.65 * 2e3 + Math.max(m - 350, 0) ** 1.5 * 2 - 2500) + 500;
  }
  let integration = Math.max(1e3, (x * x + y * y + z * z) * 25);
  if (spec.humanRated) {
    pad *= 1.5;
    integration *= 2;
  }
  pad *= 0.5;
  integration *= 0.5;
  return { integration, pad };
}
var MASS_CHANGE_COST_FLOOR = 1e3;
function quoteModifyComplex(next, current2, pricing) {
  if (!sameResources(next.resources, current2.resources)) {
    return null;
  }
  const newCost = costStats(next);
  const currentCost = costStats(current2);
  if (newCost === null || currentCost === null) {
    return null;
  }
  if (!Number.isFinite(current2.massOrig) || !Number.isFinite(current2.launchPadCount)) {
    return null;
  }
  let padHalf = 0;
  if (!next.isHangar) {
    padHalf = newCost.pad > currentCost.pad ? newCost.pad - currentCost.pad : (currentCost.pad - newCost.pad) * 0.5;
    const pads = current2.launchPadCount;
    if (pads > 1) {
      const mult = magnitudeOf13(pricing?.additionalPadCostMult);
      if (mult === null) {
        return null;
      }
      padHalf *= 1 + (pads - 1) * mult;
    }
    if (!approximately(current2.massMax, next.massMax) && padHalf < MASS_CHANGE_COST_FLOOR) {
      padHalf = MASS_CHANGE_COST_FLOOR;
    }
  }
  const metreRate = next.isHangar ? 500 : lerpUnclamped(
    100,
    1e3,
    inverseLerp(10, 55, clamp(current2.massOrig, 10, 50))
  );
  let integrationHalf = Math.abs(newCost.integration - currentCost.integration) + axisDelta(next.sizeMaxHeight, current2.sizeMaxHeight) * metreRate + axisDelta(next.sizeMaxWidth, current2.sizeMaxWidth) * metreRate * 0.5 + axisDelta(next.sizeMaxDepth, current2.sizeMaxDepth) * metreRate * 0.5;
  const isDowngrade = newCost.integration < currentCost.integration;
  if (isDowngrade) {
    integrationHalf *= 0.5;
  } else if (newCost.integration > currentCost.integration && integrationHalf > newCost.integration) {
    integrationHalf = newCost.integration;
  }
  return { isDowngrade, total: padHalf + integrationHalf };
}
function sameResources(a, b) {
  if (a.size !== b.size) {
    return false;
  }
  for (const [name, amount] of a) {
    if (b.get(name) !== amount) {
      return false;
    }
  }
  return true;
}
function approximately(a, b) {
  return Math.abs(b - a) < Math.max(1e-6 * Math.max(Math.abs(a), Math.abs(b)), FLOAT_EPSILON * 8);
}
var FLOAT_EPSILON = 1401298464324817e-60;
function lerpUnclamped(a, b, t) {
  return a + (b - a) * t;
}
function inverseLerp(a, b, value18) {
  return a === b ? 0 : (value18 - a) / (b - a);
}
function clamp(value18, min, max) {
  return value18 < min ? min : value18 > max ? max : value18;
}
function axisDelta(a, b) {
  return Math.abs(Math.fround(a) - Math.fround(b));
}
function quoteResources(spec, pricing) {
  if (spec.resources.size === 0) {
    return 0;
  }
  const offered = pricing?.resources;
  if (offered == null) {
    return null;
  }
  if (spec.isHangar) {
    return null;
  }
  let total = 0;
  for (const [name, amount] of spec.resources) {
    const entry = offered.find((r) => r.name === name);
    const magnitude = entry?.padCostPerUnit?.magnitude;
    if (magnitude == null) {
      return null;
    }
    total += Math.ceil(amount) * magnitude;
  }
  return total;
}

// src/KscComplexes/Modify.tsx
import { Fragment as Fragment8, jsx as jsx14, jsxs as jsxs13 } from "react/jsx-runtime";
var RP1_COMPLEX_MODIFY_COMMAND = "rp1.complex.modify";
function ModifyControl({
  complex,
  funds,
  handle,
  pricing
}) {
  const lcId = complex.lcId;
  const capacities = complex.resourceCapacities;
  if (lcId == null || capacities == null || complex.isOperational !== true) {
    return null;
  }
  return /* @__PURE__ */ jsx14(
    ModifyForm,
    {
      capacities,
      complex,
      funds,
      handle,
      lcId,
      pricing
    }
  );
}
function ModifyForm({
  capacities,
  complex,
  funds,
  handle,
  lcId,
  pricing
}) {
  const isHangar = complex.lcType === "Hangar";
  const name = complex.name ?? NULL_DISPLAY5;
  const currentMass = magnitudeOf14(complex.massMax);
  const massOrig = magnitudeOf14(complex.massOrig);
  const currentWidth = magnitudeOf14(complex.sizeMaxWidth);
  const currentHeight = magnitudeOf14(complex.sizeMaxHeight);
  const currentDepth = magnitudeOf14(complex.sizeMaxDepth);
  const launchPadCount = magnitudeOf14(complex.launchPadCount);
  const [massMax, setMassMax] = useState7(
    currentMass === null ? null : value7("t", currentMass)
  );
  const [width, setWidth] = useState7(
    currentWidth === null ? null : value7("m", currentWidth)
  );
  const [height, setHeight] = useState7(
    currentHeight === null ? null : value7("m", currentHeight)
  );
  const [depth, setDepth] = useState7(
    currentDepth === null ? null : value7("m", currentDepth)
  );
  const [humanRated, setHumanRated] = useState7(complex.humanRated === true);
  const [reassign, setReassign] = useState7(false);
  const wantedMass = magnitudeOf14(massMax);
  const wantedWidth = magnitudeOf14(width);
  const wantedHeight = magnitudeOf14(height);
  const wantedDepth = magnitudeOf14(depth);
  const wantedSpecMass = isHangar ? currentMass : wantedMass;
  const nextSpec = wantedSpecMass === null || wantedWidth === null || wantedHeight === null || wantedDepth === null ? null : {
    humanRated: isHangar || humanRated,
    isHangar,
    massMax: wantedSpecMass,
    resources: new Map(Object.entries(capacities)),
    sizeMaxDepth: wantedDepth,
    sizeMaxHeight: wantedHeight,
    sizeMaxWidth: wantedWidth
  };
  const current2 = currentMass === null || massOrig === null || currentWidth === null || currentHeight === null || currentDepth === null || launchPadCount === null ? null : {
    humanRated: complex.humanRated === true,
    isHangar,
    launchPadCount,
    massMax: currentMass,
    massOrig,
    resources: new Map(Object.entries(capacities)),
    sizeMaxDepth: currentDepth,
    sizeMaxHeight: currentHeight,
    sizeMaxWidth: currentWidth
  };
  const quote = nextSpec === null || current2 === null ? null : quoteModifyComplex(nextSpec, current2, pricing);
  const engineers = magnitudeOf14(complex.engineers);
  const short = funds !== null && quote !== null && funds < quote.total;
  const ceiling = massOrig === null ? null : Math.max(3, Math.floor(massOrig * 2));
  const floor = massOrig === null ? null : Math.max(1, Math.ceil(massOrig * 0.5));
  const overCeiling = !isHangar && ceiling !== null && wantedMass !== null && wantedMass > ceiling;
  const underFloor = !isHangar && floor !== null && wantedMass !== null && wantedMass < floor;
  const sized = nextSpec !== null && [
    nextSpec.sizeMaxWidth,
    nextSpec.sizeMaxHeight,
    nextSpec.sizeMaxDepth
  ].every((axis) => axis > 0);
  const blocked = quote === null || overCeiling || underFloor || !sized || !isHangar && (wantedMass === null || wantedMass <= 0);
  const confirm = engineers === null ? `Confirm renovating ${name}, which takes its engineers off for the whole build` : `Confirm renovating ${name}, which takes its ${engineers} engineers off for the whole build`;
  return /* @__PURE__ */ jsx14(
    Disclosure2,
    {
      "aria-label": `Renovate ${name}`,
      asButton: true,
      buttonSize: "sm",
      chevron: false,
      label: (open) => open ? "Hide renovation" : "Renovate",
      panelHeight: "auto",
      variant: "inline",
      children: /* @__PURE__ */ jsxs13(Stack8, { gap: "related-dense", children: [
        !isHangar && /* @__PURE__ */ jsxs13(Fragment8, { children: [
          /* @__PURE__ */ jsx14(
            UnitInput3,
            {
              label: "Tonnage limit",
              onChange: setMassMax,
              unit: "t",
              value: massMax
            }
          ),
          overCeiling && /* @__PURE__ */ jsxs13(Text9, { size: "xs", tone: "warn", children: [
            "Cannot upgrade tonnage above the limit of",
            " ",
            /* @__PURE__ */ jsx14(Unit9, { value: value7("t", ceiling ?? 0) })
          ] }),
          underFloor && /* @__PURE__ */ jsxs13(Text9, { size: "xs", tone: "warn", children: [
            "Cannot downgrade tonnage below the limit of",
            " ",
            /* @__PURE__ */ jsx14(Unit9, { value: value7("t", floor ?? 0) })
          ] })
        ] }),
        /* @__PURE__ */ jsx14(UnitInput3, { label: "Width", onChange: setWidth, unit: "m", value: width }),
        /* @__PURE__ */ jsx14(
          UnitInput3,
          {
            label: "Height",
            onChange: setHeight,
            unit: "m",
            value: height
          }
        ),
        /* @__PURE__ */ jsx14(UnitInput3, { label: "Length", onChange: setDepth, unit: "m", value: depth }),
        !isHangar && /* @__PURE__ */ jsx14(
          Switch,
          {
            checked: humanRated,
            label: "Human-rated",
            onChange: setHumanRated
          }
        ),
        /* @__PURE__ */ jsx14(Text9, { size: "xs", level: "muted", children: engineers === null ? /* @__PURE__ */ jsxs13(Fragment8, { children: [
          NULL_DISPLAY5,
          " RP-1 has not said how many engineers this complex holds, and all of them are unassigned for the whole renovation"
        ] }) : /* @__PURE__ */ jsxs13(Fragment8, { children: [
          engineers,
          " engineers are unassigned for the whole renovation"
        ] }) }),
        /* @__PURE__ */ jsx14(
          Switch,
          {
            checked: reassign,
            label: "Reassign them when it is done",
            onChange: setReassign
          }
        ),
        quote?.isDowngrade === true && /* @__PURE__ */ jsx14(Text9, { size: "xs", tone: "warn", children: "a reduction, and RP-1 charges half the difference for one: this is a bill, not a refund" }),
        /* @__PURE__ */ jsxs13(Row4, { as: "div", children: [
          /* @__PURE__ */ jsx14(Text9, { size: "xs", tone: short ? "warn" : void 0, level: "muted", children: quote === null ? "no price: RP-1 has not said what this would cost" : /* @__PURE__ */ jsxs13(Fragment8, { children: [
            /* @__PURE__ */ jsx14(Unit9, { value: value7("funds", quote.total), decimals: 0 }),
            short && " \xB7 more than the balance, so it builds slower"
          ] }) }),
          /* @__PURE__ */ jsx14(
            CommandButton7,
            {
              args: renovationArgs({
                capacities,
                humanRated,
                isHangar,
                lcId,
                reassign,
                spec: nextSpec,
                wantedMass
              }),
              "aria-label": `Queue the renovation of ${name}`,
              commandLabel: `Queue the renovation of ${name}`,
              confirmAriaLabel: confirm,
              confirmLabel: "Confirm",
              disabled: blocked,
              handle,
              label: "Renovate",
              size: "sm"
            }
          )
        ] })
      ] })
    }
  );
}
function renovationArgs({
  capacities,
  humanRated,
  isHangar,
  lcId,
  reassign,
  spec,
  wantedMass
}) {
  if (spec === null || !isHangar && wantedMass === null) {
    return void 0;
  }
  const size = {
    sizeMaxDepth: spec.sizeMaxDepth,
    sizeMaxHeight: spec.sizeMaxHeight,
    sizeMaxWidth: spec.sizeMaxWidth
  };
  const shared = {
    assignEngineersOnComplete: reassign,
    lcId,
    resources: { ...capacities },
    size
  };
  return isHangar ? shared : { ...shared, humanRated, massMax: wantedMass };
}

// src/KscComplexes/ComplexCard.tsx
import { Fragment as Fragment9, jsx as jsx15, jsxs as jsxs14 } from "react/jsx-runtime";
function ComplexCard({
  complex,
  centreName,
  complexNames,
  unassigned,
  pads,
  terms,
  assign,
  rush,
  dismantle,
  dismantlePad,
  funds,
  modify,
  newPad,
  pricing,
  renameComplex,
  renamePad
}) {
  const name = complex.name ?? NULL_DISPLAY6;
  const engineers = magnitudeOf15(complex.engineers);
  const maxEngineers = magnitudeOf15(complex.maxEngineers);
  const operational = complex.isOperational === true;
  const rushing = complex.isRushing === true;
  const unstaffed2 = operational && engineers === 0;
  return /* @__PURE__ */ jsx15(Card4, { tone: unstaffed2 ? "warn" : operational ? "go" : void 0, children: /* @__PURE__ */ jsxs14(Stack9, { gap: "section-compact", children: [
    /* @__PURE__ */ jsxs14(Cluster7, { gap: "related-packed", wrap: true, children: [
      /* @__PURE__ */ jsx15(Text10, { weight: "semibold", children: name }),
      /* @__PURE__ */ jsxs14(Inline3, { gap: "related-packed", children: [
        complex.humanRated === true && /* @__PURE__ */ jsx15(Badge6, { tone: "info", children: "HUMAN-RATED" }),
        rushing && /* @__PURE__ */ jsx15(Badge6, { tone: "caution", children: "RUSHING" }),
        unstaffed2 && /* @__PURE__ */ jsx15(Badge6, { tone: "caution", children: "NOBODY ASSIGNED" }),
        operational ? null : /* @__PURE__ */ jsx15(Badge6, { tone: "offline", children: "NOT YET BUILT" })
      ] })
    ] }),
    /* @__PURE__ */ jsx15(Crew, { complex, complexNames, name }),
    operational && /* @__PURE__ */ jsx15(
      AssignControl,
      {
        centreName,
        complex,
        engineers,
        handle: assign,
        maxEngineers,
        name,
        unassigned
      }
    ),
    /* @__PURE__ */ jsx15(
      Disclosure3,
      {
        "aria-label": `Detail for ${name}`,
        asButton: true,
        buttonSize: "sm",
        chevron: false,
        label: (open) => open ? "Hide detail" : "Show detail",
        panelHeight: "auto",
        variant: "inline",
        children: /* @__PURE__ */ jsxs14(Stack9, { gap: "related-dense", children: [
          /* @__PURE__ */ jsx15(Envelope, { complex }),
          /* @__PURE__ */ jsx15(Costs, { complex }),
          complex.lcId != null && /* @__PURE__ */ jsx15(Inline3, { gap: "related-packed", children: /* @__PURE__ */ jsx15(
            RenameControl,
            {
              args: { lcId: complex.lcId },
              currentName: name,
              handle: renameComplex,
              label: name,
              taken: [...complexNames.values()]
            }
          ) }),
          /* @__PURE__ */ jsx15(
            PadRows,
            {
              complex,
              dismantlePad,
              funds,
              newPad,
              pads,
              renamePad
            }
          ),
          operational && /* The terms and the press together, which is the whole of this
             fix: the payroll a rush commits the career to used to be drawn
             only once one was already running, three sections above the
             control that starts it. */
          /* @__PURE__ */ jsxs14(Stack9, { gap: "caption", children: [
            /* @__PURE__ */ jsx15(RushTerms, { complex, terms }),
            /* @__PURE__ */ jsx15(Inline3, { gap: "related-packed", children: /* @__PURE__ */ jsx15(
              RushControl,
              {
                complex,
                handle: rush,
                name,
                terms
              }
            ) })
          ] }),
          /* @__PURE__ */ jsx15(
            ModifyControl,
            {
              complex,
              funds,
              handle: modify,
              pricing
            }
          ),
          /* @__PURE__ */ jsx15(
            DismantleControl,
            {
              complex,
              handle: dismantle,
              name
            }
          )
        ] })
      }
    )
  ] }) });
}
function Crew({
  complex,
  complexNames,
  name
}) {
  const staffing = complex.engineers != null && complex.maxEngineers != null ? { amount: complex.engineers, capacity: complex.maxEngineers } : null;
  return /* @__PURE__ */ jsxs14(Stack9, { gap: "caption", children: [
    /* @__PURE__ */ jsxs14(Cluster7, { gap: "related-packed", wrap: true, children: [
      /* @__PURE__ */ jsx15(Text10, { size: "xs", level: "muted", children: "crew" }),
      /* @__PURE__ */ jsxs14(Text10, { size: "xs", children: [
        /* @__PURE__ */ jsx15(Unit10, { value: complex.engineers }),
        " /",
        " ",
        /* @__PURE__ */ jsx15(Unit10, { value: complex.maxEngineers }),
        complex.efficiency !== void 0 && complex.efficiency !== null && /* @__PURE__ */ jsxs14(Fragment9, { children: [
          " \xB7 ",
          /* @__PURE__ */ jsx15(Unit10, { value: complex.efficiency }),
          " efficiency"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx15(SharedRating, { complex, complexNames }),
    /* @__PURE__ */ jsx15(
      Meter2,
      {
        hideLabel: true,
        label: `Crew assigned to ${name}, as a share of what it can hold`,
        value: staffing?.amount ?? null,
        capacity: staffing?.capacity ?? null
      }
    )
  ] });
}
var STEPS = [1, 10, 100, "all"];
function AssignControl({
  complex,
  engineers,
  maxEngineers,
  unassigned,
  centreName,
  name,
  handle
}) {
  const [step, setStep] = useState8(1);
  const lcId = complex.lcId;
  if (lcId === void 0 || lcId === null || engineers === null || maxEngineers === null) {
    return /* @__PURE__ */ jsxs14(Text10, { size: "xs", level: "muted", children: [
      NULL_DISPLAY6,
      " RP-1 has not said how many engineers this complex holds"
    ] });
  }
  const room = Math.max(0, maxEngineers - engineers);
  const free = unassigned === null ? room : Math.max(0, unassigned);
  const size = step === "all" ? Number.POSITIVE_INFINITY : step;
  const grow = Math.min(size, free, room);
  const shrink = Math.min(size, engineers);
  return /* @__PURE__ */ jsxs14(Stack9, { gap: "caption", children: [
    /* @__PURE__ */ jsxs14(Cluster7, { align: "center", gap: "related-dense", wrap: true, children: [
      /* @__PURE__ */ jsxs14(Inline3, { gap: "related-packed", children: [
        /* @__PURE__ */ jsx15(Text10, { size: "xs", level: "muted", children: "engineers per press" }),
        /* @__PURE__ */ jsx15(
          Stepper,
          {
            label: `Engineers moved per press at ${name}`,
            onChange: setStep,
            options: STEPS,
            value: step
          }
        )
      ] }),
      /* @__PURE__ */ jsxs14(Inline3, { gap: "related-packed", children: [
        /* @__PURE__ */ jsx15(
          CommandButton8,
          {
            args: { engineers: engineers - shrink, lcId },
            "aria-label": shrink === 0 ? `Nobody is assigned to ${name}` : `Return ${shrink} engineers from ${name} to ${centreName}, leaving ${engineers - shrink}`,
            commandLabel: `Assign ${engineers - shrink} engineers to ${name}`,
            disabled: shrink === 0,
            handle,
            label: `\u2212${shrink === 0 ? size === Number.POSITIVE_INFINITY ? 0 : size : shrink}`,
            size: "sm"
          }
        ),
        /* @__PURE__ */ jsx15(
          CommandButton8,
          {
            args: { engineers: engineers + grow, lcId },
            "aria-label": grow === 0 ? room === 0 ? `${name} is full` : `No engineers free at ${centreName} to assign to ${name}` : `Assign ${grow} more engineers to ${name}, ${engineers + grow} in all`,
            commandLabel: `Assign ${engineers + grow} engineers to ${name}`,
            disabled: grow === 0,
            handle,
            label: `+${grow === 0 ? size === Number.POSITIVE_INFINITY ? 0 : size : grow}`,
            size: "sm"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxs14(Stack9, { as: "ul", gap: "rows", style: LIST_STYLE4, children: [
      /* @__PURE__ */ jsxs14(Row5, { children: [
        /* @__PURE__ */ jsx15(RowName3, { children: "Unassigned" }),
        /* @__PURE__ */ jsx15(Text10, { size: "xs", tone: free === 0 ? "warn" : void 0, children: /* @__PURE__ */ jsx15(
          Unit10,
          {
            value: unassigned === null ? void 0 : value8("count", unassigned)
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxs14(Row5, { children: [
        /* @__PURE__ */ jsx15(RowName3, { children: "Max" }),
        /* @__PURE__ */ jsx15(Text10, { size: "xs", tone: room === 0 ? "warn" : void 0, children: /* @__PURE__ */ jsx15(Unit10, { value: complex.maxEngineers }) })
      ] })
    ] })
  ] });
}
function RushTerms({
  complex,
  terms
}) {
  const extra = complex.rushSalaryDeltaPerDay;
  return /* @__PURE__ */ jsxs14(Cluster7, { gap: "related-packed", wrap: true, children: [
    /* @__PURE__ */ jsx15(Text10, { size: "xs", level: "muted", children: "rushing costs" }),
    /* @__PURE__ */ jsxs14(Text10, { size: "xs", children: [
      extra == null ? /* @__PURE__ */ jsxs14(Fragment9, { children: [
        NULL_DISPLAY6,
        " an unread amount "
      ] }) : /* @__PURE__ */ jsxs14(Fragment9, { children: [
        /* @__PURE__ */ jsx15(Unit10, { value: extra }),
        " in crew pay",
        " "
      ] }),
      terms === void 0 ? /* @__PURE__ */ jsxs14(Fragment9, { children: [
        "\xB7 ",
        NULL_DISPLAY6,
        " RP-1 has not said on what terms"
      ] }) : /* @__PURE__ */ jsxs14(Fragment9, { children: [
        "\xB7 ",
        /* @__PURE__ */ jsx15(Unit10, { value: terms.rateMult }),
        " rate \xB7",
        " ",
        /* @__PURE__ */ jsx15(Unit10, { value: terms.salaryMult }),
        " salary \xB7 efficiency held"
      ] })
    ] })
  ] });
}
function SharedRating({
  complex,
  complexNames
}) {
  const peers = complex.efficiencySharedWith ?? [];
  if (peers.length === 0) {
    return null;
  }
  return /* @__PURE__ */ jsx15(Stack9, { as: "ul", gap: "rows", style: LIST_STYLE4, children: /* @__PURE__ */ jsxs14(Row5, { children: [
    /* @__PURE__ */ jsx15(RowName3, { children: "Shared with" }),
    /* @__PURE__ */ jsx15(Text10, { size: "xs", children: peers.map((lcId) => complexNames.get(lcId) ?? lcId).join(", ") })
  ] }) });
}
function Envelope({ complex }) {
  const height = complex.sizeMaxHeight;
  const width = complex.sizeMaxWidth;
  const depth = complex.sizeMaxDepth;
  const sized = height !== void 0 && height !== null && width !== void 0 && width !== null && depth !== void 0 && depth !== null;
  const resources = complex.resourcesHandled ?? [];
  return /* @__PURE__ */ jsxs14(Stack9, { as: "ul", gap: "rows", style: LIST_STYLE4, children: [
    /* @__PURE__ */ jsxs14(Row5, { children: [
      /* @__PURE__ */ jsx15(RowName3, { children: "Mass" }),
      /* @__PURE__ */ jsx15(Text10, { size: "xs", children: complex.massMax === void 0 || complex.massMax === null ? (
        // RP-1 sends the float sentinel for "no limit", and the read side
        // turns that into absence. So absent here means UNLIMITED rather
        // than unanswered, and the null token would say the wrong thing.
        "unlimited"
      ) : /* @__PURE__ */ jsxs14(Fragment9, { children: [
        /* @__PURE__ */ jsx15(Unit10, { value: complex.massMin }),
        " to",
        " ",
        /* @__PURE__ */ jsx15(Unit10, { value: complex.massMax })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs14(Row5, { children: [
      /* @__PURE__ */ jsx15(RowName3, { children: "Size" }),
      /* @__PURE__ */ jsx15(Text10, { size: "xs", children: sized ? /* @__PURE__ */ jsxs14(Fragment9, { children: [
        /* @__PURE__ */ jsx15(Unit10, { value: depth }),
        " \xD7 ",
        /* @__PURE__ */ jsx15(Unit10, { value: width }),
        " \xD7",
        " ",
        /* @__PURE__ */ jsx15(Unit10, { value: height })
      ] }) : "unlimited" })
    ] }),
    /* @__PURE__ */ jsxs14(Row5, { children: [
      /* @__PURE__ */ jsx15(RowName3, { children: "Resources" }),
      /* @__PURE__ */ jsx15(Text10, { size: "xs", children: resources.length === 0 ? "none" : resources.join(", ") })
    ] })
  ] });
}
function Costs({ complex }) {
  return /* @__PURE__ */ jsxs14(Text10, { size: "xs", level: "muted", children: [
    "crew ",
    /* @__PURE__ */ jsx15(Unit10, { value: complex.salaryPerDay }),
    " \xB7 complex",
    " ",
    /* @__PURE__ */ jsx15(Unit10, { value: complex.upkeepPerDay })
  ] });
}
function RushControl({
  complex,
  name,
  terms,
  handle
}) {
  const lcId = complex.lcId;
  if (lcId === void 0 || lcId === null) {
    return null;
  }
  const rushing = complex.isRushing === true;
  const salaryMult = magnitudeOf15(terms?.salaryMult);
  const price = salaryMult === null ? "" : `, at ${Number(salaryMult.toFixed(2))}\xD7 the crew salary`;
  return /* @__PURE__ */ jsx15(
    CommandButton8,
    {
      pressed: rushing,
      args: { lcId, rushing: !rushing },
      "aria-label": rushing ? `Stop rushing work at ${name}` : `Rush work at ${name}${price}`,
      commandLabel: rushing ? `Stop rushing ${name}` : `Rush ${name}`,
      handle,
      label: rushing ? "Stop rushing" : "Rush",
      size: "sm",
      tone: rushing ? "warn" : "neutral"
    }
  );
}
var LIST_STYLE4 = { listStyle: "none", margin: 0, padding: 0 };

// src/KscComplexes/Centre.tsx
import { jsx as jsx16, jsxs as jsxs15 } from "react/jsx-runtime";
function Centre({
  centre,
  complexes,
  complexNames,
  pads,
  terms,
  assign,
  rush,
  dismantle,
  dismantlePad,
  funds,
  newPad,
  modify,
  pricing,
  renameComplex,
  renamePad
}) {
  const name = centre.kscDisplayName ?? centre.kscName ?? NULL_DISPLAY7;
  const hired = magnitudeOf16(centre.engineers);
  const unassigned = magnitudeOf16(centre.unassignedEngineers);
  const assigned = hired === null || unassigned === null ? null : hired - unassigned;
  return /* @__PURE__ */ jsxs15(Stack10, { as: "li", gap: "related-comfortable", children: [
    /* @__PURE__ */ jsxs15(Cluster8, { gap: "related-packed", wrap: true, children: [
      /* @__PURE__ */ jsx16(Text11, { weight: "semibold", children: name }),
      /* @__PURE__ */ jsxs15(Inline4, { gap: "related-packed", children: [
        centre.isActive === true && /* @__PURE__ */ jsx16(Badge7, { tone: "info", children: "ACTIVE" }),
        unassigned !== null && unassigned > 0 && /* @__PURE__ */ jsxs15(Badge7, { tone: "caution", children: [
          unassigned,
          " IDLE"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs15(Stack10, { as: "ul", gap: "rows", style: LIST_STYLE5, children: [
      /* @__PURE__ */ jsxs15(Row6, { children: [
        /* @__PURE__ */ jsx16(RowName4, { children: "Engineers" }),
        /* @__PURE__ */ jsxs15(Text11, { size: "xs", children: [
          /* @__PURE__ */ jsx16(Unit11, { value: centre.engineers }),
          " hired \xB7",
          " ",
          /* @__PURE__ */ jsx16(
            Unit11,
            {
              value: assigned === null ? void 0 : value9("count", assigned)
            }
          ),
          " ",
          "assigned \xB7 ",
          /* @__PURE__ */ jsx16(Unit11, { value: centre.unassignedEngineers }),
          " idle"
        ] })
      ] }),
      /* @__PURE__ */ jsxs15(Row6, { children: [
        /* @__PURE__ */ jsx16(RowName4, { children: "Per day" }),
        /* @__PURE__ */ jsxs15(Text11, { size: "xs", children: [
          "crews ",
          /* @__PURE__ */ jsx16(Unit11, { value: centre.salaryPerDay }),
          " \xB7 complexes",
          " ",
          /* @__PURE__ */ jsx16(Unit11, { value: centre.upkeepPerDay }),
          " \xB7 idle",
          " ",
          /* @__PURE__ */ jsx16(Unit11, { value: centre.idleSalaryPerDay })
        ] })
      ] })
    ] }),
    complexes.length === 0 ? (
      // A reading rather than the sentence that was here, matching the "no
      // pads" line a complex draws for its own empty case: RP-1 starts a
      // career with a hangar and no pad complex at all, so the zero is a real
      // early-career state and not a widget that failed to draw.
      /* @__PURE__ */ jsx16(Text11, { size: "xs", level: "muted", children: "no launch complexes" })
    ) : (
      /* A grid, not a stack. A complex card is a narrow block of label/value
         rows and the section runs the full width of the space centre panel, so
         stacked cards left most of that width empty however many complexes a
         career has. The tracks collapse to one column below the minimum, which
         is the layout the cards had before. */
      /* @__PURE__ */ jsx16(Grid3, { align: "start", gap: "section-compact", minColWidth: "17rem", children: complexes.map((complex) => /* @__PURE__ */ jsx16(
        ComplexCard,
        {
          assign,
          centreName: name,
          complex,
          complexNames,
          dismantle,
          dismantlePad,
          funds,
          newPad,
          modify,
          pricing,
          renameComplex,
          renamePad,
          pads: pads.filter((pad) => pad.lcId === complex.lcId),
          rush,
          terms,
          unassigned
        },
        complex.lcId ?? complex.name ?? ""
      )) })
    )
  ] });
}
var LIST_STYLE5 = { listStyle: "none", margin: 0, padding: 0 };

// src/KscComplexes/HireFire.tsx
import { value as value11 } from "@ksp-gonogo/sitrep-sdk";
import {
  Cluster as Cluster10,
  CommandButton as CommandButton10,
  Disclosure as Disclosure5,
  magnitudeOf as magnitudeOf18,
  Row as Row8,
  Stack as Stack12,
  Switch as Switch3,
  Text as Text13,
  Unit as Unit13,
  UnitInput as UnitInput5
} from "@ksp-gonogo/ui-kit";
import { useState as useState10 } from "react";

// src/KscComplexes/HireTarget.tsx
import { value as value10 } from "@ksp-gonogo/sitrep-sdk";
import {
  Cluster as Cluster9,
  CommandButton as CommandButton9,
  Disclosure as Disclosure4,
  magnitudeOf as magnitudeOf17,
  NULL_DISPLAY as NULL_DISPLAY8,
  Row as Row7,
  RowName as RowName5,
  Stack as Stack11,
  Switch as Switch2,
  Text as Text12,
  Unit as Unit12,
  UnitInput as UnitInput4
} from "@ksp-gonogo/ui-kit";
import { useState as useState9 } from "react";
import { Fragment as Fragment10, jsx as jsx17, jsxs as jsxs16 } from "react/jsx-runtime";
var RP1_HIRE_TARGET_SET_COMMAND = "rp1.hireTarget.set";
var RP1_HIRE_TARGET_CANCEL_COMMAND = "rp1.hireTarget.cancel";
function HireTargetControl({
  cancel,
  complexes,
  funds,
  personnel,
  set
}) {
  const target = personnel?.hireTarget;
  if (target?.active === true) {
    return /* @__PURE__ */ jsx17(
      StandingTarget,
      {
        complexes,
        handle: cancel,
        personnel,
        target
      }
    );
  }
  if (funds === null) {
    return null;
  }
  return /* @__PURE__ */ jsx17(
    HireTargetForm,
    {
      complexes,
      funds,
      handle: set,
      personnel
    }
  );
}
function StandingTarget({
  complexes,
  handle,
  personnel,
  target
}) {
  const at = complexes.find((complex) => complex.lcId === target.lcId);
  const kind = target.isResearch === true ? "researchers" : "engineers";
  const where = at?.name == null ? "" : ` at ${at.name}`;
  return /* @__PURE__ */ jsxs16(Stack11, { gap: "caption", children: [
    /* @__PURE__ */ jsxs16(Row7, { as: "div", children: [
      /* @__PURE__ */ jsxs16(RowName5, { children: [
        "Hiring to ",
        kind,
        where
      ] }),
      /* @__PURE__ */ jsxs16(Text12, { size: "xs", children: [
        /* @__PURE__ */ jsx17(Unit12, { value: target.targetCount }),
        " \xB7",
        " ",
        /* @__PURE__ */ jsx17(Unit12, { value: target.leftToHire }),
        " left",
        target.timeLeft != null && /* @__PURE__ */ jsxs16(Fragment10, { children: [
          " \xB7 ",
          /* @__PURE__ */ jsx17(Unit12, { value: target.timeLeft }),
          " away"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx17(
      HireSpend,
      {
        isResearch: target.isResearch !== false,
        leftToHire: magnitudeOf17(target.leftToHire),
        personnel
      }
    ),
    /* @__PURE__ */ jsx17(Row7, { as: "div", children: /* @__PURE__ */ jsx17(
      CommandButton9,
      {
        args: {},
        "aria-label": "Cancel the hire target",
        commandLabel: "Cancel the hire target",
        handle,
        label: "Cancel",
        size: "sm"
      }
    ) })
  ] });
}
function HireSpend({
  isResearch,
  leftToHire,
  personnel
}) {
  const charge = magnitudeOf17(personnel?.hireCost);
  const quote = magnitudeOf17(
    isResearch ? personnel?.researcherHireQuote : personnel?.engineerHireQuote
  );
  const applicants = magnitudeOf17(personnel?.applicants) ?? 0;
  if (charge === null || leftToHire === null || leftToHire <= 0) {
    return null;
  }
  const free = Math.min(leftToHire, applicants);
  const paid = leftToHire - free;
  if (paid === 0) {
    return /* @__PURE__ */ jsxs16(Text12, { size: "xs", level: "muted", children: [
      /* @__PURE__ */ jsx17(Unit12, { value: value10("count", free) }),
      " free from applicants"
    ] });
  }
  return /* @__PURE__ */ jsxs16(Text12, { size: "xs", level: "muted", children: [
    /* @__PURE__ */ jsx17(Unit12, { value: value10("count", paid) }),
    " at",
    " ",
    /* @__PURE__ */ jsx17(Unit12, { decimals: 0, value: value10("funds", charge) }),
    " each =",
    " ",
    /* @__PURE__ */ jsx17(Unit12, { decimals: 0, value: value10("funds", paid * charge) }),
    free > 0 && /* @__PURE__ */ jsxs16(Fragment10, { children: [
      " \xB7 ",
      /* @__PURE__ */ jsx17(Unit12, { value: value10("count", free) }),
      " free from applicants"
    ] }),
    quote !== null && Math.round(quote) !== Math.round(charge) && /* @__PURE__ */ jsxs16(Fragment10, { children: [
      " \xB7 RP-1 quotes ",
      /* @__PURE__ */ jsx17(Unit12, { decimals: 0, value: value10("funds", quote) })
    ] })
  ] });
}
function HireTargetForm({
  complexes,
  funds,
  handle,
  personnel
}) {
  const [lcId, setLcId] = useState9(null);
  const [wanted, setWanted] = useState9(value10("count", 0));
  const [reserve, setReserve] = useState9(value10("funds", 0));
  const staffable = complexes.filter(
    (complex) => complex.lcId != null && complex.isOperational === true
  );
  const at = staffable.find((complex) => complex.lcId === lcId);
  const kind = at === void 0 ? "researchers" : "engineers";
  const where = at?.name == null ? "" : ` at ${at.name}`;
  const current2 = at === void 0 ? magnitudeOf17(personnel?.researchers) : magnitudeOf17(at.engineers);
  const ceiling = at === void 0 ? null : magnitudeOf17(at.maxEngineers);
  const targetCount = Math.round(magnitudeOf17(wanted) ?? 0);
  const reserveFunds = magnitudeOf17(reserve) ?? 0;
  const tooLow = current2 !== null && targetCount > 0 && targetCount <= current2;
  const clamped = ceiling !== null && targetCount > ceiling;
  const spendable = Math.max(0, funds - reserveFunds);
  const press = `Hire up to ${targetCount} ${kind}${where}, spending no lower than ${reserveFunds.toLocaleString("en-GB")} funds`;
  return /* @__PURE__ */ jsx17(
    Disclosure4,
    {
      "aria-label": "Set a hire target",
      asButton: true,
      buttonSize: "sm",
      chevron: false,
      label: (open) => open ? "Hide hire target" : "Set hire target",
      panelHeight: "auto",
      variant: "inline",
      children: /* @__PURE__ */ jsxs16(Stack11, { gap: "related-dense", children: [
        /* @__PURE__ */ jsxs16(Cluster9, { gap: "related-packed", wrap: true, children: [
          /* @__PURE__ */ jsx17(
            Switch2,
            {
              checked: at === void 0,
              label: "researchers",
              onChange: () => setLcId(null)
            }
          ),
          staffable.map((complex) => /* @__PURE__ */ jsx17(
            Switch2,
            {
              checked: complex.lcId === lcId,
              label: complex.name ?? NULL_DISPLAY8,
              onChange: () => setLcId(complex.lcId ?? null)
            },
            complex.lcId
          ))
        ] }),
        /* @__PURE__ */ jsxs16(Row7, { as: "div", children: [
          /* @__PURE__ */ jsxs16(RowName5, { children: [
            kind,
            " now"
          ] }),
          /* @__PURE__ */ jsxs16(Text12, { size: "xs", children: [
            current2 === null ? NULL_DISPLAY8 : /* @__PURE__ */ jsx17(Unit12, { value: value10("count", current2) }),
            ceiling !== null && /* @__PURE__ */ jsxs16(Fragment10, { children: [
              " / ",
              /* @__PURE__ */ jsx17(Unit12, { value: value10("count", ceiling) }),
              " max"
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx17(
          UnitInput4,
          {
            label: "Target headcount",
            onChange: setWanted,
            unit: "count",
            value: wanted
          }
        ),
        tooLow && /* @__PURE__ */ jsx17(Text12, { size: "xs", tone: "warn", children: "Staff count must be greater than the existing amount!" }),
        clamped && /* @__PURE__ */ jsxs16(Text12, { size: "xs", tone: "warn", children: [
          "above ",
          at?.name ?? NULL_DISPLAY8,
          "'s maximum, so RP-1 will hold it at",
          " ",
          /* @__PURE__ */ jsx17(Unit12, { value: value10("count", ceiling ?? 0) })
        ] }),
        /* @__PURE__ */ jsx17(
          UnitInput4,
          {
            label: "Reserve",
            onChange: setReserve,
            unit: "funds",
            value: reserve
          }
        ),
        /* @__PURE__ */ jsx17(
          HireSpend,
          {
            isResearch: at === void 0,
            leftToHire: current2 === null ? null : Math.max(0, targetCount - current2),
            personnel
          }
        ),
        /* @__PURE__ */ jsxs16(Row7, { as: "div", children: [
          /* @__PURE__ */ jsxs16(Text12, { size: "xs", level: "muted", children: [
            "draws at most",
            " ",
            /* @__PURE__ */ jsx17(Unit12, { value: value10("funds", spendable), decimals: 0 }),
            " of",
            " ",
            /* @__PURE__ */ jsx17(Unit12, { value: value10("funds", funds), decimals: 0 })
          ] }),
          /* @__PURE__ */ jsx17(
            CommandButton9,
            {
              args: at === void 0 ? { reserveFunds, targetCount } : { lcId: at.lcId ?? "", reserveFunds, targetCount },
              "aria-label": press,
              commandLabel: press,
              confirmAriaLabel: `Confirm hiring up to ${targetCount} ${kind}${where}`,
              confirmLabel: "Confirm",
              disabled: targetCount <= 0 || tooLow,
              handle,
              label: "Set",
              size: "sm"
            }
          )
        ] })
      ] })
    }
  );
}

// src/KscComplexes/HireFire.tsx
import { Fragment as Fragment11, jsx as jsx18, jsxs as jsxs17 } from "react/jsx-runtime";
var RP1_PERSONNEL_HIRE_COMMAND = "rp1.personnel.hire";
var RP1_PERSONNEL_FIRE_COMMAND = "rp1.personnel.fire";
function HireFireControl({
  centres,
  fire,
  funds,
  hire,
  personnel
}) {
  const [research, setResearch] = useState10(true);
  const [wanted, setWanted] = useState10(value11("count", 1));
  if (funds === null) {
    return null;
  }
  const active = centres.find((centre) => centre.isActive === true);
  const activeName = active?.kscDisplayName ?? active?.kscName;
  const engineers = !research && active?.kscName != null;
  const kind = engineers ? "engineers" : "researchers";
  const where = engineers ? ` at ${activeName}` : "";
  const count2 = Math.max(0, Math.round(magnitudeOf18(wanted) ?? 0));
  const firable = engineers ? magnitudeOf18(active?.unassignedEngineers) : magnitudeOf18(personnel?.researchers);
  const perHead = magnitudeOf18(
    engineers ? personnel?.pooledEngineerSalaryPerDay : personnel?.researcherSalaryPerHeadPerDay
  );
  const salary = perHead === null ? null : count2 * perHead;
  const charge = magnitudeOf18(personnel?.hireCost);
  const applicants = magnitudeOf18(personnel?.applicants) ?? 0;
  const cost = charge === null ? null : Math.max(0, count2 - applicants) * charge;
  const short = cost !== null && cost > funds;
  const tooMany = firable !== null && count2 > firable;
  const args = engineers ? { count: count2, kscName: active?.kscName ?? "", research: false } : { count: count2, research: true };
  const hirePress = `Hire ${count2} ${kind}${where}`;
  const firePress = `Fire ${count2} ${kind}${where}`;
  return /* @__PURE__ */ jsx18(
    Disclosure5,
    {
      "aria-label": "Hire or fire staff",
      asButton: true,
      buttonSize: "sm",
      chevron: false,
      label: (open) => open ? "Hide hire or fire" : "Hire or fire",
      panelHeight: "auto",
      variant: "inline",
      children: /* @__PURE__ */ jsxs17(Stack12, { gap: "related-dense", children: [
        /* @__PURE__ */ jsxs17(Cluster10, { gap: "related-packed", wrap: true, children: [
          /* @__PURE__ */ jsx18(
            Switch3,
            {
              checked: !engineers,
              label: "researchers",
              onChange: () => setResearch(true)
            }
          ),
          active?.kscName != null && /* @__PURE__ */ jsx18(
            Switch3,
            {
              checked: engineers,
              label: `engineers at ${activeName}`,
              onChange: () => setResearch(false)
            }
          )
        ] }),
        /* @__PURE__ */ jsx18(
          UnitInput5,
          {
            label: "How many",
            onChange: setWanted,
            unit: "count",
            value: wanted
          }
        ),
        /* @__PURE__ */ jsx18(
          HireSpend,
          {
            isResearch: !engineers,
            leftToHire: count2,
            personnel
          }
        ),
        /* @__PURE__ */ jsxs17(Row8, { as: "div", children: [
          /* @__PURE__ */ jsxs17(Text13, { size: "xs", level: "muted", children: [
            cost === null ? null : /* @__PURE__ */ jsxs17(Fragment11, { children: [
              /* @__PURE__ */ jsx18(Unit13, { decimals: 0, value: value11("funds", cost) }),
              " of",
              " ",
              /* @__PURE__ */ jsx18(Unit13, { decimals: 0, value: value11("funds", funds) }),
              " \xB7",
              " "
            ] }),
            /* @__PURE__ */ jsx18(SalaryDelta, { sign: "+", salary })
          ] }),
          /* @__PURE__ */ jsx18(
            CommandButton10,
            {
              args,
              "aria-label": hirePress,
              commandLabel: hirePress,
              confirmAriaLabel: `Confirm hiring ${count2} ${kind}${where}`,
              confirmLabel: "Confirm",
              disabled: count2 <= 0 || short,
              handle: hire,
              label: "Hire",
              size: "sm"
            }
          )
        ] }),
        short && /* @__PURE__ */ jsx18(Text13, { size: "xs", tone: "warn", children: "more than the balance, so RP-1 will refuse it" }),
        /* @__PURE__ */ jsxs17(Row8, { as: "div", children: [
          /* @__PURE__ */ jsxs17(Text13, { size: "xs", level: "muted", children: [
            "no fee \xB7 ",
            /* @__PURE__ */ jsx18(SalaryDelta, { sign: "-", salary })
          ] }),
          /* @__PURE__ */ jsx18(
            CommandButton10,
            {
              args,
              "aria-label": firePress,
              commandLabel: firePress,
              confirmAriaLabel: `Confirm firing ${count2} ${kind}${where}`,
              confirmLabel: "Confirm",
              disabled: count2 <= 0 || tooMany,
              handle: fire,
              label: "Fire",
              size: "sm"
            }
          )
        ] }),
        tooMany && /* @__PURE__ */ jsx18(Text13, { size: "xs", tone: "warn", children: engineers ? /* @__PURE__ */ jsxs17(Fragment11, { children: [
          "only ",
          /* @__PURE__ */ jsx18(Unit13, { value: value11("count", firable ?? 0) }),
          " unassigned",
          where,
          " can be fired"
        ] }) : /* @__PURE__ */ jsxs17(Fragment11, { children: [
          "only ",
          /* @__PURE__ */ jsx18(Unit13, { value: value11("count", firable ?? 0) }),
          " researchers to fire"
        ] }) })
      ] })
    }
  );
}
function SalaryDelta({
  salary,
  sign
}) {
  if (salary === null) {
    return /* @__PURE__ */ jsx18(Fragment11, { children: "salary per day unknown" });
  }
  return /* @__PURE__ */ jsxs17(Fragment11, { children: [
    sign,
    /* @__PURE__ */ jsx18(Unit13, { decimals: 1, value: value11("f/day", salary) }),
    " salary"
  ] });
}

// src/KscComplexes/NewComplex.tsx
import { value as value12 } from "@ksp-gonogo/sitrep-sdk";
import {
  CommandButton as CommandButton11,
  Disclosure as Disclosure6,
  Inline as Inline5,
  magnitudeOf as magnitudeOf19,
  Row as Row9,
  RowName as RowName6,
  Stack as Stack13,
  Switch as Switch4,
  Text as Text14,
  TextField as TextField2,
  Unit as Unit14,
  UnitInput as UnitInput6
} from "@ksp-gonogo/ui-kit";
import { useState as useState11 } from "react";
import { Fragment as Fragment12, jsx as jsx19, jsxs as jsxs18 } from "react/jsx-runtime";
var RP1_COMPLEX_NEW_COMMAND = "rp1.complex.new";
function NewComplexControl({
  centres,
  existingNames,
  funds,
  handle,
  pricing
}) {
  const [name, setName] = useState11("");
  const [massMax, setMassMax] = useState11(value12("t", 100));
  const [width, setWidth] = useState11(value12("m", 10));
  const [height, setHeight] = useState11(value12("m", 20));
  const [depth, setDepth] = useState11(value12("m", 10));
  const [humanRated, setHumanRated] = useState11(false);
  const [staffOnComplete, setStaffOnComplete] = useState11(false);
  const [kscName, setKscName] = useState11(null);
  const named = centres.map((c) => c.kscName).filter((n) => n != null);
  const chosen = kscName ?? (named.length === 1 ? named[0] : null);
  const trimmed = name.trim();
  const taken = chosen == null ? [] : existingNames(chosen);
  const duplicate = taken.some(
    (existing) => existing.toLowerCase() === trimmed.toLowerCase()
  );
  const spec = {
    humanRated,
    isHangar: false,
    massMax: magnitudeOf19(massMax) ?? 0,
    resources: /* @__PURE__ */ new Map(),
    sizeMaxDepth: magnitudeOf19(depth) ?? 0,
    sizeMaxHeight: magnitudeOf19(height) ?? 0,
    sizeMaxWidth: magnitudeOf19(width) ?? 0
  };
  const quote = quoteNewComplex(spec, pricing);
  const short = funds !== null && quote !== null && funds < quote.total;
  const massed = spec.massMax > 0;
  const blocked = trimmed === "" || duplicate || chosen == null || !massed || quote === null;
  return (
    /* A small trailing button rather than a full-width chevron band, matching
       the complex cards' own detail expander: the two are the same primitive and
       had drawn as two different controls. */
    /* @__PURE__ */ jsx19(
      Disclosure6,
      {
        "aria-label": "Build a new launch complex",
        asButton: true,
        buttonSize: "sm",
        chevron: false,
        label: (open) => open ? "Hide new complex" : "Build a new complex",
        panelHeight: "auto",
        variant: "inline",
        children: /* @__PURE__ */ jsxs18(Stack13, { gap: "related-dense", children: [
          named.length > 1 && /* @__PURE__ */ jsxs18(Inline5, { gap: "related-packed", children: [
            /* @__PURE__ */ jsx19(Text14, { size: "xs", level: "muted", children: "centre" }),
            named.map((n) => /* @__PURE__ */ jsx19(
              Switch4,
              {
                checked: chosen === n,
                label: n,
                onChange: () => setKscName(n)
              },
              n
            ))
          ] }),
          named.length === 1 && /* @__PURE__ */ jsxs18(Row9, { as: "div", children: [
            /* @__PURE__ */ jsx19(RowName6, { children: "Centre" }),
            /* @__PURE__ */ jsx19(Text14, { size: "xs", children: named[0] })
          ] }),
          /* @__PURE__ */ jsx19(
            TextField2,
            {
              invalid: duplicate ? "a complex at this centre already has that name" : void 0,
              label: "Name",
              maxLength: 64,
              onChange: setName,
              placeholder: "complex name",
              value: name
            }
          ),
          /* @__PURE__ */ jsx19(
            UnitInput6,
            {
              label: "Tonnage limit",
              onChange: setMassMax,
              unit: "t",
              value: massMax
            }
          ),
          /* @__PURE__ */ jsxs18(Text14, { size: "xs", level: "muted", children: [
            "renovations later are held between",
            " ",
            /* @__PURE__ */ jsx19(
              Unit14,
              {
                value: value12("t", Math.max(1, Math.ceil(spec.massMax * 0.5)))
              }
            ),
            " ",
            "and",
            " ",
            /* @__PURE__ */ jsx19(Unit14, { value: value12("t", Math.max(3, Math.floor(spec.massMax * 2))) })
          ] }),
          /* @__PURE__ */ jsx19(UnitInput6, { label: "Width", onChange: setWidth, unit: "m", value: width }),
          /* @__PURE__ */ jsx19(
            UnitInput6,
            {
              label: "Height",
              onChange: setHeight,
              unit: "m",
              value: height
            }
          ),
          /* @__PURE__ */ jsx19(UnitInput6, { label: "Length", onChange: setDepth, unit: "m", value: depth }),
          /* @__PURE__ */ jsx19(
            Switch4,
            {
              checked: humanRated,
              label: "Human-rated",
              onChange: setHumanRated
            }
          ),
          /* @__PURE__ */ jsx19(
            Switch4,
            {
              checked: staffOnComplete,
              label: "Assign idle engineers when it is built",
              onChange: setStaffOnComplete
            }
          ),
          /* @__PURE__ */ jsxs18(Row9, { as: "div", children: [
            /* @__PURE__ */ jsx19(Text14, { size: "xs", tone: short ? "warn" : void 0, level: "muted", children: quote === null ? "no price: RP-1 has not said what this would cost" : /* @__PURE__ */ jsxs18(Fragment12, { children: [
              /* @__PURE__ */ jsx19(Unit14, { value: value12("funds", quote.total) }),
              short && " \xB7 more than the balance, so it builds slower"
            ] }) }),
            /* @__PURE__ */ jsx19(
              CommandButton11,
              {
                args: {
                  assignEngineersOnComplete: staffOnComplete,
                  humanRated,
                  kscName: chosen ?? "",
                  massMax: spec.massMax,
                  name: trimmed,
                  size: {
                    sizeMaxDepth: spec.sizeMaxDepth,
                    sizeMaxHeight: spec.sizeMaxHeight,
                    sizeMaxWidth: spec.sizeMaxWidth
                  }
                },
                "aria-label": trimmed === "" ? "Name the complex before building it" : chosen == null ? "Choose which space centre builds it" : !massed ? "Give the complex a tonnage limit" : `Build ${trimmed} at ${chosen}`,
                commandLabel: `Build ${trimmed} at ${chosen ?? ""}`,
                confirmAriaLabel: `Confirm building ${trimmed}, whose tonnage limit fixes its renovation range for life`,
                confirmLabel: "Confirm",
                disabled: blocked,
                handle,
                label: "Build",
                size: "sm"
              }
            )
          ] })
        ] })
      }
    )
  );
}

// src/KscComplexes/index.tsx
import { jsx as jsx20, jsxs as jsxs19 } from "react/jsx-runtime";
var RP1_COMPLEX_RUSH_COMMAND = "rp1.complex.rush";
var RP1_PERSONNEL_ASSIGN_COMMAND = "rp1.personnel.assign";
function KscComplexes() {
  const available = current(useTelemetry10("rp1.available"));
  const centres = current(useTelemetry10("rp1.centres"));
  const complexes = current(useTelemetry10("rp1.complexes"));
  const pads = current(useTelemetry10("rp1.pads"));
  const personnel = current(useTelemetry10("rp1.personnel"));
  const terms = current(useTelemetry10("rp1.rushTerms"));
  const career = current(useTelemetry10("career.status"));
  const pricing = current(useTelemetry10("rp1.lcPricing"));
  const rush = useCommand6(RP1_COMPLEX_RUSH_COMMAND);
  const assign = useCommand6(RP1_PERSONNEL_ASSIGN_COMMAND);
  const dismantle = useCommand6(RP1_COMPLEX_DISMANTLE_COMMAND);
  const dismantlePad = useCommand6(RP1_PAD_DISMANTLE_COMMAND);
  const newPad = useCommand6(RP1_PAD_NEW_COMMAND);
  const renameComplex = useCommand6(RP1_COMPLEX_RENAME_COMMAND);
  const renamePad = useCommand6(RP1_PAD_RENAME_COMMAND);
  const newComplex = useCommand6(RP1_COMPLEX_NEW_COMMAND);
  const setHireTarget = useCommand6(RP1_HIRE_TARGET_SET_COMMAND);
  const cancelHireTarget = useCommand6(RP1_HIRE_TARGET_CANCEL_COMMAND);
  const hire = useCommand6(RP1_PERSONNEL_HIRE_COMMAND);
  const fire = useCommand6(RP1_PERSONNEL_FIRE_COMMAND);
  const modifyComplex = useCommand6(RP1_COMPLEX_MODIFY_COMMAND);
  if (available !== true) {
    return null;
  }
  const centreRows = centres ?? [];
  const complexRows = complexes ?? [];
  const padRows = pads ?? [];
  const complexNames = new Map(
    complexRows.flatMap(
      (complex) => complex.lcId == null || complex.name == null ? [] : [[complex.lcId, complex.name]]
    )
  );
  return /* @__PURE__ */ jsxs19(Section7, { gap: "section-compact", children: [
    /* @__PURE__ */ jsx20(SectionTitle5, { children: "SPACE CENTRES" }),
    /* @__PURE__ */ jsxs19(Stack14, { gap: "caption", children: [
      /* @__PURE__ */ jsx20(SectionTitle5, { children: "PAYROLL" }),
      /* @__PURE__ */ jsx20(Payroll, { personnel }),
      /* @__PURE__ */ jsx20(
        HireTargetControl,
        {
          cancel: cancelHireTarget,
          complexes: complexRows,
          funds: magnitudeOf20(career?.balances?.funds),
          personnel,
          set: setHireTarget
        }
      ),
      /* @__PURE__ */ jsx20(
        HireFireControl,
        {
          centres: centreRows,
          fire,
          funds: magnitudeOf20(career?.balances?.funds),
          hire,
          personnel
        }
      )
    ] }),
    centreRows.length === 0 ? (
      // A real answer rather than an empty stack: RP-1 present and answering
      // with no centre at all is a state, and a blank space is not a way to
      // report it.
      /* @__PURE__ */ jsx20(EmptyState4, { children: "No space centre reported" })
    ) : /* @__PURE__ */ jsx20(Stack14, { as: "ul", gap: "section-comfortable", style: LIST_STYLE6, children: centreRows.map((centre) => /* @__PURE__ */ jsx20(
      Centre,
      {
        assign,
        centre,
        complexes: complexRows.filter(
          (complex) => complex.kscName === centre.kscName
        ),
        complexNames,
        dismantle,
        dismantlePad,
        funds: magnitudeOf20(career?.balances?.funds),
        modify: modifyComplex,
        newPad,
        pricing,
        renameComplex,
        renamePad,
        pads: padRows,
        rush,
        terms
      },
      centre.kscName ?? ""
    )) }),
    /* @__PURE__ */ jsx20(
      NewComplexControl,
      {
        centres: centreRows,
        existingNames: (ksc) => complexRows.filter((complex) => complex.kscName === ksc).map((complex) => complex.name).filter((name) => name != null),
        funds: magnitudeOf20(career?.balances?.funds),
        handle: newComplex,
        pricing
      }
    )
  ] });
}
function Payroll({
  personnel
}) {
  return /* @__PURE__ */ jsxs19(Stack14, { as: "ul", gap: "rows", style: LIST_STYLE6, children: [
    /* @__PURE__ */ jsxs19(Row10, { children: [
      /* @__PURE__ */ jsx20(RowName7, { children: "Engineers" }),
      /* @__PURE__ */ jsxs19(Text15, { children: [
        /* @__PURE__ */ jsx20(Unit15, { value: personnel?.totalEngineers }),
        " \xB7",
        " ",
        /* @__PURE__ */ jsx20(Unit15, { value: personnel?.engineerSalaryPerDay })
      ] })
    ] }),
    /* @__PURE__ */ jsxs19(Row10, { children: [
      /* @__PURE__ */ jsx20(RowName7, { children: "Researchers" }),
      /* @__PURE__ */ jsxs19(Text15, { children: [
        /* @__PURE__ */ jsx20(Unit15, { value: personnel?.researchers }),
        " \xB7",
        " ",
        /* @__PURE__ */ jsx20(Unit15, { value: personnel?.researcherSalaryPerDay })
      ] })
    ] }),
    /* @__PURE__ */ jsxs19(Row10, { children: [
      /* @__PURE__ */ jsx20(RowName7, { children: "Applicants" }),
      /* @__PURE__ */ jsx20(Text15, { children: /* @__PURE__ */ jsx20(Unit15, { value: personnel?.applicants }) })
    ] })
  ] });
}
var LIST_STYLE6 = { listStyle: "none", margin: 0, padding: 0 };
registerAugment9({
  id: "rp1-ksc-complexes",
  augments: "space-center-status.sections",
  component: KscComplexes,
  /** Under the construction queue; see `KscConstruction` for why it is declared. */
  priority: 1,
  owner: RP1
});

// src/KscConstruction/index.tsx
import {
  registerAugment as registerAugment10,
  useCommand as useCommand7,
  useTelemetry as useTelemetry11
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge8,
  Countdown,
  EmptyState as EmptyState5,
  magnitudeOf as magnitudeOf22,
  NULL_DISPLAY as NULL_DISPLAY10,
  Section as Section8,
  SectionTitle as SectionTitle6,
  Text as Text17,
  Unit as Unit17
} from "@ksp-gonogo/ui-kit";

// src/KscConstruction/RateControl.tsx
import { magnitudeOf as magnitudeOf21 } from "@ksp-gonogo/sitrep-sdk";
import {
  Cluster as Cluster11,
  CommandButton as CommandButton12,
  MissionDate as MissionDate7,
  NULL_DISPLAY as NULL_DISPLAY9,
  Stepper as Stepper2,
  Text as Text16,
  Unit as Unit16
} from "@ksp-gonogo/ui-kit";
import { useState as useState12 } from "react";
import { Fragment as Fragment13, jsx as jsx21, jsxs as jsxs20 } from "react/jsx-runtime";
var RP1_CONSTRUCTION_SET_RATE_COMMAND = "rp1.construction.setRate";
var RP1_CONSTRUCTION_CANCEL_COMMAND = "rp1.construction.cancel";
var STEPS_PER_UNIT = 20;
var STEPS2 = Array.from({ length: 31 }, (_, step) => step);
function stepOf(workRate) {
  const rate = magnitudeOf21(workRate);
  return rate === null ? null : Math.round(rate * STEPS_PER_UNIT);
}
var percent = (step) => `${step * 5}%`;
function RateControl({
  row,
  label: label3,
  table,
  handle
}) {
  const current2 = stepOf(row.workRate);
  const [chosen, setChosen] = useState12(null);
  if (row.id == null || current2 === null) {
    return null;
  }
  const step = chosen ?? current2;
  const priced = table?.steps?.find((s) => stepOf(s.workRate) === step);
  return /* @__PURE__ */ jsxs20(Cluster11, { align: "start", gap: "related-dense", justify: "start", wrap: true, children: [
    /* @__PURE__ */ jsx21(
      Stepper2,
      {
        format: percent,
        label: `Work rate for ${label3}`,
        onChange: setChosen,
        options: STEPS2,
        value: step,
        children: /* @__PURE__ */ jsx21(Text16, { size: "xs", level: "muted", children: /* @__PURE__ */ jsx21(StepReadout, { step, priced }) })
      }
    ),
    /* @__PURE__ */ jsx21(
      CommandButton12,
      {
        args: { id: row.id, workRate: step / STEPS_PER_UNIT },
        "aria-label": step === current2 ? `${label3} is already at ${percent(step)}` : `Set ${label3} to ${percent(step)}`,
        commandLabel: `Set ${label3} to ${percent(step)}`,
        confirmLabel: `Set ${percent(step)}`,
        disabled: step === current2,
        handle,
        label: "Set rate",
        size: "sm"
      }
    )
  ] });
}
function StepReadout({
  step,
  priced
}) {
  if (step === 0) {
    return /* @__PURE__ */ jsx21(Fragment13, { children: "stopped: draws nothing and never finishes" });
  }
  if (priced === void 0 || priced.costPerDay == null) {
    return /* @__PURE__ */ jsxs20(Fragment13, { children: [
      NULL_DISPLAY9,
      " RP-1 has not priced this rate yet"
    ] });
  }
  const multiplier = magnitudeOf21(priced.costMultiplier);
  return /* @__PURE__ */ jsxs20(Fragment13, { children: [
    "draws ",
    /* @__PURE__ */ jsx21(Unit16, { decimals: 0, value: priced.costPerDay }),
    ", done",
    " ",
    /* @__PURE__ */ jsx21(MissionDate7, { value: priced.finishesAt }),
    multiplier !== null && multiplier > 1 && /* @__PURE__ */ jsxs20(Fragment13, { children: [
      ", rush cost \xD7",
      multiplier.toFixed(2)
    ] })
  ] });
}
function CancelControl({
  row,
  label: label3,
  handle
}) {
  if (row.id == null) {
    return null;
  }
  return /* @__PURE__ */ jsxs20(Cluster11, { align: "center", gap: "related-dense", justify: "start", wrap: true, children: [
    /* @__PURE__ */ jsxs20(Text16, { size: "xs", level: "muted", children: [
      /* @__PURE__ */ jsx21(Unit16, { value: row.spentRushCost }),
      " spent, not refunded"
    ] }),
    /* @__PURE__ */ jsx21(
      CommandButton12,
      {
        args: { id: row.id },
        "aria-label": `Cancel ${label3}`,
        commandLabel: `Cancel ${label3}`,
        confirmAriaLabel: `Stop building ${label3}; nothing already spent is refunded`,
        confirmLabel: "Stop building",
        confirmTone: "nogo",
        handle,
        label: "Cancel",
        size: "sm"
      }
    )
  ] });
}

// src/KscConstruction/index.tsx
import { Fragment as Fragment14, jsx as jsx22, jsxs as jsxs21 } from "react/jsx-runtime";
function KscConstruction() {
  const available = current(useTelemetry11("rp1.available"));
  const constructions = current(useTelemetry11("rp1.constructions"));
  const centres = current(useTelemetry11("rp1.centres"));
  const rates = current(useTelemetry11("rp1.constructionRates"));
  const setRate = useCommand7(RP1_CONSTRUCTION_SET_RATE_COMMAND);
  const cancel = useCommand7(RP1_CONSTRUCTION_CANCEL_COMMAND);
  if (available !== true) {
    return null;
  }
  const rows = constructions ?? [];
  const nameCentres = (centres ?? []).length > 1;
  const centreNames = new Map(
    (centres ?? []).flatMap(
      (centre) => centre.kscName == null || centre.kscDisplayName == null ? [] : [[centre.kscName, centre.kscDisplayName]]
    )
  );
  const tables = new Map(
    (rates?.constructions ?? []).flatMap(
      (table) => table.id == null ? [] : [[table.id, table]]
    )
  );
  return /* @__PURE__ */ jsxs21(Section8, { gap: "related-dense", children: [
    /* @__PURE__ */ jsx22(SectionTitle6, { children: "SITE CONSTRUCTION" }),
    rows.length === 0 ? (
      // A real answer, and one worth stating: an empty construction queue and
      // an Uplink that is not reporting look identical if this is left out.
      // The kit's absence chrome rather than a sentence, so it reads as the
      // same kind of thing as every other empty state in this panel.
      /* @__PURE__ */ jsx22(EmptyState5, { children: "Nothing being built" })
    ) : /* @__PURE__ */ jsx22(ProjectCardList, { children: rows.map((row) => /* @__PURE__ */ jsx22(
      ConstructionRow,
      {
        cancel,
        centreNames,
        nameCentre: nameCentres,
        row,
        setRate,
        table: row.id == null ? void 0 : tables.get(row.id)
      },
      rowKey(row)
    )) })
  ] });
}
function ConstructionRow({
  row,
  nameCentre,
  centreNames,
  table,
  setRate,
  cancel
}) {
  const ratio = magnitudeOf22(row.progressRatio);
  const label3 = rowLabel(row);
  const centre = nameCentre && row.kscName !== void 0 && row.kscName !== null ? centreNames.get(row.kscName) ?? row.kscName : null;
  return (
    // Amber only for work that is going nowhere. Every card here is unfinished
    // by definition, so painting them all as caution would leave the colour
    // saying nothing at the moment it is needed.
    /* @__PURE__ */ jsxs21(
      ProjectCard,
      {
        badge: /* @__PURE__ */ jsx22(Badge8, { tone: "info", children: KIND_BADGE[row.kind ?? ""] ?? "WORK" }),
        detail: /* @__PURE__ */ jsxs21(Fragment14, { children: [
          /* @__PURE__ */ jsx22(Detail, { row }),
          centre === null ? null : /* @__PURE__ */ jsxs21(Fragment14, { children: [
            " \xB7 ",
            centre
          ] })
        ] }),
        name: label3,
        progress: { label: `Construction progress, ${label3}`, ratio },
        tone: row.stalled === true ? "warn" : "go",
        children: [
          /* @__PURE__ */ jsx22(Text17, { size: "xs", level: "muted", children: /* @__PURE__ */ jsx22(TimeLeft, { row }) }),
          /* @__PURE__ */ jsxs21(Text17, { size: "xs", level: "muted", children: [
            "paid ",
            /* @__PURE__ */ jsx22(Unit17, { value: row.spentCost }),
            " of ",
            /* @__PURE__ */ jsx22(Unit17, { value: row.cost })
          ] }),
          row.isModify === true && /* @__PURE__ */ jsxs21(Text17, { size: "xs", level: "muted", children: [
            /* @__PURE__ */ jsx22(Unit17, { value: row.engineersToReadd }),
            " engineers off it until it finishes"
          ] }),
          /* @__PURE__ */ jsx22(RateControl, { handle: setRate, label: label3, row, table }),
          /* @__PURE__ */ jsx22(CancelControl, { handle: cancel, label: label3, row })
        ]
      }
    )
  );
}
function Detail({ row }) {
  if (row.kind === "FacilityUpgrade") {
    return /* @__PURE__ */ jsx22(TierStep, { row });
  }
  if (row.kind === "LaunchComplex") {
    return row.isModify === true ? /* @__PURE__ */ jsx22(Fragment14, { children: "modification" }) : /* @__PURE__ */ jsx22(Fragment14, { children: "new complex" });
  }
  return /* @__PURE__ */ jsx22(Fragment14, { children: "new pad" });
}
function TierStep({ row }) {
  const from = magnitudeOf22(row.currentLevel);
  const to = magnitudeOf22(row.targetLevel);
  return /* @__PURE__ */ jsxs21(Fragment14, { children: [
    "tier ",
    from === null ? NULL_DISPLAY10 : from + 1,
    " to",
    " ",
    to === null ? NULL_DISPLAY10 : to + 1
  ] });
}
function TimeLeft({ row }) {
  if (row.timeLeftSeconds !== void 0 && row.timeLeftSeconds !== null) {
    const throttle = magnitudeOf22(row.workRate);
    const funded = magnitudeOf22(row.affordableFraction);
    return /* @__PURE__ */ jsxs21(Fragment14, { children: [
      /* @__PURE__ */ jsx22(Countdown, { value: row.timeLeftSeconds }),
      " until it is finished",
      throttle !== null && throttle > 1 && /* @__PURE__ */ jsxs21(Fragment14, { children: [
        " ",
        /* @__PURE__ */ jsx22(Badge8, { tone: "caution", children: "RUSHING" })
      ] }),
      throttle !== null && throttle > 0 && throttle < 1 && /* @__PURE__ */ jsxs21(Fragment14, { children: [
        ", at ",
        /* @__PURE__ */ jsx22(Unit17, { value: row.workRate })
      ] }),
      funded !== null && funded > 0 && funded < 1 && /* @__PURE__ */ jsxs21(Fragment14, { children: [
        " ",
        /* @__PURE__ */ jsx22(Badge8, { tone: "caution", children: "SLOWED BY FUNDS" }),
        " meeting",
        " ",
        /* @__PURE__ */ jsx22(Unit17, { value: row.affordableFraction }),
        " of its draw"
      ] })
    ] });
  }
  if (row.stalled === true) {
    return /* @__PURE__ */ jsxs21(Fragment14, { children: [
      /* @__PURE__ */ jsx22(Badge8, { tone: "caution", children: "STALLED" }),
      " ",
      magnitudeOf22(row.affordableFraction) === 0 ? "no funds to draw, so no end date until the career can pay" : "no end date while work is stopped"
    ] });
  }
  if (magnitudeOf22(row.workRate) === null) {
    return /* @__PURE__ */ jsxs21(Fragment14, { children: [
      NULL_DISPLAY10,
      " RP-1 has not said what throttle this is running at"
    ] });
  }
  if (row.progress == null || row.totalPoints == null) {
    return /* @__PURE__ */ jsxs21(Fragment14, { children: [
      NULL_DISPLAY10,
      " RP-1 has not said how far along this is"
    ] });
  }
  return /* @__PURE__ */ jsxs21(Fragment14, { children: [
    NULL_DISPLAY10,
    " RP-1 has not costed this yet"
  ] });
}
var KIND_BADGE = {
  FacilityUpgrade: "FACILITY",
  LaunchComplex: "COMPLEX",
  Pad: "PAD"
};
function rowLabel(row) {
  if (row.facilityType !== void 0 && row.facilityType !== null) {
    return FACILITY_LABEL[row.facilityType] ?? row.name ?? row.facilityType;
  }
  return row.name ?? NULL_DISPLAY10;
}
function rowKey(row) {
  if (row.id != null) {
    return row.id;
  }
  return `${row.kind ?? ""}:${row.kscName ?? ""}:${row.lcId ?? ""}:${row.padId ?? ""}:${row.name ?? ""}`;
}
registerAugment10({
  id: "rp1-ksc-construction",
  augments: "space-center-status.sections",
  component: KscConstruction,
  // Ahead of the launch complexes, rather than left to whichever module the
  // bundler happened to evaluate first: a construction is work the career has
  // already committed money to, and a complex's rush mode is a setting. An
  // order that depends on import order is one a formatter can reverse.
  priority: 0,
  owner: RP1
});

// src/LaunchComplexStatus/index.tsx
import { registerAugment as registerAugment11, useTelemetry as useTelemetry12, value as value13 } from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge9,
  Countdown as Countdown2,
  Meter as Meter3,
  magnitudeOf as magnitudeOf23,
  NULL_DISPLAY as NULL_DISPLAY11,
  Row as Row11,
  RowName as RowName8,
  Section as Section9,
  SectionTitle as SectionTitle7,
  Stack as Stack15,
  Text as Text18
} from "@ksp-gonogo/ui-kit";
import { Fragment as Fragment15, jsx as jsx23, jsxs as jsxs22 } from "react/jsx-runtime";
function LaunchComplexStatus({
  siteName,
  expanded
}) {
  const available = current(useTelemetry12("rp1.available"));
  const pads = current(useTelemetry12("rp1.pads"));
  const complexes = current(useTelemetry12("rp1.complexes"));
  const operations = current(useTelemetry12("rp1.operations"));
  const warehouse = current(useTelemetry12("rp1.warehouse"));
  if (available !== true) {
    return null;
  }
  const pad = (pads ?? []).find((p) => p.launchSiteName === siteName);
  const operation = padOperation(operations, pad);
  const complex = pad ? (complexes ?? []).find((c) => c.lcId === pad.lcId) : void 0;
  if (pad === void 0) {
    return /* @__PURE__ */ jsxs22(Line, { children: [
      NULL_DISPLAY11,
      " not an RP-1 launch complex"
    ] });
  }
  const standing = standingOn(pad, operation, warehouse);
  if (!expanded) {
    return /* @__PURE__ */ jsxs22(Line, { children: [
      /* @__PURE__ */ jsx23(Badge9, { tone: padSeverity(pad, operation), children: padHeadline(pad, operation) }),
      " ",
      standing ?? PAD_STATE_MEANING[pad.status ?? "None"] ?? "state not recognised"
    ] });
  }
  const ratio = operation ? magnitudeOf23(operation.progressRatio) : null;
  return /* @__PURE__ */ jsxs22(Section9, { children: [
    /* @__PURE__ */ jsx23(SectionTitle7, { children: "LAUNCH COMPLEX" }),
    /* @__PURE__ */ jsxs22(Stack15, { as: "ul", gap: "related-dense", style: LIST_STYLE7, children: [
      /* @__PURE__ */ jsxs22(Row11, { children: [
        /* @__PURE__ */ jsx23(RowName8, { children: "Complex" }),
        /* @__PURE__ */ jsxs22(Text18, { children: [
          complex?.name ?? NULL_DISPLAY11,
          complex?.lcType ? ` \xB7 ${complex.lcType}` : ""
        ] })
      ] }),
      /* @__PURE__ */ jsxs22(Row11, { children: [
        /* @__PURE__ */ jsx23(RowName8, { children: "State" }),
        /* @__PURE__ */ jsxs22(Text18, { children: [
          /* @__PURE__ */ jsx23(Badge9, { tone: padSeverity(pad, operation), children: padHeadline(pad, operation) }),
          " ",
          PAD_STATE_MEANING[pad.status ?? "None"] ?? "state not recognised"
        ] })
      ] }),
      /* @__PURE__ */ jsxs22(Row11, { children: [
        /* @__PURE__ */ jsx23(RowName8, { children: "On the pad" }),
        /* @__PURE__ */ jsx23(Text18, { children: standing ?? "nothing standing on it" })
      ] }),
      operation !== void 0 && /* @__PURE__ */ jsxs22(Row11, { children: [
        /* @__PURE__ */ jsx23(RowName8, { children: OPERATION_VERB[operation.type ?? ""] ?? "Operation" }),
        /* @__PURE__ */ jsx23(Text18, { children: operation.timeLeftSeconds !== void 0 && operation.timeLeftSeconds !== null ? /* @__PURE__ */ jsx23(Countdown2, { value: operation.timeLeftSeconds }) : operation.stalled ? /* @__PURE__ */ jsx23(Badge9, { tone: "caution", children: "STALLED" }) : operation.progress == null || operation.totalPoints == null ? (
          /* Not "not costed yet", which would be untrue: an operation
             RP-1 quoted no rate for is already the stall above. This is
             the case where the work remaining would not read, so there
             are no two ends to measure between. */
          /* @__PURE__ */ jsxs22(Fragment15, { children: [
            NULL_DISPLAY11,
            " no reading of how far this move has got"
          ] })
        ) : /* @__PURE__ */ jsxs22(Fragment15, { children: [
          NULL_DISPLAY11,
          " not costed yet"
        ] }) })
      ] })
    ] }),
    ratio !== null && /* @__PURE__ */ jsx23(
      Meter3,
      {
        hideLabel: true,
        label: `Pad operation progress, ${pad.name ?? "pad"}`,
        value: value13("ratio", ratio)
      }
    )
  ] });
}
function padOperation(operations, pad) {
  const name = pad?.name;
  if (name === void 0 || name === null) return void 0;
  return (operations ?? []).find(
    (operation) => operation.launchPadId === name && operation.type !== void 0 && operation.type !== null && operation.type !== "None"
  );
}
function standingOn(pad, operation, warehouse) {
  if (pad.hasVesselWaiting === true) {
    return `${pad.waitingVesselName ?? NULL_DISPLAY11} is standing on it`;
  }
  if (operation !== void 0) {
    const vehicle = (warehouse ?? []).find(
      (item) => item.shipId !== void 0 && item.shipId !== null && item.shipId === operation.associatedVesselId
    );
    const name = vehicle?.shipName ?? NULL_DISPLAY11;
    if (operation.type === "Rollout") return `${name} is on its way out`;
    if (operation.type === "Rollback") return `${name} is coming off`;
    return void 0;
  }
  if (pad.hasVesselWaiting === void 0 || pad.hasVesselWaiting === null) {
    return `${NULL_DISPLAY11} RP-1 did not say whether a vehicle is waiting`;
  }
  return void 0;
}
function padHeadline(pad, operation) {
  if (pad.hasVesselWaiting === true) return "AT PAD";
  if (operation?.type === "Rollout") return "ROLLING OUT";
  if (operation?.type === "Rollback") return "ROLLING BACK";
  return (pad.status ?? "None").toUpperCase();
}
function padSeverity(pad, operation) {
  if (pad.hasVesselWaiting === true) return "go";
  if (operation !== void 0) return "caution";
  return pad.status === "Free" ? "go" : "caution";
}
function Line({ children }) {
  return /* @__PURE__ */ jsx23(Text18, { size: "xs", level: "muted", children });
}
var LIST_STYLE7 = { listStyle: "none", margin: 0, padding: 0 };
var PAD_STATE_MEANING = {
  Free: "clear for launch",
  Rollout: "a vehicle is rolling out to this pad",
  Rollback: "a vehicle is coming off this pad",
  Reconditioning: "being made good after the last launch",
  Nonoperational: "not operational",
  Destroyed: "destroyed, and needs repair before it can be used",
  None: "no state reported"
};
var OPERATION_VERB = {
  Rollout: "Rollout",
  Rollback: "Rollback",
  Reconditioning: "Reconditioning",
  Recovery: "Recovery",
  AirlaunchMount: "Mounting",
  AirlaunchUnmount: "Unmounting"
};
registerAugment11({
  id: "rp1-launch-complex-status",
  augments: "launch-director.pad",
  component: LaunchComplexStatus,
  owner: RP1
});

// src/ProgramDetail/index.tsx
import {
  registerAugment as registerAugment12,
  useCommand as useCommand8,
  useTelemetry as useTelemetry13,
  value as value14
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge10,
  Cluster as Cluster12,
  CommandButton as CommandButton13,
  DataTable as DataTable2,
  EmptyState as EmptyState6,
  ExpandableText,
  FilterRegion as FilterRegion2,
  Graph,
  GraphNotice,
  Grid as Grid4,
  Meter as Meter4,
  MissionDate as MissionDate8,
  magnitudeOf as magnitudeOf25,
  NULL_DISPLAY as NULL_DISPLAY12,
  Readout as Readout3,
  ReadoutCaption as ReadoutCaption4,
  Row as Row12,
  RowName as RowName9,
  Section as Section10,
  SectionTitle as SectionTitle8,
  SelectableRow as SelectableRow3,
  Stack as Stack16,
  SubjectHeading as SubjectHeading3,
  Text as Text19,
  Unit as Unit18,
  useRowFilter as useRowFilter2
} from "@ksp-gonogo/ui-kit";
import { useMemo, useState as useState13 } from "react";

// src/ProgramDetail/fundingCurve.ts
import { magnitudeOf as magnitudeOf24 } from "@ksp-gonogo/ui-kit";
var JULIAN_YEAR_SECONDS = 31557600;
function plainCurveKeys(keys) {
  if (keys === null || keys === void 0) return null;
  const plain = [];
  for (const key of keys) {
    const frac = magnitudeOf24(key.frac);
    const paidFraction = magnitudeOf24(key.paidFraction);
    const inTangent = magnitudeOf24(key.inTangent);
    const outTangent = magnitudeOf24(key.outTangent);
    if (frac === null || paidFraction === null || inTangent === null || outTangent === null) {
      continue;
    }
    plain.push({ frac, paidFraction, inTangent, outTangent });
  }
  if (plain.length === 0) return null;
  return plain.sort((a, b) => a.frac - b.frac);
}
function evaluateFundingCurve(keys, frac) {
  if (keys === null || keys.length === 0) return null;
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (frac <= first.frac) return first.paidFraction;
  if (frac >= last.frac) return last.paidFraction;
  for (let i = keys.length - 2; i >= 0; i--) {
    const k0 = keys[i];
    if (frac < k0.frac) continue;
    const k1 = keys[i + 1];
    if (!Number.isFinite(k0.outTangent) || !Number.isFinite(k1.inTangent)) {
      return k0.paidFraction;
    }
    const span = k1.frac - k0.frac;
    const t = (frac - k0.frac) / span;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * k0.paidFraction + (t3 - 2 * t2 + t) * span * k0.outTangent + (-2 * t3 + 3 * t2) * k1.paidFraction + (t3 - t2) * span * k1.inTangent;
  }
  return first.paidFraction;
}
function sampleFundingCurve({
  keys,
  totalFunds,
  durationSeconds,
  samples = 96
}) {
  if (keys === null || keys.length === 0 || totalFunds === null) return null;
  const years = durationSeconds !== null && durationSeconds > 0 ? durationSeconds / JULIAN_YEAR_SECONDS : null;
  const axis = years === null ? "fraction" : "years";
  const scale = years ?? 1;
  const lastFrac = keys[keys.length - 1].frac;
  const firstFrac = keys[0].frac;
  if (lastFrac <= firstFrac) return null;
  const points = [];
  for (let i = 0; i <= samples; i++) {
    const frac = firstFrac + (lastFrac - firstFrac) * i / samples;
    const paid = evaluateFundingCurve(keys, frac);
    if (paid === null) continue;
    points.push({
      x: frac * scale,
      funds: paid * totalFunds,
      fundsPerYear: null
    });
  }
  if (points.length < 2) return null;
  if (axis === "years") {
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      points[i].fundsPerYear = dx > 0 ? (points[i].funds - points[i - 1].funds) / dx : null;
    }
    points[0].fundsPerYear = points[1].fundsPerYear;
  }
  return { points, axis, nominalEnd: scale, end: lastFrac * scale };
}

// src/ProgramDetail/index.tsx
import { Fragment as Fragment16, jsx as jsx24, jsxs as jsxs23 } from "react/jsx-runtime";
var RP1_PROGRAM_ACCEPT_COMMAND = "rp1.program.accept";
var RP1_PROGRAM_COMPLETE_COMMAND = "rp1.program.complete";
function ProgramDetail({ screenId }) {
  const available = current(useTelemetry13("rp1.available"));
  const programs = current(useTelemetry13("rp1.programs"));
  const slotsReading = useTelemetry13("rp1.programSlots");
  const slots = current(slotsReading);
  const curves = current(useTelemetry13("rp1.programFundingCurves"));
  const confidenceReading = useTelemetry13("rp1.confidence");
  const confidence = current(confidenceReading);
  const careerReading = useTelemetry13("career.status");
  const [picked, setPicked] = useState13(null);
  const accept = useCommand8(RP1_PROGRAM_ACCEPT_COMMAND);
  const complete = useCommand8(RP1_PROGRAM_COMPLETE_COMMAND);
  const rows = programs ?? [];
  const chosen = choose2(rows, picked ?? "");
  if (screenId !== PROGRAMS_SCREEN_ID) {
    return null;
  }
  if (available !== true) {
    return null;
  }
  return /* @__PURE__ */ jsxs23(Section10, { gap: "related-comfortable", children: [
    /* @__PURE__ */ jsx24(SectionTitle8, { children: "PROGRAM DETAIL" }),
    /* @__PURE__ */ jsxs23(Cluster12, { align: "start", gap: "related-comfortable", justify: "start", wrap: true, children: [
      /* @__PURE__ */ jsx24(Balance, { caption: "Funds", children: /* @__PURE__ */ jsx24(Unit18, { value: careerReading.balances.funds }) }),
      /* @__PURE__ */ jsx24(Balance, { caption: "Confidence", children: /* @__PURE__ */ jsx24(Unit18, { value: confidenceReading.confidence }) }),
      /* @__PURE__ */ jsxs23(Balance, { caption: "Slots", children: [
        /* @__PURE__ */ jsx24(Unit18, { value: slotsReading.usedSlots }),
        " of",
        " ",
        /* @__PURE__ */ jsx24(Unit18, { value: slotsReading.maxSlots }),
        isFull(slots?.freeSlots) && /* @__PURE__ */ jsxs23(Fragment16, { children: [
          " ",
          /* @__PURE__ */ jsx24(Badge10, { tone: "caution", children: "FULL" })
        ] })
      ] })
    ] }),
    chosen === void 0 ? (
      /*
       * Two states reach here and neither is "this Program has no detail":
       * RP-1 is present (checked above) and the catalogue has either not
       * arrived yet or arrived empty. Both leave nothing to describe, which
       * is the one case worth a line: the surface is unreadable rather than
       * empty.
       */
      /* @__PURE__ */ jsx24(EmptyState6, { children: "RP-1 has not sent a Program catalogue" })
    ) : (
      /*
       * ONE interface: the catalogue, and the detail of whatever is picked out
       * of it. Side by side while there is width for two panes, stacked when
       * there is not, on the same `auto-fit` + `minmax` mechanism `Panel`'s
       * own section grid uses; `min(...,100%)` clamps the track to the pane so
       * a narrow tile stacks rather than scrolling sideways.
       *
       * It was a catalogue hidden behind a "Choose program" button above a
       * standing detail, which is the browse half the operator could not find.
       * That also inverted the game's own Administration screen, where the
       * strategy list stands open beside the selected strategy's description
       * and its one accept control (`KSP.UI.Screens.Administration`:
       * `scrollListStrategies` + `SetSelectedStrategy` + `btnAcceptCancel`).
       */
      /* @__PURE__ */ jsxs23(
        Grid4,
        {
          cols: MASTER_DETAIL_COLUMNS2,
          gap: "related-comfortable",
          align: "start",
          children: [
            /* @__PURE__ */ jsx24(
              ProgramCatalogue,
              {
                chosen,
                onPick: setPicked,
                programs: rows
              }
            ),
            /* @__PURE__ */ jsx24(
              ChosenProgram,
              {
                accept,
                complete,
                program: chosen,
                curves,
                confidenceHeld: magnitudeOf25(confidence?.confidence)
              }
            )
          ]
        }
      )
    )
  ] });
}
function Balance({
  caption,
  children
}) {
  return /* @__PURE__ */ jsxs23(Stack16, { gap: "caption", children: [
    /* @__PURE__ */ jsx24(ReadoutCaption4, { children: caption }),
    /* @__PURE__ */ jsx24(Readout3, { children })
  ] });
}
var MASTER_DETAIL_COLUMNS2 = "repeat(auto-fit, minmax(min(15rem, 100%), 1fr))";
var DETAIL_COLUMNS = "repeat(auto-fit, minmax(min(13rem, 100%), 1fr))";
var CATALOGUE_SCROLL2 = { maxHeight: "16rem", overflowY: "auto" };
function ProgramCatalogue({
  chosen,
  onPick,
  programs
}) {
  const filter = useRowFilter2({
    label: "Filter Programs",
    /* What the box MATCHES, rather than the label above it said twice: that
       "locked" narrows to the locked Programs is not something a search box
       announces by being one. */
    placeholder: "Name or state..."
  });
  const shown = ordered2(programs).filter(
    (program) => filter.matches(`${label2(program)} ${program.status ?? ""}`)
  );
  return /* @__PURE__ */ jsxs23(Section10, { gap: "caption", children: [
    /* @__PURE__ */ jsx24(SectionTitle8, { children: "CATALOGUE" }),
    /* @__PURE__ */ jsx24(FilterRegion2, { filter, children: shown.length === 0 ? (
      // A marker, not a paragraph: the operator can see what they typed, so
      // the only fact left to state is that nothing answers to it.
      /* @__PURE__ */ jsx24(EmptyState6, { children: "No Program matches the filter" })
    ) : /* @__PURE__ */ jsx24(
      Stack16,
      {
        "aria-label": "Program catalogue",
        gap: "caption",
        role: "group",
        style: CATALOGUE_SCROLL2,
        children: shown.map((program) => /* @__PURE__ */ jsx24(
          SelectableRow3,
          {
            onClick: () => onPick(program.name ?? ""),
            selected: program.name === chosen?.name,
            children: /* @__PURE__ */ jsx24(
              SubjectHeading3,
              {
                status: /* @__PURE__ */ jsx24(Badge10, { tone: severityOf(program.status), children: (program.status ?? NULL_DISPLAY12).toUpperCase() }),
                children: /* @__PURE__ */ jsx24(Text19, { size: "xs", children: label2(program) })
              }
            )
          },
          program.name ?? ""
        ))
      }
    ) })
  ] });
}
function ChosenProgram({
  accept,
  complete,
  program,
  curves,
  confidenceHeld
}) {
  const closes = program.programsToDisableOnAccept ?? [];
  return /* @__PURE__ */ jsxs23(Stack16, { gap: "related-comfortable", children: [
    /* @__PURE__ */ jsx24(
      SubjectHeading3,
      {
        status: /* @__PURE__ */ jsx24(Badge10, { tone: severityOf(program.status), children: (program.status ?? NULL_DISPLAY12).toUpperCase() }),
        children: /* @__PURE__ */ jsx24(Text19, { weight: "semibold", children: label2(program) })
      }
    ),
    /* @__PURE__ */ jsx24(
      AcceptControl,
      {
        confidenceHeld,
        handle: accept,
        program
      },
      program.name ?? ""
    ),
    /* @__PURE__ */ jsx24(RunningProgram, { complete, program }),
    /* @__PURE__ */ jsxs23(Grid4, { cols: DETAIL_COLUMNS, gap: "related-comfortable", align: "start", children: [
      /* @__PURE__ */ jsxs23(Section10, { children: [
        /* @__PURE__ */ jsx24(SectionTitle8, { children: "TERMS" }),
        /* @__PURE__ */ jsxs23(Stack16, { as: "ul", gap: "rows", style: LIST_STYLE8, children: [
          /* @__PURE__ */ jsxs23(Row12, { wrap: true, children: [
            /* @__PURE__ */ jsx24(RowName9, { children: "Speed" }),
            /* @__PURE__ */ jsx24(Text19, { children: speedLabel(program.speedOptions, program.speed) ?? NULL_DISPLAY12 })
          ] }),
          /* @__PURE__ */ jsxs23(Row12, { wrap: true, children: [
            /* @__PURE__ */ jsx24(RowName9, { children: "Slots taken" }),
            /* @__PURE__ */ jsx24(Text19, { children: /* @__PURE__ */ jsx24(Unit18, { value: program.slots }) })
          ] }),
          /* @__PURE__ */ jsxs23(Row12, { wrap: true, children: [
            /* @__PURE__ */ jsx24(RowName9, { children: "Duration" }),
            /* @__PURE__ */ jsx24(Text19, { children: /* @__PURE__ */ jsx24(Unit18, { value: program.durationSeconds }) })
          ] })
        ] })
      ] }),
      present(program.objectivesText) !== void 0 && /* @__PURE__ */ jsxs23(Section10, { children: [
        /* @__PURE__ */ jsx24(SectionTitle8, { children: "OBJECTIVES" }),
        /* @__PURE__ */ jsx24(Text19, { children: /* @__PURE__ */ jsx24(ExpandableText, { subject: "Objectives", children: program.objectivesText ?? "" }) })
      ] }),
      present(program.requirementsText) !== void 0 && /* @__PURE__ */ jsxs23(Section10, { children: [
        /* @__PURE__ */ jsx24(SectionTitle8, { children: "REQUIREMENTS" }),
        /* @__PURE__ */ jsx24(Text19, { children: /* @__PURE__ */ jsx24(ExpandableText, { subject: "Requirements", children: program.requirementsText ?? "" }) })
      ] }),
      /* @__PURE__ */ jsxs23(Section10, { children: [
        /* @__PURE__ */ jsx24(SectionTitle8, { children: "FUNDING" }),
        /* @__PURE__ */ jsxs23(Stack16, { as: "ul", gap: "rows", style: LIST_STYLE8, children: [
          /* @__PURE__ */ jsxs23(Row12, { wrap: true, children: [
            /* @__PURE__ */ jsx24(RowName9, { children: "Total" }),
            /* @__PURE__ */ jsx24(Text19, { children: /* @__PURE__ */ jsx24(Unit18, { value: program.totalFunding }) })
          ] }),
          /* @__PURE__ */ jsxs23(Row12, { wrap: true, children: [
            /* @__PURE__ */ jsx24(RowName9, { children: "Paid out" }),
            /* @__PURE__ */ jsx24(Text19, { children: /* @__PURE__ */ jsx24(Unit18, { value: program.fundsPaidOut }) })
          ] }),
          /* @__PURE__ */ jsxs23(Row12, { wrap: true, children: [
            /* @__PURE__ */ jsx24(RowName9, { children: "Remaining" }),
            /* @__PURE__ */ jsx24(Text19, { children: /* @__PURE__ */ jsx24(Unit18, { value: program.fundsRemaining }) })
          ] }),
          /* @__PURE__ */ jsxs23(Row12, { wrap: true, children: [
            /* @__PURE__ */ jsx24(RowName9, { children: "Curve" }),
            /* @__PURE__ */ jsx24(Text19, { children: curveName(program, curves) })
          ] }),
          program.status !== "active" && /* @__PURE__ */ jsxs23(Row12, { wrap: true, children: [
            /* @__PURE__ */ jsx24(RowName9, { children: present(program.completedUt) === void 0 ? "Deadline" : "Completed" }),
            /* @__PURE__ */ jsx24(Text19, { children: /* @__PURE__ */ jsx24(
              MissionDateOrAbsent,
              {
                ut: program.completedUt ?? program.deadlineUt
              }
            ) })
          ] }),
          /* @__PURE__ */ jsxs23(Row12, { wrap: true, children: [
            /* @__PURE__ */ jsx24(RowName9, { children: "Accepted" }),
            /* @__PURE__ */ jsx24(Text19, { children: /* @__PURE__ */ jsx24(MissionDateOrAbsent, { ut: program.acceptedUt }) })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx24(FundingCurveChart, { program, curves }),
      /* @__PURE__ */ jsx24(PaymentSchedule, { program }),
      program.canAccept !== true && /* @__PURE__ */ jsx24(
        SpeedLadder,
        {
          options: program.speedOptions,
          chosen: program.speed,
          confidenceHeld
        }
      ),
      closes.length > 0 && /* @__PURE__ */ jsxs23(Section10, { children: [
        /* @__PURE__ */ jsx24(SectionTitle8, { children: "CLOSES OFF ON ACCEPT" }),
        /* @__PURE__ */ jsx24(Stack16, { as: "ul", gap: "rows", style: LIST_STYLE8, children: closes.map((name) => /* @__PURE__ */ jsxs23(Row12, { children: [
          /* @__PURE__ */ jsx24(RowName9, { children: name }),
          /* @__PURE__ */ jsx24(Text19, {})
        ] }, name)) })
      ] })
    ] })
  ] });
}
function AcceptControl({
  confidenceHeld,
  handle,
  program
}) {
  const [picked, setPicked] = useState13(null);
  if (program.canAccept !== true) {
    return null;
  }
  const options = offeredSpeeds(program);
  const speed = picked ?? program.speed ?? options[0]?.speed ?? null;
  const cost = options.find((option) => option.speed === speed)?.confidenceCost ?? (speed === program.speed ? program.confidenceCost : null);
  const short = outOfReach(cost, confidenceHeld);
  const name = label2(program);
  const speedName = speedLabel(program.speedOptions, speed);
  return /* @__PURE__ */ jsxs23(Section10, { children: [
    /* @__PURE__ */ jsx24(SectionTitle8, { children: "ACCEPT" }),
    options.length > 0 && /* @__PURE__ */ jsx24(
      Stack16,
      {
        "aria-label": `Speed to accept ${name} at`,
        gap: "caption",
        role: "group",
        children: options.map((option) => /* @__PURE__ */ jsx24(
          SpeedChoice,
          {
            confidenceHeld,
            onPick: setPicked,
            option,
            selected: option.speed === speed
          },
          option.speed
        ))
      }
    ),
    /* @__PURE__ */ jsxs23(Cluster12, { gap: "related-dense", justify: "start", wrap: true, children: [
      /* @__PURE__ */ jsxs23(Text19, { size: "sm", level: "muted", children: [
        speed === null ? /* @__PURE__ */ jsxs23(Fragment16, { children: [
          NULL_DISPLAY12,
          " RP-1 did not say which speeds this Program offers"
        ] }) : cost == null ? /* @__PURE__ */ jsxs23(Fragment16, { children: [
          NULL_DISPLAY12,
          " RP-1 did not price ",
          speedName,
          " speed"
        ] }) : /* @__PURE__ */ jsxs23(Fragment16, { children: [
          /* @__PURE__ */ jsx24(Unit18, { value: cost }),
          " Confidence at ",
          speedName,
          " speed"
        ] }),
        short && /* @__PURE__ */ jsxs23(Fragment16, { children: [
          " ",
          /* @__PURE__ */ jsx24(Badge10, { tone: "caution", children: "SHORT" })
        ] })
      ] }),
      /* @__PURE__ */ jsx24(
        CommandButton13,
        {
          args: { strategyId: program.name, speed: speed ?? void 0 },
          "aria-label": short || speed === null ? void 0 : `Accept ${name}`,
          commandLabel: `Accept ${name} at ${speedName ?? NULL_DISPLAY12} speed`,
          confirmAriaLabel: `Confirm accepting ${name}`,
          confirmLabel: /* @__PURE__ */ jsx24(AcceptWording, { cost, speed: speedName }),
          disabled: short || speed === null,
          handle,
          label: "Accept",
          size: "sm",
          title: speed === null ? "RP-1 accepts a Program only at a named speed, and it has not said which it offers" : short ? "RP-1 charges the whole Confidence price for this speed when the Program is accepted, and the career is short of it" : void 0
        }
      )
    ] })
  ] });
}
function speedLabel(options, speed) {
  if (speed === null || speed === void 0) {
    return null;
  }
  const label3 = present(options)?.find((option) => option.speed === speed)?.label;
  return typeof label3 === "string" && label3 !== "" ? label3 : speed;
}
function offeredSpeeds(program) {
  const ladder = present(program.speedOptions) ?? [];
  return ladder.filter(
    (option) => typeof option.speed === "string" && option.speed !== ""
  );
}
function SpeedChoice({
  confidenceHeld,
  onPick,
  option,
  selected
}) {
  const speed = option.speed ?? "";
  return /* @__PURE__ */ jsxs23(SelectableRow3, { onClick: () => onPick(speed), selected, children: [
    /* @__PURE__ */ jsx24(
      SubjectHeading3,
      {
        status: outOfReach(option.confidenceCost, confidenceHeld) && /* @__PURE__ */ jsx24(Badge10, { tone: "caution", children: "SHORT" }),
        children: /* @__PURE__ */ jsx24(Text19, { size: "xs", children: option.label ?? speed })
      }
    ),
    /* @__PURE__ */ jsxs23(Text19, { size: "xs", level: "muted", children: [
      /* @__PURE__ */ jsx24(Unit18, { value: option.confidenceCost }),
      " Confidence, runs",
      " ",
      /* @__PURE__ */ jsx24(Unit18, { value: option.durationSeconds }),
      ", pays",
      " ",
      /* @__PURE__ */ jsx24(Unit18, { value: option.fundingPerDay }),
      " on average"
    ] })
  ] });
}
function RunningProgram({
  complete,
  program
}) {
  if (program.status !== "active") {
    return null;
  }
  const ratio = magnitudeOf25(program.fracElapsed);
  const overrun = ratio !== null && ratio >= 1;
  const ready = program.canComplete === true;
  return /* @__PURE__ */ jsxs23(Section10, { children: [
    /* @__PURE__ */ jsx24(SectionTitle8, { children: "RUNNING" }),
    (ready || overrun) && /* @__PURE__ */ jsxs23(Cluster12, { gap: "related-dense", justify: "start", wrap: true, children: [
      ready && /* @__PURE__ */ jsx24(Badge10, { tone: "info", children: "READY TO COMPLETE" }),
      overrun && /* @__PURE__ */ jsx24(Badge10, { tone: "caution", children: "OVERRUN" })
    ] }),
    /* @__PURE__ */ jsxs23(Stack16, { as: "ul", gap: "rows", style: LIST_STYLE8, children: [
      /* @__PURE__ */ jsxs23(Row12, { wrap: true, children: [
        /* @__PURE__ */ jsx24(RowName9, { children: "Paid" }),
        /* @__PURE__ */ jsxs23(Text19, { children: [
          /* @__PURE__ */ jsx24(Unit18, { value: program.fundsPaidOut }),
          " of",
          " ",
          /* @__PURE__ */ jsx24(Unit18, { value: program.totalFunding })
        ] })
      ] }),
      /* @__PURE__ */ jsxs23(Row12, { wrap: true, children: [
        /* @__PURE__ */ jsx24(RowName9, { children: "Deadline" }),
        /* @__PURE__ */ jsx24(Text19, { children: /* @__PURE__ */ jsx24(MissionDateOrAbsent, { ut: program.deadlineUt }) })
      ] }),
      overrun && /* @__PURE__ */ jsxs23(Row12, { wrap: true, children: [
        /* @__PURE__ */ jsx24(RowName9, { children: "Overrun cost" }),
        /* @__PURE__ */ jsxs23(Text19, { children: [
          /* @__PURE__ */ jsx24(Unit18, { value: program.repPenaltyAssessed }),
          " lost, at",
          " ",
          /* @__PURE__ */ jsx24(Unit18, { value: program.repPenaltyPerYearLate }),
          " per year"
        ] })
      ] })
    ] }),
    ratio !== null && /* @__PURE__ */ jsx24(
      Meter4,
      {
        hideLabel: true,
        label: `Program funding drawn down, ${label2(program)}`,
        value: value14("ratio", Math.min(ratio, 1))
      }
    ),
    /* @__PURE__ */ jsx24(
      CompleteControl,
      {
        handle: complete,
        overrun,
        program
      }
    )
  ] });
}
function CompleteControl({
  handle,
  overrun,
  program
}) {
  const ready = program.canComplete === true;
  const name = label2(program);
  return /* @__PURE__ */ jsxs23(Cluster12, { gap: "related-dense", justify: "start", wrap: true, children: [
    /* @__PURE__ */ jsxs23(Text19, { size: "sm", level: "muted", children: [
      /* @__PURE__ */ jsx24(Unit18, { value: program.repForComplete }),
      " earned now",
      ready && overrun && /* @__PURE__ */ jsxs23(Fragment16, { children: [
        ", ",
        /* @__PURE__ */ jsx24(Unit18, { value: program.repPenaltyPerYearLate }),
        " lost per year unclaimed"
      ] })
    ] }),
    /* @__PURE__ */ jsx24(
      CommandButton13,
      {
        args: { strategyId: program.name },
        "aria-label": ready ? `Complete ${name}` : void 0,
        commandLabel: `Complete ${name}`,
        confirmAriaLabel: `Confirm completing ${name}`,
        confirmLabel: /* @__PURE__ */ jsx24(CompleteWording, { rep: program.repForComplete }),
        disabled: !ready,
        handle,
        label: "Complete",
        size: "sm",
        title: ready ? void 0 : "RP-1 completes a Program only once its objectives are met"
      }
    )
  ] });
}
function CompleteWording({
  rep
}) {
  return /* @__PURE__ */ jsxs23(Fragment16, { children: [
    "Earn ",
    /* @__PURE__ */ jsx24(Unit18, { value: rep })
  ] });
}
function AcceptWording({
  cost,
  speed
}) {
  return /* @__PURE__ */ jsxs23(Fragment16, { children: [
    "Spend ",
    cost == null ? NULL_DISPLAY12 : /* @__PURE__ */ jsx24(Unit18, { value: cost }),
    " Confidence for ",
    speed ?? NULL_DISPLAY12
  ] });
}
function FundingCurveChart({
  program,
  curves
}) {
  const sample = useMemo(
    () => sampleFundingCurve({
      keys: plainCurveKeys(resolveCurve(program, curves)?.keys),
      totalFunds: magnitudeOf25(program.totalFunding),
      durationSeconds: magnitudeOf25(program.durationSeconds)
    }),
    [program, curves]
  );
  const paidOut = magnitudeOf25(program.fundsPaidOut);
  const perYear = sample?.points.some((p) => p.fundsPerYear !== null);
  return /* @__PURE__ */ jsxs23(Section10, { children: [
    /* @__PURE__ */ jsx24(SectionTitle8, { children: "FUNDING CURVE" }),
    sample === null ? /* @__PURE__ */ jsx24(GraphNotice, { placement: "inline", children: present(curves) === void 0 ? "RP-1 has not sent its funding-curve table" : "no funding curve for this Program" }) : /* @__PURE__ */ jsxs23(Stack16, { gap: "caption", children: [
      /* @__PURE__ */ jsx24(
        Graph,
        {
          chrome: "bare",
          height: 140,
          "aria-label": perYear ? `Funding per year over the duration of ${label2(program)}` : `Cumulative funding over the duration of ${label2(program)}`,
          series: [
            {
              id: "funding",
              label: perYear ? "Funding per year" : "Cumulative funding",
              axis: "primary",
              color: "var(--color-go-text)",
              data: {
                x: sample.points.map((p) => p.x),
                y: sample.points.map(
                  (p) => perYear ? p.fundsPerYear ?? 0 : p.funds
                )
              }
            }
          ],
          xKind: "value",
          xDomain: [sample.points[0]?.x ?? 0, sample.end],
          xTickFormat: termTick,
          xReadFormat: termTick,
          xAxisLabel: sample.axis === "years" ? "years" : "fraction of term",
          yUnit: "funds",
          yAxisLabel: perYear ? "funds per year" : "funds",
          thresholds: perYear || paidOut === null ? [] : [
            {
              id: "paid",
              kind: "marker",
              label: "Paid out",
              value: value14("funds", paidOut)
            }
          ]
        }
      ),
      /* @__PURE__ */ jsxs23(Cluster12, { gap: "related-dense", wrap: true, children: [
        /* @__PURE__ */ jsx24(Text19, { size: "xs", level: "muted", children: perYear ? /* @__PURE__ */ jsx24(Fragment16, { children: "funds per year across the term" }) : /* @__PURE__ */ jsxs23(Fragment16, { children: [
          /* @__PURE__ */ jsx24(Unit18, { value: value14("funds", 0) }),
          " at start"
        ] }) }),
        /* @__PURE__ */ jsx24(Text19, { size: "xs", level: "muted", children: sample.axis === "years" ? /* @__PURE__ */ jsxs23(Fragment16, { children: [
          "full term ",
          /* @__PURE__ */ jsx24(Unit18, { value: program.durationSeconds })
        ] }) : /* @__PURE__ */ jsx24(Fragment16, { children: "axis in fractions of the term, which RP-1 has not published" }) }),
        /* @__PURE__ */ jsxs23(Text19, { size: "xs", level: "muted", children: [
          /* @__PURE__ */ jsx24(Unit18, { value: program.totalFunding }),
          " ",
          perYear ? /* @__PURE__ */ jsx24(Fragment16, { children: "in total" }) : /* @__PURE__ */ jsx24(Fragment16, { children: "at term" })
        ] })
      ] }),
      !perYear && paidOut !== null && /* @__PURE__ */ jsxs23(Text19, { size: "xs", level: "muted", children: [
        "Rule: ",
        /* @__PURE__ */ jsx24(Unit18, { value: program.fundsPaidOut }),
        " paid so far"
      ] })
    ] })
  ] });
}
function termTick(x) {
  return String(Number(x.toFixed(2)));
}
function PaymentSchedule({ program }) {
  const schedule = present(program.fundingPayments);
  if (schedule === void 0) {
    if (program.status === "active" && (magnitudeOf25(program.fundsPaidOut) === null || magnitudeOf25(program.fracElapsed) === null)) {
      return /* @__PURE__ */ jsxs23(Section10, { children: [
        /* @__PURE__ */ jsx24(SectionTitle8, { children: "FUNDING SUMMARY" }),
        /* @__PURE__ */ jsxs23(Text19, { size: "xs", level: "muted", children: [
          NULL_DISPLAY12,
          " RP-1 has not said what this Program has been paid so far, and every remaining year is measured from that"
        ] })
      ] });
    }
    return null;
  }
  return /* @__PURE__ */ jsxs23(Section10, { children: [
    /* @__PURE__ */ jsx24(SectionTitle8, { children: "FUNDING SUMMARY" }),
    /* @__PURE__ */ jsx24(
      DataTable2,
      {
        caption: "Funding paid per nominal year of this Program",
        rows: schedule,
        rowKey: (row) => String(magnitudeOf25(row.year) ?? ""),
        columns: [
          {
            /* "Year", not "Nominal year". The caption above already says which
               calendar these are counted on, and the longer header was the
               widest thing in the table: it held all three columns 6ch wider
               than the readings need and pushed "Cumulative" into the table's
               own horizontal scroller at the Administration Building's narrower
               tiles. */
            key: "year",
            header: "Year",
            render: (row) => /* @__PURE__ */ jsx24(Unit18, { value: row.year }),
            minWidth: "6ch"
          },
          {
            key: "funds",
            header: "Pays",
            align: "end",
            render: (row) => /* @__PURE__ */ jsx24(Unit18, { value: row.funds }),
            minWidth: "10ch"
          },
          {
            key: "cumulative",
            header: "Cumulative",
            align: "end",
            render: (row) => /* @__PURE__ */ jsx24(Unit18, { value: row.cumulativeFunds }),
            minWidth: "10ch"
          }
        ]
      }
    )
  ] });
}
function SpeedLadder({
  options,
  chosen,
  confidenceHeld
}) {
  const ladder = present(options);
  if (ladder === void 0 || ladder.length === 0) {
    return null;
  }
  return /* @__PURE__ */ jsxs23(Section10, { children: [
    /* @__PURE__ */ jsx24(SectionTitle8, { children: "SPEED" }),
    /* @__PURE__ */ jsx24(
      DataTable2,
      {
        caption: "Confidence price and duration at each speed this Program can be accepted at",
        rows: ladder,
        rowKey: (row) => row.speed ?? "",
        columns: [
          {
            key: "speed",
            header: "Speed",
            render: (row) => /* @__PURE__ */ jsxs23(Text19, { children: [
              row.label ?? row.speed ?? NULL_DISPLAY12,
              row.speed === chosen && /* @__PURE__ */ jsxs23(Fragment16, { children: [
                " ",
                /* @__PURE__ */ jsx24(Badge10, { tone: "info", children: "SELECTED" })
              ] })
            ] }),
            /* The speeds are one short word each ("Slow", "Normal", "Fast");
               the floor only has to hold the widest of them beside its SELECTED
               badge, which wraps under it. */
            minWidth: "9ch"
          },
          {
            key: "confidence",
            header: "Confidence",
            align: "end",
            render: (row) => /* @__PURE__ */ jsxs23(Text19, { children: [
              /* @__PURE__ */ jsx24(Unit18, { value: row.confidenceCost }),
              outOfReach(row.confidenceCost, confidenceHeld) && /* @__PURE__ */ jsxs23(Fragment16, { children: [
                " ",
                /* @__PURE__ */ jsx24(Badge10, { tone: "caution", children: "SHORT" })
              ] })
            ] }),
            /* The header is the widest thing in this column: the prices are
               three digits and the SHORT badge wraps under them. */
            minWidth: "10ch"
          },
          {
            key: "duration",
            header: "Term",
            align: "end",
            render: (row) => /* @__PURE__ */ jsx24(Unit18, { value: row.durationSeconds }),
            /* "9y 183d" is the widest term RP-1 offers and the header is
               shorter than that, so 8ch is the column and 10ch was 2ch of slack
               the narrow tiles could not spare. */
            minWidth: "8ch"
          }
        ]
      }
    )
  ] });
}
function MissionDateOrAbsent({
  ut
}) {
  if (ut === void 0 || ut === null) {
    return /* @__PURE__ */ jsxs23(Fragment16, { children: [
      NULL_DISPLAY12,
      " not set"
    ] });
  }
  return /* @__PURE__ */ jsx24(MissionDate8, { value: ut });
}
var LIST_STYLE8 = { listStyle: "none", margin: 0, padding: 0 };
function choose2(rows, wanted) {
  const named = rows.find((p) => p.name === wanted && wanted !== "");
  if (named !== void 0) return named;
  return rows.find((p) => p.status === "active") ?? ordered2(rows)[0];
}
function ordered2(rows) {
  const rank = (status) => {
    if (status === "active") return 0;
    if (status === "offerable") return 1;
    if (status === "completed") return 2;
    return 3;
  };
  return [...rows].sort(
    (a, b) => rank(a.status) - rank(b.status) || label2(a).localeCompare(label2(b))
  );
}
function label2(program) {
  return program.title ?? program.name ?? NULL_DISPLAY12;
}
function resolveCurve(program, curves) {
  const table = present(curves);
  if (table === void 0) return void 0;
  const wanted = present(program.fundingCurve);
  const named = wanted === void 0 ? void 0 : table.find((c) => present(c.name) === wanted);
  return named ?? table.find((c) => c.isDefault === true);
}
function curveName(program, curves) {
  const named = present(program.fundingCurve);
  if (named !== void 0) return named;
  const fallback = present(resolveCurve(program, curves)?.name);
  if (fallback !== void 0) return `${fallback} (default)`;
  return NULL_DISPLAY12;
}
function present(field) {
  return field ?? void 0;
}
function severityOf(status) {
  if (status === "active") return "info";
  if (status === "disabled") return "caution";
  return "go";
}
function isFull(freeSlots) {
  const free = magnitudeOf25(freeSlots);
  return free !== null && free <= 0;
}
function outOfReach(cost, held) {
  const price = magnitudeOf25(cost);
  return price !== null && held !== null && held < price;
}
registerAugment12({
  id: "rp1-program-detail",
  augments: "administration-building.screen-body",
  component: ProgramDetail,
  channels: [
    "rp1.available",
    "rp1.programs",
    "rp1.programSlots",
    "rp1.programFundingCurves",
    "rp1.confidence",
    /* The spend rule: this quotes a Confidence price against a funds return,
       so both balances have to be in it. The host carries `career.status`
       already, and naming it here is what makes that independent of the host. */
    "career.status"
  ],
  requires: "rp1",
  owner: RP1
});

// src/ResearchQueue/index.tsx
import {
  registerAugment as registerAugment13,
  useCommand as useCommand9,
  useTelemetry as useTelemetry14,
  value as value16
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge11,
  Countdown as Countdown3,
  Meter as Meter5,
  magnitudeOf as magnitudeOf27,
  NULL_DISPLAY as NULL_DISPLAY14,
  Row as Row13,
  RowName as RowName10,
  Section as Section11,
  SectionTitle as SectionTitle9,
  Stack as Stack18,
  Text as Text21,
  Unit as Unit20
} from "@ksp-gonogo/ui-kit";

// src/ResearchQueue/RateControl.tsx
import { magnitudeOf as magnitudeOf26, value as value15 } from "@ksp-gonogo/sitrep-sdk";
import {
  Cluster as Cluster13,
  CommandButton as CommandButton14,
  MissionDate as MissionDate9,
  NULL_DISPLAY as NULL_DISPLAY13,
  Stack as Stack17,
  Stepper as Stepper3,
  Text as Text20,
  Unit as Unit19
} from "@ksp-gonogo/ui-kit";
import { useState as useState14 } from "react";
import { Fragment as Fragment17, jsx as jsx25, jsxs as jsxs24 } from "react/jsx-runtime";
var RP1_RESEARCH_SET_RATE_COMMAND = "rp1.research.setRate";
var STEPS_PER_UNIT2 = 20;
var STEPS3 = Array.from({ length: STEPS_PER_UNIT2 + 1 }, (_, step) => step);
var percent2 = (step) => `${step * 5}%`;
var formatRate = (step) => `${percent2(step)} work rate`;
function stepOf2(workRate) {
  const rate = magnitudeOf26(workRate);
  return rate === null ? null : Math.round(rate * STEPS_PER_UNIT2);
}
function ResearchRateControl({
  queue,
  rates,
  handle
}) {
  const head = queue[0];
  const current2 = stepOf2(head?.workRate);
  const [chosen, setChosen] = useState14(null);
  if (head === void 0 || current2 === null) {
    return null;
  }
  const step = chosen ?? current2;
  const priced = (rates?.steps ?? []).find((s) => stepOf2(s.workRate) === step);
  const now = (rates?.steps ?? []).find((s) => stepOf2(s.workRate) === current2);
  const sameNode = rates?.techId != null && rates.techId === head.techId;
  const node = head.techName ?? head.techId ?? "the node";
  return /* @__PURE__ */ jsxs24(Cluster13, { align: "start", gap: "related-dense", justify: "start", wrap: true, children: [
    /* @__PURE__ */ jsx25(
      Stepper3,
      {
        format: formatRate,
        label: "Research work rate",
        onChange: setChosen,
        options: STEPS3,
        value: step,
        children: /* @__PURE__ */ jsxs24(Stack17, { gap: "caption", children: [
          /* @__PURE__ */ jsx25(Text20, { size: "xs", level: "muted", children: /* @__PURE__ */ jsx25(
            StepReadout2,
            {
              step,
              priced,
              node,
              dated: sameNode
            }
          ) }),
          step !== current2 && priced !== void 0 && now !== void 0 && /* @__PURE__ */ jsx25(Text20, { size: "xs", level: "muted", children: /* @__PURE__ */ jsx25(Change, { priced, now }) })
        ] })
      }
    ),
    /* @__PURE__ */ jsx25(
      CommandButton14,
      {
        args: { workRate: step / STEPS_PER_UNIT2 },
        "aria-label": step === current2 ? `Research is already at ${percent2(step)}` : `Set research to ${percent2(step)}`,
        commandLabel: `Set research to ${percent2(step)}`,
        confirmLabel: `Set ${percent2(step)}`,
        disabled: step === current2,
        handle,
        label: "Set rate",
        size: "sm"
      }
    )
  ] });
}
function StepReadout2({
  step,
  priced,
  node,
  dated
}) {
  if (priced === void 0 || priced.researcherSalaryPerDay == null) {
    return /* @__PURE__ */ jsxs24(Fragment17, { children: [
      NULL_DISPLAY13,
      " RP-1 has not priced this rate yet"
    ] });
  }
  const salary = /* @__PURE__ */ jsx25(Unit19, { decimals: 0, value: priced.researcherSalaryPerDay });
  if (step === 0) {
    return /* @__PURE__ */ jsxs24(Fragment17, { children: [
      "stopped: researchers still paid ",
      salary,
      ", no Unlock Credit, ",
      node,
      " never finishes"
    ] });
  }
  return /* @__PURE__ */ jsxs24(Fragment17, { children: [
    "researchers paid ",
    salary,
    priced.unlockCreditPerDay != null && /* @__PURE__ */ jsxs24(Fragment17, { children: [
      ", Unlock Credit ",
      /* @__PURE__ */ jsx25(Unit19, { decimals: 0, value: priced.unlockCreditPerDay })
    ] }),
    dated && priced.finishesAt != null && /* @__PURE__ */ jsxs24(Fragment17, { children: [
      ", ",
      node,
      " done ",
      /* @__PURE__ */ jsx25(MissionDate9, { value: priced.finishesAt })
    ] })
  ] });
}
function Change({
  priced,
  now
}) {
  const pay = difference(priced.researcherSalaryPerDay, now.researcherSalaryPerDay);
  const credit = difference(priced.unlockCreditPerDay, now.unlockCreditPerDay);
  if (pay === null && credit === null) {
    return null;
  }
  return /* @__PURE__ */ jsxs24(Fragment17, { children: [
    "against now:",
    pay !== null && /* @__PURE__ */ jsxs24(Fragment17, { children: [
      " pay ",
      pay
    ] }),
    pay !== null && credit !== null && ",",
    credit !== null && /* @__PURE__ */ jsxs24(Fragment17, { children: [
      " Unlock Credit ",
      credit
    ] })
  ] });
}
function difference(chosen, now) {
  const a = magnitudeOf26(chosen);
  const b = magnitudeOf26(now);
  if (a === null || b === null) {
    return null;
  }
  const delta = a - b;
  return /* @__PURE__ */ jsxs24(Fragment17, { children: [
    /* @__PURE__ */ jsx25(Unit19, { decimals: 0, value: value15("f/day", Math.abs(delta)) }),
    " ",
    delta < 0 ? "less" : "more"
  ] });
}

// src/ResearchQueue/index.tsx
import { Fragment as Fragment18, jsx as jsx26, jsxs as jsxs25 } from "react/jsx-runtime";
function ResearchQueue() {
  const available = current(useTelemetry14("rp1.available"));
  const research = current(useTelemetry14("rp1.research"));
  const rates = current(useTelemetry14("rp1.researchRates"));
  const setRate = useCommand9(RP1_RESEARCH_SET_RATE_COMMAND);
  if (available !== true) {
    return null;
  }
  const queue = research ?? [];
  if (queue.length === 0) {
    return /* @__PURE__ */ jsxs25(Section11, { children: [
      /* @__PURE__ */ jsx26(SectionTitle9, { children: "RESEARCH QUEUE" }),
      /* @__PURE__ */ jsx26(Text21, { children: "Nothing queued. Researchers are idle." })
    ] });
  }
  return /* @__PURE__ */ jsxs25(Section11, { children: [
    /* @__PURE__ */ jsx26(SectionTitle9, { children: "RESEARCH QUEUE" }),
    /* @__PURE__ */ jsx26(ResearchRateControl, { queue, rates, handle: setRate }),
    /* @__PURE__ */ jsx26(Stack18, { as: "ul", gap: "related-dense", style: LIST_STYLE9, children: queue.map((node) => /* @__PURE__ */ jsx26(ResearchRow, { node }, node.techId ?? "")) })
  ] });
}
function ResearchRow({ node }) {
  const ratio = magnitudeOf27(node.progressRatio);
  const workRate = magnitudeOf27(node.workRate);
  return /* @__PURE__ */ jsxs25(Stack18, { as: "li", gap: "caption", children: [
    /* @__PURE__ */ jsxs25(Stack18, { as: "ul", gap: "rows", style: LIST_STYLE9, children: [
      /* @__PURE__ */ jsxs25(Row13, { wrap: true, children: [
        /* @__PURE__ */ jsx26(RowName10, { children: node.techName ?? node.techId ?? NULL_DISPLAY14 }),
        /* @__PURE__ */ jsx26(Text21, { children: node.timeLeftSeconds !== void 0 && node.timeLeftSeconds !== null ? /* @__PURE__ */ jsx26(Countdown3, { value: node.timeLeftSeconds }) : node.stalled === true ? /* @__PURE__ */ jsx26(Badge11, { tone: "caution", children: "STALLED" }) : workRate === null ? (
          /* A different absence from the one below: the throttle is what
             the rate is derived FROM, so a node whose throttle would not
             read has no ETA even once RP-1 has costed it. */
          /* @__PURE__ */ jsxs25(Fragment18, { children: [
            NULL_DISPLAY14,
            " no throttle reading"
          ] })
        ) : node.progress == null || node.scienceCost == null ? (
          /* Not the sentence below, which would be a falsehood here: the
             throttle and the rate both read, so RP-1 HAS costed this node.
             What would not read is where it stands, and an ETA needs both
             ends of the work remaining. Sending an operator to wait for a
             recalculation that already happened is the worse answer. */
          /* @__PURE__ */ jsxs25(Fragment18, { children: [
            NULL_DISPLAY14,
            " no reading of how far along this is"
          ] })
        ) : /* @__PURE__ */ jsxs25(Fragment18, { children: [
          NULL_DISPLAY14,
          " not costed yet"
        ] }) })
      ] }),
      /* @__PURE__ */ jsxs25(Row13, { wrap: true, children: [
        /* @__PURE__ */ jsx26(RowName10, { children: "Progress" }),
        /* @__PURE__ */ jsxs25(Text21, { children: [
          /* @__PURE__ */ jsx26(Unit20, { value: node.progress }),
          " / ",
          /* @__PURE__ */ jsx26(Unit20, { value: node.scienceCost }),
          workRate !== null && workRate < 1 && /* @__PURE__ */ jsxs25(Fragment18, { children: [
            " \xB7 throttled to ",
            /* @__PURE__ */ jsx26(Unit20, { value: node.workRate })
          ] })
        ] })
      ] }),
      node.startYear !== void 0 && node.startYear !== null && /* @__PURE__ */ jsxs25(Row13, { wrap: true, children: [
        /* @__PURE__ */ jsx26(RowName10, { children: "Era" }),
        /* @__PURE__ */ jsxs25(Text21, { children: [
          /* @__PURE__ */ jsx26(Unit20, { value: node.startYear }),
          node.endYear !== void 0 && node.endYear !== null && /* @__PURE__ */ jsxs25(Fragment18, { children: [
            " to ",
            /* @__PURE__ */ jsx26(Unit20, { value: node.endYear })
          ] })
        ] })
      ] })
    ] }),
    ratio !== null && /* @__PURE__ */ jsx26(
      Meter5,
      {
        hideLabel: true,
        label: `Research progress, ${node.techName ?? node.techId ?? "node"}`,
        value: value16("ratio", ratio)
      }
    )
  ] });
}
var LIST_STYLE9 = { listStyle: "none", margin: 0, padding: 0 };
registerAugment13({
  id: "rp1-research-queue",
  augments: "research-and-development.sections",
  component: ResearchQueue,
  owner: RP1
});

// src/Simulation/badge.ts
function simulationBadges(simulation, held) {
  if (simulation?.active !== true) return null;
  return [
    {
      id: "rp1-simulation",
      label: "SIMULATION",
      tone: "caution",
      ...held === void 0 ? {} : { held }
    }
  ];
}
RP1.registerContribution({
  id: "rp1-simulation-badge",
  contributes: "app.header-badges",
  requires: "rp1",
  deps: ["rp1.simulation"],
  compute: (topics) => simulationBadges(
    lastValue(topics["rp1.simulation"]),
    topics["rp1.simulation"]
  )
});

// src/StartResearch/index.tsx
import {
  magnitudeOf as magnitudeOf28,
  registerAugment as registerAugment14,
  useCommand as useCommand10,
  useTelemetry as useTelemetry15
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge12,
  Cluster as Cluster14,
  CommandButton as CommandButton15,
  NULL_DISPLAY as NULL_DISPLAY15,
  Readout as Readout4,
  ReadoutCaption as ReadoutCaption5,
  Section as Section12,
  SectionTitle as SectionTitle10,
  Select,
  Stack as Stack19,
  Text as Text22,
  Unit as Unit21
} from "@ksp-gonogo/ui-kit";
import { useState as useState15 } from "react";
import { Fragment as Fragment19, jsx as jsx27, jsxs as jsxs26 } from "react/jsx-runtime";
var RP1_TECH_RESEARCH_COMMAND = "rp1.tech.research";
function StartResearch() {
  const available = current(useTelemetry15("rp1.available"));
  const careerReading = useTelemetry15("career.status");
  const career = current(careerReading);
  const research = current(useTelemetry15("rp1.research"));
  const [picked, setPicked] = useState15(null);
  const start = useCommand10(RP1_TECH_RESEARCH_COMMAND);
  if (available !== true) {
    return null;
  }
  if (career?.tech == null) {
    return null;
  }
  const queued = new Set(
    (research ?? []).flatMap(
      (entry) => entry.techId === void 0 || entry.techId === null ? [] : [entry.techId]
    )
  );
  const offered = startable(career.tech.nodes ?? [], queued);
  const science = magnitudeOf28(career?.balances?.science);
  const chosen = offered.find((node) => node.id === picked) ?? offered[0];
  const cost = magnitudeOf28(chosen?.scienceCost);
  const short = cost !== null && science !== null && science < cost;
  return /* @__PURE__ */ jsxs26(Section12, { gap: "related-dense", children: [
    /* @__PURE__ */ jsx27(SectionTitle10, { children: "START RESEARCH" }),
    /* @__PURE__ */ jsxs26(Cluster14, { gap: "related-comfortable", justify: "start", wrap: true, children: [
      /* @__PURE__ */ jsxs26(Readout4, { children: [
        /* @__PURE__ */ jsx27(ReadoutCaption5, { children: "Science" }),
        /* @__PURE__ */ jsx27(Unit21, { value: careerReading.balances.science })
      ] }),
      /* @__PURE__ */ jsx27(Text22, { size: "xs", level: "muted", children: "Charged in full when the node is queued, not when it finishes." })
    ] }),
    chosen === void 0 ? (
      /* A real answer worth stating: a tree whose reachable nodes are all
         owned or all already queued reads the same as a section that failed
         to draw if this is left out. */
      /* @__PURE__ */ jsx27(Text22, { size: "sm", level: "muted", children: "Nothing the tree can reach is left to queue." })
    ) : /* @__PURE__ */ jsxs26(Stack19, { gap: "caption", children: [
      /* @__PURE__ */ jsxs26(Cluster14, { gap: "related-dense", justify: "start", wrap: true, children: [
        /* @__PURE__ */ jsx27(
          Select,
          {
            "aria-label": "Tech node to research",
            onChange: (e) => setPicked(e.target.value),
            value: chosen.id ?? "",
            children: offered.map((node) => /* @__PURE__ */ jsx27("option", { value: node.id ?? "", children: titleOf2(node) }, node.id))
          }
        ),
        /* @__PURE__ */ jsx27(
          CommandButton15,
          {
            args: { techId: chosen.id },
            "aria-label": short ? void 0 : `Research ${titleOf2(chosen)}`,
            commandLabel: `Research ${titleOf2(chosen)}`,
            confirmAriaLabel: `Confirm researching ${titleOf2(chosen)}`,
            confirmLabel: /* @__PURE__ */ jsx27(SpendWording, { cost: chosen.scienceCost }),
            disabled: short,
            handle: start,
            label: "Research",
            size: "sm",
            title: short ? "RP-1 charges the whole science cost when the node is queued, and the career is short of it" : void 0
          }
        )
      ] }),
      /* @__PURE__ */ jsxs26(ReadoutCaption5, { children: [
        chosen.scienceCost == null ? /* @__PURE__ */ jsxs26(Fragment19, { children: [
          NULL_DISPLAY15,
          " the tree did not price this node"
        ] }) : /* @__PURE__ */ jsxs26(Fragment19, { children: [
          /* @__PURE__ */ jsx27(Unit21, { decimals: 0, value: chosen.scienceCost }),
          " at the press"
        ] }),
        short && /* @__PURE__ */ jsxs26(Fragment19, { children: [
          " ",
          /* @__PURE__ */ jsx27(Badge12, { tone: "caution", children: "SHORT" })
        ] })
      ] })
    ] })
  ] });
}
function startable(nodes, queued) {
  const owned = new Set(
    nodes.flatMap(
      (node) => node.unlocked === true && node.id !== void 0 && node.id !== null ? [node.id] : []
    )
  );
  return nodes.filter(
    (node) => node.id !== void 0 && node.id !== null && node.unlocked !== true && !queued.has(node.id) && (node.parents ?? []).every((parent) => owned.has(parent))
  ).sort((a, b) => {
    const priceA = magnitudeOf28(a.scienceCost);
    const priceB = magnitudeOf28(b.scienceCost);
    if (priceA === null || priceB === null) {
      if (priceA !== priceB) {
        return priceA === null ? 1 : -1;
      }
      return titleOf2(a).localeCompare(titleOf2(b));
    }
    return priceA - priceB || titleOf2(a).localeCompare(titleOf2(b));
  });
}
function titleOf2(node) {
  return node.title ?? node.id ?? "";
}
function SpendWording({
  cost
}) {
  if (cost == null) {
    return /* @__PURE__ */ jsxs26(Fragment19, { children: [
      "Spend ",
      NULL_DISPLAY15
    ] });
  }
  return /* @__PURE__ */ jsxs26(Fragment19, { children: [
    "Spend ",
    /* @__PURE__ */ jsx27(Unit21, { decimals: 0, value: cost })
  ] });
}
registerAugment14({
  id: "rp1-start-research",
  augments: "research-and-development.sections",
  component: StartResearch,
  channels: [
    "rp1.available",
    /* The tree, the prices and the science balance all ride this one, and
       naming it here is what makes the section independent of whatever the host
       happens to subscribe. */
    "career.status",
    /* What is already being worked, so a node on the queue is not offered a
       second press RP-1 would refuse ahead of the charge. */
    "rp1.research"
  ],
  requires: "rp1",
  /** Under the queue: what is being worked now is the context for choosing what
   *  to work next, and an order that depends on import order is one a formatter
   *  can reverse. */
  priority: 1,
  owner: RP1
});

// src/VehicleAssembly/index.tsx
import { registerComponent, useTelemetry as useTelemetry22 } from "@ksp-gonogo/sitrep-sdk";
import { Panel, Section as Section17, Text as Text27, Unit as Unit26 } from "@ksp-gonogo/ui-kit";

// src/VehicleAssembly/BuildCost.tsx
import { registerAugment as registerAugment15, useTelemetry as useTelemetry16 } from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge13,
  Cluster as Cluster15,
  NULL_DISPLAY as NULL_DISPLAY16,
  Row as Row14,
  RowName as RowName11,
  Section as Section13,
  SectionTitle as SectionTitle11,
  Stack as Stack20,
  Text as Text23,
  Unit as Unit22
} from "@ksp-gonogo/ui-kit";

// src/VehicleAssembly/slot.ts
var VEHICLE_ASSEMBLY_SECTIONS = "rp1-vehicle-assembly.sections";

// src/VehicleAssembly/BuildCost.tsx
import { jsx as jsx28, jsxs as jsxs27 } from "react/jsx-runtime";
function BuildCostSection() {
  const available = current(useTelemetry16("rp1.available"));
  const cost = current(useTelemetry16("rp1.buildCost"));
  if (available !== true) {
    return null;
  }
  if (cost === void 0) {
    return null;
  }
  return /* @__PURE__ */ jsxs27(Section13, { gap: "related-dense", "data-build-cost-section": "", children: [
    /* @__PURE__ */ jsx28(SectionTitle11, { children: "LAUNCH COST" }),
    /* @__PURE__ */ jsxs27(Stack20, { gap: "related-dense", children: [
      /* @__PURE__ */ jsx28(CostRow, { name: "Vehicle", value: cost.vehicleCost }),
      /* @__PURE__ */ jsx28(SurchargeRow, { cost }),
      /* @__PURE__ */ jsx28(CostRow, { name: "Tooling", value: cost.toolingCost }),
      /* @__PURE__ */ jsx28(CostRow, { name: "Part unlocks", value: cost.unlockCost }),
      /* @__PURE__ */ jsx28(CostRow, { name: "Rollout", value: cost.rolloutCost }),
      /* @__PURE__ */ jsx28(RequiredTechs, { techs: cost.requiredTechs })
    ] })
  ] });
}
function CostRow({
  name,
  value: value18
}) {
  return /* @__PURE__ */ jsxs27(Row14, { as: "div", children: [
    /* @__PURE__ */ jsx28(RowName11, { children: name }),
    value18 == null ? /* @__PURE__ */ jsx28(Text23, { children: NULL_DISPLAY16 }) : /* @__PURE__ */ jsx28(Unit22, { value: value18, decimals: 0 })
  ] });
}
function SurchargeRow({ cost }) {
  if (cost.untooledSurcharge == null) {
    return null;
  }
  return /* @__PURE__ */ jsxs27(Row14, { as: "div", nested: true, "data-of-which": "", children: [
    /* @__PURE__ */ jsx28(RowName11, { children: "Untooled" }),
    /* @__PURE__ */ jsx28(Unit22, { value: cost.untooledSurcharge, decimals: 0 })
  ] });
}
function RequiredTechs({ techs }) {
  if (techs == null || techs.length === 0) {
    return null;
  }
  return (
    /* A STACK rather than a name-and-value row, and a render is what settled it.
       As a row the label was crushed to ZERO WIDTH at the widget's minimum size by
       the badges beside it: an operator saw a line of tech names with nothing
       saying what they were. A list of badges is a sub-list rather than a value,
       and it cannot compete with its own label for the same line. */
    /* @__PURE__ */ jsxs27(Stack20, { gap: "caption", "data-required-techs": "", children: [
      /* @__PURE__ */ jsx28(Cluster15, { justify: "start", gap: "related-dense", children: /* @__PURE__ */ jsx28(Badge13, { tone: "nogo", children: "Needs tech" }) }),
      techs.map((tech) => /* @__PURE__ */ jsx28(BlockingNode, { tech }, tech.id ?? tech.title))
    ] })
  );
}
function BlockingNode({ tech }) {
  const name = tech.title ?? tech.id;
  if (name == null) {
    return null;
  }
  return /* @__PURE__ */ jsxs27(Stack20, { gap: "caption", "data-blocking-node": "", children: [
    /* @__PURE__ */ jsx28(Text23, { size: "xs", children: name }),
    tech.parts != null && /* Nested, because the parts belong to the node above them and a flat run
       of part names under a flat run of node names could not be told apart.
       Same relationship, and the same rendering of it, as the tooling section
       below draws for the parts a purchase covers. */
    /* @__PURE__ */ jsx28(Row14, { as: "div", nested: true, wrap: true, children: /* @__PURE__ */ jsx28(Text23, { size: "xs", level: "muted", children: tech.parts.length === 0 ? "nothing on this vehicle names it" : tech.parts.join(", ") }) })
  ] });
}
registerAugment15({
  id: "rp1-vehicle-assembly-build-cost",
  augments: VEHICLE_ASSEMBLY_SECTIONS,
  component: BuildCostSection,
  /** Above both vehicle lists: it is about the craft being designed now, and they
   *  are about craft already committed to. */
  priority: -1,
  owner: RP1
});

// src/VehicleAssembly/Building.tsx
import { registerAugment as registerAugment16, useTelemetry as useTelemetry18 } from "@ksp-gonogo/sitrep-sdk";

// src/VehicleAssembly/VehicleSection.tsx
import { useCommand as useCommand11, useTelemetry as useTelemetry17 } from "@ksp-gonogo/sitrep-sdk";
import { Section as Section14, SectionTitle as SectionTitle12 } from "@ksp-gonogo/ui-kit";

// src/VehicleAssembly/VehicleCard.tsx
import {
  Badge as Badge14,
  Cluster as Cluster16,
  CommandButton as CommandButton16,
  Countdown as Countdown4,
  magnitudeOf as magnitudeOf30,
  NULL_DISPLAY as NULL_DISPLAY17,
  Stack as Stack21,
  Text as Text24,
  Unit as Unit23
} from "@ksp-gonogo/ui-kit";

// src/VehicleAssembly/vehicles.ts
import { magnitudeOf as magnitudeOf29 } from "@ksp-gonogo/ui-kit";
function operationFor(operations, item) {
  const shipId = item.shipId;
  if (shipId === void 0 || shipId === null) {
    return void 0;
  }
  return (operations ?? []).find(
    (operation) => operation.associatedVesselId === shipId && operation.lcId === item.lcId && (operation.type === "Rollout" || operation.type === "Rollback")
  );
}
function atPad(operation) {
  return (magnitudeOf29(operation.progressRatio) ?? 0) >= 1;
}
function settled(item, waiting, operation) {
  if (operation !== void 0) {
    return operation.type === "Rollout" && atPad(operation);
  }
  return !waiting && item.stalled !== true;
}
function padsAt(pads, lcId) {
  if (lcId === void 0 || lcId === null) {
    return [];
  }
  return (pads ?? []).filter((pad) => pad.lcId === lcId);
}
function eligiblePadNames(pads) {
  const names = [];
  for (const pad of pads) {
    const name = pad.name;
    if (name !== void 0 && name !== null && name !== "" && pad.status === "Free" && pad.hasVesselWaiting !== true) {
      names.push(name);
    }
  }
  return names;
}
function noPadReason(pads) {
  if (pads.length === 0) {
    return "this complex has no pads";
  }
  const occupied = pads.find((p) => p.hasVesselWaiting === true);
  if (occupied !== void 0) {
    const who = occupied.waitingVesselName ?? "another vessel";
    return `${who} is on ${occupied.name ?? "the pad"}, waiting to launch`;
  }
  if (pads.some((p) => p.status === "Reconditioning")) {
    return "the pad is being reconditioned after a launch";
  }
  if (pads.some((p) => p.status === "Destroyed")) {
    return "the pad is destroyed and needs repairing";
  }
  if (pads.some((p) => p.status === "Nonoperational")) {
    return "the pad has not been built yet";
  }
  return "no pad is free";
}
function withheldRolloutReason({
  rolloutOffered,
  eligiblePads,
  pads,
  refusals,
  waiting,
  moving
}) {
  if (waiting || moving) {
    return null;
  }
  if (refusals !== void 0) {
    return refusals.join("; ");
  }
  if (rolloutOffered && eligiblePads.length === 0) {
    return noPadReason(pads);
  }
  return null;
}
function rolloutRefusalsOf(item) {
  const refusals = item.rolloutRefusals;
  return refusals === void 0 || refusals === null || refusals.length === 0 ? void 0 : refusals;
}
function rolloutBillOf(item, operation) {
  if (operation !== void 0) {
    return operation.costRemaining;
  }
  return item.rolloutCost;
}
function complexOf(complexes, lcId) {
  if (lcId === void 0 || lcId === null) {
    return void 0;
  }
  return (complexes ?? []).find((c) => c.lcId === lcId);
}
function rowKey2(item) {
  return item.id ?? `${item.lcId ?? ""}:${item.shipName ?? ""}`;
}
function unstaffed(complex) {
  return magnitudeOf29(complex?.engineers) === 0;
}
function byComplex(items, complexes) {
  const order = /* @__PURE__ */ new Map();
  for (const [index, complex] of (complexes ?? []).entries()) {
    if (complex.lcId !== void 0 && complex.lcId !== null) {
      order.set(complex.lcId, index);
    }
  }
  const place = (item) => order.get(item.lcId ?? "") ?? Number.MAX_SAFE_INTEGER;
  return [...items].map((item, index) => ({ index, item })).sort((a, b) => place(a.item) - place(b.item) || a.index - b.index).map((entry) => entry.item);
}

// src/VehicleAssembly/VehicleCard.tsx
import { Fragment as Fragment20, jsx as jsx29, jsxs as jsxs28 } from "react/jsx-runtime";
function VehicleCard({
  item,
  complex,
  waiting,
  pads,
  operation,
  handles
}) {
  const name = item.shipName ?? NULL_DISPLAY17;
  const complexName = complex?.name ?? null;
  const label3 = complexName === null ? name : `${name} \xB7 ${complexName}`;
  const id = item.id ?? null;
  return /* @__PURE__ */ jsxs28(
    ProjectCard,
    {
      badge: /* @__PURE__ */ jsx29(VehicleState, { item, operation, waiting }),
      detail: /* @__PURE__ */ jsxs28(Fragment20, { children: [
        complexName === null ? null : /* @__PURE__ */ jsxs28(Fragment20, { children: [
          complexName,
          " \xB7 "
        ] }),
        "costs ",
        /* @__PURE__ */ jsx29(Unit23, { value: item.cost })
      ] }),
      name,
      progress: progressOf2(item, name, operation),
      tone: settled(item, waiting, operation) ? "go" : "warn",
      children: [
        /* @__PURE__ */ jsx29(TimeLeft2, { complex, item, operation }),
        /* @__PURE__ */ jsx29(ComplexRate, { complex }),
        id === null ? (
          // Readable and not commandable, and it says which. RP-1 stamps an id on
          // every vehicle it creates, so a card without one came out of a save
          // written before it did; guessing a target from the name would pick the
          // wrong one of two vehicles that share it.
          /* @__PURE__ */ jsxs28(Text24, { size: "xs", level: "muted", children: [
            NULL_DISPLAY17,
            " RP-1 has no id for this vehicle"
          ] })
        ) : /* @__PURE__ */ jsx29(
          VehicleActions,
          {
            cost: item.cost,
            handles,
            id,
            label: label3,
            name,
            operation,
            pads,
            refusals: rolloutRefusalsOf(item),
            rolloutBill: rolloutBillOf(item, operation),
            waiting
          }
        )
      ]
    }
  );
}
function progressOf2(item, name, operation) {
  if (operation !== void 0) {
    if (atPad(operation)) {
      return void 0;
    }
    const what = operation.type === "Rollback" ? "Rollback" : "Rollout";
    return {
      label: `${what} progress, ${name}`,
      ratio: magnitudeOf30(operation.progressRatio)
    };
  }
  const build = item;
  if (build.progressRatio === void 0 && build.timeLeftSeconds === void 0) {
    return void 0;
  }
  return {
    label: `Integration progress, ${name}`,
    ratio: magnitudeOf30(build.progressRatio)
  };
}
function TimeLeft2({
  item,
  complex,
  operation
}) {
  if (operation !== void 0) {
    if (atPad(operation)) {
      return null;
    }
    return /* @__PURE__ */ jsxs28(Text24, { size: "xs", level: "muted", children: [
      /* @__PURE__ */ jsx29(Countdown4, { value: operation.timeLeftSeconds }),
      " ",
      operation.type === "Rollback" ? "until it is back in the warehouse" : "until it reaches the pad"
    ] });
  }
  const build = item;
  if (build.progressRatio === void 0 && build.timeLeftSeconds === void 0) {
    return null;
  }
  if (build.timeLeftSeconds !== void 0 && build.timeLeftSeconds !== null) {
    return /* @__PURE__ */ jsxs28(Text24, { size: "xs", level: "muted", children: [
      /* @__PURE__ */ jsx29(Countdown4, { value: build.timeLeftSeconds }),
      " until integration finishes"
    ] });
  }
  if (build.stalled === true) {
    return /* @__PURE__ */ jsx29(Text24, { size: "xs", level: "muted", children: unstaffed(complex) ? `Integration cannot start: nobody is assigned to ${complex?.name ?? "this complex"}.` : "Integration is stalled and has no end date." });
  }
  if (build.progress == null) {
    return /* @__PURE__ */ jsxs28(Text24, { size: "xs", level: "muted", children: [
      NULL_DISPLAY17,
      " RP-1 has not said how far along this build is."
    ] });
  }
  return /* @__PURE__ */ jsxs28(Text24, { size: "xs", level: "muted", children: [
    NULL_DISPLAY17,
    " RP-1 has not costed this build yet."
  ] });
}
function ComplexRate({
  complex
}) {
  if (complex === void 0) {
    return null;
  }
  return (
    /*
     * Wrapping, and the badge outside the sentence rather than inside it: at
     * the widget's minimum width the two together are wider than the card, and
     * a badge on a line that cannot wrap is one an operator never sees.
     */
    /* @__PURE__ */ jsxs28(Cluster16, { gap: "related-packed", justify: "start", wrap: true, children: [
      /* @__PURE__ */ jsxs28(Text24, { size: "xs", level: "muted", children: [
        /* @__PURE__ */ jsx29(Unit23, { value: complex.engineers }),
        " /",
        " ",
        /* @__PURE__ */ jsx29(Unit23, { value: complex.maxEngineers }),
        " engineers"
      ] }),
      complex.isRushing === true ? /* @__PURE__ */ jsx29(Badge14, { tone: "caution", children: "RUSHING" }) : null
    ] })
  );
}
function VehicleState({
  item,
  waiting,
  operation
}) {
  if (operation?.type === "Rollout") {
    return atPad(operation) ? /* @__PURE__ */ jsx29(Badge14, { tone: "go", children: "AT PAD" }) : /* @__PURE__ */ jsx29(Badge14, { tone: "caution", children: "ROLLING OUT" });
  }
  if (operation?.type === "Rollback") {
    return /* @__PURE__ */ jsx29(Badge14, { tone: "caution", children: "ROLLING BACK" });
  }
  if (!waiting) {
    return /* @__PURE__ */ jsx29(Badge14, { tone: "go", children: "BUILT" });
  }
  if (item.stalled === true) {
    return /* @__PURE__ */ jsx29(Badge14, { tone: "caution", children: "STALLED" });
  }
  return /* @__PURE__ */ jsx29(Badge14, { tone: "caution", children: "INTEGRATING" });
}
function VehicleActions({
  id,
  name,
  label: label3,
  cost,
  rolloutBill,
  waiting,
  pads,
  refusals,
  operation,
  handles
}) {
  const moving = operation !== void 0;
  const rolloutOffered = !waiting && !moving && refusals === void 0;
  const eligiblePads = rolloutOffered ? eligiblePadNames(pads) : [];
  const withheld = withheldRolloutReason({
    eligiblePads,
    moving,
    pads,
    refusals,
    rolloutOffered,
    waiting
  });
  return /* @__PURE__ */ jsxs28(Stack21, { gap: "related-dense", children: [
    (eligiblePads.length > 0 || operation?.type === "Rollback") && /* @__PURE__ */ jsx29(RolloutPrice, { bill: rolloutBill }),
    /* @__PURE__ */ jsxs28(Cluster16, { gap: "related-dense", justify: "start", wrap: true, children: [
      /* @__PURE__ */ jsx29(
        RolloutControls,
        {
          handle: handles.rollout,
          id,
          label: label3,
          name,
          padNames: eligiblePads
        }
      ),
      operation?.type === "Rollback" ? /* @__PURE__ */ jsx29(
        CommandButton16,
        {
          args: { id },
          "aria-label": `Send ${label3} back out to the pad`,
          commandLabel: `Roll out ${name}`,
          confirmAriaLabel: `Confirm sending ${label3} back out to the pad`,
          confirmLabel: "Commit",
          handle: handles.rollout,
          label: "Roll out again",
          size: "sm"
        }
      ) : null,
      operation?.type === "Rollout" ? /* @__PURE__ */ jsx29(
        CommandButton16,
        {
          args: { id },
          "aria-label": `Roll ${label3} back off the pad`,
          commandLabel: `Roll back ${name}`,
          confirmAriaLabel: `Confirm rolling ${label3} back off the pad`,
          confirmLabel: "Confirm",
          handle: handles.rollback,
          label: "Roll back",
          size: "sm",
          tone: "warn"
        }
      ) : null,
      moving ? null : /* @__PURE__ */ jsx29(
        CommandButton16,
        {
          args: { id },
          "aria-label": `Scrap ${label3}`,
          commandLabel: `Scrap ${name}`,
          confirmAriaLabel: `Confirm scrapping ${label3}`,
          confirmLabel: /* @__PURE__ */ jsx29(RefundWording, { cost }),
          handle: handles.scrap,
          label: "Scrap",
          size: "sm",
          tone: "nogo"
        }
      )
    ] }),
    withheld !== null && /* @__PURE__ */ jsxs28(Text24, { size: "xs", level: "muted", children: [
      NULL_DISPLAY17,
      " cannot roll out: ",
      withheld
    ] })
  ] });
}
function RolloutPrice({
  bill
}) {
  return /* @__PURE__ */ jsx29(Text24, { size: "xs", level: "muted", children: bill == null ? /* @__PURE__ */ jsxs28(Fragment20, { children: [
    NULL_DISPLAY17,
    " RP-1 has not priced this rollout"
  ] }) : /* @__PURE__ */ jsxs28(Fragment20, { children: [
    /* @__PURE__ */ jsx29(Unit23, { decimals: 0, value: bill }),
    " over the rollout"
  ] }) });
}
function RolloutControls({
  id,
  name,
  label: label3,
  padNames,
  handle
}) {
  const short = padNames.length === 1;
  return /* @__PURE__ */ jsx29(Fragment20, { children: padNames.map((padName) => /* @__PURE__ */ jsx29(
    CommandButton16,
    {
      args: { id, pad: padName },
      "aria-label": `Roll ${label3} out to ${padName}`,
      commandLabel: `Roll ${name} out to ${padName}`,
      confirmAriaLabel: `Confirm rolling ${label3} out to ${padName}`,
      confirmLabel: "Commit",
      handle,
      label: short ? "Roll out" : `Roll out to ${padName}`,
      size: "sm"
    },
    padName
  )) });
}
function RefundWording({
  cost
}) {
  return /* @__PURE__ */ jsxs28(Fragment20, { children: [
    "Refund ",
    /* @__PURE__ */ jsx29(Unit23, { value: cost })
  ] });
}

// src/VehicleAssembly/VehicleSection.tsx
import { jsx as jsx30, jsxs as jsxs29 } from "react/jsx-runtime";
var RP1_ROLLOUT_COMMAND = "rp1.vehicle.rollout";
var RP1_ROLLBACK_COMMAND = "rp1.vehicle.rollback";
var RP1_SCRAP_COMMAND = "rp1.vehicle.scrap";
function VehicleSection({
  title,
  items,
  waiting
}) {
  const complexes = current(useTelemetry17("rp1.complexes"));
  const pads = current(useTelemetry17("rp1.pads"));
  const operations = current(useTelemetry17("rp1.operations"));
  const rollout = useCommand11(RP1_ROLLOUT_COMMAND);
  const rollback = useCommand11(RP1_ROLLBACK_COMMAND);
  const scrap = useCommand11(RP1_SCRAP_COMMAND);
  if (items.length === 0) {
    return null;
  }
  const handles = { rollback, rollout, scrap };
  return /* @__PURE__ */ jsxs29(Section14, { gap: "related-dense", children: [
    /* @__PURE__ */ jsx30(SectionTitle12, { children: title }),
    /* @__PURE__ */ jsx30(ProjectCardList, { children: byComplex(items, complexes).map((item) => /* @__PURE__ */ jsx30(
      VehicleCard,
      {
        complex: complexOf(complexes, item.lcId),
        handles,
        item,
        operation: operationFor(operations, item),
        pads: padsAt(pads, item.lcId),
        waiting
      },
      rowKey2(item)
    )) })
  ] });
}

// src/VehicleAssembly/Building.tsx
import { jsx as jsx31 } from "react/jsx-runtime";
function BuildingSection() {
  const available = current(useTelemetry18("rp1.available"));
  const queue = current(useTelemetry18("rp1.buildQueue"));
  if (available !== true) {
    return null;
  }
  return /* @__PURE__ */ jsx31(VehicleSection, { items: queue ?? [], title: "UNDER INTEGRATION", waiting: true });
}
registerAugment16({
  id: "rp1-vehicle-assembly-building",
  augments: VEHICLE_ASSEMBLY_SECTIONS,
  component: BuildingSection,
  /** Under the warehouse; see `WarehouseSection` for why the order is declared. */
  priority: 1,
  owner: RP1
});

// src/VehicleAssembly/Buildable.tsx
import {
  registerAugment as registerAugment17,
  useCommand as useCommand12,
  useTelemetry as useTelemetry19,
  value as value17
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge15,
  Cluster as Cluster17,
  CommandButton as CommandButton17,
  NULL_DISPLAY as NULL_DISPLAY18,
  Section as Section15,
  SectionTitle as SectionTitle13,
  Stack as Stack22,
  Text as Text25,
  Unit as Unit24
} from "@ksp-gonogo/ui-kit";
import { useEffect as useEffect2, useRef, useState as useState16 } from "react";
import { Fragment as Fragment21, jsx as jsx32, jsxs as jsxs30 } from "react/jsx-runtime";
var RP1_BUILD_START_COMMAND = "rp1.build.start";
var RP1_BUILD_QUOTE_COMMAND = "rp1.build.quote";
function BuildableSection() {
  const available = current(useTelemetry19("rp1.available"));
  const buildable = current(useTelemetry19("rp1.buildable"));
  const funds = current(useTelemetry19("career.status"))?.balances?.funds;
  const start = useCommand12(RP1_BUILD_START_COMMAND);
  if (available !== true) {
    return null;
  }
  return /* @__PURE__ */ jsxs30(Section15, { gap: "related-dense", children: [
    /* @__PURE__ */ jsx32(SectionTitle13, { children: "START A BUILD" }),
    buildable === void 0 ? (
      // RP-1 has answered and this channel has not. Said rather than left
      // blank: an operator who sees nothing here has no way to tell a career
      // with no craft saved from an Uplink that is still connecting.
      /* @__PURE__ */ jsx32(Text25, { size: "sm", level: "muted", children: "Waiting for the craft listing" })
    ) : buildable.length === 0 ? /* @__PURE__ */ jsx32(Text25, { size: "sm", level: "muted", children: "No craft saved. Design one in the VAB or SPH and it appears here." }) : /* @__PURE__ */ jsx32(ProjectCardList, { children: buildable.map((craft) => /* @__PURE__ */ jsx32(
      CraftCard,
      {
        craft,
        funds,
        handle: start
      },
      cardKey(craft)
    )) })
  ] });
}
function CraftCard({
  craft,
  funds,
  handle
}) {
  const name = craft.shipName ?? craft.craftFile ?? NULL_DISPLAY18;
  const file = craft.craftFile ?? null;
  const complexes = craft.complexes ?? [];
  const eligible = complexes.filter((complex) => complex.eligible === true);
  const partBlock = partRefusal(craft);
  return /* @__PURE__ */ jsxs30(
    ProjectCard,
    {
      detail: /* @__PURE__ */ jsx32(Fragment21, { children: editorOf(craft) }),
      name,
      tone: eligible.length > 0 && partBlock === null ? "go" : "warn",
      children: [
        /* @__PURE__ */ jsxs30(Text25, { size: "xs", level: "muted", children: [
          /* @__PURE__ */ jsx32(Unit24, { value: craft.mass }),
          " \xB7",
          " ",
          craft.partCount === void 0 ? NULL_DISPLAY18 : /* @__PURE__ */ jsx32(Unit24, { value: craft.partCount }),
          " ",
          "parts"
        ] }),
        partBlock !== null ? /* @__PURE__ */ jsxs30(Text25, { size: "xs", level: "muted", children: [
          "Cannot be built: ",
          partBlock
        ] }) : file === null ? (
          // Readable and not commandable, and it says which. A craft with no
          // file name has no address, and guessing one from the ship name would
          // build whichever file the folder listed first.
          /* @__PURE__ */ jsx32(Text25, { size: "xs", level: "muted", children: "No craft file name for this design" })
        ) : /* @__PURE__ */ jsxs30(Stack22, { gap: "related-dense", children: [
          eligible.map((complex) => /* @__PURE__ */ jsx32(
            BuildQuote,
            {
              complex,
              craft,
              file,
              funds,
              named: eligible.length > 1
            },
            `${cardKey(craft)}:${complex.lcId ?? complexLabel(complex)}:${craft.mass}:${craft.partCount}`
          )),
          /* @__PURE__ */ jsxs30(Cluster17, { gap: "related-dense", justify: "start", wrap: true, children: [
            eligible.map((complex) => /* @__PURE__ */ jsx32(
              CommandButton17,
              {
                args: {
                  craftFile: file,
                  facility: craft.facility,
                  lcId: complex.lcId
                },
                "aria-label": `Start building ${name} at ${complexLabel(complex)}`,
                commandLabel: `Start building ${name} at ${complexLabel(complex)}`,
                confirmAriaLabel: `Confirm starting ${name} at ${complexLabel(complex)}`,
                confirmLabel: "Start build",
                handle,
                label: `Build at ${complex.name ?? complexLabel(complex)}`,
                size: "sm"
              },
              complex.lcId ?? complexLabel(complex)
            )),
            /* @__PURE__ */ jsx32(Refusals, { complexes, handle })
          ] })
        ] })
      ]
    }
  );
}
function quotedFigures(quote) {
  if (quote == null) {
    return null;
  }
  return {
    affordable: quote.affordable,
    balance: asFunds(quote.balance),
    price: asFunds(quote.price)
  };
}
function asFunds(amount) {
  if (amount === null || amount === void 0) {
    return null;
  }
  return typeof amount === "number" ? value17("funds", amount) : amount;
}
function BuildQuote({
  complex,
  craft,
  file,
  funds,
  named
}) {
  const quote = useCommand12(RP1_BUILD_QUOTE_COMMAND, {
    rail: false,
    vantage: "meta"
  });
  const send = useRef(quote.send);
  send.current = quote.send;
  const [answer, setAnswer] = useState16(null);
  const facility = craft.facility;
  const lcId = complex.lcId;
  useEffect2(() => {
    let live = true;
    send.current({
      craftFile: file,
      facility: facility ?? void 0,
      lcId: lcId ?? void 0
    }).then((reply) => {
      if (live) {
        setAnswer(quotedFigures(reply.payload));
      }
    }).catch(() => {
    });
    return () => {
      live = false;
    };
  }, [file, facility, lcId]);
  const where = named ? ` at ${complex.name ?? complexLabel(complex)}` : "";
  if (answer === null) {
    return /* @__PURE__ */ jsx32(Text25, { size: "xs", level: "muted", children: "Priced by RP-1 when started, charged up front in funds" });
  }
  const balance = funds ?? answer.balance;
  const affordable = balance == null ? answer.affordable : balance.valueOf() >= answer.price.valueOf();
  return /* @__PURE__ */ jsxs30(Cluster17, { gap: "related-dense", justify: "start", wrap: true, children: [
    /* @__PURE__ */ jsxs30(Text25, { size: "xs", level: "muted", children: [
      "Costs ",
      /* @__PURE__ */ jsx32(Unit24, { value: answer.price, decimals: 0 }),
      where,
      ", charged up front"
    ] }),
    affordable ? null : /* @__PURE__ */ jsx32(Badge15, { tone: "nogo", children: "Cannot afford" })
  ] });
}
function Refusals({
  complexes,
  handle
}) {
  const refused = complexes.filter(
    (complex) => (complex.refusals ?? []).length > 0
  );
  if (refused.length === 0) {
    return null;
  }
  return /* @__PURE__ */ jsx32(Fragment21, { children: refused.map((complex) => /* @__PURE__ */ jsx32(
    CommandButton17,
    {
      disabled: true,
      handle,
      label: `Build at ${complex.name ?? complexLabel(complex)}`,
      size: "sm",
      title: (complex.refusals ?? []).join("; ")
    },
    complex.lcId ?? complexLabel(complex)
  )) });
}
function partRefusal(craft) {
  const missing = craft.missingParts ?? [];
  if (missing.length > 0) {
    return `this install does not have ${missing.join(", ")}`;
  }
  const locked = craft.lockedParts ?? [];
  if (locked.length > 0) {
    return `not researched yet: ${locked.join(", ")}`;
  }
  const unpurchased = craft.unpurchasedParts ?? [];
  if (unpurchased.length > 0) {
    return `researched but not bought, unlock at R&D first: ${unpurchased.join(", ")}`;
  }
  return null;
}
function complexLabel(complex) {
  const name = complex.name ?? complex.lcId ?? "an unnamed complex";
  const centre = complex.kscDisplayName ?? complex.kscName;
  return centre === void 0 ? name : `${name} at ${centre}`;
}
function editorOf(craft) {
  if (craft.facility === 1) {
    return "VAB";
  }
  if (craft.facility === 2) {
    return "SPH";
  }
  return NULL_DISPLAY18;
}
function cardKey(craft) {
  return `${craft.facility ?? "?"}:${craft.craftFile ?? craft.shipName ?? "?"}`;
}
registerAugment17({
  id: "rp1-vehicle-assembly-buildable",
  augments: VEHICLE_ASSEMBLY_SECTIONS,
  component: BuildableSection,
  // LAST, after what is built and what is being built. An operator opens this
  // widget to see the work in flight; starting new work is the thing they do
  // once they have, and a list of every saved craft above the queue would bury
  // it.
  priority: 20,
  owner: RP1
});

// src/VehicleAssembly/Tooling.tsx
import {
  magnitudeOf as magnitudeOf31,
  registerAugment as registerAugment18,
  useCommand as useCommand13,
  useTelemetry as useTelemetry20
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge16,
  Cluster as Cluster18,
  CommandButton as CommandButton18,
  Disclosure as Disclosure7,
  NULL_DISPLAY as NULL_DISPLAY19,
  Row as Row15,
  RowName as RowName12,
  Section as Section16,
  SectionTitle as SectionTitle14,
  Stack as Stack23,
  Text as Text26,
  Unit as Unit25
} from "@ksp-gonogo/ui-kit";
import { Fragment as Fragment22, jsx as jsx33, jsxs as jsxs31 } from "react/jsx-runtime";
var RP1_TOOL_ALL_COMMAND = "rp1.tooling.toolAll";
var RP1_TOOLING_REFIT_COMMAND = "rp1.tooling.refit";
function ToolingSection() {
  const available = current(useTelemetry20("rp1.available"));
  const toolingReading = useTelemetry20("rp1.tooling");
  const tooling = current(toolingReading);
  const toolAll = useCommand13(RP1_TOOL_ALL_COMMAND);
  const refit = useCommand13(RP1_TOOLING_REFIT_COMMAND);
  if (available !== true) {
    return null;
  }
  if (tooling === void 0) {
    return null;
  }
  const purchases = groupIntoPurchases(tooling.parts ?? []);
  if (purchases.length === 0) {
    return null;
  }
  const outstanding = magnitudeOf31(tooling.untooledCount) ?? 0;
  return /* @__PURE__ */ jsxs31(Section16, { gap: "related-dense", "data-tooling-section": "", children: [
    /* @__PURE__ */ jsx33(SectionTitle14, { children: "TOOLING" }),
    outstanding > 0 && /* @__PURE__ */ jsxs31(
      Cluster18,
      {
        gap: "related-dense",
        justify: "start",
        wrap: true,
        "data-tooling-header": "",
        children: [
          /* @__PURE__ */ jsxs31(Text26, { size: "sm", level: "muted", children: [
            "Tool all",
            " ",
            tooling.toolAllCost == null ? NULL_DISPLAY19 : /* @__PURE__ */ jsx33(Unit25, { value: toolingReading.toolAllCost, decimals: 0 })
          ] }),
          /* @__PURE__ */ jsx33(
            CommandButton18,
            {
              args: {},
              "aria-label": "Tool this vehicle",
              commandLabel: "Tool this vehicle",
              confirmAriaLabel: "Confirm tooling this vehicle",
              confirmLabel: /* @__PURE__ */ jsx33(SpendWording2, { cost: tooling.toolAllCost }),
              handle: toolAll,
              label: "Tool all",
              size: "sm"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsx33(ProjectCardList, { children: purchases.map((purchase) => /* @__PURE__ */ jsx33(PurchaseCard, { purchase, refit }, purchase.key)) })
  ] });
}
function groupIntoPurchases(parts) {
  const byKey = /* @__PURE__ */ new Map();
  for (const part of parts) {
    const key = `${part.toolingType ?? ""}${part.parameterSummary ?? ""}`;
    const held = byKey.get(key);
    if (held === void 0) {
      byKey.set(key, {
        key,
        heading: part.toolingTypeTitle ?? part.toolingType ?? "an unnamed tooling",
        size: part.parameterSummary ?? void 0,
        tooled: part.tooled === true,
        cost: part.toolingCost,
        parts: [part]
      });
      continue;
    }
    byKey.set(key, { ...held, parts: [...held.parts, part] });
  }
  return [...byKey.values()];
}
function PurchaseCard({
  purchase,
  refit
}) {
  return /* @__PURE__ */ jsxs31(
    ProjectCard,
    {
      badge: purchase.tooled ? /* @__PURE__ */ jsx33(Badge16, { tone: "go", children: "Tooled" }) : void 0,
      detail: purchase.size,
      name: purchase.heading,
      tone: purchase.tooled ? "go" : "warn",
      children: [
        !purchase.tooled && /* @__PURE__ */ jsxs31(Row15, { as: "div", "data-tooling-once": "", children: [
          /* @__PURE__ */ jsx33(RowName12, { children: "Once" }),
          purchase.cost == null ? /* @__PURE__ */ jsx33(Text26, { children: NULL_DISPLAY19 }) : /* @__PURE__ */ jsx33(Unit25, { value: purchase.cost, decimals: 0 })
        ] }),
        purchase.parts.map((part) => /* @__PURE__ */ jsx33(
          PartCharge,
          {
            owned: purchase.tooled,
            part,
            refit
          },
          part.partId ?? part.partTitle
        ))
      ]
    }
  );
}
function PartCharge({
  owned,
  part,
  refit
}) {
  const name = part.partTitle ?? part.partId ?? NULL_DISPLAY19;
  if (owned || part.untooledSurcharge == null) {
    return /* @__PURE__ */ jsx33(Row15, { as: "div", nested: true, wrap: true, children: /* @__PURE__ */ jsx33(Text26, { size: "xs", level: "muted", children: name }) });
  }
  return /* @__PURE__ */ jsxs31(Stack23, { gap: "caption", children: [
    /* @__PURE__ */ jsx33(Row15, { as: "div", nested: true, wrap: true, "data-tooling-per-build": "", children: /* @__PURE__ */ jsxs31(Text26, { size: "xs", level: "muted", children: [
      name,
      " \xB7 ",
      /* @__PURE__ */ jsx33(Unit25, { value: part.untooledSurcharge, decimals: 0 }),
      " per build"
    ] }) }),
    /* @__PURE__ */ jsx33(RefitControl, { handle: refit, name, part })
  ] });
}
function RefitControl({
  handle,
  name,
  part
}) {
  const partId = part.partId;
  const targets = part.refitTargets ?? [];
  if (partId == null || targets.length === 0) {
    return null;
  }
  const others = magnitudeOf31(part.symmetryCounterparts);
  return /* @__PURE__ */ jsx33(
    Disclosure7,
    {
      "aria-label": `Refit ${name} to a size the career already owns`,
      asButton: true,
      buttonSize: "sm",
      chevron: false,
      label: (open) => open ? "Hide refit" : "Refit instead",
      panelHeight: "auto",
      variant: "inline",
      children: /* @__PURE__ */ jsxs31(Stack23, { gap: "caption", children: [
        /* @__PURE__ */ jsxs31(Text26, { size: "xs", level: "muted", children: [
          "costs nothing, and drops the",
          " ",
          /* @__PURE__ */ jsx33(Unit25, { value: part.untooledSurcharge, decimals: 0 }),
          " per build",
          others === null ? /* @__PURE__ */ jsxs31(Fragment22, { children: [
            " \xB7 ",
            NULL_DISPLAY19,
            " RP-1 has not said how many other parts are in symmetry with this one, and a refit takes every one of them"
          ] }) : others > 0 && /* @__PURE__ */ jsxs31(Fragment22, { children: [
            " \xB7 takes ",
            others,
            " other part",
            others === 1 ? "" : "s",
            " in symmetry, and the material goes on the group"
          ] })
        ] }),
        targets.map((target) => /* @__PURE__ */ jsx33(
          RefitRow,
          {
            handle,
            name,
            partId,
            target
          },
          `${magnitudeOf31(target.diameter)}x${magnitudeOf31(target.length)}`
        ))
      ] })
    }
  );
}
function RefitRow({
  handle,
  name,
  partId,
  target
}) {
  const diameter = magnitudeOf31(target.diameter);
  const length = magnitudeOf31(target.length);
  if (diameter === null || length === null || target.rfType == null) {
    return null;
  }
  const press = `Refit ${name} to ${diameter.toFixed(3)} metres across by ${length.toFixed(3)} metres long, in ${target.rfType}`;
  return /* @__PURE__ */ jsxs31(Row15, { as: "div", nested: true, children: [
    /* @__PURE__ */ jsxs31(Text26, { size: "xs", children: [
      /* @__PURE__ */ jsx33(Unit25, { value: target.diameter }),
      " \xD7 ",
      /* @__PURE__ */ jsx33(Unit25, { value: target.length })
    ] }),
    /* @__PURE__ */ jsx33(
      CommandButton18,
      {
        args: { diameter, length, partId, rfType: target.rfType },
        "aria-label": press,
        commandLabel: press,
        handle,
        label: "Refit",
        size: "sm"
      }
    )
  ] });
}
function SpendWording2({
  cost
}) {
  if (cost == null) {
    return /* @__PURE__ */ jsxs31(Fragment22, { children: [
      "Spend ",
      NULL_DISPLAY19
    ] });
  }
  return /* @__PURE__ */ jsxs31(Fragment22, { children: [
    "Spend ",
    /* @__PURE__ */ jsx33(Unit25, { value: cost, decimals: 0 })
  ] });
}
registerAugment18({
  id: "rp1-vehicle-assembly-tooling",
  augments: VEHICLE_ASSEMBLY_SECTIONS,
  component: ToolingSection,
  /** Immediately under the launch cost, whose untooled line is the figure this
   *  section breaks down, and above both vehicle lists for the same reason that
   *  one is: it is about the craft being designed now. */
  priority: -0.5,
  owner: RP1
});

// src/VehicleAssembly/Warehouse.tsx
import { registerAugment as registerAugment19, useTelemetry as useTelemetry21 } from "@ksp-gonogo/sitrep-sdk";
import { jsx as jsx34 } from "react/jsx-runtime";
function WarehouseSection() {
  const available = current(useTelemetry21("rp1.available"));
  const warehouse = current(useTelemetry21("rp1.warehouse"));
  if (available !== true) {
    return null;
  }
  return /* @__PURE__ */ jsx34(
    VehicleSection,
    {
      items: warehouse ?? [],
      title: "IN THE WAREHOUSE",
      waiting: false
    }
  );
}
registerAugment19({
  id: "rp1-vehicle-assembly-warehouse",
  augments: VEHICLE_ASSEMBLY_SECTIONS,
  component: WarehouseSection,
  // Ahead of the build list, rather than left to whichever module the bundler
  // happened to evaluate first. What can fly right now is the more urgent of
  // the two questions, and an order that depends on import order is one a
  // formatter can reverse.
  priority: 0,
  owner: RP1
});

// src/VehicleAssembly/index.tsx
import { jsx as jsx35, jsxs as jsxs32 } from "react/jsx-runtime";
var RP1_BUILD_REPEAT_COMMAND = "rp1.build.repeat";
function VehicleAssembly() {
  const available = current(useTelemetry22("rp1.available"));
  const warehouse = current(useTelemetry22("rp1.warehouse"));
  const queue = current(useTelemetry22("rp1.buildQueue"));
  const complexes = current(useTelemetry22("rp1.complexes"));
  const careerReading = useTelemetry22("career.status");
  const budgetReading = useTelemetry22("rp1.budget");
  const budget = current(budgetReading);
  if (available !== true) {
    return null;
  }
  return /* @__PURE__ */ jsx35(
    Panel,
    {
      compactTitle: ["VEHICLE ASSEMBLY", "ASSEMBLY"],
      panelTitle: "VEHICLE ASSEMBLY",
      sections: /* @__PURE__ */ jsxs32(Section17, { full: true, gap: "section-compact", children: [
        /* @__PURE__ */ jsxs32(Text27, { size: "sm", title: "Available funds", level: "muted", children: [
          "Funds ",
          /* @__PURE__ */ jsx35(Unit26, { value: careerReading.balances.funds })
        ] }),
        budget?.unlockCreditBalance != null && /* @__PURE__ */ jsxs32(
          Text27,
          {
            size: "sm",
            title: "Prepaid credit, spent before funds on the purchases it covers",
            level: "muted",
            children: [
              "Unlock credit ",
              /* @__PURE__ */ jsx35(Unit26, { value: budgetReading.unlockCreditBalance })
            ]
          }
        ),
        /* @__PURE__ */ jsx35(ComplexKey, { complexes: complexes ?? [] }),
        warehouse === void 0 && queue === void 0 && /* Only the UNREADABLE case says anything. A space centre with nothing
                     built renders nothing, because a sentence announcing that a list is
                     empty is not a reading, it is the widget talking about itself.
        
                     This used to fire on `built.length === 0 && building.length === 0`
                     and carried a comment claiming it distinguished an empty centre from
                     an Uplink that is not reporting. It could not: `warehouse ?? []`
                     turns an absent payload into an empty array one line above, so both
                     states reached the same sentence. The distinction is real and worth
                     keeping, so it is made on the ABSENCE itself rather than on a count
                     that cannot see it. */
        /* @__PURE__ */ jsx35(Text27, { size: "sm", level: "muted", children: "No reading from the build queue." })
      ] })
    }
  );
}
function ComplexKey({
  complexes
}) {
  const centres = groupByCentre(complexes);
  if (centres.length === 0) {
    return null;
  }
  return /* @__PURE__ */ jsxs32(Text27, { size: "xs", level: "muted", children: [
    "Launch complexes:",
    " ",
    centres.map((centre, index) => /* @__PURE__ */ jsxs32("span", { children: [
      index > 0 ? "; " : null,
      centre.complexes.join(", "),
      " at ",
      centre.name
    ] }, centre.name))
  ] });
}
function groupByCentre(complexes) {
  const byCentre2 = /* @__PURE__ */ new Map();
  for (const complex of complexes) {
    const name = complex.name;
    if (name === void 0 || name === null || name === "") {
      continue;
    }
    const centre = complex.kscDisplayName ?? complex.kscName ?? "an unnamed space centre";
    const held = byCentre2.get(centre);
    if (held === void 0) {
      byCentre2.set(centre, [name]);
    } else {
      held.push(name);
    }
  }
  return [...byCentre2].map(([name, held]) => ({ complexes: held, name }));
}
registerComponent({
  id: "rp1-vehicle-assembly",
  name: "Vehicle Assembly",
  description: "Every craft RP-1 is integrating, holding or could start, across every launch complex at every space centre: what it costs, how far along it is, why its clock reads what it reads, and the controls to start a build, roll one out, bring it back or scrap it.",
  tags: ["rp1", "career", "vehicles"],
  defaultSize: { w: 7, h: 16 },
  minSize: { w: 4, h: 6 },
  component: VehicleAssembly,
  openConfigOnAdd: false,
  dataRequirements: [
    "rp1.available",
    "rp1.warehouse",
    "rp1.buildQueue",
    "rp1.buildable",
    "rp1.complexes",
    "rp1.pads",
    "rp1.operations",
    // The two editor channels, both read by contributed sections rather than by
    // the host widget: what the vehicle on the table costs to fly, and what
    // tooling it owes. Declared here because a widget's requirements are what
    // the debug surfaces enumerate, and a section's reads are the widget's reads.
    "rp1.buildCost",
    "rp1.tooling",
    // The spend rule: a rollout is billed as the vehicle moves, a scrap refunds
    // it, and starting a build buys the vehicle outright, so the balance those
    // are judged against has to be in here.
    "career.status",
    // The unlock credit drawn beside that balance, which tooling spends first.
    "rp1.budget"
  ],
  defaultConfig: {},
  actions: [],
  augmentSlots: [VEHICLE_ASSEMBLY_SECTIONS],
  pushable: true,
  owner: RP1
});

// src/WarpTargets/index.tsx
import {
  registerAugment as registerAugment20,
  useAlarmRequest as useAlarmRequest2,
  useCommand as useCommand14,
  useTelemetry as useTelemetry23
} from "@ksp-gonogo/sitrep-sdk";
import { Button as Button3, Inline as Inline6, Stack as Stack24, Text as Text29 } from "@ksp-gonogo/ui-kit";

// src/WarpTargets/FundTarget.tsx
import { CommandButton as CommandButton19, NULL_DISPLAY as NULL_DISPLAY20, Row as Row16, Text as Text28, Unit as Unit27 } from "@ksp-gonogo/ui-kit";
import { Fragment as Fragment23, jsx as jsx36, jsxs as jsxs33 } from "react/jsx-runtime";
var RP1_FUND_TARGET_CANCEL_COMMAND = "rp1.fundTarget.cancel";
function StandingFundTarget({
  handle,
  target
}) {
  return /* @__PURE__ */ jsxs33(Row16, { as: "div", children: [
    /* @__PURE__ */ jsxs33(Text28, { size: "xs", level: "muted", children: [
      target.targetFunds == null ? NULL_DISPLAY20 : /* @__PURE__ */ jsx36(Unit27, { value: target.targetFunds, decimals: 0 }),
      target.timeLeft != null && /* @__PURE__ */ jsxs33(Fragment23, { children: [
        " \xB7 ",
        /* @__PURE__ */ jsx36(Unit27, { value: target.timeLeft }),
        " away"
      ] })
    ] }),
    /* @__PURE__ */ jsx36(
      CommandButton19,
      {
        args: {},
        "aria-label": "Cancel the fund target",
        commandLabel: "Cancel the fund target",
        handle,
        label: "Cancel",
        size: "sm"
      }
    )
  ] });
}

// src/WarpTargets/index.tsx
import { jsx as jsx37, jsxs as jsxs34 } from "react/jsx-runtime";
var RP1_NEXT_COMPLETION_ALARM_KEY = "next-completion";
var LEAD_SECONDS = 10;
function WarpTargets() {
  const available = current(useTelemetry23("rp1.available"));
  const fundTarget = current(useTelemetry23("rp1.fundTarget"));
  const next = current(useTelemetry23("rp1.nextCompletion"));
  const requestAlarm = useAlarmRequest2(RP1);
  const cancelFundTarget = useCommand14(RP1_FUND_TARGET_CANCEL_COMMAND);
  if (available !== true) {
    return null;
  }
  const waiting = next?.ut != null;
  const project = next?.label ?? "the next project";
  return /* @__PURE__ */ jsxs34(Stack24, { gap: "caption", children: [
    /* @__PURE__ */ jsxs34(Inline6, { gap: "related-packed", children: [
      /* @__PURE__ */ jsx37(
        Button3,
        {
          "aria-label": `Set an alarm for when ${project} finishes. It spends nothing.`,
          disabled: !waiting,
          onClick: () => requestAlarm({
            key: RP1_NEXT_COMPLETION_ALARM_KEY,
            name: "Next RP-1 project finishes",
            trigger: {
              kind: "instant",
              topic: "rp1.nextCompletion",
              fieldPath: "ut",
              leadSeconds: LEAD_SECONDS
            }
          }),
          size: "sm",
          type: "button",
          children: "next completion"
        }
      ),
      /* @__PURE__ */ jsx37(Text29, { size: "xs", level: "muted", children: waiting ? project : "nothing in progress" })
    ] }),
    fundTarget?.active === true && /* @__PURE__ */ jsx37(StandingFundTarget, { handle: cancelFundTarget, target: fundTarget })
  ] });
}
registerAugment20({
  id: "rp1-warp-targets",
  augments: "warp-control.stepper",
  component: WarpTargets,
  priority: 0,
  owner: RP1
});

// src/commands.ts
import { registerUplinkCommand } from "@ksp-gonogo/sitrep-sdk";

// src/__generated__/command-map.ts
var GENERATED_COMMAND_RAIL = {
  "rp1.build.quote": { replies: true, delayed: true },
  "rp1.build.repeat": { replies: true, delayed: true },
  "rp1.build.start": { replies: true, delayed: true },
  "rp1.complex.dismantle": { replies: true, delayed: true },
  "rp1.complex.modify": { replies: true, delayed: true },
  "rp1.complex.new": { replies: true, delayed: true },
  "rp1.complex.rename": { replies: true, delayed: true },
  "rp1.complex.rush": { replies: true, delayed: true },
  "rp1.construction.cancel": { replies: true, delayed: true },
  "rp1.construction.setRate": { replies: true, delayed: true },
  "rp1.contracts.setPayload": { replies: true, delayed: true },
  "rp1.facility.upgrade": { replies: true, delayed: true },
  "rp1.fundTarget.cancel": { replies: true, delayed: true },
  "rp1.hireTarget.cancel": { replies: true, delayed: true },
  "rp1.hireTarget.set": { replies: true, delayed: true },
  "rp1.leader.appoint": { replies: true, delayed: true },
  "rp1.pad.dismantle": { replies: true, delayed: true },
  "rp1.pad.new": { replies: true, delayed: true },
  "rp1.pad.rename": { replies: true, delayed: true },
  "rp1.personnel.assign": { replies: true, delayed: true },
  "rp1.personnel.fire": { replies: true, delayed: true },
  "rp1.personnel.hire": { replies: true, delayed: true },
  "rp1.program.accept": { replies: true, delayed: true },
  "rp1.program.complete": { replies: true, delayed: true },
  "rp1.research.setRate": { replies: true, delayed: true },
  "rp1.tech.research": { replies: true, delayed: true },
  "rp1.tooling.refit": { replies: true, delayed: true },
  "rp1.tooling.toolAll": { replies: true, delayed: true },
  "rp1.training.cancel": { replies: true, delayed: true },
  "rp1.training.enrol": { replies: true, delayed: true },
  "rp1.training.remove": { replies: true, delayed: true },
  "rp1.vehicle.rollback": { replies: true, delayed: true },
  "rp1.vehicle.rollout": { replies: true, delayed: true },
  "rp1.vehicle.scrap": { replies: true, delayed: true }
};
var GENERATED_COMMAND_IDS = [
  "rp1.build.quote",
  "rp1.build.repeat",
  "rp1.build.start",
  "rp1.complex.dismantle",
  "rp1.complex.modify",
  "rp1.complex.new",
  "rp1.complex.rename",
  "rp1.complex.rush",
  "rp1.construction.cancel",
  "rp1.construction.setRate",
  "rp1.contracts.setPayload",
  "rp1.facility.upgrade",
  "rp1.fundTarget.cancel",
  "rp1.hireTarget.cancel",
  "rp1.hireTarget.set",
  "rp1.leader.appoint",
  "rp1.pad.dismantle",
  "rp1.pad.new",
  "rp1.pad.rename",
  "rp1.personnel.assign",
  "rp1.personnel.fire",
  "rp1.personnel.hire",
  "rp1.program.accept",
  "rp1.program.complete",
  "rp1.research.setRate",
  "rp1.tech.research",
  "rp1.tooling.refit",
  "rp1.tooling.toolAll",
  "rp1.training.cancel",
  "rp1.training.enrol",
  "rp1.training.remove",
  "rp1.vehicle.rollback",
  "rp1.vehicle.rollout",
  "rp1.vehicle.scrap"
];

// src/commands.ts
for (const id of GENERATED_COMMAND_IDS) {
  registerUplinkCommand(id, GENERATED_COMMAND_RAIL[id]);
}
export {
  BuildCostSection,
  BuildingSection,
  ContractPayload,
  CrewSchedule,
  CrewTrainingBadge,
  FacilityUpgrades,
  Finances,
  KscComplexes,
  KscConstruction,
  LaunchComplexStatus,
  LeaderDetail,
  ProgramDetail,
  RP1,
  RP1_AVAILABLE_TOPIC,
  RP1_AVIONICS_TOPIC,
  RP1_BUILD_QUEUE_TOPIC,
  RP1_BUILD_REPEAT_COMMAND,
  RP1_CENTRES_TOPIC,
  RP1_COMPLEXES_TOPIC,
  RP1_COMPLEX_RUSH_COMMAND,
  RP1_CONFIDENCE_TOPIC,
  RP1_CONSTRUCTIONS_TOPIC,
  RP1_CONTRACT_PAYLOAD_COMMAND,
  RP1_CREW_PROGRAM_TOPIC,
  RP1_CREW_TOPIC,
  RP1_FACILITY_UPGRADE_COMMAND,
  RP1_OPERATIONS_TOPIC,
  RP1_PADS_TOPIC,
  RP1_PERSONNEL_ASSIGN_COMMAND,
  RP1_PERSONNEL_TOPIC,
  RP1_PROGRAMS_TOPIC,
  RP1_PROGRAM_ACCEPT_COMMAND,
  RP1_PROGRAM_FUNDING_CURVES_TOPIC,
  RP1_PROGRAM_SLOTS_TOPIC,
  RP1_RESEARCH_TOPIC,
  RP1_ROLLBACK_COMMAND,
  RP1_ROLLOUT_COMMAND,
  RP1_RUSH_TERMS_TOPIC,
  RP1_SCRAP_COMMAND,
  RP1_SIMULATION_TOPIC,
  RP1_TECH_RESEARCH_COMMAND,
  RP1_TOOLING_TOPIC,
  RP1_TOOL_ALL_COMMAND,
  RP1_TRAINING_CANCEL_COMMAND,
  RP1_TRAINING_ENROL_COMMAND,
  RP1_TRAINING_REMOVE_COMMAND,
  RP1_UNIT_SYMBOLS,
  RP1_WAREHOUSE_TOPIC,
  ResearchQueue,
  StartResearch,
  ToolingSection,
  TrainingCourses,
  TrainingEnrolment,
  GENERATED_COMMAND_IDS as UPLINK_COMMAND_IDS,
  VEHICLE_ASSEMBLY_SECTIONS,
  VehicleAssembly,
  WarehouseSection,
  WarpTargets,
  avionicsBadges,
  simulationBadges
};
