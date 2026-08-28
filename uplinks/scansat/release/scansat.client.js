// uplinks/scansat/client/src/Scanning/index.tsx
import {
  getBody as getBody2,
  registerComponent,
  useTelemetry as useTelemetry3,
  value as value2
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  Card,
  Cluster,
  EmptyState,
  Grid,
  magnitudeOf as magnitudeOf2,
  NULL_DISPLAY,
  Panel,
  PanelTitle,
  ProgressBar,
  ScrollArea,
  Section,
  SectionTitle,
  Stack,
  Text,
  Unit as Unit2,
  WidgetScopeProvider,
  WidgetSections
} from "@ksp-gonogo/ui-kit";
import { useMemo as useMemo2 } from "react";

// uplinks/scansat/client/src/FogReveal/useScanLayers.ts
import { useTelemetry } from "@ksp-gonogo/sitrep-sdk";
import { useMemo } from "react";

// uplinks/scansat/client/src/FogReveal/scanDecode.ts
function decodeHeightGrid(grid) {
  if (typeof grid.heights !== "string") return null;
  const bytes = base64ToBytes(grid.heights);
  const expected = grid.width * grid.height * 2;
  if (bytes.length < expected) return null;
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + expected);
  return {
    width: grid.width,
    height: grid.height,
    minMetres: grid.minMetres,
    maxMetres: grid.maxMetres,
    metres: new Int16Array(buf)
  };
}
function decodeBiomeGrid(grid) {
  if (typeof grid.indices !== "string") return null;
  const indices = base64ToBytes(grid.indices);
  if (indices.length < grid.width * grid.height) return null;
  return {
    width: grid.width,
    height: grid.height,
    biomes: grid.biomes,
    indices
  };
}
function base64ToBytes(b64) {
  if (typeof atob !== "undefined") {
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  const g = globalThis;
  if (g.Buffer) {
    const buf = g.Buffer.from(b64, "base64");
    const out = new Uint8Array(buf.length);
    for (let i = 0; i < buf.length; i++) out[i] = buf[i];
    return out;
  }
  return new Uint8Array(0);
}

// uplinks/scansat/client/src/FogReveal/useScanLayers.ts
function useScanHeightGrid(bodyName, dataSourceId = "data") {
  const raw = useTelemetry(
    dataSourceId,
    bodyName ? `scansat.height.${bodyName}` : "scansat.available"
  );
  return useMemo(() => {
    if (!bodyName) return void 0;
    if (raw == null) return raw;
    return decodeHeightGrid(raw);
  }, [raw, bodyName]);
}
function useScanBiomeGrid(bodyName, dataSourceId = "data") {
  const raw = useTelemetry(
    dataSourceId,
    bodyName ? `scansat.biome.${bodyName}` : "scansat.available"
  );
  return useMemo(() => {
    if (!bodyName) return void 0;
    if (raw == null) return raw;
    return decodeBiomeGrid(raw);
  }, [raw, bodyName]);
}
function useScanAnomalies(bodyName, dataSourceId = "data") {
  const raw = useTelemetry(
    dataSourceId,
    bodyName ? `scansat.anomalies.${bodyName}` : "scansat.available"
  );
  if (!bodyName) return void 0;
  if (raw == null) return raw;
  return raw;
}
function useScanningVessels(dataSourceId = "data") {
  return useTelemetry(
    dataSourceId,
    "scansat.scanningVessels"
  );
}

// uplinks/scansat/client/src/schema.ts
var SCAN_TYPE = {
  AltimetryLoRes: 1,
  AltimetryHiRes: 2,
  Biome: 8,
  Anomaly: 16,
  AnomalyDetail: 32,
  ResourceLoRes: 128,
  ResourceHiRes: 256
};

// uplinks/scansat/client/src/uplink.ts
import { defineUplinkClient } from "@ksp-gonogo/sitrep-sdk";
var UPLINK_VERSION = "0.0.1";
var SCANSAT = defineUplinkClient({
  id: "scansat",
  version: UPLINK_VERSION,
  name: "SCANsat"
});

// uplinks/scansat/client/src/Scanning/Minimap.tsx
import {
  useTelemetry as useTelemetry2,
  value
} from "@ksp-gonogo/sitrep-sdk";
import {
  magnitudeOf,
  magnitudeOr,
  NullValue,
  Unit,
  useElementSize
} from "@ksp-gonogo/ui-kit";
import { useEffect as useEffect3, useRef } from "react";
import styled from "styled-components";

// uplinks/scansat/client/src/FogReveal/useScanCoverageGate.ts
import {
  getFogRevealSources,
  onFogRevealSourcesChange,
  useFogMaskCache
} from "@ksp-gonogo/sitrep-sdk";
import { useEffect, useState, useSyncExternalStore } from "react";
var DEFAULT_WEIGHT = 255;
function compositeScanCoverage(sources, masksByLayer, augmentSettings, pixelIndex) {
  let reveal = 0;
  for (const source of sources) {
    if (augmentSettings?.[source.id]?.show === false) continue;
    const m = masksByLayer.get(source.id);
    if (!m) continue;
    const weight = source.weight ?? DEFAULT_WEIGHT;
    const v = Math.round(m.data[pixelIndex] * weight / 255);
    if (v > reveal) reveal = v;
  }
  return reveal;
}
var cachedSources = getFogRevealSources();
onFogRevealSourcesChange(() => {
  cachedSources = getFogRevealSources();
});
function getSourcesSnapshot() {
  return cachedSources;
}
function useScanCoverageGate(bodyId, augmentSettings) {
  const sources = useSyncExternalStore(
    onFogRevealSourcesChange,
    getSourcesSnapshot,
    getSourcesSnapshot
  );
  const cache = useFogMaskCache();
  const [gate, setGate] = useState({
    data: null,
    version: 0,
    width: 0,
    height: 0,
    hasAnySource: cache != null && sources.length > 0
  });
  useEffect(() => {
    if (!cache) {
      setGate((g) => ({ ...g, data: null, hasAnySource: false }));
      return;
    }
    if (!bodyId || sources.length === 0) {
      setGate((g) => ({ ...g, data: null, hasAnySource: sources.length > 0 }));
      return;
    }
    let cancelled = false;
    const masksByLayer = /* @__PURE__ */ new Map();
    const unsubs = [];
    let width = 0;
    let height = 0;
    function recompute() {
      if (cancelled || width === 0) return;
      const len = width * height;
      const out = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        out[i] = compositeScanCoverage(
          sources,
          masksByLayer,
          augmentSettings,
          i
        );
      }
      setGate((g) => ({
        data: out,
        version: g.version + 1,
        width,
        height,
        hasAnySource: true
      }));
    }
    for (const source of sources) {
      cache.acquire(bodyId, source.id).then((m) => {
        if (cancelled) return;
        width = m.width;
        height = m.height;
        masksByLayer.set(source.id, m);
        unsubs.push(cache.onChange(bodyId, source.id, recompute));
        recompute();
      });
    }
    return () => {
      cancelled = true;
      for (const u of unsubs) u();
    };
  }, [bodyId, sources, augmentSettings, cache]);
  return gate;
}

// uplinks/scansat/client/src/TerrainBase/BiomeBase.tsx
import {
  getBody,
  registerAugment
} from "@ksp-gonogo/sitrep-sdk";
import { useEffect as useEffect2 } from "react";

