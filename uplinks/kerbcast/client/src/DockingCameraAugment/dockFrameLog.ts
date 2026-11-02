import type { DisplayedFrameUt } from "@ksp-gonogo/kerbcast";
import { anchorPoint } from "@ksp-gonogo/kerbcast";

/** The localStorage key that turns the log on, set to "1"; the page's own address can carry `?dockFrameLog=1` instead. */
export const DOCK_FRAME_LOG_SWITCH = "gonogo.dev.dockFrameLog";

/** Entries kept in the page, about 16 minutes of 60 frames a second. */
export const DOCK_FRAME_LOG_CAPACITY = 60_000;

/** What the Rendezvous widget handed the marks at the moment a frame was shown. */
export interface DockMarkInputs {
  ax: number | undefined;
  ay: number | undefined;
  aligned: boolean;
  docked: boolean;
}

/** One displayed video frame: when it was shown, the source frame it came from, and where each anchor landed in it. */
export interface DockFrameLogEntry {
  wallMs: number;
  presentedAt: number;
  ut: number;
  rtpTimestamp: number | null;
  frameWidth: number | null;
  frameHeight: number | null;
  fov: number | null;
  anchors: Array<{
    id: string;
    owner: string | null;
    inFrame: boolean;
    behind: boolean;
    occluded: boolean | null;
    x: number | null;
    y: number | null;
    apparentRadiusPx: number | null;
  }>;
  inputs: DockMarkInputs | null;
}

interface LogHost {
  __dockFrameLog?: DockFrameLogEntry[];
  __dockFrameLogJsonl?: () => string;
  __dockFrameLogSave?: () => void;
}

/** Whether the developer switch is set, by localStorage or the page's address; false wherever either cannot be read. */
export function dockFrameLogEnabled(): boolean {
  try {
    if (globalThis.localStorage?.getItem(DOCK_FRAME_LOG_SWITCH) === "1") {
      return true;
    }
    return new URLSearchParams(globalThis.location?.search ?? "").has(
      "dockFrameLog",
    );
  } catch {
    return false;
  }
}

/** The entry for one displayed frame. */
export function dockFrameEntry(
  frame: DisplayedFrameUt,
  inputs: DockMarkInputs | null,
  wallMs: number,
): DockFrameLogEntry {
  return {
    wallMs,
    presentedAt: frame.presentedAt,
    ut: frame.ut,
    rtpTimestamp: frame.rtpTimestamp,
    frameWidth: frame.frameWidth ?? null,
    frameHeight: frame.frameHeight ?? null,
    fov: frame.fov ?? null,
    anchors: (frame.anchors ?? []).map((a) => {
      const point = anchorPoint(a);
      return {
        id: a.id,
        owner: a.owner ?? null,
        inFrame: a.inFrame,
        behind: a.behind === true,
        occluded: a.occluded ?? null,
        x: point?.x ?? null,
        y: point?.y ?? null,
        apparentRadiusPx: a.apparentRadiusPx ?? null,
      };
    }),
    inputs,
  };
}

/**
 * Appends one displayed frame to the page's `window.__dockFrameLog`, dropping
 * the oldest past {@link DOCK_FRAME_LOG_CAPACITY}, and installs
 * `window.__dockFrameLogJsonl()` (the log as one JSON object a line) and
 * `window.__dockFrameLogSave()` (the same as a downloaded
 * `dock-frame-log-<time>.jsonl`). A development aid for finding how often the
 * marks' positions change against the video; called only while
 * {@link dockFrameLogEnabled} is true.
 */
export function logDockFrame(
  frame: DisplayedFrameUt,
  inputs: DockMarkInputs | null,
  host: LogHost = globalThis as unknown as LogHost,
  wallMs: number = Date.now(),
): void {
  const log = host.__dockFrameLog ?? [];
  host.__dockFrameLog = log;
  log.push(dockFrameEntry(frame, inputs, wallMs));
  if (log.length > DOCK_FRAME_LOG_CAPACITY) {
    log.splice(0, log.length - DOCK_FRAME_LOG_CAPACITY);
  }
  host.__dockFrameLogJsonl ??= () =>
    (host.__dockFrameLog ?? []).map((e) => JSON.stringify(e)).join("\n");
  host.__dockFrameLogSave ??= () => {
    const blob = new Blob([host.__dockFrameLogJsonl?.() ?? ""], {
      type: "application/x-ndjson",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `dock-frame-log-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
}
