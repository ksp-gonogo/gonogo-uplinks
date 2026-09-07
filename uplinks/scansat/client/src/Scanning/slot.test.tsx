import {
  clearRegistry,
  registerAugment,
  registerStockBodies,
} from "@ksp-gonogo/sitrep-sdk";
import {
  act,
  clearAugments,
  createTestTelemetryClient,
  getAugmentsForSlot,
  render,
  StubTransport,
  screen,
  TelemetryProvider,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { useWidgetScope, WidgetMetaContext } from "@ksp-gonogo/ui-kit";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ScanningComponent } from "./index.js";

/**
 * Scanning augment-slot exposure: SCANsat-OWNED widget exposing a slot OTHER
 * Uplinks fill. `scanning.sections` is exposed but ships no filler here (that
 * is an Uplink augment): an empty slot must render cleanly, and a test augment
 * registered into it must appear, receiving the widget's body focus as typed
 * slot props.
 */

// Every channel the widget reads rides the native TelemetryClient stream, so
// this suite needs no `DataSource` at all. It used to register one for
// `scansat.scanningVessels`, back when that list was read through the two-arg
// shim; the slot assertions never depended on it.

const SYSTEM_BODIES = { bodies: [{ index: 1, name: "Kerbin" }] };
const VESSEL_IDENTITY_AT_KERBIN = { parentBodyIndex: 1 };

describe("Scanning: augment slots (spec §4)", () => {
  let transport: StubTransport;
  let client: ReturnType<typeof createTestTelemetryClient>;

  // Rendered trees, tracked so afterEach unmounts them inside the test's own
  // scope. RTL auto-cleanup runs after this file's afterEach, so it cannot be
  // relied on to unmount first, and a live tree torn down later re-renders
  // outside act() (the documented anti-pattern in CLAUDE.md).
  const renderedTrees: Array<() => void> = [];

  beforeEach(() => {
    clearRegistry();
    registerStockBodies();
    transport = new StubTransport();
    client = createTestTelemetryClient(transport);
  });

  afterEach(() => {
    for (const unmount of renderedTrees) unmount();
    renderedTrees.length = 0;
    // Wipe any test augment so it never leaks into other suites.
    clearAugments();
  });

  // Drive the widget to the present-SCANsat layout, where both the `badges`
  // header slot and the `sections` coverage slot render. Resolves once the
  // body name has landed: the TelemetryProvider commits transport frames on
  // a rAF, so `vessel.identity`/`system.bodies` resolve a tick after the
  // synchronous act() below, not within it.
  async function renderPresent() {
    const result = render(
      <TelemetryProvider client={client}>
        {/* `scanning.sections` is the framework's universal segment now, and
            a segment slot completes its id from the widget meta the dashboard
            supplies, so a bare render has no seam to bind to. This is the
            identity half of that stack, which is all this suite needs. */}
        <WidgetMetaContext.Provider
          value={{ componentId: "scanning", contributionSlots: [] }}
        >
          <ScanningComponent config={{}} id="scanning" />
        </WidgetMetaContext.Provider>
      </TelemetryProvider>,
    );
    renderedTrees.push(result.unmount);
    act(() => {
      transport.emit("scansat.available", true);
      transport.emit("system.bodies", SYSTEM_BODIES);
      transport.emit("vessel.identity", VESSEL_IDENTITY_AT_KERBIN);
    });
    await screen.findByText(/Coverage: Kerbin/);
  }

  it("exposes the slot with no augment bound by default", () => {
    expect(getAugmentsForSlot("scanning.sections")).toEqual([]);
  });

  it("renders the layout with the empty slot inert (stock readout unchanged)", async () => {
    await renderPresent();
    expect(screen.getByText(/Coverage: Kerbin/)).toBeInTheDocument();
    expect(screen.queryByTestId("scan-section-augment")).toBeNull();
  });

  it("renders a test augment bound to the sections slot, which reads the focused body from the widget's scope", async () => {
    function SectionAugment() {
      const bodyName = useWidgetScope("scanning")?.bodyName;
      return (
        <div data-testid="scan-section-augment">RESOURCE-SCAN: {bodyName}</div>
      );
    }
    await renderPresent();

    act(() => {
      registerAugment({
        id: "test-scan-section",
        augments: "scanning.sections",
        component: SectionAugment,
      });
    });

    const augment = await screen.findByTestId("scan-section-augment");
    expect(augment.textContent).toBe("RESOURCE-SCAN: Kerbin");
  });
});
