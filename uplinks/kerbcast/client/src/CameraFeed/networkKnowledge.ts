import { type Value, value } from "@ksp-gonogo/sitrep-sdk";
import { writeQuantity } from "@ksp-gonogo/ui-kit";

/** How a command centre knows the craft a ground camera is aimed at. */
export type NetworkKind = "heard" | "seen" | "modelled" | "held" | "blackout";

export interface NetworkKnowledge {
  kind: NetworkKind;
  /** Seconds of game time since the centre last knew the craft; null for a craft heard or seen now. */
  ageSeconds: number | null;
}

/** The words the readout shows for each way of knowing. */
export const NETWORK_LABELS: Readonly<Record<NetworkKind, string>> = {
  heard: "HEARD",
  seen: "SEEN",
  modelled: "MODELLED",
  held: "HELD",
  blackout: "BLACKOUT",
};

/**
 * The entry of `kerbcast.craftKnowledge` for the craft a camera is aimed at, in
 * the knowledge of the camera's own command centre. Useful for reading how the
 * centre knows the camera's subject, whichever craft that is. Used by the camera
 * feed widget.
 *
 * Both halves of the key are the camera's own: the centre it stands at and the
 * subject it is aimed at, so a camera watching a craft other than the active one
 * reads that craft's knowledge. `undefined` when the camera has no subject, the
 * centre does not know it, or the entries are not yet known.
 */
export function feedKnowledgeEntry<
  Entry extends { centre?: string | null; craftId?: number | null },
>(
  entries: readonly Entry[] | undefined,
  centre: string | undefined,
  subjectPersistentId: number | undefined,
): Entry | undefined {
  if (!entries || !centre || !subjectPersistentId) return undefined;
  return entries.find(
    (e) => e.centre === centre && e.craftId === subjectPersistentId,
  );
}

/**
 * How the camera's own command centre knows the craft the camera is aimed at,
 * from that centre's entry for the craft on `kerbcast.craftKnowledge`. Useful
 * for telling the operator whether the craft a ground camera is aimed at is
 * where its centre last heard it, where a model carries it, or no longer heard
 * at all. Used by the camera feed widget for the network corner of a ground
 * camera's brackets.
 *
 * `connected` false (no route from the viewing centre to the camera's centre)
 * reads as blackout whatever the entry says. `inLens` says the camera itself has
 * the craft in view, which reads a heard craft as seen. `undefined` when the
 * centre has no entry for the craft.
 */
export function networkKnowledge(
  entry:
    | {
        knowledge?: string | null;
        lastKnownUt?: Value<"ut"> | null;
      }
    | undefined,
  connected: boolean | undefined,
  nowUt: number | undefined,
  inLens: boolean,
): NetworkKnowledge | undefined {
  if (!entry) return undefined;
  const lastKnown = entry.lastKnownUt?.magnitude;
  const age =
    lastKnown === undefined || nowUt === undefined
      ? null
      : Math.max(0, nowUt - lastKnown);

  if (connected === false) return { kind: "blackout", ageSeconds: age };
  switch (entry.knowledge) {
    case "heard":
      return { kind: inLens ? "seen" : "heard", ageSeconds: null };
    case "seen":
      return { kind: "seen", ageSeconds: null };
    case "modelled":
      return { kind: "modelled", ageSeconds: age };
    case "held":
      return { kind: "held", ageSeconds: age };
    default:
      return undefined;
  }
}

/** An age in the kit's own wording for a duration: `12s`, `4min 12s` or `1h 3min`. */
export function formatAge(seconds: number): string {
  return writeQuantity(value("s", Math.max(0, Math.floor(seconds))));
}

/** The network half of the readout: `HEARD`, or `MODELLED 4min 12s`. */
export function networkReadout(k: NetworkKnowledge): string {
  const label = NETWORK_LABELS[k.kind];
  return k.kind === "heard" || k.kind === "seen" || k.ageSeconds === null
    ? label
    : `${label} ${formatAge(k.ageSeconds)}`;
}
