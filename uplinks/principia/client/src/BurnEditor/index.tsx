import {
  registerAugment,
  useCommand,
  useTelemetry,
  useViewUt,
  value,
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  BinormalIcon,
  Button,
  Cluster,
  Countdown,
  FieldLabel,
  FrenetNormalIcon,
  Input,
  magnitudeOf,
  MissionDate,
  MissionDateField,
  NULL_DISPLAY,
  Row,
  RowName,
  Section,
  SectionTitle,
  SelectableRow,
  Stack,
  TangentIcon,
  Text,
  ToggleButton,
  Tooltip,
  Unit,
} from "@ksp-gonogo/ui-kit";
import type { ComponentProps } from "react";
import { useState } from "react";
import type {
  PrincipiaPlan,
  PrincipiaPlannedBurn,
  PrincipiaPlanWriteReceipt,
} from "../__generated__/contract.js";
import { PrincipiaBurnProfile } from "../__generated__/contract.js";
import { useAttemptId } from "../attemptId.js";
import { commandWindow } from "../commandWindow.js";
import { IgnitionTime } from "../IgnitionTime.js";
import { untilIgnition } from "../ignitionCountdown.js";
import { planView, slotNumber } from "../planReading.js";
import {
  nothingWasWritten,
  planWriteReceipt,
  planWriteRefusalLine,
} from "../planWrite.js";
import { plottingFrameLabel } from "../plottingFrame.js";
import { PRINCIPIA } from "../uplink.js";
import "../topics";

/**
 * When an edit to a burn stops being able to reach it: `commandWindow`, whose
 * doc carries the reasoning. Measured against the draft's ignition rather than
 * the burn's, because the draft's is the instant that gets written.
 */
const editWindow = commandWindow;

/**
 * What the operator has changed but not yet sent.
 *
 * The three components and the ignition instant are nullable, which is the split
 * the wire makes. The mod withholds the whole Dv triple when any one of the three
 * is not a finite number, because that is what Principia's own singular-manoeuvre
 * state reads as; a null here is that absence carried through rather than
 * flattened, and the boxes stay empty until the operator states one.
 *
 * The instant is the same absence and used to be flattened onto zero, which the
 * date field then drew as Year 1 Day 1: the row above it said the ignition could
 * not be read and the form under it stated a date, and the one the operator
 * believed was the form.
 */
/** Which burn, in which plan, a draft was opened on. */
interface DraftOrigin {
  vesselId: string | null;
  selectedPlan: number | null;
  ignitionUt: number | null;
}

interface Draft {
  origin: DraftOrigin;
  burnIndex: number;
  ignitionUt: number | null;
  tangent: number | null;
  normal: number | null;
  binormal: number | null;
  inertiallyFixed: boolean;
  instantImpulse: boolean;
}

function draftOf(burn: PrincipiaPlannedBurn, plan: PrincipiaPlan): Draft {
  return {
    origin: {
      vesselId: plan.vesselId ?? null,
      selectedPlan: magnitudeOf(plan.selectedPlan),
      ignitionUt: magnitudeOf(burn.ignitionUt),
    },
    burnIndex: magnitudeOf(burn.index) ?? 0,
    ignitionUt: magnitudeOf(burn.ignitionUt),
    tangent: magnitudeOf(burn.deltaVTangent),
    normal: magnitudeOf(burn.deltaVNormal),
    binormal: magnitudeOf(burn.deltaVBinormal),
    inertiallyFixed: burn.inertiallyFixed === true,
    instantImpulse: false,
  };
}

function draftStillFits(draft: Draft, plan: PrincipiaPlan): boolean {
  const burn = (plan.burns ?? []).find(
    (candidate) => magnitudeOf(candidate.index) === draft.burnIndex,
  );
  return (
    burn !== undefined &&
    (plan.vesselId ?? null) === draft.origin.vesselId &&
    magnitudeOf(plan.selectedPlan) === draft.origin.selectedPlan &&
    magnitudeOf(burn.ignitionUt) === draft.origin.ignitionUt
  );
}

/**
 * The triple, when the operator has one to send.
 *
 * Both writes send all three, and an edit that omits a component leaves the
 * plugin's own in place, so a partial triple is the one thing neither control may
 * dispatch: the mod refuses it on arrival a signal delay later, and the burn it
 * would have been refused over is one whose Dv nobody could read in the first
 * place.
 */
function statedTriple(
  draft: Draft,
): { tangent: number; normal: number; binormal: number } | null {
  const { tangent, normal, binormal } = draft;
  if (tangent === null || normal === null || binormal === null) return null;
  return { tangent, normal, binormal };
}

