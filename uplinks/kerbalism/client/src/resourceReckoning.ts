import type {
  ModelledField,
  ReckonerAnswer,
  ReckoningDecline,
  TopicPayload,
  Value,
} from "@ksp-gonogo/sitrep-sdk";
import { value } from "@ksp-gonogo/sitrep-sdk";
import { magnitudeOf } from "@ksp-gonogo/ui-kit";
import { processesByModifier, wearRates } from "./ecosystem.js";
import { type LightChange, nextLightChange } from "./shadowHorizon.js";
import {
  KERBALISM_LIFESUPPORT_TOPIC,
  KERBALISM_PROFILE_TOPIC,
} from "./topics.js";
import { KERBALISM } from "./uplink.js";

/**
 * `vessel.resources`, carried forward at the net rate Kerbalism measured.
 *
 * ## Why this is a reckoner now, when the same model was a derived channel
 *
 * `resourceProjection.ts` argues at length that this model cannot be a
 * reckoner, and states its reason plainly: "A `ReckonerFor` is handed one
 * `TimelinePoint` and cannot see across that split." The split is real and
 * deliberate (`vessel.resources` carries amounts and capacities,
 * `kerbalism.lifesupport` carries the rates, and the latter says in terms why),
 * but a reckoner is no longer handed one point: it declares its inputs and the
 * store resolves them, so the rate arrives here as a dep. So the model belongs
 * on the Topic whose value it advances, where every existing reader of that
 * Topic gets it, rather than on a parallel Topic each widget has to know to
 * read instead.
 *
 * The Uplink owns it rather than core because core cannot: `vessel.resources`
 * publishes no rate at all (its own doc defers "flow/rates (R-2/R-5)"
 * deliberately), so the only party that can advance a level is whoever models
 * the consumption. `getReckoner` elects the sole non-core owner over core's
 * vanilla for exactly this case.
 *
 * ## Which UT it integrates from, and it is not the wire's
 *
 * `asOfUt` is the UT Kerbalism last advanced its accumulators, and for a
 * background craft it sits well behind the read time: unloaded vessels take
 * their Kerbalism turn one per physics tick, in rotation. So a payload can be
 * perfectly live on the wire and already minutes old as a model, and the
 * interval to integrate over is `reckonUt - asOfUt`, never `reckonUt` minus
 * the sample's `validAt`. `reckonUt` is the craft's present, which a current
 * reading under signal delay is a one-way trip behind.
 *
 * That is also why this model does not follow `core-reckoners`'
 * `elapsedOrDecline` and withhold itself on a live reading. That posture is
 * right for a first-order extrapolation whose only anchor is the loss of
 * contact: on a live reading it would replace a measured value with arithmetic
 * about the same instant. Here the gap being carried is the game's own
 * accumulator lag, which exists whether or not the last packet arrived on
 * time, so `Reading`'s `{state: "observed", reckoning: "available"}` arm is
 * the one this model wants and it is there for precisely this. What it declines
 * on instead is a zero interval, which is the same refusal measured against
 * the right clock.
 */

