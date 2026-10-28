// src/ScanCoverage/coverageSources.ts
import { registerCoverageSource } from "@ksp-gonogo/sitrep-sdk";

// src/schema.ts
var SCAN_TYPE = {
  AltimetryLoRes: 1,
  AltimetryHiRes: 2,
  Biome: 8,
  Anomaly: 16,
  AnomalyDetail: 32,
  ResourceLoRes: 128,
  ResourceHiRes: 256
};

// src/ScanCoverage/coverageSources.ts
var COVERAGE_SCAN_TYPES = [
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
function registerScanCoverageSources() {
  for (const { layerId, weight } of COVERAGE_SCAN_TYPES) {
    registerCoverageSource({ id: layerId, weight });
  }
}

// src/Scanning/index.tsx
import {
  getBody as getBody2,
  observedValue as observedValue2,
  registerComponent,
  useStream as useStream2,
  useTelemetry as useTelemetry4,
  value as value2
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  Card,
  Cluster,
  EmptyState,
  Grid,
  Meter,
  magnitudeOf as magnitudeOf2,
  NULL_DISPLAY,
  Panel,
  Section,
  Stack,
  Text,
  Unit as Unit2,
  WidgetScopeProvider
} from "@ksp-gonogo/ui-kit";
import { useMemo as useMemo2 } from "react";

// src/ScanCoverage/useScanLayers.ts
import { useStream, useTelemetry } from "@ksp-gonogo/sitrep-sdk";
import { useMemo } from "react";

// src/ScanCoverage/scanDecode.ts
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

// src/topics.ts
import {
  registerUplinkTopic,
  registerDynamicTopicPrefix,
  registerEnumMembers,
  registerTopicUnits,
  registerTypeUnits
} from "@ksp-gonogo/sitrep-sdk";

// src/__generated__/units.ts
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
var GENERATED_TYPE_ENUMS = {};
var GENERATED_TOPIC_ENUMS = {};
var GENERATED_TYPE_STATICS = {
  "ScanSensorEntry": ["bestAlt", "fov", "maxAlt", "minAlt"]
};
var GENERATED_TOPIC_STATICS = {};
var GENERATED_ENUM_MEMBERS = {};
var GENERATED_CONTRACT_TAGS = {
  topics: {},
  names: {},
  reckonable: []
};

// src/topics.ts
var SCANSAT_AVAILABLE_TOPIC = "scansat.available";
var SCANSAT_SCANNING_VESSELS_TOPIC = "scansat.scanningVessels";
var SCANSAT_SCIENCE_TOPIC = "scansat.science";
registerUplinkTopic(SCANSAT_AVAILABLE_TOPIC);
registerUplinkTopic(SCANSAT_SCANNING_VESSELS_TOPIC);
registerUplinkTopic(SCANSAT_SCIENCE_TOPIC);
registerDynamicTopicPrefix("scansat.coverage.");
registerDynamicTopicPrefix("scansat.mask.");
registerDynamicTopicPrefix("scansat.height.");
registerDynamicTopicPrefix("scansat.biome.");
registerDynamicTopicPrefix("scansat.anomalies.");
for (const topic of /* @__PURE__ */ new Set([
  ...Object.keys(GENERATED_TOPIC_UNITS),
  ...Object.keys(GENERATED_TOPIC_SHAPES)
])) {
  registerTopicUnits(
    topic,
    GENERATED_TOPIC_UNITS[topic] ?? {},
    GENERATED_TOPIC_SHAPES[topic] ?? {},
    GENERATED_TOPIC_STATICS[topic] ?? [],
    GENERATED_TOPIC_ENUMS[topic] ?? {}
  );
}
for (const [typeName, units] of Object.entries(GENERATED_TYPE_UNITS)) {
  registerTypeUnits(
    typeName,
    units,
    GENERATED_TYPE_SHAPES[typeName] ?? {},
    GENERATED_TYPE_STATICS[typeName] ?? [],
    GENERATED_TYPE_ENUMS[typeName] ?? {}
  );
}
for (const [enumName, members] of Object.entries(GENERATED_ENUM_MEMBERS)) {
  registerEnumMembers(enumName, members);
}

// src/ScanCoverage/useScanLayers.ts
function useBodyLayer(topic) {
  const reading = useStream(topic ?? SCANSAT_AVAILABLE_TOPIC);
  if (topic === void 0) return void 0;
  return reading.state === "observed" || reading.state === "held" ? reading.value : void 0;
}
function useScanHeightGrid(bodyName) {
  const raw = useBodyLayer(
    bodyName ? `scansat.height.${bodyName}` : void 0
  );
  return useMemo(() => {
    if (!bodyName) return void 0;
    if (raw == null) return raw;
    return decodeHeightGrid(raw);
  }, [raw, bodyName]);
}
function useScanBiomeGrid(bodyName) {
  const raw = useBodyLayer(
    bodyName ? `scansat.biome.${bodyName}` : void 0
  );
  return useMemo(() => {
    if (!bodyName) return void 0;
    if (raw == null) return raw;
    return decodeBiomeGrid(raw);
  }, [raw, bodyName]);
}
function useScanAnomalies(bodyName) {
  const raw = useBodyLayer(
    bodyName ? `scansat.anomalies.${bodyName}` : void 0
  );
  if (!bodyName) return void 0;
  if (raw == null) return raw;
  return raw;
}
function useScanningVessels() {
  const reading = useTelemetry("scansat.scanningVessels");
  if (reading.state === "observed" || reading.state === "held") {
    return reading.value;
  }
  return void 0;
}

// src/uplink.ts
import { defineUplinkClient } from "@ksp-gonogo/sitrep-sdk";
var UPLINK_VERSION = "1.0.0-rc.4";
var SCANSAT = defineUplinkClient({
  id: "scansat",
  version: UPLINK_VERSION,
  name: "SCANsat",
  description: "Brings [SCANsat](https://github.com/S-C-A-N/SCANsat)'s orbital survey data onto the mission-control dashboard: what has been scanned, by which craft, and where the anomalies are.",
  tags: GENERATED_CONTRACT_TAGS
});

// src/Scanning/Minimap.tsx
import {
  observedValue,
  useTelemetry as useTelemetry3,
  value
} from "@ksp-gonogo/sitrep-sdk";
import {
  magnitudeOf,
  magnitudeOr,
  NullValue,
  Unit,
  useElementSize
} from "@ksp-gonogo/ui-kit";
import { useEffect as useEffect4, useRef } from "react";
import { styled } from "styled-components";

// src/ScanCoverage/useScanCoverageGate.ts
import {
  getCoverageSources,
  onCoverageSourcesChange,
  useCoverageMaskCache
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
var cachedSources = getCoverageSources();
onCoverageSourcesChange(() => {
  cachedSources = getCoverageSources();
});
function getSourcesSnapshot() {
  return cachedSources;
}
function useScanCoverageGate(bodyId, augmentSettings) {
  const sources = useSyncExternalStore(
    onCoverageSourcesChange,
    getSourcesSnapshot,
    getSourcesSnapshot
  );
  const cache = useCoverageMaskCache();
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
      const m = cache.acquire(bodyId, source.id);
      width = m.width;
      height = m.height;
      masksByLayer.set(source.id, m);
      unsubs.push(cache.onChange(bodyId, source.id, recompute));
    }
    recompute();
    return () => {
      cancelled = true;
      for (const u of unsubs) u();
    };
  }, [bodyId, sources, augmentSettings, cache]);
  return gate;
}

