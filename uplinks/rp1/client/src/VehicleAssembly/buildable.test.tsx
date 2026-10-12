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
  RP1_BUILD_QUOTE_COMMAND,
  RP1_BUILD_START_COMMAND,
} from "./Buildable.js";
import { VehicleAssembly } from "./index.js";

const CAREER = {
  balances: { funds: 289_848, reputation: 40, science: 12 },
};

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

/**
 * One saved craft as the wire carries it, whole and buildable at LC-1.
 *
 * <para>Every key present, including the empty part arrays: an absent array and
 * an empty one mean different things to this widget, and a fixture that left
 * them out would exercise only the absent branch.</para>
 */
function craft(overrides: Record<string, unknown> = {}) {
  return {
    complexes: [
      {
        eligible: true,
        kscName: "Cape",
        lcId: "lc-1",
        name: "LC-1",
        refusals: [],
      },
    ],
    craftFile: "Atlas LV-3B",
    facility: 1,
    lockedParts: [],
    mass: 120,
    missingParts: [],
    partCount: 42,
    shipName: "Atlas LV-3B",
    unpurchasedParts: [],
    ...overrides,
  };
}

function mount() {
  const fixture = setupStreamFixture();
  const view = render(
    <fixture.Provider>
      <WidgetHost widgetId="rp1-vehicle-assembly">
        <VehicleAssembly />
      </WidgetHost>
    </fixture.Provider>,
  );
  return { fixture, view };
}

/**
 * RP-1's presence gate, and the wait for what it mounts to reach the wire.
 * Waited on the subscription rather than on anything drawn, for the reason the
 * widget's own suite gives at length: the sections draw nothing until their
 * lists arrive, so there is no mark on screen that says the subscription is
 * open.
 */
async function rp1IsPresent(fixture: ReturnType<typeof setupStreamFixture>) {
  act(() => {
    fixture.emit("rp1.available", true);
  });
  await waitFor(() => {
    expect(fixture.transport.isSubscribed("rp1.buildable")).toBe(true);
  });
}

/** What RP-1 quotes for the craft above: 40,000 funds, against the career's 289,848. */
const QUOTE = { affordable: true, balance: 289_848, price: 40_000 };

/**
 * A career with one saved craft and one complex that would take it, whose
 * quote RP-1 answers with `quote` unless the test says otherwise. `null` makes
 * RP-1 refuse the quote, which is what a craft RP-1 will not price looks like.
 */
async function withOneSavedCraft(
  overrides: Record<string, unknown> = {},
  quote: Record<string, unknown> | null = QUOTE,
) {
  const mounted = mount();
  mounted.fixture.transport.setCommandHandler((command) =>
    command === RP1_BUILD_QUOTE_COMMAND
      ? quote === null
        ? { errorCode: "unreadable", success: false }
        : { payload: quote, success: true }
      : { success: true },
  );
  await rp1IsPresent(mounted.fixture);
  act(() => {
    mounted.fixture.emit("career.status", CAREER);
    mounted.fixture.emit("rp1.complexes", COMPLEXES);
    mounted.fixture.emit("rp1.warehouse", []);
    mounted.fixture.emit("rp1.buildQueue", []);
    mounted.fixture.emit("rp1.buildable", [craft(overrides)]);
  });
  return mounted;
}

