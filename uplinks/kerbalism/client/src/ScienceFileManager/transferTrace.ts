import { railTagsForTelemetry } from "@ksp-gonogo/sitrep-sdk";

/**
 * Kerbalism's data transfer on the delay rail: a continuous, fire-and-forget
 * telemetry entry. Nothing acknowledges a drained file (the drive sends and the
 * downlink has no receipt for it), so no return leg is drawn.
 */
export const KERBALISM_TRANSFER_TAGS = railTagsForTelemetry("continuous");

/** UT seconds one amplitude sample covers. */
export const TRANSFER_STEP_SECONDS = 1;

/** Samples kept, so a long light-time still has a trace to span it. */
const HISTORY_SAMPLES = 900;

/**
 * The longest gap between two observations that is bridged by holding the
 * earlier one. A longer gap starts the trace over: nothing was observed across
 * it, and drawing it as idle or as busy would both be a claim.
 */
const MAX_BRIDGE_SECONDS = 3;

export interface TransferTrace {
  /** Rates in MB/s, newest last, one per {@link TRANSFER_STEP_SECONDS}. */
  readonly samples: readonly number[];
  /** The UT of the newest observation folded in, or null for an empty trace. */
  readonly lastUt: number | null;
}

export const EMPTY_TRANSFER_TRACE: TransferTrace = {
  samples: [],
  lastUt: null,
};

/**
 * Fold one OBSERVATION of a file's transfer into its trace.
 *
 * Fed by arrivals only: `atUt` is when the drive was read, and the trace never
 * advances on a clock. An unread rate (`null`) adds nothing, since "not
 * transmitting" is a claim about a downlink nobody read; the trace simply stops
 * where the readings do.
 */
export function foldTransferObservation(
  trace: TransferTrace,
  atUt: number,
  rateMBps: number | null,
  transmitting: boolean | null,
): TransferTrace {
  if (rateMBps === null || transmitting === null) return trace;
  if (trace.lastUt !== null && atUt <= trace.lastUt) return trace;
  const rate = transmitting ? Math.max(rateMBps, 0) : 0;

  const prior = trace.samples[trace.samples.length - 1];
  const bridged =
    trace.lastUt !== null &&
    prior !== undefined &&
    atUt - trace.lastUt <= MAX_BRIDGE_SECONDS;
  const held = bridged
    ? Array.from(
        {
          length: Math.max(
            Math.round(
              (atUt - (trace.lastUt as number)) / TRANSFER_STEP_SECONDS,
            ) - 1,
            0,
          ),
        },
        () => prior as number,
      )
    : [];
  const base = bridged ? trace.samples : [];
  const samples = [...base, ...held, rate].slice(-HISTORY_SAMPLES);
  return { samples, lastUt: atUt };
}

/** Whether the trace has anything worth putting on the rail. */
export function transferTraceVisible(trace: TransferTrace): boolean {
  return trace.samples.some((a) => a > 0);
}

/**
 * The trace as the rail's 0..1 amplitudes, scaled by the fastest rate in the
 * window so a slow downlink still reads as a trace rather than a flat line.
 */
export function transferAmplitudes(trace: TransferTrace): number[] {
  const peak = Math.max(0, ...trace.samples);
  return trace.samples.map((r) => (peak > 0 ? r / peak : 0));
}
