import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * Whether the element the returned ref is attached to is on screen: false while
 * it or an ancestor is `display: none` (a hidden strip or dashboard tab) or it
 * is scrolled out of its container. True until the first observation, and
 * always true where `IntersectionObserver` is missing, so a feed is never
 * withheld by a browser that cannot say.
 */
function useOnScreen(): [(el: HTMLElement | null) => void, boolean] {
  const [onScreen, setOnScreen] = useState(true);
  const observer = useRef<IntersectionObserver | null>(null);
  const attach = useCallback((el: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) setOnScreen(last.isIntersecting);
    });
    io.observe(el);
    observer.current = io;
  }, []);
  useEffect(() => () => observer.current?.disconnect(), []);
  return [attach, onScreen];
}

const FILL: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flex: 1,
  width: "100%",
  height: "100%",
  minWidth: 0,
  minHeight: 0,
};

/**
 * Mounts its children only while it is on screen. Useful for releasing a live
 * camera feed while its tile is hidden, since Kerbcast keeps capturing a feed
 * for as long as a component holds it and releases it a grace period after the
 * last holder unmounts. Used by the camera feed widget and the crew face feed.
 */
export function OnScreenOnly({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [attach, onScreen] = useOnScreen();
  return (
    <div ref={attach} style={FILL}>
      {onScreen ? children : null}
    </div>
  );
}
