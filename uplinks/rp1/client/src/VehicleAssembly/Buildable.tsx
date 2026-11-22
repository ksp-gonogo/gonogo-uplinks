import {
  registerAugment,
  useCommand,
  useTelemetry,
  value,
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  Button,
  Cluster,
  type CommandButtonHandle,
  Countdown,
  DataLine,
  magnitudeOf,
  NULL_DISPLAY,
  Section,
  SectionTitle,
  Stack,
  Text,
  Unit,
} from "@ksp-gonogo/ui-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Value } from "@ksp-gonogo/sitrep-sdk";
import type {
  Rp1BuildableComplex,
  Rp1BuildableCraftEntry,
  Rp1BuildQuote,
} from "../__generated__/contract.js";
import { current } from "../shared/current.js";
import { ProjectCard, ProjectCardList } from "../shared/ProjectCard.js";
import { RP1 } from "../uplink.js";
// Side-effect import: hydrates these Topics' units at decode time. Here rather
// than left to the entry point's import order, because this file is the
// consumer that would silently receive bare numbers without it.
import "../topics.js";
import { VEHICLE_ASSEMBLY_SECTIONS } from "./slot.js";

/**
 * Start integrating a design the space centre has never held. Must match
 * `Rp1BuildStartCommands.StartCommand`.
 */
export const RP1_BUILD_START_COMMAND = "rp1.build.start";

/**
 * Ask what starting a build would charge, without starting it. Must match
 * `Rp1BuildStartCommands.QuoteCommand`.
 */
export const RP1_BUILD_QUOTE_COMMAND = "rp1.build.quote";

/**
 * The save's saved craft, and the complexes that would integrate each one.
 *
 * <para><b>What was missing.</b> The only build command RP-1 exposed copied a
 * vehicle the centre already held, so this widget could offer to order a second
 * Atlas and could never order a first one. Every career starts with nothing
 * built, which made that a dead end rather than a gap, and the surface answered
 * it by offering no build control at all. This is the general case.</para>
 *
 * <para><b>One button per complex that would take the craft, and a reason for
 * every one that would not.</b> A complex decides the mass and size a vehicle
 * may be, whether it may carry crew, and how fast it is built, so choosing one
 * is the whole of the decision an operator is making here. It is never chosen
 * for them, for the same reason a rollout never picks the pad: a mod that
 * silently picks when the choice looks obvious has taken the decision
 * anyway.</para>
 *
 * <para><b>The eligible verdicts are a preview, not a promise.</b> They are
 * measured from the craft file without loading it, so two of RP-1's own
 * conditions cannot be applied and are not: whether the craft is human-rated,
 * which RP-1 derives from part tags, and whether the complex stocks the
 * resources it needs. An unanswerable condition therefore leaves the button
 * pressable and lets the command refuse in RP-1's own words, which is strictly
 * better than a control drawn dark for a reason nobody could establish.</para>
 *
 * <para><b>Contributed rather than drawn by the host widget</b>, through the
 * same slot and the same `registerAugment` call an outside Uplink adding a
 * section would use.</para>
 */
export function BuildableSection() {
  const available = current(useTelemetry("rp1.available"));
  const buildable = current(useTelemetry("rp1.buildable"));

  // Unconditional and above the early returns on purpose: a hook after one
  // would change count on the first frame RP-1 answers.
  const start = useCommand(RP1_BUILD_START_COMMAND);

  // Invisible on every install without RP-1, which is most of them.
  if (available !== true) {
    return null;
  }

  return (
    <Section gap="related-dense">
      <SectionTitle>START A BUILD</SectionTitle>
      {buildable === undefined ? (
        // RP-1 has answered and this channel has not. Said rather than left
        // blank: an operator who sees nothing here has no way to tell a career
        // with no craft saved from an Uplink that is still connecting.
        <Text size="sm" level="muted">
          Waiting for the craft listing
        </Text>
      ) : buildable.length === 0 ? (
        <Text size="sm" level="muted">
          No craft saved. Design one in the VAB or SPH and it appears here.
        </Text>
      ) : (
        <ProjectCardList>
          {buildable.map((craft) => (
            <CraftCard craft={craft} handle={start} key={cardKey(craft)} />
          ))}
        </ProjectCardList>
      )}
    </Section>
  );
}

const NO_FILE_NAME = "No craft file name for this design";

