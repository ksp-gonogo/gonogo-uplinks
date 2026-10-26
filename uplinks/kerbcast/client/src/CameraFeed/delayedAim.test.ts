import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AimQueue } from "./delayedAim.js";

describe("AimQueue", () => {
  let t = 0;
  const now = () => t;
  const advance = async (ms: number) => {
    t += ms;
    await vi.advanceTimersByTimeAsync(ms);
  };

  beforeEach(() => {
    t = 0;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const recorder = () => {
    const sent: string[] = [];
    const msg = (name: string) => () => {
      sent.push(name);
      return Promise.resolve();
    };
    return { sent, msg };
  };

  it("sends nothing before the delay, and the message after it", async () => {
    const q = new AimQueue(now);
    const { sent, msg } = recorder();
    void q.enqueue(0.5, msg("press"));

    await advance(499);
    expect(sent).toEqual([]);
    await advance(1);
    expect(sent).toEqual(["press"]);
  });

  it("delays a release the same way, keeping the gap between press and release", async () => {
    const q = new AimQueue(now);
    const { sent, msg } = recorder();
    void q.enqueue(0.5, msg("press"));
    await advance(300);
    void q.enqueue(0.5, msg("release"));

    await advance(200);
    expect(sent).toEqual(["press"]);
    await advance(299);
    expect(sent).toEqual(["press"]);
    await advance(1);
    expect(sent).toEqual(["press", "release"]);
  });

  it("never reorders when the delay shrinks under a held input", async () => {
    const q = new AimQueue(now);
    const { sent, msg } = recorder();
    void q.enqueue(2, msg("press"));
    await advance(100);
    void q.enqueue(0.5, msg("release"));

    await advance(1000);
    expect(sent).toEqual([]);
    await advance(900);
    expect(sent).toEqual(["press", "release"]);
  });

  it("holds a later message behind a waiting one even with no delay", async () => {
    const q = new AimQueue(now);
    const { sent, msg } = recorder();
    void q.enqueue(0.5, msg("press"));
    void q.enqueue(0, msg("release"));

    expect(sent).toEqual([]);
    await advance(500);
    expect(sent).toEqual(["press", "release"]);
  });

  it("sends at once when there is no delay and nothing waiting", () => {
    const q = new AimQueue(now);
    const { sent, msg } = recorder();
    void q.enqueue(0, msg("press"));
    expect(sent).toEqual(["press"]);
  });

  it("drops what is waiting on clear", async () => {
    const q = new AimQueue(now);
    const { sent, msg } = recorder();
    void q.enqueue(0.5, msg("press"));
    q.clear();

    await advance(1000);
    expect(sent).toEqual([]);
    expect(q.size).toBe(0);
  });
});
