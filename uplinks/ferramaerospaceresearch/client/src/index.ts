// GonogoFerramAerospaceResearchUplink client for gonogo.
//
// Co-located with the C# mod (mod/GonogoFerramAerospaceResearchUplink): one
// directory holds the mod and the client TS it ships. Importing this entry point
// side-effects every registration into the host's registries.
import "./uplink.js";
import "./units.js";
import "./topics.js";
import "./AeroState/index.js";
import "./DescentEnvelope/index.js";

export { AeroStateComponent } from "./AeroState/index.js";
export { aeroBadges, aeroDescentLayers } from "./DescentEnvelope/index.js";
export { AERO_AVAILABLE_TOPIC, AERO_STATE_TOPIC } from "./topics.js";
export { AERO } from "./uplink.js";
