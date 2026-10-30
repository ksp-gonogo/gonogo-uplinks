import { act, render, screen } from "@ksp-gonogo/sitrep-sdk/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FullscreenExit } from "./FullscreenExit.js";

function setFullscreenElement(el: Element | null) {
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    value: el,
  });
  document.dispatchEvent(new Event("fullscreenchange"));
}

describe("FullscreenExit", () => {
  afterEach(() => {
    setFullscreenElement(null);
  });

  it("shows an exit button inside the fullscreen frame and leaves fullscreen on click", async () => {
    const host = document.createElement("div");
    const stage = document.createElement("div");
    host.appendChild(stage);
    document.body.appendChild(host);
    const exit = vi.fn(() => Promise.resolve());
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exit,
    });

    render(<FullscreenExit host={host} />);
    expect(screen.queryByRole("button", { name: "Exit fullscreen" })).toBeNull();

    act(() => setFullscreenElement(stage));
    const button = screen.getByRole("button", { name: "Exit fullscreen" });
    expect(stage.contains(button)).toBe(true);

    button.click();
    expect(exit).toHaveBeenCalledTimes(1);

    act(() => setFullscreenElement(null));
    expect(screen.queryByRole("button", { name: "Exit fullscreen" })).toBeNull();
    host.remove();
  });

  it("ignores a fullscreen element outside its own frame", () => {
    const host = document.createElement("div");
    const other = document.createElement("div");
    render(<FullscreenExit host={host} />);
    act(() => setFullscreenElement(other));
    expect(screen.queryByRole("button", { name: "Exit fullscreen" })).toBeNull();
  });
});
