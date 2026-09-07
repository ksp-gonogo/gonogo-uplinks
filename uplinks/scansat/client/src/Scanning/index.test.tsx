import { clearRegistry, registerStockBodies, value } from "@ksp-gonogo/sitrep-sdk";
import {
  act,
  createTestTelemetryClient,
  render,
  StubTransport,
  screen,
  TelemetryProvider,
  waitFor,
} from "@ksp-gonogo/sitrep-sdk/testing";
import {
  expectNoA11yViolations,
  visibleText,
} from "@ksp-gonogo/ui-kit/testing";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SCANScanningVessel } from "../schema.js";
import { ScanningComponent } from "./index.js";

// Every channel this widget reads rides the native TelemetryClient stream, so
// every emit here goes over `transport`. That includes `scansat.scanningVessels`,
// which until recently was read through the two-arg `useTelemetry("data", key)`
// shim and fed here off a `MockDataSource`: the shim resolves no Topic for a bare
// Topic id and the app registers nothing under the flat id `"data"`, so the list
// was dead in production while this file's legacy source kept the tests green.
// See `useScanLayers.ts`'s `useScanningVessels`.

/** `system.bodies` fixture carrying just the one body the tests need. */
const SYSTEM_BODIES = { bodies: [{ index: 1, name: "Kerbin" }] };
/** `vessel.identity` fixture: active vessel orbiting/landed at Kerbin (index 1). */
const VESSEL_IDENTITY_AT_KERBIN = { parentBodyIndex: 1 };

/** One tracked scanner over Kerbin, with both sensors in range. */
function vessel(over: Partial<SCANScanningVessel> = {}): SCANScanningVessel {
  return {
    vesselId: "v1",
    vesselName: "Mapper One",
    body: "Kerbin",
    subLatitude: value("°", 12),
    subLongitude: value("°", 35),
    altitude: value("m", 250_000),
    sensors: [
      {
        type: 2, // AltimetryHiRes
        fov: value("°", 5),
        minAlt: value("m", 5000),
        maxAlt: value("m", 500_000),
        bestAlt: value("m", 250_000),
        inRange: true,
        bestRange: true,
      },
    ],
    groundTrackWidthDeg: value("°", 6),
    groundTrackLonHalfDeg: value("°", 6.1),
    trackColor: {
      r: value("count", 0),
      g: value("count", 255),
      b: value("count", 200),
      a: value("count", 200),
    },
    ...over,
  };
}

