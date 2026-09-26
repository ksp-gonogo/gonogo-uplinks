// GonogoRp1Uplink client for gonogo.
//
// Co-located with the GonogoRp1Uplink C# mod (mod/GonogoRp1Uplink): one
// directory holds the mod and the client TS it ships. Importing this entry
// point side-effects every registration into the host's registries.
import "./uplink.js";
import "./units.js";
import "./topics.js";
import "./Avionics/badge.js";
import "./AdminBuilding/programsScreen.js";
import "./CrewSchedule/index.js";
import "./CrewSchedule/badge.js";
import "./CrewSchedule/coreStats.js";
import "./CrewSchedule/courses.js";
import "./CrewSchedule/enrolment.js";
import "./ContractPayload/index.js";
import "./FacilityUpgrades/index.js";
import "./FacilityUpgrades/facilityTiers.js";
import "./KscComplexes/index.js";
import "./KscConstruction/index.js";
import "./LaunchComplexStatus/index.js";
import "./ProgramDetail/index.js";
import "./ProgramStatus/index.js";
import "./ResearchQueue/index.js";
import "./StartResearch/index.js";
import "./VehicleAssembly/index.js";
import "./WarpTargets/index.js";

export { avionicsBadges } from "./Avionics/badge.js";
export {
  ContractPayload,
  RP1_CONTRACT_PAYLOAD_COMMAND,
} from "./ContractPayload/index.js";
export { CrewSchedule } from "./CrewSchedule/index.js";
export { CrewTrainingBadge } from "./CrewSchedule/badge.js";
export { TrainingCourses } from "./CrewSchedule/courses.js";
export { TrainingEnrolment } from "./CrewSchedule/enrolment.js";
export {
  RP1_TRAINING_CANCEL_COMMAND,
  RP1_TRAINING_ENROL_COMMAND,
  RP1_TRAINING_REMOVE_COMMAND,
} from "./CrewSchedule/training.js";
// This Uplink's own commands: the `CommandArgsMap`/`CommandReplyMap`
// augmentation and the runtime registration. RE-EXPORTED rather than imported
// for side effect, for the same reason ./topics is: a bare import is elided from
// the emitted `dist/index.d.ts` and the augmentation would not cross the package
// boundary.
export { UPLINK_COMMAND_IDS } from "./commands.js";
export {
  FacilityUpgrades,
  RP1_FACILITY_UPGRADE_COMMAND,
} from "./FacilityUpgrades/index.js";
export {
  KscComplexes,
  RP1_COMPLEX_RUSH_COMMAND,
  RP1_PERSONNEL_ASSIGN_COMMAND,
} from "./KscComplexes/index.js";
export { KscConstruction } from "./KscConstruction/index.js";
export { LaunchComplexStatus } from "./LaunchComplexStatus/index.js";
export {
  ProgramDetail,
  RP1_STRATEGY_ACTIVATE_COMMAND,
} from "./ProgramDetail/index.js";
export { ProgramStatus } from "./ProgramStatus/index.js";
export { ResearchQueue } from "./ResearchQueue/index.js";
export {
  RP1_TECH_RESEARCH_COMMAND,
  StartResearch,
} from "./StartResearch/index.js";
export {
  RP1_AVAILABLE_TOPIC,
  RP1_AVIONICS_TOPIC,
  RP1_BUILD_QUEUE_TOPIC,
  RP1_CENTRES_TOPIC,
  RP1_COMPLEXES_TOPIC,
  RP1_CONFIDENCE_TOPIC,
  RP1_CONSTRUCTIONS_TOPIC,
  RP1_CREW_PROGRAM_TOPIC,
  RP1_CREW_TOPIC,
  RP1_OPERATIONS_TOPIC,
  RP1_PADS_TOPIC,
  RP1_PERSONNEL_TOPIC,
  RP1_PROGRAM_FUNDING_CURVES_TOPIC,
  RP1_PROGRAM_SLOTS_TOPIC,
  RP1_PROGRAMS_TOPIC,
  RP1_RESEARCH_TOPIC,
  RP1_RUSH_TERMS_TOPIC,
  RP1_TOOLING_TOPIC,
  RP1_WAREHOUSE_TOPIC,
} from "./topics.js";
// The unit tokens this Uplink declares. RE-EXPORTED, like ./commands, because the
// module carries a UnitDeclarations augmentation and only a named export carries
// it into `dist/index.d.ts`.
export { RP1_UNIT_SYMBOLS } from "./units.js";
export { RP1 } from "./uplink.js";
export {
  RP1_BUILD_REPEAT_COMMAND,
  VehicleAssembly,
} from "./VehicleAssembly/index.js";
export { BuildCostSection } from "./VehicleAssembly/BuildCost.js";
export { BuildingSection } from "./VehicleAssembly/Building.js";
export { VEHICLE_ASSEMBLY_SECTIONS } from "./VehicleAssembly/slot.js";
export {
  RP1_TOOL_ALL_COMMAND,
  ToolingSection,
} from "./VehicleAssembly/Tooling.js";
export {
  RP1_ROLLBACK_COMMAND,
  RP1_ROLLOUT_COMMAND,
  RP1_SCRAP_COMMAND,
} from "./VehicleAssembly/VehicleSection.js";
export { WarehouseSection } from "./VehicleAssembly/Warehouse.js";
export { RP1_WARP_TO_COMPLETE_COMMAND, WarpTargets } from "./WarpTargets/index.js";
