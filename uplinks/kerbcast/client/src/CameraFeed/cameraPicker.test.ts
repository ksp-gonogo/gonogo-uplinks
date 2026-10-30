import {
  CameraKind,
  CameraLifecycle,
  type CameraState,
} from "@ksp-gonogo/kerbcast";
import { describe, expect, it } from "vitest";
import { followedPartCameraId } from "./cameraPicker.js";

function cam(over: Partial<CameraState> & { flightId: number }): CameraState {
  return {
    cameraName: "Nav",
    vesselName: "Rover",
    kind: CameraKind.Part,
    lifecycle: CameraLifecycle.Active,
    ...over,
  } as CameraState;
}

describe("followedPartCameraId", () => {
  it("moves to the live camera of the same name once the held id is gone", () => {
    const held = cam({ flightId: 1 });
    expect(followedPartCameraId([cam({ flightId: 9 })], held)).toBe(9);
  });

  it("moves off a destroyed camera that is still listed", () => {
    const held = cam({ flightId: 1, lifecycle: CameraLifecycle.Destroyed });
    expect(
      followedPartCameraId([held, cam({ flightId: 9 })], held),
    ).toBe(9);
  });

  it("stays while the held camera is live", () => {
    const held = cam({ flightId: 1 });
    expect(followedPartCameraId([held, cam({ flightId: 9 })], held)).toBeNull();
  });

  it("prefers the same craft and ignores other names", () => {
    const held = cam({ flightId: 1 });
    const list = [
      cam({ flightId: 8, vesselName: "Other" }),
      cam({ flightId: 9 }),
      cam({ flightId: 10, cameraName: "Tail" }),
    ];
    expect(followedPartCameraId(list, held)).toBe(9);
  });

  it("leaves command cameras alone", () => {
    const held = cam({ flightId: 1, kind: CameraKind.Command });
    expect(
      followedPartCameraId([cam({ flightId: 9, kind: CameraKind.Command })], held),
    ).toBeNull();
  });
});
