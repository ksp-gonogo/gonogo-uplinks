import type { ReactNode } from "react";

const WRAPPING = { display: "inline-block", whiteSpace: "normal" } as const;

/**
 * A table column heading that wraps onto a second line when its column is
 * squeezed, where a plain heading stays on one line and pushes the figures
 * below it out of view.
 */
export function WrapHeader({ children }: Readonly<{ children: ReactNode }>) {
  return <span style={WRAPPING}>{children}</span>;
}
