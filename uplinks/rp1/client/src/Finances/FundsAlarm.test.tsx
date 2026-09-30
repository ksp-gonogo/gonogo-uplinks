import {
  act,
  clearRequestedAlarms,
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
import { fundsReachedAtTopic } from "../topics.js";
import { FundsAlarm } from "./FundsAlarm.js";

function mount(
  fundTarget?: Record<string, unknown>,
  funds: number | null = 120_000,
) {
  const fixture = setupStreamFixture();
  const asked: string[] = [];
  const send = fixture.transport.send.bind(fixture.transport);
  fixture.transport.send = (message) => {
    if (message.type === "subscribe" && message.topic.startsWith("rp1.fundsReachedAt.")) {
      asked.push(message.topic);
    }
    send(message);
  };
  const view = render(
    <fixture.Provider>
      <FundsAlarm />
    </fixture.Provider>,
  );
  act(() => {
    fixture.emit("rp1.available", true);
    if (funds !== null) {
      fixture.emit("career.status", { balances: { funds } });
    }
    if (fundTarget !== undefined) {
      fixture.emit("rp1.fundTarget", fundTarget);
    }
  });
  return { fixture, view, asked };
}

async function typeTarget(user: ReturnType<typeof userEvent.setup>, n: string) {
  const field = await screen.findByLabelText("Target balance");
  await user.clear(field);
  await user.type(field, n);
}

/** The forecast row's figure, once the typed figure has settled and RP-1 has been asked. */
async function forecastFor(
  fixture: ReturnType<typeof mount>["fixture"],
  funds: number,
  reachedAt: number | null,
) {
  const topic = fundsReachedAtTopic(funds);
  await waitFor(() => {
    expect(fixture.transport.isSubscribed(topic)).toBe(true);
  });
  act(() => {
    fixture.emit(topic, reachedAt);
  });
}

describe("FundsAlarm", () => {
  beforeEach(() => {
    clearRequestedAlarms();
  });

  it("asks the app for an alarm on the balance, and sends RP-1 nothing", async () => {
    const user = userEvent.setup();
    const { fixture, view } = mount({ active: false });

    await typeTarget(user, "250000");
    await user.click(
      await screen.findByRole("button", {
        name: "Stop the warp when the balance reaches 250,000 funds",
      }),
    );

    expect(getRequestedAlarms()).toEqual([
      {
        uplinkId: "rp1",
        key: "fund-target",
        name: "Balance reaches 250,000 funds",
        trigger: {
          kind: "threshold",
          topic: "career.status",
          fieldPath: "balances.funds",
          op: ">=",
          value: 250_000,
          vantage: "command",
        },
      },
    ]);
    expect(fixture.transport.sentCommands).toEqual([]);
    await expectNoA11yViolations(view.container);
  });

  it("retargets one alarm rather than piling them up when pressed twice", async () => {
    const user = userEvent.setup();
    mount({ active: false });

    await typeTarget(user, "250000");
    await user.click(
      await screen.findByRole("button", {
        name: "Stop the warp when the balance reaches 250,000 funds",
      }),
    );
    await typeTarget(user, "400000");
    await user.click(
      await screen.findByRole("button", {
        name: "Stop the warp when the balance reaches 400,000 funds",
      }),
    );

    expect(getRequestedAlarms().map((a) => a.key)).toEqual([
      "fund-target",
      "fund-target",
    ]);
  });

  it("seeds the figure from a target RP-1 is already holding", async () => {
    mount({ active: true, targetFunds: 250_000, timeLeft: 864_000 });

    await screen.findByRole("button", {
      name: "Stop the warp when the balance reaches 250,000 funds",
    });
  });

  it("darkens the press until there is a figure to arm on", async () => {
    mount({ active: false });

    expect(
      await screen.findByRole("button", {
        name: "Stop the warp when the balance reaches 0 funds",
      }),
    ).toBeDisabled();
  });

  it("shows the date RP-1 forecasts for the figure typed, asked once it settles", async () => {
    const user = userEvent.setup();
    const { fixture, view, asked } = mount({ active: false });

    await typeTarget(user, "250000");
    await forecastFor(fixture, 250_000, 3 * 86_400);

    await waitFor(() => {
      expect(view.container.textContent).toMatch(/Balance reaches it.*Y1/);
    });
    // Asked for the figure typed, not for every prefix of it on the way there.
    expect(asked).toEqual([fundsReachedAtTopic(250_000)]);
  });

  it("says when RP-1's forecast does not reach the figure", async () => {
    const user = userEvent.setup();
    const { fixture, view } = mount({ active: false });

    await typeTarget(user, "9000000");
    await forecastFor(fixture, 9_000_000, null);

    await waitFor(() => {
      expect(view.container.textContent).toContain("beyond RP-1's forecast");
    });
  });

  it("says the balance is there already rather than forecasting it", async () => {
    const user = userEvent.setup();
    const { view } = mount({ active: false }, 300_000);

    await typeTarget(user, "250000");

    await waitFor(() => {
      expect(view.container.textContent).toMatch(/Balance reaches it\s*already/);
    });
  });

  /*
   * A balance alarm spends nothing: RP-1's FundTargetProject returns project
   * type None and its Clear touches no currency, so an affordability line here
   * would invent a cost.
   */
  it("draws no price and no affordability, because an alarm spends nothing", async () => {
    const user = userEvent.setup();
    const { fixture, view } = mount({ active: false });

    await typeTarget(user, "250000");
    await forecastFor(fixture, 250_000, 3 * 86_400);

    expect(view.container.textContent).not.toMatch(/afford|cost|spend/i);
  });
});
