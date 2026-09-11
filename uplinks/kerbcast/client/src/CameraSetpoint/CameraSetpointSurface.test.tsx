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

  it("draws the framing preview on the picture the shipped default tile produces", () => {
    // 316x176, measured in the render harness rather than assumed: it is what
    // `camera-feed` at its own `defaultSize` gives the frame. This is the case
    // the preview was never once drawn for. The old rule capped the cluster at
    // a THIRD of the picture's width, which is 105px here, and the wheels alone
    // were 104px, so no tile fitted on any picture this widget draws at any
    // shipped tile size.
    render(
      <CameraSetpointSurface
        cameraId={42}
        bounds={bounds}
        initial={initial}
        mode="staged"
        frame={{ width: 316, height: 176 }}
      />,
    );
    expect(
      screen.getByRole("img", { name: "Camera framing preview" }),
    ).toBeTruthy();
  });

  it("drops the framing preview on a picture that cannot spare it", () => {
    // 220x122, the picture the widget's own `minSize` tile produces. The
    // cluster plus a tile is 215px across and does not physically fit inside
    // it, so the tile goes and the numbers stay: they are the control, the tile
    // is the review of them.
    const { rerender } = render(
      <CameraSetpointSurface
        cameraId={42}
        bounds={bounds}
        initial={initial}
        mode="staged"
        frame={{ width: 220, height: 122 }}
      />,
    );
    expect(screen.queryByRole("img", { name: "Camera framing preview" })).toBe(
      null,
    );
    expect(screen.getByRole("slider", { name: /yaw/i })).toBeTruthy();

    // A zero-sized frame is what an unmeasured feed reports, and what every
    // jsdom test reports; it is not a picture with room for anything.
    rerender(
      <CameraSetpointSurface
        cameraId={42}
        bounds={bounds}
        initial={initial}
        mode="staged"
        frame={{ width: 0, height: 0 }}
      />,
    );
    expect(screen.queryByRole("img", { name: "Camera framing preview" })).toBe(
      null,
    );
  });

  it("keeps the cluster to a quarter of the picture it is drawn over", () => {
    // The cap that decides the tile is on AREA, because the cluster is short: a
    // block that looks like two thirds of the width is a fifth of the shot. A
    // picture wide enough to hold the cluster but too small to carry it still
    // drops the tile.
    render(
      <CameraSetpointSurface
        cameraId={42}
        bounds={bounds}
        initial={initial}
        mode="staged"
        frame={{ width: 260, height: 100 }}
      />,
    );
    expect(screen.queryByRole("img", { name: "Camera framing preview" })).toBe(
      null,
    );
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