/**
 * One saved craft: what it is, and where it could be
 * built.
 *
 * <para>The card is toned by whether any complex would take it, because that is
 * the question it exists to answer. A craft nothing can build is still drawn,
 * with dead buttons whose tips give the reason: an operator who saved a craft
 * and cannot find it here would go looking for a fault in the Uplink.</para>
 */
function CraftCard({
  craft,
  handle,
}: Readonly<{
  craft: Rp1BuildableCraftEntry;
  handle: CommandButtonHandle;
}>) {
  const name = craft.shipName ?? craft.craftFile ?? NULL_DISPLAY;
  const file = craft.craftFile ?? null;
  const [shortfalls, setShortfalls] = useState<
    Readonly<Record<string, number>>
  >({});
  const reportShortfall = useCallback((key: string, shortBy: number | null) => {
    setShortfalls((held) => {
      if ((held[key] ?? null) === shortBy) {
        return held;
      }
      const { [key]: _dropped, ...rest } = held;
      return shortBy === null ? rest : { ...rest, [key]: shortBy };
    });
  }, []);
  const complexes = craft.complexes ?? [];
  const eligible = complexes.filter((complex) => complex.eligible === true);
  const partBlock = partRefusal(craft);
  /* A craft with no file name has no address, and guessing one from the ship
     name would build whichever file the folder listed first. */
  const blockReason = partBlock ?? (file === null ? NO_FILE_NAME : null);

  return (
    <ProjectCard
      detail={<>{editorOf(craft)}</>}
      name={name}
      tone={eligible.length > 0 && blockReason === null ? "go" : "warn"}
    >
      <Text size="xs" level="muted">
        <Unit value={craft.mass} /> ·{" "}
        {craft.partCount === undefined ? (
          NULL_DISPLAY
        ) : (
          <Unit value={craft.partCount} />
        )}{" "}
        parts
      </Text>

      {blockReason !== null || file === null ? (
        <Cluster gap="related-dense" justify="start" wrap>
          <DeadButtons
            complexes={complexes}
            reason={blockReason ?? NO_FILE_NAME}
          />
        </Cluster>
      ) : (
        <Stack gap="related-dense">
          {eligible.map((complex) => (
            <BuildQuote
              complex={complex}
              craft={craft}
              file={file}
              key={`${cardKey(craft)}:${complex.lcId ?? complexLabel(complex)}:${craft.mass}:${craft.partCount}`}
              named={eligible.length > 1}
              onShortfall={reportShortfall}
              slotKey={complexKey(complex)}
            />
          ))}
          <Cluster gap="related-dense" justify="start" wrap>
            {eligible.map((complex) => {
              const shortBy = shortfalls[complexKey(complex)];
              return (
                <Button
                  command={handle.with(
                    {
                      craftFile: file,
                      facility: craft.facility,
                      lcId: complex.lcId,
                    },
                    {
                      label: `Start building ${name} at ${complexLabel(complex)}`,
                    },
                  )}
                  variant="ghost"
                  aria-label={`Start building ${name} at ${complexLabel(complex)}`}
                  confirmAriaLabel={`Confirm starting ${name} at ${complexLabel(complex)}`}
                  confirmLabel="Start build"
                  unavailable={
                    shortBy === undefined
                      ? null
                      : `Short ${Math.ceil(shortBy).toLocaleString("en-US")}f`
                  }
                  key={complex.lcId ?? complexLabel(complex)}
                  size="sm"
                >{`Build at ${complex.name ?? complexLabel(complex)}`}</Button>
              );
            })}
            <Refusals complexes={complexes} />
          </Cluster>
        </Stack>
      )}
    </ProjectCard>
  );
}

/** A quote with its figures carrying their units, ready to draw. */
interface QuotedFigures {
  readonly balance: Value<"funds"> | null;
  readonly integration: Value<"s"> | null;
  readonly price: Value<"funds">;
}

/**
 * The quote's figures with their units. An Uplink's own command replies reach
 * the client without them, so the amounts arrive as bare numbers and are given
 * theirs here; a reply that already carries them passes through.
 */
function quotedFigures(
  quote: Readonly<Rp1BuildQuote> | null | undefined,
): QuotedFigures | null {
  if (quote == null) {
    return null;
  }
  return {
    balance: asFunds(quote.balance),
    integration: asSeconds(quote.integrationSeconds),
    price: asFunds(quote.price),
  };
}