// uplinks/scansat/client/src/TerrainBase/paintTile.ts
var BASE_LAYER_CANVAS_W = 2048;
var BASE_LAYER_CANVAS_H = 1024;
function wrapLon(lon) {
  const wrapped = ((lon + 180) % 360 + 360) % 360 - 180;
  return wrapped === 180 ? -180 : wrapped;
}
function tileToPixelRect(iLon, iLat, maskW, maskH, longitudeOffset = 0, latitudeOffset = 0) {
  const physLonLo = iLon - 180;
  const physLatLo = iLat - 90;
  const texLonLo = wrapLon(physLonLo + longitudeOffset);
  const texLonHi = wrapLon(physLonLo + 1 + longitudeOffset);
  const texLatLo = physLatLo + latitudeOffset;
  const texLatHi = physLatLo + 1 + latitudeOffset;
  const y0 = Math.max(0, Math.floor((90 - texLatHi) / 180 * maskH));
  const y1 = Math.min(maskH, Math.ceil((90 - texLatLo) / 180 * maskH));
  const x0raw = (texLonLo + 180) / 360 * maskW;
  const x1raw = (texLonHi + 180) / 360 * maskW;
  if (x1raw > x0raw) {
    return {
      x0: Math.floor(x0raw),
      x1: Math.min(maskW, Math.ceil(x1raw)),
      y0,
      y1
    };
  }
  return {
    x0: Math.floor(x0raw),
    x1: maskW,
    x2: 0,
    x3: Math.min(maskW, Math.ceil(x1raw)),
    y0,
    y1
  };
}
function coverageAlphaForTile(iLon, iLat, body, gate) {
  if (!gate.hasAnySource) return 1;
  if (!gate.data || gate.width === 0 || gate.height === 0) return 1;
  const rect = tileToPixelRect(
    iLon,
    iLat,
    gate.width,
    gate.height,
    body.longitudeOffset ?? 0,
    body.latitudeOffset ?? 0
  );
  const x = Math.min(gate.width - 1, Math.max(0, rect.x0));
  const y = Math.min(gate.height - 1, Math.max(0, rect.y0));
  const byte = gate.data[y * gate.width + x] ?? 0;
  return byte / 255;
}
function withAlpha(rgbComponents, alpha) {
  return `rgba(${rgbComponents}, ${alpha})`;
}
function effectiveAlpha(coverageAlpha, layerOpacity) {
  return coverageAlpha * layerOpacity;
}
function paintTile(ctx, gridWidth, gridHeight, body, gate, colourAt, canvasW = BASE_LAYER_CANVAS_W, canvasH = BASE_LAYER_CANVAS_H, layerOpacity = 1) {
  ctx.clearRect(0, 0, canvasW, canvasH);
  for (let iLon = 0; iLon < gridWidth; iLon++) {
    for (let iLat = 0; iLat < gridHeight; iLat++) {
      const colour = colourAt(iLon, iLat);
      if (!colour) continue;
      const alpha = effectiveAlpha(
        coverageAlphaForTile(iLon, iLat, body, gate),
        layerOpacity
      );
      if (alpha <= 0) continue;
      const rect = tileToPixelRect(
        iLon,
        iLat,
        canvasW,
        canvasH,
        body.longitudeOffset ?? 0,
        body.latitudeOffset ?? 0
      );
      ctx.fillStyle = withAlpha(colour, alpha);
      ctx.fillRect(rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0);
      if (rect.x2 !== void 0 && rect.x3 !== void 0) {
        ctx.fillRect(rect.x2, rect.y0, rect.x3 - rect.x2, rect.y1 - rect.y0);
      }
    }
  }
}

