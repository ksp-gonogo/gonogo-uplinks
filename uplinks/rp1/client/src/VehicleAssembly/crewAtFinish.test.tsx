import {
  act,
  render,
  screen,
  setupStreamFixture,
  waitFor,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { WidgetHost } from "@ksp-gonogo/ui-kit/testing";
import { describe, expect, it } from "vitest";
import { crewAtFinish } from "./crewAtFinish.js";
import { VehicleAssembly } from "./index.js";

const FINISH = 5_000_000;

function kerbal(overrides: Record<string, unknown> = {}) {
  return {
    name: "Valentina Kerman",
    nextTrainingExpiryUt: FINISH + 1_000,
    retired: false,
    trainingExpiryCount: 1,
    ...overrides,
  };
}

describe("crew trained and free when a vehicle finishes", () => {
  it("counts a kerbal whose training outlasts the integration", () => {
    expect(crewAtFinish([kerbal()] as never, FINISH)).toEqual({
      free: 1,
      trained: 1,
    });
  });

  it("does not count a kerbal whose training lapses first", () => {
    expect(
      crewAtFinish(
        [kerbal({ nextTrainingExpiryUt: FINISH - 1 })] as never,
        FINISH,
      ),
    ).toEqual({ free: 0, trained: 1 });
  });

  it("does not count a kerbal still in a course at the finish, or one whose course has not begun", () => {
    const crew = [
      kerbal({ trainingCourse: "Mission", trainingFinishesAtUt: FINISH + 5 }),
      kerbal({ trainingCourse: "Mission", trainingFinishesAtUt: null }),
      kerbal({ trainingCourse: "Mission", trainingFinishesAtUt: FINISH - 5 }),
    ];

    expect(crewAtFinish(crew as never, FINISH)).toEqual({
      free: 1,
      trained: 3,
    });
  });

  it("leaves out retirees and kerbals with no mission training", () => {
    const crew = [
      kerbal({ retired: true }),
      kerbal({ trainingExpiryCount: 0 }),
      kerbal({ retiresAtUt: FINISH - 1 }),
    ];

    expect(crewAtFinish(crew as never, FINISH)).toEqual({
      free: 0,
      trained: 1,
    });
  });
});

describe("the crew line on a vehicle being integrated", () => {
  async function mountWith(crew: unknown[], timeLeftSeconds = 375) {
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
      expect(fixture.transport.isSubscribed("rp1.buildQueue")).toBe(true);
    });
    act(() => {
      fixture.emit("career.status", { balances: { funds: 1000 } });
      fixture.emit("rp1.complexes", [
        { engineers: 4, isOperational: true, lcId: "lc-1", name: "LC-1" },
      ]);
      fixture.emit("rp1.pads", []);
      fixture.emit("rp1.operations", []);
      fixture.emit("rp1.warehouse", []);
      fixture.emit("rp1.buildQueue", [
        {
          cost: 40_000,
          id: "vp-1",
          lcId: "lc-1",
          progress: 250,
          progressRatio: 0.25,
          rate: 2,
          shipId: "ship-1",
          shipName: "Atlas",
          stalled: false,
          timeLeftSeconds,
          totalPoints: 1000,
        },
      ]);
    });
    await screen.findByText("Atlas");
    await waitFor(() => {
      expect(fixture.transport.isSubscribed("rp1.crew")).toBe(true);
    });
    act(() => {
      fixture.emit("rp1.crew", crew);
    });
    await act(async () => {});
  }

  it("counts none free when the only trained kerbal lapses first", async () => {
    await mountWith([kerbal({ nextTrainingExpiryUt: 1 })]);

    expect(
      await screen.findByText("0/1"),
    ).toBeInTheDocument();
  });

  it("says how many of the trained crew would be free", async () => {
    await mountWith([kerbal(), kerbal({ name: "Bob", retired: false, nextTrainingExpiryUt: 1 })]);

    expect(
      await screen.findByText("1/2"),
    ).toBeInTheDocument();
  });

  it("draws nothing when no kerbal holds mission training", async () => {
    await mountWith([kerbal({ trainingExpiryCount: 0 })]);

    expect(screen.queryByText("Crew free")).not.toBeInTheDocument();
  });
});
