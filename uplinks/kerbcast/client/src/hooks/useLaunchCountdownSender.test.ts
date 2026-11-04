import { renderHook } from "@ksp-gonogo/sitrep-sdk/testing";
import { describe, expect, it, vi } from "vitest";
import { useLaunchCountdownSender } from "./useLaunchCountdownSender.js";

const countdown = (remainingSeconds: number, lengthSeconds = 10) => ({
  remainingSeconds,
  lengthSeconds,
  liftedOff: false,
});

describe("useLaunchCountdownSender", () => {
  it("sends nothing while there is no countdown", () => {
    const send = vi.fn();
    renderHook(() => useLaunchCountdownSender(null, send));
    expect(send).not.toHaveBeenCalled();
  });

  it("sends the time left once when a countdown starts, and not on every tick", () => {
    const send = vi.fn();
    const { rerender } = renderHook(
      ({ liftoff }) => useLaunchCountdownSender(liftoff, send),
      { initialProps: { liftoff: countdown(10) } },
    );
    rerender({ liftoff: countdown(9.9) });
    rerender({ liftoff: countdown(9.8) });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      running: true,
      remainingSeconds: 10,
      lengthSeconds: 10,
    });
  });

  it("calls the countdown off when it goes away", () => {
    const send = vi.fn();
    const { rerender } = renderHook(
      ({ liftoff }) => useLaunchCountdownSender(liftoff, send),
      { initialProps: { liftoff: countdown(5) as ReturnType<typeof countdown> | null } },
    );
    rerender({ liftoff: null });
    expect(send).toHaveBeenLastCalledWith({
      running: false,
      remainingSeconds: 0,
      lengthSeconds: 0,
    });
  });

  it("does not call off a countdown that ran out, only one that went away", () => {
    const send = vi.fn();
    const { rerender } = renderHook(
      ({ liftoff }) => useLaunchCountdownSender(liftoff, send),
      { initialProps: { liftoff: countdown(0.1) } },
    );
    rerender({ liftoff: countdown(0) });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends again when a new countdown starts", () => {
    const send = vi.fn();
    const { rerender } = renderHook(
      ({ liftoff }) => useLaunchCountdownSender(liftoff, send),
      { initialProps: { liftoff: countdown(1) } },
    );
    rerender({ liftoff: countdown(20, 20) });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({
      running: true,
      remainingSeconds: 20,
      lengthSeconds: 20,
    });
  });

  it("sends nothing for a countdown it never saw go away twice", () => {
    const send = vi.fn();
    const { rerender } = renderHook(
      ({ liftoff }) => useLaunchCountdownSender(liftoff, send),
      { initialProps: { liftoff: null as ReturnType<typeof countdown> | null } },
    );
    rerender({ liftoff: null });
    expect(send).not.toHaveBeenCalled();
  });
});
