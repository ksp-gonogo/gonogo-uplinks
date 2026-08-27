// This Uplink owns `example.heartbeat`, so this Uplink's client declares it, in
// two halves.
//
// The sdk generates nothing for a Topic whose payload type lives outside
// `Sitrep.Contract`, and that is deliberate: a mod-specific line in the shared,
// mod-agnostic facade is exactly the leak the Uplink boundary exists to prevent.
// So the declaration lives here:
//
//   TYPE: a `declare module` augmentation adds the Topic to `TopicPayloadMap`,
//   so `useTelemetry("example.heartbeat")` resolves to the payload type in any
//   program that statically imports this module
//
//   RUNTIME: `registerTopicUnits` feeds the units the codegen emitted into the
//   sdk's runtime registry, so a decoded payload arrives WRAPPED (`Value<"ut">`
//   rather than a bare number). The codegen fixes the compile-time type; this
//   fixes the decode-time value. Both are needed, and only one of them is
//   visible in a typecheck.
//
// `index.ts` imports this module for its side effects, so importing the package
// wires both halves.

import { registerTopicUnits, registerTypeUnits } from "@ksp-gonogo/sitrep-sdk";
import type { ExampleHeartbeat } from "./__generated__/contract.js";
import {
  GENERATED_TOPIC_SHAPES,
  GENERATED_TOPIC_UNITS,
  GENERATED_TYPE_SHAPES,
  GENERATED_TYPE_UNITS,
} from "./__generated__/units.js";

declare module "@ksp-gonogo/sitrep-sdk" {
  interface TopicPayloadMap {
    "example.heartbeat": ExampleHeartbeat;
  }
}

for (const [topic, units] of Object.entries(GENERATED_TOPIC_UNITS)) {
  registerTopicUnits(topic, units, GENERATED_TOPIC_SHAPES[topic] ?? {});
}
for (const [typeName, units] of Object.entries(GENERATED_TYPE_UNITS)) {
  registerTypeUnits(typeName, units, GENERATED_TYPE_SHAPES[typeName] ?? {});
}

export type { ExampleHeartbeat };
