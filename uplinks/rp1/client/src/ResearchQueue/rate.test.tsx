import {
  fireEvent,
  render,
  screen,
  setupStreamFixture,
  waitFor,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { DelayRailProvider } from "@ksp-gonogo/ui-kit";
import {
  expectNoA11yViolations,
  visibleText,
} from "@ksp-gonogo/ui-kit/testing";
import { describe, expect, it } from "vitest";
import { ResearchQueue } from "./index.js";
import { RP1_RESEARCH_SET_RATE_COMMAND } from "./RateControl.js";

function node(overrides: Record<string, unknown> = {}) {
  return {
    techId: "basicRocketry",
    techName: "Basic Rocketry",
    scienceCost: 100,
    progress: 25,
    progressRatio: 0.25,
    workRate: 1,
    rate: 0.001,
    timeLeftSeconds: 75_000,
    stalled: false,
    startYear: 1951,
    endYear: 1960,
    ...overrides,
  };
}

/** Pay and credit that say which step they are, so a readout on the wrong step is visible. */
function steps() {
  return Array.from({ length: 21 }, (_, step) => ({
    workRate: step * 0.05,
    researcherSalaryPerDay: 1000 + step * 50,
    unlockCreditPerDay: step * 20,
    finishesAt: step === 0 ? null : 1_000_000 + 86_400 * (21 - step),
  }));
}

function mount(
  row = node(),
  rates: unknown = {
    refreshedAt: 1_000_000,
    techId: "basicRocketry",
    steps: steps(),
  },
) {
  const fixture = setupStreamFixture();
  const view = render(
    <fixture.Provider>
      {/* The panel's command rail, which every dispatch reports to. */}
      <DelayRailProvider>
        <ResearchQueue />
      </DelayRailProvider>
    </fixture.Provider>,
  );
  fixture.emit("rp1.available", true);
  fixture.emit("rp1.research", [row]);
  fixture.emit("rp1.researchRates", rates);
  return { fixture, view };
}

describe("ResearchQueue work rate", () => {
  it("shows the pay, the credit and the finish at the current rate, and no affordability verdict", async () => {
    const { view } = mount();

    const slider = await screen.findByRole("slider", {
      name: "Research work rate",
    });
    const text = visibleText(view.container);
    expect(text).toContain("100%");
    expect(text).toContain("researchers paid 2000 f/day");
    expect(text).toContain("Unlock Credit 400 f/day");
    expect(text).toContain("Basic Rocketry done");
    expect(text).not.toMatch(/afford/i);
    expect(text).not.toContain("against now");
    expect(slider).toHaveValue("1");
    await expectNoA11yViolations(view.container);
  });

  it("names what a lower rate saves in pay and costs in credit, and sends that step", async () => {
    const { fixture, view } = mount();

    fireEvent.change(await screen.findByRole("slider", { name: "Research work rate" }), {
      target: { value: "0.9" },
    });

    const text = visibleText(view.container);
    expect(text).toContain("90%");
    expect(text).toContain("researchers paid 1900 f/day");
    expect(text).toContain(
      "against now: pay 100 f/day less, Unlock Credit 40 f/day less",
    );

    await waitFor(() =>
      expect(
        fixture.transport.sentCommands.some(
          (c) => c.command === RP1_RESEARCH_SET_RATE_COMMAND,
        ),
      ).toBe(true),
    );

    const sent = fixture.transport.sentCommands.find(
      (c) => c.command === RP1_RESEARCH_SET_RATE_COMMAND,
    );
    expect(sent?.args).toEqual({ workRate: 0.9 });
  });

  it("says a stopped queue still pays researchers and never finishes", async () => {
    const { view } = mount(node({ workRate: 0.05 }));

    fireEvent.change(await screen.findByRole("slider", { name: "Research work rate" }), {
      target: { value: "0" },
    });

    const text = visibleText(view.container);
    expect(text).toContain("stopped: researchers still paid 1000 f/day");
    expect(text).toContain("no Unlock Credit, Basic Rocketry never finishes");
    expect(text).toContain(
      "against now: pay 50 f/day less, Unlock Credit 20 f/day less",
    );
  });

  it("says a rate RP-1 has not priced yet rather than inventing a figure", async () => {
    const { view } = mount(node(), {
      refreshedAt: 1_000_000,
      techId: "basicRocketry",
      steps: [],
    });

    await screen.findByRole("slider", { name: "Research work rate" });
    expect(visibleText(view.container)).toContain(
      "RP-1 has not priced this rate yet",
    );
  });

  it("dates no node when the table was priced for a node that has since finished", async () => {
    const { view } = mount(
      node({ techId: "orbitalRocketry", techName: "Orbital Rocketry" }),
    );

    await screen.findByRole("slider", { name: "Research work rate" });
    const text = visibleText(view.container);
    expect(text).toContain("researchers paid 2000 f/day");
    expect(text).not.toContain("done");
  });

  it("offers no rate on an empty queue, where RP-1 draws no slider", async () => {
    const fixture = setupStreamFixture();
    render(
      <fixture.Provider>
        <DelayRailProvider>
          <ResearchQueue />
        </DelayRailProvider>
      </fixture.Provider>,
    );
    fixture.emit("rp1.available", true);
    fixture.emit("rp1.research", []);

    await screen.findByText(/Researchers are idle/);
    expect(screen.queryByRole("slider")).toBeNull();
  });
});
