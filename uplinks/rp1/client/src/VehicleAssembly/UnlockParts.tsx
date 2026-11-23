import { magnitudeOf, useCommand, value } from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  Button,
  Cluster,
  DataLine,
  NULL_DISPLAY,
  Stack,
  Text,
  Unit,
} from "@ksp-gonogo/ui-kit";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Value } from "@ksp-gonogo/sitrep-sdk";
import type {
  Rp1BuildableCraftEntry,
  Rp1PartUnlockQuote,
} from "../__generated__/contract.js";
import { asFunds } from "./funds.js";

/**
 * Buy the researched parts of a saved craft. Must match
 * `Rp1BuildStartCommands.UnlockCommand`.
 */
export const RP1_PARTS_UNLOCK_COMMAND = "rp1.parts.unlock";

/**
 * Ask what unlocking a craft's researched parts would cost, without unlocking.
 * Must match `Rp1BuildStartCommands.UnlockQuoteCommand`.
 */
export const RP1_PARTS_UNLOCK_QUOTE_COMMAND = "rp1.parts.unlock.quote";

/** A quote with its figures carrying their units, ready to draw. */
interface UnlockFigures {
  readonly affordable: boolean;
  readonly balance: Value<"funds"> | null;
  readonly credit: Value<"funds">;
  readonly fundsToPay: Value<"funds">;
  readonly partCount: Value<"count">;
  readonly price: Value<"funds">;
}

function unlockFigures(
  quote: Readonly<Rp1PartUnlockQuote> | null | undefined,
): UnlockFigures | null {
  if (quote == null) {
    return null;
  }
  return {
    affordable: quote.affordable === true,
    balance: asFunds(quote.balance),
    credit: asFunds(quote.creditApplied),
    fundsToPay: asFunds(quote.fundsToPay),
    partCount:
      typeof quote.partCount === "number"
        ? value("count", quote.partCount)
        : quote.partCount,
    price: asFunds(quote.price),
  };
}

/**
 * What unlocking this craft's researched parts costs, and the control that does
 * it, drawn beside the craft's Build buttons. Useful for showing the operator
 * the price before credit, the unlock credit it uses and the funds still to pay
 * before anything is spent, which is what RP-1 asks at its own integrate
 * prompt. Used by the cards of the Vehicle Assembly start a build section.
 *
 * <para>RP-1 charges an unlock in full when it is made, unlock credit first and
 * funds for what the credit does not cover, so "cannot afford" is true here: a
 * funds remainder the career cannot meet is refused, not slowed. The readout is
 * in the card body and not in an aside, which collapses at narrow widths and
 * would take the figures with it. The quote is asked once when the card is
 * drawn and again only when the craft's parts change, because a quote loads the
 * craft's parts in the game.</para>
 */
export function UnlockParts({
  children,
  craft,
  file,
  name,
  parts,
}: Readonly<{
  /** The Build controls, drawn in the same row as the unlock control. */
  children: ReactNode;
  craft: Rp1BuildableCraftEntry;
  file: string;
  name: string;
  /** The distinct parts that are researched and not bought. */
  parts: readonly string[];
}>) {
  const unlock = useCommand(RP1_PARTS_UNLOCK_COMMAND);
  const quote = useCommand(RP1_PARTS_UNLOCK_QUOTE_COMMAND, {
    rail: false,
    vantage: "meta",
  });
  const send = useRef(quote.dangerouslySendWithoutInput);
  send.current = quote.dangerouslySendWithoutInput;
  const [answer, setAnswer] = useState<UnlockFigures | "unquoted" | null>(null);
  const facility = craft.facility;
  const partsKey = parts.join("\u001f");

  // biome-ignore lint/correctness/useExhaustiveDependencies: a changed parts list is what makes the earlier quote stale
  useEffect(() => {
    let live = true;
    send
      .current({ craftFile: file, facility: facility ?? undefined })
      .then((reply) => {
        if (live) {
          setAnswer(unlockFigures(reply.payload) ?? "unquoted");
        }
      })
      .catch(() => {
        if (live) {
          setAnswer("unquoted");
        }
      });
    return () => {
      live = false;
    };
  }, [file, facility, partsKey]);

  const figures = answer === null || answer === "unquoted" ? null : answer;
  const toPay = figures === null ? null : magnitudeOf(figures.fundsToPay);
  const held = figures === null ? null : magnitudeOf(figures.balance);
  const shortBy =
    figures !== null && !figures.affordable && toPay !== null && held !== null
      ? toPay - held
      : null;

  return (
    <Stack gap="related-dense">
      {answer === null ? null : (
        <Stack gap="related-dense">
          <DataLine label="Parts to unlock">
            {figures === null ? (
              NULL_DISPLAY
            ) : (
              <Unit value={figures.partCount} />
            )}
          </DataLine>
          <DataLine label="Unlock price">
            {figures === null ? (
              NULL_DISPLAY
            ) : (
              <Unit value={figures.price} decimals={0} />
            )}
          </DataLine>
          <DataLine label="Unlock credit used">
            {figures === null ? (
              NULL_DISPLAY
            ) : (
              <Unit value={figures.credit} decimals={0} />
            )}
          </DataLine>
          <DataLine label="Funds to pay">
            {figures === null ? (
              NULL_DISPLAY
            ) : (
              <>
                <Unit value={figures.fundsToPay} decimals={0} />
                {!figures.affordable && (
                  <>
                    {" "}
                    <Badge tone="caution">SHORT</Badge>
                  </>
                )}
              </>
            )}
          </DataLine>
        </Stack>
      )}
      <Cluster gap="related-dense" justify="start" wrap>
        <Button
          command={unlock.with(
            { craftFile: file, facility: craft.facility ?? undefined },
            { label: `Unlock the researched parts of ${name}` },
          )}
          variant="ghost"
          aria-label={`Unlock ${parts.length} researched ${parts.length === 1 ? "part" : "parts"} of ${name}`}
          confirmAriaLabel={`Confirm unlocking the parts of ${name}`}
          confirmLabel={<SpendWording figures={figures} />}
          unavailable={
            shortBy === null
              ? null
              : `Short ${Math.ceil(shortBy).toLocaleString("en-US")}f`
          }
          size="sm"
        >
          Unlock parts
        </Button>
        {children}
      </Cluster>
    </Stack>
  );
}

/**
 * What the confirm press spends: the credit, then the funds, each only when
 * there is some. A quote that did not arrive says the spend is unknown and the
 * press is still offered, because the command reads the same price itself and
 * refuses in RP-1's own words when it cannot.
 */
function SpendWording({
  figures,
}: Readonly<{ figures: UnlockFigures | null }>) {
  if (figures === null) {
    return <>Spend {NULL_DISPLAY}</>;
  }
  const credit = magnitudeOf(figures.credit);
  const funds = magnitudeOf(figures.fundsToPay);
  if (funds === 0) {
    return (
      <>
        Spend <Unit value={figures.credit} decimals={0} /> of credit
      </>
    );
  }
  if (credit === 0) {
    return (
      <>
        Spend <Unit value={figures.fundsToPay} decimals={0} />
      </>
    );
  }
  return (
    <>
      Spend <Unit value={figures.credit} decimals={0} /> of credit and{" "}
      <Unit value={figures.fundsToPay} decimals={0} />
    </>
  );
}