function asSeconds(
  amount: Value<"s"> | number | null | undefined,
): Value<"s"> | null {
  if (amount === null || amount === undefined) {
    return null;
  }
  return typeof amount === "number" ? value("s", amount) : amount;
}

function asFunds(amount: Value<"funds"> | number): Value<"funds">;
function asFunds(
  amount: Value<"funds"> | number | null | undefined,
): Value<"funds"> | null;
function asFunds(
  amount: Value<"funds"> | number | null | undefined,
): Value<"funds"> | null {
  if (amount === null || amount === undefined) {
    return null;
  }
  return typeof amount === "number" ? value("funds", amount) : amount;
}

/**
 * What RP-1 will charge to start this craft at one complex, and how long
 * integration would take there, as two label and value lines above the buttons.
 * Useful for showing the operator what each complex costs and how long it takes
 * before either build button is pressed. Used by the cards of the Vehicle
 * Assembly start a build section.
 *
 * <para>The price is RP-1's own, asked once when the card is drawn and again
 * only when the craft's measured figures change, because a quote loads the
 * craft's parts in the game. Nothing is drawn until it arrives, and when RP-1
 * will not quote the price is drawn as unknown. A price the quote's own balance
 * does not cover carries a short badge, and its build button is darkened with
 * the shortfall as its tip. The integration row is left out when
 * RP-1 gives no estimate. With more than one eligible complex each pair is
 * headed by the complex's name. Whether the career can afford it is left to the build button, which
 * RP-1 refuses at the press; the career's funds are drawn once, in the host
 * widget's body.</para>
 */
