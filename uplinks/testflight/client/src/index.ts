// @ksp-gonogo/gonogo-testflight-uplink: the TestFlight Uplink client package entry.
//
// Topics and commands are RE-EXPORTED rather than imported for side effect: a
// bare import is elided from the emitted `dist/index.d.ts`, and the
// `declare module` augmentations they carry would not cross the package boundary.

export type {
  TestFlightReliabilityBudget,
  TestFlightReliabilityPart,
  TestFlightReliabilitySummary,
  TestFlightRepairOutcome,
  TestFlightRepairPartArgs,
} from "./__generated__/contract.js";
export { UPLINK_COMMAND_IDS } from "./commands.js";
export {
  TESTFLIGHT_AVAILABLE_TOPIC,
  TESTFLIGHT_RELIABILITY_PARTS_TOPIC,
  TESTFLIGHT_RELIABILITY_TOPIC,
} from "./topics.js";

import "./uplink.js";
// FleetRoster's per-vessel `fleet-roster.updates` slot: TestFlight's failed and
// wearing engines on the active craft's row, with TestFlight's own repair.
import "./Reliability/index.js";
