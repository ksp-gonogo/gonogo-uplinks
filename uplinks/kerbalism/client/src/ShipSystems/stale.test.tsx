import {
  fireEvent,
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
import lightTime from "./__fixtures__/ec-shortage-limits-water-light-time.json" with { type: "json" };
import held from "./__fixtures__/ec-shortage-limits-water-stopped-arriving.json" with { type: "json" };
// Side-effect imports: the widget self-registers on module load, and so does the resource model it draws beside the observation.
import "../resourceReckoning.js";
import "./index.js";

/**
 * Ship Systems when the link drops out of a life-support scene: the same
 * ledger, drawn as the last one there was and saying so.
 *
 * The pair is the assertion. The scene is byte-for-byte its live twin but for
 * `stopsArriving`, so every held mark below is one the live scene must not
 * carry, and a harness that ignored the flag would render the two identically.
 */

const unmounts: Array<() => void> = [];
afterEach(() => {
  for (const unmount of unmounts.splice(0)) unmount();
});

async function scene(fixture: Record<string, unknown>): Promise<HTMLElement> {
  const block = resolveStreamBlock(fixture);
  if (!block) throw new Error("fixture carries no _stream block");
  const stream = setupStreamFixture({
    ...streamClockOptions(block),
  });
  /*
   * `useProcessor` reads its inputs straight off the store and never
   * subscribes, and `StubTransport.emit` drops a sample for a topic nobody
   * has, so the scene's own topics are subscribed here the way a companion
   * widget would in production.
   */
  for (const e of block.emits) stream.subscribe(e.topic);
  const { container, unmount } = renderWidget("ship-systems", {
    instanceId: "held",
    w: 8,
    h: 20,
    wrapper: stream.Provider,
  });
  unmounts.push(unmount);
  await replayStreamBlock(stream, block);
  await flushProviderFrame();
  return container;
}

describe("Ship Systems says a held ledger is held", () => {
  it("marks the header badge, the figures and the processes once the link drops", async () => {
    const container = await scene(held);
    const text = visibleText(container);

    expect(text).toMatch(/critical · held/i);
    expect(text).toContain("run state held");
    expect(text).not.toMatch(/\brunning\b/i);
    expect(
      [...container.querySelectorAll("*")].filter(
        (el) => el.children.length === 0 && el.textContent === "held",
      ),
    ).toHaveLength(2);
    /*
     * The time-to-empty figures carry the kit's own mark, and it announces:
     * the dot is aria-hidden and the grade and instant are said beside it.
     */
    const marks = [...container.querySelectorAll("[data-held]")];
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) {
      expect(mark.querySelector("[data-unit-currency]")).not.toBeNull();
    }
  });

  it("carries none of it while the ledger is current", async () => {
    const container = await scene(live);
    const text = visibleText(container);

    expect(text).not.toMatch(/at last contact|· held/i);
    expect(text).not.toContain("run state held");
    expect(container.querySelectorAll("[data-held]")).toHaveLength(0);
  });

  it("dims every ledger term's bar once the ledger is held", async () => {
    const container = await scene(held);
    fireEvent.click(
      screen.getByRole("button", { name: "Show rate breakdown for Water" }),
    );
    const bars = [
      ...container.querySelectorAll('[data-testid="diverging-bar"]'),
    ];
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) expect(bar).toHaveAttribute("data-held");
  });

  it("leaves the ledger's bars undimmed while it is current", async () => {
    const container = await scene(live);
    fireEvent.click(
      screen.getByRole("button", { name: "Show rate breakdown for Water" }),
    );
    const bars = [
      ...container.querySelectorAll('[data-testid="diverging-bar"]'),
    ];
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) {
      expect(bar).not.toHaveAttribute("data-held");
    }
  });
});

/**
 * The live scene seen across a 60 s light time. Electric Charge drains at
 * 0.05/s, so the resource model carries it from 20 to 17 at the craft's
 * present and its time to empty from 400 s to 340 s. Water's drain moves
 * nothing that reads differently at the precision drawn.
 */
describe("Ship Systems across a light time", () => {
  it("draws the model's level and time to empty beside each observed figure", async () => {
    const container = await scene(lightTime);
    const ec = screen.getByTestId("resource-card-ElectricCharge");
    expect(visibleText(ec)).toMatch(/20\s*17\s*\/ 400 · 6min 40s\s*5min 40s/);
    const alongside = [...ec.querySelectorAll("[data-modelled-alongside]")];
    expect(alongside.map((el) => visibleText(el as HTMLElement))).toEqual([
      "17",
      "5min 40s",
    ]);
    for (const figure of alongside) {
      expect(figure.querySelector("[data-held-mark]")).not.toBeNull();
    }
    expect(
      screen.getByRole("meter", { name: "Electric Charge" }),
    ).toHaveAttribute(
      "aria-valuetext",
      expect.stringMatching(/, modelled to SCET 17 · /),
    );
    const water = screen.getByTestId("resource-card-Water");
    expect(water.querySelector("[data-modelled-alongside]")).toBeNull();
    expect(screen.getByRole("meter", { name: "Water" })).toHaveAttribute(
      "aria-valuetext",
      expect.not.stringContaining("modelled"),
    );
    expect(container.querySelectorAll("[data-held]").length).toBe(
      container.querySelectorAll("[data-modelled-alongside]").length,
    );
  });

  it("draws no modelled figure without one", async () => {
    const container = await scene(live);
    expect(container.querySelector("[data-modelled-alongside]")).toBeNull();
  });
});
