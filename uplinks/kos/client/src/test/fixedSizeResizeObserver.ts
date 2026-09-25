/**
 * Install a `ResizeObserver` that reports one fixed size to everything observed,
 * and return the uninstall. jsdom has none, and the terminal waits for a sized
 * container before it opens.
 *
 * `deliver` chooses when the callback fires: `"sync"` during `observe`, or
 * `"macrotask"` for a component that must not see a size during its own mount.
 * Same signature as `installFixedSizeResizeObserver` in `@ksp-gonogo/ui-kit/testing`,
 * which the ui-kit pack this client builds against does not carry.
 */
export function installFixedSizeResizeObserver(options: {
  width: number;
  height: number;
  deliver?: "sync" | "macrotask";
}): () => void {
  const previous = globalThis.ResizeObserver;
  const { width, height, deliver = "sync" } = options;

  class FixedSizeResizeObserver implements ResizeObserver {
    readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element): void {
      const contentRect = {
        width,
        height,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
      } as DOMRectReadOnly;
      const fire = () =>
        this.callback([{ target, contentRect } as ResizeObserverEntry], this);
      if (deliver === "sync") fire();
      else setTimeout(fire, 0);
    }
    unobserve(): void {}
    disconnect(): void {}
  }

  globalThis.ResizeObserver = FixedSizeResizeObserver;
  return () => {
    globalThis.ResizeObserver = previous;
  };
}
