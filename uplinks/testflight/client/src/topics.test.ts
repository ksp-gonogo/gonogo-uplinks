import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getAllKnownTopicIds,
  isTopicId,
  useTelemetry,
} from "@ksp-gonogo/sitrep-sdk";
import {
  renderHook,
  setupStreamFixture,
  waitFor,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { describe, expect, it } from "vitest";
import {
  TESTFLIGHT_AVAILABLE_TOPIC,
  TESTFLIGHT_RELIABILITY_PARTS_TOPIC,
  TESTFLIGHT_RELIABILITY_TOPIC,
} from "./topics.js";

// src -> client -> testflight
const UPLINK_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The value of a `const string <name>` in TestFlightUplink.cs, as the C# declares it. */
function csTopic(constName: string): string {
  const src = readFileSync(
    join(UPLINK_ROOT, "mod", "TestFlightUplink.cs"),
    "utf8",
  );
  const m = src.match(
    new RegExp(`const\\s+string\\s+${constName}\\s*=\\s*"([^"]+)"`),
  );
  if (!m) {
    throw new Error(`${constName} constant not found in TestFlightUplink.cs`);
  }
  return m[1];
}

describe("testflight Topics", () => {
  it("register the same strings the C# Uplink declares", () => {
    expect(TESTFLIGHT_AVAILABLE_TOPIC).toBe(csTopic("AvailableTopic"));
    expect(TESTFLIGHT_RELIABILITY_TOPIC).toBe(csTopic("ReliabilityTopic"));
    expect(TESTFLIGHT_RELIABILITY_PARTS_TOPIC).toBe(
      csTopic("ReliabilityPartsTopic"),
    );
  });

  it("are known TopicIds once this client's topics module has loaded", () => {
    for (const topic of [
      TESTFLIGHT_AVAILABLE_TOPIC,
      TESTFLIGHT_RELIABILITY_TOPIC,
      TESTFLIGHT_RELIABILITY_PARTS_TOPIC,
    ]) {
      expect(isTopicId(topic)).toBe(true);
      expect(getAllKnownTopicIds()).toContain(topic);
    }
  });

  it("hydrates an engine's survival and its rated burn nested inside it", async () => {
    const fixture = setupStreamFixture();
    const { result } = renderHook(
      () => {
        const reading = useTelemetry(TESTFLIGHT_RELIABILITY_PARTS_TOPIC);
        return reading.state === "observed" ? reading.value : undefined;
      },
      { wrapper: fixture.Provider },
    );

    fixture.emit(TESTFLIGHT_RELIABILITY_PARTS_TOPIC, [
      {
        partId: "2214:0",
        title: "LR91 Engine",
        condition: "nominal",
        survival: 0.96,
        survivalHorizonSeconds: 225,
        budgets: [
          {
            id: "burn.continuous",
            label: "continuous rated burn",
            kind: "risk-ramp",
            consumed: 0.91,
            usedSeconds: 205,
            limitSeconds: 225,
          },
        ],
      },
    ]);

    await waitFor(() => {
      expect(result.current?.[0]).toBeDefined();
    });

    const part = result.current?.[0];
    expect(part?.survival).toMatchObject({ magnitude: 0.96, unit: "ratio" });
    expect(part?.survivalHorizonSeconds).toMatchObject({
      magnitude: 225,
      unit: "s",
    });
    expect(part?.budgets?.[0]?.usedSeconds).toMatchObject({
      magnitude: 205,
      unit: "s",
    });
    expect(part?.condition).toBe("nominal");
  });
});
