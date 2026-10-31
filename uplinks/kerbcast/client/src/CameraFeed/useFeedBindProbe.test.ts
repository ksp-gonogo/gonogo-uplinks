import { registerUplinkHandle } from "@ksp-gonogo/sitrep-sdk";
import { act, renderHook } from "@ksp-gonogo/sitrep-sdk/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BIND_PROBE_DELAY_MS, useFeedBindProbe } from "./useFeedBindProbe.js";

const { info, tag } = vi.hoisted(() => {
  const info = vi.fn();
  return { info, tag: vi.fn(() => ({ info })) };
});

vi.mock("@ksp-gonogo/sitrep-sdk", async (original) => ({
  ...(await original<typeof import("@ksp-gonogo/sitrep-sdk")>()),
  logger: { tag },
}));

afterEach(() => {
  vi.useRealTimers();
  info.mockClear();
});

function wrapWithVideo(srcObject: unknown) {
  const wrap = document.createElement("div");
  const video = document.createElement("video");
  Object.defineProperty(video, "srcObject", { value: srcObject, configurable: true });
  wrap.append(video);
  return wrap;
}

function handleWith(stream: unknown) {
  registerUplinkHandle("kerbcast", {
    getClient: () => ({ camera: () => ({ mediaStream: stream }) }),
  } as never);
}

describe("useFeedBindProbe", () => {
  it("logs that the video has the camera's stream", () => {
    vi.useFakeTimers();
    const stream = {};
    handleWith(stream);
    renderHook(() => useFeedBindProbe(7, wrapWithVideo(stream), "delayed"));

    act(() => {
      vi.advanceTimersByTime(BIND_PROBE_DELAY_MS);
    });

    expect(tag).toHaveBeenCalledWith("kerbcast:feed-bind");
    expect(info).toHaveBeenCalledWith(
      "feed bind",
      expect.objectContaining({
        flightId: 7,
        playout: "delayed",
        handleHasStream: true,
        videoHasThatStream: true,
      }),
    );
  });

  it("logs a video with no stream when the handle has one", () => {
    vi.useFakeTimers();
    handleWith({});
    renderHook(() => useFeedBindProbe(7, wrapWithVideo(null), "raw"));

    act(() => {
      vi.advanceTimersByTime(BIND_PROBE_DELAY_MS);
    });

    expect(info).toHaveBeenCalledWith(
      "feed bind",
      expect.objectContaining({
        handleHasStream: true,
        videoHasSrcObject: false,
        videoHasThatStream: false,
      }),
    );
  });

  it("logs nothing for a feed with no camera or when it unmounts first", () => {
    vi.useFakeTimers();
    handleWith({});
    renderHook(() => useFeedBindProbe(null, wrapWithVideo(null), "raw"));
    const { unmount } = renderHook(() =>
      useFeedBindProbe(7, wrapWithVideo(null), "raw"),
    );
    unmount();

    act(() => {
      vi.advanceTimersByTime(BIND_PROBE_DELAY_MS * 2);
    });

    expect(info).not.toHaveBeenCalled();
  });
});
