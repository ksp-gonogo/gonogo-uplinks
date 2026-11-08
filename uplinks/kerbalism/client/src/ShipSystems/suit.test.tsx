import { VesselType } from "@ksp-gonogo/sitrep-sdk";
import {
  act,
  render,
  setupStreamFixture,
  waitFor,
  within,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { afterEach, describe, expect, it } from "vitest";
import { ShipSystemsComponent } from "./index.js";

const CARRIED = [
  "kerbalism.profile",
  "kerbalism.lifesupport",
  "vessel.resources",
  "vessel.crew",
  "kerbalism.eva",
  "vessel.identity",
];

const PROFILE = {
  name: "Test Profile",
  resources: {
    Oxygen: {
      flowMode: "ALL_VESSEL",
      flowModeOrdinal: 1,
      displayName: "Oxygen",
      isSupply: true,
    },
    ElectricCharge: {
      flowMode: "ALL_VESSEL_BALANCE",
      flowModeOrdinal: 4,
      displayName: "Electric Charge",
      isSupply: true,
      lowThreshold: 0.15,
    },
  },
  rules: [],
  processes: [],
};

const EVA = {
  name: "Valentina Kerman",
  resources: {
    Oxygen: { amount: 3, capacity: 5, rate: -0.001 },
    ElectricCharge: { amount: 20, capacity: 25, rate: null },
  },
  radiationRadPerSecond: 2.7e-4,
  rules: [
    { name: "radiation", problem: 0.4, fatalThreshold: 1 },
    { name: "stress", problem: null, fatalThreshold: 1 },
  ],
};

const renderedTrees: Array<() => void> = [];

function mount() {
  const fixture = setupStreamFixture({ pinnedUt: 10 });
  for (const topic of CARRIED) fixture.subscribe(topic);
  const { container, unmount } = render(
    <fixture.Provider>
      <ShipSystemsComponent config={{}} id="ship-systems-suit" />
    </fixture.Provider>,
  );
  renderedTrees.push(unmount);
  act(() => {
    fixture.emit("kerbalism.profile", PROFILE);
    fixture.emit("kerbalism.lifesupport", {
      rates: { Oxygen: 0 },
      habitat: {},
      processes: [],
      greenhouses: [],
    });
    fixture.emit("vessel.resources", {
      resources: {
        Oxygen: { current: 380, max: 400, active: true },
        ElectricCharge: { current: 380, max: 400, active: true },
      },
      meta: { source: "test", quality: 1 },
    });
    fixture.emit("vessel.crew", {
      count: 0,
      capacity: 4,
      crew: [],
      meta: { source: "test", quality: 1 },
    });
  });
  return { fixture, panel: within(container) };
}

afterEach(() => {
  for (const unmount of renderedTrees) unmount();
  renderedTrees.length = 0;
});

describe("ShipSystems: a kerbal on EVA", () => {
  it("shows the suit's supplies and survival rules, and draws an unreported rule as absent", async () => {
    const { fixture, panel } = mount();
    await waitFor(() =>
      expect(panel.getAllByRole("meter", { name: "Oxygen" })).toHaveLength(1),
    );
    expect(panel.queryByTestId("suit-section")).toBeNull();

    act(() => {
      fixture.emit("kerbalism.eva", EVA);
    });

    const suit = within(await panel.findByTestId("suit-section"));
    expect(suit.getByText("Valentina Kerman")).toBeInTheDocument();
    expect(suit.getByRole("meter", { name: "Oxygen" })).toHaveAttribute(
      "aria-valuenow",
      "60",
    );
    expect(suit.getByRole("meter", { name: "Electric Charge" })).toBeInTheDocument();
    expect(suit.getByRole("meter", { name: "Radiation" })).toBeInTheDocument();
    expect(suit.queryByRole("meter", { name: "Stress" })).toBeNull();
    expect(suit.getByText(/0\.97\d* rad\/h/)).toBeInTheDocument();
  });

  it("shows the suit alone when the craft is the kerbal, with none of the craft's sections", async () => {
    const { fixture, panel } = mount();
    act(() => {
      fixture.emit("kerbalism.eva", EVA);
      fixture.emit("vessel.identity", {
        vesselId: "k1",
        name: "Valentina Kerman",
        vesselType: VesselType.EVA,
      });
    });

    const suit = within(await panel.findByTestId("suit-section"));
    expect(suit.getByText("Valentina Kerman")).toBeInTheDocument();
    expect(panel.queryByText("Supplies")).toBeNull();
    expect(panel.queryByText("Habitat")).toBeNull();
    expect(panel.queryByText("Processes")).toBeNull();
  });
});
