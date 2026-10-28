import { renderHook } from "@ksp-gonogo/sitrep-sdk/testing";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tabLeaseToken } from "./tabLeaseToken.js";

function useToken(coreId: number) {
  const ref = useRef("");
  if (ref.current === "") ref.current = tabLeaseToken(coreId);
  return ref.current;
}

describe("tabLeaseToken", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("gives a remounted terminal the token the first mount opened with", () => {
    const first = renderHook(() => useToken(7));
    const opened = first.result.current;
    first.unmount();

    const second = renderHook(() => useToken(7));
    expect(second.result.current).toBe(opened);
  });

  it("keeps a separate token per CPU", () => {
    expect(tabLeaseToken(7)).not.toBe(tabLeaseToken(8));
  });

  it("mints a fresh token for a tab with empty storage", () => {
    const a = tabLeaseToken(7);
    window.sessionStorage.clear();
    expect(tabLeaseToken(7)).not.toBe(a);
  });

  it("falls back to a fresh token when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(tabLeaseToken(7)).toMatch(/\S/);
    expect(tabLeaseToken(7)).not.toBe(tabLeaseToken(7));
  });
});
