import {
  act,
  render,
  screen,
  setupStreamFixture,
  waitFor,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { afterEach, describe, expect, it } from "vitest";
import { CommSignalRaSection } from "./index.js";

const renderedTrees: Array<() => void> = [];

afterEach(() => {
  for (const unmount of renderedTrees) unmount();
  renderedTrees.length = 0;
});

const HOP = {
  from: "vessel",
  to: "home",
  kind: 0,
  distanceMeters: 251400,
  extensions: {
    realantennas: {
      band: "L",
      techLevel: 6,
      modulationBits: 4,
      encoder: "Convolutional 7, 1/2",
      requiredEbN0: 1,
      reverseBitsPerSec: 15800,
    },
  },
};

function mount() {
  const stream = setupStreamFixture();
  const result = render(
    <stream.Provider>
      <CommSignalRaSection />
    </stream.Provider>,
  );
  renderedTrees.push(result.unmount);
  return stream;
}

function emitLink(
  stream: ReturnType<typeof mount>,
  connected: boolean,
  margin = { decibelMargin: 1.4, closesLink: true },
) {
  act(() => {
    stream.emit("comms.link", { connected });
    stream.emit("comms.linkMargin", margin);
    stream.emit("comms.path", { hops: [HOP] });
  });
}

describe("the link budget section", () => {
  it("draws nothing of the last link once the link is down", async () => {
    const stream = mount();
    emitLink(stream, true);
    await screen.findByLabelText("Link budget detail");

    emitLink(stream, false, { decibelMargin: 0, closesLink: false });

    await waitFor(() =>
      expect(screen.queryByLabelText("Link budget detail")).toBeNull(),
    );
    expect(screen.queryByText("Convolutional 7, 1/2")).toBeNull();
  });
});
