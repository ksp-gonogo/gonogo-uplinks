import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnScreenOnly } from "./OnScreenOnly.js";

type Callback = (entries: Pick<IntersectionObserverEntry, "isIntersecting">[]) => void;

describe("OnScreenOnly", () => {
  let callbacks: Callback[];
  let disconnect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    callbacks = [];
    disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: Callback) {
          callbacks.push(cb);
        }
        observe() {}
        disconnect = disconnect;
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  const report = (isIntersecting: boolean) =>
    act(() => callbacks[callbacks.length - 1]([{ isIntersecting }]));

  it("mounts its children until the element is reported off screen", () => {
    render(
      <OnScreenOnly>
        <span>feed</span>
      </OnScreenOnly>,
    );
    expect(screen.getByText("feed")).toBeTruthy();
    report(false);
    expect(screen.queryByText("feed")).toBeNull();
  });

  it("mounts them again when the element comes back", () => {
    render(
      <OnScreenOnly>
        <span>feed</span>
      </OnScreenOnly>,
    );
    report(false);
    report(true);
    expect(screen.getByText("feed")).toBeTruthy();
  });

  it("stops observing when it unmounts", () => {
    const { unmount } = render(
      <OnScreenOnly>
        <span>feed</span>
      </OnScreenOnly>,
    );
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it("keeps its children where the browser has no IntersectionObserver", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("IntersectionObserver", undefined);
    render(
      <OnScreenOnly>
        <span>feed</span>
      </OnScreenOnly>,
    );
    expect(screen.getByText("feed")).toBeTruthy();
  });
});
