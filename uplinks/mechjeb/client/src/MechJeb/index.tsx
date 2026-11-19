import type {
  ActionDefinition,
  ComponentProps,
  SystemUplinkHealth,
} from "@ksp-gonogo/sitrep-sdk";
import {
  registerComponent,
  useActionInput,
  useCommand,
  useStream,
  useTelemetry,
  value,
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  Button,
  type CommandInput,
  Field,
  FieldLabel,
  Input,
  Panel,
  Section,
  Text,
  writeQuantity,
} from "@ksp-gonogo/ui-kit";
import { useId, useRef, useState } from "react";
import { MECHJEB } from "../uplink.js";

/**
 * MechJeb: a delayed-command control surface rather than a telemetry readout,
 * because MechJeb's own readouts are all derivable from what the stream already
 * carries. Three remote-autopilot
 * commands (engage ascent autopilot, execute the next maneuver node, land at
 * the selected target) dispatched through the app's command layer
 * (`useCommand`) and gated on the signal delay: each button reflects its own
 * command lifecycle (idle → commanding/awaiting-reply → confirmed | rejected |
 * no-reply) exactly like `LandingStatus`'s gear/brakes rows.
 *
 * Co-located with the `GonogoMechJebUplink` mod
 * (`mod/GonogoMechJebUplink/MechJebUplink.cs`), which handles `mechjeb.*` by
 * direct-linking MechJeb2's own ascent-autopilot, node-executor and
 * landing-autopilot API. Command
 * handling is fail-soft: MechJeb2 absent, or an API drift the version guard
 * catches, takes the mod-side uplink inert and these commands degrade to the
 * same `no reply` the UX already renders honestly.
 */

type MechJebConfig = {
  /** Seed altitude (km) for the ascent-autopilot target input. */
  defaultAscentAltitudeKm: number;
};

const DEFAULT_ASCENT_ALTITUDE_KM = 100;

const mechjebActions = [
  {
    id: "engage-ascent",
    label: "Engage ascent autopilot",
    accepts: ["button"],
    description:
      "Commands the ascent autopilot to fly to the set target altitude.",
  },
  {
    id: "execute-node",
    label: "Execute next node",
    accepts: ["button"],
    description: "Commands execution of the next maneuver node.",
  },
  {
    id: "land-at-target",
    label: "Land at target",
    accepts: ["button"],
    description: "Commands an autopilot landing at the selected target.",
  },
] as const satisfies readonly ActionDefinition[];
export type MechJebActions = typeof mechjebActions;

/**
 * Whether MechJeb2 itself is reachable, off the uplink roster rather than any
 * topic of this Uplink's own: which MechJeb is installed is the identity of a
 * file on the operator's machine, and the roster is already where an Uplink
 * says whether the thing it depends on is usable. `MechJebUplink.Health()`
 * reports Unavailable with the version guard's reason whenever MechJeb2 is
 * absent or its API drifted, and registers no command handlers at all in that
 * state, so all three buttons below are inert.
 *
 * <p><b>An unread roster is not an unavailable uplink.</b> Only a roster that
 * arrived and named this Uplink unavailable returns a reason here; before that
 * the answer is null and the commands stay live, because a press that turns out
 * to be refused says so honestly and a disabled button on no evidence does not.</p>
 */
function unavailableReason(
  roster: SystemUplinkHealth | undefined,
): string | null {
  const entry = roster?.uplinks.find((u) => u.id === MECHJEB.id);
  if (entry == null || entry.health.state !== "unavailable") {
    return null;
  }
  return (
    entry.health.detail ??
    entry.reason ??
    "MechJeb2 is not reachable from the mod."
  );
}

function CommandRow({
  label,
  command,
  unavailable,
  onPressReady,
}: Readonly<{
  label: string;
  command: CommandInput;
  unavailable: string | null;
  onPressReady: (press: (() => void) | null) => void;
}>) {
  return (
    <Button
      command={command}
      unavailable={unavailable}
      onPressReady={onPressReady}
      aria-label={label}
    >
      {label}
    </Button>
  );
}

