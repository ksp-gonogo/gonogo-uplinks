// SCANsat Uplink client for gonogo.
//
// Co-located with the GonogoScansatUplink C# mod (mod/GonogoScansatUplink):
// one directory holds the mod and the client TS it ships.
// Importing this package's entry point side-effects the widget
// registration into @ksp-gonogo/core's global component registry:
//
//   - `uplink.ts` → defineUplinkClient({ id: "scansat", ... }) declares this
//     client's identity; every
//     registration below stamps the returned SCANSAT handle as `owner`, so
//     the widget picker's mod search tags derive "scansat" automatically.
//
//   - `Scanning` component → registerComponent({ id: "scanning", ... }) so it
//     is placeable from the dashboard widget picker.
//   - `ScienceInstruments` → SCANSAT.registerContribution({ id:
//     "science-instruments", contributes: "experiments.instruments", ... }) so
//     the Experiments widget draws SCANsat's map scanners in its own rows,
//     counts them in its own header and matches them against its own filter.
//     Experiments reads `science.instruments`, the STOCK experiment list, which
//     a SCANsat scanner never appears in.
//   - `AnomalyOverlay/index.ts` → registerMapPoiProvider({ id:
//     "scansat:anomalies", requires: "scansat", ... }) so discovered
//     anomalies render through @ksp-gonogo/components's MapView's shared
//     `MapPoiLayer`, gaining the uniform "Set as Target" action in place of
//     a bespoke bearing/distance panel behind its own `map-view.overlay`
//     augment.
//   - `FootprintOverlay` → registerAugment({ id: "scansat-footprint-overlay",
//     ... }) so it fills the same `map-view.overlay` slot with scanning-
//     vessel ground-track footprints. This is the only source of scanning
//     footprints; MapView draws none itself.
//   - `CoveragePanel` → registerAugment({ id: "scansat-coverage-panel", ... })
//     so it fills the `map-view.sections` slot with the per-scan-type
//     coverage readout. MapView carries no coverage panel of its own.
//   - `TerrainBase/AltimetryBase` + `TerrainBase/BiomeBase` →
//     registerAugment({ id: "scansat:altimetry" | "scansat:biome",
//     augments: "map-view.base", ... }): two mutually-exclusive providers
//     for the `map-view.base` REPLACE slot, each painting its own standalone
//     colormap surface (altimetry or biome) modulated per-tile by the coverage
//     paint-gate. MapView paints no colormap surface itself.
//   - `FogReveal/useScanSatFogSync` → registerFogRevealSource(...) once per
//     scan type ("scansat:AltimetryLoRes" etc.) so MapView's coverage
//     paint-gate knows this
//     Uplink contributes fog reveal, even before anything calls
//     useScanSatFogSync itself.
//
// To wire it into the app: `import "@ksp-gonogo/gonogo-scansat-uplink";` during app bootstrap
// (alongside the other component-registration imports in app/src/main.tsx).
//
// The scan schema/decode/sync logic (`schema.ts`, `FogReveal/*`) is this
// Uplink's own canonical copy. `packages/core` and `packages/data` still carry
// a duplicate for `packages/components`'s MapView, which has not migrated off
// it yet; that duplicate goes when MapView's augment migration lands.
//
// The Minimap here (`Scanning/Minimap.tsx`) has its own mod-local coverage gate
// (`FogReveal/useScanCoverageGate.ts`) and paints through
// `TerrainBase/paintTile.ts`, the same as BiomeBase, so it borrows no MapView
// canvas hook from @ksp-gonogo/components at all.

export type { ScanningConfig, ScanningScope } from "./Scanning/index.js";
export { ScanningComponent } from "./Scanning/index.js";
export type { MinimapProps } from "./Scanning/Minimap.js";
export { Minimap, MinimapForActiveVessel } from "./Scanning/Minimap.js";
export { parseScanScience } from "./ScienceInstruments/index.js";

// Side-effect registration. Kept as bare imports so the built dist/index.js
// retains them and bundlers won't tree-shake the registerComponent()/
// registerAugment() calls away.
import "./topics.js"; // registerBarePrimitiveTopic("scansat.available") + TopicPayloadMap augment
import "./uplink.js"; // defineUplinkClient(SCANSAT): every widget/augment below stamps `owner: SCANSAT`
import "./Scanning/index.js";
import "./ScienceInstruments/index.js";
import "./AnomalyOverlay/index.js";
import "./FootprintOverlay/index.js";
import "./CoveragePanel/index.js";
import "./TerrainBase/AltimetryBase.js";
import "./TerrainBase/BiomeBase.js";
import "./FogReveal/useScanSatFogSync.js";
