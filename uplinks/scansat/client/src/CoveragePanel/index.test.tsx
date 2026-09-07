import {
  AugmentSlot,
  BufferedDataSource,
  clearRegistry,
  type DataKey,
  MemoryStore,
  Quality,
  registerDataSource,
  value,
} from "@ksp-gonogo/sitrep-sdk";
import {
  act,
  createTestTelemetryClient,
  MockDataSource,
  render,
  StubTransport,
  screen,
  TelemetryProvider,
  waitFor,
  within,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { WidgetScopeProvider } from "@ksp-gonogo/ui-kit";
import {
  expectNoA11yViolations,
  visibleText,
} from "@ksp-gonogo/ui-kit/testing";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WithScansatAvailability } from "../test/withScansatAvailability.js";
// Importing the real module (not a throwaway test double) runs its
// module-load `registerAugment(...)` exactly once: same convention as
// FootprintOverlay/index.test.tsx and AnomalyOverlay/slot.test.tsx.
import "./index.js";
import type { SCANScanningVessel } from "../schema.js";

function vessel(over: Partial<SCANScanningVessel>): SCANScanningVessel {
  return {
    vesselId: "v1",
    vesselName: "Mapper",
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
      {
        type: 8, // Biome
        fov: value("°", 5),
        minAlt: value("m", 5000),
        maxAlt: value("m", 500_000),
        bestAlt: value("m", 250_000),
        inRange: true,
        bestRange: false,
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

// `map-view.sections` is the framework's universal segment and carries no
// props: the mapped body reaches the augment through MapView's published SCOPE,
// so a test stands that up the way the real host does.
function MappedBody({
  bodyName = "Kerbin" as string | undefined,
  children,
}: {
  bodyName?: string | undefined;
  children: ReactElement;
}) {
  return (
    <WidgetScopeProvider widget="map-view" scope={{ bodyName }}>
      {children}
    </WidgetScopeProvider>
  );
}

const NO_PROPS: Record<string, never> = {};

// Rendered trees, tracked so afterEach can unmount them BEFORE disconnecting
// the buffered source. RTL auto-cleanup runs after this file's afterEach, so it
// can't be relied on to unmount first, disconnecting a live source while the
// widget is still mounted fires a status change into it, a state update outside
// act() (the documented anti-pattern in CLAUDE.md).
const renderedTrees: Array<() => void> = [];

function renderSlot(ui: ReactElement) {
  const result = render(ui);
  renderedTrees.push(result.unmount);
  return result;
}

describe("CoveragePanel: map-view.sections slot", () => {
  let source: MockDataSource;
  let buffered: BufferedDataSource;

  beforeEach(async () => {
    clearRegistry();
    const keys: DataKey[] = [
      { key: "scansat.scanningVessels" },
      { key: "scansat.coverage.Kerbin.2" },
      { key: "scansat.coverage.Kerbin.1" },
      { key: "scansat.coverage.Kerbin.8" },
      { key: "scansat.coverage.Kerbin.256" },
      { key: "scansat.coverage.Kerbin.128" },
    ];
    source = new MockDataSource({ keys });
    buffered = new BufferedDataSource({ source, store: new MemoryStore() });
    registerDataSource(buffered);
    await buffered.connect();
  });

  afterEach(() => {
    for (const unmount of renderedTrees) unmount();
    renderedTrees.length = 0;
    buffered.disconnect();
  });

  it("does not render while the scansat domain has not announced availability", () => {
    const transport = new StubTransport();
    const client = createTestTelemetryClient(transport);

    renderSlot(
      <TelemetryProvider client={client}>
        <WithScansatAvailability>
          <MappedBody>
            <AugmentSlot name="map-view.sections" props={NO_PROPS} />
          </MappedBody>
        </WithScansatAvailability>
      </TelemetryProvider>,
    );
    act(() => {
      source.emit("scansat.coverage.Kerbin.2", 45.6);
    });

    expect(
      screen.queryByRole("region", { name: /Scan coverage for Kerbin/i }),
    ).toBeNull();
  });

  it("stays absent when the scansat domain is unavailable but no provider is mounted", () => {
    // No TelemetryProvider at all: the app-realistic case of a KSP install
    // with no SCANsat mod present: scansat.available never arrives.
    renderSlot(
      <MappedBody>
        <AugmentSlot name="map-view.sections" props={NO_PROPS} />
      </MappedBody>,
    );
    act(() => {
      source.emit("scansat.coverage.Kerbin.2", 45.6);
    });

    expect(
      screen.queryByRole("region", { name: /Scan coverage for Kerbin/i }),
    ).toBeNull();
  });

  it("renders per-type coverage percentages and live in-range chips once the domain is live", async () => {
    const transport = new StubTransport();
    const client = createTestTelemetryClient(transport);

    renderSlot(
      <TelemetryProvider client={client}>
        <WithScansatAvailability>
          <MappedBody>
            <AugmentSlot name="map-view.sections" props={NO_PROPS} />
          </MappedBody>
        </WithScansatAvailability>
      </TelemetryProvider>,
    );
    // Coverage rides the STREAM (the dynamic `scansat.coverage.*` prefix is
    // carried), and so does the vessel list. The per-type rows only subscribe
    // once the panel is mounted (availability live), so emit availability first,
    // wait for the row subscriptions, THEN emit coverage on the transport.
    const meta = { quality: Quality.Loaded, source: "scansat" };
    act(() => {
      transport.emit("scansat.available", true, meta);
    });

    const panel = await screen.findByRole("region", {
      name: /Scan coverage for Kerbin/i,
    });
    await waitFor(() =>
      expect(transport.isSubscribed("scansat.coverage.Kerbin.2")).toBe(true),
    );
    act(() => {
      transport.emit("scansat.scanningVessels", [vessel({})], meta);
      transport.emit("scansat.coverage.Kerbin.2", 45.6, meta);
      transport.emit("scansat.coverage.Kerbin.1", 67.6, meta);
      transport.emit("scansat.coverage.Kerbin.8", 29.6, meta);
      transport.emit("scansat.coverage.Kerbin.256", 7.4, meta);
      transport.emit("scansat.coverage.Kerbin.128", 0, meta);
    });

    // `visibleText`, not `getByText`: the coverage figure renders through
    // <Unit> now, which puts the number and its symbol in separate elements
    // with a thin space between, so no single node holds "46 %".
    await waitFor(() => expect(visibleText(panel)).toContain("46 %")); // AltHiRes
    expect(visibleText(panel)).toContain("68 %"); // AltLoRes
    expect(visibleText(panel)).toContain("30 %"); // Biome
    // AltHiRes sensor is bestRange → "best"; Biome sensor inRange → "scan".
    expect(within(panel).getByText("best")).toBeInTheDocument();
    expect(within(panel).getAllByText("scan").length).toBeGreaterThan(0);
  });

  it("excludes scanning vessels on a different body from the in-range chips", async () => {
    const transport = new StubTransport();
    const client = createTestTelemetryClient(transport);

    renderSlot(
      <TelemetryProvider client={client}>
        <WithScansatAvailability>
          <MappedBody>
            <AugmentSlot name="map-view.sections" props={NO_PROPS} />
          </MappedBody>
        </WithScansatAvailability>
      </TelemetryProvider>,
    );
    const meta = { quality: Quality.Loaded, source: "scansat" };
    act(() => {
      transport.emit("scansat.available", true, meta);
    });

    const panel = await screen.findByRole("region", {
      name: /Scan coverage for Kerbin/i,
    });
    await waitFor(() =>
      expect(transport.isSubscribed("scansat.coverage.Kerbin.2")).toBe(true),
    );
    act(() => {
      transport.emit("scansat.scanningVessels", [vessel({ body: "Mun" })], meta);
      transport.emit("scansat.coverage.Kerbin.2", 12, meta);
    });
    await waitFor(() => expect(visibleText(panel)).toContain("12 %"));
    // The Mun vessel's sensors must not reach Kerbin's chips. The list IS fed
    // and the panel IS subscribed by this point, so an empty chip row is the
    // body filter working rather than a read that never landed.
    await waitFor(() =>
      expect(transport.isSubscribed("scansat.scanningVessels")).toBe(true),
    );
    expect(within(panel).queryByText("best")).toBeNull();
  });

  it("does not render when no body is mapped", () => {
    const transport = new StubTransport();
    const client = createTestTelemetryClient(transport);

    renderSlot(
      <TelemetryProvider client={client}>
        <WithScansatAvailability>
          <MappedBody bodyName={undefined}>
            <AugmentSlot name="map-view.sections" props={NO_PROPS} />
          </MappedBody>
        </WithScansatAvailability>
      </TelemetryProvider>,
    );
    act(() => {
      transport.emit("scansat.available", true, {
        quality: Quality.Loaded,
        source: "scansat",
      });
    });

    expect(screen.queryByRole("region")).toBeNull();
  });

  it("passes an a11y smoke with the coverage panel rendered", async () => {
    const transport = new StubTransport();
    const client = createTestTelemetryClient(transport);

    const { container } = renderSlot(
      <TelemetryProvider client={client}>
        <WithScansatAvailability>
          <MappedBody>
            <AugmentSlot name="map-view.sections" props={NO_PROPS} />
          </MappedBody>
        </WithScansatAvailability>
      </TelemetryProvider>,
    );
    const meta = { quality: Quality.Loaded, source: "scansat" };
    act(() => {
      transport.emit("scansat.available", true, meta);
    });
    await screen.findByRole("region", { name: /Scan coverage for Kerbin/i });
    await waitFor(() =>
      expect(transport.isSubscribed("scansat.coverage.Kerbin.2")).toBe(true),
    );
    // Every channel the panel draws from, so the smoke walks the populated
    // markup (chips and all) rather than an empty shell.
    act(() => {
      transport.emit("scansat.scanningVessels", [vessel({})], meta);
      transport.emit("scansat.coverage.Kerbin.2", 45.6, meta);
      transport.emit("scansat.coverage.Kerbin.1", 67.6, meta);
      transport.emit("scansat.coverage.Kerbin.8", 29.6, meta);
    });
    await waitFor(() =>
      expect(within(screen.getByRole("region")).getByText("best")).toBeInTheDocument(),
    );

    await expectNoA11yViolations(container);
  });
});
