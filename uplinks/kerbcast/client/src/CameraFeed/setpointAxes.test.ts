import { CameraKind, type CameraState } from "@ksp-gonogo/kerbcast";
import { describe, expect, it } from "vitest";
import { setpointAxesFor } from "./CameraFeed.js";

function camera(over: Record<string, unknown>): CameraState {
  return {
    flightId: 7,
    kind: CameraKind.Part,
    supportsPan: true,
    supportsZoom: true,
    ...over,
  } as unknown as CameraState;
}

const locked = (owner: string) => ({ commandTrack: { authority: { owner } } });

describe("setpointAxesFor", () => {
  it("offers pan and zoom on a camera that can move both, with no lock", () => {
    expect(setpointAxesFor(camera({}))).toEqual({ pan: true, zoom: true });
  });

  it("offers only what the camera can move", () => {
    expect(
      setpointAxesFor(camera({ supportsPan: false })),
    ).toEqual({ pan: false, zoom: true });
  });

  it("offers nothing while another authority holds a part camera", () => {
    expect(setpointAxesFor(camera(locked("other")))).toEqual({
      pan: false,
      zoom: false,
    });
  });

  it("offers nothing on a part camera even when the lock is this Uplink's", () => {
    expect(setpointAxesFor(camera(locked("gonogo")))).toEqual({
      pan: false,
      zoom: false,
    });
  });

  it("keeps zoom, and drops pan, on a command camera this Uplink holds", () => {
    expect(
      setpointAxesFor(camera({ kind: CameraKind.Command, ...locked("gonogo") })),
    ).toEqual({ pan: false, zoom: true });
  });

  it("offers nothing on a command camera another authority holds", () => {
    expect(
      setpointAxesFor(camera({ kind: CameraKind.Command, ...locked("other") })),
    ).toEqual({ pan: false, zoom: false });
  });

  it("offers nothing without a camera", () => {
    expect(setpointAxesFor(undefined)).toEqual({ pan: false, zoom: false });
  });
});
