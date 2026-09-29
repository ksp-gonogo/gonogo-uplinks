import {
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
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  LEADERS_SCREEN,
  LEADERS_SCREEN_ID,
} from "../AdminBuilding/leadersScreen.js";
import { PROGRAMS_SCREEN_ID } from "../AdminBuilding/programsScreen.js";
import { LeaderDetail } from "./index.js";

const YEAR = 31_557_600;

function leader(overrides: Record<string, unknown> = {}) {
  return {
    strategyId: "leaderKorolev",
    title: "Sergei Korolev",
    department: "Engineering",
    active: false,
    canAppoint: true,
    appointBlockedReason: null,
    rehireFromUt: null,
    setupFunds: 0,
    setupScience: 0,
    setupReputation: 0,
    setupConfidence: 0,
    deactivateReputation: null,
    dismissSubsidyLossPerDay: null,
    removeOnDeactivate: true,
    reactivateCooldown: YEAR,
    canRemoveFromUt: null,
    freeToRemoveFromUt: null,
    ...overrides,
  };
}

function serving(overrides: Record<string, unknown> = {}) {
  return leader({
    active: true,
    canAppoint: null,
    deactivateReputation: 42.5,
    dismissSubsidyLossPerDay: 4.25,
    canRemoveFromUt: 1_000,
    freeToRemoveFromUt: 10 * YEAR,
    ...overrides,
  });
}

function career(strategy: Record<string, unknown> = {}) {
  return {
    economy: { funds: 289_848, reputation: 212.5 },
    strategies: {
      all: [
        {
          id: "leaderKorolev",
          title: "Sergei Korolev",
          department: "Engineering",
          effect:
            "<b><color=#feb200>Effects: </color></b>\n<b><color=#BEC2AE>* Integration rate +10%</color></b>\n",
          canDeactivate: true,
          ...strategy,
        },
      ],
    },
  };
}

function mount(screenId: string = LEADERS_SCREEN_ID) {
  const fixture = setupStreamFixture();
  const view = render(
    <fixture.Provider>
      <DelayRailProvider>
        <LeaderDetail screenId={screenId} />
      </DelayRailProvider>
    </fixture.Provider>,
  );
  return { fixture, view };
}

async function feed(
  fixture: ReturnType<typeof setupStreamFixture>,
  rows: ReturnType<typeof leader>[],
  strategy: Record<string, unknown> = {},
) {
  fixture.emit("rp1.available", true);
  fixture.emit("rp1.leaders", rows);
  fixture.emit("career.status", career(strategy));
  await waitFor(() => {
    expect(screen.getByText(/LEADER DETAIL/)).toBeInTheDocument();
  });
}

describe("RP-1 Leaders screen", () => {
  it("claims every department RP-1 hires leaders into, and draws their cards without verbs", () => {
    expect(LEADERS_SCREEN[0].departments).toEqual([
      "Administration",
      "Engineering",
      "FlightDirector",
      "Science",
      "MainContractor",
      "Contractor1",
      "Contractor2",
    ]);
    expect(LEADERS_SCREEN[0].drawsOwnActions).toBe(true);
    expect(Object.isFrozen(LEADERS_SCREEN[0])).toBe(true);
  });
});

describe("LeaderDetail", () => {
  it("draws nothing on another screen of the building", async () => {
    const { fixture, view } = mount(PROGRAMS_SCREEN_ID);
    fixture.emit("rp1.available", true);
    fixture.emit("rp1.leaders", [leader()]);
    await waitFor(() => {
      expect(view.container).toBeEmptyDOMElement();
    });
  });

  it("appoints an offered leader, stating it costs nothing", async () => {
    const user = userEvent.setup();
    const { fixture } = mount();
    await feed(fixture, [leader()]);

    expect(visibleText()).toContain("No cost");
    expect(visibleText()).toContain("OFFERED");
    await user.click(
      screen.getByRole("button", { name: "Appoint Sergei Korolev" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm appointing Sergei Korolev" }),
    );

    const sent = fixture.transport.sentCommands.find(
      (c) => c.command === "rp1.leader.appoint",
    );
    expect(sent?.args).toEqual({ strategyId: "leaderKorolev" });
  });

  /*
   * The defect this screen was built with: RP-1 keeps a locked leader off its
   * own list, and the console offered it anyway. RP-1's reason is on the dark
   * control, since the command would refuse with it.
   */
  it("keeps Appoint dark on a leader RP-1 would not offer, with RP-1's reason", async () => {
    const { fixture } = mount();
    const reason =
      "RP-1 has not unlocked this leader: its requirements are not met yet";
    await feed(fixture, [
      leader({ canAppoint: false, appointBlockedReason: reason }),
    ]);

    expect(screen.getByRole("button", { name: "Appoint" })).toBeDisabled();
    expect(visibleText()).toContain(reason);
    expect(visibleText()).toContain("LOCKED");
  });

  it("dates the end of a re-hire cooldown", async () => {
    const { fixture } = mount();
    await feed(fixture, [
      leader({
        canAppoint: false,
        appointBlockedReason: "cooling down",
        rehireFromUt: 2 * YEAR,
      }),
    ]);

    expect(visibleText()).toContain("COOLDOWN");
    expect(visibleText()).toContain("Re-hire from");
  });

  it("dismisses through core's deactivate, with the reputation it costs now and what that pays in subsidy", async () => {
    const user = userEvent.setup();
    const { fixture } = mount();
    await feed(fixture, [serving()]);

    expect(visibleText()).toContain("SERVING");
    expect(visibleText()).toContain(
      "42.5 reputation now, costing 4.3 f/day of subsidy",
    );
    expect(visibleText()).toContain("Integration rate +10%");
    expect(visibleText()).not.toContain("color=");
    expect(visibleText()).toContain("Free to dismiss");
    await user.click(
      screen.getByRole("button", { name: "Dismiss Sergei Korolev" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm dismissing Sergei Korolev" }),
    );

    const sent = fixture.transport.sentCommands.find(
      (c) => c.command === "career.strategy.deactivate",
    );
    expect(sent?.args).toEqual({ strategyId: "leaderKorolev" });
  });

  it("keeps Dismiss dark while core refuses it, with the date it becomes possible", async () => {
    const { fixture } = mount();
    await feed(fixture, [serving()], {
      canDeactivate: false,
      deactivateBlockedReason: "Too soon to remove",
    });

    expect(screen.getByRole("button", { name: "Dismiss" })).toBeDisabled();
    expect(visibleText()).toContain("Can dismiss");
  });

  it("says a leader removed for good cannot come back", async () => {
    const { fixture } = mount();
    await feed(fixture, [serving({ reactivateCooldown: 0 })]);

    expect(visibleText()).toContain("cannot be hired again");
  });

  it("is accessible", async () => {
    const { fixture, view } = mount();
    await feed(fixture, [
      serving(),
      leader({ strategyId: "leaderGlushko", title: "Valentin Glushko" }),
    ]);
    await expectNoA11yViolations(view.container);
  });
});