// uplinks/scansat/client/src/TerrainBase/BiomeBase.tsx
var BIOME_LAYER_ID = "scansat:biome";
function packedColourToComponents(packed) {
  const r = packed >> 16 & 255;
  const g = packed >> 8 & 255;
  const b = packed & 255;
  return `${r}, ${g}, ${b}`;
}
var BIOME_LAYER_OPACITY = 0.6;
function BiomeBase(ctx) {
  const body = ctx.bodyId ? getBody(ctx.bodyId) : void 0;
  const biomeGrid = useScanBiomeGrid(body?.name);
  const show = ctx.augmentSettings?.[BIOME_LAYER_ID]?.show !== false;
  useEffect2(() => {
    if (!show) {
      ctx.onLayer(BIOME_LAYER_ID, null, 0);
      return;
    }
    if (!biomeGrid || !body || typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = BASE_LAYER_CANVAS_W;
    canvas.height = BASE_LAYER_CANVAS_H;
    const c2d = canvas.getContext("2d");
    if (!c2d) return;
    paintTile(
      c2d,
      biomeGrid.width,
      biomeGrid.height,
      body,
      ctx.coverageGate,
      (iLon, iLat) => {
        const idx = iLon * biomeGrid.height + iLat;
        const biomeIdx = biomeGrid.indices[idx];
        if (biomeIdx === 255) return null;
        const biome = biomeGrid.biomes[biomeIdx];
        if (!biome) return null;
        return packedColourToComponents(biome.colour);
      },
      BASE_LAYER_CANVAS_W,
      BASE_LAYER_CANVAS_H,
      BIOME_LAYER_OPACITY
    );
    ctx.onLayer(BIOME_LAYER_ID, canvas, Date.now());
    return () => ctx.onLayer(BIOME_LAYER_ID, null, 0);
  }, [show, ctx.onLayer, ctx.coverageGate, biomeGrid, body]);
  return null;
}
registerAugment({
  id: BIOME_LAYER_ID,
  // Draws ON TOP of AltimetryBase (priority 0, the default) within the
  // shared "scansat" Uplink group; see orderBaseLayers.ts: within a
  // group, ascending priority draws later (on top).
  priority: 10,
  augments: "map-view.base",
  requires: "scansat",
  component: BiomeBase,
  suppressesVanillaBase: true,
  settings: [
    {
      key: "show",
      type: "boolean",
      label: "Show biome",
      default: true
    }
  ],
  owner: SCANSAT
});

// uplinks/scansat/client/src/Scanning/Minimap.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var MAX_MINIMAP_PX = 240;
var WINDOW_HALF_DEG = 20;
var SRC_W = BASE_LAYER_CANVAS_W;
var SRC_H = BASE_LAYER_CANVAS_H;
function judgeable(reading) {
  if (reading.state === "observed") return reading.value;
  if (reading.state === "reckonable") return reading.reckoned.value;
  return void 0;
}
function Minimap({
  body,
  vesselLat,
  vesselLon
}) {
  const canvasRef = useRef(null);
  const paintCanvasRef = useRef(null);
  const { ref: wrapRef, size } = useElementSize({
    w: MAX_MINIMAP_PX,
    h: MAX_MINIMAP_PX
  });
  const minimapPx = Math.max(1, Math.min(MAX_MINIMAP_PX, size.w));
  const biomeGrid = useScanBiomeGrid(body.name);
  const coverageGate = useScanCoverageGate(body.id, void 0);
  const anomalies = useScanAnomalies(body.name);
  const scanningVessels = useScanningVessels();
  useEffect3(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, minimapPx, minimapPx);
    if (vesselLat === void 0 || vesselLon === void 0) {
      drawMissingVessel(ctx, minimapPx);
      return;
    }
    const texLat = vesselLat + (body.latitudeOffset ?? 0);
    const texLon = vesselLon + (body.longitudeOffset ?? 0);
    const srcCenterX = (wrapLon2(texLon) + 180) / 360 * SRC_W;
    const srcCenterY = (90 - texLat) / 180 * SRC_H;
    const halfWpx = WINDOW_HALF_DEG / 360 * SRC_W;
    const halfHpx = WINDOW_HALF_DEG / 180 * SRC_H;
    const sx = srcCenterX - halfWpx;
    const sy = Math.max(0, Math.min(SRC_H - 2 * halfHpx, srcCenterY - halfHpx));
    const sw = 2 * halfWpx;
    const sh = 2 * halfHpx;
    if (biomeGrid && typeof document !== "undefined") {
      if (!paintCanvasRef.current) {
        const c = document.createElement("canvas");
        c.width = BASE_LAYER_CANVAS_W;
        c.height = BASE_LAYER_CANVAS_H;
        paintCanvasRef.current = c;
      }
      const paintCanvas = paintCanvasRef.current;
      const paintCtx = paintCanvas.getContext("2d");
      if (paintCtx) {
        paintTile(
          paintCtx,
          biomeGrid.width,
          biomeGrid.height,
          body,
          coverageGate,
          (iLon, iLat) => {
            const idx = iLon * biomeGrid.height + iLat;
            const biomeIdx = biomeGrid.indices[idx];
            if (biomeIdx === 255) return null;
            const entry = biomeGrid.biomes[biomeIdx];
            if (!entry) return null;
            return packedColourToComponents(entry.colour);
          }
        );
        drawWindowed(ctx, paintCanvas, sx, sy, sw, sh, minimapPx);
      }
    }
    if (scanningVessels) {
      for (const v of scanningVessels) {
        if (v.body !== body.name) continue;
        drawScannerFootprint(ctx, body, v, texLat, texLon, minimapPx);
      }
    }
    if (anomalies) {
      for (const a of anomalies) {
        if (!a.known) continue;
        const aTexLat = magnitudeOr(a.latitude, 0) + (body.latitudeOffset ?? 0);
        const aTexLon = magnitudeOr(a.longitude, 0) + (body.longitudeOffset ?? 0);
        const dLat = aTexLat - texLat;
        const dLon = shortestLonDelta(wrapLon2(aTexLon), wrapLon2(texLon));
        if (Math.abs(dLat) > WINDOW_HALF_DEG) continue;
        if (Math.abs(dLon) > WINDOW_HALF_DEG) continue;
        const px = minimapPx / 2 + dLon / WINDOW_HALF_DEG * (minimapPx / 2);
        const py = minimapPx / 2 - dLat / WINDOW_HALF_DEG * (minimapPx / 2);
        ctx.fillStyle = a.detail ? "#ffeb3b" : "rgba(255, 235, 59, 0.55)";
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    drawCrosshair(ctx, minimapPx);
  }, [
    body,
    vesselLat,
    vesselLon,
    minimapPx,
    biomeGrid,
    coverageGate,
    anomalies,
    scanningVessels
  ]);
  return /* @__PURE__ */ jsxs(MinimapRoot, { ref: wrapRef, children: [
    /* @__PURE__ */ jsx(
      MinimapCanvas,
      {
        ref: canvasRef,
        width: minimapPx,
        height: minimapPx,
        "aria-label": `Live scan view centred on ${body.name}`
      }
    ),
    /* @__PURE__ */ jsxs(MinimapLabel, { children: [
      /* @__PURE__ */ jsx("strong", { children: body.name }),
      vesselLat !== void 0 && vesselLon !== void 0 ? /* @__PURE__ */ jsxs("span", { children: [
        /* @__PURE__ */ jsx(Unit, { value: value("\xB0", vesselLat) }),
        ",",
        " ",
        /* @__PURE__ */ jsx(Unit, { value: value("\xB0", vesselLon) })
      ] }) : /* @__PURE__ */ jsx(NullValue, {})
    ] })
  ] });
}
function MinimapForActiveVessel({
  body
}) {
  const flight = judgeable(useTelemetry2("vessel.flight"));
  return /* @__PURE__ */ jsx(
    Minimap,
    {
      body,
      vesselLat: flight?.latitude?.magnitude,
      vesselLon: flight?.longitude?.magnitude
    }
  );
}
function drawWindowed(ctx, source, sx, sy, sw, sh, px) {
  if (sx < 0) {
    const left = -sx;
    ctx.drawImage(
      source,
      SRC_W - left,
      sy,
      left,
      sh,
      0,
      0,
      left / sw * px,
      px
    );
    ctx.drawImage(
      source,
      0,
      sy,
      sw - left,
      sh,
      left / sw * px,
      0,
      (sw - left) / sw * px,
      px
    );
    return;
  }
  if (sx + sw > SRC_W) {
    const right = SRC_W - sx;
    ctx.drawImage(source, sx, sy, right, sh, 0, 0, right / sw * px, px);
    ctx.drawImage(
      source,
      0,
      sy,
      sw - right,
      sh,
      right / sw * px,
      0,
      (sw - right) / sw * px,
      px
    );
    return;
  }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, px, px);
}
function drawScannerFootprint(ctx, body, v, centerTexLat, centerTexLon, px) {
  const halfLat = magnitudeOf(v.groundTrackWidthDeg);
  const halfLon = magnitudeOf(v.groundTrackLonHalfDeg);
  if (halfLat == null || halfLat <= 0) return;
  if (halfLon == null || halfLon <= 0) return;
  const tc = v.trackColor;
  const fill = tc ? `rgba(${magnitudeOr(tc.r, 255)}, ${magnitudeOr(tc.g, 255)}, ${magnitudeOr(tc.b, 255)}, ${(magnitudeOr(tc.a, 255) / 255).toFixed(3)})` : "rgba(255, 255, 255, 0.4)";
  const vTexLat = magnitudeOr(v.subLatitude, 0) + (body.latitudeOffset ?? 0);
  const vTexLon = wrapLon2(
    magnitudeOr(v.subLongitude, 0) + (body.longitudeOffset ?? 0)
  );
  const dLatTop = vTexLat + halfLat - centerTexLat;
  const dLatBot = vTexLat - halfLat - centerTexLat;
  if (dLatTop < -WINDOW_HALF_DEG && dLatBot < -WINDOW_HALF_DEG) return;
  if (dLatTop > WINDOW_HALF_DEG && dLatBot > WINDOW_HALF_DEG) return;
  const yTop = px / 2 - clamp(dLatTop, -WINDOW_HALF_DEG, WINDOW_HALF_DEG) / WINDOW_HALF_DEG * (px / 2);
  const yBot = px / 2 - clamp(dLatBot, -WINDOW_HALF_DEG, WINDOW_HALF_DEG) / WINDOW_HALF_DEG * (px / 2);
  const dLon = shortestLonDelta(vTexLon, centerTexLon);
  const dLonLeft = dLon - halfLon;
  const dLonRight = dLon + halfLon;
  if (dLonLeft > WINDOW_HALF_DEG && dLonRight > WINDOW_HALF_DEG) return;
  if (dLonLeft < -WINDOW_HALF_DEG && dLonRight < -WINDOW_HALF_DEG) return;
  const xLeft = px / 2 + clamp(dLonLeft, -WINDOW_HALF_DEG, WINDOW_HALF_DEG) / WINDOW_HALF_DEG * (px / 2);
  const xRight = px / 2 + clamp(dLonRight, -WINDOW_HALF_DEG, WINDOW_HALF_DEG) / WINDOW_HALF_DEG * (px / 2);
  ctx.fillStyle = fill;
  ctx.fillRect(xLeft, yTop, xRight - xLeft, yBot - yTop);
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function drawCrosshair(ctx, px) {
  const c = px / 2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(c - 8, c);
  ctx.lineTo(c + 8, c);
  ctx.moveTo(c, c - 8);
  ctx.lineTo(c, c + 8);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0, 255, 136, 0.85)";
  ctx.beginPath();
  ctx.arc(c, c, 5, 0, Math.PI * 2);
  ctx.stroke();
}
function drawMissingVessel(ctx, px) {
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("no active vessel", px / 2, px / 2);
}
function wrapLon2(lon) {
  const wrapped = ((lon + 180) % 360 + 360) % 360 - 180;
  return wrapped === 180 ? -180 : wrapped;
}
function shortestLonDelta(a, b) {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}
var MinimapRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  max-width: ${MAX_MINIMAP_PX}px;
`;
var MinimapCanvas = styled.canvas`
  width: 100%;
  height: auto;
  aspect-ratio: 1 / 1;
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  image-rendering: pixelated;
`;
var MinimapLabel = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  strong {
    color: var(--color-text-primary);
    font-weight: 600;
  }
`;

