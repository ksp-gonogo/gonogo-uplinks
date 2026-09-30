import {
  type TopicReading,
  useAlarmRequest,
  useStream,
  useTelemetry,
  type Value,
  value,
} from "@ksp-gonogo/sitrep-sdk";
import {
  Button,
  MissionDate,
  magnitudeOf,
  NULL_DISPLAY,
  Row,
  RowName,
  Section,
  Text,
  UnitInput,
} from "@ksp-gonogo/ui-kit";
import { useEffect, useState } from "react";
import { current, latest } from "../shared/current.js";
import { fundsReachedAtTopic, RP1_AVAILABLE_TOPIC } from "../topics.js";
import { RP1 } from "../uplink.js";

/**
 * The Topic carrying the career balance, and the path to it. The balance is a
 * plain number on `career.status`, so the alarm below is a condition the
 * simulation reads for itself at the command centre rather than one this screen
 * has to poll.
 */
const CAREER_TOPIC = "career.status";
const FUNDS_PATH = "balances.funds";

/**
 * One alarm per career, matching RP-1's own one-target-per-career model. Asking
 * again under this key retargets the alarm rather than adding a second, so an
 * operator who revises a figure ends up with one row.
 */
const ALARM_KEY = "fund-target";

/** How long a typed figure holds still before RP-1 is asked about it, so typing 250000 asks once rather than six times. */
const ASK_AFTER_MS = 400;

/**
 * An alarm on the career balance, with RP-1's own forecast of when it fires.
 *
 * <para><b>It spends nothing, and no affordability line belongs here.</b> The
 * figure is the balance the alarm is MEASURED against, not a price: the alarm
 * is the app's, evaluated in the simulation at the active command centre, and
 * it stops a warp on the tick that centre learns the balance.</para>
 *
 * <para><b>The forecast is RP-1's</b>, from <c>EstimateTimeToFunds</c> for the
 * figure typed, and says so when RP-1's forecast does not reach it. When RP-1
 * holds a fund target of its own, the figure seeds from it: that is the
 * threshold RP-1 is already working toward, and arming on it is a press rather
 * than a retype.</para>
 */
export function FundsAlarm() {
  const requestAlarm = useAlarmRequest(RP1);
  const fundTarget = current(useTelemetry("rp1.fundTarget"));
  const balance = magnitudeOf(current(useTelemetry("career.status"))?.balances?.funds);
  const [typed, setTyped] = useState<Value<"funds"> | null>(null);

  const standing = fundTarget?.active === true;
  const wanted =
    typed ??
    value("funds", (standing && magnitudeOf(fundTarget?.targetFunds)) || 0);
  const wantedFunds = Math.round(magnitudeOf(wanted) ?? 0);
  const spoken = wantedFunds.toLocaleString("en-GB");

  // Only a typed figure waits: one seeded from RP-1's own target is asked about at once.
  const settledTyped = useSettled(wantedFunds, ASK_AFTER_MS);
  const asked = typed === null ? wantedFunds : settledTyped;
  // A hook cannot be skipped, so with no figure to ask about it holds RP-1's presence gate, which it never reads.
  const forecast = useStream<number | null>(
    asked > 0 ? fundsReachedAtTopic(asked) : RP1_AVAILABLE_TOPIC,
  );

  return (
    <Section gap="related-dense" title="FUNDS ALARM">
      <UnitInput
        label="Target balance"
        onChange={setTyped}
        unit="funds"
        value={wanted}
      />
      <Row as="div">
        <RowName>Balance reaches it</RowName>
        <ReachedAt
          balance={balance}
          figure={wantedFunds}
          forecast={asked === wantedFunds ? forecast : undefined}
        />
      </Row>
      <Row as="div">
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Stop the warp when the balance reaches ${spoken} funds`}
          disabled={wantedFunds <= 0}
          onClick={() =>
            requestAlarm({
              key: ALARM_KEY,
              name: `Balance reaches ${spoken} funds`,
              trigger: {
                kind: "threshold",
                topic: CAREER_TOPIC,
                fieldPath: FUNDS_PATH,
                op: ">=",
                value: wantedFunds,
                /*
                 * The active command centre, not the craft's clock: the
                 * balance belongs to the career, not to a craft. The
                 * simulation judges the alarm against what that centre has
                 * been told and stops the warp on the tick it learns the
                 * balance, with no command from the client.
                 */
                vantage: "command",
              },
            })
          }
          type="button"
        >
          Set alarm
        </Button>
      </Row>
    </Section>
  );
}

/**
 * When RP-1 forecasts the balance reaching the figure. Nothing while the
 * figure is still being typed or RP-1 has not answered, because an answer for
 * a different figure is not this one's.
 */
function ReachedAt({
  balance,
  figure,
  forecast,
}: Readonly<{
  balance: number | null;
  figure: number;
  forecast: TopicReading<number | null> | undefined;
}>) {
  if (figure <= 0) return <Text>{NULL_DISPLAY}</Text>;
  if (balance !== null && balance >= figure) {
    return <Text>already</Text>;
  }
  if (forecast === undefined) return <Text>{NULL_DISPLAY}</Text>;
  // The mod publishes null only when RP-1's forecast does not reach the figure, and a null arrives as an absent reading.
  if (forecast.state === "absent") return <Text>beyond RP-1's forecast</Text>;
  const reachedAt = latest(forecast);
  if (reachedAt === undefined || reachedAt === null) {
    return <Text>{NULL_DISPLAY}</Text>;
  }
  return <MissionDate value={value("ut", reachedAt)} />;
}

/** `value` once it has stopped changing for `ms`. */
function useSettled<T>(next: T, ms: number): T {
  const [settled, setSettled] = useState(next);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(next), ms);
    return () => clearTimeout(timer);
  }, [next, ms]);
  return settled;
}
