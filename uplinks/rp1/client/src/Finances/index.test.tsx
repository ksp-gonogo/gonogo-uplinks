import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  render,
  screen,
  setupStreamFixture,
  waitFor,
  within,
} from "@ksp-gonogo/sitrep-sdk/testing";
import {
  expectNoA11yViolations,
  visibleText,
} from "@ksp-gonogo/ui-kit/testing";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  FINANCES_SCREEN,
  FINANCES_SCREEN_ID,
} from "../AdminBuilding/financesScreen.js";
import {
  PROGRAMS_SCREEN_ID,
  RP1_ADMIN_SCREENS,
} from "../AdminBuilding/programsScreen.js";
import { Finances } from "./index.js";

const HERE = dirname(fileURLToPath(import.meta.url));

function payload(file: string) {
  return (
    JSON.parse(
      readFileSync(join(HERE, "..", "__testdata__", file), "utf8"),
    ) as { payload: Record<string, unknown> }
  ).payload;
}

const BUDGET = payload("rp1-budget.json");
const BREAKDOWN = payload("rp1-budget-breakdown.json");

function mount(screenId: string = FINANCES_SCREEN_ID) {
  const fixture = setupStreamFixture();
  const view = render(
    <fixture.Provider>
      <Finances screenId={screenId} />
    </fixture.Provider>,
  );
  return { fixture, view };
}

async function feed(
  fixture: ReturnType<typeof setupStreamFixture>,
  budget: Record<string, unknown> = BUDGET,
  breakdown: Record<string, unknown> = BREAKDOWN,
) {
  fixture.emit("rp1.available", true);
  fixture.emit("rp1.budget", budget);
  fixture.emit("rp1.budgetBreakdown", breakdown);
  fixture.emit("rp1.training", []);
  fixture.emit("rp1.research", []);
  await waitFor(() => {
    expect(screen.getByText("FUNDS CHANGE")).toBeInTheDocument();
  });
}

function budgetRow(label: string) {
  const header = screen.getByRole("rowheader", { name: label });
  return header.closest("tr") as HTMLElement;
}

describe("Finances screen", () => {
  it("names no departments, so the host lists no strategies on it", () => {
    expect(FINANCES_SCREEN[0].id).toBe(FINANCES_SCREEN_ID);
    expect(FINANCES_SCREEN[0].label).toBe("Finances");
    expect("departments" in FINANCES_SCREEN[0]).toBe(false);
    expect(Object.isFrozen(FINANCES_SCREEN)).toBe(true);
    expect(Object.isFrozen(FINANCES_SCREEN[0])).toBe(true);
  });

  it("is contributed after Programs, in the same frozen entry list", () => {
    expect(RP1_ADMIN_SCREENS.map((screen) => screen.id)).toEqual([
      PROGRAMS_SCREEN_ID,
      FINANCES_SCREEN_ID,
    ]);
    expect(Object.isFrozen(RP1_ADMIN_SCREENS)).toBe(true);
  });
});

