// The TestFlight Uplink client's identity, and the refusals its repair can answer
// with, registered so a refused repair reads in TestFlight's own words.
import { defineUplinkClient, registerErrorCodes } from "@ksp-gonogo/sitrep-sdk";
import { TESTFLIGHT_ERROR_CODES } from "./__generated__/error-codes.js";
import { GENERATED_CONTRACT_TAGS } from "./__generated__/units.js";

const UPLINK_VERSION = "0.0.0-development";

export const TESTFLIGHT = defineUplinkClient({
  id: "testflight",
  version: UPLINK_VERSION,
  name: "TestFlight",
  description:
    "Adds the ability for Gonogo to display TestFlight reliability in the Vessel Catalog and Vessel Schematics.",
  tags: GENERATED_CONTRACT_TAGS,
});

registerErrorCodes(TESTFLIGHT_ERROR_CODES);
