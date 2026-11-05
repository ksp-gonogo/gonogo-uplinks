import type { KerbcastClient } from "@ksp-gonogo/kerbcast";

/**
 * The camera aim messages the pad, the zoom pair and the bound inputs send:
 * rates and absolute setpoints alike.
 */
const AIM_METHODS = ["setPanRate", "setZoomRate", "setPan", "setFov"] as const;

interface Pending {
  due: number;
  /** Whether sending it brings the camera's movement to rest. */
  stops: boolean;
  send: () => Promise<void>;
  done: () => void;
}

/**
 * A first-in first-out line of aim messages, each released one one-way delay
 * after the input that made it. Useful for making a held pan or zoom start and
 * stop at the camera one delay after the operator's hand does. Used by
 * {@link withDelayedAim}.
 */
export class AimQueue {
  private readonly pending: Pending[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastDue = 0;

  constructor(private readonly now: () => number = () => performance.now()) {}

  /** Messages still waiting for their delay to elapse. */
  get size(): number {
    return this.pending.length;
  }

  /**
   * Sends `send` once `delaySeconds` have passed, and never before a message
   * queued earlier. A delay that shrinks while messages are waiting cannot
   * bring a later message ahead of them, because its due time is held at or
   * after the previous one. `stops` marks a message that brings the movement it
   * follows to rest, which {@link release} still sends when the queue is
   * abandoned.
   */
  enqueue(
    delaySeconds: number,
    send: () => Promise<void>,
    stops = false,
  ): Promise<void> {
    if (this.pending.length === 0 && delaySeconds <= 0) return send();
    const due = Math.max(this.now() + delaySeconds * 1000, this.lastDue);
    this.lastDue = due;
    return new Promise<void>((done) => {
      this.pending.push({ due, stops, send, done });
      this.arm();
    });
  }

  /**
   * Abandons the queue: waiting movements are dropped unsent, and waiting stops
   * are sent at once, in order. A camera that was being moved must not be left
   * moving because the message that ends it was still waiting out the delay.
   */
  release(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    for (const p of this.pending.splice(0)) {
      if (p.stops) p.send().then(p.done, p.done);
      else p.done();
    }
  }

  private arm(): void {
    if (this.timer !== null || this.pending.length === 0) return;
    this.timer = setTimeout(
      () => {
        this.timer = null;
        this.flush();
      },
      Math.max(0, this.pending[0].due - this.now()),
    );
  }

  private flush(): void {
    const t = this.now();
    while (this.pending.length > 0 && this.pending[0].due <= t) {
      const p = this.pending.shift() as Pending;
      p.send().then(p.done, p.done);
    }
    this.arm();
  }
}

/** Whether an aim message is a rate of zero, which is how a held input is released. */
function isStop(method: string | symbol, args: readonly unknown[]): boolean {
  return (
    (method === "setPanRate" || method === "setZoomRate") &&
    args.every((arg) => arg === 0)
  );
}

/**
 * A view of the client whose cameras take their aim messages through `queue`,
 * each held for the one-way delay `delaySeconds()` reports when the message is
 * made. Everything else on the client and its cameras is untouched.
 */
export function withDelayedAim(
  client: KerbcastClient,
  queue: AimQueue,
  delaySeconds: () => number,
): KerbcastClient {
  return new Proxy(client, {
    get(target, prop) {
      if (prop === "camera") {
        return (flightId: number) => {
          const handle = target.camera(flightId);
          return new Proxy(handle, {
            get(h, name) {
              const value = Reflect.get(h, name, h);
              if (typeof value !== "function") return value;
              if (
                (AIM_METHODS as readonly (string | symbol)[]).includes(name)
              ) {
                return (...args: unknown[]) =>
                  queue.enqueue(
                    delaySeconds(),
                    () =>
                      (value as (...a: unknown[]) => Promise<void>).apply(
                        h,
                        args,
                      ),
                    isStop(name, args),
                  );
              }
              return value.bind(h);
            },
          });
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
