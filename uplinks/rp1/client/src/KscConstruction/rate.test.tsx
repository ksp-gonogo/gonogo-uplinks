import {
  render,
  screen,
  setupStreamFixture,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { DelayRailProvider } from "@ksp-gonogo/ui-kit";
import {
  expectNoA11yViolations,
  visibleText,
} from "@ksp-gonogo/ui-kit/testing";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { KscConstruction } from "./index.js";
import {
  RP1_CONSTRUCTION_CANCEL_COMMAND,
  RP1_CONSTRUCTION_SET_RATE_COMMAND,
} from "./RateControl.js";

const ID = "6f1c2a0e-3b4d-4c5e-8f60-7a8b9c0d1e2f";

function construction(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    kscName: "Cape",
    lcId: null,
    kind: "FacilityUpgrade",
    name: "VehicleAssemblyBuilding",
    facilityType: "VehicleAssemblyBuilding",
    currentLevel: 1,
    targetLevel: 2,
    isModify: null,
    engineersToReadd: null,
    padId: null,
    progress: 250,
    totalPoints: 1000,
    progressRatio: 0.25,
    workRate: 1,
    rate: 0.002,
    timeLeftSeconds: 375_000,
    stalled: false,
    cost: 40_000,
    spentCost: 10_000,
    spentRushCost: 12_500,
    ...overrides,
  };
}

/** A draw that says which step it is, so a readout showing the wrong one is visible. */
function steps() {
  return Array.from({ length: 31 }, (_, step) => ({
    workRate: step * 0.05,
    costMultiplier: step > 20 ? 1 + (step - 20) * 0.1 : 1,
    costPerDay: step === 0 ? 0 : step * 100,
    finishesAt: step === 0 ? null : 1_000_000 + 86_400 * (31 - step),
  }));
}

function mount(row = construction(), table: unknown = { id: ID, steps: steps() }) {
  const fixture = setupStreamFixture();
  const view = render(
    <fixture.Provider>
      {/* The panel's command rail, which every dispatch reports to. */}
      <DelayRailProvider>
        <KscConstruction />
      </DelayRailProvider>
    </fixture.Provider>,
  );
  fixture.emit("rp1.available", true);
  fixture.emit("rp1.centres", [{ kscName: "Cape", kscDisplayName: "Cape Canaveral" }]);
  fixture.emit("rp1.constructions", [row]);
  fixture.emit("rp1.constructionRates", {
    refreshedAt: 1_000_000,
    constructions: table === null ? [] : [table],
    facilityUpgrades: [],
  });
  return { fixture, view };
}

describe("KscConstruction work rate and cancel", () => {
  it("shows the draw per day at the current rate, and no affordability verdict", async () => {
    const { view } = mount();

    await screen.findByText("Set rate");
    const text = visibleText(view.container);
    expect(text).toContain("100%");
    expect(text).toContain("draws");
    expect(text).toContain("2000 f/day");
    expect(text).not.toMatch(/afford/i);
    // Already at this rate, so there is nothing to set.
    expect(
      screen.getByRole("button", { name: "Vehicle Assembly Building is already at 100%" }),
    ).toBeDisabled();
    await expectNoA11yViolations(view.container);
  });

  it("prices a rush at the chosen step, names its multiplier, and sends that step", async () => {
    const user = userEvent.setup();
    const { fixture, view } = mount();

    const increase = await screen.findByRole("button", {
      name: "Increase Work rate for Vehicle Assembly Building",
    });
    await user.click(increase);
    await user.click(increase);

    const text = visibleText(view.container);
    expect(text).toContain("110%");
    expect(text).toContain("2200 f/day");
    expect(text).toContain("rush cost ×1.20");

    await user.click(screen.getByRole("button", { name: "Set Vehicle Assembly Building to 110%" }));
    await user.click(await screen.findByRole("button", { name: "Set 110%" }));

    const sent = fixture.transport.sentCommands.find(
      (c) => c.command === RP1_CONSTRUCTION_SET_RATE_COMMAND,
    );
    expect(sent?.args).toEqual({ id: ID, workRate: 1.1 });
  });

  it("says a stopped construction draws nothing and never finishes", async () => {
    const user = userEvent.setup();
    const { view } = mount(construction({ workRate: 0.05 }));

    await user.click(
      await screen.findByRole("button", {
        name: "Decrease Work rate for Vehicle Assembly Building",
      }),
    );

    expect(visibleText(view.container)).toContain("draws nothing and never finishes");
  });

  it("says a rate RP-1 has not priced yet rather than inventing a draw", async () => {
    const { view } = mount(construction(), null);

    await screen.findByText("Set rate");
    expect(visibleText(view.container)).toContain("RP-1 has not priced this rate yet");
  });

  it("names what has been spent beside Cancel, and cancels only once armed", async () => {
    const user = userEvent.setup();
    const { fixture, view } = mount();

    await screen.findByText("Set rate");
    expect(visibleText(view.container)).toContain("12,500");
    expect(visibleText(view.container)).toContain("spent, not refunded");

    await user.click(screen.getByRole("button", { name: "Cancel Vehicle Assembly Building" }));
    expect(
      fixture.transport.sentCommands.some((c) => c.command === RP1_CONSTRUCTION_CANCEL_COMMAND),
    ).toBe(false);

    await user.click(
      await screen.findByRole("button", {
        name: "Stop building Vehicle Assembly Building; nothing already spent is refunded",
      }),
    );
    const sent = fixture.transport.sentCommands.find(
      (c) => c.command === RP1_CONSTRUCTION_CANCEL_COMMAND,
    );
    expect(sent?.args).toEqual({ id: ID });
  });

  it("offers neither control on a row RP-1 gave no id", async () => {
    const { view } = mount(construction({ id: null }));

    await screen.findByText("SITE CONSTRUCTION");
    const text = visibleText(view.container);
    expect(text).toContain("Vehicle Assembly Building");
    expect(text).not.toContain("Set rate");
    expect(text).not.toContain("Cancel");
  });
});
