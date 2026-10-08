import { value } from "@ksp-gonogo/sitrep-sdk";
import {
  act,
  screen,
  setupStreamFixture,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { expectNoA11yViolations, renderWithRail } from "@ksp-gonogo/ui-kit/testing";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CommSignalAntennaTargets } from "./index.js";

const VESSEL = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

const renderedTrees: Array<() => void> = [];

afterEach(() => {
  for (const unmount of renderedTrees) unmount();
  renderedTrees.length = 0;
});

function antenna() {
  return {
    antennaId: "4021/0",
    index: 0,
    name: "HG-55 High Gain Antenna",
    steerable: true,
    targeted: true,
    gain: value("dB", 34.5),
    techLevel: value("count", 4),
    beamwidth: value("°", 2.5),
    cone3Db: value("°", 1.25),
    cone10Db: value("°", 2.5),
    minimumDistance: value("m", 22903),
    targetKind: "BodyLatLonAlt",
    targetLabel: "Kerbin",
    targetBodyName: "Kerbin",
    availableTargetModes: ["BodyCenter"],
    meta: { source: `vessel:${VESSEL}`, quality: 1 },
  };
}

function entry(overrides: Record<string, unknown> = {}) {
  return {
    vesselId: VESSEL,
    allowed: true,
    borrowed: null,
    last: null,
    meta: { source: `vessel:${VESSEL}` },
    ...overrides,
  };
}

async function mount(entries: ReturnType<typeof entry>[] = []) {
  const stream = setupStreamFixture();
  const result = renderWithRail(
    <stream.Provider>
      <CommSignalAntennaTargets />
    </stream.Provider>,
  );
  renderedTrees.push(result.unmount);
  // The antennas come last: the section appears with them, so everything it reads must already be there.
  act(() => {
    stream.emit("realantennas.retargeting", entries);
    stream.emit("system.vessels", {
      vessels: [
        { vesselId: VESSEL, name: "Mun Relay 2" },
        { vesselId: OTHER, name: "Duna Relay" },
      ],
    });
  });
  act(() => {
    stream.emit("realantennas.antennas", [antenna()]);
  });
  await screen.findByLabelText("Dish turning");
  return { ...stream, container: result.container };
}

describe("dish turning", () => {
  it("offers the reported craft's switch on, as a craft is by default", async () => {
    await mount();

    const toggle = screen.getByRole("checkbox", {
      name: "Automatic retargeting, Mun Relay 2",
    }) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
  });

  it("sends the order for that craft when the switch is turned off", async () => {
    const stream = await mount();

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Automatic retargeting, Mun Relay 2" }),
    );
    await act(async () => {});

    expect(stream.transport.sentCommands).toEqual([
      expect.objectContaining({
        command: "realantennas.vessel.setAutoRetarget",
        args: { vessel: VESSEL, allow: false },
      }),
    ]);
  });

  it("shows a craft the operator opted out as off", async () => {
    await mount([entry({ allowed: false })]);

    expect(
      (screen.getByRole("checkbox", { name: "Automatic retargeting, Mun Relay 2" }) as HTMLInputElement).checked,
    ).toBe(false);
  });

  it("says which dish is borrowed, where it is turned, and what it goes back to", async () => {
    await mount([
      entry({
        borrowed: {
          dishId: `vessel:${VESSEL}#4021/0`,
          peerId: `vessel:${OTHER}`,
          dishName: "HG-55 High Gain Antenna",
          sinceUt: value("ut", 5000),
          previousAim: "Kerbin",
        },
      }),
    ]);

    const notice = screen.getByRole("status");
    expect(notice.textContent).toContain("Borrowed");
    expect(notice.textContent).toContain("HG-55 High Gain Antenna");
    expect(notice.textContent).toContain("Duna Relay");
    expect(notice.textContent).toContain("turns back to Kerbin");
  });

  it("lists another craft that is opted out so it can be switched without flying to it", async () => {
    await mount([
      entry({ vesselId: OTHER, allowed: false, meta: { source: `vessel:${OTHER}` } }),
    ]);

    expect(
      screen.getByRole("checkbox", { name: "Automatic retargeting, Duna Relay" }),
    ).toBeTruthy();
  });

  it("does not list another craft that is allowed and has nothing out", async () => {
    await mount([entry({ vesselId: OTHER, meta: { source: `vessel:${OTHER}` } })]);

    expect(screen.queryByRole("checkbox", { name: "Automatic retargeting, Duna Relay" })).toBeNull();
  });

  it("says how the last loan ended when none is out", async () => {
    await mount([
      entry({
        last: {
          peerId: "ground:Kerbal Space Center",
          turnedUt: value("ut", 5000),
          endedUt: value("ut", 5035),
          outcome: "restored",
        },
      }),
    ]);

    expect(screen.getByText(/Last borrowed for Kerbal Space Center, put back/)).toBeTruthy();
  });

  it("has no accessibility violations", async () => {
    const stream = await mount([entry({ allowed: false })]);

    await expectNoA11yViolations(stream.container);
  });
});