/**
 * How far a net consumable rate stays honest, in seconds, when the craft's
 * orbit shows no move between sunlight and its parent body's shadow.
 *
 * With an orbit around a body, the rate instead holds up to the next such move,
 * the moment solar charging starts or stops (see {@link nextLightChange}). That
 * layer only moves the span; the rate itself is still carried as measured, so a
 * rate that stops because another resource ran dry is not modelled.
 *
 * The span a net rate is assumed to describe the same regime. It is not an
 * arithmetic limit: the drift of a held rate under a changing draw is the
 * discrete events below, not accumulating noise. Two things inform it. A
 * `rates` entry is a NET rate over the whole vessel, so what invalidates it is
 * a discrete event: a converter switching, a crew shift, a
 * light coming on. The shortest such event with a knowable period is the
 * orbital shadow boundary, where a craft's net electric-charge rate flips sign
 * outright, and a low orbit crosses one every twenty minutes or so.
 *
 * ## Why a band does not replace it
 *
 * `resourceProjection.ts` imposes no horizon and gives a good reason: a rate
 * does not become false at a knowable moment the way a conic does past an SOI
 * change, it decays continuously, and the widening `lower`/`upper` bracket
 * beside it is what expresses that. `TopicModel.bandAt` now exists, so the
 * obvious move is to carry that bracket here and drop the constant. It is the
 * wrong move, because the two answer different questions.
 *
 * A band says how wrong the number might be. A horizon says whether the model
 * still describes the same regime. Those come apart precisely here, because
 * what invalidates a `rates` entry is not accumulating noise but a discrete
 * event: a converter switching, a crew shift, a craft crossing into shadow. At
 * a shadow boundary the net electric-charge rate flips sign, and after that the
 * model is not imprecise, it is integrating in the wrong direction. A band
 * widening symmetrically around a falling line does not contain a rising one,
 * so no interval this model could offer would cover the case the horizon is
 * for.
 *
 * Twenty minutes is roughly a low orbit, which is where that constant comes
 * from. The better version of this withdraws on evidence rather than at a
 * chosen number: window `kerbalism.lifesupport` through `depWindows` and
 * decline when the observed rate has changed sign inside the window. That is a
 * strictly better model and it is not this one.
 *
 * ## And why this model offers no band at all
 *
 * `BandKind` is `"bound" | "sigma1"` and the honest interval here is neither.
 * The bracket `resourceProjection.ts` mints spans two named scenarios (the rate
 * held for the whole interval; the rate stopped the instant contact was lost),
 * which its own doc is explicit is "not a bound on the truth", because a
 * converter switching on can put the real level outside it. It is not a sigma
 * either: the wire carries exactly one rate sample, so there is no distribution
 * to take a standard deviation of. Stamping `"bound"` on it would promise
 * containment this wire cannot support, and a fabricated band is worse than
 * none. `kerbalism.crew`'s model does band, because its rate is a fit with
 * residuals; see `crewReckoning.ts`.
 *
 * ## And why it is a ceiling on reach rather than the only reason to stop
 *
 * A level also withdraws the moment the model's own arithmetic carries it out
 * of the range the quantity can occupy, and for most tanks that comes a long
 * way first: a quarter-full tank filling at a unit a second is at its capacity
 * in three hundred seconds. See {@link resourceBoundaryCrossings}.
 */
export const RESOURCE_RATE_HORIZON_SECONDS = 1200;

type Resources = TopicPayload<"vessel.resources">;
type Orbit = TopicPayload<"vessel.orbit">;
type Bodies = TopicPayload<"system.bodies">;
type LifeSupport = TopicPayload<"kerbalism.lifesupport">;
type Profile = TopicPayload<"kerbalism.profile">;

/** Which end of `[0, capacity]` a moving level is heading for. */
export type ResourceBoundary = "floor" | "ceiling";

/**
 * The UT one level would leave the range it can occupy at, on the rate that was
 * measured.
 *
 * ## Why the model publishes this rather than clamping
 *
 * The level used to be clamped into `[0, capacity]` and the model went on
 * answering, which put a tank at zero on a craft whose last observation saw it
 * full, for as long as the horizon allowed. A clamp is not a withdrawal: it is
 * a confident positive claim, and at a readout it is indistinguishable from an
 * observation of an empty tank. The clamp was symmetric, so a positive net rate
 * did the same thing at the other end and reported a full one.
 *
 * The model stops at the crossing instead, and hands the crossed level back at
 * its last observed value. That withdrawal is honest and it is also silent,
 * which is why the moment itself is published: a consumer holding one can say
 * "empty by about UT X, modelled" where otherwise it could only show a level
 * that had quietly stopped moving.
 *
 * ## Why a UT, and why this vocabulary rather than a new one
 *
 * It is a time, and `Value<"ut">` is the spelling the reckoning vocabulary
 * already has for an absolute moment (`Reckoning.atUt` is one). A duration
 * would be the same fact measured from the frame, so it would have to be
 * recomputed every frame and would need a second anchor stated beside it to
 * mean anything at all. This one is a fact about the observation and does not
 * move as the view time does.
 *
 * It sits on its own entry point rather than on the model's answer for exactly
 * that reason: it is not a function of `reckonUt`, so a caller needs no frame to
 * ask for it, and it is still there on the frames where the model has withdrawn
 * and has no answer to hang it off.
 *
 * `boundary` names the end of the range rather than the condition, because the
 * two ends are one rule. Zero is not a special number here: a consumer renders
 * `"floor"` as empty and `"ceiling"` as full, and nothing upstream of that has
 * to know which of them a given craft is heading for.
 */
