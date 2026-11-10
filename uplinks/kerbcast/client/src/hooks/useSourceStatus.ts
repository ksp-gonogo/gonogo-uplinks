import type { DataSourceStatus } from "@ksp-gonogo/sitrep-sdk";
import { getUplinkHandle } from "@ksp-gonogo/sitrep-sdk";
import { useSyncExternalStore } from "react";
import type { KerbcastDataSource } from "../KerbcastDataSource.js";

const NEVER = () => () => {};

/**
 * The connection status of the Kerbcast sidecar link, or undefined with no
 * Kerbcast data source. Useful for telling an operator a feed is still coming
 * up rather than broken. Used by {@link CameraFeed}.
 */
export function useSourceStatus(): DataSourceStatus | undefined {
  const ds = getUplinkHandle<KerbcastDataSource>("kerbcast");
  return useSyncExternalStore(
    ds ? (cb) => ds.onStatusChange(cb) : NEVER,
    () => ds?.status,
  );
}
