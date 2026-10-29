import { useCommand, useTelemetry } from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  Button,
  Cluster,
  CommandButton,
  type DataTableColumn,
  DataTable,
  EmptyState,
  ModalProvider,
  NULL_DISPLAY,
  Stack,
  Text,
  useModal,
} from "@ksp-gonogo/ui-kit";
import { useEffect, useSyncExternalStore } from "react";
import type {
  KerbalismDevice,
  KerbalismLogEntry,
  KerbalismReliabilityPart,
  KerbalismScript,
} from "../__generated__/contract.js";

const useDeviceSet = () => useCommand("kerbalism.device.set");
const useScriptSet = () => useCommand("kerbalism.script.set");
type DeviceSetHandle = ReturnType<typeof useDeviceSet>;
type ScriptSetHandle = ReturnType<typeof useScriptSet>;

/** What the three windows draw, as the latest values the Ship Systems widget has read. */
interface Diagnostics {
  devices: readonly KerbalismDevice[] | undefined;
  scripts: readonly KerbalismScript[] | undefined;
  log: readonly KerbalismLogEntry[] | undefined;
  parts: readonly KerbalismReliabilityPart[] | undefined;
  /** Whether any of the above is the last reading rather than a current one. */
  held: boolean;
  /** The commands the Auto window sends, read where the telemetry provider is mounted. */
  deviceSet: DeviceSetHandle | undefined;
  scriptSet: ScriptSetHandle | undefined;
}

const NOTHING: Diagnostics = {
  devices: undefined,
  scripts: undefined,
  log: undefined,
  parts: undefined,
  held: false,
  deviceSet: undefined,
  scriptSet: undefined,
};

/*
 * A dialog renders where the app mounts its modal layer, which need not sit
 * under the telemetry provider the widget reads from, so the windows read this
 * store rather than calling useTelemetry themselves. The widget writes it on
 * every change, which keeps an open window live.
 */
let current: Diagnostics = NOTHING;
const listeners = new Set<() => void>();

function publish(next: Diagnostics) {
  if (
    next.devices === current.devices &&
    next.scripts === current.scripts &&
    next.log === current.log &&
    next.parts === current.parts &&
    next.held === current.held &&
    next.deviceSet === current.deviceSet &&
    next.scriptSet === current.scriptSet
  ) {
    return;
  }
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function useDiagnostics(): Diagnostics {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => NOTHING,
  );
}

