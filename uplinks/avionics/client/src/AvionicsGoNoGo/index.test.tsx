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
} from "@ksp-gonogo/ui-kit/testing";
import { afterEach, describe, expect, it } from "vitest";
// Importing the real module runs its module-load registerComponent(...) once.
import { AvionicsGoNoGoComponent } from "./index.js";

const renderedTrees: Array<() => void> = [];

function newFixture() {
  return setupStreamFixture({
    carriedChannels: ["avionics.status"],
    pinnedUt: 10,
  });
}

function renderWidget(fixture: ReturnType<typeof newFixture>) {
  const result = render(
    <fixture.Provider>
      <AvionicsGoNoGoComponent config={{}} id="av" />
    </fixture.Provider>,
  );
  renderedTrees.push(result.unmount);
  return result;
}

afterEach(() => {
  for (const unmount of renderedTrees) unmount();
  renderedTrees.length = 0;
});

describe("AvionicsGoNoGoComponent", () => {
  it("shows NO-GO when the vessel is over the controllable mass", async () => {
    const fixture = newFixture();
    const { container } = renderWidget(fixture);
    act(() => {
      fixture.emit("avionics.status", {
        avionicsActive: true,
        controllableMassTons: 4.0,
        vesselMassTons: 5.2,
        controllable: false,
      });
    });
    expect(await screen.findByText("NO-GO")).toBeInTheDocument();
    // `visibleText` rather than `getByText`: a `<Unit>` renders the number and
    // the symbol as separate elements with the unit's spoken WORD alongside,
    // so the readout is no longer one text node. The helper strips the word
    // and normalises the thin space, leaving what an operator sees.
    expect(visibleText(container)).toContain("5.20 t");
    expect(visibleText(container)).toContain("4.00 t");
  });

  it("shows GO when within the limit + has no axe violations", async () => {
    const fixture = newFixture();
    const { container } = renderWidget(fixture);
    act(() => {
      fixture.emit("avionics.status", {
        avionicsActive: true,
        controllableMassTons: 10,
        vesselMassTons: 6.5,
        controllable: true,
      });
    });
    expect(await screen.findByText("GO")).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("shows NO AVIONICS when no avionics unit is active", async () => {
    const fixture = newFixture();
    renderWidget(fixture);
    act(() => {
      fixture.emit("avionics.status", {
        avionicsActive: false,
        controllableMassTons: null,
        vesselMassTons: 6.5,
        controllable: false,
      });
    });
    expect(await screen.findByText("NO AVIONICS")).toBeInTheDocument();
  });

  // The withholding this widget documents ("a stale GO is the single worst
  // thing this widget could draw") produced a confident NO AVIONICS instead of
  // a withheld verdict, because the flag was coalesced to false. NO AVIONICS is
  // a claim about the vessel's hardware; nobody read the hardware.
  // Container-scoped, because both strings are this widget's own and a
  // body-wide query would answer from either.
  it("says it has no reading, not NO AVIONICS, while the status has not been observed", async () => {
    const fixture = newFixture();
    const { container } = renderWidget(fixture);
    await act(async () => {});

    expect(visibleText(container)).toContain("NO READING");
    expect(visibleText(container)).not.toContain("NO AVIONICS");
  });

  // The same absence arriving inside an observed payload: the channel answered
  // but the flag was not in it, so the vessel's avionics are still unread.
  it("says it has no reading when an observed status carries no avionicsActive flag", async () => {
    const fixture = newFixture();
    const { container } = renderWidget(fixture);
    act(() => {
      fixture.emit("avionics.status", { vesselMassTons: 6.5 });
    });

    // The frame lands on a macrotask, so the mass is waited for FIRST and is
    // what proves the payload was observed at all. NO READING is also what an
    // unobserved widget says, so asserting only the label passes on a widget
    // the emit never reached, whatever the observed path does.
    await waitFor(() => {
      expect(visibleText(container)).toContain("6.50 t");
    });
    expect(visibleText(container)).toContain("NO READING");
    expect(visibleText(container)).not.toContain("NO AVIONICS");
  });

  // The switch read, the verdict did not. Coalesced to false this was the worst
  // of the three: not a withheld answer but a CONFIDENT NO-GO, in the alert
  // tone, beside a controllable readout of "0.00 t", for a craft RP-1 was
  // flying perfectly well.
  it("withholds the verdict when the switch read on but controllable did not", async () => {
    const fixture = newFixture();
    const { container } = renderWidget(fixture);
    act(() => {
      fixture.emit("avionics.status", {
        avionicsActive: true,
        controllableMassTons: null,
        vesselMassTons: 5.2,
        controllable: null,
      });
    });

    // The mass that WAS read still shows, and waiting for it is what proves the
    // payload arrived: NO READING is also the unobserved state.
    await waitFor(() => {
      expect(visibleText(container)).toContain("5.20 t");
    });
    expect(visibleText(container)).toContain("NO READING");
    expect(visibleText(container)).not.toContain("NO-GO");
    // The ceiling that was not read draws a dash, never a substituted zero.
    expect(visibleText(container)).not.toContain("0.00 t");
  });

  // Exactly what the mod publishes when its reflection read produced nothing
  // (AvionicsCapture's null-raw branch). Until that branch stopped hardcoding a
  // false pair, nothing the mod could emit reached this arm at all.
  it("says it has no reading for the all-absent status the mod sends after a failed read", async () => {
    const fixture = newFixture();
    const { container } = renderWidget(fixture);
    act(() => {
      fixture.emit("avionics.status", {
        avionicsActive: null,
        controllableMassTons: null,
        vesselMassTons: 6.5,
        controllable: null,
      });
    });

    await waitFor(() => {
      expect(visibleText(container)).toContain("6.50 t");
    });
    expect(visibleText(container)).toContain("NO READING");
    expect(visibleText(container)).not.toContain("NO AVIONICS");
  });
});
