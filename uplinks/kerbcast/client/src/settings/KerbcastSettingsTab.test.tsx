import { act, fireEvent, render, screen } from "@ksp-gonogo/sitrep-sdk/testing";
import { expectNoA11yViolations } from "@ksp-gonogo/ui-kit/testing";
import { describe, expect, it, vi } from "vitest";
import {
  KerbcastSettingsTab,
  type ThrottleControl,
} from "./KerbcastSettingsTab.js";

function fakeControl(initial: boolean) {
  let value = initial;
  const listeners = new Set<(enabled: boolean) => void>();
  const set = vi.fn(async (_enabled: boolean) => {});
  const control: ThrottleControl = {
    getThrottleMainScreen: () => value,
    setThrottleMainScreen: set,
    onThrottleChange: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
  const report = (enabled: boolean) => {
    value = enabled;
    for (const cb of listeners) cb(enabled);
  };
  return { control, set, report };
}

describe("KerbcastSettingsTab", () => {
  it("shows the throttle the plugin last reported", async () => {
    const { control } = fakeControl(true);
    const { container } = render(<KerbcastSettingsTab control={control} />);
    expect(
      screen.getByRole("checkbox", { name: /throttle ksp main render/i }),
    ).toBeChecked();
    await expectNoA11yViolations(container);
  });

  it("asks the plugin to change it and follows the plugin's answer", () => {
    const { control, set, report } = fakeControl(false);
    render(<KerbcastSettingsTab control={control} />);
    const box = screen.getByRole("checkbox", {
      name: /throttle ksp main render/i,
    });
    fireEvent.click(box);
    expect(set).toHaveBeenCalledWith(true);
    expect(box).not.toBeChecked();
    act(() => report(true));
    expect(box).toBeChecked();
  });
});
