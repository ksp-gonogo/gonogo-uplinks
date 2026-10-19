import { useTelemetry } from "@ksp-gonogo/sitrep-sdk";
import {
  act,
  screen,
  setupStreamFixture,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { renderWithRail as render } from "@ksp-gonogo/ui-kit/testing";
import { describe, expect, it } from "vitest";
import { KerbalismInstrumentRunState } from "./index.js";

const instrument = (partId: string, expId: string) => ({
  partId,
  partTitle: "Probodobodyne Stayputnik",
  expId,
  deployed: false,
  hasData: false,
  rerunnable: false,
  inoperable: false,
});

const entry = (
  experimentId: string,
  ext: Record<string, unknown> | undefined,
) => ({
  partId: "1475388156",
  partName: "Probodobodyne Stayputnik",
  experimentId,
  title: null,
  deployed: false,
  inoperable: false,
  rerunnable: null,
  resettable: null,
  dataIsCollectable: false,
  extensions: ext ? { kerbalism: ext } : undefined,
});

function Ready() {
  return useTelemetry("science.instruments").state === "observed" ? (
    <span>stream ready</span>
  ) : null;
}

async function draw(experimentId: string, payload: unknown[]) {
  const fixture = setupStreamFixture({ pinnedUt: 1_000_000 });
  render(
    <fixture.Provider>
      <Ready />
      <ul>
        <KerbalismInstrumentRunState
          instrument={instrument("1475388156", experimentId)}
        />
      </ul>
    </fixture.Provider>,
  );
  act(() => fixture.emit("science.instruments", payload));
  await screen.findByText("stream ready");
}

describe("KerbalismInstrumentRunState", () => {
  it("shows the run state of the experiment its row is for, not a sibling's", async () => {
    await draw("seismicScan", [
      entry("temperatureScan", { kind: "experiment", runningState: "Stopped" }),
      entry("seismicScan", { kind: "experiment", runningState: "Running" }),
    ]);

    expect(screen.getByText("RUNNING")).toBeInTheDocument();
    expect(screen.queryByText("STOPPED")).toBeNull();
  });

  it("draws nothing for a stock instrument", async () => {
    await draw("seismicScan", [entry("seismicScan", undefined)]);

    expect(screen.queryByRole("listitem")).toBeNull();
  });
});
