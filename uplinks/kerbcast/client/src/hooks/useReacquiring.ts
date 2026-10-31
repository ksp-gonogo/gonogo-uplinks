import { getUplinkHandle } from "@ksp-gonogo/sitrep-sdk";
import { useSyncExternalStore } from "react";
import type { KerbcastDataSource } from "../KerbcastDataSource.js";

const NEVER = () => () => {};

/**
 * Whether camera `flightId` is being bound again after returning to the camera
 * list, which is when its picture is blank. False with no camera, or no
 * Kerbcast data source. Used by {@link CameraFeed} to say what a blank feed is
 * waiting for.
 */
export function useReacquiring(flightId: number | null): boolean {
  const ds = getUplinkHandle<KerbcastDataSource>("kerbcast");
  return useSyncExternalStore(
    ds ? (cb) => ds.onReacquiringChange(cb) : NEVER,
    () => (ds && flightId !== null ? ds.isReacquiring(flightId) : false),
  );
}
