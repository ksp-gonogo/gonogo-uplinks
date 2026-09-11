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

  it("names each flat axis twice: a glyph on the wheel, the word on the wheel's name", () => {
    // The flat wheels are 50px wide and there is no room beside them for a
    // label column, so the visible name is one character inside the caret
    // readout. That is a shorthand a sighted operator learns, never the
    // accessible name, which stays the whole word.
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
      ["Zoom (field of view)", "Z", "45°"],
    ]) {
      const wheel = screen.getByRole("slider", { name });
      expect(wheel).toHaveAttribute("aria-valuetext", `${glyph}${degrees}`);
      expect(wheel.textContent).toBe(`${glyph}${degrees}`);
    }
  });

  it("leaves the standing wheel's reading to its value, not to a caret it cannot hold", () => {
    // Measured, not preferred, and the quarter turn does not change it: the
    // kit's `orientation` leaves the caret label upright, so a standing wheel's
    // label still has only its WIDTH to sit in. A `WHEEL_SHORT_PX` box leaves
    // 18px of content, `P−10°` is 40px of the kit's mono, and the kit's wheel
    // is `overflow: hidden`, so the label would be sliced rather than shrunk.
    //
    // Naming the axis there instead is not a free swap either: the kit writes
    // `aria-valuetext` FROM the caret label, so a face reading "P" announces
    // "P" in place of the angle. Empty leaves `aria-valuenow` to carry it.
    const { container } = render(
      <CameraSetpointInput
        value={{ yaw: 18, pitch: -10, fov: 45 }}
        bounds={bounds}
        onChange={() => {}}
        onCommit={() => {}}
      />,
    );
    const pitch = screen.getByRole("slider", { name: "Pitch" });
    expect(pitch.textContent).toBe("");
    expect(pitch).toHaveAttribute("aria-valuenow", "-10");
    expect(container.querySelector('[title="Pitch −10°"]')).toBeTruthy();
  });

  it("writes a negative value with a true minus sign, which cannot break the line", () => {
    // A hyphen is a line-break opportunity, so `P-10°` broke after it and drew
    // two lines inside a wheel with room for one.
    render(
      <CameraSetpointInput
        value={{ yaw: -10, pitch: -10, fov: 60 }}
        bounds={bounds}
        onChange={() => {}}
        onCommit={() => {}}
      />,
    );
    // The standing pitch wheel draws no caret, so the rule is asserted on the
    // flat wheel that can carry a sign.
    const yaw = screen.getByRole("slider", { name: "Yaw" });
    expect(yaw.textContent).toBe("Y−10°");
    expect(yaw.textContent).not.toContain("-");
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

  it("draws the pitch wheel as the flat wheel turned a quarter turn", () => {
    // The operator's shape: the same box on both, one of them on its side. Two
    // earlier readings got it wrong in the same direction, first a 50x52
    // near-square beside two thin bars, then a strip whose height was however
    // deep the stack beside it happened to be.
    render(
      <CameraSetpointInput
        value={{ yaw: 0, pitch: 0, fov: 60 }}
        bounds={bounds}
        onChange={() => {}}
        onCommit={() => {}}
      />,
    );
    const box = (name: string): { width: string; height: string } => {
      const style = getComputedStyle(screen.getByRole("slider", { name }));
      return { width: style.width, height: style.height };
    };
    const flat = box("Yaw");
    expect(box("Zoom (field of view)")).toEqual(flat);
    expect(box("Pitch")).toEqual({ width: flat.height, height: flat.width });
  });

  it("draws the commit in the cluster's own voice without renaming it", () => {
    // `CommandGroup` renders the commit and offers a caller no say in how it
    // looks, so the scope it is drawn in is the lever. Uppercase is DRAWN
    // rather than spelled, so the accessible name stays the word: this asserts
    // the label that reaches an assistive technology, not the pixels.
    render(
      <CameraSetpointInput
        value={{ yaw: 0, pitch: 0, fov: 60 }}
        bounds={bounds}
        onChange={() => {}}
        onCommit={() => {}}
        commitLabel="Commit"
      />,
    );
    const commit = screen.getByRole("button", { name: "Commit" });
    expect(commit.textContent).toBe("Commit");
    const style = getComputedStyle(commit);
    expect(style.textTransform).toBe("uppercase");
    expect(style.fontFamily).toContain("--font-family-mono");
  });

  it("stands the commit beside the wheels, not under them", () => {
    // Under, the commit cost a whole line and the cluster came out 88px tall on
    // a 176px picture. `CommandGroup orientation="row"` is what the kit offers
    // for that, and what it offers is the whole of it: the commit is always the
    // group's LAST child, so an icon-sized control on the LEFT of the wheels is
    // not expressible without a change to `CommandGroup` itself.
    const { container } = render(
      <CameraSetpointInput
        value={{ yaw: 0, pitch: 0, fov: 60 }}
        bounds={bounds}
        onChange={() => {}}
        onCommit={() => {}}
      />,
    );
    const commit = screen.getByRole("button", { name: "Commit" });
    const group = commit.parentElement as HTMLElement;
    expect(container.contains(group)).toBe(true);
    expect(getComputedStyle(group).flexDirection).toBe("row");
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
