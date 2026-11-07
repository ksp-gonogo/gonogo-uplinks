import { act, screen, setupStreamFixture } from "@ksp-gonogo/sitrep-sdk/testing";
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
    providerId: "principia-propagation",
    basis: "Principia Levi-Civita, the game's own arithmetic",
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
  return { container: result.container, asked };
}

async function press() {
  await act(async () => {
    screen.getByRole("button", { name: /PLOT NEXT HOUR FROM HERE/i }).click();
  });
  await act(async () => {});
}

describe("the flight plan's plot from the last known state", () => {
  it("asks for the accurate answer an hour past the view and draws what comes back, saying what computed it", async () => {
    const { container, asked } = mount(solved);
    await press();

    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({ certification: 0 });
    expect(container.querySelector("[data-last-known-path] polyline")).not.toBeNull();
    expect(visibleText(container)).toContain("INTEGRATED");
    expect(visibleText(container)).toContain("Levi-Civita");
    expect(await axe(container)).toHaveNoViolations();
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
