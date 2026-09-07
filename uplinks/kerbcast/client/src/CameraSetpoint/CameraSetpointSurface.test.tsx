import { render, screen } from "@ksp-gonogo/sitrep-sdk/testing";
import { expectNoA11yViolations } from "@ksp-gonogo/ui-kit/testing";
import { describe, expect, it } from "vitest";
import { CameraSetpointSurface } from "./CameraSetpointSurface.js";

const bounds = {
  yawMin: -90,
  yawMax: 90,
  pitchMin: -45,
  pitchMax: 45,
  fovMin: 10,
  fovMax: 90,
};
const initial = { yaw: 0, pitch: 0, fov: 60 };

// jest-dom matchers aren't wired into the kerbcast test setup (see
// CameraFeed.test.tsx / FramingPreview.test.tsx), so assert presence with
// plain truthy / null / property checks rather than toBeInTheDocument etc.
describe("CameraSetpointSurface", () => {
  it("is hidden in live mode", () => {
    const { container } = render(
      <CameraSetpointSurface
        cameraId={42}
        bounds={bounds}
        initial={initial}
        mode="live"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the three setpoint sliders in staged mode", () => {
    render(
      <CameraSetpointSurface
        cameraId={42}
        bounds={bounds}
        initial={initial}
        mode="staged"
      />,
    );
    expect(screen.getByRole("slider", { name: /yaw/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /pitch/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /field of view/i })).toBeTruthy();
  });

  it("gates the commit in no-path mode", () => {
    render(
      <CameraSetpointSurface
        cameraId={42}
        bounds={bounds}
        initial={initial}
        mode="no-path"
      />,
    );
    const commit = screen.getByRole("button", { name: /commit/i });
    expect((commit as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the framing preview for a picture with room to spare, and drops it otherwise", () => {
    // The picture the widget's own default tile draws (316x176) is not one of
    // them: the wheels, the commit and a tile beside them would be a third of
    // its width, and the review of an aim is the part of this cluster a small
    // picture can do without.
    const { rerender } = render(
      <CameraSetpointSurface
        cameraId={42}
        bounds={bounds}
        initial={initial}
        mode="staged"
        frame={{ width: 316, height: 176 }}
      />,
    );
    expect(screen.queryByRole("img", { name: "Camera framing preview" })).toBe(
      null,
    );

    rerender(
      <CameraSetpointSurface
        cameraId={42}
        bounds={bounds}
        initial={initial}
        mode="staged"
        frame={{ width: 900, height: 506 }}
      />,
    );
    expect(
      screen.getByRole("img", { name: "Camera framing preview" }),
    ).toBeTruthy();
  });

  it("has no axe violations in staged mode", async () => {
    const { container } = render(
      <CameraSetpointSurface
        cameraId={42}
        bounds={bounds}
        initial={initial}
        mode="staged"
      />,
    );
    await expectNoA11yViolations(container);
  });
});
