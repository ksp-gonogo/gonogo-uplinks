// @vitest-environment jsdom

import { act, render, setupStreamFixture } from "@ksp-gonogo/sitrep-sdk/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../topics.js";
import { type CameraSite, cameraTopic, isDark, useCameraSite } from "./cameraSite.js";

let latest: CameraSite | undefined;

function Probe({ flightId }: Readonly<{ flightId: number | null }>) {
  latest = useCameraSite(flightId);
  return null;
}

const FLOWN = [{ cameraId: 42 }];

function mount(flightId: number | null) {
  const stream = setupStreamFixture();
  render(
    <stream.Provider>
      <Probe flightId={flightId} />
    </stream.Provider>,
  );
  return stream;
}

function settle() {
  vi.advanceTimersByTime(50);
}

describe("useCameraSite", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    latest = undefined;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("has no site for no camera", () => {
    mount(null);
    expect(latest).toEqual({ kind: "none" });
  });

  it("waits while the craft being flown's list has not been heard", () => {
    mount(43);
    expect(latest?.kind).toBe("pending");
  });

  it("rides the shared clock for a camera on the craft being flown", () => {
    const stream = mount(42);
    act(() => {
      stream.emit("kerbcast.cameras", FLOWN);
      settle();
    });
    expect(latest?.kind).toBe("active");
  });

  it("reads a camera that is not in the flown craft's list from its own Topic, unheard until a sample arrives", () => {
    const stream = mount(43);
    act(() => {
      stream.emit("kerbcast.cameras", FLOWN);
      settle();
    });
    expect(latest).toMatchObject({ kind: "elsewhere", link: "unknown" });
    expect(latest && isDark(latest)).toBe(true);
  });

  it("is live at the delay its own samples carry, whatever the flown craft's is", () => {
    const stream = mount(43);
    act(() => {
      stream.emit("kerbcast.cameras", FLOWN, { validAt: 1000, deliveredAt: 1000.4 });
      stream.emit(
        cameraTopic(43),
        { cameraId: 43 },
        { validAt: 1000, deliveredAt: 1004.2 },
      );
      settle();
    });
    expect(latest).toMatchObject({ kind: "elsewhere", link: "live" });
    expect(latest?.kind === "elsewhere" && latest.delaySeconds).toBeCloseTo(4.2);
    expect(latest && isDark(latest)).toBe(false);
  });

  it("goes dark when its site stops arriving while the flown craft goes on", () => {
    const stream = mount(43);
    stream.subscribe("planted.flown.heartbeat");
    act(() => {
      stream.emit(
        cameraTopic(43),
        { cameraId: 43 },
        { validAt: 1000, deliveredAt: 1000 },
      );
      stream.emit("kerbcast.cameras", FLOWN, { validAt: 1000, deliveredAt: 1000 });
      stream.emit("planted.flown.heartbeat", {}, { validAt: 1010, deliveredAt: 1010 });
      settle();
    });
    expect(latest).toMatchObject({ kind: "elsewhere", link: "silent" });
    expect(latest && isDark(latest)).toBe(true);
  });
});
