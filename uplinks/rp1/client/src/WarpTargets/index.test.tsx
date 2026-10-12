import {
  act,
  clearRequestedAlarms,
  getAugmentsForSlot,
  getRequestedAlarms,
  screen,
  setupStreamFixture,
  waitFor,
} from "@ksp-gonogo/sitrep-sdk/testing";
import {
  expectNoA11yViolations,
  renderWithRail as render,
} from "@ksp-gonogo/ui-kit/testing";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { RP1_FUND_TARGET_CANCEL_COMMAND } from "./FundTarget.js";
import { RP1_NEXT_COMPLETION_ALARM_KEY, WarpTargets } from "./index.js";

function mount(
  fundTarget?: Record<string, unknown>,
  nextCompletion?: Record<string, unknown>,
) {
  const fixture = setupStreamFixture();
  const view = render(
    <fixture.Provider>
      <WarpTargets />
    </fixture.Provider>,
  );
  act(() => {
    fixture.emit("rp1.available", true);
    if (fundTarget !== undefined) {
      fixture.emit("rp1.fundTarget", fundTarget);
    }
    fixture.emit(
      "rp1.nextCompletion",
      nextCompletion ?? {
        ut: 5_000_000,
        kind: "build",
        label: "Atlas 3",
        basis: "next-to-finish",
      },
    );
  });
  return { fixture, view };
}

describe("WarpTargets", () => {
  beforeEach(() => {
    clearRequestedAlarms();
  });

  it("binds the slot the host widget already has for a mod's warp target", () => {
    /*
     * An augment rather than a widget, and the assertion is that it LANDS in the
     * slot rather than merely rendering: warping is one act with one piece of
     * state, and a second panel owning the mod's version would make an operator
     * hunt for whichever one RP-1 respects.
     */
    const augments = getAugmentsForSlot("warp-control.stepper");
    expect(augments.map((a) => a.id)).toContain("rp1-warp-targets");
  });

  it("renders nothing at all until RP-1 says it is there", async () => {
    const fixture = setupStreamFixture();
    const view = render(
      <fixture.Provider>
        <WarpTargets />
      </fixture.Provider>,
    );
    act(() => {
      fixture.emit("rp1.available", false);
    });

    await waitFor(() => {
      expect(view.container.textContent).toBe("");
    });
  });

  it("asks for an alarm that follows the next completion, and sends RP-1 nothing", async () => {
    const user = userEvent.setup();
    const { fixture, view } = mount();

    await user.click(
      await screen.findByRole("button", {
        name: "Set an alarm for when Atlas 3 finishes. It spends nothing.",
      }),
    );

    /*
     * An alarm the mod follows, not a command: RP-1 manages no warp for this, the
     * alarm in the operator's own list is what stops it. The topic and path are
     * the ones the mod reads on every tick, so the alarm re-aims when a shorter
     * project overtakes the one named on the button.
     */
    expect(getRequestedAlarms()).toEqual([
      {
        uplinkId: "rp1",
        key: RP1_NEXT_COMPLETION_ALARM_KEY,
        name: "Next RP-1 project finishes",
        trigger: {
          kind: "instant",
          topic: "rp1.nextCompletion",
          fieldPath: "ut",
          leadSeconds: 10,
        },
      },
    ]);
    expect(fixture.transport.sentCommands).toEqual([]);
    await expectNoA11yViolations(view.container);
  });

  it("is dark while nothing is in progress, and says so", async () => {
    mount(undefined, { ut: null, kind: null, label: null, basis: "none-in-progress" });

    const button = await screen.findByRole("button", {
      name: /Set an alarm for when the next project finishes/,
    });
    expect(button).toBeDisabled();
    expect(screen.getByText("nothing in progress")).toBeInTheDocument();
  });

  it("offers no way to stop warping, because the host widget already does", async () => {
    mount({ active: true, timeLeft: 864000 });

    await waitFor(() => {
      expect(screen.getByText(/next completion/)).toBeInTheDocument();
    });
    /*
     * RP-1's controller destroys itself the moment it sees a warp rate of zero,
     * so the host widget's own "1x" button ends an RP-1 warp. A second stop
     * control would be two buttons doing one thing with the operator left to
     * guess which one the mod respects.
     */
    expect(
      screen.queryByRole("button", { name: /[Ss]top/ }),
    ).not.toBeInTheDocument();
  });

  it("withdraws a standing target without opening the screen that set it", async () => {
    const user = userEvent.setup();
    const { fixture } = mount({
      active: true,
      targetFunds: 250_000,
      timeLeft: 864_000,
    });

    await user.click(
      await screen.findByRole("button", { name: "Cancel the fund target" }),
    );

    /*
     * The cancel SURVIVED the two deletions, and it is not the other half of
     * anything: RP-1's own Maintenance screen still stands targets up, and
     * withdrawing one from the dashboard beats going back for that screen.
     */
    expect(
      fixture.transport.sentCommands.find(
        (c) => c.command === RP1_FUND_TARGET_CANCEL_COMMAND,
      )?.args,
    ).toEqual({});
  });

  it("sets no balance alarm here: that lives in Finances beside RP-1's forecast", async () => {
    mount({ active: true, targetFunds: 250_000, timeLeft: 864_000 });

    await screen.findByRole("button", { name: "Cancel the fund target" });
    expect(screen.queryByLabelText("Target balance")).not.toBeInTheDocument();
  });

  it("offers no cancel while nothing is standing, because RP-1 refuses one", async () => {
    mount({ active: false });

    await screen.findByRole("button", {
      name: /Set an alarm for when Atlas 3 finishes/,
    });
    /*
     * RP-1's own cancel asks IsValid first and refuses when nothing stands, so a
     * press offered here could only ever report a failure.
     */
    expect(
      screen.queryByRole("button", { name: "Cancel the fund target" }),
    ).not.toBeInTheDocument();
  });
});