export interface ResourceBoundaryCrossing {
  readonly resource: string;
  readonly boundary: ResourceBoundary;
  readonly atUt: Value<"ut">;
}

/** A net rate that holds from `fromUt` until the next segment starts. */
interface RateSegment {
  readonly fromUt: number;
  readonly perSecond: number;
}

/** One level the rates actually move, with the boundary it is heading for. */
interface MovingLevel {
  readonly name: string;
  readonly current: number;
  readonly capacity: number;
  /** The rate over time: the measured one, then one more per process that stops. */
  readonly segments: readonly RateSegment[];
  readonly boundary: ResourceBoundary;
  /** The UT it reaches that boundary at, or infinity when it never does. */
  readonly crossesAtUt: number;
}

/** A running part's process, as the rates it adds to each resource it touches. */
interface RunningProcess {
  readonly inputs: ReadonlySet<string>;
  readonly contribution: ReadonlyMap<string, number>;
}

/**
 * The processes whose rates are part of the measured ones: running, not broken,
 * with a recipe in the profile. A process contributes capacity times its live
 * modifier product times (output - input) to each resource its recipe names,
 * the same sum the ledger shows.
 */
function runningProcesses(
  lifeSupport: LifeSupport,
  profile: Profile | undefined,
): RunningProcess[] {
  const byModifier = processesByModifier(profile);
  const out: RunningProcess[] = [];
  for (const entry of lifeSupport.processes ?? []) {
    if (entry.broken === true || entry.running !== true) continue;
    const def = entry.resource ? byModifier.get(entry.resource) : undefined;
    const capacity = magnitudeOf(entry.capacity);
    if (!def || capacity === null || capacity <= 0) continue;
    const scale = capacity * (magnitudeOf(entry.envModifier) ?? 1);
    const contribution = new Map<string, number>();
    for (const [name, rate] of Object.entries(def.outputs ?? {})) {
      contribution.set(name, (magnitudeOf(rate) ?? 0) * scale);
    }
    for (const [name, rate] of Object.entries(def.inputs ?? {})) {
      contribution.set(
        name,
        (contribution.get(name) ?? 0) - (magnitudeOf(rate) ?? 0) * scale,
      );
    }
    out.push({ inputs: new Set(Object.keys(def.inputs ?? {})), contribution });
  }
  return out;
}

function levelAt(
  current: number,
  segments: readonly RateSegment[],
  ut: number,
): number {
  let level = current;
  segments.forEach((segment, i) => {
    const end = Math.min(ut, segments[i + 1]?.fromUt ?? ut);
    if (end > segment.fromUt)
      level += segment.perSecond * (end - segment.fromUt);
  });
  return level;
}

/** The first UT a level carried along its segments reaches an end of its range, and which end. */
function firstCrossing(
  current: number,
  capacity: number,
  segments: readonly RateSegment[],
): { atUt: number; boundary: ResourceBoundary } | null {
  let level = current;
  for (let i = 0; i < segments.length; i++) {
    const { fromUt, perSecond } = segments[i];
    const duration =
      (segments[i + 1]?.fromUt ?? Number.POSITIVE_INFINITY) - fromUt;
    if (perSecond < 0 && level + perSecond * duration <= 0) {
      return { atUt: fromUt + level / -perSecond, boundary: "floor" };
    }
    if (perSecond > 0 && level + perSecond * duration >= capacity) {
      return {
        atUt: fromUt + (capacity - level) / perSecond,
        boundary: "ceiling",
      };
    }
    level += perSecond * duration;
  }
  return null;
}