// uplinks/scansat/client/src/Scanning/index.tsx
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var SCAN_TYPE_LABELS = {
  [SCAN_TYPE.AltimetryLoRes]: "Altimetry (Lo)",
  [SCAN_TYPE.AltimetryHiRes]: "Altimetry (Hi)",
  [SCAN_TYPE.Biome]: "Biome",
  [SCAN_TYPE.Anomaly]: "Anomaly",
  [SCAN_TYPE.AnomalyDetail]: "Anomaly detail",
  [SCAN_TYPE.ResourceLoRes]: "Resource (Lo)",
  [SCAN_TYPE.ResourceHiRes]: "Resource (Hi)"
};
var DISPLAY_SCAN_TYPES = [
  SCAN_TYPE.AltimetryHiRes,
  SCAN_TYPE.AltimetryLoRes,
  SCAN_TYPE.Biome,
  SCAN_TYPE.Anomaly,
  SCAN_TYPE.ResourceHiRes
];
function judgeable2(reading) {
  if (reading.state === "observed") return reading.value;
  if (reading.state === "reckonable") return reading.reckoned.value;
  return void 0;
}
function stillTrue(reading, whenConfirmedNothing) {
  if (reading.state === "observed") return reading.value;
  if (reading.state === "stale") return reading.value;
  if (reading.state === "reckonable") return reading.value;
  if (reading.state === "absent") return whenConfirmedNothing;
  return void 0;
}
function useActiveVesselBodyName() {
  const identity = stillTrue(useTelemetry3("vessel.identity"), void 0);
  const systemBodies = stillTrue(useTelemetry3("system.bodies"), void 0);
  return useMemo2(() => {
    const index = identity?.parentBodyIndex;
    if (index == null) return void 0;
    return systemBodies?.bodies.find((b) => b.index === index)?.name;
  }, [identity, systemBodies]);
}
function ScanningComponent({
  config
}) {
  const activeBody = useActiveVesselBodyName();
  const bodyName = config?.bodyName ?? activeBody;
  const surface = judgeable2(useTelemetry3("vessel.surface"));
  const biome = surface?.biome;
  const scanAvailable = stillTrue(useTelemetry3("scansat.available"), void 0);
  const scanningVessels = useScanningVessels();
  const anomalies = useScanAnomalies(bodyName);
  const scope = useMemo2(() => ({ bodyName }), [bodyName]);
  if (scanAvailable === false) {
    return /* @__PURE__ */ jsxs2(Panel, { children: [
      /* @__PURE__ */ jsx2(PanelTitle, { children: "Scanning" }),
      /* @__PURE__ */ jsx2(EmptyState, { children: "SCANsat is not installed. Install it for fog-of-war, biome imaging, anomaly tracking, and the per-vessel scanner readouts this widget surfaces." })
    ] });
  }
  const body = bodyName ? getBody2(bodyName) : void 0;
  return /* @__PURE__ */ jsx2(WidgetScopeProvider, { widget: "scanning", scope, children: /* @__PURE__ */ jsxs2(Panel, { panelSections: false, children: [
    /* @__PURE__ */ jsx2(Cluster, { children: /* @__PURE__ */ jsx2(PanelTitle, { children: "Scanning" }) }),
    /* @__PURE__ */ jsx2(ScrollArea, { children: /* @__PURE__ */ jsxs2(Stack, { gap: "lg", children: [
      biome ? /* @__PURE__ */ jsx2(Card, { children: /* @__PURE__ */ jsxs2(Text, { size: "sm", tone: "default", children: [
        "Biome: ",
        biome
      ] }) }) : null,
      body ? /* @__PURE__ */ jsxs2(Section, { children: [
        /* @__PURE__ */ jsx2(SectionTitle, { children: "Live view" }),
        /* @__PURE__ */ jsx2(MinimapForActiveVessel, { body })
      ] }) : null,
      /* @__PURE__ */ jsxs2(Section, { children: [
        /* @__PURE__ */ jsxs2(SectionTitle, { children: [
          "Coverage: ",
          bodyName ?? "?"
        ] }),
        bodyName ? /* @__PURE__ */ jsx2(Stack, { gap: "xs", children: DISPLAY_SCAN_TYPES.map((type) => /* @__PURE__ */ jsx2(
          CoverageRow,
          {
            bodyName,
            scanType: type
          },
          type
        )) }) : /* @__PURE__ */ jsx2(EmptyState, { children: "No active body." }),
        /* @__PURE__ */ jsx2(WidgetSections, {})
      ] }),
      /* @__PURE__ */ jsxs2(Section, { children: [
        /* @__PURE__ */ jsx2(SectionTitle, { children: "Scanning vessels" }),
        scanningVessels && scanningVessels.length > 0 ? /* @__PURE__ */ jsx2(Stack, { gap: "md", children: scanningVessels.map((v) => /* @__PURE__ */ jsx2(Card, { children: /* @__PURE__ */ jsxs2(Stack, { gap: "xs", children: [
          /* @__PURE__ */ jsxs2(Cluster, { children: [
            /* @__PURE__ */ jsx2(Text, { size: "sm", tone: "default", children: v.vesselName || "(unnamed)" }),
            /* @__PURE__ */ jsx2(Text, { size: "xs", tone: "muted", children: v.body })
          ] }),
          /* @__PURE__ */ jsxs2(Text, { size: "xs", tone: "muted", children: [
            "sub-point ",
            /* @__PURE__ */ jsx2(Unit2, { value: v.subLatitude, decimals: 2 }),
            ",",
            " ",
            /* @__PURE__ */ jsx2(Unit2, { value: v.subLongitude, decimals: 2 }),
            " \xB7 alt",
            " ",
            /* @__PURE__ */ jsx2(Unit2, { value: v.altitude, format: "km", decimals: 0 })
          ] }),
          /* @__PURE__ */ jsx2(Stack, { gap: "xs", children: v.sensors.length === 0 ? /* @__PURE__ */ jsx2(EmptyState, { children: "No scanners." }) : v.sensors.map((s, i) => /* @__PURE__ */ jsxs2(
            Grid,
            {
              cols: "140px 1fr auto",
              gap: "md",
              children: [
                /* @__PURE__ */ jsx2(Text, { size: "xs", tone: "default", children: SCAN_TYPE_LABELS[s.type] ?? `type=${s.type}` }),
                /* @__PURE__ */ jsxs2(Text, { size: "xs", tone: "muted", children: [
                  "FoV ",
                  /* @__PURE__ */ jsx2(Unit2, { value: s.fov, decimals: 1 }),
                  " \xB7 alt",
                  " ",
                  /* @__PURE__ */ jsx2(
                    Unit2,
                    {
                      value: s.minAlt,
                      format: "km",
                      decimals: 0
                    }
                  ),
                  "\u2013",
                  /* @__PURE__ */ jsx2(
                    Unit2,
                    {
                      value: s.maxAlt,
                      format: "km",
                      decimals: 0
                    }
                  )
                ] }),
                /* @__PURE__ */ jsx2(
                  Badge,
                  {
                    size: "sm",
                    severity: s.bestRange ? "nominal" : s.inRange ? "info" : void 0,
                    children: s.bestRange ? "best" : s.inRange ? "scanning" : "out of range"
                  }
                )
              ]
            },
            i
          )) })
        ] }) }, v.vesselId)) }) : /* @__PURE__ */ jsx2(EmptyState, { children: "No vessels tracked by SCANsat yet." })
      ] }),
      /* @__PURE__ */ jsxs2(Section, { children: [
        /* @__PURE__ */ jsxs2(SectionTitle, { children: [
          "Anomalies: ",
          bodyName ?? "?"
        ] }),
        anomalies && anomalies.length > 0 ? /* @__PURE__ */ jsx2(Stack, { gap: "xs", children: anomalies.map((a) => /* @__PURE__ */ jsxs2(
          Grid,
          {
            cols: "1fr auto",
            children: [
              /* @__PURE__ */ jsx2(Text, { size: "xs", tone: a.known ? "default" : "muted", children: a.detail ? a.name : a.known ? "(unknown)" : "(undetected)" }),
              /* @__PURE__ */ jsx2(Text, { size: "xs", tone: "muted", children: a.known ? /* @__PURE__ */ jsxs2(Fragment, { children: [
                /* @__PURE__ */ jsx2(Unit2, { value: a.latitude, decimals: 2 }),
                ",",
                " ",
                /* @__PURE__ */ jsx2(Unit2, { value: a.longitude, decimals: 2 })
              ] }) : NULL_DISPLAY })
            ]
          },
          `${a.name}-${magnitudeOf2(a.latitude)}`
        )) }) : /* @__PURE__ */ jsx2(EmptyState, { children: "None known." })
      ] })
    ] }) })
  ] }) });
}
function CoverageRow({
  bodyName,
  scanType
}) {
  const pct = useTelemetry3(
    "data",
    `scansat.coverage.${bodyName}.${scanType}`
  );
  const coverage = typeof pct === "number" ? pct : 0;
  return /* @__PURE__ */ jsxs2(Grid, { cols: "120px 1fr 60px", gap: "md", children: [
    /* @__PURE__ */ jsx2(Text, { size: "xs", tone: "default", children: SCAN_TYPE_LABELS[scanType] }),
    /* @__PURE__ */ jsx2(
      ProgressBar,
      {
        value: coverage,
        ariaLabel: `${SCAN_TYPE_LABELS[scanType]} coverage: ${bodyName}`
      }
    ),
    /* @__PURE__ */ jsx2(Text, { size: "xs", tone: "muted", children: /* @__PURE__ */ jsx2(Unit2, { value: value2("%", coverage), decimals: 1 }) })
  ] });
}
registerComponent({
  id: "scanning",
  name: "Scanning",
  description: "SCANsat status: per-scan-type coverage of the current body, the list of vessels SCANsat is tracking with their on-board scanners and live in-range state, and the body's known anomalies with discovery state.",
  tags: ["scan", "fleet"],
  defaultSize: { w: 6, h: 10 },
  minSize: { w: 3, h: 4 },
  component: ScanningComponent,
  openConfigOnAdd: false,
  dataRequirements: [
    "scansat.available",
    "scansat.scanningVessels",
    "vessel.identity",
    "system.bodies",
    "vessel.surface",
    // The minimap's own read, and it was missing: the app carries
    // `vessel.flight` by default so the widget worked, while the declaration a
    // stream-status badge and a render harness both derive from said the widget
    // did not need it, and the minimap rendered "no active vessel" forever.
    "vessel.flight"
  ],
  defaultConfig: {},
  actions: [],
  // Augment slot. `sections`: extra coverage rows appended to the
  // per-scan-type coverage list (a resource-scanning Uplink's own coverage is
  // the canonical filler). Renders nothing until an Uplink registers. Custom
  // map LAYERS go to map-view.overlay.
  augmentSlots: ["scanning.sections"],
  pushable: true,
  owner: SCANSAT
});

