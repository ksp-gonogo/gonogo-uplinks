import { useTelemetry } from "@ksp-gonogo/sitrep-sdk";
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
import { afterEach, describe, expect, it } from "vitest";
import hero from "./__fixtures__/engine-failure-mid-ascent.json" with {
  type: "json",
};
import { TestFlightReliabilityUpdates } from "./index.js";

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
  { vesselId = "v-titan", compact = false } = {},
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
      <TestFlightReliabilityUpdates
        vesselId={vesselId}
        vesselName="Titan II GLV"
        body="Earth"
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

describe("TestFlightReliabilityUpdates", () => {
  it("lists the failed, wearing and unlikely engines, named by their flying config", async () => {
    await renderRow(HERO);

    expect(screen.getByText("LR87 Engine (LR87-AJ-7)")).toBeInTheDocument();
    expect(screen.getByText("Loss of Thrust")).toBeInTheDocument();
    expect(screen.getByText("LR91 Engine (LR91-AJ-7)")).toBeInTheDocument();
    expect(screen.getByText(/continuous rated burn left/)).toBeInTheDocument();
    expect(screen.getByText(/to survive/)).toBeInTheDocument();
    // The mature vernier survives its rating 99 times in 100, so only one vernier row is drawn.
    expect(screen.getAllByText(/Vernier Thruster/)).toHaveLength(1);
    expect(screen.getByText("3 at risk")).toBeInTheDocument();
  });

  it("offers TestFlight's repair on the failed engine alone, with no cost because TestFlight charges none", async () => {
    await renderRow(HERO);

    expect(screen.getAllByRole("button", { name: /Repair/ })).toHaveLength(1);
    expect(screen.queryByText(/Costs /)).toBeNull();
    expect(screen.queryByText(/carried|aboard/)).toBeNull();
  });

  it("draws nothing on any row but the active craft's", async () => {
    const { container } = await renderRow(HERO, { vesselId: "v-relay" });
    expect(container).toBeEmptyDOMElement();
  });

  it("draws nothing while TestFlight cannot read an engine's status", async () => {
    const { container } = await renderRow(
      streamWith({ "testflight.reliability": { coverage: "indeterminate" } }),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("draws nothing for a craft whose engines are all fit", async () => {
    const { container } = await renderRow(
      streamWith({
        "testflight.reliabilityParts": [
          {
            partId: "1:0",
            title: "LR91 Engine",
            condition: "nominal",
            survival: 0.99,
            survivalHorizonSeconds: 225,
          },
        ],
      }),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("reads an unreadable engine as at risk, never as fit", async () => {
    await renderRow(
      streamWith({
        "testflight.reliabilityParts": [
          { partId: "1:0", title: "LR87 Engine", condition: "unknown" },
        ],
      }),
    );
    expect(screen.getByText("unreadable")).toBeInTheDocument();
    expect(screen.getByText("1 at risk")).toBeInTheDocument();
  });

  it("keeps only the badge at compact width", async () => {
    await renderRow(HERO, { compact: true });
    expect(screen.getByText("3 at risk")).toBeInTheDocument();
    expect(screen.queryByText("Loss of Thrust")).toBeNull();
  });

  it("keeps the failure once the link drops, marks it held, and offers no repair", async () => {
    const { fixture } = await renderRow(HERO);
    expect(screen.getByRole("button", { name: /Repair/ })).toBeInTheDocument();
    act(() => stopArriving(fixture));

    await screen.findByText(/offline/i);
    expect(screen.getByText("Loss of Thrust")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Repair/ })).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderRow(HERO);
    await expectNoA11yViolations(container);
  });
});
