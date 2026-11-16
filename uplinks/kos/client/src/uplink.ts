// Uplink client identity. One
// declaration per client bundle: every widget/augment this package
// registers stamps this handle as `owner`, so the widget picker's mod
// search tags (effectiveSearchTags) derive "kos" automatically instead of
// relying on a per-widget field someone has to remember to set.
import { defineUplinkClient, registerErrorCodes } from "@ksp-gonogo/sitrep-sdk";
import { KOS_ERROR_CODES } from "./__generated__/error-codes.js";
import { GENERATED_CONTRACT_TAGS } from "./__generated__/units.js";

/**
 * This client's one version line, and it must equal `package.json`'s. The
 * declaration is the source of the number and `gonogo-uplink.json` is generated
 * from it, so the manifest cannot supply it. `uplink-tools docs` refuses to
 * write a manifest whose declared version disagrees with the package's, so the
 * two cannot drift unnoticed.
 */
const UPLINK_VERSION = "0.0.0-development";

// "kOS" (the mod/community's own capitalisation) rather than the "kos"
// id: best-effort human label for management/health surfaces; not load-
// bearing anywhere the `id` itself already is.
export const KOS = defineUplinkClient({
  id: "kos",
  version: UPLINK_VERSION,
  name: "kOS",
  description:
    "Integrates kOS terminals into the dashboard.",
  tags: GENERATED_CONTRACT_TAGS,
});

registerErrorCodes(KOS_ERROR_CODES);