// uplinks/scansat/client/src/ScienceAugment/index.tsx
import { registerAugment as registerAugment2, useTelemetry as useTelemetry4 } from "@ksp-gonogo/sitrep-sdk";
import {
  Badge as Badge2,
  ScienceExperimentRow,
  TextButton
} from "@ksp-gonogo/ui-kit";
import { useId, useState as useState2 } from "react";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function stillTrue2(reading, whenConfirmedNothing) {
  if (reading.state === "observed") return reading.value;
  if (reading.state === "stale") return reading.value;
  if (reading.state === "reckonable") return reading.value;
  if (reading.state === "absent") return whenConfirmedNothing;
  return void 0;
}
function parseScanScience(raw) {
  if (raw === null || raw === void 0) return null;
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const e = entry;
    const partId = typeof e.partId === "string" ? e.partId : null;
    if (partId === null) continue;
    out.push({
      partId,
      partTitle: typeof e.partTitle === "string" ? e.partTitle : "Unknown part",
      expId: typeof e.expId === "string" ? e.expId : "",
      deployed: e.deployed === true,
      hasData: e.hasData === true,
      rerunnable: e.rerunnable === true,
      inoperable: e.inoperable === true
    });
  }
  return out;
}
function ScansatScienceAugment(_props) {
  const raw = stillTrue2(useTelemetry4("scansat.science"), void 0);
  const experiments = parseScanScience(raw);
  const [expanded, setExpanded] = useState2(false);
  const panelId = useId();
  if (experiments === null || experiments.length === 0) return null;
  return /* @__PURE__ */ jsxs3("div", { style: WRAP, children: [
    /* @__PURE__ */ jsx3(
      TextButton,
      {
        type: "button",
        "aria-expanded": expanded,
        "aria-controls": panelId,
        "aria-label": `SCANsat science instruments (${experiments.length})`,
        onClick: () => setExpanded((v) => !v),
        style: DISCLOSURE_BUTTON,
        children: /* @__PURE__ */ jsxs3(Badge2, { severity: "info", children: [
          "SCANSAT ",
          experiments.length
        ] })
      }
    ),
    expanded && // `<section>` for its implicit role="region" (a plain
    // `<div role="region">` trips biome's useSemanticElements).
    /* @__PURE__ */ jsx3("section", { id: panelId, "aria-label": "SCANsat science", style: DROPDOWN, children: /* @__PURE__ */ jsx3("ul", { style: ROW_LIST, children: experiments.map((inst) => /* @__PURE__ */ jsx3(ScienceExperimentRow, { instrument: inst }, inst.partId)) }) })
  ] });
}
var WRAP = { position: "relative" };
var DISCLOSURE_BUTTON = {
  display: "inline-flex",
  padding: 0,
  borderRadius: "var(--radius-sm)"
};
var DROPDOWN = {
  position: "absolute",
  top: "100%",
  right: 0,
  // Literal, and NOT --z-dropdown. This menu renders inside Experiments's
  // ui-kit Panel, which is overflow: hidden, so it is clipped at the panel
  // edge before any z-index is consulted; and that panel sits in a
  // .react-grid-item, which react-grid-layout gives a transform (its
  // useCSSTransforms default), making it a stacking context nothing inside
  // can escape. So the 20 orders nothing but its own siblings, of which there
  // are none, and promoting it would record a stacking fix that has not
  // happened. The real fix is to portal the dropdown out of the panel.
  zIndex: 20,
  marginTop: "var(--space-4)",
  minWidth: "220px",
  maxWidth: "320px",
  padding: "var(--space-8)",
  background: "var(--color-surface-raised)",
  border: "1px solid var(--color-border-subtle)",
  borderRadius: "var(--radius-md)",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.35)"
};
var ROW_LIST = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)"
};
registerAugment2({
  id: "scansat-science",
  augments: "experiments.actions",
  requires: "scansat",
  channels: ["scansat.science"],
  component: ScansatScienceAugment,
  owner: SCANSAT
});

