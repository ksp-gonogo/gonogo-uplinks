import {
  screen,
  setupStreamFixture,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { renderWidget, visibleText } from "@ksp-gonogo/ui-kit/testing";
import { afterEach, describe, expect, it } from "vitest";
import {
  flushProviderFrame,
  replayStreamBlock,
  resolveStreamBlock,
  streamClockOptions,
} from "../test/widgetDomSnapshot.js";
import live from "./__fixtures__/ec-shortage-limits-water.json" with { type: "json" };
import "../resourceReckoning.js";
import "./index.js";

/**
 * Ship Systems after the craft is gone: the install's profile and the last
 * life-support rates are still on the stream, but no resource level is, so
 * there is nothing for a shortage to be measured against.
 */

const unmounts: Array<() => void> = [];
afterEach(() => {
  for (const unmount of unmounts.splice(0)) unmount();
});

async function sceneWithout(topic: string): Promise<HTMLElement> {
  const block = resolveStreamBlock(live);
  if (!block) throw new Error("fixture carries no _stream block");
  const trimmed = {
    ...block,
    emits: block.emits.filter((e) => e.topic !== topic),
  };
  const stream = setupStreamFixture({ ...streamClockOptions(trimmed) });
  for (const e of block.emits) stream.subscribe(e.topic);
  const { container, unmount } = renderWidget("ship-systems", {
    instanceId: "no-vessel",
    w: 8,
    h: 20,
    wrapper: stream.Provider,
  });
  unmounts.push(unmount);
  await replayStreamBlock(stream, trimmed);
  await flushProviderFrame();
  return container;
}

describe("Ship Systems with no resource levels", () => {
  it("names no limiting factor when the levels were never read", async () => {
    const container = await sceneWithout("vessel.resources");
    expect(visibleText(container)).not.toMatch(/limited by|running critically low/i);
    expect(screen.queryByText("Limiting factors")).toBeNull();
  });

  it("shows no status badge when the levels were never read", async () => {
    const container = await sceneWithout("vessel.resources");
    expect(visibleText(container)).not.toMatch(/nominal|degraded|critical/i);
  });

  it("still names the limiting factor when the levels are read", async () => {
    const container = await sceneWithout("vessel.crew");
    expect(visibleText(container)).toContain("Limiting factors");
    expect(visibleText(container)).toMatch(/critical/i);
  });
});
