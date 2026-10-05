import {
  act,
  screen,
  setupStreamFixture,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { useActiveHandles } from "@ksp-gonogo/ui-kit";
import { renderWithRail as render } from "@ksp-gonogo/ui-kit/testing";
import { describe, expect, it } from "vitest";
import { ScienceDataAboardRowAugment } from "./index.js";

const SUBJECT_ID = "mysteryGoo@KerbinInSpaceLow";

function fileEntry(kerbalism: Record<string, unknown>) {
  return {
    partName: "Hard Drive",
    location: "container",
    experimentId: "mysteryGoo",
    subjectId: SUBJECT_ID,
    title: "Mystery Goo Observation",
    situation: "InSpaceLow",
    valueModel: "kerbalism-linear",
    extensions: {
      kerbalism: { kind: "file", dataSizeMB: 12.5, ...kerbalism },
    },
  };
}

/** What the rail holds, as the tags and ribbons of each entry. */
function RailProbe() {
  const handles = useActiveHandles();
  return (
    <output data-testid="rail">
      {JSON.stringify(
        handles
          .filter((h) => (h.ribbons ?? []).length > 0)
          .map((h) => ({
          tags: h.tags,
          ribbons: (h.ribbons ?? []).map((r) => ({
            id: r.id,
            tags: r.tags,
            samples: r.amplitudes.length,
          })),
        })),
      )}
    </output>
  );
}

function mount() {
  const fixture = setupStreamFixture({ pinnedUt: 10 });
  render(
    <fixture.Provider>
      <ScienceDataAboardRowAugment subjectId={SUBJECT_ID} />
      <RailProbe />
    </fixture.Provider>,
  );
  return fixture;
}

const railText = () => screen.getByTestId("rail").textContent ?? "";

describe("Kerbalism data transfer on the delay rail", () => {
  it("puts a transmitting file on the rail as continuous fire-and-forget telemetry", async () => {
    const fixture = mount();
    act(() => {
      fixture.emit("science.experiments", [
        fileEntry({ transmitRateMBps: 0.004, transmitting: true }),
      ]);
    });
    await screen.findByLabelText("Kerbalism file manager");
    const rail = JSON.parse(railText());
    expect(rail).toHaveLength(1);
    expect(rail[0].ribbons).toHaveLength(1);
    expect(rail[0].ribbons[0].id).toBe(`kerbalism.transfer.${SUBJECT_ID}`);
    expect(rail[0].ribbons[0].tags).toEqual({
      direction: "telemetry",
      continuity: "continuous",
      delivery: "fire-and-forget",
    });
  });

  it("draws nothing for a file that is not transmitting", async () => {
    const fixture = mount();
    act(() => {
      fixture.emit("science.experiments", [
        fileEntry({ transmitRateMBps: 0, transmitting: false }),
      ]);
    });
    await screen.findByLabelText("Kerbalism file manager");
    expect(JSON.parse(railText())).toEqual([]);
  });

  it("draws nothing when the transmit rate was not read, rather than an idle trace", async () => {
    const fixture = mount();
    act(() => {
      fixture.emit("science.experiments", [
        fileEntry({ transmitRateMBps: null, transmitting: null }),
      ]);
    });
    await screen.findByLabelText("Kerbalism file manager");
    expect(JSON.parse(railText())).toEqual([]);
  });
});