// uplinks/scansat/client/src/topics.ts
import {
  registerBarePrimitiveTopic,
  registerTopicUnits,
  registerTypeUnits
} from "@ksp-gonogo/sitrep-sdk";

// uplinks/scansat/client/src/__generated__/units.ts
var GENERATED_TYPE_UNITS = {
  "ScanAnomalyEntry": {
    detail: "flag",
    known: "flag",
    latitude: "\xB0",
    longitude: "\xB0",
    name: "text"
  },
  "ScanScienceEntry": {
    deployed: "flag",
    expId: "id",
    hasData: "flag",
    inoperable: "flag",
    partId: "id",
    partTitle: "text",
    rerunnable: "flag",
    title: "text"
  },
  "ScanSensorEntry": {
    bestAlt: "m",
    bestRange: "flag",
    fov: "\xB0",
    inRange: "flag",
    maxAlt: "m",
    minAlt: "m",
    type: "id"
  },
  "ScanTrackColor": {
    a: "count",
    b: "count",
    g: "count",
    r: "count"
  },
  "ScanningVesselEntry": {
    altitude: "m",
    body: "text",
    groundTrackLonHalfDeg: "\xB0",
    groundTrackWidthDeg: "\xB0",
    subLatitude: "\xB0",
    subLongitude: "\xB0",
    vesselId: "id",
    vesselName: "text"
  }
};
var GENERATED_TOPIC_UNITS = {
  "scansat.scanningVessels": {
    altitude: "m",
    body: "text",
    groundTrackLonHalfDeg: "\xB0",
    groundTrackWidthDeg: "\xB0",
    subLatitude: "\xB0",
    subLongitude: "\xB0",
    vesselId: "id",
    vesselName: "text"
  },
  "scansat.science": {
    deployed: "flag",
    expId: "id",
    hasData: "flag",
    inoperable: "flag",
    partId: "id",
    partTitle: "text",
    rerunnable: "flag",
    title: "text"
  }
};
var GENERATED_TYPE_SHAPES = {
  "ScanningVesselEntry": {
    sensors: "ScanSensorEntry[]",
    trackColor: "ScanTrackColor"
  }
};
var GENERATED_TOPIC_SHAPES = {
  "scansat.scanningVessels": {
    sensors: "ScanSensorEntry[]",
    trackColor: "ScanTrackColor"
  }
};

// uplinks/scansat/client/src/topics.ts
var SCANSAT_AVAILABLE_TOPIC = "scansat.available";
var SCANSAT_SCANNING_VESSELS_TOPIC = "scansat.scanningVessels";
var SCANSAT_SCIENCE_TOPIC = "scansat.science";
registerBarePrimitiveTopic(SCANSAT_AVAILABLE_TOPIC);
registerBarePrimitiveTopic(SCANSAT_SCANNING_VESSELS_TOPIC);
registerBarePrimitiveTopic(SCANSAT_SCIENCE_TOPIC);
for (const [topic, units] of Object.entries(GENERATED_TOPIC_UNITS)) {
  registerTopicUnits(topic, units, GENERATED_TOPIC_SHAPES[topic] ?? {});
}
for (const [typeName, units] of Object.entries(GENERATED_TYPE_UNITS)) {
  registerTypeUnits(typeName, units, GENERATED_TYPE_SHAPES[typeName] ?? {});
}

// uplinks/scansat/client/src/AnomalyOverlay/index.tsx
import {
  registerMapPoiProvider,
  TargetKind,
  useCommand,
  useTelemetry as useTelemetry5
} from "@ksp-gonogo/sitrep-sdk";
import { magnitudeOf as magnitudeOf3, magnitudeOr as magnitudeOr2, usePanelDelay } from "@ksp-gonogo/ui-kit";
import { useMemo as useMemo3 } from "react";
function stillTrue3(reading, whenConfirmedNothing) {
  if (reading.state === "observed") return reading.value;
  if (reading.state === "stale") return reading.value;
  if (reading.state === "reckonable") return reading.value;
  if (reading.state === "absent") return whenConfirmedNothing;
  return void 0;
}
function useBodyIndexByName() {
  const systemBodies = stillTrue3(useTelemetry5("system.bodies"), void 0);
  return useMemo3(() => {
    const map = /* @__PURE__ */ new Map();
    for (const body of systemBodies?.bodies ?? []) {
      if (body.name != null && body.index != null) {
        map.set(body.name, body.index);
      }
    }
    return map;
  }, [systemBodies]);
}
registerMapPoiProvider({
  id: "scansat:anomalies",
  requires: "scansat",
  usePois: (ctx) => {
    const anomalies = useScanAnomalies(ctx.bodyId);
    const setTargetCmd = useCommand("vessel.target.set");
    usePanelDelay(setTargetCmd);
    const bodyIndexByName = useBodyIndexByName();
    return useMemo3(() => {
      if (!Array.isArray(anomalies) || !ctx.bodyId) return [];
      const bodyId = ctx.bodyId;
      const bodyIndex = bodyIndexByName.get(bodyId);
      return anomalies.filter((a) => a.known).map(
        (a) => ({
          // `MapPoi` takes plain numbers for the projection; the anomaly's
          // own latitude arrives as `Value<"°">`. Passed through unread it
          // placed every marker at NaN, while the set-target command below
          // takes the Value and so was always right.
          id: `anomaly:${a.name}-${magnitudeOf3(a.latitude)}-${magnitudeOf3(a.longitude)}`,
          bodyId,
          lat: magnitudeOr2(a.latitude, 0),
          lon: magnitudeOr2(a.longitude, 0),
          kind: "anomaly",
          label: a.detail ? a.name : "(unknown)",
          status: "info",
          meta: { known: a.known, detail: a.detail },
          // Only dispatchable once the body index has resolved; never hand a
          // malformed Position SetTarget to the queue while `system.bodies`
          // is still loading. Rides `useCommand("vessel.target.set")` (a
          // Position-kind SetTarget) instead of the legacy `useExecuteAction`
          // string path; instant today, so `usePanelDelay` consumes the
          // handle and the widget stays behaviour-free.
          actions: bodyIndex === void 0 ? [] : [
            {
              id: "set-target",
              label: "Set as Target",
              run: () => void setTargetCmd.send(
                {
                  kind: TargetKind.Position,
                  bodyIndex,
                  latitude: a.latitude,
                  longitude: a.longitude
                },
                { label: "Set as Target" }
              )
            }
          ]
        })
      );
    }, [anomalies, ctx.bodyId, setTargetCmd, bodyIndexByName]);
  }
});

