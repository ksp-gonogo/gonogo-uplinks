import { fireEvent, render, screen } from "@ksp-gonogo/sitrep-sdk/testing";
import { expectNoA11yViolations } from "@ksp-gonogo/ui-kit/testing";
import { describe, expect, it, vi } from "vitest";
import { CameraSetpointInput } from "./CameraSetpointInput.js";

const bounds = {
  yawMin: -90,
  yawMax: 90,
  pitchMin: -45,
  pitchMax: 45,
  fovMin: 10,
  fovMax: 90,
};

describe("CameraSetpointInput", () => {
  it("renders three sliders (yaw, pitch, fov)", () => {
    render(
      <CameraSetpointInput
        value={{ yaw: 0, pitch: 0, fov: 60 }}
        bounds={bounds}
        onChange={() => {}}
        onCommit={() => {}}
      />,
    );
    expect(screen.getByRole("slider", { name: /yaw/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /pitch/i })).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: /fov|field of view/i }),
    ).toBeInTheDocument();
  });

  it("names each axis twice: a glyph on the wheel, the word on the wheel's name", () => {
    // The wheels are 50px wide and there is no room beside them for a label
    // column, so the visible name is one character inside the caret readout.
    // That is a shorthand a sighted operator learns, never the accessible name,
    // which stays the whole word.
    render(
      <CameraSetpointInput
        value={{ yaw: 18, pitch: -10, fov: 45 }}
        bounds={bounds}
        onChange={() => {}}
        onCommit={() => {}}
      />,
    );
    for (const [name, glyph, degrees] of [
      ["Yaw", "Y", "18°"],
      ["Pitch", "P", "−10°"],
      ["Zoom (field of view)", "Z", "45°"],
    ]) {
      const wheel = screen.getByRole("slider", { name });
      expect(wheel).toHaveAttribute("aria-valuetext", `${glyph}${degrees}`);
      expect(wheel.textContent).toBe(`${glyph}${degrees}`);
    }
  });

  it("writes a negative value with a true minus sign, which cannot break the line", () => {
    // A hyphen is a line-break opportunity, so `P-10°` broke after it and drew
    // two lines inside a wheel with room for one.
    render(
      <CameraSetpointInput
        value={{ yaw: 0, pitch: -10, fov: 60 }}
        bounds={bounds}
        onChange={() => {}}
        onCommit={() => {}}
      />,
    );
    const pitch = screen.getByRole("slider", { name: "Pitch" });
    expect(pitch.textContent).not.toContain("-");
  });

  it("stands the pitch wheel up, and lays the other two flat", () => {
    render(
      <CameraSetpointInput
        value={{ yaw: 0, pitch: 0, fov: 60 }}
        bounds={bounds}
        onChange={() => {}}
        onCommit={() => {}}
      />,
    );
    expect(
      screen.getByRole("slider", { name: "Pitch" }),
    ).toHaveAttribute("aria-orientation", "vertical");
    for (const name of ["Yaw", "Zoom (field of view)"]) {
      expect(screen.getByRole("slider", { name })).toHaveAttribute(
        "aria-orientation",
        "horizontal",
      );
    }
  });

  it("commits the current vector once on commit", () => {
    const onCommit = vi.fn();
    render(
      <CameraSetpointInput
        value={{ yaw: 10, pitch: -5, fov: 40 }}
        bounds={bounds}
        onChange={() => {}}
        onCommit={onCommit}
        commitLabel="Commit"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Commit" }));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ yaw: 10, pitch: -5, fov: 40 });
  });

  it("gates the commit when gated (no-path)", () => {
    const onCommit = vi.fn();
    render(
      <CameraSetpointInput
        value={{ yaw: 0, pitch: 0, fov: 60 }}
        bounds={bounds}
        gated
        gatedReason="No signal path"
        onChange={() => {}}
        onCommit={onCommit}
        commitLabel="Commit"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Commit" }));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <CameraSetpointInput
        value={{ yaw: 0, pitch: 0, fov: 60 }}
        bounds={bounds}
        onChange={() => {}}
        onCommit={() => {}}
      />,
    );
    await expectNoA11yViolations(container);
  });
});
