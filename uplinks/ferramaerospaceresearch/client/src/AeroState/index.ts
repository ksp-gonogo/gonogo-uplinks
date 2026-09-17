import type { PlotLayer, PlotTone, TopicPayload } from "@ksp-gonogo/sitrep-sdk";
import { value } from "@ksp-gonogo/sitrep-sdk";
import { writeQuantity } from "@ksp-gonogo/ui-kit";
// Side-effect import: registers aero.state's unit map and augments
// TopicPayloadMap. This module reads the Topic, so it pulls the registration
// itself rather than relying on the package entry's import order.
import "../topics.js";
import { AERO } from "../uplink.js";

/**
 * The aero model's attitude to the airflow, as a CONTRIBUTED PLOT: sideslip
 * across, angle of attack up, a point where the vessel currently sits between
 * them.
 *
 * Both axes are degrees and neither is a place, so the frame is `cartesian`
 * rather than `spatial`: sideslip is a yaw-plane angle and angle of attack a
 * pitch-plane one, two different quantities that happen to share a unit, and a
 * cartesian frame is the one that puts a tick ladder on each so a reading off
 * either axis is a number rather than a distance from centre.
 *
 * A stall band and the model-stale qualifier ride as captions, the same
 * left-edge and corner idiom the sibling descent-envelope plot uses, so an
 * operator reading either plot on the board learns one vocabulary. Lift/drag
 * and terminal velocity, the two figures most worth a fixed place beside the
 * point, are the remaining corners; everything else the model publishes stays
 * unread here; a square gauge has room for the attitude and the two numbers
 * that qualify it, not for a full breakdown of coefficients and forces.
 */

/** The stall fraction at which the wing counts as departing rather than
 *  merely loaded. Matches the band a stall-fraction readout elsewhere in this
 *  Uplink already draws, so the same reading gets the same word everywhere. */
const DEPARTING = 0.5;
/** Below this a stalled fraction is real but not yet worth a word. */
const NOTICEABLE = 0.02;

/** Degrees either side of zero the plot draws sideslip across. */
const SIDESLIP_DOMAIN: [number, number] = [-15, 15];
/** Degrees the plot draws angle of attack through: negative for a dive, up
 *  past the wing's own departure point for an entry held nose-high. */
const ALPHA_DOMAIN: [number, number] = [-10, 45];

function stallBand(fraction: number): { label: string; tone: PlotTone } {
  if (fraction >= DEPARTING) return { label: "STALLED", tone: "nogo" };
  if (fraction > NOTICEABLE) return { label: "PARTIAL STALL", tone: "warn" };
  return { label: "ATTACHED", tone: "go" };
}

export interface AeroAttitudeInputs {
  /** Angle of attack, degrees. */
  alpha: number | null;
  /** Sideslip, degrees. */
  sideslip: number | null;
  /** Wing-area-weighted stalled fraction, 0..1. */
  stall: number | null;
  /** Whole-vessel lift to drag ratio, dimensionless. */
  liftToDragRatio: number | null;
  /** The model's terminal velocity at the vessel's current conditions, m/s. */
  terminalVelocity: number | null;
  /** False once the coefficients describe a shape the vessel no longer has. */
  stale: boolean;
}

/**
 * Every layer the plot draws, or none at all with no attitude to place.
 *
 * Pure and exported so a test can call it against a plain fixture without
 * going through the contribution registry, the shape every other Uplink
 * contribution in this repo uses.
 */
export function aeroAttitudeLayers(
  inputs: Readonly<AeroAttitudeInputs>,
): PlotLayer[] {
  const { alpha, sideslip, stall, liftToDragRatio, terminalVelocity, stale } =
    inputs;
  // Alpha and sideslip arrive together off one model tick; with neither there
  // is no point to place and this plot has nothing of its own to draw.
  if (alpha == null || sideslip == null) return [];

  const emphasis = stale ? ("faint" as const) : ("normal" as const);
  const band = stall == null ? null : stallBand(stall);

  const layers: PlotLayer[] = [
    {
      kind: "marker",
      id: "attitude",
      at: { x: sideslip, y: alpha },
      tone: band?.tone ?? "info",
      emphasis,
      description: `angle of attack ${writeQuantity(value("°", alpha), {
        decimals: 1,
      })}, sideslip ${writeQuantity(value("°", sideslip), {
        decimals: 1,
      })}${band ? `, ${band.label}` : ""}`,
    },
  ];

  if (band) {
    layers.push({
      kind: "caption",
      id: "band",
      anchor: "top-left",
      text: band.label,
      tone: band.tone,
      description: `stall band ${band.label}`,
    });
  }
  if (stale) {
    layers.push({
      kind: "caption",
      id: "stale",
      anchor: "left-edge",
      text: "MODEL STALE",
      tone: "warn",
      description:
        "aerodynamic model stale, this attitude describes the previous shape",
    });
  }
  if (liftToDragRatio != null && Number.isFinite(liftToDragRatio)) {
    layers.push({
      kind: "caption",
      id: "lift-drag",
      anchor: "top-right",
      caption: "L/D",
      text: writeQuantity(value("1", liftToDragRatio), { decimals: 2 }),
      description: `lift to drag ratio ${writeQuantity(
        value("1", liftToDragRatio),
        { decimals: 2 },
      )}`,
    });
  }
  if (terminalVelocity != null && Number.isFinite(terminalVelocity)) {
    layers.push({
      kind: "caption",
      id: "terminal",
      anchor: "bottom-right",
      caption: "TERMINAL",
      text: writeQuantity(value("m/s", terminalVelocity), { decimals: 0 }),
      description: `terminal velocity ${writeQuantity(
        value("m/s", terminalVelocity),
        { decimals: 0 },
      )}`,
    });
  }

  return layers;
}

AERO.registerContribution({
  id: "aero-state",
  contributes: "plots",
  requires: "aero",
  deps: ["aero.state"],
  compute: (topics) => {
    const state = topics["aero.state"] as
      | TopicPayload<"aero.state">
      | undefined;
    const inputs: AeroAttitudeInputs = {
      alpha: state?.angleOfAttack?.magnitude ?? null,
      sideslip: state?.sideslip?.magnitude ?? null,
      stall: state?.stallFraction?.magnitude ?? null,
      liftToDragRatio: state?.liftToDragRatio?.magnitude ?? null,
      terminalVelocity: state?.terminalVelocity?.magnitude ?? null,
      stale: state != null && state.aeroModelValid === false,
    };
    const layers = aeroAttitudeLayers(inputs);
    if (layers.length === 0) return null;
    return [
      {
        subject: "aero-state",
        frame: {
          kind: "cartesian" as const,
          xDomain: SIDESLIP_DOMAIN,
          yDomain: ALPHA_DOMAIN,
          xUnit: "°",
          yUnit: "°",
        },
        title: "Aerodynamics",
        layers,
      },
    ];
  },
});