/** A script type as the operator reads it: `power_low` is "Power low". */
export function scriptLabel(type: string | null | undefined): string {
  if (!type) return NULL_DISPLAY;
  const words = type.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Kerbalism's own names for a log entry's severity. */
export function levelLabel(level: string | null | undefined): string {
  return level ? level.toUpperCase() : NULL_DISPLAY;
}

/** A reliability condition as the Failures window words it. */
export function conditionLabel(condition: string | null | undefined): string {
  switch (condition) {
    case "nominal":
      return "good";
    case "service-due":
      return "service due";
    case "failed":
    case "failed-critical":
      return "broken";
    default:
      return "unknown";
  }
}

function conditionTone(condition: string | null | undefined) {
  switch (condition) {
    case "nominal":
      return "neutral" as const;
    case "service-due":
      return "warn" as const;
    case "failed":
    case "failed-critical":
      return "nogo" as const;
    default:
      return "info" as const;
  }
}

function levelTone(level: string | null | undefined) {
  switch (level) {
    case "fatality":
    case "danger":
      return "nogo" as const;
    case "warning":
    case "breakdown":
      return "warn" as const;
    case "relax":
      return "go" as const;
    default:
      return "neutral" as const;
  }
}

function DeviceSwitch({ device }: { device: KerbalismDevice }) {
  const { deviceSet } = useDiagnostics();
  if (!deviceSet || !device.id) return null;
  const name = device.name ?? "device";
  return (
    <Cluster justify="end" wrap={false}>
      <CommandButton
        size="sm"
        tone="go"
        handle={deviceSet}
        args={{ deviceId: device.id, on: true }}
        commandLabel={`Switch ${name} on`}
        label="On"
        pendingLabel="Switching on..."
        aria-label={`Switch ${name} on`}
      />
      <CommandButton
        size="sm"
        handle={deviceSet}
        args={{ deviceId: device.id, on: false }}
        commandLabel={`Switch ${name} off`}
        label="Off"
        pendingLabel="Switching off..."
        aria-label={`Switch ${name} off`}
      />
    </Cluster>
  );
}

const deviceColumns: ReadonlyArray<DataTableColumn<KerbalismDevice>> = [
  {
    key: "device",
    header: "Device",
    rowHeader: true,
    width: "100%",
    minWidth: "14ch",
    render: (d) => (
      <>
        {d.name ?? NULL_DISPLAY}
        {d.partName ? (
          <Text level="muted" size="xs">
            {" "}
            {d.partName}
          </Text>
        ) : null}
      </>
    ),
  },
  {
    key: "state",
    header: "State",
    align: "end",
    render: (d) =>
      d.status ? <Badge size="sm">{d.status}</Badge> : NULL_DISPLAY,
  },
  {
    key: "switch",
    header: "Switch",
    align: "end",
    render: (d) => <DeviceSwitch device={d} />,
  },
];

const scriptColumns: ReadonlyArray<DataTableColumn<KerbalismScript>> = [
  {
    key: "script",
    header: "Script",
    rowHeader: true,
    width: "100%",
    render: (s) => scriptLabel(s.type),
  },
  {
    key: "devices",
    header: "Devices",
    align: "end",
    value: (s) => s.deviceCount,
  },
];

function stateWords(state: boolean | null | undefined): string {
  if (state == null) return "not set";
  return state ? "on" : "off";
}

function ScriptDeviceControls({
  script,
  device,
}: {
  script: string;
  device: KerbalismDevice;
}) {
  const { scriptSet } = useDiagnostics();
  if (!scriptSet || !device.id) return null;
  const name = device.name ?? "device";
  const label = scriptLabel(script);
  const setTo = (state: boolean | null, words: string) => (
    <CommandButton
      size="sm"
      handle={scriptSet}
      args={{ scriptType: script, deviceId: device.id as string, state: state ?? undefined }}
      commandLabel={`${label} script: ${words} ${name}`}
      label={words === "remove" ? "Remove" : words === "on" ? "On" : "Off"}
      pendingLabel="Setting..."
      aria-label={`${label} script: ${words} ${name}`}
    />
  );
  return (
    <Cluster justify="end" wrap={false}>
      {setTo(true, "on")}
      {setTo(false, "off")}
      {setTo(null, "remove")}
    </Cluster>
  );
}

/** Each event script's devices and the state it gives each, with the controls that change it. */
function ScriptEditor({
  scripts,
  devices,
}: {
  scripts: readonly KerbalismScript[];
  devices: readonly KerbalismDevice[];
}) {
  return (
    <>
      {scripts.map((script) => {
        const type = script.type ?? "";
        const states = new Map(
          (script.states ?? []).map((st) => [st.deviceId, st.on]),
        );
        return (
          <Stack key={type}>
            <Text weight="semibold">{`${scriptLabel(type)} script`}</Text>
            <DataTable
              caption={`What the ${scriptLabel(type).toLowerCase()} script does to each device`}
              columns={[
                {
                  key: "device",
                  header: "Device",
                  rowHeader: true,
                  width: "100%",
                  render: (d: KerbalismDevice) => d.name ?? NULL_DISPLAY,
                },
                {
                  key: "state",
                  header: "Sets",
                  align: "end",
                  render: (d: KerbalismDevice) => (
                    <Badge size="sm">{stateWords(states.get(d.id))}</Badge>
                  ),
                },
                {
                  key: "set",
                  header: "Change",
                  align: "end",
                  render: (d: KerbalismDevice) => (
                    <ScriptDeviceControls script={type} device={d} />
                  ),
                },
              ]}
              rows={devices}
              rowKey={(d) => d.id ?? d.name ?? ""}
            />
          </Stack>
        );
      })}
    </>
  );
}

/** Says the window shows the last reading, since a held reading is otherwise drawn like a current one. */
function HeldNote() {
  const { held } = useDiagnostics();
  return held ? (
    <Badge tone="info" size="sm">
      held
    </Badge>
  ) : null;
}

/** The devices Kerbalism's computer can switch and the event scripts that set them. */
export function AutoWindow() {
  const { devices, scripts } = useDiagnostics();
  if (devices === undefined && scripts === undefined) {
    return <EmptyState>{NULL_DISPLAY}</EmptyState>;
  }
  return (
    <Stack>
      <HeldNote />
      <DataTable
        caption="Devices Kerbalism can switch"
        columns={deviceColumns}
        rows={devices ?? []}
        rowKey={(d) => d.id ?? d.name ?? ""}
        empty={<EmptyState>No devices</EmptyState>}
      />
      <DataTable
        caption="Event scripts and the devices each sets"
        columns={scriptColumns}
        rows={scripts ?? []}
        rowKey={(s) => s.type ?? ""}
        empty={<EmptyState>No scripts</EmptyState>}
      />
      {scripts && devices ? (
        <ScriptEditor scripts={scripts} devices={devices} />
      ) : null}
    </Stack>
  );
}

const logColumns: ReadonlyArray<DataTableColumn<KerbalismLogEntry>> = [
  {
    key: "level",
    header: "Level",
    render: (e) => (
      <Badge size="sm" tone={levelTone(e.level)}>
        {levelLabel(e.level)}
      </Badge>
    ),
  },
  {
    key: "message",
    header: "Message",
    width: "100%",
    minWidth: "18ch",
    render: (e) => e.message ?? NULL_DISPLAY,
  },
];

export function LogWindow() {
  const { log } = useDiagnostics();
  if (log === undefined) return <EmptyState>{NULL_DISPLAY}</EmptyState>;
  return (
    <Stack>
      <HeldNote />
      <DataTable
        caption="Kerbalism's message log, newest first"
        columns={logColumns}
        rows={log.map((entry, index) => ({ ...entry, index }))}
        rowKey={(e) => String(e.index)}
        empty={<EmptyState>No messages</EmptyState>}
      />
    </Stack>
  );
}

const failureColumns: ReadonlyArray<DataTableColumn<KerbalismReliabilityPart>> =
  [
    {
      key: "part",
      header: "Part",
      rowHeader: true,
      width: "100%",
      minWidth: "14ch",
      render: (p) => p.title ?? NULL_DISPLAY,
    },
    {
      key: "condition",
      header: "Condition",
      align: "end",
      render: (p) => (
        <Badge size="sm" tone={conditionTone(p.condition)}>
          {conditionLabel(p.condition)}
        </Badge>
      ),
    },
  ];

/** The reliability parts grouped under Kerbalism's own name for the group they back up. */
export function groupParts(
  parts: readonly KerbalismReliabilityPart[],
): Array<{ id: string; title: string; rows: KerbalismReliabilityPart[] }> {
  const groups = new Map<string, KerbalismReliabilityPart[]>();
  for (const part of parts) {
    const key = part.redundancyGroup ?? "";
    groups.set(key, [...(groups.get(key) ?? []), part]);
  }
  return [...groups].map(([key, rows]) => ({
    id: key || "ungrouped",
    title: key || NULL_DISPLAY,
    rows,
  }));
}

export function FailuresWindow() {
  const { parts } = useDiagnostics();
  if (parts === undefined) return <EmptyState>{NULL_DISPLAY}</EmptyState>;
  return (
    <Stack>
      <HeldNote />
      <DataTable
        caption="Parts that can fail, grouped by Kerbalism's group name"
        columns={failureColumns}
        sections={groupParts(parts)}
        rowKey={(p) => p.partId ?? p.title ?? ""}
        empty={<EmptyState>No parts</EmptyState>}
      />
    </Stack>
  );
}

function DiagnosticsButtonRow() {
  const { open } = useModal();
  const { log, parts } = useDiagnostics();
  const brokenOrDue =
    parts?.filter((p) => p.condition !== "nominal").length ?? null;

  return (
    <Cluster justify="start" wrap>
      <Button size="sm" onClick={() => open(<AutoWindow />, { title: "Auto" })}>
        Auto
      </Button>
      <Button size="sm" onClick={() => open(<LogWindow />, { title: "Log" })}>
        Log
        {log !== undefined && log.length > 0 && (
          <Badge size="sm">{log.length}</Badge>
        )}
      </Button>
      <Button
        size="sm"
        onClick={() => open(<FailuresWindow />, { title: "Failures" })}
      >
        Failures
        {brokenOrDue !== null && brokenOrDue > 0 && (
          <Badge size="sm" tone="warn">
            {brokenOrDue}
          </Badge>
        )}
      </Button>
    </Cluster>
  );
}

/**
 * The three buttons that open Kerbalism's automation, log and failures windows,
 * and the reader that keeps them current. Carries its own `ModalProvider`, which
 * is harmless where the dashboard already mounts one and is what lets the
 * windows open where none is mounted.
 */
export function DiagnosticsButtons() {
  const diagnostics = useTelemetry("kerbalism.diagnostics");
  const partsReading = useTelemetry("kerbalism.reliabilityParts");
  const deviceSet = useDeviceSet();
  const scriptSet = useScriptSet();

  const body =
    diagnostics.state === "observed" || diagnostics.state === "held"
      ? diagnostics.value
      : undefined;
  const parts =
    partsReading.state === "observed" || partsReading.state === "held"
      ? partsReading.value
      : undefined;

  const held = diagnostics.state === "held" || partsReading.state === "held";
  const devices = body?.devices ?? undefined;
  const scripts = body?.scripts ?? undefined;
  const log = body?.log ?? undefined;
  useEffect(() => {
    publish({ devices, scripts, log, parts, held, deviceSet, scriptSet });
  }, [devices, scripts, log, parts, held, deviceSet, scriptSet]);
  useEffect(() => () => publish(NOTHING), []);

  return (
    <ModalProvider>
      <DiagnosticsButtonRow />
    </ModalProvider>
  );
}