/**
 * Which levels move, and when each one runs out of range.
 *
 * A rate for a resource this vessel does not carry moves nothing, and neither
 * does a measured zero: a key present with 0 is Kerbalism's real statement that
 * the resource is in balance, so the honest answer for it is the observation
 * unchanged rather than a claim that arithmetic happened. A level whose amount
 * or capacity cannot be read is dropped here as well, so the model never names
 * a path it then declines to move.
 *
 * ## A process stops when its input runs out
 *
 * The measured rates are sums over the running processes, so a level that
 * empties while it is the input of one cannot go on feeding it. At the first
 * instant such a level reaches zero, every running process that consumes it
 * stops: its contribution comes off each resource it touched and the rate of
 * each of those changes from that instant. That can empty a second level, which
 * stops further processes, and so on. A level already empty at the observation
 * is left alone, because its measured rates already show the stall.
 */
function movingLevels(
  observed: Resources,
  lifeSupport: LifeSupport,
  rates: NonNullable<LifeSupport["rates"]>,
  profile: Profile | undefined,
  asOfUt: number,
): MovingLevel[] {
  interface Tracked {
    current: number;
    capacity: number;
    segments: RateSegment[];
  }
  const tracked = new Map<string, Tracked>();
  const measured = new Map<string, number>();
  for (const name of Object.keys(rates).sort()) {
    const amount = observed.resources[name];
    const perSecond = magnitudeOf(rates[name]);
    if (!amount || perSecond === null) continue;
    const current = magnitudeOf(amount.current);
    const capacity = magnitudeOf(amount.max);
    if (current === null || capacity === null) continue;
    measured.set(name, perSecond);
    tracked.set(name, {
      current,
      capacity,
      segments: [{ fromUt: asOfUt, perSecond }],
    });
  }

  const running = runningProcesses(lifeSupport, profile);
  const alive = new Set(running);
  const rate = new Map(measured);
  while (alive.size > 0) {
    let stopsAt = Number.POSITIVE_INFINITY;
    let emptied: string | null = null;
    for (const [name, level] of tracked) {
      if (
        level.current <= 0 ||
        !running.some((p) => alive.has(p) && p.inputs.has(name))
      ) {
        continue;
      }
      const crossing = firstCrossing(
        level.current,
        level.capacity,
        level.segments,
      );
      if (crossing?.boundary === "floor" && crossing.atUt < stopsAt) {
        stopsAt = crossing.atUt;
        emptied = name;
      }
    }
    if (emptied === null) break;
    for (const process of running) {
      if (!alive.has(process) || !process.inputs.has(emptied)) continue;
      alive.delete(process);
      for (const [name, contributed] of process.contribution) {
        const level = tracked.get(name);
        if (!level) continue;
        const next = (rate.get(name) ?? 0) - contributed;
        rate.set(name, next);
        const last = level.segments[level.segments.length - 1];
        if (last.fromUt === stopsAt) {
          level.segments[level.segments.length - 1] = {
            fromUt: stopsAt,
            perSecond: next,
          };
        } else {
          level.segments.push({ fromUt: stopsAt, perSecond: next });
        }
      }
    }
  }

  const moving: MovingLevel[] = [];
  for (const [name, level] of tracked) {
    if (level.segments.every((segment) => segment.perSecond === 0)) continue;
    const crossing = firstCrossing(
      level.current,
      level.capacity,
      level.segments,
    );
    const lastRate = level.segments[level.segments.length - 1].perSecond;
    moving.push({
      name,
      current: level.current,
      capacity: level.capacity,
      segments: level.segments,
      boundary: crossing?.boundary ?? (lastRate < 0 ? "floor" : "ceiling"),
      crossesAtUt: crossing?.atUt ?? Number.POSITIVE_INFINITY,
    });
  }
  return moving;
}

/**
 * Kerbalism's measured rates plus the declared drain of each running wear
 * gauge, which its own map omits.
 *
 * A measured rate for the same name wins, so the day the mod captures the
 * pseudo-resources this stops being consulted for them without an edit here.
 */
function ratesWithWear(
  lifeSupport: LifeSupport,
  profile: Profile | undefined,
): NonNullable<LifeSupport["rates"]> | null {
  const wear = wearRates({ profile, lifeSupport });
  const names = Object.keys(wear);
  if (lifeSupport.rates == null && names.length === 0) return null;
  const merged: NonNullable<LifeSupport["rates"]> = {};
  for (const name of names) merged[name] = value("units/s", wear[name]);
  return { ...merged, ...lifeSupport.rates };
}

