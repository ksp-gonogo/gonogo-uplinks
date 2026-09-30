// The TestFlight Uplink's Topics, registered in both halves: a
// `declare module` augmentation so `useTelemetry("testflight.reliability")`
// resolves its payload type, and the runtime registry plus this slice's unit and
// shape maps so the quantities decode as `Value`s. `index.ts` re-exports this
// module so the augmentation reaches the emitted `dist/index.d.ts`.
import {
  registerBarePrimitiveTopic,
  registerCollectionTopic,
  registerTopicUnits,
  registerTypeUnits,
  type TopicPayload,
} from "@ksp-gonogo/sitrep-sdk";
import type {
  TestFlightReliabilityPart,
  TestFlightReliabilitySummary,
} from "./__generated__/contract.js";
import { GENERATED_COLLECTION_TOPIC_IDS } from "./__generated__/topic-map.js";
import {
  GENERATED_TOPIC_SHAPES,
  GENERATED_TOPIC_UNITS,
  GENERATED_TYPE_SHAPES,
  GENERATED_TYPE_UNITS,
} from "./__generated__/units.js";

/**
 * The Domain presence gate: a bare boolean, so it never flows through codegen.
 * Must match `TestFlightUplink.AvailableTopic`.
 */
export const TESTFLIGHT_AVAILABLE_TOPIC = "testflight.available";

/** Whether TestFlight is reporting on the craft's engines. Must match `TestFlightUplink.ReliabilityTopic`. */
export const TESTFLIGHT_RELIABILITY_TOPIC = "testflight.reliability";

/** One entry per live TestFlight core aboard (an array channel). Must match `TestFlightUplink.ReliabilityPartsTopic`. */
export const TESTFLIGHT_RELIABILITY_PARTS_TOPIC = "testflight.reliabilityParts";

declare module "@ksp-gonogo/sitrep-sdk" {
  interface TopicPayloadMap {
    "testflight.available": boolean;
    "testflight.reliability": TestFlightReliabilitySummary;
    "testflight.reliabilityParts": TestFlightReliabilityPart[];
  }
}

registerBarePrimitiveTopic(TESTFLIGHT_AVAILABLE_TOPIC);
registerBarePrimitiveTopic(TESTFLIGHT_RELIABILITY_TOPIC);
registerBarePrimitiveTopic(TESTFLIGHT_RELIABILITY_PARTS_TOPIC);

// The parts Topic's unit map describes one engine, not the list.
for (const topic of GENERATED_COLLECTION_TOPIC_IDS) {
  registerCollectionTopic(topic);
}

// Both registries: the Topic's own fields, and the budget shape nested inside a
// part, which the decode resolves by type name.
for (const [topic, units] of Object.entries(GENERATED_TOPIC_UNITS)) {
  registerTopicUnits(topic, units, GENERATED_TOPIC_SHAPES[topic] ?? {});
}
for (const [typeName, units] of Object.entries(GENERATED_TYPE_UNITS)) {
  registerTypeUnits(typeName, units, GENERATED_TYPE_SHAPES[typeName] ?? {});
}

/**
 * A compile-time invariant: the augmentation above is in-program and resolves
 * each Topic to its real payload type rather than `unknown`. Type-only, so it is
 * erased at runtime.
 */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;
export type _ResolvesTestFlightAvailable = Expect<
  Equal<TopicPayload<"testflight.available">, boolean>
>;
export type _ResolvesTestFlightReliability = Expect<
  Equal<TopicPayload<"testflight.reliability">, TestFlightReliabilitySummary>
>;
export type _ResolvesTestFlightReliabilityParts = Expect<
  Equal<
    TopicPayload<"testflight.reliabilityParts">,
    TestFlightReliabilityPart[]
  >
>;
