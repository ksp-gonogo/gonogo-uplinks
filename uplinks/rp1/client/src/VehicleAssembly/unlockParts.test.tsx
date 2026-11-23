import {
  act,
  render,
  screen,
  setupStreamFixture,
  waitFor,
} from "@ksp-gonogo/sitrep-sdk/testing";
import {
  expectNoA11yViolations,
  visibleText,
  WidgetHost,
} from "@ksp-gonogo/ui-kit/testing";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  RP1_PARTS_UNLOCK_COMMAND,
  RP1_PARTS_UNLOCK_QUOTE_COMMAND,
} from "./UnlockParts.js";
import { VehicleAssembly } from "./index.js";

const CAREER = { balances: { funds: 289_848, reputation: 40, science: 12 } };

const COMPLEXES = [
  {
    engineers: 18,
    isOperational: true,
    kscName: "Cape",
    lcId: "lc-1",
    lcType: "Pad",
    massMax: 180,
    massMin: 6,
    maxEngineers: 60,
    name: "LC-1",
  },
];

const TITAN = {
  complexes: [
    {
      eligible: true,
      kscName: "Cape",
      lcId: "lc-1",
      name: "LC-1",
      refusals: [],
    },
  ],
  craftFile: "Titan-I",
  facility: 1,
  lockedParts: [],
  mass: 105,
  missingParts: [],
  partCount: 58,
  shipName: "Titan-I",
  // A craft carries one entry per copy, so a part named twice is one part.
  unpurchasedParts: ["LR87-AJ-3", "LR91-AJ-3", "LR87-AJ-3"],
};

/** What RP-1 quotes when unlock credit covers the whole price. */
const CREDIT_COVERS = {
  affordable: true,
  balance: 289_848,
  creditApplied: 18_400,
  creditBalance: 50_000,
  fundsToPay: 0,
  partCount: 2,
  price: 18_400,
};

/** Credit covers 6,000 of 18,400 and funds pay the other 12,400. */
const PARTIAL_CREDIT = {
  ...CREDIT_COVERS,
  creditApplied: 6_000,
  creditBalance: 6_000,
  fundsToPay: 12_400,
};

/** Credit 1,000 leaves 17,400 to pay against 9,000 of funds. */
const FUNDS_SHORT = {
  affordable: false,
  balance: 9_000,
  creditApplied: 1_000,
  creditBalance: 1_000,
  fundsToPay: 17_400,
  partCount: 2,
  price: 18_400,
};

async function withTitan(quote: Record<string, unknown> | null) {
  const fixture = setupStreamFixture();
  const view = render(
    <fixture.Provider>
      <WidgetHost widgetId="rp1-vehicle-assembly">
        <VehicleAssembly />
      </WidgetHost>
    </fixture.Provider>,
  );
  fixture.transport.setCommandHandler((command) =>
    command === RP1_PARTS_UNLOCK_QUOTE_COMMAND
      ? quote === null
        ? { errorCode: "unreadable", success: false }
        : { payload: quote, success: true }
      : { success: true },
  );
  act(() => {
    fixture.emit("rp1.available", true);
  });
  await waitFor(() => {
    expect(fixture.transport.isSubscribed("rp1.buildable")).toBe(true);
  });
  act(() => {
    fixture.emit("career.status", CAREER);
    fixture.emit("rp1.complexes", COMPLEXES);
    fixture.emit("rp1.warehouse", []);
    fixture.emit("rp1.buildQueue", []);
    fixture.emit("rp1.buildable", [TITAN]);
  });
  return { fixture, view };
}

