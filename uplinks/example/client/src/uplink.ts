// This client's identity. One declaration per bundle: every widget and augment
// the package registers stamps this handle as `owner`, so the dashboard's widget
// picker derives "example" as a search tag automatically rather than relying on a
// per-widget field somebody has to remember.
import { defineUplinkClient } from "@ksp-gonogo/sitrep-sdk";

/**
 * Must equal `package.json`'s version. The declaration is the source of the
 * number and `gonogo-uplink.json` is generated FROM it, so the manifest cannot
 * supply it and the two cannot drift silently.
 */
const UPLINK_VERSION = "0.0.1";

export const EXAMPLE = defineUplinkClient({
  id: "example",
  version: UPLINK_VERSION,
  name: "Example",
});
