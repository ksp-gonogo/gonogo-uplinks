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
import { type RowCrossing, type Summary, summarise } from "./ecosystem.js";
import { resourceBoundaryCrossings } from "./resourceReckoning.js";
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
   * Each resource's level, derived from the `vessel.resources`
   * reading. The reckoned figures come from that reading's own model and name
   * only the levels it moved, at the instant it reckoned to.
   */
  figures: Reading<LevelFigures>;
}

/** One resource's level. */
export interface LevelFigure {
  amount: number;
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
      resourcesReading.state === "held"
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
    // The one prediction there is: the model's crossing, off the last observed
    // levels. A resource it has none for is simply absent here.
    const crossings: Record<string, RowCrossing> = {};
    for (const c of resourceBoundaryCrossings(
      resources ?? null,
      lifeSupport,
      profile,
    )) {
      crossings[c.resource] = {
        boundary: c.boundary,
        atUt: c.atUt.magnitude,
      };
    }
    const figures = deriveReading(
      resourcesReading,
      (observed) => levelFigures(observed, () => true),
      (modelled) =>
        moved.size === 0
          ? undefined
          : levelFigures(modelled, (name) => moved.has(name)),
    );
    return {
      summary: summarise({
        profile,
        lifeSupport,
        stored,
        capacity,
        crew: crewCount,
        crossings,
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
  if (reading.state !== "observed" && reading.state !== "held") return moved;
  if (reading.reckoning.status !== "available") return moved;
  for (const { path } of reading.reckoning.modelled) {
    const match = /^resources\.(.+)\.current$/.exec(path);
    if (match?.[1] !== undefined) moved.add(match[1]);
  }
  return moved;
}

/** Level off one resource map, for each name `include` admits. */
function levelFigures(
  payload: Resources,
  include: (name: string) => boolean,
): LevelFigures {
  const figures: Record<string, LevelFigure> = {};
  for (const [name, amount] of Object.entries(payload.resources ?? {})) {
    if (!include(name)) continue;
    figures[name] = { amount: magnitudeOr(amount.current, 0) };
  }
  return figures;
}
