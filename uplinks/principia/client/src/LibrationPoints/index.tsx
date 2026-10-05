import { registerComponent } from "@ksp-gonogo/sitrep-sdk";
import { PRINCIPIA } from "../uplink.js";
import {
  AUTO_PAIR,
  type LibrationPointsConfig,
  librationPointsActions,
} from "./config.js";
import { LibrationPointsConfigForm } from "./LibrationPointsConfigForm.js";
import { LibrationPointsComponent } from "./LibrationPointsView.js";

export type { LibrationPointsActions } from "./config.js";

/**
 * Libration points as places: where a body pair's five are, and how far off
 * one of them a craft is. A libration point stands still only in a frame
 * co-rotating with its pair, so the pair is the frame and the widget's one
 * control. It is drawn in the pair's own units rather than on the metric
 * system diagram, where the markers would walk in and out once per orbit.
 *
 * It belongs to this Uplink because under patched conics a libration point
 * acts on nothing: a craft is only ever in one body's sphere of influence.
 */
registerComponent<LibrationPointsConfig>({
  id: "libration-points",
  name: "Libration Points",
  description:
    "The five libration points of a body pair, drawn in the frame that turns with it so they hold still, with the craft's offset from the one it is nearest.",
  tags: ["telemetry", "navigation"],
  defaultSize: { w: 6, h: 10 },
  minSize: { w: 4, h: 7 },
  component: LibrationPointsComponent,
  configComponent: LibrationPointsConfigForm,
  channels: ["system.bodies"],
  optionalChannels: ["vessel.orbit", "vessel.identity"],
  defaultConfig: { pair: AUTO_PAIR },
  actions: librationPointsActions,
  pushable: true,
  owner: PRINCIPIA,
});

export { LibrationDiagram } from "./LibrationDiagram.js";
export { LibrationPointsComponent };
