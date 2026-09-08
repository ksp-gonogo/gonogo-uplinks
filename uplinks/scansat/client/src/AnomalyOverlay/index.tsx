// SCANsat anomaly map POI provider.
//
// Registers into the generic `registerMapPoiProvider` registry
// (`@ksp-gonogo/core`'s `mapPoi.ts`) so discovered anomalies render through
// MapView's shared `MapPoiLayer` (packages/components/src/MapView/
// MapPoiLayer.tsx) exactly like every other POI kind (KSC, launch sites,
// contract targets): one hover/action surface, no per-kind bolt-on UI.
//
// A POI provider rather than a `map-view.overlay` augment owning its own
// markers, so every anomaly carries a "Set as Target" action for free. There is
// deliberately no ranked-by-distance panel here: a nearby-POI panel belongs in
// the generic layer if it is wanted at all, never per POI kind.
//
// Presence-gated on `requires: "scansat"`: MapPoiLayer only calls
// `usePois` once `scansat.available` is live, so an install without
// SCANsat never surfaces anomaly markers.

import type { MapPoi, Reading } from "@ksp-gonogo/sitrep-sdk";
import {
  registerMapPoiProvider,
  TargetKind,
  useCommand,
  useTelemetry,
} from "@ksp-gonogo/sitrep-sdk";
import { magnitudeOf, usePanelDelay } from "@ksp-gonogo/ui-kit";
import { useMemo } from "react";
import { useScanAnomalies } from "../FogReveal/useScanLayers.js";

/**
 * The value of a FACT: something that stays true until an event changes it, and no
 * event can reach us down a link that is not delivering. `whenConfirmedNothing` is
 * what an `absent` tombstone means here, which is a different answer from `pending`
 * and must not collapse into it.
 */
function stillTrue<T, A>(
  reading: Reading<T>,
  whenConfirmedNothing: A,
): T | A | undefined {
  if (reading.state === "observed") return reading.value;
  // `stale` covers the modelled reading too, and takes its OBSERVATION rather
  // than its `reckoned`: a fact is what was last really seen, and a forward
  // model has nothing to add to one.
  if (reading.state === "stale") return reading.value;
  if (reading.state === "absent") return whenConfirmedNothing;
  return undefined;
}

/**
 * Resolve a body NAME to its `system.bodies` index, the inverse of
 * `vanillaPoiProvider.ts`'s `useBodyNameByIndex`. Needed only here: an
 * anomaly's body is a name (`useScanAnomalies(bodyName)`), but
 * `SetTargetArgs.Position` (`tar.setTargetPosition[bodyIndex,lat,lon]`)
 * wants the stable index.
 */
function useBodyIndexByName(): Map<string, number> {
  // The solar system is the least volatile fact on the wire.
  const systemBodies = stillTrue(useTelemetry("system.bodies"), undefined);
  return useMemo(() => {
    const map = new Map<string, number>();
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

    return useMemo(() => {
      if (!Array.isArray(anomalies) || !ctx.bodyId) return [];
      const bodyId = ctx.bodyId;
      const bodyIndex = bodyIndexByName.get(bodyId);

      return anomalies
        .filter((a) => a.known)
        .flatMap((a): MapPoi[] => {
          // The projection and the command both take plain numbers; the
          // anomaly's own coordinates arrive as `Value<"°">`. Passed through
          // unread they placed every marker at NaN.
          const lat = magnitudeOf(a.latitude);
          const lon = magnitudeOf(a.longitude);
          // An anomaly whose fix did not decode has no place on the map, so
          // it gets no marker. Defaulted to 0/0 it got one anyway, carrying
          // the anomaly's real name, sitting at 0°N 0°E. The `actions` guard
          // below was already written for this absence and already refused to
          // steer at such a marker; nothing stopped it being DRAWN.
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
            // `system.bodies` is still loading. The coordinate half of this
            // guard moved up to the marker itself: an anomaly we cannot place
            // is no longer drawn, so it cannot be reached here. Rides
            // `useCommand("vessel.target.set")` (a Position-kind SetTarget);
            // instant today, so `usePanelDelay` consumes the handle and the
            // widget stays behaviour-free.
            actions:
              bodyIndex === undefined
                ? []
                : [
                    {
                      id: "set-target",
                      label: "Set as Target",
                      run: () =>
                        void setTargetCmd.send(
                          {
                            kind: TargetKind.Position,
                            bodyIndex,
                            latitude: lat,
                            longitude: lon,
                          },
                          { label: "Set as Target" },
                        ),
                    },
                  ],
          }];
        });
    }, [anomalies, ctx.bodyId, setTargetCmd, bodyIndexByName]);
  },
});
