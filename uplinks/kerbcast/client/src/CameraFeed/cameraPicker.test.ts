import {
  CameraKind,
  CameraLifecycle,
  type CameraState,
} from "@ksp-gonogo/kerbcast";
import { describe, expect, it } from "vitest";
import {
  followedPartCameraId,
  hasAutoLatchableCamera,
  isAutoLatchable,
  orderCamerasForPicker,
} from "./cameraPicker.js";

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

describe("followedPartCameraId: independent of list order", () => {
  const held = cam({ flightId: 1 });

  it("takes the lowest id on the same craft whatever order the list is in", () => {
    const a = cam({ flightId: 30 });
    const b = cam({ flightId: 12 });
    expect(followedPartCameraId([a, b], held)).toBe(12);
    expect(followedPartCameraId([b, a], held)).toBe(12);
  });

  it("does not choose between cameras on other craft", () => {
    const list = [
      cam({ flightId: 8, vesselName: "Debris A" }),
      cam({ flightId: 9, vesselName: "Debris B" }),
    ];
    expect(followedPartCameraId(list, held)).toBeNull();
    expect(followedPartCameraId([...list].reverse(), held)).toBeNull();
  });

  it("takes the one camera on another craft when there is only one", () => {
    expect(
      followedPartCameraId([cam({ flightId: 8, vesselName: "Debris A" })], held),
    ).toBe(8);
  });
});

function camera(
  flightId: number,
  kind: CameraKind,
  vesselName = "Kerbal X",
): CameraState {
  return cam({ flightId, kind, vesselName });
}

describe("a command camera and the shared feed's own choice", () => {
  it("is not one the feed may choose by itself", () => {
    expect(isAutoLatchable(camera(1, CameraKind.Part))).toBe(true);
    expect(isAutoLatchable(camera(2, CameraKind.Kerbal))).toBe(true);
    expect(isAutoLatchable(camera(3, CameraKind.Command))).toBe(false);
  });

  it("is listed after the other live cameras", () => {
    const ordered = orderCamerasForPicker([
      camera(3, CameraKind.Command),
      camera(1, CameraKind.Part),
      camera(2, CameraKind.Part, "Other"),
    ]);
    expect(ordered.map((c) => c.flightId)).toEqual([1, 2, 3]);
  });

  it("leaves the feed with no camera to choose when only command cameras are live", () => {
    expect(hasAutoLatchableCamera([camera(3, CameraKind.Command)])).toBe(false);
    expect(
      hasAutoLatchableCamera([
        camera(3, CameraKind.Command),
        camera(1, CameraKind.Part),
      ]),
    ).toBe(true);
  });
});

describe("orderCamerasForPicker with the craft being flown", () => {
  const cameras = [
    cam({ flightId: 7, vesselName: "Munar Relay" }),
    cam({ flightId: 42, vesselName: "Kerbal X" }),
    cam({ flightId: 8, vesselName: "Munar Relay" }),
    cam({ flightId: 43, vesselName: "Kerbal X" }),
  ];

  it("lists the craft being flown first, then the rest in the order they appear", () => {
    const ordered = orderCamerasForPicker(cameras, new Set([42, 43]));
    expect(ordered.map((c) => c.flightId)).toEqual([42, 43, 7, 8]);
  });

  it("groups by craft in order of appearance while the flown craft's list is unheard", () => {
    const ordered = orderCamerasForPicker(cameras);
    expect(ordered.map((c) => c.flightId)).toEqual([7, 8, 42, 43]);
  });
});