// uplinks/scansat/client/src/FootprintOverlay/index.tsx
import { registerAugment as registerAugment3 } from "@ksp-gonogo/sitrep-sdk";
import { magnitudeOf as magnitudeOf4, magnitudeOr as magnitudeOr3 } from "@ksp-gonogo/ui-kit";
import { useEffect as useEffect4, useRef as useRef2 } from "react";
import { jsx as jsx4 } from "react/jsx-runtime";
var STROKE_WIDTH_PX = 1.5;
function wrapLon180(lon) {
  const wrapped = ((lon + 180) % 360 + 360) % 360 - 180;
  return wrapped === 180 ? -180 : wrapped;
}
function drawFootprints(ctx, width, bodyName, vessels, project) {
  if (!bodyName) return;
  for (const v of vessels) {
    if (v.body !== bodyName) continue;
    const halfLat = magnitudeOf4(v.groundTrackWidthDeg);
    const halfLon = magnitudeOf4(v.groundTrackLonHalfDeg);
    const subLat = magnitudeOr3(v.subLatitude, 0);
    const subLon = magnitudeOr3(v.subLongitude, 0);
    if (halfLat == null || halfLat <= 0) continue;
    if (halfLon == null || halfLon <= 0) continue;
    const tc = v.trackColor;
    const channels = tc ? {
      r: magnitudeOr3(tc.r, 255),
      g: magnitudeOr3(tc.g, 255),
      b: magnitudeOr3(tc.b, 255),
      a: magnitudeOr3(tc.a, 255)
    } : void 0;
    const fill = channels ? `rgba(${channels.r}, ${channels.g}, ${channels.b}, ${(channels.a / 255 * 0.45).toFixed(3)})` : "rgba(255, 255, 255, 0.3)";
    const stroke = channels ? `rgba(${channels.r}, ${channels.g}, ${channels.b}, 0.9)` : "rgba(255, 255, 255, 0.7)";
    const latTop = Math.min(90, subLat + halfLat);
    const latBot = Math.max(-90, subLat - halfLat);
    const { y: yTop } = project(latTop, 0);
    const { y: yBot } = project(latBot, 0);
    const rectY = Math.min(yTop, yBot);
    const rectH = Math.abs(yBot - yTop);
    const lonLo = wrapLon180(subLon - halfLon);
    const lonHi = wrapLon180(subLon + halfLon);
    const { x: xLoRaw } = project(0, lonLo);
    const { x: xHiRaw } = project(0, lonHi);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = STROKE_WIDTH_PX;
    if (halfLon * 2 >= 360) {
      ctx.fillRect(0, rectY, width, rectH);
      ctx.strokeRect(0, rectY, width, rectH);
    } else if (xHiRaw > xLoRaw) {
      const rw = xHiRaw - xLoRaw;
      ctx.fillRect(xLoRaw, rectY, rw, rectH);
      ctx.strokeRect(xLoRaw, rectY, rw, rectH);
    } else {
      const rwRight = width - xLoRaw;
      ctx.fillRect(xLoRaw, rectY, rwRight, rectH);
      ctx.strokeRect(xLoRaw, rectY, rwRight, rectH);
      ctx.fillRect(0, rectY, xHiRaw, rectH);
      ctx.strokeRect(0, rectY, xHiRaw, rectH);
    }
  }
}
function FootprintOverlay(ctx) {
  const canvasRef = useRef2(null);
  const vessels = useScanningVessels();
  useEffect4(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c2d = canvas.getContext("2d");
    if (!c2d) return;
    c2d.clearRect(0, 0, ctx.width, ctx.height);
    if (!Array.isArray(vessels)) return;
    drawFootprints(c2d, ctx.width, ctx.bodyName, vessels, ctx.project);
  }, [vessels, ctx.width, ctx.height, ctx.bodyName, ctx.project]);
  return /* @__PURE__ */ jsx4(
    "canvas",
    {
      ref: canvasRef,
      width: ctx.width,
      height: ctx.height,
      style: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none"
      }
    }
  );
}
registerAugment3({
  id: "scansat-footprint-overlay",
  augments: "map-view.overlay",
  requires: "scansat",
  component: FootprintOverlay,
  owner: SCANSAT
});

