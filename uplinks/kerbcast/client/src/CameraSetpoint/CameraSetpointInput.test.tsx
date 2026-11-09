import {
  createFakeCommand,
  fireEvent,
  render,
  screen,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { expectNoA11yViolations } from "@ksp-gonogo/ui-kit/testing";
import { describe, expect, it } from "vitest";
import { CameraSetpointInput } from "./CameraSetpointInput.js";
import { fovToPosition } from "./zoomScale.js";

const noCommit = () => createFakeCommand().handle.with(undefined);

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
        command={noCommit()}
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
        command={noCommit()}
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

  it("reads a command camera's sub-degree zoom to its precision, never as zero", () => {
    const command = { ...bounds, fovMin: 0.004, fovMax: 1.2 };
    for (const [fov, reading] of [
      [0.13, "Z0.13°"],
      [0.004, "Z0.004°"],
      [1.2, "Z1.2°"],
    ] as const) {
      const { unmount } = render(
        <CameraSetpointInput
          value={{ yaw: 0, pitch: 0, fov }}
          bounds={command}
          onChange={() => {}}
          command={noCommit()}
        />,
      );
      const zoom = screen.getByRole("slider", { name: "Zoom (field of view)" });
      expect(zoom.textContent).toBe(reading);
      expect(zoom).toHaveAttribute("aria-valuetext", reading);
      unmount();
    }
  });

  it("turns the zoom wheel on a log scale between the camera's limits", () => {
    const command = { ...bounds, fovMin: 0.004, fovMax: 1.2 };
    const changes: number[] = [];
    render(
      <CameraSetpointInput
        value={{ yaw: 0, pitch: 0, fov: 0.1 }}
        bounds={command}
        onChange={(next) => changes.push(next.fov)}
        command={noCommit()}
      />,
    );
    const zoom = screen.getByRole("slider", { name: "Zoom (field of view)" });
    fireEvent.keyDown(zoom, { key: "ArrowRight" });
    fireEvent.keyDown(zoom, { key: "ArrowLeft" });
    // The wheel snaps to its step grid, so the keys land on the neighbouring
    // multiples of a fiftieth of the range, not a fiftieth away from the draft.
    expect(fovToPosition(changes[0] as number, command)).toBeCloseTo(0.58, 8);
    expect(fovToPosition(changes[1] as number, command)).toBeCloseTo(0.54, 8);
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
        command={noCommit()}
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
        command={noCommit()}
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
        command={noCommit()}
      />,
    );
    expect(screen.getByRole("slider", { name: "Pitch" })).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
    for (const name of ["Yaw", "Zoom (field of view)"]) {
      expect(screen.getByRole("slider", { name })).toHaveAttribute(
        "aria-orientation",
        "horizontal",
      );
    }
  });

  it("sends the command it was given once on commit", () => {
    const fake = createFakeCommand<{ yaw: number }>();
    render(
      <CameraSetpointInput
        value={{ yaw: 10, pitch: -5, fov: 40 }}
        bounds={bounds}
        warning="No signal path"
        onChange={() => {}}
        command={fake.handle.with({ yaw: 10 })}
        commitLabel="Commit"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Commit" }));
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]?.args).toEqual({ yaw: 10 });
  });

  it("commits with a warning shown", () => {
    const fake = createFakeCommand();
    render(
      <CameraSetpointInput
        value={{ yaw: 0, pitch: 0, fov: 60 }}
        bounds={bounds}
        onChange={() => {}}
        command={fake.handle.with(undefined)}
        commitLabel="Commit"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Commit" }));
    expect(fake.sent).toHaveLength(1);
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
        command={noCommit()}
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
    // The commit is drawn in the scope the cluster sets. Uppercase is DRAWN
    // rather than spelled, so the accessible name stays the word: this asserts
    // the label that reaches an assistive technology, not the pixels.
    render(
      <CameraSetpointInput
        value={{ yaw: 0, pitch: 0, fov: 60 }}
        bounds={bounds}
        onChange={() => {}}
        command={noCommit()}
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
    // a 176px picture, so the commit is the last child of a row.
    const { container } = render(
      <CameraSetpointInput
        value={{ yaw: 0, pitch: 0, fov: 60 }}
        bounds={bounds}
        onChange={() => {}}
        command={noCommit()}
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
        command={noCommit()}
      />,
    );
    await expectNoA11yViolations(container);
  });
});
