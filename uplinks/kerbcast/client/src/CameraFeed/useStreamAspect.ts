import { useEffect, useState } from "react";

/** The shape of the picture a `<video>` is actually playing, or `null` before it has dimensions. */
export function videoAspect(video: HTMLVideoElement | null): number | null {
  if (!video || !(video.videoWidth > 0) || !(video.videoHeight > 0)) {
    return null;
  }
  return video.videoWidth / video.videoHeight;
}

/**
 * The aspect (width over height) of the stream the `<video>` under `root` is
 * playing, read off the element itself rather than the camera's configured size.
 *
 * `loadedmetadata` and `resize` fire on the video and do not bubble, so they are
 * heard in the capture phase from the root, which also covers the SDK replacing
 * the element when the camera changes. `null` until a frame has dimensions, and
 * again when the root has no video.
 */
export function useStreamAspect(root: HTMLElement | null): number | null {
  const [aspect, setAspect] = useState<number | null>(null);
  useEffect(() => {
    if (!root) {
      setAspect(null);
      return;
    }
    const sync = () => setAspect(videoAspect(root.querySelector("video")));
    sync();
    root.addEventListener("loadedmetadata", sync, true);
    root.addEventListener("resize", sync, true);
    const watch =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(sync);
    watch?.observe(root, { childList: true, subtree: true });
    return () => {
      root.removeEventListener("loadedmetadata", sync, true);
      root.removeEventListener("resize", sync, true);
      watch?.disconnect();
    };
  }, [root]);
  return aspect;
}
