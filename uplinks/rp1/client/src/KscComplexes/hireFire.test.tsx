import {
  act,
  screen,
  setupStreamFixture,
} from "@ksp-gonogo/sitrep-sdk/testing";
import {
  expectNoA11yViolations,
  renderWithRail as render,
} from "@ksp-gonogo/ui-kit/testing";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  RP1_PERSONNEL_FIRE_COMMAND,
  RP1_PERSONNEL_HIRE_COMMAND,
} from "./HireFire.js";
import { KscComplexes } from "./index.js";

const CAPE = {
  anyOperational: true,
  engineers: 30,
  isActive: true,
  kscDisplayName: "Cape Canaveral",
  kscName: "us_cape_canaveral",
  launchComplexCount: 1,
  unassignedEngineers: 6,
};

const VANDENBERG = {
  anyOperational: true,
  engineers: 8,
  isActive: false,
  kscName: "Vandenberg",
  launchComplexCount: 0,
  unassignedEngineers: 8,
};

const PERSONNEL = {
  applicants: 2,
  researchers: 31,
  totalEngineers: 38,
  hireCost: 300,
  engineerHireQuote: 300,
  researcherHireQuote: 300,
  pooledEngineerSalaryPerDay: 0.68,
  researcherSalaryPerHeadPerDay: 1.38,
  hireTarget: { active: false },
};

function mount(funds: number | null = 120_000) {
  const fixture = setupStreamFixture();
  const view = render(
    <fixture.Provider>
      <KscComplexes />
    </fixture.Provider>,
  );
  act(() => {
    fixture.emit("rp1.available", true);
    fixture.emit("rp1.centres", [CAPE, VANDENBERG]);
    fixture.emit("rp1.complexes", []);
    fixture.emit("rp1.pads", []);
    fixture.emit("rp1.personnel", PERSONNEL);
    if (funds !== null) {
      fixture.emit("career.status", { balances: { funds } });
    }
  });
  return { fixture, view };
}

async function open(user: ReturnType<typeof userEvent.setup>, count: string) {
  await user.click(
    await screen.findByRole("button", { name: "Hire or fire staff" }),
  );
  const input = await screen.findByLabelText("How many");
  await user.clear(input);
  await user.type(input, count);
}

function sent(
  fixture: ReturnType<typeof setupStreamFixture>,
  command: string,
) {
  return fixture.transport.sentCommands.find((c) => c.command === command)
    ?.args;
}

describe("hiring and firing now", () => {
  it("hires researchers with the applicant-netted cost against the balance and the salary it adds", async () => {
    const user = userEvent.setup();
    const { fixture, view } = mount();

    await open(user, "5");

    // Two applicants are free, so three are paid: 900f, not 1,500f.
    expect(view.container.textContent).toMatch(/900f( funds)? of 120,000f/);
    expect(view.container.textContent).toContain("2 free from applicants");
    expect(view.container.textContent).toMatch(/\+6\.9\s*f\/day( funds per day)? salary/);
    expect(view.container.textContent).toMatch(/no fee · -6\.9\s*f\/day( funds per day)? salary/);

    await user.click(
      await screen.findByRole("button", { name: "Hire 5 researchers" }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Confirm hiring 5 researchers",
      }),
    );

    expect(sent(fixture, RP1_PERSONNEL_HIRE_COMMAND)).toEqual({
      count: 5,
      research: true,
    });
    await expectNoA11yViolations(view.container);
  });

  it("hires and fires engineers at the active centre only, at the pooled rate", async () => {
    const user = userEvent.setup();
    const { fixture, view } = mount();

    await open(user, "4");
    await user.click(
      await screen.findByRole("checkbox", {
        name: "engineers at Cape Canaveral",
      }),
    );
    // No switch for a centre that is not active: RP-1 hires only there.
    expect(
      screen.queryByRole("checkbox", { name: "engineers at Vandenberg" }),
    ).toBeNull();
    expect(view.container.textContent).toMatch(/no fee · -2\.7\s*f\/day( funds per day)? salary/);

    await user.click(
      await screen.findByRole("button", {
        name: "Fire 4 engineers at Cape Canaveral",
      }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Confirm firing 4 engineers at Cape Canaveral",
      }),
    );

    expect(sent(fixture, RP1_PERSONNEL_FIRE_COMMAND)).toEqual({
      count: 4,
      kscName: "us_cape_canaveral",
      research: false,
    });
  });

  it("darkens Fire beyond the unassigned pool and says why", async () => {
    const user = userEvent.setup();
    const { view } = mount();

    await open(user, "7");
    await user.click(
      await screen.findByRole("checkbox", {
        name: "engineers at Cape Canaveral",
      }),
    );

    expect(
      screen.getByRole("button", {
        name: "Fire 7 engineers at Cape Canaveral",
      }),
    ).toBeDisabled();
    expect(view.container.textContent).toContain(
      "only 6 unassigned at Cape Canaveral can be fired",
    );
  });

  it("darkens Hire when the balance does not cover the one-off cost", async () => {
    const user = userEvent.setup();
    const { view } = mount(800);

    await open(user, "5");

    expect(
      screen.getByRole("button", { name: "Hire 5 researchers" }),
    ).toBeDisabled();
    expect(view.container.textContent).toContain("more than the balance");
    // Firing spends nothing, so a short balance leaves it alone.
    expect(
      screen.getByRole("button", { name: "Fire 5 researchers" }),
    ).toBeEnabled();
  });

  it("is absent on a save with no funding", () => {
    mount(null);

    expect(
      screen.queryByRole("button", { name: "Hire or fire staff" }),
    ).toBeNull();
  });
});
