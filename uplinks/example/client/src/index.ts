// The Example Uplink client: the smallest complete one.
//
// Importing this entry point side-effects every registration, which is the whole
// extension mechanism. There is no central list of widgets anywhere in the app;
// the orchestrator renders whatever the registry holds.
//
//   uplink.ts    declares this client's identity, stamped as `owner` below
//   topics.ts    declares `example.heartbeat`, type and runtime units
//   Heartbeat    the one widget, registered so the picker can place it
import "./topics.js";
import "./Heartbeat/index.js";
import "./PulseDial/index.js";
import "./CadenceSection/index.js";
import "./HeartbeatBlob/index.js";

export { EXAMPLE } from "./uplink.js";
export { HeartbeatWidget } from "./Heartbeat/index.js";
export { PulseDialWidget } from "./PulseDial/index.js";
export { CadenceSection } from "./CadenceSection/index.js";
export type { ExampleHeartbeat } from "./topics.js";
