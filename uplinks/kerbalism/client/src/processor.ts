import type {
  Reading,
  ReadingState,
  ResourceAmount,
  TopicPayload,
  TopicReading,
  Value,
} from "@ksp-gonogo/sitrep-sdk";
import { deriveReading, observedAt } from "@ksp-gonogo/sitrep-sdk";
import { magnitudeOr } from "@ksp-gonogo/ui-kit";
import type {
  KerbalismLifeSupport,
  KerbalismProfile,
} from "./__generated__/contract.js";
import { type Summary, summarise, timeToEmptySeconds } from "./ecosystem.js";
import { KERBALISM } from "./uplink.js";

// The single per-frame derivation the Ship Systems widget AND its panel badge
// both pull from, and the Processor primitive's
// first real Uplink consumer. `summarise` runs ONCE against the four
// Kerbalism/vessel payloads per Sitrep frame no matter how many surfaces read
// it: the widget via `useProcessor`, the badge via a contribution `deps` on the
// handle this module exports. Before this, the widget re-derived on its own and
// a badge would have derived a second time.
//
// The result also carries the raw inputs the widget re-uses to build a
// per-resource ledger on demand: `buildLedger` is per-resource (one resource
// per call), so it stays a click-time call when a row is expanded, not part of
// this frame model.
// ---------------------------------------------------------------------------

export interface ShipSystems {
  /** Row model + root-cause ordering, the whole widget body renders from this. */
  summary: Summary;
  /** Carried so the widget can `buildLedger` for an expanded row without a re-subscribe. */
  profile: KerbalismProfile | undefined;
  lifeSupport: KerbalismLifeSupport | undefined;
  crew: number;
  /**
   * How current the RESOURCE LEVELS this summary was derived from actually are.
   *
   * Its own provenance rather than a nested `Reading`, for the reason the dep
   * form's doc gives: a `Reading` is one Topic's currency, and a summary that
   * reasons across resources is not one Topic's anything.
   *
   * It exists because every figure in `summary` is a function of the levels,
   * and a time-to-empty derived from levels observed twenty minutes ago is not
   * a time-to-empty. Before this the derivation read `point.payload` and could
   * not tell, so the widget presented a last-contact projection as current with
   * nothing anywhere saying so.
   */
  levels: LevelsProvenance;
  /**
   * Each resource's level and time to empty, derived from the `vessel.resources`
   * reading. The reckoned figures come from that reading's own model and name
   * only the levels it moved, at the instant it reckoned to.
   */
  figures: Reading<LevelFigures>;
}

/** One resource's level and time to empty. */
export interface LevelFigure {
  amount: number;
  /** Null while the level is not draining. */
  secondsToEmpty: number | null;
}

/** Level figures keyed by KSP resource name. */
export type LevelFigures = Readonly<Record<string, LevelFigure>>;

type Resources = TopicPayload<"vessel.resources">;

/** Where the resource levels behind a summary came from, and when. */
export interface LevelsProvenance {
  /** The reading arm the levels arrived on. */
  state: ReadingState;
  /** UT the levels were observed at; undefined when nothing has been observed. */
  asOfUt: Value<"ut"> | undefined;
}

/**
 * `kerbalism:ship-systems`. The owner-stamped Processor handle. Import it to
 * consume the derivation, never re-declare it: a second registration under the
 * same id with a different compute throws (processors.ts).
 */
export const SHIP_SYSTEMS = KERBALISM.registerProcessor({
  id: "ship-systems",
  deps: [
    "kerbalism.profile",
    "kerbalism.lifesupport",
    // A READING, not the payload. Every figure this derivation produces is a
    // function of the resource levels, so whether those levels are current is
    // part of the answer rather than a detail a consumer can look up
    // separately. It also carries the observation's own UT.
    { reading: "vessel.resources" },
    "vessel.crew",
  ] as const,
  compute: ([profile, lifeSupport, resourcesReading, crew]): ShipSystems => {
    // `stored`/`capacity` were never Kerbalism-specific: they come off the
    // generic `vessel.resources` levels, keyed by KSP resource name.
    //
    // The LAST OBSERVED levels on every arm that has a value, never a modelled
    // figure: the summary reports what it was working from and when it was
    // observed, and the reading's own model reaches a consumer through `figures`.
    const resources =
      resourcesReading.state === "observed" ||
      resourcesReading.state === "stale"
        ? resourcesReading.value
        : undefined;
    // `observedAt` rather than a hand-written five-arm switch over the reading
    // states: the SDK carries it, and one copy cannot disagree with itself.
    const observedAtUt = observedAt(resourcesReading);
    const stored: Record<string, number> = {};
    const capacity: Record<string, number> = {};
    const levels: Record<string, ResourceAmount> = resources?.resources ?? {};
    for (const [name, amount] of Object.entries(levels)) {
      stored[name] = magnitudeOr(amount.current, 0);
      capacity[name] = magnitudeOr(amount.max, 0);
    }
    const crewCount = magnitudeOr(crew?.count, 0);
    const moved = movedLevels(resourcesReading);
    const figures = deriveReading(
      resourcesReading,
      (observed) => levelFigures(observed, lifeSupport, () => true),
      (modelled) =>
        moved.size === 0
          ? undefined
          : levelFigures(modelled, lifeSupport, (name) => moved.has(name)),
    );
    return {
      summary: summarise({
        profile,
        lifeSupport,
        stored,
        capacity,
        crew: crewCount,
      }),
      profile,
      lifeSupport,
      crew: crewCount,
      levels: {
        state: resourcesReading.state,
        asOfUt: observedAtUt,
      },
      figures,
    };
  },
});

/** The resources whose level the reading's model moved, off the paths it names. */
function movedLevels(reading: TopicReading<Resources>): ReadonlySet<string> {
  const moved = new Set<string>();
  if (reading.state !== "observed" && reading.state !== "stale") return moved;
  if (reading.reckoning.status !== "available") return moved;
  for (const { path } of reading.reckoning.modelled) {
    const match = /^resources\.(.+)\.current$/.exec(path);
    if (match?.[1] !== undefined) moved.add(match[1]);
  }
  return moved;
}

/** Level and time to empty off one resource map, for each name `include` admits. */
function levelFigures(
  payload: Resources,
  lifeSupport: KerbalismLifeSupport | undefined,
  include: (name: string) => boolean,
): LevelFigures {
  const stored: Record<string, number> = {};
  for (const [name, amount] of Object.entries(payload.resources ?? {})) {
    stored[name] = magnitudeOr(amount.current, 0);
  }
  const figures: Record<string, LevelFigure> = {};
  for (const [name, amount] of Object.entries(stored)) {
    if (!include(name)) continue;
    figures[name] = {
      amount,
      secondsToEmpty: timeToEmptySeconds(name, lifeSupport, stored),
    };
  }
  return figures;
}