/**
 * When each moving level leaves the range it can occupy, for a consumer that
 * wants to say when. See {@link ResourceBoundaryCrossing}.
 *
 * Empty rather than a throw for every absence the model itself declines on: no
 * observation, no ledger, no rates, and no stamp to anchor the moment to.
 */
export function resourceBoundaryCrossings(
  observed: Resources | null,
  lifeSupport: LifeSupport | null | undefined,
  profile?: Profile,
): readonly ResourceBoundaryCrossing[] {
  if (observed == null || lifeSupport == null) return [];
  const rates = ratesWithWear(lifeSupport, profile);
  if (rates === null) return [];
  const asOfUt = magnitudeOf(lifeSupport.asOfKerbalismUt);
  if (asOfUt === null) return [];
  return movingLevels(observed, lifeSupport, rates, profile, asOfUt)
    .filter(({ crossesAtUt }) => Number.isFinite(crossesAtUt))
    .map(({ name, boundary, crossesAtUt }) => ({
      resource: name,
      boundary,
      atUt: value("ut", crossesAtUt),
    }));
}

/**
 * How long a measured net rate is carried, and the light change that ends it
 * when the craft's orbit shows one. Without one the span is
 * {@link RESOURCE_RATE_HORIZON_SECONDS}.
 */
interface RateHorizon {
  readonly seconds: number;
  readonly enters?: LightChange["enters"];
}

const FLAT_HORIZON: RateHorizon = { seconds: RESOURCE_RATE_HORIZON_SECONDS };

/**
 * The span a rate measured at `asOfUt` holds for: up to the craft's next move
 * between sunlight and its parent body's shadow, where a net charge rate
 * changes sign, and the flat span when the orbit shows no such crossing.
 */
function rateHorizon(
  orbit: Orbit | null | undefined,
  bodies: Bodies | null | undefined,
  asOfUt: number,
): RateHorizon {
  const change = nextLightChange(orbit, bodies, asOfUt);
  return change === null
    ? FLAT_HORIZON
    : { seconds: change.seconds, enters: change.enters };
}

/**
 * The interval to carry the accumulators across, or the reason not to.
 *
 * Never negative: a stamp can sit marginally ahead of the instant the frame
 * reckons to, and "carried for -0.4 s" is not a thing to model. Zero is a
 * decline rather than an identity projection, because a model that answers
 * with the observation has modelled nothing and should not claim to have.
 */
function intervalOrDecline(
  asOfUt: number,
  reckonUt: number,
  horizon: RateHorizon,
): number | ReckoningDecline {
  const elapsed = reckonUt - asOfUt;
  if (!Number.isFinite(elapsed)) {
    return {
      reason: "model-inapplicable",
      note: "reckon time is not a number",
    };
  }
  if (elapsed <= 0) {
    return {
      reason: "model-inapplicable",
      note: "no interval since Kerbalism last evaluated",
    };
  }
  if (elapsed > horizon.seconds) {
    return {
      reason: "beyond-horizon",
      input: "@kerbalism.lifesupport#rates",
      note:
        horizon.enters === undefined
          ? `rates measured ${Math.round(elapsed)} seconds ago`
          : `rates measured ${Math.round(elapsed)} seconds ago, before the craft enters ${horizon.enters}`,
    };
  }
  return elapsed;
}

/**
 * The model itself, as a pure function of the two payloads and the instant it
 * reckons to.
 *
 * Lifted out of the registration rather than written inside it so its decline
 * reasons are testable directly, without a store and a frame to read them back
 * through.
 */
