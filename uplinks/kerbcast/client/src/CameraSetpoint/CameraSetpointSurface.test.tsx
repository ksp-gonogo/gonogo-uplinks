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

  it("draws the framing preview at the bottom centre, outside the cluster", () => {
    // 394 is the narrowest picture that can hold a centred tile clear of the
    // cluster: the cluster is 151px wide inset 10 from the right, so its left
    // edge is at `width - 161`, and half a 64px tile plus 4px of clear air
    // reaches `width / 2 + 36`. The two meet at 394.
    const { container } = render(
      <CameraSetpointSurface
        cameraId={42}
        bounds={bounds}
        initial={initial}
        mode="staged"
        frame={{ width: 394, height: 221 }}
      />,
    );
    const preview = screen.getByRole("img", { name: "Camera framing preview" });

    // Out of the command group's container, which is what the move was for: the
    // cluster is `overflow: hidden` and was slicing the quad's deliberate spill.
    const cluster = container.querySelector(
      '[aria-label="Delayed camera control"]',
    ) as HTMLElement;
    expect(cluster).not.toBeNull();
    expect(cluster.contains(preview)).toBe(false);

    // Centred on the picture, standing on the same bottom inset as the cluster.
    const tile = preview.parentElement as HTMLElement;
    expect(tile.style.left).toBe("50%");
    expect(tile.style.transform).toBe("translateX(-50%)");
    expect(tile.style.bottom).toBe("10px");
    // A readout with no gesture of its own must not eat the feed's pointer.
    expect(tile.style.pointerEvents).toBe("none");
    // Both are children of the same overlay layer, so the tile really is
    // positioned against the picture rather than against the control.
    expect(tile.parentElement).toBe(container);
  });

  it("drops the framing preview when the cluster reaches past the centre line", () => {
    // 348x194, the picture the widget's own `defaultSize` tile produces now
    // that its host takes no panel title: 32px wider than the 316x176 it drew
    // with one, and it still does not fit. The cluster's left edge lands at
    // 187, where half a 64px tile plus 4px of clear air reaches 210. What
    // decides the 394 it would take is the commit: 63 of the cluster's 151px
    // is the word "COMMIT", and while the commit is a word a centred tile
    // needs that much picture before it has anywhere to stand.
    const { rerender } = render(
      <CameraSetpointSurface
        cameraId={42}
        bounds={bounds}
        initial={initial}
        mode="staged"
        frame={{ width: 348, height: 194 }}
      />,
    );
    expect(screen.queryByRole("img", { name: "Camera framing preview" })).toBe(
      null,
    );
    // The numbers are the control and they never go: only the review of them does.
    expect(screen.getByRole("slider", { name: /yaw/i })).toBeTruthy();

    // 268x149, the picture `minSize` produces. Here the cluster is 56% of the
    // width, so the centre line is buried deeper still. The picture is now
    // width-limited rather than height-limited: with the title gone the six
    // rows have height to spare, so the seven columns are what caps it.
    rerender(
      <CameraSetpointSurface
        cameraId={42}
        bounds={bounds}
        initial={initial}
        mode="staged"
        frame={{ width: 268, height: 149 }}
      />,
    );
    expect(screen.queryByRole("img", { name: "Camera framing preview" })).toBe(
      null,
    );

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

  it("drops the framing preview on a picture too short to stand it in", () => {
    // Wide enough to clear the cluster, but 40px tall: the tile's own minimum
    // height plus the insets it stands on does not fit between the picture's
    // edges, and a tile taller than the shot is not a model of it.
    render(
      <CameraSetpointSurface
        cameraId={42}
        bounds={bounds}
        initial={initial}
        mode="staged"
        frame={{ width: 800, height: 40 }}
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
