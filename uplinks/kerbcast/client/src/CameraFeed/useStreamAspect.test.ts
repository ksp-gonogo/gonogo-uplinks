import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useStreamAspect, videoAspect } from "./useStreamAspect.js";

function sized(video: HTMLVideoElement, w: number, h: number) {
  Object.defineProperty(video, "videoWidth", { value: w, configurable: true });
  Object.defineProperty(video, "videoHeight", { value: h, configurable: true });
}

describe("videoAspect", () => {
  it("is null for no element and for one with no dimensions yet", () => {
    expect(videoAspect(null)).toBeNull();
    expect(videoAspect(document.createElement("video"))).toBeNull();
  });

  it("is the playing picture's width over its height", () => {
    const video = document.createElement("video");
    sized(video, 640, 480);
    expect(videoAspect(video)).toBeCloseTo(4 / 3);
  });
});

describe("useStreamAspect", () => {
  it("follows the video under the root as its dimensions arrive and change", () => {
    const root = document.createElement("div");
    const video = document.createElement("video");
    root.appendChild(video);
    const { result } = renderHook(() => useStreamAspect(root));
    expect(result.current).toBeNull();

    act(() => {
      sized(video, 1280, 720);
      video.dispatchEvent(new Event("loadedmetadata"));
    });
    expect(result.current).toBeCloseTo(16 / 9);

    act(() => {
      sized(video, 800, 800);
      video.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(1);
  });

  it("is null with no root", () => {
    const { result } = renderHook(() => useStreamAspect(null));
    expect(result.current).toBeNull();
  });
});
