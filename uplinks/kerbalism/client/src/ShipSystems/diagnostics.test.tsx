import {
  act,
  fireEvent,
  render,
  screen,
  setupStreamFixture,
  waitFor,
  within,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { NULL_DISPLAY } from "@ksp-gonogo/ui-kit";
import { expectNoA11yViolations } from "@ksp-gonogo/ui-kit/testing";
import { describe, expect, it } from "vitest";
import {
  conditionLabel,
  DiagnosticsButtons,
  groupParts,
  levelLabel,
  scriptLabel,
} from "./diagnostics.js";

function mount() {
  const fixture = setupStreamFixture({ pinnedUt: 10 });
  fixture.subscribe("kerbalism.diagnostics");
  fixture.subscribe("kerbalism.reliabilityParts");
  const result = render(
    <fixture.Provider>
      <DiagnosticsButtons />
    </fixture.Provider>,
  );
  return { fixture, ...result };
}

const diagnostics = () => ({
  devices: [
    { id: "11", name: "Fission Reactor", partName: "Reactor", status: "on" },
    { id: "12", name: "Cabin Light", partName: "Light", status: "off" },
  ],
  scripts: [
    { type: "sunlight", deviceCount: 2 },
    { type: "power_low", deviceCount: 1 },
  ],
  log: [
    { level: "danger", message: "Reaction Wheel has failed." },
    { level: "alert", message: "Science transmitted." },
  ],
});

const parts = () => [
  {
    partId: "1:0",
    title: "Antenna",
    condition: "failed",
    redundancyGroup: "Communication",
  },
  {
    partId: "2:0",
    title: "Reactor",
    condition: "service-due",
    redundancyGroup: "Power",
  },
  { partId: "3:0", title: "Relay", condition: "nominal" },
];

describe("diagnostics windows", () => {
  it("opens the log with its level and message once the craft reports them", async () => {
    const { fixture } = mount();
    act(() => {
      fixture.emit("kerbalism.diagnostics", diagnostics());
    });

    fireEvent.click(await screen.findByRole("button", { name: /^Log\s*2$/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Reaction Wheel has failed.")).toBeVisible();
    expect(within(dialog).getByText("DANGER")).toBeVisible();
    expect(within(dialog).getByText("ALERT")).toBeVisible();
  });

  it("opens the automation window with its devices and scripts", async () => {
    const { fixture } = mount();
    act(() => {
      fixture.emit("kerbalism.diagnostics", diagnostics());
    });

    // The log's count badge is what says the frame has landed
    await screen.findByRole("button", { name: /^Log\s*2$/ });
    fireEvent.click(screen.getByRole("button", { name: "Auto" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Fission Reactor")).toBeVisible();
    expect(within(dialog).getByText("Sunlight")).toBeVisible();
    expect(within(dialog).getByText("Power low")).toBeVisible();
    await expectNoA11yViolations(dialog);
  });

  it("groups the failures window by Kerbalism's group name", async () => {
    const { fixture } = mount();
    act(() => {
      fixture.emit("kerbalism.reliabilityParts", parts());
    });

    fireEvent.click(
      await screen.findByRole("button", { name: /^Failures\s*2$/ }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Communication")).toBeVisible();
    expect(within(dialog).getByText("Power")).toBeVisible();
    expect(within(dialog).getByText("broken")).toBeVisible();
    expect(within(dialog).getByText("service due")).toBeVisible();
    expect(within(dialog).getByText("good")).toBeVisible();
  });

  it("says nothing was read rather than listing nothing", async () => {
    mount();

    fireEvent.click(await screen.findByRole("button", { name: "Auto" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(NULL_DISPLAY)).toBeVisible();
    expect(within(dialog).queryByText("No devices")).toBeNull();
  });

  it("keeps an open window current as new readings arrive", async () => {
    const { fixture } = mount();
    act(() => {
      fixture.emit("kerbalism.diagnostics", diagnostics());
    });
    fireEvent.click(await screen.findByRole("button", { name: /^Log\s*2$/ }));
    await screen.findByRole("dialog");

    act(() => {
      fixture.emit("kerbalism.diagnostics", {
        ...diagnostics(),
        log: [{ level: "warning", message: "Storm incoming." }],
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Storm incoming.")).toBeVisible();
    });
  });
});

describe("diagnostics wording", () => {
  it("words a condition the way the failures window does", () => {
    expect(conditionLabel("nominal")).toBe("good");
    expect(conditionLabel("service-due")).toBe("service due");
    expect(conditionLabel("failed")).toBe("broken");
    expect(conditionLabel("failed-critical")).toBe("broken");
    expect(conditionLabel(undefined)).toBe("unknown");
  });

  it("names a script and a level without inventing one", () => {
    expect(scriptLabel("power_low")).toBe("Power low");
    expect(scriptLabel(null)).toBe(NULL_DISPLAY);
    expect(levelLabel("fatality")).toBe("FATALITY");
    expect(levelLabel(null)).toBe(NULL_DISPLAY);
  });

  it("puts a part with no group under a group of its own, never into another", () => {
    const groups = groupParts([{ title: "Relay" }, { title: "Antenna", redundancyGroup: "Communication" }]);
    expect(groups.map((g) => g.title)).toEqual([NULL_DISPLAY, "Communication"]);
  });
});
