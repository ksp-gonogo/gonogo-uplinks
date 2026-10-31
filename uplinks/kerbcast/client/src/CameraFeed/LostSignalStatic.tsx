import { usePrefersReducedMotion } from "@ksp-gonogo/ui-kit";
import { type CSSProperties, useEffect, useRef } from "react";

const WIDTH = 192;
const HEIGHT = 108;
const FRAME_MS = 70;

const STATIC_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  zIndex: 5,
  imageRendering: "pixelated",
  pointerEvents: "none",
  background: "#000",
};

function paint(ctx: CanvasRenderingContext2D) {
  const image = ctx.createImageData(WIDTH, HEIGHT);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.floor(Math.random() * 200);
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * Opaque static drawn over the whole picture of a camera feed whose craft has
 * no link to the command centre, so the operator sees no live pixels. Holds one
 * frame of static while the operator prefers reduced motion. Used by
 * {@link CameraFeed} while the link reads lost.
 */
export function LostSignalStatic() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    const ctx = canvasRef.current?.getContext?.("2d");
    if (!ctx) return;
    paint(ctx);
    if (reduceMotion) return;
    const timer = setInterval(() => paint(ctx), FRAME_MS);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      data-kc-lost-signal=""
      aria-hidden="true"
      width={WIDTH}
      height={HEIGHT}
      style={STATIC_STYLE}
    />
  );
}
