import { useEffect } from "react";

interface PrefixedDocument {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

function fullscreenElement(): Element | null {
  const d = document as Document & PrefixedDocument;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

function exitFullscreen(): void {
  const d = document as Document & PrefixedDocument;
  void (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
}

const EXIT_STYLE: Partial<CSSStyleDeclaration> = {
  position: "absolute",
  top: "8px",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: "10",
  padding: "6px 12px",
  font: "inherit",
  fontSize: "13px",
  color: "#fff",
  background: "rgba(0, 0, 0, 0.7)",
  border: "1px solid rgba(255, 255, 255, 0.6)",
  borderRadius: "4px",
  cursor: "pointer",
};

/**
 * A button that leaves fullscreen, drawn inside whichever element of `host`
 * is fullscreen. Shown for as long as that element is fullscreen, so the
 * operator can always leave it with a click or tap even when the feed's own
 * controls are hidden until the pointer hovers (which a touch screen never
 * does). Escape needs no help: the browser handles it.
 * Used by the camera feed widget around the shared feed's fullscreen frame.
 */
export function FullscreenExit({
  host,
}: Readonly<{ host: HTMLElement | null }>) {
  useEffect(() => {
    if (!host) return;
    /*
     * Added to the DOM by hand: only the shared feed's frame is fullscreen,
     * so a React child of this widget would sit outside it and not be drawn.
     */
    let button: HTMLButtonElement | null = null;
    const remove = () => {
      button?.remove();
      button = null;
    };
    const sync = () => {
      remove();
      const el = fullscreenElement();
      if (!el || !host.contains(el)) return;
      button = document.createElement("button");
      button.type = "button";
      button.textContent = "Exit fullscreen";
      button.setAttribute("aria-label", "Exit fullscreen");
      Object.assign(button.style, EXIT_STYLE);
      button.addEventListener("click", exitFullscreen);
      el.appendChild(button);
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
      remove();
    };
  }, [host]);

  return null;
}
