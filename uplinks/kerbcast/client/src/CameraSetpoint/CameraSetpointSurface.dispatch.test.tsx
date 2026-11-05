import { act, fireEvent, screen, waitFor } from "@ksp-gonogo/sitrep-sdk/testing";
import { describe, expect, it } from "vitest";
import { renderWithCommandClient } from "../test/commandHarness.js";
import { CameraSetpointSurface } from "./CameraSetpointSurface.js";

const bounds = {
  yawMin: -90,
  yawMax: 90,
  pitchMin: -45,
  pitchMax: 45,
  fovMin: 10,
  fovMax: 90,
};

describe("CameraSetpointSurface dispatch", () => {
  it("commits both absolute delayed commands with the dialled values", async () => {
    const { transport } = renderWithCommandClient(
      <CameraSetpointSurface
        cameraId={42}
        bounds={bounds}
        initial={{ yaw: 10, pitch: -5, fov: 40 }}
        mode="staged"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /commit/i }));
    await waitFor(() => expect(transport.sentCommands).toHaveLength(2));

    const pan = transport.sentCommands.find(
      (c) => c.command === "kerbcast.setPan",
    );
    const fov = transport.sentCommands.find(
      (c) => c.command === "kerbcast.setFieldOfView",
    );
    expect(pan?.args).toEqual({ cameraId: 42, lensKey: "42", yaw: 10, pitch: -5 });
    expect(fov?.args).toEqual({ cameraId: 42, lensKey: "42", fieldOfView: 40 });
  });

  it("dispatches with no signal path", () => {
    const { transport } = renderWithCommandClient(
      <CameraSetpointSurface
        cameraId={42}
        bounds={bounds}
        initial={{ yaw: 0, pitch: 0, fov: 60 }}
        mode="no-path"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /commit/i }));
    expect(
      transport.sentCommands.map((c) => c.command).sort(),
    ).toEqual(["kerbcast.setFieldOfView", "kerbcast.setPan"]);
  });

  describe("the commit morph", () => {
    const frame = { width: 394, height: 221 };

    function commitWith(
      answer: (transport: {
        setCommandHandler: (h: () => unknown) => void;
        holdCommands: () => void;
      }) => void,
    ) {
      const { transport } = renderWithCommandClient(
        <CameraSetpointSurface
          cameraId={42}
          bounds={bounds}
          initial={{ yaw: 10, pitch: -5, fov: 40 }}
          mode="staged"
          frame={frame}
        />,
      );
      answer(transport);
      fireEvent.click(screen.getByRole("button", { name: /commit/i }));
      return transport;
    }

    const quadGroup = () =>
      document.querySelector('[data-role="target-quad"]')
        ?.parentElement as unknown as SVGGElement;

    it("runs once the craft has answered both commands", async () => {
      commitWith(() => {});
      await waitFor(() => expect(quadGroup().style.transform).not.toBe("none"));
    });

    it("does not run while the commands are still on their way", async () => {
      const transport = commitWith((t) => t.holdCommands());
      await act(async () => {});
      expect(quadGroup().style.transform).toBe("none");

      act(() => transport.answerHeldCommands());
      await waitFor(() => expect(quadGroup().style.transform).not.toBe("none"));
    });

    it("does not run when a command is refused", async () => {
      commitWith((t) =>
        t.setCommandHandler(() => {
          throw new Error("refused");
        }),
      );
      await act(async () => {});
      await act(async () => {});
      expect(quadGroup().style.transform).toBe("none");
    });
  });
});
