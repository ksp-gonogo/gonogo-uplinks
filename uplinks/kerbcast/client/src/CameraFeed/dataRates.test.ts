import { getComponent } from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import "../index.js";

const CAMERA_WIDGETS = ["camera-feed"];

describe("camera widgets' data rate", () => {
  it.each(CAMERA_WIDGETS)("%s asks for fast vessel.flight", (id) => {
    expect(getComponent(id)?.dataRates?.fast).toContain("vessel.flight");
  });
});
