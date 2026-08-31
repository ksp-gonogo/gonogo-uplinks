import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CadenceSection } from "./index.js";

/**
 * An augment's most important test is that it renders NOTHING when it has
 * nothing, and it is a different assertion from a widget's.
 *
 * A widget owns its tile, so its empty state is a message: "waiting for the
 * example Uplink" is useful there, because the tile is already taking up space
 * and something has to explain why. An augment is a guest in a layout somebody
 * else designed, so its empty state has to be genuinely empty. An augment that
 * renders a "waiting" row puts a permanent line inside another widget on every
 * install, and the operator learns to read past that part of the panel.
 *
 * So: empty container, not an empty-state component.
 */
describe("CadenceSection", () => {
  it("renders nothing at all before a sample arrives", () => {
    const { container } = render(<CadenceSection />);

    expect(container).toBeEmptyDOMElement();
  });
});
