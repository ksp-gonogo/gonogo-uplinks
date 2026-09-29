import {
  type RenderHookOptions,
  type RenderHookResult,
  type RenderOptions,
  type RenderResult,
  render as sdkRender,
  renderHook as sdkRenderHook,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { DelayRailProvider } from "@ksp-gonogo/ui-kit";
import type { JSXElementConstructor, ReactElement, ReactNode } from "react";

export * from "@ksp-gonogo/sitrep-sdk/testing";

type Wrapper = JSXElementConstructor<{ children: ReactNode }>;

/** A command rail around the tree, as the dashboard mounts one around every widget. A caller's own `wrapper` nests inside it. */
function withRail(Extra?: Wrapper): Wrapper {
  return function RailWrapper({ children }: { children: ReactNode }) {
    return (
      <DelayRailProvider>
        {Extra ? <Extra>{children}</Extra> : children}
      </DelayRailProvider>
    );
  };
}

export function render(
  ui: ReactElement,
  options?: RenderOptions,
): RenderResult {
  return sdkRender(ui, { ...options, wrapper: withRail(options?.wrapper) });
}

export function renderHook<Result, Props>(
  callback: (initialProps: Props) => Result,
  options?: RenderHookOptions<Props>,
): RenderHookResult<Result, Props> {
  return sdkRenderHook(callback, {
    ...options,
    wrapper: withRail(options?.wrapper),
  });
}
