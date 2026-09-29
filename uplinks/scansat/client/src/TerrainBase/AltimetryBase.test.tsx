import {
  AugmentSlot,
  clearRegistry,
  Quality,
  registerStockBodies,
  type SlotProps,
} from "@ksp-gonogo/sitrep-sdk";
import {
  act,
  createTestTelemetryClient,
  render,
  StubTransport,
  TelemetryProvider,
  waitFor,
} from "@ksp-gonogo/sitrep-sdk/testing";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SCANHeightGrid } from "../schema.js";
import { WithScansatAvailability } from "../test/withScansatAvailability.js";
import { ALTIMETRY_LAYER_ID, altimetryColour } from "./AltimetryBase.js";
// Importing the real module (not a throwaway test double) runs its
// module-load `registerAugment(...)` exactly once: same convention as
// FootprintOverlay/index.test.tsx and CoveragePanel/index.test.tsx.
import "./AltimetryBase.js";
import { BASE_LAYER_CANVAS_H, BASE_LAYER_CANVAS_W } from "./paintTile.js";

function encodeInt16LE(values: number[]): string {
  const buf = Buffer.alloc(values.length * 2);
  values.forEach((v, i) => {
    buf.writeInt16LE(v, i * 2);
  });
  return buf.toString("base64");
}

function heightGridFixture(): SCANHeightGrid {
  // 2x2 grid: sea level, low, high, peak.
  return {
    width: 2,
    height: 2,
    minMetres: 0,
    maxMetres: 1000,
    heights: encodeInt16LE([0, 250, 750, 1000]),
  };
}

/** Kerbin's real height span, with grassland at 500 m and 1500 m. */
function kerbinSpanFixture(): SCANHeightGrid {
  return {
    width: 2,
    height: 2,
    minMetres: -1400,
    maxMetres: 6700,
    heights: encodeInt16LE([-1400, 500, 1500, 6700]),
  };
}

function openGate() {
  return { data: null, version: 0, width: 0, height: 0, hasAnySource: false };
}

function fullyCoveredGate() {
  const width = 4;
  const height = 4;
  return {
    data: new Uint8Array(width * height).fill(255),
    version: 1,
    width,
    height,
    hasAnySource: true,
  };
}

function fullyUncoveredGate() {
  const width = 4;
  const height = 4;
  return {
    data: new Uint8Array(width * height),
    version: 1,
    width,
    height,
    hasAnySource: true,
  };
}

function baseLayerProps(
  overrides: Partial<SlotProps<"map-view.base">> = {},
): SlotProps<"map-view.base"> {
  return {
    bodyId: "Kerbin",
    width: 900,
    height: 500,
    augmentSettings: undefined,
    coverageGate: openGate(),
    onLayer: vi.fn(),
    ...overrides,
  };
}

const renderedTrees: Array<() => void> = [];

function renderSlot(ui: ReactElement) {
  const result = render(ui);
  renderedTrees.push(result.unmount);
  return result;
}

