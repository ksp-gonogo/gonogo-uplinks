import { useEffect, useRef, useState } from "react";
import { kosSource } from "../dataSource/kos.js";
import type { KosData } from "../shared/kos-data-parser.js";
import { type KosFileEntry, kosEntryKind } from "./scriptListingScript.js";

/**
 * Volumes probed for the `/`-picker's live listing, the Archive (where
 * scripts are normally authored/saved) and the CPU's own local hard drive
 * (where the picker's "copy local & run" toggle lands a copy, so an
 * already-copied script shows up too). Probed independently, a CPU with
 * no local drive installed rejects `1:` but that must not sink the
 * Archive listing.
 */
const LISTED_VOLUMES = ["0:", "1:"];

/** Only these are RUNPATH-able; a directory or an unrelated file (`.txt`,
 * a `.ver` sidecar) would just error out of kOS if picked. */
const SCRIPT_FILE_RE = /\.(ks|ksm)$/i;

export interface KosScriptListingResult {
  paths: string[];
  loading: boolean;
  /**
   * Human hint for the empty state: no CPU tag, no connection, a dispatch
   * error's message, a reply whose listing could not be read, or a listing
   * that named script-shaped entries without saying which of them are files.
   * `null` only once at least one volume has returned a listing we could
   * read, even an empty one, and nothing runnable was withheld for want of a
   * kind.
   */
  hint: string | null;
}

/** Shown in place of the drives when the craft has no link to read them over. */
const NO_LINK_HINT =
  "No link to the craft: its drives can't be read until the link returns.";

const IDLE: KosScriptListingResult = { paths: [], loading: false, hint: null };

/**
 * Live drive listing for the `/`-script picker: asks the game for each of
 * `LISTED_VOLUMES`' files through `KosDataSource.listFiles`, which reads
 * the volumes directly and types nothing into the CPU's terminal, merges the file (not
 * directory) entries, and filters to `*.ks`/`*.ksm`: the only RUNPATH-able
 * kinds. This is the RPC-shaped one-shot case (per-call args,
 * request/response), which is the only kOS read pattern that still exists:
 * the centralised `kos.compute.*` feed and the `registerKosScript` registry
 * behind it were deleted with the widgets that consumed them. A directory
 * listing would not have belonged there anyway, being neither passive
 * telemetry nor a fixed no-args interval script.
 *
 * With `noLink` set, no request is sent: the drives cannot be reached without a
 * link, so the hint says so at once and the listing is read when the link
 * returns.
 *
 * Lazy + single-shot: does nothing until `enabled` is true (the terminal
 * only passes `true` once the `/`-picker is actually open and no static
 * `scriptPaths` config already supplies a list), and fetches at most once
 * per `(coreId, cpuTag)` pair, reopening the picker within the same
 * session reuses the cached result rather than re-dispatching. Degrades
 * gracefully (empty `paths` + a `hint`, never a thrown error) on a
 * tagless CPU, no telemetry stream mounted, or a dispatch/timeout error, so
 * every failure mode here is a "show a hint" path, never a crash.
 */
export function useKosScriptListing(
  coreId: number,
  cpuTag: string | null | undefined,
  enabled: boolean,
  noLink = false,
): KosScriptListingResult {
  const [result, setResult] = useState<KosScriptListingResult>(IDLE);
  // Tracks the (coreId, cpuTag) pair a fetch has already been kicked off
  // for, so re-opening the picker doesn't re-dispatch; see the doc
  // comment above. Reset (by identity) whenever coreId/cpuTag actually
  // change, via the dependency array below rather than manual comparison.
  const fetchedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const fetchKey = `${coreId}:${cpuTag ?? ""}`;
    if (noLink && fetchedForRef.current !== fetchKey) {
      setResult({ paths: [], loading: false, hint: NO_LINK_HINT });
      return;
    }
    if (fetchedForRef.current === fetchKey) return;
    fetchedForRef.current = fetchKey;

    if (!cpuTag) {
      setResult({
        paths: [],
        loading: false,
        hint: "This CPU has no tagname yet: waiting on kos.processors.",
      });
      return;
    }

    let cancelled = false;
    let settledOnce = false;
    const abort = new AbortController();
    setResult({ paths: [], loading: true, hint: null });

    Promise.allSettled(
      LISTED_VOLUMES.map((volume) =>
        kosSource.listFiles(cpuTag, volume, abort.signal).then((data) => ({ volume, data })),
      ),
    ).then((settled) => {
      if (cancelled) return;
      settledOnce = true;
      const paths: string[] = [];
      // "A volume answered with a listing we could READ", which is not the
      // same as "the RPC resolved". A reply whose listing will not parse
      // resolved perfectly well and still tells us nothing about what is on
      // the drive, so counting it as an outcome left `hint` null and the
      // picker drew "No scripts found" over an unread reply.
      let anyReadable = false;
      let dispatchProblem: string | null = null;
      let unreadableProblem: string | null = null;
      /*
       * A script-named entry whose KIND the volume did not report. Not
       * offered, because "we could not tell" is not "it is a file": a
       * directory called `lib.ks` composes a RUNPATH the CPU errors out of.
       * Counted so the empty state can say that rather than claim the drive
       * holds nothing, the same distinction `parseListing` draws one level up
       * between an unreadable reply and an empty drive.
       */
      let anyUnknownKind = false;
      for (const outcome of settled) {
        if (outcome.status === "rejected") {
          dispatchProblem =
            outcome.reason instanceof Error
              ? outcome.reason.message
              : String(outcome.reason);
          continue;
        }
        const { volume, data } = outcome.value;
        const entries = parseListing(data);
        if (entries === null) {
          unreadableProblem = `${volume} replied, but its file listing could not be read.`;
          continue;
        }
        anyReadable = true;
        for (const entry of entries) {
          if (!SCRIPT_FILE_RE.test(entry.name)) continue;
          const kind = kosEntryKind(entry);
          if (kind === "unknown") {
            anyUnknownKind = true;
            continue;
          }
          if (kind === "directory") continue;
          paths.push(`${volume}/${entry.name}`);
        }
      }
      setResult({
        paths,
        loading: false,
        /*
         * An unreadable reply is the sharper signal and is preferred over a
         * volume that simply is not there: `1:` rejecting is the ordinary case
         * for a CPU with no local drive, and it lands last.
         */
        hint: anyReadable
          ? paths.length === 0 && anyUnknownKind
            ? "The drive listed script-named entries but did not say which are files, so none can be offered to run."
            : null
          : (unreadableProblem ??
            dispatchProblem ??
            "Could not reach the CPU for a script listing."),
      });
    });

    return () => {
      cancelled = true;
      abort.abort();
      // A listing cut off before it answered is asked for again next time.
      if (!settledOnce) fetchedForRef.current = null;
    };
  }, [enabled, coreId, cpuTag, noLink]);

  return result;
}

/**
 * The entries the reply reported, or null when the reply carried no listing
 * we could read: no `listing` field, a `listing` that will not parse, or one
 * that parses to something other than an array.
 *
 * Null and `[]` are different answers and the caller renders them
 * differently. `[]` means the drive has no files on it; null means the CPU
 * said something we could not interpret, which is not evidence about the
 * drive at all. Collapsing the two into `[]` is what let the picker claim a
 * volume was empty on the strength of a reply it had failed to parse.
 */
function parseListing(data: KosData): KosFileEntry[] | null {
  const raw = data.listing;
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as KosFileEntry[]) : null;
  } catch {
    return null;
  }
}
