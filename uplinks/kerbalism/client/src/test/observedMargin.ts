import { type Reading, type Value, value } from "@ksp-gonogo/sitrep-sdk";

/** A margin to act as a current observation with no model beside it, or with no figure at all for `null`. */
export function observedMargin(seconds: number | null): Reading<Value<"s">> {
  return {
    state: "observed",
    ...(seconds === null ? {} : { value: value("s", seconds) }),
    atUt: value("ut", 0),
    reckoning: { status: "none" },
  };
}
