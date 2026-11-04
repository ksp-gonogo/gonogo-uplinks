import type { ReactNode } from "react";

const BREAKABLE = { overflowWrap: "break-word" } as const;

/**
 * Text that breaks inside a word when its box is narrower than the word, where
 * plain text runs past the box's edge.
 */
export function Breakable({ children }: Readonly<{ children: ReactNode }>) {
  return <span style={BREAKABLE}>{children}</span>;
}
