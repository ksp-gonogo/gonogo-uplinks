import {
  registerAugment,
  useCommand,
  useTelemetry,
  useViewUt,
  value,
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  Button,
  Cluster,
  Countdown,
  magnitudeOf,
  MissionDate,
  MissionDateField,
  NULL_DISPLAY,
  Row,
  RowName,
  Section,
  SectionTitle,
  Stack,
  Text,
  Tooltip,
  Unit,
} from "@ksp-gonogo/ui-kit";
import { useState } from "react";
import type {
  PrincipiaPlan,
  PrincipiaPlanWriteReceipt,
} from "../__generated__/contract.js";
import { useAttemptId } from "../attemptId.js";
import { commandWindow } from "../commandWindow.js";
import { composedBurn, type PlanDraft, usePlanDrafts } from "../planDrafts.js";
import { planView, slotNumber } from "../planReading.js";
import type { PrincipiaPlanWriteHandle } from "../planWrite.js";
import {
  nothingWasWritten,
  planWriteReceipt,
  planWriteRefusalLine,
} from "../planWrite.js";
import { PRINCIPIA } from "../uplink.js";
import "../topics";

/**
 * Principia's ten-plan cap, reproduced because the wire carries the count and
 * not the ceiling.
 *
 * <p>An eleventh plan makes Principia's own planner window throw on every layout
 * pass, for as long as the window is open, with the button that would delete it
 * inside the part that stopped drawing. So the count is worth showing against
 * the limit rather than on its own, and a console that let an operator walk up
 * to it blind would be handing them that state.</p>
 */
const MAX_FLIGHT_PLANS = 10;

const FROZEN_REASON =
  "The plan is not armed, the vessel is out of contact or Principia is optimising";

/**
 * How far past the round trip a newly created plan is asked to end, and the
 * value Principia's own planner asks for when the operator gives it nothing.
 */
const DEFAULT_PLAN_LENGTH_SECONDS = 3600;

/**
 * The plan slot itself: whether this craft has a flight plan, which of its ten
 * it is, and the four writes that change that answer.
 *
 * <p><b>Why one section rather than four controls.</b> Create, install, copy and
 * delete are not four independent verbs, they are the transitions of one state
 * machine over two fields of the reading. `planExists` decides whether create or
 * delete is the legal one and the plugin refuses the other by name
 * (`PlanAlreadyExists`, `NoFlightPlan`); `planCount` against Principia's ten
 * decides whether a copy can be made at all. A surface offering all four at once
 * would be a surface that refuses most of its own controls a signal delay after
 * they are pressed, which is the thing `writeSurface` exists on the wire to
 * prevent.</p>
 *
 * <p><b>Why installing a composed plan belongs here and not in the composer.</b>
 * A plan arrives on a craft one of three ways: empty, copied, or composed
 * elsewhere and transmitted whole. All three are the same transition, and the
 * mod says so: `principia.plan.send` creates the slot when the craft holds none,
 * rather than refusing and making the operator send a create first from a light
 * time away. So install and create differ only in whether there are burns in the
 * box, and they share the one field neither the composer nor the burn editor
 * holds: where the plan is asked to end. The composer's own upload is a
 * different destination entirely, stock manoeuvre nodes, and that is why it
 * stays where it is rather than growing a second button.</p>
 *
 * <p><b>There is one plan-end field on this panel and it is not always this
 * one.</b> A plan that exists already has an end, and the control that moves it
 * belongs beside the shortfall it remedies, which is `PlanIntegrationBlock`. So
 * the field here appears only for a craft with no plan, and once there is one its
 * own end is the end every write reads. Two fields under one name on one panel is
 * two answers to the same question.</p>
 *
 * <p>The burns themselves are edited in `BurnEditor` below, which works inside
 * whichever slot this names. Nothing here reads or writes a burn.</p>
 */
