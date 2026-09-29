import { Cluster, Stack, Switch, Text } from "@ksp-gonogo/ui-kit";
import { useSyncExternalStore } from "react";
import { kerbcastSource } from "../KerbcastDataSource.js";

const LABEL = "Throttle KSP main render";

/** The slice of the sidecar connection the throttle row reads and writes. */
export interface ThrottleControl {
  getThrottleMainScreen(): boolean;
  setThrottleMainScreen(enabled: boolean): Promise<void>;
  onThrottleChange(cb: (enabled: boolean) => void): () => void;
}

/**
 * The kerbcast plugin's main-render throttle. The plugin owns the value and
 * persists it in the save, so the row reads and writes it over the sidecar
 * connection rather than through gonogo's settings file.
 */
export function KerbcastSettingsTab({
  control = kerbcastSource,
}: {
  control?: ThrottleControl;
}) {
  const throttled = useSyncExternalStore(
    (cb) => control.onThrottleChange(cb),
    () => control.getThrottleMainScreen(),
  );
  return (
    <Cluster align="start" gap="section-comfortable">
      <Stack gap="related">
        <Text size="sm">{LABEL}</Text>
        <Text level="muted" size="xs">
          Disables the main KSP flight cameras to free GPU headroom for kerbcast
          streams. Persists across saves.
        </Text>
      </Stack>
      <Switch
        aria-label={LABEL}
        checked={throttled}
        onChange={(next) => {
          void control.setThrottleMainScreen(next);
        }}
      />
    </Cluster>
  );
}