/**
 * The Dv triple, one axis per row.
 *
 * <para>The producer's own axis names are kept, with one exception: its tangent
 * is stock's prograde and saying so costs nothing. Normal and binormal are not
 * glossed, because the Frenet normal is the in-plane one and stock's normal is
 * the out-of-plane one, so translating them would be a physics error wearing a
 * friendlier label. Getting the vocabulary right and the axis wrong is the
 * inversion worth avoiding.</para>
 */
function DeltaVRow({
  id,
  icon: Icon,
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  id: string;
  /**
   * The navball glyph for this axis. Decorative on purpose: it carries no
   * `label`, so it is hidden from assistive technology and the row is announced
   * once, by the text beside it, rather than twice.
   */
  icon: typeof TangentIcon;
  label: string;
  hint?: string;
  /**
   * Null when the mod could not read this component. The box goes empty rather
   * than to a zero: an empty number field says nothing, and a zero says the burn
   * has no delta-v on this axis. It stays typeable, because stating all three is
   * the one edit that mends a burn whose triple went singular.
   */
  value: number | null;
  disabled: boolean;
  onChange: (next: number | null) => void;
}) {
  return (
    <Cluster gap="related-dense" justify="start">
      <FieldLabel htmlFor={id}>
        <Icon size={14} />
        {label}
        {hint ? ` / ${hint}` : ""}
      </FieldLabel>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step={0.1}
        style={{ width: "8rem" }}
        disabled={disabled}
        value={value === null ? "" : value}
        onChange={(event) => {
          // An emptied box is UNSTATED, not zero. `Number("")` is 0 and finite,
          // so clearing the field used to state a component the operator had
          // just withdrawn, and the write sent it.
          if (event.target.value === "") {
            onChange(null);
            return;
          }
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
      {/* The bare symbol beside the box, through `<Unit>` rather than as text,
          so it is styled and announced as a word like every other unit on the
          board. */}
      <Unit>m/s</Unit>
    </Cluster>
  );
}

/**
 * One line of the planned profile.
 *
 * `<Unit>` renders it, always: the value arrives from the wire carrying its own
 * unit, and a hand-written suffix beside a number is how a kilonewton ends up
 * labelled as a tonne.
 */
function ProfileRow({
  name,
  value,
  decimals,
}: {
  name: string;
  // Whatever `<Unit>` accepts, so a field that changes unit on the wire keeps
  // type-checking here instead of needing this signature widened by hand.
  value: ComponentProps<typeof Unit>["value"];
  decimals: number;
}) {
  return (
    <Row as="div">
      <RowName>{name}</RowName>
      {value == null ? (
        <Text>{NULL_DISPLAY}</Text>
      ) : (
        <Unit value={value} decimals={decimals} />
      )}
    </Row>
  );
}

/**
 * The magnitude of a triple, so the row of three has a headline, or null when a
 * component is unstated. A hypotenuse over two components and a substituted zero
 * is smaller than the burn and reads as a measurement of it.
 */
export function deltaVMagnitude(draft: Draft): number | null {
  const stated = statedTriple(draft);
  if (stated === null) return null;
  return Math.sqrt(
    stated.tangent * stated.tangent +
      stated.normal * stated.normal +
      stated.binormal * stated.binormal,
  );
}

/**
 * The tuning loop: pick a burn, nudge its instant and its Dv, watch what the
 * plan does about it.
 *
 * <para><b>Why the console has to offer this at all.</b> Principia's flight plan
 * is the mod's actual new mechanic, and it is a mechanic because it is tuned: a
 * transfer is found by moving one burn a few minutes and a few metres per second
 * at a time and reading what happens to two periapses. A console that mirrors
 * the plan and cannot change it turns the operator back to the game window for
 * the only part of the plan that is interactive.</para>
 *
 * <para><b>What is deliberately not here.</b> The resulting arc. Seeing the
 * curve before committing to the real burn wants an integrated trajectory, and
 * the only thing that can draw one is the propagation seam, which currently has
 * no production implementer. The instant-impulse profile is here, because it is
 * a property of the burn rather than of the drawing, and Principia will draw its
 * arc in the game's own map.</para>
 *
 * <para>Every control is disabled until the write surface says it is armed, and
 * the reason it is not travels with the plan rather than being discovered by
 * trying. Which plan slot those burns belong to, and whether there is a slot at
 * all, is `PlanSlots` above: this section edits the burns inside whichever plan
 * that names.</para>
 */
export function BurnEditor() {
  const planReading = useTelemetry("principia.plan");
  const view = planView(planReading);
  const receivedUt = useViewUt();
  const viewUt = magnitudeOf(receivedUt);

  const armCmd = useCommand("principia.plan.arm");
  const replaceCmd = useCommand("principia.plan.burn.replace");
  const insertCmd = useCommand("principia.plan.burn.insert");
  const removeCmd = useCommand("principia.plan.burn.remove");

  const [openDraft, setDraft] = useState<Draft | null>(null);
  /*
   * A draft is a copy of one burn, found again by its index in every new
   * reading. When the vessel, the plan slot or the burn at that index is no
   * longer the one it was opened on, the index names a different burn and the
   * form would send its old values to it, so the draft is dropped.
   */
  const draft =
    openDraft !== null &&
    view.kind === "plan" &&
    !draftStillFits(openDraft, view.plan)
      ? null
      : openDraft;
  const [lastWrite, setLastWrite] = useState<PrincipiaPlanWriteReceipt | null>(
    null,
  );
  /*
   * The arm's receipt is kept apart from the burn edits' because the two are
   * read in different places: the burn banner lives inside the form, which is
   * only on screen once a burn is selected, and an arm is the press an operator
   * makes BEFORE there is one.
   */
  const [lastArm, setLastArm] = useState<PrincipiaPlanWriteReceipt | null>(
    null,
  );
  const draftContent =
    draft === null
      ? "none"
      : `${draft.burnIndex}-${draft.ignitionUt}-${draft.tangent}-${draft.normal}-${draft.binormal}-${draft.inertiallyFixed}-${draft.instantImpulse}`;
  const armAttempt = useAttemptId("arm");
  const replaceAttempt = useAttemptId(`replace-${draftContent}`);
  const insertAttempt = useAttemptId(`insert-${draftContent}`);
  const removeAttempt = useAttemptId(`remove-${draft?.burnIndex ?? "none"}`);

  if (view.kind === "none") {
    return (
      <Section data-burn-editor="">
        <SectionTitle>BURN EDITOR</SectionTitle>
        <Stack role="status" aria-live="polite">
          <Cluster justify="start">
            <Tooltip text={view.reason} focusable>
              <Badge tone="caution">NO PLAN READING</Badge>
            </Tooltip>
          </Cluster>
        </Stack>
      </Section>
    );
  }

  const { plan, outOfContact } = view;
  const surface = plan.writeSurface;
  const armed = surface?.armed === true;
  const available = surface?.available === true;
  const burns = plan.burns ?? [];
  const vesselId = plan.vesselId ?? undefined;

  // The four handles carry the same vantage, so one of them answers for all
  // four. Taken off the replace handle because APPLY is the write the deadline
  // is about.
  const oneWaySeconds = replaceCmd.effectiveDelaySeconds;
  const draftWindow = editWindow(
    draft?.ignitionUt ?? null,
    viewUt,
    oneWaySeconds,
  );

  const selected =
    draft === null
      ? undefined
      : burns.find((burn) => magnitudeOf(burn.index) === draft.burnIndex);
  /*
   * The producer's Cartesian system, the one the player enters three components
   * in. Under its three spherical ones the player enters a magnitude and two
   * angles; the components still arrive and are the burn's Dv, but an edit to
   * them is one the plugin does not read, so they are shown and not editable.
   * Compared against the ordinal the payload carries rather than mapped to a
   * name: the set is the producer's.
   */
  const CARTESIAN_TNB = 1;
  const enteredSpherical =
    selected !== undefined &&
    magnitudeOf(selected.coordinateSystem) !== CARTESIAN_TNB;
  /*
   * A burn NOT KNOWN to be idle, which is two states rather than one: it is
   * running, or its ignition and cutoff would not read and so nothing can say
   * whether it is. The mod refuses both, `BurnExecuting` for the first and
   * `GuardReadUnreadable` for the second, so offering a control here spends a
   * delay round trip to be told what the reading already carries.
   *
   * `!== false` rather than `=== true`, deliberately. A false is the only
   * positive all-clear: an absent or null flag is the mod saying it could not
   * establish the burn was idle, and the whole reason that state exists on the
   * wire is that it used to arrive as a false and hand out these controls for a
   * burn that may have been under thrust.
   */
  const notKnownIdle = selected !== undefined && selected.executing !== false;
  const frozen =
    !armed ||
    selected?.frameEditable !== true ||
    enteredSpherical ||
    notKnownIdle ||
    outOfContact !== null;
  /*
   * An arm is not a burn verdict. `PrincipiaLayoutProbe.Run` records both
   * round-trip verdicts and returns null whatever they were, and `Arm` refuses
   * only when NEITHER struct survived, so `armed` true beside this false is a
   * state the mod reaches and publishes deliberately. Every burn write is
   * refused `LayoutUnverified` in it, which is why the two that write a burn
   * struct freeze here and REMOVE, which writes none, does not.
   */
  const burnStructUnverified = surface?.burnLayoutVerified !== true;
  /*
   * A triple with a component nobody stated. The mod withholds all three when
   * any one of them is not a finite number, which is what Principia's own
   * singular-manoeuvre state reads as, and an emptied box withdraws one the same
   * way. Both writes send the whole triple, and an edit that omits a component
   * leaves the plugin's own in place, so there is nothing to send and nothing to
   * keep: the mod refuses exactly this a light time later, and refusing it here
   * costs the operator the round trip rather than the plan.
   */
  const tripleUnstated = draft !== null && statedTriple(draft) === null;
  /*
   * An ignition nobody stated, refused the same way the triple is. A burn whose
   * instant could not be read has no edit deadline either, so `tooLate` cannot
   * answer for it: every write composed here would be one whose arrival nobody
   * can time, against a burn the plugin holds and this Uplink cannot see. REMOVE
   * sends the index alone and is unaffected.
   */
  const ignitionUnstated = draft !== null && draft.ignitionUt === null;
  const draftMagnitude = draft === null ? null : deltaVMagnitude(draft);
  /*
   * The ignition field stays live inside a shut window: pushing the burn further
   * out is how the operator REOPENS one, and freezing the field would leave the
   * deadline as a dead end rather than something to act on.
   */
  const tooLate = draftWindow?.shut === true;
  /*
   * The first reason APPLY and ADD BURN are dark, as their tip. REMOVE sends
   * the index alone, so none of the reasons about stated values hold it.
   */
  const writeBlockedReason = frozen
    ? "Burn writes are held: the plan is not armed, the burn is not editable or not known to be idle, or the vessel is out of contact"
    : tooLate
      ? "The edit would reach Principia after this burn has ignited"
      : burnStructUnverified
        ? "Principia's burn layout is unverified, so APPLY and ADD BURN are refused"
        : tripleUnstated
          ? "A delta-v component is unstated. Type all three to send"
          : ignitionUnstated
            ? "The ignition instant is unstated. Type one to send"
            : null;

  return (
    <Section data-burn-editor="">
      <SectionTitle>BURN EDITOR</SectionTitle>
      <Stack>
        {/* The plan's identity first. Every number below belongs to whichever
            slot this names, and an operator reading a plan they are not flying
            is the failure mode ten parallel plans creates. */}
        <Cluster wrap justify="start" gap="related-dense">
          <Badge tone="info">
            {`PLAN ${slotNumber(plan.selectedPlan)} OF ${
              magnitudeOf(plan.planCount) ?? NULL_DISPLAY
            }`}
          </Badge>
          {plan.planExists === false && (
            <Badge tone="caution">NO PLAN ON THIS VESSEL</Badge>
          )}
          {plan.optimisationRunning === true && (
            <Badge tone="warn">OPTIMISING</Badge>
          )}
          {armed ? (
            <Badge tone="go">ARMED</Badge>
          ) : (
            <Badge tone="caution">NOT ARMED</Badge>
          )}
          {outOfContact !== null && (
            <Tooltip text={outOfContact} focusable>
              <Badge tone="warn">OUT OF CONTACT</Badge>
            </Tooltip>
          )}
        </Cluster>

        {/* Arming is a real write of Principia's own burn back into the plan, so
            it confirms rather than firing on the first press. */}
        <Stack gap="caption">
          <Cluster gap="related-dense" wrap justify="start">
            <Button
              command={armCmd.with(
                {
                  vesselId,
                  requestId: `${armAttempt.requestId}-${vesselId ?? "none"}`,
                },
                {
                  label: "Arm the flight-plan write surface",
                  onConfirmed: (result) => {
                    armAttempt.settle();
                    setLastArm(planWriteReceipt(result));
                  },
                },
              )}
              variant="ghost"
              size="sm"
              tone="go"
              confirmLabel="CONFIRM ARM"
              confirmTone="nogo"
              unavailable={
                available
                  ? null
                  : (surface?.reason ?? "The write surface is not available")
              }
              tip={surface?.reason ?? undefined}
              aria-label="Arm the flight-plan write surface"
              confirmAriaLabel="Confirm arming the flight-plan write surface"
            >
              ARM WRITES
            </Button>
          </Cluster>

          {/* An arm that was answered from the mod's own store granted nothing,
              and this is the only thing on screen that says so. The request id
              is composed from the vessel alone, so it never varies: every press
              after the first sends the id the first went under, and the mod
              answers it out of its receipt cache without touching the write
              surface. Both resolve, so the control shows the same confirmation
              either way. Live-regioned because it is the outcome of something
              the operator just pressed and it contradicts the badge above. */}
          {nothingWasWritten(lastArm) && (
            <Stack gap="caption" role="status" aria-live="polite">
              <Cluster justify="start">
                <Badge tone="warn">NOTHING WAS WRITTEN</Badge>
              </Cluster>
              {lastArm.replayed === true ? (
                <Cluster justify="start">
                  <Tooltip
                    text="The mod answered a request it had already seen with the earlier receipt and armed nothing."
                    focusable
                  >
                    <Badge tone="neutral">REPLAYED RECEIPT</Badge>
                  </Tooltip>
                </Cluster>
              ) : (
                <Text level="faint" size="sm">
                  {planWriteRefusalLine(lastArm)}
                </Text>
              )}
            </Stack>
          )}
        </Stack>

        <Stack gap="caption">
          <Text level="faint" size="sm">
            {`PLAN ENDS ${plan.desiredFinalTimeUt == null ? NULL_DISPLAY : ""}`}
            {plan.desiredFinalTimeUt != null && (
              <MissionDate value={plan.desiredFinalTimeUt} />
            )}
          </Text>
          {(plan.burns == null || burns.length === 0) && (
            <Row as="div">
              <RowName>BURNS</RowName>
              {plan.burns == null ? (
                <Text>{NULL_DISPLAY}</Text>
              ) : (
                <Unit value={value("count", 0)} decimals={0} />
              )}
            </Row>
          )}
          {burns.map((burn) => {
            const index = magnitudeOf(burn.index);
            const ignition = magnitudeOf(burn.ignitionUt);
            return (
              <SelectableRow
                key={index ?? String(burn.ignitionUt)}
                selected={draft?.burnIndex === index}
                onClick={() => setDraft(draftOf(burn, plan))}
                aria-label={`Burn ${(index ?? 0) + 1}`}
              >
                <RowName>
                  {index === null ? NULL_DISPLAY : `#${index + 1}`}
                </RowName>
                <Cluster justify="end" gap="related-dense">
                  {/* To IGNITION, never to a node. Principia anchors a burn to
                      its start and honouring that is the whole point. */}
                  <IgnitionTime
                    until={untilIgnition(planReading, index, receivedUt)}
                  />
                  {burn.deltaV == null ? (
                    <Text>{NULL_DISPLAY}</Text>
                  ) : (
                    <Unit value={burn.deltaV} decimals={1} />
                  )}
                  {/* On the row as well as in the form. An operator picks a burn
                      off this list before any form exists, and a list that
                      offers one nothing sent can still reach is what sends them
                      into a form to compose an edit that cannot land. */}
                  {editWindow(ignition, viewUt, oneWaySeconds)?.shut ===
                    true && <Badge tone="warn">TOO LATE TO EDIT</Badge>}
                  {burn.executing === true && (
                    <Badge tone="nogo">BURNING</Badge>
                  )}
                  {/* The third state, and it is not BURNING: the mod could not
                      read this burn's instants, so nothing here can say whether
                      the craft is under thrust. Claiming either way is what the
                      coerced false did. Every write against it is refused. */}
                  {burn.executing == null && (
                    <Badge tone="caution">BURN STATE UNREAD</Badge>
                  )}
                  {burn.frameEditable === false && (
                    <Badge tone="warn">FRAME LOCKED</Badge>
                  )}
                  {/* Locked is a property OF THE FRAME. This is the frame not
                      having been read at all, which is a different sentence and
                      sends the operator somewhere else. */}
                  {burn.frameEditable == null && (
                    <Badge tone="caution">FRAME UNREAD</Badge>
                  )}
                  {burn.anomalous === true && (
                    <Badge tone="warn">ANOMALOUS</Badge>
                  )}
                  {/* Flagged is a property the integrator reported. This is the
                      plan's flagged count not having been read at all, and
                      drawing nothing for it says the integrator was happy. */}
                  {burn.anomalous == null && (
                    <Badge tone="caution">ANOMALOUS UNREAD</Badge>
                  )}
                </Cluster>
              </SelectableRow>
            );
          })}
        </Stack>

        {draft !== null && selected && (
          <Stack gap="related-comfortable" data-burn-editor-form="">
            <Cluster wrap justify="start" gap="related-dense">
              <Badge tone="info">{`BURN ${draft.burnIndex + 1}`}</Badge>
              {/* The burn's own manoeuvring frame, which is routinely NOT the
                  plotting frame, and the only reliable warning that it differs
                  is on this line. Declined with the burn's OWN bodies: the kind
                  alone renders its template with the body slot still standing,
                  and two burns centred on different bodies are the same kind and
                  not the same frame. */}
              <Text level="faint" size="sm">
                {plottingFrameLabel(magnitudeOf(selected.frameType), {
                  centre: selected.centreBody,
                  primary: selected.primaryBody,
                  secondary: selected.secondaryBody,
                })}
              </Text>
              {selected.frameEditable === false && (
                <Badge tone="warn">THIS FRAME CANNOT BE WRITTEN BACK</Badge>
              )}
              {/* Not "cannot be written back", which states a property of the
                  frame. The frame extension did not read, so the whitelist
                  could not be checked against anything. The write stays refused
                  either way; what differs is what the operator is told. */}
              {selected.frameEditable == null && (
                <Badge tone="caution">THIS FRAME COULD NOT BE READ</Badge>
              )}
              {/* Said beside the burn rather than only in the frozen controls,
                  because it is the reason they are dark and it is not a reason
                  anything else on screen carries. */}
              {selected.executing == null && (
                <Badge tone="caution">
                  WHETHER THIS BURN IS RUNNING COULD NOT BE READ
                </Badge>
              )}
              {enteredSpherical && (
                <Badge tone="caution">SPHERICAL IN-GAME</Badge>
              )}
            </Cluster>

            {/* The planned profile. An integrated burn's arc depends on the
                propulsion, so a stage or engine change moves the trajectory and
                these are part of the plan rather than trivia. */}
            <Stack gap="caption">
              <ProfileRow
                name="THRUST"
                value={selected.thrustKilonewtons}
                decimals={1}
              />
              <ProfileRow
                name="MASS FLOW"
                value={selected.massFlowKilogramsPerSecond}
                decimals={2}
              />
              <ProfileRow
                name="ISP"
                value={selected.specificImpulseSeconds}
                decimals={0}
              />
              <ProfileRow
                name="MASS AT IGNITION"
                value={selected.initialMassTons}
                decimals={2}
              />
              <ProfileRow
                name="MASS AT CUTOFF"
                value={selected.finalMassTons}
                decimals={2}
              />
            </Stack>

            {/* Above the fields, not below the buttons. The deadline is what
                decides whether composing an edit at all is worth doing, so it is
                read before anything is typed. */}
            {draftWindow !== null && (
              <Stack gap="caption" data-edit-window="">
                <Cluster gap="related-dense" wrap justify="start">
                  {draftWindow.shut ? (
                    <Badge tone="warn">EDIT WINDOW SHUT</Badge>
                  ) : (
                    <Badge tone="caution">
                      EDIT WINDOW CLOSES IN{" "}
                      <Countdown value={draftWindow.remainingSeconds} />
                    </Badge>
                  )}
                </Cluster>
                <Row as="div">
                  <Tooltip
                    text={
                      draftWindow.shut
                        ? "An edit sent now reaches Principia after this burn has ignited, so the burn flies as it stands"
                        : "Past this the edit arrives after ignition and the burn flies as it stands"
                    }
                    focusable
                  >
                    <RowName>WINDOW SHUTS AT</RowName>
                  </Tooltip>
                  <MissionDate value={value("ut", draftWindow.deadlineUt)} />
                </Row>
                <Row as="div">
                  <RowName>SHUTS BEFORE IGNITION</RowName>
                  <Countdown value={2 * draftWindow.oneWaySeconds} />
                </Row>
              </Stack>
            )}

            <Stack gap="caption">
              <SectionTitle>IGNITION</SectionTitle>
              <MissionDateField
                label="Ignition"
                value={draft.ignitionUt}
                disabled={frozen}
                onChange={(ut) => setDraft({ ...draft, ignitionUt: ut })}
              />
            </Stack>

            <Stack gap="caption">
              <SectionTitle>DELTA-V</SectionTitle>
              <DeltaVRow
                id="burn-dv-tangent"
                icon={TangentIcon}
                label="TANGENT"
                hint="prograde"
                value={draft.tangent}
                disabled={frozen}
                onChange={(next) => setDraft({ ...draft, tangent: next })}
              />
              <DeltaVRow
                id="burn-dv-normal"
                icon={FrenetNormalIcon}
                label="NORMAL"
                value={draft.normal}
                disabled={frozen}
                onChange={(next) => setDraft({ ...draft, normal: next })}
              />
              <DeltaVRow
                id="burn-dv-binormal"
                icon={BinormalIcon}
                label="BINORMAL"
                value={draft.binormal}
                disabled={frozen}
                onChange={(next) => setDraft({ ...draft, binormal: next })}
              />
              <Row as="div">
                <RowName>MAGNITUDE</RowName>
                {/* Built as a VALUE and rendered by `<Unit>`, not written out
                    beside the number: the magnitude is derived here, so this is
                    the one place on the row where the unit could disagree with
                    what it is measuring. A component nobody could read leaves
                    no magnitude, and the dash says so. */}
                {draftMagnitude === null ? (
                  <Text>{NULL_DISPLAY}</Text>
                ) : (
                  <Unit value={value("m/s", draftMagnitude)} decimals={1} />
                )}
              </Row>
            </Stack>

            {/* A direction locked to the stars behaves differently from one that
                rotates with the orbit, and that difference is the whole point of
                the setting, so it is a named pair rather than a checkbox. */}
            <Cluster gap="related-dense" wrap justify="start">
              <ToggleButton
                size="sm"
                pressed={draft.inertiallyFixed}
                disabled={frozen}
                onClick={() =>
                  setDraft({
                    ...draft,
                    inertiallyFixed: !draft.inertiallyFixed,
                  })
                }
              >
                {draft.inertiallyFixed ? "INERTIALLY FIXED" : "FRAME-RELATIVE"}
              </ToggleButton>
              <ToggleButton
                size="sm"
                pressed={draft.instantImpulse}
                disabled={frozen}
                onClick={() =>
                  setDraft({ ...draft, instantImpulse: !draft.instantImpulse })
                }
              >
                INSTANT IMPULSE
              </ToggleButton>
            </Cluster>

            <Cluster gap="related-dense" wrap justify="start">
              <Button
                command={replaceCmd.with(
                  {
                    vesselId,
                    requestId: replaceAttempt.requestId,
                    burnIndex: draft.burnIndex,
                    // `undefined` rather than a zero for an instant nobody stated, the
                    // same as the components below. Both controls are held shut in
                    // that state, so this is the shape of the args rather than a
                    // write that happens.
                    ignitionUt: draft.ignitionUt ?? undefined,
                    // `undefined`, never a zero, for a component the operator has not
                    // stated: the mod leaves an omitted component at the plugin's own
                    // value, which is the only honest thing to say about one nobody
                    // could read. Both controls are held shut in that state anyway.
                    deltaVTangent: draft.tangent ?? undefined,
                    deltaVNormal: draft.normal ?? undefined,
                    deltaVBinormal: draft.binormal ?? undefined,
                    inertiallyFixed: draft.inertiallyFixed,
                    profile: draft.instantImpulse
                      ? PrincipiaBurnProfile.InstantImpulse
                      : PrincipiaBurnProfile.Unchanged,
                  },
                  {
                    label: `Apply burn ${draft.burnIndex + 1}`,
                    onConfirmed: (result) => {
                      replaceAttempt.settle();
                      setLastWrite(planWriteReceipt(result));
                    },
                  },
                )}
                variant="ghost"
                size="sm"
                tone="go"
                confirmLabel="CONFIRM APPLY"
                confirmTone="nogo"
                unavailable={writeBlockedReason}
                aria-label="Apply the edited burn"
                confirmAriaLabel="Confirm applying the edited burn"
              >
                APPLY
              </Button>
              {/*
                A burn composed in THIS form, not a copy of the one it was
                opened from. The mod does build it by copying: `EditBurn` takes
                the burn at `burnIndex` out of the plugin and applies the stated
                fields to it, because a composed struct is a bet on a layout that
                moved between Principia releases and a copied one is not. But
                that is how the write is made safe, not a choice the operator
                made, and every field this form offers is a stated field. So the
                verb is the burn, and the args are the whole draft: the same
                seven APPLY sends, through the same `PrincipiaBurnRules.Apply`,
                which branches on neither insert nor replace.

                It used to send five of the seven and say "ADD LIKE THIS", which
                left the two attitude toggles live beside a command that dropped
                them: flip one, press this, and the new burn quietly took the
                template's mode instead.
              */}
              <Button
                command={insertCmd.with(
                  {
                    vesselId,
                    /*
                     * The whole draft, as APPLY's is. A repeated id is answered
                     * out of the mod's receipt cache without a write, so an id
                     * keyed on the index and the instant alone made every press
                     * after the first at one index and instant a silent no-op.
                     */
                    requestId: insertAttempt.requestId,
                    burnIndex: draft.burnIndex,
                    // `undefined` rather than a zero for an instant nobody stated, the
                    // same as the components below. Both controls are held shut in
                    // that state, so this is the shape of the args rather than a
                    // write that happens.
                    ignitionUt: draft.ignitionUt ?? undefined,
                    // `undefined`, never a zero, for a component the operator has not
                    // stated: the mod leaves an omitted component at the plugin's own
                    // value, which is the only honest thing to say about one nobody
                    // could read. Both controls are held shut in that state anyway.
                    deltaVTangent: draft.tangent ?? undefined,
                    deltaVNormal: draft.normal ?? undefined,
                    deltaVBinormal: draft.binormal ?? undefined,
                    /*
                     * The same two fields APPLY sends, because this control copies
                     * the burn ON SCREEN and both are part of it. Insert leaves an
                     * unstated field at the TEMPLATE's value and the template is
                     * the SAVED burn, so omitting them added the draft back with
                     * the attitude and the profile it had before the operator
                     * touched either.
                     */
                    inertiallyFixed: draft.inertiallyFixed,
                    profile: draft.instantImpulse
                      ? PrincipiaBurnProfile.InstantImpulse
                      : PrincipiaBurnProfile.Unchanged,
                  },
                  {
                    label: "Add a burn",
                    onConfirmed: (result) => {
                      insertAttempt.settle();
                      setLastWrite(planWriteReceipt(result));
                    },
                  },
                )}
                variant="ghost"
                size="sm"
                confirmLabel="CONFIRM ADD"
                confirmTone="nogo"
                unavailable={writeBlockedReason}
                aria-label="Add a burn from these values"
                confirmAriaLabel="Confirm adding a burn from these values"
              >
                ADD BURN
              </Button>
              <Button
                command={removeCmd.with(
                  {
                    vesselId,
                    requestId: removeAttempt.requestId,
                    burnIndex: draft.burnIndex,
                  },
                  {
                    label: `Remove burn ${draft.burnIndex + 1}`,
                    onConfirmed: (result) => {
                      removeAttempt.settle();
                      setLastWrite(planWriteReceipt(result));
                    },
                  },
                )}
                variant="ghost"
                size="sm"
                confirmLabel="CONFIRM REMOVE"
                confirmTone="nogo"
                unavailable={
                  !armed
                    ? "The plan is not armed for writing"
                    : notKnownIdle
                      ? "This burn is not known to be idle"
                      : outOfContact !== null
                        ? "The vessel is out of contact"
                        : null
                }
                aria-label="Remove this burn from the plan"
                confirmAriaLabel="Confirm removing this burn from the plan"
              >
                REMOVE
              </Button>
            </Cluster>

            {/* A confirmed dispatch is not always a write, and the RECEIPT is
                what says so: the mod answers a repeated request id with the one
                it stored the first time without calling the plugin, and a
                receipt can report an outcome that is not `Written` whatever the
                envelope around it said. The control's own success state sees
                neither, because both resolve. Live-regioned because it is the
                outcome of something the operator just pressed, and it
                contradicts what the button beside it is showing. */}
            {nothingWasWritten(lastWrite) && (
              <Stack gap="caption" role="status" aria-live="polite">
                <Cluster justify="start">
                  <Badge tone="warn">NOTHING WAS WRITTEN</Badge>
                </Cluster>
                {lastWrite.replayed === true ? (
                  <Cluster justify="start">
                    <Tooltip
                      text="The mod answered a request it had already seen with the earlier receipt and wrote nothing. Change a value to send again."
                      focusable
                    >
                      <Badge tone="neutral">REPLAYED RECEIPT</Badge>
                    </Tooltip>
                  </Cluster>
                ) : (
                  <Text level="faint" size="sm">
                    {planWriteRefusalLine(lastWrite)}
                  </Text>
                )}
              </Stack>
            )}

            {/* The values on screen came from a reading; APPLY sends them all,
                including the ones nobody touched, so the operator is told which
                reading they are editing rather than assuming it is now. */}
            <Row as="div">
              <RowName>EDITING PLAN READ AT</RowName>
              {plan.sampledAtUt == null ? (
                <Text>{NULL_DISPLAY}</Text>
              ) : (
                <MissionDate value={plan.sampledAtUt} />
              )}
            </Row>
          </Stack>
        )}
      </Stack>
    </Section>
  );
}

registerAugment({
  id: "principia-burn-editor",
  augments: "maneuver-planner.sections",
  component: BurnEditor,
  owner: PRINCIPIA,
});
