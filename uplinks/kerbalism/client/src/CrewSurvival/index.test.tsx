import {
  act,
  render,
  screen,
  setupStreamFixture,
  within,
} from "@ksp-gonogo/sitrep-sdk/testing";
import {
  ContributionsProvider,
  WidgetMetaContext,
  WidgetMeters,
} from "@ksp-gonogo/ui-kit";
import { expectNoA11yViolations } from "@ksp-gonogo/ui-kit/testing";
import { afterEach, describe, expect, it } from "vitest";
import { KerbalismPresent } from "../test/kerbalismPresent.js";
// Importing the real module runs its module-load registerAugment(...) and,
// through `./meters`, the `crew-status.meters` registerContribution(...).
import { CrewSurvivalBadgeAugment } from "./index.js";

const CARRIED = ["vessel.crew", "kerbalism.crew", "comms.delay"];

const renderedTrees: Array<() => void> = [];

function newFixture() {
  const fixture = setupStreamFixture({
    carriedChannels: CARRIED,
    pinnedUt: 10,
  });
  // `useProcessor`'s dependency resolution reads straight off the
  // TimelineStore, it does not itself call `client.subscribe` the way
  // `useTelemetry`/`useStream` do (see ShipSystems/index.test.tsx's own doc
  // comment on this same gap). A dummy subscribe per topic flips
  // `StubTransport.emit`'s subscription gate the way a companion widget
  // reading the same topic would in production.
  for (const topic of CARRIED) fixture.subscribe(topic);
  return fixture;
}

/**
 * One roster row, wired the way CrewStatus wires it: the dashboard's widget
 * identity, the contribution aggregation, and ui-kit's `WidgetMeters` reading
 * the universal `crew-status.meters` segment for this kerbal.
 *
 * The survival meters used to be a React augment this file rendered directly.
 * They are DATA now, so a test that only called the compute function would
 * prove nothing about them reaching a row; this mounts the whole chain, so a
 * break anywhere along it shows up here.
 */
function CrewRow({ crewName }: { crewName: string }) {
  return (
    <WidgetMetaContext.Provider
      value={{ componentId: "crew-status", contributionSlots: [] }}
    >
      <KerbalismPresent>
        <ContributionsProvider>
          <WidgetMeters row={crewName} />
        </ContributionsProvider>
      </KerbalismPresent>
    </WidgetMetaContext.Provider>
  );
}

function renderMeters(
  fixture: ReturnType<typeof newFixture>,
  crewName: string,
) {
  const result = render(
    <fixture.Provider>
      <CrewRow crewName={crewName} />
    </fixture.Provider>,
  );
  renderedTrees.push(result.unmount);
  return result;
}

function renderBadgeAugment(
  fixture: ReturnType<typeof newFixture>,
  crewName: string,
  crewIndex: number,
) {
  const result = render(
    <fixture.Provider>
      <CrewSurvivalBadgeAugment crewName={crewName} crewIndex={crewIndex} />
    </fixture.Provider>,
  );
  renderedTrees.push(result.unmount);
  return result;
}

function emit(
  fixture: ReturnType<typeof newFixture>,
  crew: unknown,
  kerbals: unknown,
) {
  act(() => {
    fixture.emit("vessel.crew", crew);
    fixture.emit("kerbalism.crew", kerbals);
    fixture.emit("comms.delay", { oneWaySeconds: 0 });
  });
}

afterEach(() => {
  for (const unmount of renderedTrees) unmount();
  renderedTrees.length = 0;
});

const CREW = {
  count: 2,
  capacity: 2,
  crew: [
    { name: "Jebediah Kerman", trait: "Pilot" },
    { name: "Bill Kerman", trait: "Engineer" },
  ],
};

