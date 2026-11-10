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

  it("follows a command camera's own flags: zoom, no pan", () => {
    expect(
      setpointAxesFor(camera({ kind: CameraKind.Command, supportsPan: false })),
    ).toEqual({ pan: false, zoom: true });
  });

  it("offers nothing on a command camera while a lock is held", () => {
    expect(
      setpointAxesFor(
        camera({ kind: CameraKind.Command, supportsPan: false, ...locked("gonogo") }),
      ),
    ).toEqual({ pan: false, zoom: false });
  });

  it("offers no zoom where the camera reports it cannot zoom", () => {
    expect(setpointAxesFor(camera({ supportsZoom: false }))).toEqual({
      pan: true,
      zoom: false,
    });
    expect(
      setpointAxesFor(
        camera({ kind: CameraKind.Command, supportsPan: false, supportsZoom: false }),
      ),
    ).toEqual({ pan: false, zoom: false });
  });

  it("offers nothing without a camera", () => {
    expect(setpointAxesFor(undefined)).toEqual({ pan: false, zoom: false });
  });
});