describe("Finances", () => {
  it("draws nothing on another screen of the building", async () => {
    const { fixture, view } = mount(PROGRAMS_SCREEN_ID);
    fixture.emit("rp1.available", true);
    fixture.emit("rp1.budget", BUDGET);
    await waitFor(() => {
      expect(fixture.transport.isSubscribed("rp1.budget")).toBe(true);
    });
    expect(view.container).toBeEmptyDOMElement();
  });

  it("draws nothing until RP-1 says it is there", async () => {
    const { fixture, view } = mount();
    fixture.emit("rp1.available", false);
    await waitFor(() => {
      expect(fixture.transport.isSubscribed("rp1.available")).toBe(true);
    });
    expect(view.container).toBeEmptyDOMElement();
  });

  it("says so when RP-1 has sent no budget", async () => {
    const { fixture } = mount();
    fixture.emit("rp1.available", true);
    await waitFor(() => {
      expect(
        screen.getByText("RP-1 has not sent a budget"),
      ).toBeInTheDocument();
    });
  });

  it("names RP-1's net as a gain or a drain rather than signing it", async () => {
    const { fixture } = mount();
    await feed(fixture, {
      ...BUDGET,
      day: { ...(BUDGET.day as object), fundsDelta: -1000 },
    });

    const day = screen.getByText("Day", { selector: "dt" }).closest("dl") as HTMLElement;
    expect(within(day).getByText("Drain")).toBeInTheDocument();
    expect(day.textContent).not.toContain("-");
    const year = screen.getByText("Year", { selector: "dt" }).closest(
      "dl",
    ) as HTMLElement;
    expect(within(year).getByText("Gain")).toBeInTheDocument();
    expect(year.textContent).toContain("2,719,050");
  });

  it("prints a cost in parentheses and a gain with a plus, as RP-1 does", async () => {
    const { fixture } = mount();
    await feed(fixture);

    const facilities = budgetRow("Facilities").textContent ?? "";
    expect(facilities).toMatch(/\(3,100[^)]*\)/);
    expect(facilities).not.toContain("-");
    expect(budgetRow("Program Budget").textContent).toMatch(/\+9,500/);
  });

  it("carries all eleven of RP-1's rows in its order", async () => {
    const { fixture } = mount();
    await feed(fixture);

    const labels = screen
      .getAllByRole("rowheader")
      .map((cell) => cell.textContent)
      .slice(0, 11);
    expect(labels).toEqual([
      "Facilities",
      "Integration Teams",
      "Research Teams",
      "Astronauts",
      "Avg. Subsidy",
      "Net (after subsidy)",
      "Rollout / Airlaunch Prep",
      "Constructions",
      "Program Budget",
      "Balance",
      "Unlock Credit",
    ]);
  });

  it("shows the subsidy the clamp withheld only when it bit, and never as income", async () => {
    const { fixture } = mount();
    await feed(fixture);
    expect(
      screen.queryByRole("rowheader", { name: "Unused subsidy" }),
    ).toBeNull();

    fixture.emit("rp1.budget", {
      ...BUDGET,
      day: {
        ...(BUDGET.day as object),
        subsidy: 9000,
        net: 0,
      },
    });
    await waitFor(() => {
      expect(
        screen.getByRole("rowheader", { name: "Unused subsidy" }),
      ).toBeInTheDocument();
    });
    const unused = budgetRow("Unused subsidy").textContent ?? "";
    expect(unused).toContain("1,200");
    expect(unused).not.toContain("+");
  });

  it("opens the lines under Facilities from the breakdown", async () => {
    const { fixture } = mount();
    await feed(fixture);

    await userEvent.click(
      screen.getByRole("button", { name: /4 buildings, 3 complexes/ }),
    );
    expect(screen.getByText("Tracking Station")).toBeInTheDocument();
    expect(screen.getByText("LC-14")).toBeInTheDocument();
    expect(screen.getByText("UNDER CONSTRUCTION")).toBeInTheDocument();
  });

  it("names a running Program by the title and deadline the breakdown carries", async () => {
    const { fixture } = mount();
    await feed(fixture);

    await userEvent.click(screen.getByRole("button", { name: /2 Programs/ }));
    const row = screen.getByRole("rowheader", { name: /Early Satellites/ });
    expect(row.textContent).toMatch(/deadline/);
    expect(
      screen.getByRole("rowheader", { name: /Suborbital Human Spaceflight/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/SuborbitalHSF/)).toBeNull();
  });

  it("falls back to a Program's id when the breakdown carries no title", async () => {
    const { fixture } = mount();
    const programs = (BREAKDOWN.programs as Record<string, unknown>[]).map(
      ({ title: _title, deadlineUt: _deadline, ...rest }) => rest,
    );
    await feed(fixture, BUDGET, { ...BREAKDOWN, programs });

    await userEvent.click(screen.getByRole("button", { name: /2 Programs/ }));
    const row = screen.getByRole("rowheader", { name: "SuborbitalHSF" });
    expect(row.textContent).not.toMatch(/deadline/);
  });

  it("names each complex's centre once there is more than one", async () => {
    const { fixture } = mount();
    const complexes = BREAKDOWN.complexes as Record<string, unknown>[];
    await feed(fixture, BUDGET, {
      ...BREAKDOWN,
      complexes: [
        ...complexes,
        {
          ...complexes[0],
          lcId: "baikonur-lc-1",
          name: "LC-1",
          kscName: "ru_baikonur",
          kscDisplayName: null,
        },
      ],
    });

    await userEvent.click(
      screen.getByRole("button", { name: /4 buildings, 4 complexes/ }),
    );
    expect(
      screen.getByRole("rowheader", { name: "LC-5 · US - Cape Canaveral" }),
    ).toBeInTheDocument();
    // No display name from KSCSwitcher: the id, as RP-1's own tab falls back.
    expect(
      screen.getByRole("rowheader", { name: "LC-1 · ru_baikonur" }),
    ).toBeInTheDocument();
  });

  it("marks a zero accrual with an idle research queue", async () => {
    const { fixture } = mount();
    await feed(fixture, {
      ...BUDGET,
      day: { ...(BUDGET.day as object), unlockCredit: 0 },
    });
    expect(screen.getByText("research queue idle")).toBeInTheDocument();
  });

  it("does not mark the accrual idle while research runs", async () => {
    const { fixture } = mount();
    await feed(fixture);
    expect(screen.queryByText("research queue idle")).toBeNull();
  });

  it("forecasts each whole year to five", async () => {
    const { fixture } = mount();
    await feed(fixture);

    const table = screen.getByRole("table", { name: "RP-1 funds forecast" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.querySelector("th")?.textContent)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
    expect(rows[4].textContent).toContain("4,426,594");
  });

  it("draws no funds balance of its own", async () => {
    const { fixture } = mount();
    await feed(fixture);
    expect(visibleText()).not.toMatch(/Funds balance|Available funds/i);
  });

  it("has no accessibility violations", async () => {
    const { fixture, view } = mount();
    await feed(fixture);
    await expectNoA11yViolations(view.container);
  });
});