describe("AltimetryBase: map-view.base slot", () => {
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
  // Shared across every getContext("2d") call in a test (mirrors a real
  // canvas: repeated getContext calls on the same element return the same
  // logical context): a fresh object literal per call, as FootprintOverlay's
  // test used, would silently make later `canvas.getContext("2d")` calls in
  // the test body return an empty, disconnected recorder.
  let paintCalls: string[];
  let paintFillStyles: string[];

  beforeEach(() => {
    clearRegistry();
    registerStockBodies();

    paintCalls = [];
    paintFillStyles = [];
    let currentFillStyle = "";
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = ((contextId: string): unknown => {
      if (contextId !== "2d") return null;
      return {
        clearRect: (...args: number[]) =>
          paintCalls.push(`clearRect ${args.join(",")}`),
        fillRect: (...args: number[]) => {
          paintCalls.push(`fillRect ${args.join(",")}`);
          paintFillStyles.push(currentFillStyle);
        },
        get fillStyle() {
          return currentFillStyle;
        },
        set fillStyle(v: string) {
          currentFillStyle = v;
        },
      };
    }) as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    for (const unmount of renderedTrees) unmount();
    renderedTrees.length = 0;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  function mountWithAvailability(props: SlotProps<"map-view.base">) {
    const transport = new StubTransport();
    const client = createTestTelemetryClient(transport);
    renderSlot(
      <TelemetryProvider client={client}>
        <WithScansatAvailability>
          <AugmentSlot name="map-view.base" props={props} />
        </WithScansatAvailability>
      </TelemetryProvider>,
    );
    return { transport };
  }

  it("never calls onLayer while the scansat domain has not announced availability", () => {
    const onLayer = vi.fn();
    const { transport } = mountWithAvailability(baseLayerProps({ onLayer }));
    act(() => {
      transport.emit("scansat.height.Kerbin", heightGridFixture());
    });
    expect(onLayer).not.toHaveBeenCalled();
  });

  it("calls onLayer(id, null, 0) once live but this layer's own show setting is off", async () => {
    const onLayer = vi.fn();
    const { transport } = mountWithAvailability(
      baseLayerProps({
        onLayer,
        augmentSettings: { [ALTIMETRY_LAYER_ID]: { show: false } },
      }),
    );
    act(() => {
      transport.emit("scansat.available", true, {
        quality: Quality.Loaded,
        source: "scansat",
      });
    });
    await waitFor(() =>
      expect(transport.isSubscribed("scansat.height.Kerbin")).toBe(true),
    );
    act(() => {
      transport.emit("scansat.height.Kerbin", heightGridFixture(), {
        quality: Quality.Loaded,
        source: "scansat",
      });
    });
    await waitFor(() => {
      expect(onLayer).toHaveBeenCalledWith(ALTIMETRY_LAYER_ID, null, 0);
    });
  });

  it("paints a fixed BASE_LAYER_CANVAS_W x H canvas when active, regardless of the live width/height passed down", async () => {
    const onLayer = vi.fn();
    const { transport } = mountWithAvailability(
      // Deliberately a very different "viewport size" from the fixed paint
      // resolution: proves the canvas allocation ignores ctx.width/height.
      baseLayerProps({ onLayer, width: 321, height: 111 }),
    );
    act(() => {
      transport.emit("scansat.available", true, {
        quality: Quality.Loaded,
        source: "scansat",
      });
    });
    await waitFor(() =>
      expect(transport.isSubscribed("scansat.height.Kerbin")).toBe(true),
    );
    act(() => {
      transport.emit("scansat.height.Kerbin", heightGridFixture(), {
        quality: Quality.Loaded,
        source: "scansat",
      });
    });
    await waitFor(() => {
      expect(onLayer).toHaveBeenCalled();
    });
    const [id, canvas] = onLayer.mock.calls[onLayer.mock.calls.length - 1] as [
      string,
      HTMLCanvasElement,
      number,
    ];
    expect(id).toBe(ALTIMETRY_LAYER_ID);
    expect(canvas.width).toBe(BASE_LAYER_CANVAS_W);
    expect(canvas.height).toBe(BASE_LAYER_CANVAS_H);
  });

  it("paints nothing when every tile is fully uncovered", async () => {
    const onLayer = vi.fn();
    const { transport } = mountWithAvailability(
      baseLayerProps({ onLayer, coverageGate: fullyUncoveredGate() }),
    );
    act(() => {
      transport.emit("scansat.available", true, {
        quality: Quality.Loaded,
        source: "scansat",
      });
    });
    await waitFor(() =>
      expect(transport.isSubscribed("scansat.height.Kerbin")).toBe(true),
    );
    act(() => {
      transport.emit("scansat.height.Kerbin", heightGridFixture(), {
        quality: Quality.Loaded,
        source: "scansat",
      });
    });
    await waitFor(() => expect(onLayer).toHaveBeenCalled());
    expect(paintCalls.length).toBeGreaterThan(0);
    expect(paintCalls.every((c) => c.startsWith("clearRect"))).toBe(true);
  });

  it("paints the colormap at full opacity when every tile is fully covered", async () => {
    const onLayer = vi.fn();
    const { transport } = mountWithAvailability(
      baseLayerProps({ onLayer, coverageGate: fullyCoveredGate() }),
    );
    act(() => {
      transport.emit("scansat.available", true, {
        quality: Quality.Loaded,
        source: "scansat",
      });
    });
    await waitFor(() =>
      expect(transport.isSubscribed("scansat.height.Kerbin")).toBe(true),
    );
    act(() => {
      transport.emit("scansat.height.Kerbin", heightGridFixture(), {
        quality: Quality.Loaded,
        source: "scansat",
      });
    });
    await waitFor(() => expect(onLayer).toHaveBeenCalled());
    expect(paintCalls.some((c) => c.startsWith("fillRect"))).toBe(true);
    expect(paintFillStyles.every((s) => s.endsWith(", 1)"))).toBe(true);
  });

  it("paints the colormap unconditionally when hasAnySource is false (degenerate open case)", async () => {
    const onLayer = vi.fn();
    const { transport } = mountWithAvailability(
      baseLayerProps({ onLayer, coverageGate: openGate() }),
    );
    act(() => {
      transport.emit("scansat.available", true, {
        quality: Quality.Loaded,
        source: "scansat",
      });
    });
    await waitFor(() =>
      expect(transport.isSubscribed("scansat.height.Kerbin")).toBe(true),
    );
    act(() => {
      transport.emit("scansat.height.Kerbin", heightGridFixture(), {
        quality: Quality.Loaded,
        source: "scansat",
      });
    });
    await waitFor(() => expect(onLayer).toHaveBeenCalled());
    expect(paintCalls.some((c) => c.startsWith("fillRect"))).toBe(true);
  });

  it("paints Kerbin's grassland as land once the body catalogue says Kerbin has an ocean", async () => {
    const onLayer = vi.fn();
    const { transport } = mountWithAvailability(baseLayerProps({ onLayer }));
    act(() => {
      transport.emit("scansat.available", true, {
        quality: Quality.Loaded,
        source: "scansat",
      });
    });
    await waitFor(() =>
      expect(transport.isSubscribed("scansat.height.Kerbin")).toBe(true),
    );
    act(() => {
      transport.emit("system.bodies", {
        bodies: [{ index: 1, name: "Kerbin", hasOcean: true }],
      });
      transport.emit("scansat.height.Kerbin", kerbinSpanFixture(), {
        quality: Quality.Loaded,
        source: "scansat",
      });
    });
    await waitFor(() => {
      // Cells paint in grid order: -1400 m, 500 m, 1500 m, 6700 m.
      expect(paintFillStyles.slice(-4)).toEqual([
        "rgba(20, 50, 110, 1)",
        "rgba(80, 150, 90, 1)",
        "rgba(80, 150, 90, 1)",
        "rgba(220, 220, 220, 1)",
      ]);
    });
  });
});

describe("altimetryColour", () => {
  const DEEP_WATER = "20, 50, 110";
  const SHALLOW_WATER = "40, 100, 160";
  const LOWLAND = "80, 150, 90";
  const HIGHLAND = "140, 110, 60";
  const PEAK = "220, 220, 220";

  it("paints Kerbin's lowland above sea level as land, not shallow water", () => {
    expect(altimetryColour(500, -1400, 6700, true)).toBe(LOWLAND);
    expect(altimetryColour(1500, -1400, 6700, true)).toBe(LOWLAND);
    expect(altimetryColour(0, -1400, 6700, true)).toBe(LOWLAND);
  });

  it("keeps water below sea level on an ocean body, deep then shallow", () => {
    expect(altimetryColour(-1400, -1400, 6700, true)).toBe(DEEP_WATER);
    expect(altimetryColour(-200, -1400, 6700, true)).toBe(SHALLOW_WATER);
    expect(altimetryColour(-1, -1400, 6700, true)).toBe(SHALLOW_WATER);
  });

  it("spreads the land stops over sea level to the highest peak", () => {
    expect(altimetryColour(3000, -1400, 6700, true)).toBe(HIGHLAND);
    expect(altimetryColour(6700, -1400, 6700, true)).toBe(PEAK);
  });

  it("paints no water on an ocean body whose grid never dips below sea level", () => {
    expect(altimetryColour(0, 0, 3000, true)).toBe(LOWLAND);
  });

  it("spreads all five stops over the whole span on a body with no ocean", () => {
    expect(altimetryColour(-500, -500, 7000, false)).toBe(DEEP_WATER);
    expect(altimetryColour(1500, -500, 7000, false)).toBe(SHALLOW_WATER);
    expect(altimetryColour(3000, -500, 7000, false)).toBe(LOWLAND);
    expect(altimetryColour(4500, -500, 7000, false)).toBe(HIGHLAND);
    expect(altimetryColour(7000, -500, 7000, false)).toBe(PEAK);
  });
});
