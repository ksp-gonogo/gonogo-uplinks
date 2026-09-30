import {
  act,
  screen,
  setupStreamFixture,
  stopArriving,
} from "@ksp-gonogo/sitrep-sdk/testing";
import {
  expectNoA11yViolations,
  renderWithRail as render,
} from "@ksp-gonogo/ui-kit/testing";
import { useTelemetry } from "@ksp-gonogo/sitrep-sdk";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import hero from "./__fixtures__/kit-cost-beside-the-repair.json" with {
  type: "json",
};
import { KerbalismReliabilityUpdates } from "./index.js";

type Emit = { topic: string; payload: unknown };
const HERO: Emit[] = hero._stream.emits as Emit[];

const renderedTrees: Array<() => void> = [];

afterEach(() => {
  for (const unmount of renderedTrees) unmount();
  renderedTrees.length = 0;
});

/** The hero scene's stream, with any topic replaced or dropped. */
function streamWith(overrides: Record<string, unknown | null> = {}): Emit[] {
  return HERO.flatMap((emit) => {
    if (!(emit.topic in overrides)) return [emit];
    const payload = overrides[emit.topic];
    return payload === null ? [] : [{ topic: emit.topic, payload }];
  });
}

/** Says "stream ready" once the craft's identity has arrived, so an empty row is known to be a verdict rather than a wait. */
function Ready() {
  return useTelemetry("vessel.identity").state === "observed" ? (
    <span>stream ready</span>
  ) : null;
}

async function renderRow(
  emits: Emit[],
  { vesselId = "v-station", compact = false } = {},
) {
  const fixture = setupStreamFixture({ pinnedUt: 1_000_000 });
  const probe = render(
    <fixture.Provider>
      <Ready />
    </fixture.Provider>,
  );
  renderedTrees.push(probe.unmount);
  const result = render(
    <fixture.Provider>
      <KerbalismReliabilityUpdates
        vesselId={vesselId}
        vesselName="Kerbin Station Alpha"
        body="Kerbin"
        compact={compact}
      />
    </fixture.Provider>,
  );
  renderedTrees.push(result.unmount);
  act(() => {
    for (const emit of emits) fixture.emit(emit.topic, emit.payload);
  });
  await screen.findByText("stream ready");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  return { fixture, ...result };
}

describe("KerbalismReliabilityUpdates", () => {
  it("lists the failed and service-due parts and leaves the healthy one out", async () => {
    await renderRow(HERO);

    expect(screen.getByText("Reaction Wheel")).toBeInTheDocument();
    expect(screen.getByText("critical failure")).toBeInTheDocument();
    expect(screen.getByText("Antenna")).toBeInTheDocument();
    expect(screen.getByText("service due")).toBeInTheDocument();
    expect(screen.queryByText("Battery")).toBeNull();
    expect(screen.getByText("2 at risk")).toBeInTheDocument();
  });

  it("states the repair's kit cost beside its button, and none beside a free service", async () => {
    await renderRow(HERO);

    const costs = screen.getAllByText(/^Costs /);
    expect(costs).toHaveLength(1);
    expect(costs[0]).toHaveTextContent("Costs 2 × EVA Repair Kit");
    expect(screen.getByRole("button", { name: "Repair" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Service" })).toBeInTheDocument();
  });

  it("names the item by its config id when nothing aboard titles it", async () => {
    await renderRow(
      streamWith({
        "vessel.inventory": { stores: [] },
        "vessel.crew": {
          count: 1,
          capacity: 6,
          crew: [{ name: "Bill Kerman", trait: "Engineer", experienceLevel: 2 }],
        },
      }),
    );

    expect(screen.getByText("Costs 2 × evaRepairKit")).toBeInTheDocument();
  });

  it("offers only the kerbals Kerbalism's repair specs accept, and refuses when the kits cannot be reached", async () => {
    const user = userEvent.setup();
    await renderRow(
      streamWith({
        "vessel.inventory": { stores: [] },
      }),
    );

    await user.click(screen.getByRole("button", { name: "Repair" }));

    // Engineer level 2: Bill qualifies, the pilot and the scientist do not.
    expect(screen.getByText("Bill Kerman · 1 carried")).toBeInTheDocument();
    expect(screen.queryByText(/Jebediah Kerman/)).toBeNull();
    expect(
      screen.getByText(
        "Needs 2 EVA Repair Kit, and 1 can be reached",
      ),
    ).toBeInTheDocument();
  });

  it("draws nothing on any row but the active craft's", async () => {
    const { container } = await renderRow(HERO, { vesselId: "v-lander" });
    expect(container).toBeEmptyDOMElement();
  });

  it("draws nothing while Kerbalism cannot say whether it is breaking parts", async () => {
    const { container } = await renderRow(
      streamWith({ "kerbalism.reliability": { coverage: "indeterminate" } }),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("draws nothing when Kerbalism publishes no reliability at all", async () => {
    const { container } = await renderRow(
      streamWith({
        "kerbalism.reliability": null,
        "kerbalism.reliabilityParts": null,
      }),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("draws nothing for a craft whose parts are all healthy", async () => {
    const { container } = await renderRow(
      streamWith({
        "kerbalism.reliabilityParts": [
          { partId: "1:0", title: "Battery", condition: "nominal" },
        ],
      }),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("reads an unreadable part as at risk, never as healthy", async () => {
    await renderRow(
      streamWith({
        "kerbalism.reliabilityParts": [
          { partId: "1:0", title: "Probe Core", condition: "unknown" },
        ],
      }),
    );
    expect(screen.getByText("unreadable")).toBeInTheDocument();
    expect(screen.getByText("1 at risk")).toBeInTheDocument();
  });

  it("keeps only the badge at compact width", async () => {
    await renderRow(HERO, { compact: true });
    expect(screen.getByText("2 at risk")).toBeInTheDocument();
    expect(screen.queryByText("Reaction Wheel")).toBeNull();
  });

  it("keeps the failures once the link drops, marks them held, and offers no repair", async () => {
    const { fixture } = await renderRow(HERO);
    expect(screen.getByRole("button", { name: "Repair" })).toBeInTheDocument();
    act(() => stopArriving(fixture));

    await screen.findByText(/offline/i);
    expect(screen.getByText("Reaction Wheel")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Repair" })).toBeNull();
    expect(screen.queryByText(/^Costs /)).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderRow(HERO);
    await expectNoA11yViolations(container);
  });
});
