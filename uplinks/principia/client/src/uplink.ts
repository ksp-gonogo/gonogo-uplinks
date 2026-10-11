// Uplink client identity: one declaration per client bundle, stamped as `owner`
// on everything this package registers, so the widget picker's mod tags and the
// contribution ids derive from it rather than from a field someone has to
// remember at each registration.
import { defineUplinkClient, registerErrorCodes } from "@ksp-gonogo/sitrep-sdk";
import { PRINCIPIA_ERROR_CODES } from "./__generated__/error-codes.js";

// TODO(version): build-inject this from gonogo-uplink.json.
const UPLINK_VERSION = "0.0.1";

export const PRINCIPIA = defineUplinkClient({
  id: "principia",
  version: UPLINK_VERSION,
  name: "Principia",
  description:
    "Principia's n-body flight on the dashboard: how far each trajectory holds, the " +
    "flight plan and its burns, the reference frame they are quoted in, and " +
    "the integrator settings.",
});

registerErrorCodes(PRINCIPIA_ERROR_CODES);
