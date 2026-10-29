import { CameraKind } from "@ksp-gonogo/kerbcast";
import { value } from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import { type CameraLink, resolveCameraLink } from "./cameraLink.js";

const DOWN: CameraLink = {
  connected: false,
  signalStrength: value("ratio", 0),
  oneWay: null,
};

const roster = [
  { id: "ground:Kerbin: KSC", isHome: true },
  { id: "ground:Dish", isHome: false },
  { id: "ground:Island", isHome: false },
] as never;

const separation = {
  pairs: [{ from: "ground:Kerbin: KSC", to: "ground:Dish", oneWaySeconds: value("s", 0.4) }],
} as never;

const commandAt = (stationId: string) =>
  ({ kind: CameraKind.Command, commandCentre: { stationId } }) as never;

describe("resolveCameraLink", () => {
  it("leaves a part camera on the craft's link", () => {
    expect(resolveCameraLink({ kind: CameraKind.Part } as never, DOWN, roster, separation)).toBe(DOWN);
  });

  it("keeps a camera at home at full signal through a craft blackout", () => {
    const link = resolveCameraLink(commandAt("ground:Kerbin: KSC"), DOWN, roster, separation);

    expect(link.connected).toBe(true);
    expect(link.signalStrength?.magnitude).toBe(1);
    expect(link.oneWay?.magnitude).toBe(0);
  });

  it("keeps a launch pad that the roster does not list at full signal", () => {
    const link = resolveCameraLink(commandAt("ground:LaunchPad"), DOWN, roster, separation);

    expect(link.connected).toBe(true);
    expect(link.oneWay?.magnitude).toBe(0);
  });

  it("reads the routed delay from home to a listed station", () => {
    const link = resolveCameraLink(commandAt("ground:Dish"), DOWN, roster, separation);

    expect(link.connected).toBe(true);
    expect(link.oneWay?.magnitude).toBe(0.4);
  });

  it("reads no link to a listed station with no route from home", () => {
    const link = resolveCameraLink(commandAt("ground:Island"), DOWN, roster, separation);

    expect(link.connected).toBe(false);
    expect(link.signalStrength?.magnitude).toBe(0);
    expect(link.oneWay).toBeNull();
  });

  it("claims nothing until the roster names a home centre", () => {
    const link = resolveCameraLink(commandAt("ground:Dish"), DOWN, undefined, undefined);

    expect(link).toEqual({ connected: undefined, signalStrength: undefined, oneWay: undefined });
  });

  it("claims nothing for no camera", () => {
    expect(resolveCameraLink(undefined, DOWN, roster, separation)).toBe(DOWN);
  });
});
