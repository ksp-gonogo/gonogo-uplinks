import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PulseDialWidget } from "./index.js";

/**
 * The pending state, and the reason it is the first test for every widget: it is
 * the state a widget spends most of its life in on a machine where the Uplink is
 * not installed, and it is the one most likely to render a substituted zero.
 *
 * A dial makes that worse than a text readout does. `value={0}` on a dial draws a
 * needle at the minimum, which is a picture of a real reading, so a widget that
 * renders its dial before it has a sample shows an operator a measurement that
 * does not exist. There is no visual difference between "nothing has arrived" and
 * "the counter is at zero" once the needle is drawn.
 */
describe("PulseDialWidget", () => {
  it("draws no dial at all before a sample arrives", () => {
    render(<PulseDialWidget />);

    expect(screen.getByText(/waiting for the example uplink/i)).toBeVisible();
    // The dial carries an `ariaLabel`, so its absence is assertable rather than
    // a matter of inspecting the SVG.
    expect(screen.queryByRole("img", { name: /publishes since load/i })).toBeNull();
  });
});
