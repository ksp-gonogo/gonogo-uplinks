import { render, screen } from "@ksp-gonogo/sitrep-sdk/testing";
import { describe, expect, it } from "vitest";
import { HeartbeatWidget } from "./index.js";

/**
 * The published test harness is what makes this possible outside the app: the
 * host is installed once in `src/test/setup.ts`, so a widget renders against the
 * real client rather than a mocked hook. Mocking `useTelemetry` would pass while
 * proving nothing about the wiring, which is the thing most likely to be wrong.
 */
describe("HeartbeatWidget", () => {
  it("says it is waiting rather than rendering a zero", () => {
    render(<HeartbeatWidget />);

    // The distinction that matters: no sample yet and a sample of zero are
    // different facts, and a widget rendering 0 for both is lying about one.
    expect(screen.getByText(/waiting for the example uplink/i)).toBeVisible();
  });
});
