// The TestFlight Uplink client's identity, and the refusals its repair can answer
// with, registered so a refused repair reads in TestFlight's own words.
import { defineUplinkClient, registerErrorCodes } from "@ksp-gonogo/sitrep-sdk";
import { TESTFLIGHT_ERROR_CODES } from "./__generated__/error-codes.js";
import { GENERATED_CONTRACT_TAGS } from "./__generated__/units.js";

const UPLINK_VERSION = "1.0.0-rc.3";

export const TESTFLIGHT = defineUplinkClient({
  id: "testflight",
  version: UPLINK_VERSION,
  name: "TestFlight",
  description:
    "TestFlight engine reliability on the fleet roster: failed engines, rated " +
    "burn nearly spent and survival odds, with TestFlight's own repair.",
  tags: GENERATED_CONTRACT_TAGS,
});

registerErrorCodes(TESTFLIGHT_ERROR_CODES);