describe("unlocking a craft's researched parts", () => {
  it("offers Unlock parts beside a Build that stays dark", async () => {
    await withTitan(CREDIT_COVERS);

    expect(
      await screen.findByRole("button", { name: /Unlock 2 researched parts/i }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /Build at LC-1/i }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("offers no unlock when a part still needs researching", async () => {
    const fixture = setupStreamFixture();
    render(
      <fixture.Provider>
        <WidgetHost widgetId="rp1-vehicle-assembly">
          <VehicleAssembly />
        </WidgetHost>
      </fixture.Provider>,
    );
    act(() => {
      fixture.emit("rp1.available", true);
    });
    await waitFor(() => {
      expect(fixture.transport.isSubscribed("rp1.buildable")).toBe(true);
    });
    act(() => {
      fixture.emit("rp1.complexes", COMPLEXES);
      fixture.emit("rp1.buildable", [{ ...TITAN, lockedParts: ["RO-Agena-8096"] }]);
    });

    await screen.findAllByRole("button", { name: /Build at/i });
    expect(
      screen.queryByRole("button", { name: /Unlock/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the price, the credit used and the funds to pay when credit covers everything", async () => {
    await withTitan(CREDIT_COVERS);

    const price = (await screen.findByText("Unlock price")).parentElement;
    expect(price).toHaveTextContent("18,400");
    expect(screen.getByText("Unlock credit used").parentElement).toHaveTextContent(
      "18,400",
    );
    expect(screen.getByText("Funds to pay").parentElement).toHaveTextContent("0");
    expect(screen.queryByText("SHORT")).not.toBeInTheDocument();
    expect(screen.getByText("Parts to unlock").parentElement).toHaveTextContent("2");
  });

  it("shows credit and funds both when credit covers part of the price", async () => {
    await withTitan(PARTIAL_CREDIT);

    await screen.findByText("Unlock price");
    expect(screen.getByText("Unlock credit used").parentElement).toHaveTextContent(
      "6,000",
    );
    expect(screen.getByText("Funds to pay").parentElement).toHaveTextContent(
      "12,400",
    );
  });

  it("does not repeat the balances the widget header already draws", async () => {
    await withTitan(PARTIAL_CREDIT);

    await screen.findByText("Unlock price");
    const text = visibleText(document.body);
    expect(text.match(/Funds 289,848/g)).toHaveLength(1);
    expect(text).not.toContain("Funds 289,848f Unlock credit 6,000");
    expect(text.match(/Unlock credit 6,000/g) ?? []).toHaveLength(0);
  });

  it("marks the funds SHORT and darkens the control with the shortfall when the funds cannot pay", async () => {
    await withTitan(FUNDS_SHORT);

    expect(await screen.findByText("SHORT")).toBeInTheDocument();
    const press = screen.getByRole("button", { name: /Unlock 2 researched parts/i });
    expect(press).toHaveAttribute("aria-disabled", "true");
    expect(press).toHaveAccessibleDescription("Short 8,400f");
  });

  it("draws the figures as unknown and still offers the press when RP-1 will not quote", async () => {
    await withTitan(null);

    await screen.findByText("Unlock price");
    expect(
      screen.getByRole("button", { name: /Unlock 2 researched parts/i }),
    ).toBeEnabled();
  });

  it("asks for the quote with the craft and the editor only", async () => {
    const { fixture } = await withTitan(CREDIT_COVERS);

    await screen.findByText("Unlock price");
    const quotes = fixture.transport.sentCommands.filter(
      (c) => c.command === RP1_PARTS_UNLOCK_QUOTE_COMMAND,
    );
    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.args).toEqual({ craftFile: "Titan-I", facility: 1 });
    expect(quotes[0]?.vantage).toBe("meta");
  });

  it("confirms with the credit alone when credit covers everything", async () => {
    await withTitan(CREDIT_COVERS);
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: /Unlock 2 researched parts/i }),
    );

    const confirm = await screen.findByRole("button", {
      name: /Confirm unlocking the parts of Titan-I/i,
    });
    expect(visibleText(confirm)).toBe("Spend 18,400f of credit");
  });

  it("confirms with the credit and the funds when both are spent", async () => {
    await withTitan(PARTIAL_CREDIT);
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: /Unlock 2 researched parts/i }),
    );

    const confirm = await screen.findByRole("button", {
      name: /Confirm unlocking the parts of Titan-I/i,
    });
    expect(visibleText(confirm)).toBe("Spend 6,000f of credit and 12,400f");
  });

  it("sends the craft and the editor when confirmed", async () => {
    const { fixture } = await withTitan(CREDIT_COVERS);
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: /Unlock 2 researched parts/i }),
    );
    await user.click(
      await screen.findByRole("button", { name: /Confirm unlocking the parts of Titan-I/i }),
    );

    await waitFor(() => {
      const sent = fixture.transport.sentCommands.find(
        (c) => c.command === RP1_PARTS_UNLOCK_COMMAND,
      );
      expect(sent?.args).toEqual({ craftFile: "Titan-I", facility: 1 });
    });
  });

  it("names each part once in the Build reason", async () => {
    await withTitan(CREDIT_COVERS);

    expect(
      (await screen.findByRole("button", { name: /Build at LC-1/i })),
    ).toHaveAccessibleDescription(
      "researched but not bought, unlock them first: LR87-AJ-3, LR91-AJ-3",
    );
  });

  it("has no accessibility violations", async () => {
    const { view } = await withTitan(PARTIAL_CREDIT);
    await screen.findByText("Unlock price");

    await expectNoA11yViolations(view.container);
  });
});
