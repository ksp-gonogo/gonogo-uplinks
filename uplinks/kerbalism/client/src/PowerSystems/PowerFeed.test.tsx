import {
  act,
  render,
  screen,
  setupStreamFixture,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { WidgetScopeProvider } from "@ksp-gonogo/ui-kit";
import { afterEach, describe, expect, it } from "vitest";
import { PowerFeed } from "./PowerFeed.js";

const CARRIED = [
  "kerbalism.profile",
  "kerbalism.lifesupport",
  "vessel.resources",
  "vessel.crew",
];

const PROFILE = {
  name: "Test Profile",
  resources: {
    ElectricCharge: {
      flowMode: "ALL_VESSEL_BALANCE",
      flowModeOrdinal: 4,
      displayName: "Electric Charge",
      isSupply: true,
      lowThreshold: 0.15,
    },
  },
  rules: [],
  processes: [
    {
      name: "Water Recycler",
      modifiers: ["_WaterRecycler"],
      inputs: { ElectricCharge: 0.01 },
      outputs: {},
    },
  ],
};

const LIFE_SUPPORT = {
  asOfKerbalismUt: 10,
  rates: { ElectricCharge: -0.05 },
  processes: [
    {
      resource: "_WaterRecycler",
      title: "Water Recycler",
      capacity: 1,
      running: true,
      broken: false,
    },
  ],
};

const RESOURCES = {
  resources: { ElectricCharge: { current: 20, max: 140, active: true } },
  meta: { source: "test", quality: 1 },
};

const CREW = { count: 0, capacity: 4, crew: [], meta: { source: "test", quality: 1 } };

const trees: Array<() => void> = [];
afterEach(() => {
  for (const unmount of trees) unmount();
  trees.length = 0;
});

function mount(resource: string) {
  const fixture = setupStreamFixture({ pinnedUt: 10 });
  for (const topic of CARRIED) fixture.subscribe(topic);
  const { container, unmount } = render(
    <fixture.Provider>
      <WidgetScopeProvider widget="power-systems" scope={{ resource }}>
        <PowerFeed />
      </WidgetScopeProvider>
    </fixture.Provider>,
  );
  trees.push(unmount);
  act(() => {
    fixture.emit("kerbalism.profile", PROFILE);
    fixture.emit("kerbalism.lifesupport", LIFE_SUPPORT);
    fixture.emit("vessel.resources", RESOURCES);
    fixture.emit("vessel.crew", CREW);
  });
  return container;
}

describe("PowerFeed", () => {
  it("lists the process drawing electric charge and the rate Kerbalism reports", async () => {
    mount("ElectricCharge");
    await screen.findByText("Water Recycler");
    expect(screen.getByText("Reported")).toBeTruthy();
  });

  it("draws nothing while Power Systems shows another resource", () => {
    const container = mount("SolidFuel");
    expect(container.textContent).toBe("");
  });
});