function MechJebComponent({ config }: Readonly<ComponentProps<MechJebConfig>>) {
  const engage = useCommand("mechjeb.engageAscentAutopilot");
  const executeNode = useCommand("mechjeb.executeNextNode");
  const land = useCommand("mechjeb.landAtTarget");

  // The delay sets how long a command takes to arrive, so it is a judgement: a
  // held value would time an uplink against a link that has since changed.
  //
  // Read straight off the Topic, with no cast: the payload declares
  // `oneWaySeconds` as a `Value<"s">`, and it arrives as one. Asserting it was
  // a bare number and re-wrapping it in `value("s", ...)` built a value whose
  // magnitude was an object, which every formatter renders as the null dash, so
  // a Duna-distance link read as no delay model at all.
  const delay = useTelemetry("comms.delay");
  const oneWay =
    delay.state === "observed" ? delay.value.oneWaySeconds : undefined;

  // A held roster is still the roster: uplinks do not come and go with the link.
  const healthReading = useStream<SystemUplinkHealth>("system.uplinkHealth");
  const unavailable = unavailableReason(
    healthReading.state === "observed" || healthReading.state === "held"
      ? healthReading.value
      : undefined,
  );

  // Held as the RAW string, not as a number, because `Number("")` is 0 and
  // `Number("what")` is NaN: parsing on every keystroke turns "the operator has
  // not given us an altitude" into "the operator asked for a 0 km orbit", and
  // the two are indistinguishable by the time they reach the wire. NaN reaches
  // it as JSON `null`, which the mod deserialises to 0 as well, so both spellings
  // of an unread field arrive as a confident number MechJeb will fly to.
  const [altitudeText, setAltitudeText] = useState<string>(
    String(config?.defaultAscentAltitudeKm ?? DEFAULT_ASCENT_ALTITUDE_KM),
  );
  const altitudeInputId = useId();
  const altitudeNoteId = useId();

  // `undefined` is the third value: blank, non-numeric, zero and negative all
  // land here, and none of them is an orbit. The same bound the mod's own
  // `MechJebAscentGuard` refuses on, so the widget declines to send what the
  // Uplink would decline to fly.
  const parsedAltitude = Number(altitudeText);
  const altitudeKm =
    altitudeText.trim() !== "" &&
    Number.isFinite(parsedAltitude) &&
    parsedAltitude > 0
      ? parsedAltitude
      : undefined;

  // A bound serial or keyboard input presses the same control a click does, so
  // the refusals live on the controls and a press is null while one applies.
  const presses = useRef<Record<string, (() => void) | null>>({});
  const pressReady = (id: string) => (press: (() => void) | null) => {
    presses.current[id] = press;
  };
  const firePress = (id: string) => presses.current[id]?.();

  useActionInput<MechJebActions>({
    "engage-ascent": (payload) => {
      if (payload.kind === "button" && payload.value !== true) return undefined;
      firePress("engage");
      return undefined;
    },
    "execute-node": (payload) => {
      if (payload.kind === "button" && payload.value !== true) return undefined;
      firePress("execute");
      return undefined;
    },
    "land-at-target": (payload) => {
      if (payload.kind === "button" && payload.value !== true) return undefined;
      firePress("land");
      return undefined;
    },
  });

  return (
    <Panel
      panelTitle="MechJeb"
      sections={[
        /* The link caption qualifies every command below it rather than sitting
           beside one, so it spans the section grid. */
        <Section key="link" full>
          <Text level="faint" size="xs">
            {oneWay != null
              ? `Remote autopilot (${writeQuantity(oneWay, { decimals: 1 })} one-way delay)`
              : "Remote autopilot"}
          </Text>
          {unavailable != null ? (
            <span role="status" aria-live="polite">
              <Badge tone="nogo" size="sm">
                MECHJEB NOT REACHABLE
              </Badge>
              <Text tone="warn" size="xs">
                {unavailable}
              </Text>
            </span>
          ) : null}
        </Section>,
        <Section key="ascent" title="Ascent">
          {/* Label above the field rather than beside it, so the field gets the
              section's full width: beside its label a 3-column tile leaves too
              little room to read back the altitude about to be flown. */}
          <Field>
            <FieldLabel htmlFor={altitudeInputId}>
              Target altitude (km)
            </FieldLabel>
            <Input
              id={altitudeInputId}
              type="number"
              min={0}
              step={5}
              value={altitudeText}
              aria-invalid={altitudeKm == null ? true : undefined}
              aria-describedby={altitudeKm == null ? altitudeNoteId : undefined}
              onChange={(e) => setAltitudeText(e.target.value)}
            />
          </Field>
          {altitudeKm == null ? (
            <Text id={altitudeNoteId} tone="warn" size="xs">
              No target altitude read from the field, so there is nothing to
              engage to
            </Text>
          ) : null}
          <CommandRow
            label="Engage ascent autopilot"
            command={engage.with(
              { targetAltitudeKm: altitudeKm ?? 0 },
              {
                label:
                  altitudeKm == null
                    ? "Engage ascent"
                    : `Engage ascent to ${writeQuantity(value("km", altitudeKm))}`,
              },
            )}
            unavailable={
              unavailable ??
              (altitudeKm == null
                ? "No target altitude read from the field"
                : null)
            }
            onPressReady={pressReady("engage")}
          />
        </Section>,
        <Section key="maneuvers" title="Maneuvers">
          <CommandRow
            label="Execute next node"
            command={executeNode.with({}, { label: "Execute next node" })}
            unavailable={unavailable}
            onPressReady={pressReady("execute")}
          />
          <CommandRow
            label="Land at target"
            command={land.with({}, { label: "Land at target" })}
            unavailable={unavailable}
            onPressReady={pressReady("land")}
          />
        </Section>,
      ]}
    />
  );
}

registerComponent<MechJebConfig>({
  id: "mechjeb",
  name: "MechJeb",
  description:
    "Engage MechJeb's ascent autopilot, node execution or landing.",
  tags: ["control"],
  defaultSize: { w: 5, h: 7 },
  minSize: { w: 4, h: 5 },
  component: MechJebComponent,
  // Command-only widget: MechJeb readouts are derivable, so the only READ is
  // comms.delay (for the delay-context subtitle). The mechjeb.* COMMAND topics
  // route through the command layer, not dataRequirements.
  dataRequirements: ["comms.delay"],
  defaultConfig: { defaultAscentAltitudeKm: DEFAULT_ASCENT_ALTITUDE_KM },
  actions: mechjebActions,
  requires: ["flight"],
  owner: MECHJEB,
});

export { MechJebComponent };
