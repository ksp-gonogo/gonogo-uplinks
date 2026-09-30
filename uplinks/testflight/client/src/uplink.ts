// The TestFlight Uplink client's identity, and the refusals its repair can answer
// with, registered so a refused repair reads in TestFlight's own words.
import { defineUplinkClient, registerErrorCodes } from "@ksp-gonogo/sitrep-sdk";
import { TESTFLIGHT_ERROR_CODES } from "./__generated__/error-codes.js";

const UPLINK_VERSION = "0.0.1";

export const TESTFLIGHT = defineUplinkClient({
  id: "testflight",
  version: UPLINK_VERSION,
  name: "TestFlight",
  description:
    "TestFlight engine reliability on the fleet roster: failed engines, rated " +
    "burn nearly spent and survival odds, with TestFlight's own repair.",
});

registerErrorCodes(TESTFLIGHT_ERROR_CODES);
