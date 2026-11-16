// Uplink client identity. One
// declaration per client bundle: every widget/augment this package
// registers stamps this handle as `owner`, so the widget picker's mod
// search tags (effectiveSearchTags) derive "scansat" automatically instead
// of relying on a per-widget field someone has to remember to set.
import { defineUplinkClient } from "@ksp-gonogo/sitrep-sdk";
import { GENERATED_CONTRACT_TAGS } from "./__generated__/units.js";

/**
 * This client's one version line, and it must equal `package.json`'s. The
 * declaration is the source of the number and `gonogo-uplink.json` is generated
 * from it, so the manifest cannot supply it. `uplink-tools docs` refuses to
 * write a manifest whose declared version disagrees with the package's, so the
 * two cannot drift without something saying so.
 */
const UPLINK_VERSION = "0.0.0-development";

export const SCANSAT = defineUplinkClient({
  id: "scansat",
  version: UPLINK_VERSION,
  name: "SCANsat",
  description:
    "Integrates SCANsat's map data system into Gonogo. The Ground Track widget relies on scanning data from SCANsat to show any real map data.",
  tags: GENERATED_CONTRACT_TAGS,
});