// uplinks/scansat/client/src/CoveragePanel/index.tsx
import { registerAugment as registerAugment4, useTelemetry as useTelemetry6, value as value3 } from "@ksp-gonogo/sitrep-sdk";
import { NULL_DISPLAY as NULL_DISPLAY2, Unit as Unit3, useWidgetScope } from "@ksp-gonogo/ui-kit";
import { useMemo as useMemo4 } from "react";
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
var COVERAGE_TYPES = [
  { type: SCAN_TYPE.AltimetryHiRes, label: "Alt Hi" },
  { type: SCAN_TYPE.AltimetryLoRes, label: "Alt Lo" },
  { type: SCAN_TYPE.Biome, label: "Biome" },
  { type: SCAN_TYPE.ResourceHiRes, label: "Res Hi" },
  { type: SCAN_TYPE.ResourceLoRes, label: "Res Lo" }
];
function CoveragePanel() {
  const scanningVessels = useScanningVessels();
  const bodyName = useWidgetScope("map-view")?.bodyName;
  const rangeByType = useMemo4(() => {
    const map = /* @__PURE__ */ new Map();
    if (!bodyName || !Array.isArray(scanningVessels)) return map;
    for (const v of scanningVessels) {
      if (v.body !== bodyName) continue;
      for (const s of v.sensors) {
        const cur = map.get(s.type) ?? { inRange: false, bestRange: false };
        map.set(s.type, {
          inRange: cur.inRange || s.inRange,
          bestRange: cur.bestRange || s.bestRange
        });
      }
    }
    return map;
  }, [scanningVessels, bodyName]);
  if (!bodyName) return null;
  return (
    // `<section>` for its implicit role="region" (a plain `<div role="region">`
    // trips biome's useSemanticElements; the styled.div this replaced hid the
    // intrinsic element from that rule).
    /* @__PURE__ */ jsx5(
      "section",
      {
        "aria-label": `Scan coverage for ${bodyName}`,
        style: COVERAGE_COLUMN,
        children: COVERAGE_TYPES.map(({ type, label }) => /* @__PURE__ */ jsx5(
          CoverageRow2,
          {
            bodyName,
            scanType: type,
            label,
            range: rangeByType.get(type)
          },
          type
        ))
      }
    )
  );
}
function CoverageRow2({
  bodyName,
  scanType,
  label,
  range
}) {
  const pct = useTelemetry6(
    "data",
    `scansat.coverage.${bodyName}.${scanType}`
  );
  const coverage = typeof pct === "number" ? pct : 0;
  const filled = Math.max(0, Math.min(100, coverage));
  return /* @__PURE__ */ jsxs4("div", { style: COVERAGE_GRID, children: [
    /* @__PURE__ */ jsx5("span", { style: LABEL, children: label }),
    /* @__PURE__ */ jsx5("div", { style: TRACK, children: /* @__PURE__ */ jsx5("div", { style: { ...TRACK_FILL, width: `${filled}%` } }) }),
    /* @__PURE__ */ jsx5("span", { style: COVERAGE_VALUE, children: /* @__PURE__ */ jsx5(Unit3, { value: value3("%", coverage), decimals: 0 }) }),
    range?.bestRange ? /* @__PURE__ */ jsx5("span", { style: { ...CHIP, color: "var(--color-status-go-fg)" }, children: "best" }) : range?.inRange ? /* @__PURE__ */ jsx5("span", { style: { ...CHIP, color: "var(--color-status-info-fg)" }, children: "scan" }) : /* @__PURE__ */ jsx5("span", { style: { ...CHIP, color: "var(--color-text-faint)" }, children: NULL_DISPLAY2 })
  ] });
}
var COVERAGE_COLUMN = {
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  // This 3px and CoverageGrid's 6px below are one decision, not two: the
  // vertical row gap is deliberately half the horizontal cell gap. Both stay
  // literal because the 3 -> 2 snap alone would turn that 2:1 into 3:1.
  gap: "3px",
  paddingTop: "var(--space-6)",
  marginTop: "var(--space-6)",
  borderTop: "1px solid var(--color-surface-raised)"
};
var COVERAGE_GRID = {
  display: "grid",
  gridTemplateColumns: "48px 1fr 40px auto",
  alignItems: "center",
  // Half of this is COVERAGE_COLUMN's row gap above; see the note there.
  gap: "6px"
};
var LABEL = {
  fontSize: "var(--font-size-2xs)",
  letterSpacing: "0.12em",
  color: "var(--color-text-faint)",
  minWidth: "28px",
  textTransform: "uppercase"
};
var TRACK = {
  height: "5px",
  borderRadius: "var(--radius-pill)",
  background: "var(--color-surface-raised)",
  overflow: "hidden",
  position: "relative"
};
var TRACK_FILL = {
  position: "absolute",
  inset: "0 auto 0 0",
  background: "var(--color-accent-fg)"
};
var COVERAGE_VALUE = {
  // Literal: this sits in a fixed 40px grid column and must never truncate
  // (see below). --font-size-base is 15px under @media (pointer: coarse),
  // i.e. on the tier-1 Steam Deck, which is the wrong direction for a nowrap
  // readout in a fixed track.
  fontSize: "14px",
  fontWeight: 700,
  color: "var(--color-text-primary)",
  fontVariantNumeric: "tabular-nums",
  // Numeric readout: never truncate digits. Shrink to fit the row instead of
  // overflowing the panel edge at the 3-col minimum size.
  minWidth: 0,
  whiteSpace: "nowrap"
};
var CHIP = {
  fontSize: "var(--font-size-2xs)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  textAlign: "right",
  minWidth: "4ch"
};
registerAugment4({
  id: "scansat-coverage-panel",
  augments: "map-view.sections",
  requires: "scansat",
  component: CoveragePanel,
  owner: SCANSAT
});

// uplinks/scansat/client/src/TerrainBase/AltimetryBase.tsx
import {
  getBody as getBody3,
  registerAugment as registerAugment5
} from "@ksp-gonogo/sitrep-sdk";
import { useEffect as useEffect5 } from "react";
var ALTIMETRY_LAYER_ID = "scansat:altimetry";
function elevationToColour(t) {
  if (t < 0.2) return "20, 50, 110";
  if (t < 0.4) return "40, 100, 160";
  if (t < 0.6) return "80, 150, 90";
  if (t < 0.8) return "140, 110, 60";
  return "220, 220, 220";
}
var ALTIMETRY_LAYER_OPACITY = 1;
function AltimetryBase(ctx) {
  const body = ctx.bodyId ? getBody3(ctx.bodyId) : void 0;
  const heightGrid = useScanHeightGrid(body?.name);
  const show = ctx.augmentSettings?.[ALTIMETRY_LAYER_ID]?.show !== false;
  useEffect5(() => {
    if (!show) {
      ctx.onLayer(ALTIMETRY_LAYER_ID, null, 0);
      return;
    }
    if (!heightGrid || !body || typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = BASE_LAYER_CANVAS_W;
    canvas.height = BASE_LAYER_CANVAS_H;
    const c2d = canvas.getContext("2d");
    if (!c2d) return;
    const span = Math.max(1, heightGrid.maxMetres - heightGrid.minMetres);
    paintTile(
      c2d,
      heightGrid.width,
      heightGrid.height,
      body,
      ctx.coverageGate,
      (iLon, iLat) => {
        const idx = iLon * heightGrid.height + iLat;
        const m = heightGrid.metres[idx];
        const t = Math.max(0, Math.min(1, (m - heightGrid.minMetres) / span));
        return elevationToColour(t);
      },
      BASE_LAYER_CANVAS_W,
      BASE_LAYER_CANVAS_H,
      ALTIMETRY_LAYER_OPACITY
    );
    ctx.onLayer(ALTIMETRY_LAYER_ID, canvas, Date.now());
    return () => ctx.onLayer(ALTIMETRY_LAYER_ID, null, 0);
  }, [show, ctx.onLayer, ctx.coverageGate, heightGrid, body]);
  return null;
}
registerAugment5({
  id: ALTIMETRY_LAYER_ID,
  augments: "map-view.base",
  requires: "scansat",
  component: AltimetryBase,
  suppressesVanillaBase: true,
  settings: [
    {
      key: "show",
      type: "boolean",
      label: "Show altimetry",
      default: true
    }
  ],
  owner: SCANSAT
});

// uplinks/scansat/client/src/FogReveal/useScanSatFogSync.ts
import {
  registerFogRevealSource,
  useFogMaskCache as useFogMaskCache2,
  useLateTelemetrySubscribe,
  useTelemetry as useTelemetry7
} from "@ksp-gonogo/sitrep-sdk";
import { useEffect as useEffect6 } from "react";

// uplinks/scansat/client/src/FogReveal/scanCoverageSync.ts
var DEFAULT_SCAN_TYPE = SCAN_TYPE.AltimetryHiRes;

// uplinks/scansat/client/src/FogReveal/useScanSatFogSync.ts
var FOG_SCAN_TYPES = [
  {
    type: SCAN_TYPE.AltimetryLoRes,
    layerId: "scansat:AltimetryLoRes",
    weight: 192
  },
  {
    type: SCAN_TYPE.AltimetryHiRes,
    layerId: "scansat:AltimetryHiRes",
    weight: 255
  },
  { type: SCAN_TYPE.Biome, layerId: "scansat:Biome", weight: 255 },
  {
    type: SCAN_TYPE.ResourceLoRes,
    layerId: "scansat:ResourceLoRes",
    weight: 192
  },
  {
    type: SCAN_TYPE.ResourceHiRes,
    layerId: "scansat:ResourceHiRes",
    weight: 255
  }
];
for (const { layerId, weight } of FOG_SCAN_TYPES) {
  registerFogRevealSource({ id: layerId, weight });
}
export {
  Minimap,
  MinimapForActiveVessel,
  ScanningComponent,
  parseScanScience
};
