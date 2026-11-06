// RealAntennas' namespace of a `comms.groundStations` entry's provider extension
// bag: the typed half, deliberately NOT in core. See `hopExt.ts` for the same
// mechanism on a `CommsHop`; the bag is written by `RaGroundStations.Bag` and
// typed by the C# `RealAntennasStationExt`.

import {
  PROVIDER_EXTENSIONS_FIELD,
  type ProviderExtensions,
  registerProviderExtensionShape,
} from "@ksp-gonogo/sitrep-sdk";
import type { RealAntennasStationExt } from "./__generated__/contract.js";
import { REALANTENNAS_PROVIDER_ID } from "./hopExt.js";
import "./topics";

export type { RealAntennasStationExt };

const COMMS_GROUND_STATION_TYPE = "CommsGroundStation";
const REALANTENNAS_STATION_EXT_TYPE = "RealAntennasStationExt";

registerProviderExtensionShape(
  COMMS_GROUND_STATION_TYPE,
  REALANTENNAS_PROVIDER_ID,
  REALANTENNAS_STATION_EXT_TYPE,
);

/**
 * Narrow one `comms.groundStations` entry's extension bag to RealAntennas' own
 * typed shape, or `undefined` when RealAntennas is not the elected backend or the
 * station carried no RealAntennas namespace.
 */
export function readRealAntennasStationExt(
  station:
    | { readonly [PROVIDER_EXTENSIONS_FIELD]?: ProviderExtensions | null }
    | undefined
    | null,
): RealAntennasStationExt | undefined {
  const bag = station?.[PROVIDER_EXTENSIONS_FIELD];
  if (bag === undefined || bag === null) return undefined;
  const namespaced = bag[REALANTENNAS_PROVIDER_ID];
  if (namespaced === null || typeof namespaced !== "object") return undefined;
  return namespaced as RealAntennasStationExt;
}
