import {
  act,
  clearRaisedBanners,
  getRaisedBanners,
  setupStreamFixture,
  waitFor,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { renderWithRail as render } from "@ksp-gonogo/ui-kit/testing";
import { afterEach, describe, expect, it } from "vitest";
import {
  FORECASTS_STOPPED_BANNER,
  useForecastsStopped,
} from "./forecastsStopped.js";

const VIEW_UT = 10_000;

afterEach(clearRaisedBanners);

function Surface() {
  useForecastsStopped();
  return null;
}

function roster(facts: Array<{ label: string; value: string }>) {
  return {
    uplinks: [
      {
        id: "principia",
        version: "1.0.0",
        available: true,
        reason: null,
        ownedPrefixes: [],
        health: {
          state: facts.length > 0 ? 1 : 0,
          detail: facts.length > 0 ? "Forecasts stopped." : null,
          facts,
        },
      },
    ],
  };
}

const STOPPED = [{ label: "forecasts", value: "stopped" }];

describe("the forecasts-stopped banner", () => {
  it("raises one warning however many surfaces and roster updates see the stop", async () => {
    const stream = setupStreamFixture({ pinnedUt: VIEW_UT });
    render(
      <stream.Provider>
        <Surface />
        <Surface />
      </stream.Provider>,
    );

    act(() => {
      stream.emit("system.uplinks", roster(STOPPED), { validAt: VIEW_UT });
    });
    act(() => {
      stream.emit("system.uplinks", roster(STOPPED), { validAt: VIEW_UT });
    });

    await waitFor(() => expect(getRaisedBanners()).toHaveLength(1));
    expect(getRaisedBanners()[0]).toMatchObject({
      uplinkId: "principia",
      severity: "warning",
      text: FORECASTS_STOPPED_BANNER,
    });
    await act(async () => {});
  });

  it("raises nothing while forecasts run, and takes the banner down once they run again", async () => {
    const stream = setupStreamFixture({ pinnedUt: VIEW_UT });
    render(
      <stream.Provider>
        <Surface />
      </stream.Provider>,
    );

    act(() => {
      stream.emit("system.uplinks", roster([]), { validAt: VIEW_UT });
    });
    await act(async () => {});
    expect(getRaisedBanners()).toHaveLength(0);

    act(() => {
      stream.emit("system.uplinks", roster(STOPPED), { validAt: VIEW_UT });
    });
    await waitFor(() => expect(getRaisedBanners()).toHaveLength(1));

    act(() => {
      stream.emit("system.uplinks", roster([]), { validAt: VIEW_UT });
    });
    await waitFor(() => expect(getRaisedBanners()).toHaveLength(0));
  });
});