// src/ScanCoverage/useScanCoverageSync.ts
import {
  stillTrue,
  useCoverageMaskCache as useCoverageMaskCache2,
  useLateTelemetrySubscribe,
  useTelemetry as useTelemetry2
} from "@ksp-gonogo/sitrep-sdk";
import { useEffect as useEffect2 } from "react";

// src/ScanCoverage/scanCoverageSync.ts
function wrapLon(lon) {
  const wrapped = ((lon + 180) % 360 + 360) % 360 - 180;
  return wrapped === 180 ? -180 : wrapped;
}
var SCAN_BITMAP_WIDTH = 360;
var SCAN_BITMAP_HEIGHT = 180;
var DEFAULT_SCAN_TYPE = SCAN_TYPE.AltimetryHiRes;
function applyScanCoverageToMask(bitmap, mask, body) {
  if (bitmap.width !== SCAN_BITMAP_WIDTH || bitmap.height !== SCAN_BITMAP_HEIGHT) {
    return false;
  }
  const bits = base64ToBytes2(bitmap.bits);
  if (bits.length < bitmap.width * bitmap.height + 7 >> 3) return false;
  const lonOff = body.longitudeOffset ?? 0;
  const latOff = body.latitudeOffset ?? 0;
  const maskW = mask.width;
  const maskH = mask.height;
  let changed = false;
  for (let iLon = 0; iLon < bitmap.width; iLon++) {
    for (let iLat = 0; iLat < bitmap.height; iLat++) {
      const bitIdx = iLon * bitmap.height + iLat;
      const byte = bits[bitIdx >> 3];
      if ((byte & 128 >> (bitIdx & 7)) === 0) continue;
      const physLonLo = iLon - 180;
      const physLatLo = iLat - 90;
      const texLonLo = wrapLon(physLonLo + lonOff);
      const texLonHi = wrapLon(physLonLo + 1 + lonOff);
      const texLatLo = physLatLo + latOff;
      const texLatHi = physLatLo + 1 + latOff;
      const y0 = Math.max(0, Math.floor((90 - texLatHi) / 180 * maskH));
      const y1 = Math.min(maskH, Math.ceil((90 - texLatLo) / 180 * maskH));
      const xRanges = pixelXRanges(texLonLo, texLonHi, maskW);
      for (const [x0, x1] of xRanges) {
        for (let y = y0; y < y1; y++) {
          const rowOffset = y * maskW;
          for (let x = x0; x < x1; x++) {
            if (mask.data[rowOffset + x] < 255) {
              mask.data[rowOffset + x] = 255;
              changed = true;
            }
          }
        }
      }
    }
  }
  return changed;
}
function pixelXRanges(lonLo, lonHi, maskW) {
  const x0 = (lonLo + 180) / 360 * maskW;
  const x1 = (lonHi + 180) / 360 * maskW;
  if (x1 > x0) {
    return [[Math.floor(x0), Math.min(maskW, Math.ceil(x1))]];
  }
  return [
    [Math.floor(x0), maskW],
    [0, Math.min(maskW, Math.ceil(x1))]
  ];
}
function base64ToBytes2(b64) {
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

// src/ScanCoverage/useScanCoverageSync.ts
function useScanCoverageSync(body) {
  const scanAvailable = stillTrue(useTelemetry2("scansat.available"), void 0) === true;
  const cache = useCoverageMaskCache2();
  const subscribe = useLateTelemetrySubscribe();
  useEffect2(() => {
    if (!scanAvailable) return;
    if (!body || !cache) return;
    const unsubscribes = COVERAGE_SCAN_TYPES.map(({ type: scanType, layerId }) => {
      const mask = cache.acquire(body.id, layerId);
      return subscribe(`scansat.mask.${body.name}.${scanType}`, (value4) => {
        if (!value4 || typeof value4 !== "object") return;
        const bitmap = value4;
        if (typeof bitmap.width !== "number" || typeof bitmap.height !== "number" || typeof bitmap.bits !== "string") {
          return;
        }
        const changed = applyScanCoverageToMask(
          bitmap,
          mask,
          body
        );
        if (changed) cache.markDirty(body.id, layerId);
      });
    });
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [scanAvailable, body, cache, subscribe]);
}

// src/TerrainBase/BiomeBase.tsx
import {
  getBody,
  registerAugment,
  SettingKind
} from "@ksp-gonogo/sitrep-sdk";
import { useEffect as useEffect3 } from "react";

// src/TerrainBase/paintTile.ts
var BASE_LAYER_CANVAS_W = 2048;
var BASE_LAYER_CANVAS_H = 1024;
function wrapLon2(lon) {
  const wrapped = ((lon + 180) % 360 + 360) % 360 - 180;
  return wrapped === 180 ? -180 : wrapped;
}
function tileToPixelRect(iLon, iLat, maskW, maskH, longitudeOffset = 0, latitudeOffset = 0) {
  const physLonLo = iLon - 180;
  const physLatLo = iLat - 90;
  const texLonLo = wrapLon2(physLonLo + longitudeOffset);
  const texLonHi = wrapLon2(physLonLo + 1 + longitudeOffset);
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

// src/TerrainBase/BiomeBase.tsx
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
  useEffect3(() => {
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
  augments: "ground-track.base",
  requires: "scansat",
  component: BiomeBase,
  suppressesVanillaBase: true,
  settings: [
    {
      key: "show",
      type: SettingKind.Bool,
      label: "Show biome",
      default: true
    }
  ],
  owner: SCANSAT
});

// src/Scanning/Minimap.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var MAX_MINIMAP_PX = 240;
var WINDOW_HALF_DEG = 20;
var SRC_W = BASE_LAYER_CANVAS_W;
var SRC_H = BASE_LAYER_CANVAS_H;
function Minimap({
  body,
  vesselLat,
  vesselLon
}) {
  useScanCoverageSync(body);
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
  useEffect4(() => {
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
    const srcCenterX = (wrapLon3(texLon) + 180) / 360 * SRC_W;
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
        const aLat = magnitudeOf(a.latitude);
        const aLon = magnitudeOf(a.longitude);
        if (aLat == null || aLon == null) continue;
        const aTexLat = aLat + (body.latitudeOffset ?? 0);
        const aTexLon = aLon + (body.longitudeOffset ?? 0);
        const dLat = aTexLat - texLat;
        const dLon = shortestLonDelta(wrapLon3(aTexLon), wrapLon3(texLon));
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
  const flight = observedValue(useTelemetry3("vessel.flight"));
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
  const subLat = magnitudeOf(v.subLatitude);
  const subLon = magnitudeOf(v.subLongitude);
  if (subLat == null || subLon == null) return;
  const tc = v.trackColor;
  const fill = tc ? `rgba(${magnitudeOr(tc.r, 255)}, ${magnitudeOr(tc.g, 255)}, ${magnitudeOr(tc.b, 255)}, ${(magnitudeOr(tc.a, 255) / 255).toFixed(3)})` : "rgba(255, 255, 255, 0.4)";
  const vTexLat = subLat + (body.latitudeOffset ?? 0);
  const vTexLon = wrapLon3(subLon + (body.longitudeOffset ?? 0));
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
function wrapLon3(lon) {
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
  gap: var(--gap-related-dense);
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

// src/Scanning/index.tsx
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
function stillTrue2(reading, whenConfirmedNothing) {
  if (reading.state === "observed") return reading.value;
  if (reading.state === "held") return reading.value;
  if (reading.state === "absent") return whenConfirmedNothing;
  return void 0;
}
function useActiveVesselBodyName() {
  const identity = stillTrue2(useTelemetry4("vessel.identity"), void 0);
  const systemBodies = stillTrue2(useTelemetry4("trackingStation.bodies"), void 0);
  return useMemo2(() => {
    const index = identity?.parentBodyIndex;
    if (index == null) return void 0;
    return systemBodies?.bodies.find((b) => b.index === index)?.name ?? void 0;
  }, [identity, systemBodies]);
}
function ScanningComponent({
  config
}) {
  const activeBody = useActiveVesselBodyName();
  const bodyName = config?.bodyName ?? activeBody;
  const surface = observedValue2(useTelemetry4("vessel.surface"));
  const biome = surface?.biome;
  const scanAvailable = stillTrue2(useTelemetry4("scansat.available"), void 0);
  const scanningVessels = useScanningVessels();
  const anomalies = useScanAnomalies(bodyName);
  const scope = useMemo2(() => ({ bodyName }), [bodyName]);
  if (scanAvailable === false) {
    return /* @__PURE__ */ jsx2(
      Panel,
      {
        panelTitle: "Scanning",
        sections: /* @__PURE__ */ jsx2(Section, { children: /* @__PURE__ */ jsx2(EmptyState, { children: "SCANsat is not installed. Install it for scanned terrain, biome imaging, anomaly tracking, and the per-vessel scanner readouts this widget surfaces." }) })
      }
    );
  }
  const body = bodyName ? getBody2(bodyName) : void 0;
  return /* @__PURE__ */ jsx2(WidgetScopeProvider, { widget: "scanning", scope, children: /* @__PURE__ */ jsx2(
    Panel,
    {
      panelTitle: "Scanning",
      sections: [
        biome ? /* @__PURE__ */ jsx2(Section, { children: /* @__PURE__ */ jsx2(Card, { children: /* @__PURE__ */ jsxs2(Text, { size: "sm", children: [
          "Biome: ",
          biome
        ] }) }) }, "biome") : null,
        body ? /* @__PURE__ */ jsx2(Section, { title: "Live view", children: /* @__PURE__ */ jsx2(MinimapForActiveVessel, { body }) }, "live") : null,
        /* @__PURE__ */ jsx2(Section, { title: `Coverage: ${bodyName ?? "?"}`, children: bodyName ? /* @__PURE__ */ jsx2(Stack, { gap: "caption", children: DISPLAY_SCAN_TYPES.map((type) => /* @__PURE__ */ jsx2(CoverageRow, { bodyName, scanType: type }, type)) }) : /* @__PURE__ */ jsx2(EmptyState, { children: "No active body." }) }, "coverage"),
        /* @__PURE__ */ jsx2(Section, { title: "Scanning vessels", children: scanningVessels && scanningVessels.length > 0 ? /* @__PURE__ */ jsx2(Stack, { gap: "related-comfortable", children: scanningVessels.map((v) => /* @__PURE__ */ jsx2(Card, { children: /* @__PURE__ */ jsxs2(Stack, { gap: "caption", children: [
          /* @__PURE__ */ jsxs2(Cluster, { children: [
            /* @__PURE__ */ jsx2(
              Text,
              {
                size: "sm",
                level: v.vesselName == null ? "muted" : void 0,
                children: v.vesselName == null ? NULL_DISPLAY : v.vesselName || "(unnamed)"
              }
            ),
            /* @__PURE__ */ jsx2(Text, { size: "xs", level: "muted", children: v.body })
          ] }),
          /* @__PURE__ */ jsxs2(Text, { size: "xs", level: "muted", children: [
            "sub-point ",
            /* @__PURE__ */ jsx2(Unit2, { value: v.subLatitude, decimals: 2 }),
            ",",
            " ",
            /* @__PURE__ */ jsx2(Unit2, { value: v.subLongitude, decimals: 2 }),
            " \xB7 alt",
            " ",
            /* @__PURE__ */ jsx2(Unit2, { value: v.altitude, format: "km", decimals: 0 })
          ] }),
          /* @__PURE__ */ jsx2(Stack, { gap: "related", children: v.sensors.length === 0 ? /* @__PURE__ */ jsx2(EmptyState, { children: "No scanners." }) : v.sensors.map((s, i) => /* @__PURE__ */ jsxs2(
            Stack,
            {
              gap: "caption",
              children: [
                /* @__PURE__ */ jsxs2(Cluster, { children: [
                  /* @__PURE__ */ jsx2(Text, { size: "xs", children: SCAN_TYPE_LABELS[s.type] ?? `type=${s.type}` }),
                  /* @__PURE__ */ jsx2(
                    Badge,
                    {
                      size: "sm",
                      tone: s.bestRange ? "go" : s.inRange ? "info" : void 0,
                      children: s.bestRange ? "best" : s.inRange ? "scanning" : "out of range"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs2(Text, { size: "xs", level: "muted", children: [
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
                ] })
              ]
            },
            i
          )) })
        ] }) }, v.vesselId)) }) : /* @__PURE__ */ jsx2(EmptyState, { children: "No vessels tracked by SCANsat yet." }) }, "vessels"),
        /*
         * The body is NAMED only when there is one. "Anomalies: ?" told an
         * operator nothing a bare "Anomalies" does not, and those four
         * characters are what pushed the title past the widget's own declared
         * 3-column minimum: the heading clipped by 3px with no body focused,
         * which is the state it is in most often.
         */
        /* @__PURE__ */ jsx2(
          Section,
          {
            title: bodyName ? `Anomalies: ${bodyName}` : "Anomalies",
            children: anomalies && anomalies.length > 0 ? /* @__PURE__ */ jsx2(Stack, { gap: "caption", children: anomalies.map((a) => /* @__PURE__ */ jsxs2(
              Grid,
              {
                cols: "1fr auto",
                children: [
                  /* @__PURE__ */ jsx2(Text, { size: "xs", level: a.known ? void 0 : "muted", children: a.detail ? a.name : a.known ? "(unknown)" : "(undetected)" }),
                  /* @__PURE__ */ jsx2(Text, { size: "xs", level: "muted", children: a.known ? /* @__PURE__ */ jsxs2(Fragment, { children: [
                    /* @__PURE__ */ jsx2(Unit2, { value: a.latitude, decimals: 2 }),
                    ",",
                    " ",
                    /* @__PURE__ */ jsx2(Unit2, { value: a.longitude, decimals: 2 })
                  ] }) : NULL_DISPLAY })
                ]
              },
              `${a.name}-${magnitudeOf2(a.latitude)}`
            )) }) : /* @__PURE__ */ jsx2(EmptyState, { children: "None known." })
          },
          "anomalies"
        )
      ]
    }
  ) });
}
function CoverageRow({
  bodyName,
  scanType
}) {
  const reading = useStream2(`scansat.coverage.${bodyName}.${scanType}`);
  const pct = reading.state === "observed" || reading.state === "held" ? reading.value : void 0;
  const coverage = typeof pct === "number" ? pct : null;
  return /* @__PURE__ */ jsxs2(Grid, { cols: "120px 1fr 60px", gap: "related-comfortable", children: [
    /* @__PURE__ */ jsx2(Text, { size: "xs", children: SCAN_TYPE_LABELS[scanType] }),
    coverage == null ? /* @__PURE__ */ jsx2(Text, { size: "xs", level: "muted", children: NULL_DISPLAY }) : /* @__PURE__ */ jsx2(
      Meter,
      {
        hideLabel: true,
        label: `${SCAN_TYPE_LABELS[scanType]} coverage: ${bodyName}`,
        value: value2("ratio", coverage / 100)
      }
    ),
    /* @__PURE__ */ jsx2(Text, { size: "xs", level: "muted", children: /* @__PURE__ */ jsx2(
      Unit2,
      {
        value: coverage == null ? null : value2("%", coverage),
        decimals: 1
      }
    ) })
  ] });
}
registerComponent({
  id: "scanning",
  name: "Scanning",
  description: "SCANsat status: per-scan-type coverage of the current body, the list of vessels SCANsat is tracking with their on-board scanners and live in-range state, and the body's known anomalies with discovery state.",
  tags: ["scan", "fleet"],
  defaultSize: { w: 6, h: 10 },
  minSize: { w: 4, h: 4 },
  component: ScanningComponent,
  openConfigOnAdd: false,
  dataRequirements: [
    "scansat.available",
    "scansat.scanningVessels",
    "vessel.identity",
    "trackingStation.bodies",
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
  // map LAYERS go to ground-track.overlay.
  augmentSlots: ["scanning.sections"],
  pushable: true,
  owner: SCANSAT
});

// src/ScienceInstruments/index.ts
var SCAN_SCIENCE_READING = SCANSAT.registerProcessor({
  id: "science-reading",
  deps: [{ reading: "scansat.science" }],
  compute: ([science]) => science.state === "observed" || science.state === "held" ? science.value : void 0
});
var DEPS = ["scansat.science", SCAN_SCIENCE_READING];
var SCAN_SCIENCE_READING_ID = SCAN_SCIENCE_READING.id;
function parseScanScience(raw) {
  if (raw === null || raw === void 0) return null;
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const e = entry;
    if (typeof e.partId !== "string") return null;
    if (typeof e.deployed !== "boolean" || typeof e.hasData !== "boolean" || typeof e.rerunnable !== "boolean" || typeof e.inoperable !== "boolean") {
      return null;
    }
    out.push({
      partId: e.partId,
      partTitle: typeof e.partTitle === "string" ? e.partTitle : "Unknown part",
      expId: typeof e.expId === "string" ? e.expId : "",
      deployed: e.deployed,
      hasData: e.hasData,
      rerunnable: e.rerunnable,
      inoperable: e.inoperable
    });
  }
  return out;
}
function computeScanScienceInstruments(topics) {
  const reading = topics[SCAN_SCIENCE_READING.id];
  if (reading === void 0) return null;
  return parseScanScience(reading.value)?.map((row) => ({ ...row, reading })) ?? null;
}
SCANSAT.registerContribution({
  id: "science-instruments",
  contributes: "experiments.instruments",
  requires: "scansat",
  deps: DEPS,
  compute: computeScanScienceInstruments
});

// src/AnomalyOverlay/index.tsx
import {
  registerMapPoiProvider,
  TargetKind,
  useCommand,
  useTelemetry as useTelemetry5
} from "@ksp-gonogo/sitrep-sdk";
import { magnitudeOf as magnitudeOf3 } from "@ksp-gonogo/ui-kit";
import { useMemo as useMemo3 } from "react";
function stillTrue3(reading, whenConfirmedNothing) {
  if (reading.state === "observed") return reading.value;
  if (reading.state === "held") return reading.value;
  if (reading.state === "absent") return whenConfirmedNothing;
  return void 0;
}
function useBodyIndexByName() {
  const systemBodies = stillTrue3(useTelemetry5("trackingStation.bodies"), void 0);
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
    const bodyIndexByName = useBodyIndexByName();
    return useMemo3(() => {
      if (!Array.isArray(anomalies) || !ctx.bodyId) return [];
      const bodyId = ctx.bodyId;
      const bodyIndex = bodyIndexByName.get(bodyId);
      return anomalies.filter((a) => a.known).flatMap((a) => {
        const lat = magnitudeOf3(a.latitude);
        const lon = magnitudeOf3(a.longitude);
        if (lat == null || lon == null) return [];
        return [{
          id: `anomaly:${a.name}-${lat}-${lon}`,
          bodyId,
          lat,
          lon,
          kind: "anomaly",
          label: a.detail ? a.name : "(unknown)",
          status: "info",
          meta: { known: a.known, detail: a.detail },
          // Only dispatchable once the body index has resolved; never hand
          // a malformed Position SetTarget to the queue while
          // `trackingStation.bodies` is still loading. The coordinate half of this
          // guard moved up to the marker itself: an anomaly we cannot place
          // is no longer drawn, so it cannot be reached here. Rides
          // `useCommand("vessel.target.set")` (a Position-kind SetTarget);
          // instant today, and the handle registers with the panel's delay
          // rail, so the widget stays behaviour-free.
          actions: bodyIndex === void 0 ? [] : [
            {
              id: "set-target",
              label: "Set as Target",
              run: () => void setTargetCmd.send(
                {
                  kind: TargetKind.Position,
                  bodyIndex,
                  latitude: lat,
                  longitude: lon
                },
                { label: "Set as Target" }
              )
            }
          ]
        }];
      });
    }, [anomalies, ctx.bodyId, setTargetCmd, bodyIndexByName]);
  }
});

// src/FootprintOverlay/index.tsx
import { registerAugment as registerAugment2, useTelemetry as useTelemetry6 } from "@ksp-gonogo/sitrep-sdk";
import { magnitudeOf as magnitudeOf4, magnitudeOr as magnitudeOr2 } from "@ksp-gonogo/ui-kit";
import { useEffect as useEffect5, useRef as useRef2 } from "react";
import { jsx as jsx3 } from "react/jsx-runtime";
var STROKE_WIDTH_PX = 1.5;
var HELD_DASH = [4, 3];
function drawFootprints(ctx, width, repeatWidth, bodyName, vessels, project, held = false) {
  if (!bodyName || !(repeatWidth > 0)) return;
  ctx.setLineDash(held ? HELD_DASH : []);
  for (const v of vessels) {
    if (v.body !== bodyName) continue;
    const halfLat = magnitudeOf4(v.groundTrackWidthDeg);
    const halfLon = magnitudeOf4(v.groundTrackLonHalfDeg);
    const subLat = magnitudeOf4(v.subLatitude);
    const subLon = magnitudeOf4(v.subLongitude);
    if (halfLat == null || halfLat <= 0) continue;
    if (halfLon == null || halfLon <= 0) continue;
    if (subLat == null || subLon == null) continue;
    const tc = v.trackColor;
    const channels = tc ? {
      r: magnitudeOr2(tc.r, 255),
      g: magnitudeOr2(tc.g, 255),
      b: magnitudeOr2(tc.b, 255),
      a: magnitudeOr2(tc.a, 255)
    } : void 0;
    const fill = held ? "transparent" : channels ? `rgba(${channels.r}, ${channels.g}, ${channels.b}, ${(channels.a / 255 * 0.45).toFixed(3)})` : "rgba(255, 255, 255, 0.3)";
    const stroke = channels ? `rgba(${channels.r}, ${channels.g}, ${channels.b}, 0.9)` : "rgba(255, 255, 255, 0.7)";
    const latTop = Math.min(90, subLat + halfLat);
    const latBot = Math.max(-90, subLat - halfLat);
    const { y: yTop } = project(latTop, 0);
    const { y: yBot } = project(latBot, 0);
    const rectY = Math.min(yTop, yBot);
    const rectH = Math.abs(yBot - yTop);
    const { x: xWest } = project(0, subLon - halfLon);
    const rectW = halfLon * 2 / 360 * repeatWidth;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = STROKE_WIDTH_PX;
    if (rectW >= repeatWidth) {
      ctx.fillRect(0, rectY, width, rectH);
      ctx.strokeRect(0, rectY, width, rectH);
      continue;
    }
    const first = Math.ceil(-(xWest + rectW) / repeatWidth);
    const last = Math.floor((width - xWest) / repeatWidth);
    for (let k = first; k <= last; k++) {
      const rectX = xWest + k * repeatWidth;
      ctx.fillRect(rectX, rectY, rectW, rectH);
      ctx.strokeRect(rectX, rectY, rectW, rectH);
    }
  }
}
function FootprintOverlay(ctx) {
  const canvasRef = useRef2(null);
  const vessels = useScanningVessels();
  const held = useTelemetry6("scansat.scanningVessels").state === "held";
  useEffect5(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c2d = canvas.getContext("2d");
    if (!c2d) return;
    c2d.clearRect(0, 0, ctx.width, ctx.height);
    if (!Array.isArray(vessels)) return;
    drawFootprints(
      c2d,
      ctx.width,
      ctx.worldW * ctx.camera.zoom,
      ctx.bodyName,
      vessels,
      ctx.project,
      held
    );
  }, [
    vessels,
    held,
    ctx.width,
    ctx.height,
    ctx.worldW,
    ctx.camera.zoom,
    ctx.bodyName,
    ctx.project
  ]);
  return /* @__PURE__ */ jsx3(
    "canvas",
    {
      ref: canvasRef,
      "data-footprints": held ? "held" : "current",
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
registerAugment2({
  id: "scansat-footprint-overlay",
  augments: "ground-track.overlay",
  requires: "scansat",
  component: FootprintOverlay,
  owner: SCANSAT
});

// src/CoveragePanel/index.tsx
import { registerAugment as registerAugment3, useStream as useStream3, value as value3 } from "@ksp-gonogo/sitrep-sdk";
import { NULL_DISPLAY as NULL_DISPLAY2, Unit as Unit3, useWidgetScope } from "@ksp-gonogo/ui-kit";
import { useMemo as useMemo4 } from "react";
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
var COVERAGE_TYPES = [
  { type: SCAN_TYPE.AltimetryHiRes, label: "Alt Hi" },
  { type: SCAN_TYPE.AltimetryLoRes, label: "Alt Lo" },
  { type: SCAN_TYPE.Biome, label: "Biome" },
  { type: SCAN_TYPE.ResourceHiRes, label: "Res Hi" },
  { type: SCAN_TYPE.ResourceLoRes, label: "Res Lo" }
];
function CoveragePanel() {
  const scanningVessels = useScanningVessels();
  const bodyName = useWidgetScope("ground-track")?.bodyName;
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
    /* @__PURE__ */ jsx4(
      "section",
      {
        "aria-label": `Scan coverage for ${bodyName}`,
        style: COVERAGE_COLUMN,
        children: COVERAGE_TYPES.map(({ type, label }) => /* @__PURE__ */ jsx4(
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
  const reading = useStream3(`scansat.coverage.${bodyName}.${scanType}`);
  const pct = reading.state === "observed" || reading.state === "held" ? reading.value : void 0;
  const coverage = typeof pct === "number" ? pct : null;
  const filled = coverage == null ? null : Math.max(0, Math.min(100, coverage));
  return /* @__PURE__ */ jsxs3("div", { style: COVERAGE_GRID, children: [
    /* @__PURE__ */ jsx4("span", { style: LABEL, children: label }),
    filled == null ? /* @__PURE__ */ jsx4("div", {}) : /* @__PURE__ */ jsx4("div", { style: TRACK, children: /* @__PURE__ */ jsx4("div", { style: { ...TRACK_FILL, width: `${filled}%` } }) }),
    /* @__PURE__ */ jsx4("span", { style: COVERAGE_VALUE, children: /* @__PURE__ */ jsx4(
      Unit3,
      {
        value: coverage == null ? null : value3("%", coverage),
        decimals: 0
      }
    ) }),
    range?.bestRange ? /* @__PURE__ */ jsx4("span", { style: { ...CHIP, color: "var(--color-go-text)" }, children: "best" }) : range?.inRange ? /* @__PURE__ */ jsx4("span", { style: { ...CHIP, color: "var(--color-info-text)" }, children: "scan" }) : /* @__PURE__ */ jsx4("span", { style: { ...CHIP, color: "var(--color-text-faint)" }, children: NULL_DISPLAY2 })
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
  paddingTop: "var(--inset-below-rule)",
  marginTop: "var(--gap-related-compact)",
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
registerAugment3({
  id: "scansat-coverage-panel",
  augments: "ground-track.sections",
  requires: "scansat",
  component: CoveragePanel,
  owner: SCANSAT
});

// src/TerrainBase/AltimetryBase.tsx
import {
  bodyNamed,
  CELESTIAL_FACTS,
  getBody as getBody3,
  registerAugment as registerAugment4,
  SettingKind as SettingKind2,
  useProcessor
} from "@ksp-gonogo/sitrep-sdk";
import { useEffect as useEffect6 } from "react";
var ALTIMETRY_LAYER_ID = "scansat:altimetry";
var DEEP_WATER = "20, 50, 110";
var SHALLOW_WATER = "40, 100, 160";
var LOWLAND = "80, 150, 90";
var HIGHLAND = "140, 110, 60";
var PEAK = "220, 220, 220";
function altimetryColour(metres, minMetres, maxMetres, hasOcean) {
  if (!hasOcean) {
    const t2 = fraction(metres, minMetres, maxMetres);
    if (t2 < 0.2) return DEEP_WATER;
    if (t2 < 0.4) return SHALLOW_WATER;
    if (t2 < 0.6) return LOWLAND;
    if (t2 < 0.8) return HIGHLAND;
    return PEAK;
  }
  if (metres < 0) {
    return fraction(metres, minMetres, 0) < 0.5 ? DEEP_WATER : SHALLOW_WATER;
  }
  const t = fraction(metres, 0, maxMetres);
  if (t < 1 / 3) return LOWLAND;
  if (t < 2 / 3) return HIGHLAND;
  return PEAK;
}
function fraction(metres, lo, hi) {
  return Math.max(0, Math.min(1, (metres - lo) / Math.max(1, hi - lo)));
}
var ALTIMETRY_LAYER_OPACITY = 1;
function AltimetryBase(ctx) {
  const body = ctx.bodyId ? getBody3(ctx.bodyId) : void 0;
  const heightGrid = useScanHeightGrid(body?.name);
  const factsReading = useProcessor(CELESTIAL_FACTS);
  const facts = factsReading?.state === "observed" || factsReading?.state === "held" ? factsReading.value : void 0;
  const hasOcean = bodyNamed(facts, body?.name)?.hasOcean === true;
  const show = ctx.augmentSettings?.[ALTIMETRY_LAYER_ID]?.show !== false;
  useEffect6(() => {
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
    paintTile(
      c2d,
      heightGrid.width,
      heightGrid.height,
      body,
      ctx.coverageGate,
      (iLon, iLat) => {
        const idx = iLon * heightGrid.height + iLat;
        return altimetryColour(
          heightGrid.metres[idx],
          heightGrid.minMetres,
          heightGrid.maxMetres,
          hasOcean
        );
      },
      BASE_LAYER_CANVAS_W,
      BASE_LAYER_CANVAS_H,
      ALTIMETRY_LAYER_OPACITY
    );
    ctx.onLayer(ALTIMETRY_LAYER_ID, canvas, Date.now());
    return () => ctx.onLayer(ALTIMETRY_LAYER_ID, null, 0);
  }, [show, ctx.onLayer, ctx.coverageGate, heightGrid, body, hasOcean]);
  return null;
}
registerAugment4({
  id: ALTIMETRY_LAYER_ID,
  augments: "ground-track.base",
  requires: "scansat",
  component: AltimetryBase,
  suppressesVanillaBase: true,
  settings: [
    {
      key: "show",
      type: SettingKind2.Bool,
      label: "Show altimetry",
      default: true
    }
  ],
  owner: SCANSAT
});

// src/ScanCoverage/CoverageSyncOverlay.tsx
import {
  getBody as getBody4,
  registerAugment as registerAugment5
} from "@ksp-gonogo/sitrep-sdk";
function CoverageSyncOverlay(ctx) {
  useScanCoverageSync(ctx.bodyName ? getBody4(ctx.bodyName) : void 0);
  return null;
}
registerAugment5({
  id: "scansat-coverage-sync",
  augments: "ground-track.overlay",
  requires: "scansat",
  component: CoverageSyncOverlay,
  owner: SCANSAT
});

// src/index.ts
registerScanCoverageSources();
export {
  Minimap,
  MinimapForActiveVessel,
  ScanningComponent,
  parseScanScience
};
