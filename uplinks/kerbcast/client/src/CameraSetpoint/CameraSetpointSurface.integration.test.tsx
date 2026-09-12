import { act, fireEvent, screen, waitFor } from "@ksp-gonogo/sitrep-sdk/testing";
import { DelayRailProvider, Panel, Section } from "@ksp-gonogo/ui-kit";
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

// End-to-end through the real hook + client + stub wire: the delay gate decides
// whether the surface shows at all, and a dial-then-commit fires the two
// absolute delayed commands with the dialled values. Only the wire is a stub.
describe("delayed camera control, end to end", () => {
  it("live: surface hidden, nothing dispatched", () => {
    const { transport } = renderWithCommandClient(
      <CameraSetpointSurface
        cameraId={42}
        bounds={bounds}
        initial={{ yaw: 0, pitch: 0, fov: 60 }}
        mode="live"
      />,
    );
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.queryByRole("button", { name: /commit/i })).toBeNull();
    expect(transport.sentCommands).toHaveLength(0);
  });

  it("staged: dial then commit dispatches both delayed commands", async () => {
    const { transport } = renderWithCommandClient(
      <CameraSetpointSurface
        cameraId={42}
        bounds={bounds}
        initial={{ yaw: 0, pitch: 0, fov: 60 }}
        mode="staged"
      />,
    );
    // Dial yaw 0 -> 1 with the keyboard, then commit.
    fireEvent.keyDown(screen.getByRole("slider", { name: /yaw/i }), {
      key: "ArrowRight",
    });
    fireEvent.click(screen.getByRole("button", { name: /commit/i }));
    await waitFor(() => expect(transport.sentCommands).toHaveLength(2));

    const pan = transport.sentCommands.find(
      (c) => c.command === "kerbcast.setPan",
    );
    const fov = transport.sentCommands.find(
      (c) => c.command === "kerbcast.setFieldOfView",
    );
    expect(pan?.args).toEqual({ cameraId: 42, yaw: 1, pitch: 0 });
    expect(fov?.args).toEqual({ cameraId: 42, fieldOfView: 60 });
  });

  it("no-path: commit is dropped", () => {
    const { transport } = renderWithCommandClient(
      <CameraSetpointSurface
        cameraId={42}
        bounds={bounds}
        initial={{ yaw: 0, pitch: 0, fov: 60 }}
        mode="no-path"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /commit/i }));
    expect(transport.sentCommands).toHaveLength(0);
  });

  // The reason the widget was put under `Panel` at all: a camera aim is a
  // delayed command like any other, and the operator reads its flight in the
  // band the panel reserves rather than in a readout the widget draws over its
  // own picture.
  it("staged: a travelling commit shows in the host panel's delay rail", async () => {
    const { transport } = renderWithCommandClient(
      // `DelayRailProvider` above the panel, not inside it: the widget body
      // calls `usePanelDelay` and the rail reads the same store from below, so
      // the store has to sit where both can see it. The dashboard mounts one per
      // grid item; `renderWidget` mounts one too.
      <DelayRailProvider>
        {/* Untitled, which is the panel shape `CameraFeed` actually renders: it
            takes no title (the SDK's picker names the widget), so the rail lives
            in the container's own top band rather than inside a header's sticky
            unit. A harness that kept a title would prove the band on a shape
            this surface is never drawn in. */}
        <Panel
          sections={
            <Section full>
              <CameraSetpointSurface
                cameraId={42}
                bounds={bounds}
                initial={{ yaw: 0, pitch: 0, fov: 60 }}
                mode="staged"
              />
            </Section>
          }
        />
      </DelayRailProvider>,
    );

    // The band is RESERVED whether or not anything is in it, and empty it
    // carries no control: nothing has been commanded yet.
    expect(document.querySelector("[data-panel-rail-frame]")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /signal-delay detail/i }),
    ).toBeNull();

    // A delay for the command to be delayed BY: at zero the rail correctly
    // draws nothing, because an instant command has no flight to show.
    act(() => {
      transport.emit("comms.delay", { oneWaySeconds: 1.4 });
    });
    // Hold the wire so nothing answers: a command the game has already replied
    // to is one that has landed, and a landed command is not in flight.
    transport.holdCommands();
    fireEvent.click(screen.getByRole("button", { name: /commit/i }));
    expect(transport.sentCommands).toHaveLength(2);

    // The mod's own uplink queue is what puts a dispatch in flight, not the act
    // of sending it: `useCommand` tracks its dispatches by id against
    // `system.uplink.pending`, so the queue has to report them back.
    act(() => {
      transport.emit("system.uplink.pending", {
        pending: transport.sentCommands.map((c) => ({
          id: c.requestId,
          command: c.command,
          label: c.label,
          topic: c.topic,
          vantage: c.vantage,
          dispatchedAt: 0,
          oneWaySeconds: 1.4,
        })),
      });
    });

    expect(
      await screen.findByRole("button", { name: /signal-delay detail/i }),
    ).toBeTruthy();
  });
});
