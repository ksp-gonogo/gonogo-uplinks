import type { DisplayedFrameUt } from "@ksp-gonogo/kerbcast";
import { afterEach, describe, expect, it } from "vitest";
import {
  DOCK_FRAME_LOG_CAPACITY,
  DOCK_FRAME_LOG_SWITCH,
  dockFrameLogEnabled,
  logDockFrame,
} from "./dockFrameLog.js";

function frame(rtp: number, x: number): DisplayedFrameUt {
  return {
    flightId: 1,
    ut: 100 + rtp / 90000,
    source: "stamp",
    rtpTimestamp: rtp,
    presentedAt: rtp / 90,
    frameWidth: 1280,
    frameHeight: 720,
    fov: 60,
    anchors: [
      {
        id: "port",
        inFrame: true,
        behind: false,
        occluded: false,
        x,
        y: 360,
        apparentRadiusPx: 12,
      },
    ],
  } as unknown as DisplayedFrameUt;
}

describe("the dock frame log", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("is off unless the switch is set", () => {
    expect(dockFrameLogEnabled()).toBe(false);
    localStorage.setItem(DOCK_FRAME_LOG_SWITCH, "1");
    expect(dockFrameLogEnabled()).toBe(true);
  });

  it("records each frame's rtp timestamp and where the anchor landed", () => {
    const host: Record<string, unknown> = {};
    logDockFrame(frame(90000, 640), { ax: 1, ay: 2, aligned: false, docked: false }, host, 5);
    logDockFrame(frame(93000, 642), null, host, 6);
    const log = host.__dockFrameLog as Array<Record<string, unknown>>;
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ rtpTimestamp: 90000, wallMs: 5, frameWidth: 1280 });
    expect((log[0].anchors as Array<{ x: number }>)[0].x).toBe(640);
    expect(
      (host.__dockFrameLogJsonl as () => string)().split("\n"),
    ).toHaveLength(2);
  });

  it("keeps only the newest frames past its capacity", () => {
    const host: Record<string, unknown> = {};
    for (let i = 0; i < DOCK_FRAME_LOG_CAPACITY + 5; i++) {
      logDockFrame(frame(i, 640), null, host, i);
    }
    const log = host.__dockFrameLog as Array<{ wallMs: number }>;
    expect(log).toHaveLength(DOCK_FRAME_LOG_CAPACITY);
    expect(log[0].wallMs).toBe(5);
  });
});