export function reckonResourceLevels(
  observed: Resources | null,
  lifeSupport: LifeSupport | null | undefined,
  reckonUt: number,
  profile?: Profile,
  orbit?: Orbit | null,
  bodies?: Bodies | null,
): ReckonerAnswer<Resources> {
  if (observed == null) {
    return {
      declined: {
        reason: "model-inapplicable",
        note: "no resource levels observed",
      },
    };
  }
  /*
   * The dep resolving to NOTHING is the store's decline, raised before this
   * runs. What reaches here is a tombstone: Kerbalism confirmed absent, or no
   * vessel. A confirmed absence of the rate is still an absent input, and the
   * contract's own spelling of it is what an operator wants read back.
   */
  if (lifeSupport == null) {
    return {
      declined: {
        reason: "input-absent",
        input: "@kerbalism.lifesupport",
        note: "no Kerbalism rates for this craft",
      },
    };
  }
  const rates = ratesWithWear(lifeSupport, profile);
  if (rates === null) {
    return {
      declined: {
        reason: "input-absent",
        input: "@kerbalism.lifesupport#rates",
      },
    };
  }
  const asOfUt = magnitudeOf(lifeSupport.asOfKerbalismUt);
  if (asOfUt === null) {
    return {
      declined: {
        reason: "input-absent",
        input: "@kerbalism.lifesupport#asOfUt",
        note: "Kerbalism evaluation time unreadable",
      },
    };
  }
  const elapsed = intervalOrDecline(
    asOfUt,
    reckonUt,
    rateHorizon(orbit, bodies, asOfUt),
  );
  if (typeof elapsed !== "number") return { declined: elapsed };

  // Which levels actually move, settled BEFORE the model is offered.
  const rated = movingLevels(observed, lifeSupport, rates, profile, asOfUt);
  if (rated.length === 0) {
    return {
      declined: {
        reason: "model-inapplicable",
        note: "no resource aboard is changing",
      },
    };
  }

  /*
   * And which of those the model still holds for. A tank cannot hold less than
   * nothing or more than its capacity, so a rate that would carry a level past
   * either end is a rate that has demonstrably stopped holding by then, whether
   * or not the horizon has been reached. That is the same refusal
   * `beyond-horizon` already names, against the same input, measured on this
   * level rather than on the clock: reaching for a second reason code would
   * imply a consumer should treat the two differently, and it should not.
   */
  const moving = rated.filter((level) => reckonUt < level.crossesAtUt);
  if (moving.length === 0) {
    const last = rated.reduce((a, b) =>
      a.crossesAtUt >= b.crossesAtUt ? a : b,
    );
    return {
      declined: {
        reason: "beyond-horizon",
        input: "@kerbalism.lifesupport#rates",
        note: `${last.name} ${last.boundary === "floor" ? "empty" : "full"} at UT ${Math.round(last.crossesAtUt)}`,
      },
    };
  }

  const modelled: readonly ModelledField[] = [
    { path: "", basis: "rate-integration" },
    ...moving.map(({ name }) => ({
      path: `resources.${name}.current`,
      basis: "rate-integration" as const,
    })),
  ];

  return {
    modelled,
    reckon: (at) => {
      /*
       * Spread first, overwrite second: every sibling this model does not move
       * (the capacity, the presence flag, `meta`, every resource with no rate,
       * and every level that has left its range) travels verbatim, which is
       * what `Reckoning.modelled` promises about the paths it does not name.
       */
      const resources: Resources["resources"] = { ...observed.resources };
      for (const { name, current, segments, crossesAtUt } of moving) {
        /*
         * The filter above settles COVERAGE, for the instant the frame reckons
         * to. This settles the VALUE, for whatever time the caller asks at, so
         * a pull at some other `at` cannot get a level out of its range either.
         */
        if (at >= crossesAtUt) continue;
        resources[name] = {
          ...observed.resources[name],
          current: value("units", levelAt(current, segments, at)),
        };
      }
      return { ...observed, resources };
    },
  };
}

function readingValue<T>(reading: { state: string; value?: T }): T | undefined {
  return reading.state === "observed" || reading.state === "held"
    ? reading.value
    : undefined;
}

KERBALISM.registerReckoner("vessel.resources", {
  deps: [
    KERBALISM_LIFESUPPORT_TOPIC,
    { reading: KERBALISM_PROFILE_TOPIC },
    { reading: "vessel.orbit" },
    { reading: "system.bodies" },
  ],
  reckon: (point, [lifeSupportPoint, profile, orbit, bodies], { reckonUt }) =>
    reckonResourceLevels(
      point.payload,
      lifeSupportPoint?.payload,
      reckonUt,
      profile.state === "observed" || profile.state === "held"
        ? profile.value
        : undefined,
      readingValue(orbit),
      readingValue(bodies),
    ),
});
