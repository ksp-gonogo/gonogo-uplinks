import type { Reading, Value } from "@ksp-gonogo/sitrep-sdk";
import { Countdown } from "@ksp-gonogo/ui-kit";

/**
 * How long until a burn ignites, or how long ago it did, as "in 22min" or
 * "2h ago". The figure is the one its caller passes in `until`, which is
 * negative once the ignition is behind the screen's time.
 * Useful for showing the operator when a planned burn happens without a launch
 * clock's signs. Used by the flight plan section and the burn editor.
 */
export function IgnitionTime({
  until,
}: Readonly<{ until: Reading<Value<"s">> }>) {
  /*
   * The tense follows the figure Countdown draws: the model's when one carries
   * the plan past the received edge, the observation otherwise.
   */
  const modelled =
    until.reckoning.status === "available" && until.reckoning.beyondReceived
      ? until.reckoning.modelled
      : undefined;
  const seconds = (modelled ?? until.value)?.magnitude;
  if (seconds === undefined || !Number.isFinite(seconds)) {
    return <Countdown value={until} />;
  }
  if (seconds < 0) {
    return (
      <>
        <Countdown value={until} /> ago
      </>
    );
  }
  return (
    <>
      in <Countdown value={until} />
    </>
  );
}