describe("crew-status.meters contribution", () => {
  it("renders nothing before any survival data has arrived", () => {
    const fixture = newFixture();
    renderMeters(fixture, "Jebediah Kerman");
    // No emit at all: useProcessor(CREW_SURVIVAL) has nothing to derive from
    // yet, the augment must render nothing rather than a "stable" default
    // for a kerbal it knows nothing about.
    expect(screen.queryByLabelText("meters")).not.toBeInTheDocument();
  });

  it("renders a single rule as a meter, no badge alongside it", async () => {
    const fixture = newFixture();
    renderMeters(fixture, "Jebediah Kerman");
    emit(fixture, CREW, [
      {
        name: "Jebediah Kerman",
        rules: [{ name: "radiation", problem: 45, fatalThreshold: 50 }],
      },
      {
        name: "Bill Kerman",
        rules: [{ name: "stress", problem: 0.05, fatalThreshold: 1 }],
      },
    ]);

    // "radiation" maps to the clearer "Radiation dose" label (see
    // ruleLabel's own doc comment).
    const meter = await screen.findByRole("meter", { name: "Radiation dose" });
    expect(meter).toHaveAttribute("aria-valuenow", "90");
    expect(meter.getAttribute("aria-valuetext")).toMatch(/^90\b/);
    // The `.survival` slot is meter-only now: no badge restating the same
    // rule name/percentage underneath it (that used to render literally as
    // "Radiation dose 90 %" text of its own, the exact redundant-restatement
    // bug this augment used to have; the consequence badge moved to
    // CrewSurvivalBadgeAugment, tested separately below).
    expect(screen.queryByText(/critical/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/radiation dose 90 %/i)).not.toBeInTheDocument();
  });

  it("renders every rule as its own meter, not just the worst", async () => {
    const fixture = newFixture();
    renderMeters(fixture, "Jebediah Kerman");
    emit(fixture, CREW, [
      {
        name: "Jebediah Kerman",
        rules: [
          { name: "radiation", problem: 45, fatalThreshold: 50 },
          { name: "stress", problem: 0.2, fatalThreshold: 1 },
        ],
      },
    ]);

    // Both meters present, worst (radiation dose, 90%) shown before stress
    // (20%): rules are sorted worst-first (processor.ts).
    const doseMeter = await screen.findByRole("meter", {
      name: "Radiation dose",
    });
    const stressMeter = await screen.findByRole("meter", { name: "Stress" });
    expect(doseMeter).toHaveAttribute("aria-valuenow", "90");
    expect(stressMeter).toHaveAttribute("aria-valuenow", "20");
    const meters = screen.getAllByRole("meter");
    expect(meters.indexOf(doseMeter)).toBeLessThan(meters.indexOf(stressMeter));
  });

  it("renders every rule unconditionally, no overflow disclosure", async () => {
    const fixture = newFixture();
    renderMeters(fixture, "Jebediah Kerman");
    emit(fixture, CREW, [
      {
        name: "Jebediah Kerman",
        rules: [
          { name: "radiation", problem: 45, fatalThreshold: 50 },
          { name: "stress", problem: 0.6, fatalThreshold: 1 },
          { name: "co2 poisoning", problem: 0.3, fatalThreshold: 1 },
          { name: "eating", problem: 0.2, fatalThreshold: 1 },
          { name: "drinking", problem: 0.15, fatalThreshold: 1 },
          { name: "breathing", problem: 0.1, fatalThreshold: 1 },
          { name: "climatization", problem: 0.05, fatalThreshold: 1 },
        ],
      },
    ]);

    // Every rule renders directly, unconditionally: no "Show N more" trigger
    // and nothing collapsed behind it.
    await screen.findByRole("meter", { name: "Radiation dose" });
    await screen.findByRole("meter", { name: "Stress" });
    expect(
      await screen.findByRole("meter", { name: "Co2 poisoning" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("meter", { name: "Eating" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("meter", { name: "Drinking" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("meter", { name: "Breathing" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("meter", { name: "Climatization" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /show.*more/i }),
    ).not.toBeInTheDocument();
  });

  it("renders nothing for a kerbal Kerbalism reports no rules or clock for", async () => {
    // Renders BOTH rows in one test: Jebediah's meter appearing is the proof
    // the Processor actually re-evaluated for THIS test's data (not a stale
    // value from a previous test), so Bill's absence right beside it is a
    // meaningful negative, not just "nothing has happened yet".
    const fixture = newFixture();
    const jeb = render(
      <fixture.Provider>
        <CrewRow crewName="Jebediah Kerman" />
      </fixture.Provider>,
    );
    const bill = render(
      <fixture.Provider>
        <CrewRow crewName="Bill Kerman" />
      </fixture.Provider>,
    );
    renderedTrees.push(jeb.unmount, bill.unmount);
    emit(fixture, CREW, [
      {
        name: "Jebediah Kerman",
        rules: [{ name: "radiation", problem: 45, fatalThreshold: 50 }],
      },
      // Bill has no entry at all.
    ]);

    await within(jeb.container).findByRole("meter", { name: "Radiation dose" });
    expect(
      within(bill.container).queryByLabelText("meters"),
    ).not.toBeInTheDocument();
  });

  it("addresses a row by NAME, so roster order cannot mis-attribute a meter", async () => {
    const fixture = newFixture();
    // Bill is second in the roster and the only kerbal Kerbalism reports on,
    // so his meter is entry 0 of the contribution and row 1 of the list. The
    // entry carries his name, so the two never have to agree: the augment this
    // replaced matched by index first and fell back to a name search when the
    // orders drifted, and that fallback is now unreachable by construction.
    renderMeters(fixture, "Bill Kerman");
    emit(fixture, CREW, [
      {
        name: "Bill Kerman",
        rules: [{ name: "stress", problem: 0.9, fatalThreshold: 1 }],
      },
    ]);
    expect(
      await screen.findByRole("meter", { name: "Stress" }),
    ).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const fixture = newFixture();
    const { container } = renderMeters(fixture, "Jebediah Kerman");
    emit(fixture, CREW, [
      {
        name: "Jebediah Kerman",
        rules: [{ name: "radiation", problem: 45, fatalThreshold: 50 }],
      },
    ]);
    await screen.findByRole("meter", { name: "Radiation dose" });

    await expectNoA11yViolations(container);
  });
});

describe("CrewSurvivalBadgeAugment", () => {
  it("shows no badge for a nominal kerbal", async () => {
    const fixture = newFixture();
    renderMeters(fixture, "Jebediah Kerman");
    renderBadgeAugment(fixture, "Jebediah Kerman", 0);
    emit(fixture, CREW, [
      {
        name: "Jebediah Kerman",
        rules: [{ name: "stress", problem: 0.1, fatalThreshold: 1 }],
      },
    ]);
    // The meter (from `.survival`) is the proof the Processor evaluated;
    // the badge's absence right beside it is the meaningful negative.
    await screen.findByRole("meter", { name: "Stress" });
    expect(screen.queryByText(/critical/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/to act/i)).not.toBeInTheDocument();
  });

  it("shows no badge for a merely-elevated (warn-tier) kerbal", async () => {
    const fixture = newFixture();
    renderMeters(fixture, "Jebediah Kerman");
    renderBadgeAugment(fixture, "Jebediah Kerman", 0);
    emit(fixture, CREW, [
      {
        name: "Jebediah Kerman",
        rules: [{ name: "stress", problem: 0.6, fatalThreshold: 1 }],
      },
    ]);
    // The meter (from `.survival`) is the proof the Processor evaluated;
    // the badge's absence right beside it is the meaningful negative, same
    // "prove data arrived, then assert a negative" pattern as the roster
    // test above.
    await screen.findByRole("meter", { name: "Stress" });
    expect(screen.queryByText(/critical/i)).not.toBeInTheDocument();
  });

  it("flags a rule past its critical fraction as a consequence, never a restated percentage", async () => {
    const fixture = newFixture();
    renderBadgeAugment(fixture, "Jebediah Kerman", 0);
    emit(fixture, CREW, [
      {
        name: "Jebediah Kerman",
        rules: [{ name: "radiation", problem: 45, fatalThreshold: 50 }],
      },
    ]);
    expect(
      await screen.findByText("Radiation dose critical"),
    ).toBeInTheDocument();
    // The bug this augment fixes: a badge that just restates the meter's
    // own number ("radiation dose 90%") instead of the consequence.
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/90/)).not.toBeInTheDocument();
  });

  it("flags an imminent death clock as the margin left to act", async () => {
    const fixture = newFixture();
    renderBadgeAugment(fixture, "Jebediah Kerman", 0);
    emit(fixture, CREW, [{ name: "Jebediah Kerman", deathClockUt: 130 }]);
    // The whole caption, not just "to act": the badge's job is to say HOW
    // LONG, and an assertion on the trailing words alone passes just as
    // happily with the duration missing. 130 UT against the fixture's pinned
    // view time of 10 is 120 seconds, which the composite time ladder reads
    // as "2min" (no unit symbol beside it: the ladder interleaves its own).
    const badge = await screen.findByText(/to act/i);
    expect(badge.textContent).toBe("~2min to act");
  });

  it("has no axe violations when flagging a critical kerbal", async () => {
    const fixture = newFixture();
    const { container } = renderBadgeAugment(fixture, "Jebediah Kerman", 0);
    emit(fixture, CREW, [
      {
        name: "Jebediah Kerman",
        rules: [{ name: "radiation", problem: 45, fatalThreshold: 50 }],
      },
    ]);
    await screen.findByText("Radiation dose critical");

    await expectNoA11yViolations(container);
  });
});

describe("CrewSurvivalBadgeAugment under signal delay", () => {
  const OWLT = 60;
  /** Frames that left the craft one light time before its present of UT 1000, so the received edge is UT 940. */
  const RECEIVED_UT = 1000 - OWLT;

  /** Crew frames stamped at each of `stamps`, Jebediah's radiation climbing between them, with his death clock at `deathClockUt`. */
  function mountDelayed(
    deathClockUt: number,
    stamps: number[] = [RECEIVED_UT],
  ) {
    const fixture = setupStreamFixture({
      carriedChannels: CARRIED,
      delaySeconds: OWLT,
    });
    for (const topic of CARRIED) fixture.subscribe(topic);
    const { container } = renderBadgeAugment(fixture, "Jebediah Kerman", 0);
    act(() => {
      stamps.forEach((stamp, i) => {
        const meta = { validAt: stamp, deliveredAt: stamp + OWLT };
        fixture.emit("vessel.crew", CREW, meta);
        fixture.emit(
          "kerbalism.crew",
          [
            {
              name: "Jebediah Kerman",
              rulesAsOfKerbalismUt: stamp,
              rules: [
                { name: "radiation", fatalThreshold: 50, problem: 10 + i },
              ],
              deathClockUt,
            },
          ],
          meta,
        );
        fixture.emit("comms.delay", { oneWaySeconds: OWLT }, meta);
      });
    });
    return container;
  }

  it("measures the margin from the received edge, less the light time a command crosses", async () => {
    // Received at 940, a death at 1300 is 360 s out, and a command crossing 60 s leaves five minutes.
    const container = mountDelayed(1300);
    const badge = await screen.findByText(/to act/i);
    expect(badge.textContent).toBe("~5min to act");
    // One frame is no trend, so the crew model declines and nothing is drawn for the craft's present.
    expect(container.querySelector("[data-modelled-alongside]")).toBeNull();
  });

  it("draws the model's margin from the craft's present beside it, marked", async () => {
    // Carried to the craft's present of 1000, the same death leaves four minutes.
    const container = mountDelayed(1300, [RECEIVED_UT - 60, RECEIVED_UT]);
    const badge = await screen.findByText(/to act/i);
    expect(badge.textContent).toMatch(/^~5min to act/);
    const modelled = container.querySelector("[data-modelled-alongside]");
    expect(modelled?.textContent).toMatch(/^~4min/);
    expect(modelled?.querySelector("[data-held-mark]")).not.toBeNull();
  });

  it("says too late once a command would land after the deadline", async () => {
    mountDelayed(RECEIVED_UT + 30);
    expect(await screen.findByText("too late")).toBeInTheDocument();
  });
});
