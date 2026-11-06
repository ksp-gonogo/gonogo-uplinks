import { CameraKind } from "@ksp-gonogo/kerbcast";
import { value } from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import { type CameraLink, resolveCameraLink } from "./cameraLink.js";

const DOWN: CameraLink = {
  connected: false,
  signalStrength: value("ratio", 0),
  oneWay: null,
};

const HOME = "ground:Kerbin: KSC";
const DISH = "ground:Dish";

const roster = [
  { id: HOME, isHome: true },
  { id: DISH, isHome: false },
  { id: "ground:Island", isHome: false },
] as never;

const separation = {
  pairs: [
    { from: HOME, to: DISH, oneWaySeconds: value("s", 0.4) },
    { from: DISH, to: HOME, oneWaySeconds: value("s", 0.4) },
  ],
} as never;

const commandAt = (stationId: string) =>
  ({ kind: CameraKind.Command, commandCentre: { stationId } }) as never;

describe("resolveCameraLink", () => {
  it("leaves a part camera on the craft's link", () => {
    expect(
      resolveCameraLink({ kind: CameraKind.Part } as never, DOWN, roster, separation, HOME),
    ).toBe(DOWN);
  });

  it("keeps a camera at the viewing centre at full signal through a craft blackout", () => {
    const link = resolveCameraLink(commandAt(HOME), DOWN, roster, separation, HOME);

    expect(link.connected).toBe(true);
    expect(link.signalStrength?.magnitude).toBe(1);
    expect(link.oneWay?.magnitude).toBe(0);
  });

  it("keeps a launch pad that the roster does not list at full signal", () => {
    const link = resolveCameraLink(commandAt("ground:LaunchPad"), DOWN, roster, separation, HOME);

    expect(link.connected).toBe(true);
    expect(link.oneWay?.magnitude).toBe(0);
  });

  it("reads the routed delay from the viewing centre to a listed station", () => {
    const link = resolveCameraLink(commandAt(DISH), DOWN, roster, separation, HOME);

    expect(link.connected).toBe(true);
    expect(link.oneWay?.magnitude).toBe(0.4);
  });

  it("reads the delay from a viewing centre that is not home", () => {
    const link = resolveCameraLink(commandAt(HOME), DOWN, roster, separation, DISH);

    expect(link.oneWay?.magnitude).toBe(0.4);
  });

  it("reads a camera at the viewing centre as live even when that is not home", () => {
    const link = resolveCameraLink(commandAt(DISH), DOWN, roster, separation, DISH);

    expect(link.oneWay?.magnitude).toBe(0);
  });

  it("reads no link to a listed station with no route from the viewing centre", () => {
    const link = resolveCameraLink(commandAt("ground:Island"), DOWN, roster, separation, HOME);

    expect(link.connected).toBe(false);
    expect(link.signalStrength?.magnitude).toBe(0);
    expect(link.oneWay).toBeNull();
  });

  it("falls back to the roster's home before a vantage is observed", () => {
    const link = resolveCameraLink(commandAt(DISH), DOWN, roster, separation, undefined);

    expect(link.oneWay?.magnitude).toBe(0.4);
  });

  it("claims nothing until a viewing centre is known", () => {
    const link = resolveCameraLink(commandAt(DISH), DOWN, undefined, undefined, undefined);

    expect(link).toEqual({ connected: undefined, signalStrength: undefined, oneWay: undefined });
  });

  it("claims nothing for no camera", () => {
    expect(resolveCameraLink(undefined, DOWN, roster, separation, HOME)).toBe(DOWN);
  });
});