function BuildQuote({
  complex,
  craft,
  file,
  named,
  onShortfall,
  slotKey,
}: Readonly<{
  complex: Rp1BuildableComplex;
  craft: Rp1BuildableCraftEntry;
  file: string;
  named: boolean;
  /** Told how far the price is over the balance, or null when it is not or either is unknown. */
  onShortfall: (key: string, shortBy: number | null) => void;
  slotKey: string;
}>) {
  const quote = useCommand(RP1_BUILD_QUOTE_COMMAND, {
    rail: false,
    vantage: "meta",
  });
  const send = useRef(quote.dangerouslySendWithoutInput);
  send.current = quote.dangerouslySendWithoutInput;
  const [answer, setAnswer] = useState<QuotedFigures | "unquoted" | null>(null);
  const facility = craft.facility;
  const lcId = complex.lcId;
  const complexName = complex.name ?? complexLabel(complex);

  useEffect(() => {
    let live = true;
    send
      .current({
        craftFile: file,
        facility: facility ?? undefined,
        lcId: lcId ?? undefined,
      })
      .then((reply) => {
        if (live) {
          setAnswer(quotedFigures(reply.payload) ?? "unquoted");
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
  }, [file, facility, lcId]);

  const balance =
    answer === null || answer === "unquoted"
      ? null
      : magnitudeOf(answer.balance);
  const price =
    answer === null || answer === "unquoted" ? null : magnitudeOf(answer.price);
  const short = balance !== null && price !== null && price > balance;
  const shortBy = short ? price - balance : null;

  useEffect(() => {
    onShortfall(slotKey, shortBy);
    return () => onShortfall(slotKey, null);
  }, [onShortfall, slotKey, shortBy]);

  if (answer === null) {
    return null;
  }

  return (
    <Stack gap="related-dense">
      {named ? (
        <Text size="xs" level="muted">
          {complexName}
        </Text>
      ) : null}
      <DataLine label="Price">
        {answer === "unquoted" ? (
          NULL_DISPLAY
        ) : (
          <>
            <Unit value={answer.price} decimals={0} />
            {short && (
              <>
                {" "}
                <Badge tone="caution">SHORT</Badge>
              </>
            )}
          </>
        )}
      </DataLine>
      {answer === "unquoted" || answer.integration === null ? null : (
        <DataLine label="Integration">
          <Countdown value={answer.integration} />
        </DataLine>
      )}
    </Stack>
  );
}

/** The key one complex's button and quote share within a card. */
function complexKey(complex: Rp1BuildableComplex): string {
  return complex.lcId ?? complexLabel(complex);
}

/**
 * Every complex that refused this craft, as a dead button whose tip carries
 * its reason.
 *
 * <para>Drawn even when another complex would take it, because "LC-1 is too
 * small for this" is what tells an operator which complex to modify, and a list
 * of only the yeses leaves them pressing the one button they have without
 * learning why there is one.</para>
 *
 * <para>A complex with no reasons at all is skipped: it said yes and already
 * has a live button beside these.</para>
 */
function Refusals({
  complexes,
}: Readonly<{ complexes: readonly Rp1BuildableComplex[] }>) {
  const refused = complexes.filter(
    (complex) => (complex.refusals ?? []).length > 0,
  );
  return (
    <>
      {refused.map((complex) => (
        <Button
          disabled
          disabledReason={(complex.refusals ?? []).join("; ")}
          key={complex.lcId ?? complexLabel(complex)}
          size="sm"
        >
          {`Build at ${complex.name ?? complexLabel(complex)}`}
        </Button>
      ))}
    </>
  );
}

/**
 * One dead button per complex, each carrying the same reason in its tip, for a
 * craft that nothing can build. A centre with no complexes gets a single one.
 */
function DeadButtons({
  complexes,
  reason,
}: Readonly<{
  complexes: readonly Rp1BuildableComplex[];
  reason: string;
}>) {
  if (complexes.length === 0) {
    return (
      <Button disabled disabledReason={reason} size="sm">
        Build
      </Button>
    );
  }
  return (
    <>
      {complexes.map((complex) => (
        <Button
          disabled
          disabledReason={reason}
          key={complex.lcId ?? complexLabel(complex)}
          size="sm"
        >
          {`Build at ${complex.name ?? complexLabel(complex)}`}
        </Button>
      ))}
    </>
  );
}

/**
 * Why the craft's parts stop it being built anywhere, or null when they do not.
 *
 * <para>Three separate causes with three different remedies, and each is named
 * rather than collapsed into "cannot be built": a part this install does not
 * have needs the mod installing, a part whose tech is not researched needs the
 * research queue, and a part researched but not bought needs money spent at
 * R&amp;D. The last is the one that would otherwise surprise: RP-1's own window
 * offers to spend it for you through a popup, and a command dispatched from
 * another machine has nobody to answer that.</para>
 */
function partRefusal(craft: Rp1BuildableCraftEntry): string | null {
  const missing = craft.missingParts ?? [];
  if (missing.length > 0) {
    return `this install does not have ${missing.join(", ")}`;
  }
  const locked = craft.lockedParts ?? [];
  if (locked.length > 0) {
    return `not researched yet: ${locked.join(", ")}`;
  }
  const unpurchased = craft.unpurchasedParts ?? [];
  if (unpurchased.length > 0) {
    return `researched but not bought, unlock at R&D first: ${unpurchased.join(", ")}`;
  }
  return null;
}

/**
 * The complex, named the way the key line at the top of the widget names it, so
 * a refusal can be matched to a card without joining another channel. Two space
 * centres may each have an LC-1, which is why the centre is here at all.
 */
function complexLabel(complex: Rp1BuildableComplex): string {
  const name = complex.name ?? complex.lcId ?? "an unnamed complex";
  const centre = complex.kscDisplayName ?? complex.kscName;
  return centre === undefined ? name : `${name} at ${centre}`;
}

/**
 * Which editor drew the craft, from KSP's own ordinal. Named rather than
 * numbered, and a dash for an ordinal nobody sent: the facility is what decides
 * whether the craft belongs at a launch complex or the hangar, so a substituted
 * default would be a claim about where it can be built.
 */
function editorOf(craft: Rp1BuildableCraftEntry): string {
  if (craft.facility === 1) {
    return "VAB";
  }
  if (craft.facility === 2) {
    return "SPH";
  }
  return NULL_DISPLAY;
}

/**
 * A stable row key. The file name addresses a craft within one editor's folder
 * and the VAB and SPH may each hold one of the same name, so the editor is part
 * of the key for the same reason it is part of the command's arguments.
 */
function cardKey(craft: Rp1BuildableCraftEntry): string {
  return `${craft.facility ?? "?"}:${craft.craftFile ?? craft.shipName ?? "?"}`;
}

registerAugment({
  id: "rp1-vehicle-assembly-buildable",
  augments: VEHICLE_ASSEMBLY_SECTIONS,
  component: BuildableSection,
  // LAST, after what is built and what is being built. An operator opens this
  // widget to see the work in flight; starting new work is the thing they do
  // once they have, and a list of every saved craft above the queue would bury
  // it.
  priority: 20,
  owner: RP1,
});