describe("starting a build from a saved craft", () => {
  it("offers a build control for a craft the space centre has never held", async () => {
    /*
     * The whole point of the section: an empty career could watch RP-1 and
     * could not start anything in it, because the only build command copied a
     * vehicle that already existed.
     */
    await withOneSavedCraft();

    expect(await screen.findByText("START A BUILD")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", {
        name: /Start building Atlas LV-3B at LC-1/i,
      }),
    ).toBeInTheDocument();
  });

  it("says RP-1 prices the build when it is started until a quote arrives", async () => {
    /*
     * RP-1 charges a vehicle's whole price in funds at the press, so before a
     * quote lands the card says that instead of showing nothing.
     */
    const mounted = mount();
    mounted.fixture.transport.holdCommands();
    await rp1IsPresent(mounted.fixture);
    act(() => {
      mounted.fixture.emit("career.status", CAREER);
      mounted.fixture.emit("rp1.complexes", COMPLEXES);
      mounted.fixture.emit("rp1.warehouse", []);
      mounted.fixture.emit("rp1.buildQueue", []);
      mounted.fixture.emit("rp1.buildable", [craft()]);
    });

    expect(
      await screen.findByText(/Priced by RP-1 when started, charged up front/i),
    ).toBeInTheDocument();
  });

  it("shows RP-1's own price beside Start build once it is quoted", async () => {
    await withOneSavedCraft();

    const price = await screen.findByText(/Costs/);
    expect(price).toHaveTextContent("40,000");
    expect(
      screen.queryByText(/Priced by RP-1 when started/i),
    ).not.toBeInTheDocument();
  });

  it("asks for the quote with the craft, the editor and the complex, from the space program", async () => {
    const { fixture } = await withOneSavedCraft();

    await screen.findByText(/Costs/);
    const sent = fixture.transport.sentCommands.filter(
      (c) => c.command === RP1_BUILD_QUOTE_COMMAND,
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]?.args).toEqual({
      craftFile: "Atlas LV-3B",
      facility: 1,
      lcId: "lc-1",
    });
    expect(sent[0]?.vantage).toBe("meta");
  });

  it("asks once for a craft however often the listing is re-sent", async () => {
    const { fixture } = await withOneSavedCraft();
    await screen.findByText(/Costs/);

    act(() => {
      fixture.emit("rp1.buildable", [craft()]);
      fixture.emit("rp1.buildable", [craft()]);
    });
    await act(async () => {});

    expect(
      fixture.transport.sentCommands.filter(
        (c) => c.command === RP1_BUILD_QUOTE_COMMAND,
      ),
    ).toHaveLength(1);
  });

  it("asks again when the craft file was saved over", async () => {
    const { fixture } = await withOneSavedCraft();
    await screen.findByText(/Costs/);

    act(() => {
      fixture.emit("rp1.buildable", [craft({ mass: 150, partCount: 51 })]);
    });

    await waitFor(() => {
      expect(
        fixture.transport.sentCommands.filter(
          (c) => c.command === RP1_BUILD_QUOTE_COMMAND,
        ),
      ).toHaveLength(2);
    });
  });

  it("says the career cannot afford it once its funds fall short, since RP-1 refuses up front", async () => {
    const { fixture } = await withOneSavedCraft();
    await screen.findByText(/Costs/);
    expect(screen.queryByText(/Cannot afford/)).not.toBeInTheDocument();

    act(() => {
      fixture.emit("career.status", {
        balances: { funds: 1_000, reputation: 40, science: 12 },
      });
    });

    expect(await screen.findByText(/Cannot afford/)).toBeInTheDocument();
  });

  it("keeps the plain fact when RP-1 will not quote the craft", async () => {
    await withOneSavedCraft({}, null);
    await act(async () => {});

    expect(
      await screen.findByText(/Priced by RP-1 when started, charged up front/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Costs/)).not.toBeInTheDocument();
  });

  it("asks no quote for a craft that cannot be built", async () => {
    const { fixture } = await withOneSavedCraft({ missingParts: ["fooPart"] });

    await screen.findByText(/Cannot be built/i);
    await act(async () => {});

    expect(
      fixture.transport.sentCommands.filter(
        (c) => c.command === RP1_BUILD_QUOTE_COMMAND,
      ),
    ).toHaveLength(0);
  });

  it("dispatches the craft file, the editor and the complex that was pressed", async () => {
    const { fixture } = await withOneSavedCraft();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", {
        name: /Start building Atlas LV-3B at LC-1/i,
      }),
    );
    // Arms before it commits, like every other spend control in this widget.
    await user.click(
      await screen.findByRole("button", {
        name: /Confirm starting Atlas LV-3B/i,
      }),
    );

    await waitFor(() => {
      const sent = fixture.transport.sentCommands.find(
        (c) => c.command === RP1_BUILD_START_COMMAND,
      );
      /*
       * All three on the wire, and the complex among them even though only one
       * could have been meant: the mod REQUIRES it, so the dispatch records
       * which complex was chosen rather than leaving it to be inferred.
       */
      expect(sent?.args).toEqual({
        craftFile: "Atlas LV-3B",
        facility: 1,
        lcId: "lc-1",
      });
    });
  });

  it("keeps the quoted price on screen while the confirm is armed", async () => {
    await withOneSavedCraft();
    const user = userEvent.setup();
    await screen.findByText(/Costs/);

    await user.click(
      await screen.findByRole("button", {
        name: /Start building Atlas LV-3B at LC-1/i,
      }),
    );

    const text = visibleText(document.body);
    expect(text).toContain("289,848");
    expect(text).toContain("40,000");
  });

  it("draws no control and gives the reason when no complex would take the craft", async () => {
    await withOneSavedCraft({
      complexes: [
        {
          eligible: false,
          kscName: "Cape",
          lcId: "lc-1",
          name: "LC-1",
          refusals: ["too heavy for the complex at 2,900.0 t, limit 180.0 t"],
        },
      ],
    });

    /* The complex still appears, as a dead button carrying its reason, and no
       LIVE control exists. Both halves matter: an operator has to see that the
       complex was considered and refused, and must not be able to press it. */
    const refused = await screen.findByRole("button", {
      name: /Build at LC-1/i,
    });
    expect(refused).toBeDisabled();
    expect(refused).toHaveAccessibleDescription(
      expect.stringContaining("too heavy"),
    );
    expect(
      screen.queryByRole("button", { name: /Start building/i }),
    ).not.toBeInTheDocument();
  });

  it("gives a complex's reason even when another complex would take the craft", async () => {
    // A list that only showed the complexes saying yes would leave an operator
    // pressing the one button they have and never learning why there is one.
    await withOneSavedCraft({
      complexes: [
        {
          eligible: true,
          kscName: "Cape",
          lcId: "lc-1",
          name: "LC-1",
          refusals: [],
        },
        {
          eligible: false,
          kscName: "Cape",
          lcId: "lc-2",
          name: "LC-2",
          refusals: ["too large for the complex on its y axis"],
        },
      ],
    });

    expect(
      await screen.findByRole("button", {
        name: /Start building Atlas LV-3B at LC-1/i,
      }),
    ).toBeInTheDocument();
    /* The refused complex is a DEAD BUTTON carrying its reason in the title,
       not a line of prose. Asserted by role and title rather than by text,
       because the reason no longer occupies the page until it is wanted. */
    const refused = screen.getByRole("button", { name: /Build at LC-2/i });
    expect(refused).toBeDisabled();
    expect(refused).toHaveAccessibleDescription(
      expect.stringContaining("too large"),
    );
    /* The two are ONE control in two states, so the complex an operator cannot
       press is not drawn louder than the one they can: the kit's `Button`,
       which used to carry the refusal, is a font size larger and uppercase.
       `data-command-phase` is what reverting to one would lose.

       The names are pinned on both, because merging the controls is where they
       would quietly move: the live one names the act and the craft, and the
       refused one keeps the complex label it announced as a disabled
       `Button`. */
    expect(refused).toHaveAttribute("data-command-phase", "idle");
    expect(refused).toHaveAccessibleName("Build at LC-2");
    expect(
      screen.getByRole("button", { name: /Start building/i }),
    ).toHaveAccessibleName("Start building Atlas LV-3B at LC-1 at Cape");
  });

  it("refuses a craft whose parts are researched but not bought, and says where to buy them", async () => {
    /*
     * RP-1's own window offers to spend the funds through a popup, which a
     * command dispatched from another machine has nobody to answer, so the
     * remedy is named instead of taken.
     */
    await withOneSavedCraft({ unpurchasedParts: ["RO-Vanguard-X405"] });

    expect(
      await screen.findByText(/researched but not bought, unlock at R&D first/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Start building/i }),
    ).not.toBeInTheDocument();
  });

  it("separates a part this install lacks from a part that is merely unresearched", async () => {
    const { fixture } = await withOneSavedCraft({
      missingParts: ["RO-Atlas-LR89"],
    });

    expect(
      await screen.findByText(/this install does not have RO-Atlas-LR89/),
    ).toBeInTheDocument();

    act(() => {
      fixture.emit("rp1.buildable", [
        craft({ lockedParts: ["RO-Agena-8096"], missingParts: [] }),
      ]);
    });

    expect(
      await screen.findByText(/not researched yet: RO-Agena-8096/),
    ).toBeInTheDocument();
  });

  it("says the career has no craft rather than drawing nothing", async () => {
    // An empty list and a channel that has not answered look identical if this
    // is left out, and only one of them is something an operator can act on.
    const mounted = mount();
    await rp1IsPresent(mounted.fixture);
    act(() => {
      mounted.fixture.emit("career.status", CAREER);
      mounted.fixture.emit("rp1.complexes", COMPLEXES);
      mounted.fixture.emit("rp1.buildable", []);
    });

    expect(await screen.findByText(/No craft saved/)).toBeInTheDocument();
  });

  it("says it is waiting when RP-1 is present and the craft listing has not landed", async () => {
    const mounted = mount();
    await rp1IsPresent(mounted.fixture);
    act(() => {
      mounted.fixture.emit("career.status", CAREER);
      mounted.fixture.emit("rp1.complexes", COMPLEXES);
    });

    expect(
      await screen.findByText(/waiting for the craft listing/i),
    ).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { view } = await withOneSavedCraft();
    await screen.findByText("START A BUILD");

    await expectNoA11yViolations(view.container);
  });
});
