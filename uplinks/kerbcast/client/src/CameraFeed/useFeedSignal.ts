import { useEffect, useState } from "react";

/** What the tile shows in place of a picture, when it shows none. */
export type FeedSignal = "none" | "stalled" | null;

/** How long a feed must stay stalled before the tile says so. */
export const STALLED_AFTER_MS = 2000;

const ATTRIBUTE = "data-kc-signal";

/**
 * Whether the feed inside `root` has no picture to show ("none") or has had its
 * picture stop for longer than {@link STALLED_AFTER_MS} ("stalled"), read from
 * the `data-kc-signal` attribute Kerbcast puts on the feed. A stall that clears
 * sooner is not reported. `null` while the feed is live, has no camera, or the
 * attribute is absent.
 */
export function useFeedSignal(root: HTMLElement | null): FeedSignal {
  const [raw, setRaw] = useState<string | null>(null);
  const [stalledLong, setStalledLong] = useState(false);

  useEffect(() => {
    if (!root) {
      setRaw(null);
      return;
    }
    const read = () =>
      setRaw(root.querySelector(`[${ATTRIBUTE}]`)?.getAttribute(ATTRIBUTE) ?? null);
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [ATTRIBUTE],
    });
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    if (raw !== "stalled") {
      setStalledLong(false);
      return;
    }
    const timer = setTimeout(() => setStalledLong(true), STALLED_AFTER_MS);
    return () => clearTimeout(timer);
  }, [raw]);

  if (raw === "none") return "none";
  if (raw === "stalled" && stalledLong) return "stalled";
  return null;
}
