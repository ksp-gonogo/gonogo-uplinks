import { act, screen, setupStreamFixture, waitFor } from "@ksp-gonogo/sitrep-sdk/testing";
import { renderWithRail as render, visibleText } from "@ksp-gonogo/ui-kit/testing";
import { describe, expect, it } from "vitest";
import { axe } from "../test/axe.js";
import { LastKnownPathRow } from "./LastKnownPath.js";

const VIEW_UT = 10_000;

const solved = {
  solved: true,
  seededAtUt: VIEW_UT - 40,
  vantage: "home",
  path: {
    solved: true,
    kind: 2,
    centreBodyIndex: 1,
    reachedUt: VIEW_UT + 3600,
    states: [0, 1, 2].map((i) => ({
      ut: VIEW_UT - 40 + i * 1800,
      x: 700000 * Math.cos(i),
      y: 700000 * Math.sin(i),
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
    })),
  },
};

function mount(answer: unknown) {
  const stream = setupStreamFixture({ pinnedUt: VIEW_UT });
  const asked: unknown[] = [];
  stream.transport.setCommandHandler((command, args) => {
    if (command === "vessel.trajectory.fromLastKnown") {
      asked.push(args);
    }
    return answer;
  });
  const result = render(
    <stream.Provider>
      <LastKnownPathRow viewUt={VIEW_UT} />
    </stream.Provider>,
  );
  return { container: result.container, asked, emit: stream.emit };
}

async function press() {
  await act(async () => {
    screen.getByRole("button", { name: /PLOT NEXT HOUR FROM HERE/i }).click();
  });
  await act(async () => {});
}

describe("the flight plan's plot from the last known state", () => {
  it("asks for the accurate answer an hour past the view and draws what comes back, saying how old its start is", async () => {
    const { container, asked } = mount(solved);
    await press();

    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({ certification: 2 });
    expect(container.querySelector("[data-last-known-path] polyline")).not.toBeNull();
    expect(visibleText(container)).toContain("COMPUTED FROM STATE OF");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("takes the plot away and disables the press once forecasts have stopped", async () => {
    const { container, emit } = mount(solved);
    await press();
    expect(container.querySelector("[data-last-known-path]")).not.toBeNull();

    act(() => {
      emit("system.uplinks", {
        uplinks: [
          {
            id: "principia",
            version: "1.0.0",
            available: true,
            reason: null,
            ownedPrefixes: [],
            health: {
              state: 1,
              detail: "Forecasts stopped.",
              facts: [{ label: "forecasts", value: "stopped" }],
            },
          },
        ],
      }, { validAt: VIEW_UT });
    });
    await waitFor(() =>
      expect(container.querySelector("[data-last-known-path]")).toBeNull(),
    );
    const button = screen.getByRole("button", { name: /PLOT NEXT HOUR FROM HERE/i });
    expect(button.getAttribute("aria-disabled") === "true" || (button as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows why when there is no path, and draws nothing", async () => {
    const { container } = mount({
      solved: false,
      refusal: "Principia's worker could not be started on this machine.",
    });
    await press();

    expect(container.querySelector("[data-last-known-path]")).toBeNull();
    expect(visibleText(container)).toContain("could not be started");
  });
});
