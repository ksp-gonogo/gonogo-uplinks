// Uplink client identity: one declaration per client bundle, stamped as `owner`
// on everything this package registers, so the widget picker's mod tags and the
// contribution ids derive from it rather than from a field someone has to
// remember at each registration.
import { defineUplinkClient, registerErrorCodes } from "@ksp-gonogo/sitrep-sdk";
import { PRINCIPIA_ERROR_CODES } from "./__generated__/error-codes.js";
import { GENERATED_CONTRACT_TAGS } from "./__generated__/units.js";

// TODO(version): build-inject this from gonogo-uplink.json.
const UPLINK_VERSION = "0.0.0-development";

export const PRINCIPIA = defineUplinkClient({
  id: "principia",
  version: UPLINK_VERSION,
  name: "Principia",
  description:
    "Makes Gonogo compatible with Principia's n-body physics. All planning widgets work with the integrated model where it's useful.",
  tags: GENERATED_CONTRACT_TAGS,
});

registerErrorCodes(PRINCIPIA_ERROR_CODES);
