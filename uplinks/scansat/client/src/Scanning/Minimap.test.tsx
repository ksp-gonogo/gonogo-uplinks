import "fake-indexeddb/auto";
import type { BodyDefinition, DataKey } from "@ksp-gonogo/sitrep-sdk";
import {
  BufferedDataSource,
  clearFogRevealSources,
  clearRegistry,
  DEFAULT_PROFILE_ID,
  FogMaskCacheProvider,
  FogMaskStore,
  MemoryStore,
  registerDataSource,
  registerFogRevealSource,
} from "@ksp-gonogo/sitrep-sdk";
import {
  act,
  MockDataSource,
  render,
  waitFor,
} from "@ksp-gonogo/sitrep-sdk/testing";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SCANBiomeGrid } from "../schema.js";
import {
  BASE_LAYER_CANVAS_H,
  BASE_LAYER_CANVAS_W,
} from "../TerrainBase/paintTile.js";
import { Minimap } from "./Minimap.js";

const BODY: BodyDefinition = {
  id: "Kerbin",
  name: "Kerbin",
  radius: 600000,
  hasAtmosphere: true,
  maxAtmosphere: 70000,
};
const LAYER_ID = "scansat-test:biome";

function encodeBytes(values: number[]): string {
  return Buffer.from(values).toString("base64");
}

function biomeGridFixture(): SCANBiomeGrid {
  // 2x2 grid, every cell painted the same biome; keeps the coverage-gate
  // assertions about which tiles paint entirely about the gate, not about
  // which biome index each cell happens to carry.
  return {
    width: 2,
    height: 2,
    biomes: [
      { name: "Grasslands", displayName: "Grasslands", colour: 0x33cc66 },
    ],
    indices: encodeBytes([0, 0, 0, 0]),
  };
}

interface RecordedCall {
  kind: "clearRect" | "fillRect" | "drawImage" | "fill";
  canvasW: number;
  canvasH: number;
  fillStyle?: string;
}

