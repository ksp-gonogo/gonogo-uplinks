import { describe, expect, it } from "vitest";
import { feedLoading } from "./feedLoading.js";

describe("feedLoading", () => {
  it("reads a link being made as loading", () => {
    expect(feedLoading("disconnected", null)).toBe(true);
  });

  it("reads a link being made again as loading", () => {
    expect(feedLoading("reconnecting", null)).toBe(true);
  });

  it("is not loading once connected, failed or without a source", () => {
    expect(feedLoading("connected", null)).toBe(false);
    expect(feedLoading("error", null)).toBe(false);
    expect(feedLoading(undefined, null)).toBe(false);
  });

  it("leaves an unreachable sidecar to its own note", () => {
    expect(feedLoading("disconnected", "Kerbcast is not answering")).toBe(false);
  });
});