describe("ScanningComponent", () => {
  let transport: StubTransport;
  let client: ReturnType<typeof createTestTelemetryClient>;

  // Rendered trees, tracked so afterEach unmounts them inside the test's own
  // scope. RTL auto-cleanup runs after this file's afterEach, so it cannot be
  // relied on to unmount first, and a live tree torn down later re-renders
  // outside act() (the documented anti-pattern in CLAUDE.md).
  const renderedTrees: Array<() => void> = [];

  function renderScanning(ui: ReactElement) {
    const result = render(
      <TelemetryProvider client={client}>{ui}</TelemetryProvider>,
    );
    renderedTrees.push(result.unmount);
    return result;
  }

  beforeEach(() => {
    clearRegistry();
    registerStockBodies();
    transport = new StubTransport();
    client = createTestTelemetryClient(transport);
  });

  afterEach(() => {
    for (const unmount of renderedTrees) unmount();
    renderedTrees.length = 0;
  });

  it("shows the empty state when SCANsat is not installed", async () => {
    renderScanning(<ScanningComponent config={{}} id="scanning" />);
    act(() => {
      transport.emit("scansat.available", false);
    });
    await screen.findByText(/SCANsat is not installed/i);
  });

  it("renders the coverage / vessels / anomalies layout when SCANsat is present", async () => {
    renderScanning(<ScanningComponent config={{}} id="scanning" />);
    act(() => {
      transport.emit("scansat.available", true);
      transport.emit("system.bodies", SYSTEM_BODIES);
      transport.emit("vessel.identity", VESSEL_IDENTITY_AT_KERBIN);
    });
    await screen.findByText(/Coverage: Kerbin/);
    expect(screen.getByText(/Scanning vessels/)).toBeInTheDocument();
    // An EMPTY list, emitted, not merely never sent: "no vessels" has to be an
    // answer here rather than a silence, or the assertion passes just as well
    // against a read that resolves nothing.
    await waitFor(() =>
      expect(transport.isSubscribed("scansat.scanningVessels")).toBe(true),
    );
    act(() => {
      transport.emit("scansat.scanningVessels", []);
    });
    expect(
      screen.getByText(/No vessels tracked by SCANsat yet/),
    ).toBeInTheDocument();
  });

  it("renders a tracked vessel's name, sub-point and scanners", async () => {
    renderScanning(<ScanningComponent config={{}} id="scanning" />);
    act(() => {
      transport.emit("scansat.available", true);
      transport.emit("system.bodies", SYSTEM_BODIES);
      transport.emit("vessel.identity", VESSEL_IDENTITY_AT_KERBIN);
    });
    await screen.findByText(/Coverage: Kerbin/);
    await waitFor(() =>
      expect(transport.isSubscribed("scansat.scanningVessels")).toBe(true),
    );
    act(() => {
      transport.emit("scansat.scanningVessels", [vessel()]);
    });

    await screen.findByText("Mapper One");
    // The sub-point and altitude render through <Unit>, which splits number
    // from symbol across elements, so the whole-tree text is what to assert on.
    await waitFor(() => expect(visibleText()).toContain("sub-point 12.00°"));
    expect(visibleText()).toContain("35.00°");
    expect(visibleText()).toContain("250 km");
    // The scanner row, so a vessel that arrives with its sensors dropped is not
    // mistaken for one that rendered fine.
    expect(visibleText()).toContain("FoV 5.0°");
    expect(screen.queryByText(/No scanners\./)).toBeNull();
  });

  it("renders coverage percentages for each scan type when values are emitted", async () => {
    renderScanning(<ScanningComponent config={{}} id="scanning" />);
    act(() => {
      transport.emit("scansat.available", true);
      transport.emit("system.bodies", SYSTEM_BODIES);
      transport.emit("vessel.identity", VESSEL_IDENTITY_AT_KERBIN);
    });
    await screen.findByText(/Coverage: Kerbin/);
    act(() => {
      // Distinct non-zero values for each of the 5 DISPLAY_SCAN_TYPES
      transport.emit("scansat.coverage.Kerbin.2", 12.3); // AltimetryHiRes
      transport.emit("scansat.coverage.Kerbin.1", 34.5); // AltimetryLoRes
      transport.emit("scansat.coverage.Kerbin.8", 56.7); // Biome
      transport.emit("scansat.coverage.Kerbin.16", 78.9); // Anomaly
      transport.emit("scansat.coverage.Kerbin.256", 91.0); // ResourceHiRes
    });
    // `visibleText`, not `findByText`: these render through <Unit>, which puts
    // the number and its symbol in separate elements with a thin space
    // between, so no single node holds "12.3 %".
    await waitFor(() => expect(visibleText()).toContain("12.3 %"));
    expect(visibleText()).toContain("34.5 %");
    expect(visibleText()).toContain("56.7 %");
    expect(visibleText()).toContain("78.9 %");
    expect(visibleText()).toContain("91.0 %");
  });

  it("renders anomaly names according to discovery state", async () => {
    renderScanning(<ScanningComponent config={{}} id="scanning" />);
    act(() => {
      transport.emit("scansat.available", true);
      transport.emit("system.bodies", SYSTEM_BODIES);
      transport.emit("vessel.identity", VESSEL_IDENTITY_AT_KERBIN);
    });
    await screen.findByText(/Coverage: Kerbin/);
    act(() => {
      // `scansat.anomalies.<body>` rides the stream too (see header note).
      transport.emit("scansat.anomalies.Kerbin", [
        // detail=true → show the name
        {
          name: "Monolith One",
          latitude: 10.5,
          longitude: 20.5,
          known: true,
          detail: true,
        },
        // known=true, detail=false → "(unknown)"
        {
          name: "Hidden Site",
          latitude: 30.5,
          longitude: 40.5,
          known: true,
          detail: false,
        },
        // known=false, detail=false → "(undetected)"
        {
          name: "Mystery Spot",
          latitude: 50.5,
          longitude: 60.5,
          known: false,
          detail: false,
        },
      ]);
    });
    await screen.findByText("Monolith One");
    expect(screen.getByText("(unknown)")).toBeInTheDocument();
    expect(screen.getByText("(undetected)")).toBeInTheDocument();
  });

  it("renders the biome readout from vessel.surface once the vessel is on a body", async () => {
    renderScanning(<ScanningComponent config={{}} id="scanning" />);
    act(() => {
      transport.emit("scansat.available", true);
      transport.emit("system.bodies", SYSTEM_BODIES);
      transport.emit("vessel.identity", VESSEL_IDENTITY_AT_KERBIN);
      transport.emit("vessel.surface", { biome: "Highlands" });
    });
    await waitFor(() =>
      expect(screen.getByText(/Biome: Highlands/)).toBeInTheDocument(),
    );
  });

  it("passes an a11y smoke when SCANsat is unavailable", async () => {
    const { container } = renderScanning(
      <ScanningComponent config={{}} id="scanning" />,
    );
    act(() => {
      transport.emit("scansat.available", false);
    });
    await expectNoA11yViolations(container);
  });
});