describe("Minimap: coverage-gated scan surface (own mod-local paint gate, no components-package canvas hooks)", () => {
  let source: MockDataSource;
  let buffered: BufferedDataSource;
  let store: FogMaskStore;
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
  let calls: RecordedCall[];
  const renderedTrees: Array<() => void> = [];

  function renderMinimap(ui: ReactElement) {
    const result = render(ui);
    renderedTrees.push(result.unmount);
    return result;
  }

  beforeEach(async () => {
    clearRegistry();
    const keys: DataKey[] = [
      { key: "scansat.biome.Kerbin" },
      { key: "scansat.anomalies.Kerbin" },
    ];
    source = new MockDataSource({ keys });
    buffered = new BufferedDataSource({ source, store: new MemoryStore() });
    registerDataSource(buffered);
    await buffered.connect();

    store = new FogMaskStore({ dbName: `gonogo-fog-test-${Math.random()}` });

    calls = [];
    let currentFillStyle = "";
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string,
    ): unknown {
      if (contextId !== "2d") return null;

      return {
        clearRect: () =>
          calls.push({
            kind: "clearRect",
            canvasW: this.width,
            canvasH: this.height,
          }),
        fillRect: () =>
          calls.push({
            kind: "fillRect",
            canvasW: this.width,
            canvasH: this.height,
            fillStyle: currentFillStyle,
          }),
        drawImage: () =>
          calls.push({
            kind: "drawImage",
            canvasW: this.width,
            canvasH: this.height,
          }),
        fill: () =>
          calls.push({
            kind: "fill",
            canvasW: this.width,
            canvasH: this.height,
          }),
        beginPath: () => {},
        arc: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fillText: () => {},
        get fillStyle() {
          return currentFillStyle;
        },
        set fillStyle(v: string) {
          currentFillStyle = v;
        },
        set strokeStyle(_v: string) {},
        set lineWidth(_v: number) {},
        set textAlign(_v: string) {},
        set font(_v: string) {},
        set imageSmoothingEnabled(_v: boolean) {},
      };
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    for (const unmount of renderedTrees) unmount();
    renderedTrees.length = 0;
    buffered.disconnect();
    clearFogRevealSources();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  function offscreenCalls() {
    return calls.filter(
      (c) =>
        c.canvasW === BASE_LAYER_CANVAS_W && c.canvasH === BASE_LAYER_CANVAS_H,
    );
  }

  function visibleDrawImageCalls() {
    return calls.filter(
      (c) => c.kind === "drawImage" && c.canvasW !== BASE_LAYER_CANVAS_W,
    );
  }

  /**
   * paintTile always opens with a clearRect, then zero-or-more fillRects.
   * The coverage gate settles over several commits (a synchronous "data
   * hasn't resolved yet" open default, then the real composite once
   * `cache.acquire` resolves): Minimap repaints on every one of those, so
   * `calls` accumulates several whole paintTile invocations. Slicing from
   * the LAST clearRect isolates just the most recent (settled) one.
   */
  function latestPaintTileInvocation(): RecordedCall[] {
    const off = offscreenCalls();
    const lastClear = off.map((c) => c.kind).lastIndexOf("clearRect");
    expect(lastClear).toBeGreaterThanOrEqual(0);
    return off.slice(lastClear);
  }

  it("paints the biome colormap unconditionally when no coverage source is registered (degenerate open case)", async () => {
    renderMinimap(
      <FogMaskCacheProvider store={store}>
        <Minimap body={BODY} vesselLat={0} vesselLon={0} />
      </FogMaskCacheProvider>,
    );
    act(() => {
      source.emit("scansat.biome.Kerbin", biomeGridFixture());
    });

    await waitFor(() => {
      const latest = latestPaintTileInvocation();
      const fills = latest.filter((c) => c.kind === "fillRect");
      expect(fills.length).toBeGreaterThan(0);
      expect(fills.every((c) => c.fillStyle?.endsWith(", 1)"))).toBe(true);
    });
  });

  it("falls through to the dark base (paints nothing on the colormap surface) when a registered coverage source reports full un-coverage", async () => {
    registerFogRevealSource({ id: LAYER_ID, weight: 255 });
    renderMinimap(
      <FogMaskCacheProvider store={store}>
        <Minimap body={BODY} vesselLat={0} vesselLon={0} />
      </FogMaskCacheProvider>,
    );
    act(() => {
      source.emit("scansat.biome.Kerbin", biomeGridFixture());
    });

    await waitFor(() => {
      const latest = latestPaintTileInvocation();
      expect(latest.every((c) => c.kind === "clearRect")).toBe(true);
    });
  });

  it("shows the biome colormap at full opacity for tiles a registered coverage source reports as fully covered", async () => {
    registerFogRevealSource({ id: LAYER_ID, weight: 255 });
    await store.save(
      DEFAULT_PROFILE_ID,
      BODY.id,
      LAYER_ID,
      new Uint8Array(4).fill(255),
      2,
      2,
    );
    renderMinimap(
      <FogMaskCacheProvider store={store}>
        <Minimap body={BODY} vesselLat={0} vesselLon={0} />
      </FogMaskCacheProvider>,
    );
    act(() => {
      source.emit("scansat.biome.Kerbin", biomeGridFixture());
    });

    await waitFor(() => {
      const latest = latestPaintTileInvocation();
      const fills = latest.filter((c) => c.kind === "fillRect");
      expect(fills.length).toBeGreaterThan(0);
      expect(fills.every((c) => c.fillStyle?.endsWith(", 1)"))).toBe(true);
    });
  });

  it("draws exactly one drawImage onto the visible canvas per repaint, no separate dark-fog-overlay composite", async () => {
    renderMinimap(
      <FogMaskCacheProvider store={store}>
        <Minimap body={BODY} vesselLat={0} vesselLon={0} />
      </FogMaskCacheProvider>,
    );
    act(() => {
      source.emit("scansat.biome.Kerbin", biomeGridFixture());
    });

    await waitFor(() => {
      expect(visibleDrawImageCalls().length).toBe(1);
    });
  });

  // Anomaly markers are the only `fill()` the visible canvas takes (the
  // crosshair strokes, the colormap arrives as one drawImage), so counting
  // them counts markers. A known anomaly whose fix did not decode used to
  // default to 0/0 and land inside a window centred on 0°N 0°E: a marker on
  // the map for a site whose position nobody read.
  it("plants no anomaly marker for a known anomaly with no readable coordinates", async () => {
    renderMinimap(
      <FogMaskCacheProvider store={store}>
        <Minimap body={BODY} vesselLat={0} vesselLon={0} />
      </FogMaskCacheProvider>,
    );
    act(() => {
      source.emit("scansat.biome.Kerbin", biomeGridFixture());
      source.emit("scansat.anomalies.Kerbin", [
        // In-window and fully readable: the control, so a count of 1 below
        // means "one was filtered", not "nothing rendered at all".
        { name: "Monolith", latitude: 5, longitude: 5, known: true, detail: true },
        {
          name: "Unfixed",
          latitude: null,
          longitude: null,
          known: true,
          detail: true,
        },
      ]);
    });

    await waitFor(() => {
      const markers = calls.filter(
        (c) => c.kind === "fill" && c.canvasW !== BASE_LAYER_CANVAS_W,
      );
      expect(markers.length).toBe(1);
    });
  });
});
