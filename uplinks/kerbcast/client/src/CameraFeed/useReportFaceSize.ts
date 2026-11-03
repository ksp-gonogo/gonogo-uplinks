import { useKerbcastDisplaySizes } from "@ksp-gonogo/kerbcast-react";
import { useEffect, useId } from "react";
import { MIN_REQUEST_SIDE_PX } from "./frameShape.js";

/**
 * Ask the sidecar to render a kerbal's face camera at the smallest size its
 * encoder accepts, for the whole time the face is mounted: a square of
 * {@link MIN_REQUEST_SIDE_PX} px, which the browser scales down into the cell.
 * Used by the crew avatar cell, whose own box is far smaller than that and
 * whose `KerbalFaceFeed` therefore has its own report switched off. Must sit
 * inside a `KerbcastProvider`.
 */
export function useReportFaceSize(flightId: number): void {
  const displaySizes = useKerbcastDisplaySizes();
  const instanceId = useId();
  useEffect(() => {
    displaySizes.report(
      flightId,
      instanceId,
      MIN_REQUEST_SIDE_PX,
      MIN_REQUEST_SIDE_PX,
    );
    return () => displaySizes.clear(flightId, instanceId);
  }, [displaySizes, flightId, instanceId]);
}