export function PlanSlots() {
  const view = planView(useTelemetry("principia.plan"));
  const viewUt = useViewUt();

  const createCmd = useCommand("principia.plan.create");
  const duplicateCmd = useCommand("principia.plan.duplicate");
  const deleteCmd = useCommand("principia.plan.delete");
  const sendCmd = useCommand("principia.plan.send");

  const { drafts } = usePlanDrafts();
  /**
   * The end instant the next create or install will ask for, once the operator
   * has moved it. Null until then, so the seeded value below tracks the view
   * clock instead of freezing at whatever it was on the first render.
   */
  const [endDraft, setEndDraft] = useState<number | null>(null);
  const [lastWrite, setLastWrite] = useState<PrincipiaPlanWriteReceipt | null>(
    null,
  );
  const createAttempt = useAttemptId("create");

  if (view.kind === "none") {
    return (
      <Section data-plan-slots="">
        <SectionTitle>PLAN SLOTS</SectionTitle>
        <Stack role="status" aria-live="polite">
          <Cluster justify="start">
            <Badge tone="caution">NO PLAN READING</Badge>
          </Cluster>
          <Text level="faint" size="sm">
            {view.reason}
          </Text>
        </Stack>
      </Section>
    );
  }

  const { plan, outOfContact } = view;
  const surface = plan.writeSurface;
  const armed = surface?.armed === true;
  const planExists = plan.planExists === true;
  const planAbsent = plan.planExists === false;
  const vesselId = plan.vesselId ?? undefined;
  const burns = plan.burns ?? [];
  const planCount = magnitudeOf(plan.planCount);
  const slotsFull = planCount !== null && planCount >= MAX_FLIGHT_PLANS;

  // The four handles carry the same vantage, so one answers for all four.
  const oneWaySeconds = createCmd.effectiveDelaySeconds;
  /*
   * Two one-way light times past the view instant: the reading on screen is
   * already one behind, and the write spends a second in flight. Through the
   * algebra rather than on bare numbers, because it is an instant plus an
   * interval and the units say which is which.
   */
  /*
   * A null one-way (no measurable path home, or no reading at all) leaves no
   * round trip to add, the same call `seededIgnitionUt` makes and for the same
   * reason: this seeds where a plan WOULD land, and a light time nobody knows
   * cannot be added to it.
   */
  const roundTrip = oneWaySeconds === null ? 0 : 2 * Math.max(oneWaySeconds, 0);
  const arrival =
    viewUt === undefined ? null : viewUt.plus(value("s", roundTrip));
  const arrivalUt = magnitudeOf(arrival);
  const seededEndUt = magnitudeOf(
    arrival?.plus(value("s", DEFAULT_PLAN_LENGTH_SECONDS)),
  );
  const viewUtNumber = magnitudeOf(viewUt);
  /*
   * ONE instant, and which control owns it depends on whether there is a plan.
   * A plan that exists already HAS an end, and the control that moves it sits
   * beside the shortfall it remedies (`PlanIntegrationBlock`); a second field
   * here would be a second answer to the same question, on the same panel, under
   * the same name. So the field below appears only where the plan does not, and
   * once it does the plan's own end is the end.
   */
  const endUt = planExists
    ? magnitudeOf(plan.desiredFinalTimeUt)
    : (endDraft ?? seededEndUt);

  /*
   * Frozen for the same three reasons every write on this Uplink is: the surface
   * is not armed, the reading the slot count came off is held, or Principia is
   * mid-optimisation and would revert the write without reporting it.
   */
  const frozen =
    !armed || outOfContact !== null || plan.optimisationRunning === true;

  const installable = drafts.filter(
    (draft) => draft.vesselId === vesselId && draft.saved === true,
  );

  return (
    <Section data-plan-slots="">
      <SectionTitle>PLAN SLOTS</SectionTitle>
      <Stack>
        <Cluster wrap justify="start" gap="related-dense">
          {/* Which slot, out of how many. Every number the sections below show
              belongs to whichever this names, and an operator reading a plan
              they are not flying is the failure mode ten parallel plans
              creates.

              Only where there IS one, because the producer's "none selected" is
              minus one and a badge reading "PLAN 0 OF 0" beside the badge that
              says there is no plan is a second, worse way of saying so. */}
          {planExists ? (
            <Badge tone="info">
              {`PLAN ${slotNumber(plan.selectedPlan)} OF ${
                planCount ?? NULL_DISPLAY
              }`}
            </Badge>
          ) : planAbsent ? (
            <Badge tone="caution">NO PLAN ON THIS VESSEL</Badge>
          ) : (
            <Badge tone="caution">PLAN NOT READ</Badge>
          )}
          {slotsFull && (
            <Badge tone="warn">{`SLOTS FULL AT ${MAX_FLIGHT_PLANS}`}</Badge>
          )}
          {plan.optimisationRunning === true && (
            <Badge tone="warn">OPTIMISING</Badge>
          )}
          {/* The mod's own sentence, not one composed here: it names the guard
              that is standing in the way, and for a craft with no plan it says
              which write is the one available. */}
          <Tooltip text={surface?.reason} focusable>
            {armed ? (
              <Badge tone="go">ARMED</Badge>
            ) : (
              <Badge tone="caution">NOT ARMED</Badge>
            )}
          </Tooltip>
          {outOfContact !== null && (
            <Tooltip text={outOfContact} focusable>
              <Badge tone="warn">OUT OF CONTACT</Badge>
            </Tooltip>
          )}
        </Cluster>

        <Stack gap="caption">
          {/* The slot's extent. `initialTimeUt` is where Principia began
              integrating this plan and appears nowhere else on the board; the
              length below it is the same pair read as a duration, which is the
              form an operator judges a horizon in. An instant and an interval
              are different quantities and are rendered as such. */}
          <Row as="div">
            <RowName>PLAN STARTS</RowName>
            {plan.initialTimeUt == null ? (
              <Text>{NULL_DISPLAY}</Text>
            ) : (
              <MissionDate value={plan.initialTimeUt} />
            )}
          </Row>
          <Row as="div">
            <RowName>PLAN RUNS FOR</RowName>
            {plan.initialTimeUt == null || plan.desiredFinalTimeUt == null ? (
              <Text>{NULL_DISPLAY}</Text>
            ) : (
              <Countdown
                value={plan.desiredFinalTimeUt.minus(plan.initialTimeUt)}
              />
            )}
          </Row>
          <Row as="div">
            <RowName>BURNS</RowName>
            {plan.burns == null ? (
              <Text>{NULL_DISPLAY}</Text>
            ) : (
              <Unit value={value("count", burns.length)} decimals={0} />
            )}
          </Row>
        </Stack>

        {planExists ? (
          <ExistingPlan
            plan={plan}
            vesselId={vesselId}
            frozen={frozen}
            slotsFull={slotsFull}
            planCount={planCount}
            burnCount={burns.length}
            nextIgnitionUt={nextIgnitionUt(plan)}
            viewUt={viewUtNumber}
            oneWaySeconds={oneWaySeconds}
            duplicateCmd={duplicateCmd}
            deleteCmd={deleteCmd}
            onWrite={setLastWrite}
          />
        ) : null}

        {/* Where a plan that does not exist yet would end. Above both writes
            that state one rather than inside either, because it is the one field
            create and install share and a second copy could disagree with the
            first. */}
        {planAbsent && (
          <Stack gap="caption">
            <SectionTitle>NEW PLAN ENDS AT</SectionTitle>
            {endUt === null ? (
              <Row as="div">
                <RowName>NEW PLAN END</RowName>
                <Text>{NULL_DISPLAY}</Text>
              </Row>
            ) : (
              <>
                <MissionDateField
                  label="New plan end"
                  value={endUt}
                  disabled={frozen}
                  onChange={setEndDraft}
                />
                <Row as="div">
                  <RowName>LENGTH FROM ARRIVAL</RowName>
                  {arrivalUt === null ? (
                    <Text>{NULL_DISPLAY}</Text>
                  ) : (
                    <Countdown value={value("s", endUt - arrivalUt)} />
                  )}
                </Row>
                {arrivalUt !== null && endUt <= arrivalUt && (
                  <Cluster justify="start">
                    <Tooltip
                      text="This end instant has already passed by the time the write arrives. Move it later."
                      focusable
                    >
                      <Badge tone="warn">END BEFORE ARRIVAL</Badge>
                    </Tooltip>
                  </Cluster>
                )}
              </>
            )}
            <Cluster gap="related-dense" wrap justify="start">
              <Button
                command={createCmd.with(
                  {
                    vesselId,
                    requestId: `${createAttempt.requestId}-${vesselId ?? "none"}-${endUt ?? "none"}`,
                    finalTimeUt: endUt ?? undefined,
                  },
                  {
                    label: "Create a flight plan",
                    onConfirmed: (result) => {
                      createAttempt.settle();
                      setLastWrite(planWriteReceipt(result));
                    },
                  },
                )}
                variant="ghost"
                size="sm"
                tone="go"
                confirmLabel="CONFIRM CREATE"
                confirmTone="nogo"
                unavailable={
                  frozen
                    ? FROZEN_REASON
                    : endUt === null
                      ? "The end of the flight plan is not stated"
                      : arrivalUt !== null && endUt <= arrivalUt
                        ? "The plan would end before the vessel arrives"
                        : null
                }
                aria-label="Create a flight plan for this vessel"
                confirmAriaLabel="Confirm creating a flight plan for this vessel"
              >
                CREATE EMPTY PLAN
              </Button>
            </Cluster>
          </Stack>
        )}

        <InstallDrafts
          drafts={installable}
          plan={plan}
          vesselId={vesselId}
          endUt={endUt}
          arrivalUt={arrivalUt}
          viewUt={viewUtNumber}
          oneWaySeconds={oneWaySeconds}
          frozen={frozen}
          burnCount={burns.length}
          sendCmd={sendCmd}
          onWrite={setLastWrite}
        />

        {/* A confirmed dispatch is not always a write, and the RECEIPT is what
            says so: the mod answers a repeated request id with the one it stored
            the first time and never touches the plugin, and a receipt can report
            an outcome that is not `Written` whatever the envelope around it
            said. The control's own success state sees neither, because both
            resolve. Live-regioned because it is the outcome of something the
            operator just pressed and it contradicts what the button beside it is
            showing. */}
        {nothingWasWritten(lastWrite) && (
          <Stack gap="caption" role="status" aria-live="polite">
            <Cluster justify="start">
              <Badge tone="warn">NOTHING WAS WRITTEN</Badge>
            </Cluster>
            {lastWrite.replayed === true ? (
              <Cluster justify="start">
                <Tooltip
                  text="The mod answered a request it had already seen with the earlier receipt and wrote nothing."
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

        {/* The values above came off a reading, and every write below is
            bounded against the slot count that reading carried. */}
        <Row as="div">
          <RowName>SLOT READ AT</RowName>
          {plan.sampledAtUt == null ? (
            <Text>{NULL_DISPLAY}</Text>
          ) : (
            <MissionDate value={plan.sampledAtUt} />
          )}
        </Row>
      </Stack>
    </Section>
  );
}

/**
 * The two writes that only exist once a plan does: copy it, or throw it away.
 *
 * <p>Split out because their preconditions are the negation of create's, and a
 * component holding both sets would spend most of its body deciding which half
 * of itself to render.</p>
 */
function ExistingPlan({
  plan,
  vesselId,
  frozen,
  slotsFull,
  planCount,
  burnCount,
  nextIgnitionUt,
  viewUt,
  oneWaySeconds,
  duplicateCmd,
  deleteCmd,
  onWrite,
}: Readonly<{
  plan: PrincipiaPlan;
  vesselId: string | undefined;
  frozen: boolean;
  slotsFull: boolean;
  planCount: number | null;
  burnCount: number;
  /** The next burn still ahead of the reading, when the plan names one. */
  nextIgnitionUt: number | null;
  viewUt: number | null;
  /** Null when there is no measurable one, which is not a zero: see the sdk handle's `effectiveDelaySeconds`. */
  oneWaySeconds: number | null;
  duplicateCmd: PrincipiaPlanWriteHandle;
  deleteCmd: PrincipiaPlanWriteHandle;
  onWrite: (receipt: PrincipiaPlanWriteReceipt | null) => void;
}>) {
  const duplicateAttempt = useAttemptId(
    `duplicate-${vesselId ?? "none"}-${planCount ?? "unread"}`,
  );
  const deleteAttempt = useAttemptId(`delete-${vesselId ?? "none"}`);
  const executing = (plan.burns ?? []).some((burn) => burn.executing === true);
  /*
   * A burn nobody could say was idle, which is the third state of the same
   * flag. The badge below warns before a slot delete discards the burns with
   * it, and it is REPORTED rather than enforced, so the warning is the whole of
   * what the operator gets: an unreadable execution state used to arrive as a
   * false and take the warning with it.
   */
  const executionUnread = (plan.burns ?? []).some(
    (burn) => burn.executing == null,
  );
  /*
   * Deleting a plan has nothing to beat in the way an edit to a burn does: the
   * write is legal at any instant. What it CAN do is arrive after a burn the
   * operator meant to stop has already lit, and at a distant vantage the row
   * saying so is still an hour from telling them. So the window is measured
   * against the next ignition and reported, not enforced.
   */
  const nextBurnWindow = commandWindow(nextIgnitionUt, viewUt, oneWaySeconds);

  return (
    <Stack gap="caption" data-plan-slots-existing="">
      <Cluster gap="related-dense" wrap justify="start">
        <Button
          command={duplicateCmd.with(
            {
              vesselId,
              requestId: duplicateAttempt.requestId,
            },
            {
              label: "Copy this flight plan into a new slot",
              onConfirmed: (result) => {
                duplicateAttempt.settle();
                onWrite(planWriteReceipt(result));
              },
            },
          )}
          variant="ghost"
          size="sm"
          confirmLabel="CONFIRM COPY"
          confirmTone="nogo"
          unavailable={
            frozen
              ? FROZEN_REASON
              : slotsFull
                ? "Every flight plan slot is in use"
                : planCount === null
                  ? "The number of flight plans is not known"
                  : null
          }
          aria-label="Copy this flight plan into a new slot"
          confirmAriaLabel="Confirm copying this flight plan into a new slot"
        >
          COPY TO A NEW SLOT
        </Button>
        <Button
          command={deleteCmd.with(
            { vesselId, requestId: deleteAttempt.requestId },
            {
              label: "Delete this flight plan",
              onConfirmed: (result) => {
                deleteAttempt.settle();
                onWrite(planWriteReceipt(result));
              },
            },
          )}
          variant="ghost"
          size="sm"
          confirmLabel="CONFIRM DELETE"
          confirmTone="nogo"
          unavailable={frozen ? FROZEN_REASON : null}
          tip={
            burnCount > 0
              ? "Discards this slot's burns with it. Copy the slot first to keep them."
              : undefined
          }
          aria-label="Delete this flight plan"
          confirmAriaLabel="Confirm deleting this flight plan"
        >
          DELETE PLAN
        </Button>
      </Cluster>

      {executing && (
        <Cluster justify="start">
          <Badge tone="nogo">A BURN IS RUNNING</Badge>
        </Cluster>
      )}

      {/* Only when nothing in the slot is KNOWN to be running, so the two never
          stack: a definite running burn is the stronger fact and says all of
          this already. */}
      {!executing && executionUnread && (
        <Cluster justify="start">
          <Badge tone="caution">A BURN HERE MAY BE RUNNING, UNREAD</Badge>
        </Cluster>
      )}

      {nextBurnWindow?.shut === true && (
        <Row as="div">
          <Tooltip
            text="The next burn lights before a write sent now reaches Principia, so it flies whatever this slot holds."
            focusable
          >
            <Badge tone="warn">WRITE WINDOW SHUT AT</Badge>
          </Tooltip>
          <MissionDate value={value("ut", nextBurnWindow.deadlineUt)} />
        </Row>
      )}
    </Stack>
  );
}

/**
 * The screen's saved plans, and what installing one on this craft would do.
 *
 * <p>Only saved drafts. A draft still being composed is a command-centre object
 * the operator has not finished with, and offering to transmit one is offering
 * to fly a half-typed trajectory.</p>
 *
 * <p><b>Every fact that would refuse the install is rendered from the draft
 * itself.</b> A plan whose first burn cannot be reached before it lights is
 * refused whole by the mod on arrival, and an end instant at or before the last
 * ignition is a plan that would not reach its own last manoeuvre.</p>
 */
function InstallDrafts({
  drafts,
  plan,
  vesselId,
  endUt,
  arrivalUt,
  viewUt,
  oneWaySeconds,
  frozen,
  burnCount,
  sendCmd,
  onWrite,
}: Readonly<{
  drafts: readonly PlanDraft[];
  plan: PrincipiaPlan;
  vesselId: string | undefined;
  endUt: number | null;
  arrivalUt: number | null;
  viewUt: number | null;
  /** Null when there is no measurable one, which is not a zero: see the sdk handle's `effectiveDelaySeconds`. */
  oneWaySeconds: number | null;
  frozen: boolean;
  burnCount: number;
  sendCmd: PrincipiaPlanWriteHandle;
  onWrite: (receipt: PrincipiaPlanWriteReceipt | null) => void;
}>) {
  return (
    <Stack gap="caption" data-plan-slots-install="">
      <SectionTitle>INSTALL A COMPOSED PLAN</SectionTitle>
      {drafts.length === 0 ? (
        <Row as="div">
          <RowName>SAVED PLANS</RowName>
          <Unit value={value("count", 0)} decimals={0} />
        </Row>
      ) : null}
      {drafts.map((draft, index) => (
        <InstallRow
          key={draft.id}
          draft={draft}
          ordinal={index + 1}
          plan={plan}
          vesselId={vesselId}
          endUt={endUt}
          arrivalUt={arrivalUt}
          viewUt={viewUt}
          oneWaySeconds={oneWaySeconds}
          frozen={frozen}
          burnCount={burnCount}
          sendCmd={sendCmd}
          onWrite={onWrite}
        />
      ))}
    </Stack>
  );
}

function InstallRow({
  draft,
  ordinal,
  plan,
  vesselId,
  endUt,
  arrivalUt,
  viewUt,
  oneWaySeconds,
  frozen,
  burnCount,
  sendCmd,
  onWrite,
}: Readonly<{
  draft: PlanDraft;
  ordinal: number;
  plan: PrincipiaPlan;
  vesselId: string | undefined;
  endUt: number | null;
  arrivalUt: number | null;
  viewUt: number | null;
  /** Null when there is no measurable one, which is not a zero: see the sdk handle's `effectiveDelaySeconds`. */
  oneWaySeconds: number | null;
  frozen: boolean;
  burnCount: number;
  sendCmd: PrincipiaPlanWriteHandle;
  onWrite: (receipt: PrincipiaPlanWriteReceipt | null) => void;
}>) {
  const sendAttempt = useAttemptId(`send-${draft.id}@${draft.revision}`);
  const first = draft.burns[0];
  const window = commandWindow(
    magnitudeOf(first?.ignitionUt),
    viewUt,
    oneWaySeconds,
  );
  const lastIgnitionUt = magnitudeOf(
    draft.burns[draft.burns.length - 1]?.ignitionUt,
  );
  /*
   * The draft's own end wins where it states one: the operator who composed the
   * plan said how far it runs, and the field above is the slot's default for
   * every plan that did not. Nothing writes it today, which is why the default
   * is the reachable one rather than the exception.
   */
  const planEndUt = draft.desiredFinalTimeUt ?? endUt;
  const endsBeforeLastBurn =
    planEndUt !== null &&
    lastIgnitionUt !== null &&
    planEndUt <= lastIgnitionUt;
  /*
   * An arm is not a burn verdict, and `SendPlan` gates on the verdict only when
   * the slot ALREADY HOLDS BURNS: a plan sent to a craft holding none builds its
   * head burn, which is its own demonstration of the struct. `armed` true beside
   * an unverified burn struct is a state the mod reaches and publishes, so the
   * two halves of that gate are both read here rather than one of them.
   */
  const burnStructUnusable =
    burnCount > 0 && plan.writeSurface?.burnLayoutVerified !== true;
  /*
   * The first reason that applies, in the order the gate reads them. It is the
   * disabled button's tip: a reason printed beside a control nobody can press
   * is a sentence the panel carries for ever.
   */
  const blockedReason = frozen
    ? "Flight-plan writes are held"
    : burnStructUnusable
      ? "Principia's burn layout is unverified, and this slot holds burns to copy from"
      : planEndUt === null
        ? "The plan has no end instant"
        : endsBeforeLastBurn
          ? "The plan end is at or before the plan's last ignition"
          : window?.shut === true
            ? "The first burn lights before this plan could reach the craft"
            : arrivalUt !== null && planEndUt <= arrivalUt
              ? "The plan end is before the plan could arrive"
              : null;
  const installTip =
    burnCount > 0 && plan.planExists === true
      ? "Replaces the burns this slot holds now, whole"
      : undefined;

  return (
    <Stack gap="caption">
      <Row as="div">
        <RowName>{`SAVED PLAN ${ordinal}`}</RowName>
        <Cluster justify="end" gap="related-dense">
          <Unit value={value("count", draft.burns.length)} decimals={0} />
          {first ? <MissionDate value={first.ignitionUt} /> : null}
        </Cluster>
      </Row>

      <Button
        command={sendCmd.with(
          {
            vesselId,
            /*
             * The attempt owns the id and the draft's content is part of it: the
             * mod answers a request id it has already written under from its
             * receipt without looking at the plan that came with it, so a
             * corrected plan must not go out under the id of its earlier version.
             * `revision` counts the content and the end instant is stated here
             * rather than in the draft, so it joins the key.
             */
            requestId: `${sendAttempt.requestId}-${planEndUt ?? "none"}`,
            composedAtViewUt: viewUt ?? undefined,
            observedAtUt: magnitudeOf(draft.observedAt) ?? undefined,
            desiredFinalTimeUt: planEndUt ?? undefined,
            burns: draft.burns.map(composedBurn),
          },
          {
            label: "Install this plan as Principia's flight plan",
            onConfirmed: (result) => {
              sendAttempt.settle();
              onWrite(planWriteReceipt(result));
            },
          },
        )}
        variant="ghost"
        size="sm"
        tone="go"
        confirmLabel="CONFIRM INSTALL"
        confirmTone="nogo"
        unavailable={blockedReason}
        tip={installTip}
        aria-label="Install this plan as Principia's flight plan"
        confirmAriaLabel="Confirm installing this plan as Principia's flight plan"
      >
        INSTALL AS FLIGHT PLAN
      </Button>

      {window?.shut === true && (
        <>
          <Row as="div">
            <RowName>WINDOW SHUT AT</RowName>
            <MissionDate value={value("ut", window.deadlineUt)} />
          </Row>
          <Row as="div">
            <RowName>SHUT BEFORE IGNITION</RowName>
            <Countdown value={value("s", 2 * window.oneWaySeconds)} />
          </Row>
        </>
      )}
    </Stack>
  );
}

/**
 * The next burn still ahead of the reading, as an instant.
 *
 * <p>Off `firstFutureBurnIndex` rather than by searching the list, because that
 * index is the rule Principia's own panel applies and no two clients should have
 * to agree on it independently. Null when every burn is behind the sample, which
 * is a plan with nothing left to miss.</p>
 */
function nextIgnitionUt(plan: PrincipiaPlan): number | null {
  const index = magnitudeOf(plan.firstFutureBurnIndex);
  if (index === null) return null;
  const burn = (plan.burns ?? []).find(
    (candidate) => magnitudeOf(candidate.index) === index,
  );
  return burn === undefined ? null : magnitudeOf(burn.ignitionUt);
}

registerAugment({
  id: "principia-plan-slots",
  augments: "maneuver-planner.sections",
  component: PlanSlots,
  owner: PRINCIPIA,
});
