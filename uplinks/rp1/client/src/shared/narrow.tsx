import { useElementSize } from "@ksp-gonogo/ui-kit";
import type { CSSProperties, ReactNode } from "react";

const SNUG = { "--inset-table-cell": "var(--space-4)" } as CSSProperties;

/** CSS pixels of width a table of three figure columns needs at its usual padding. */
export const TABLE_MIN_WIDTH = 240;

/**
 * Measures the box it is given and says whether it is narrower than `below`
 * CSS pixels, so a caller can lay a table out another way before the table
 * scrolls its figures out of view.
 */
export function useNarrowerThan(below: number) {
  const { ref, size } = useElementSize<HTMLDivElement>({ w: 1024, h: 0 });
  return { ref, narrow: size.w < below };
}

/**
 * A table's box with its cell padding halved when the box is narrower than
 * `TABLE_MIN_WIDTH`, so the columns keep their figures on screen.
 */
export function SnugTable({ children }: Readonly<{ children: ReactNode }>) {
  const { ref, narrow } = useNarrowerThan(TABLE_MIN_WIDTH);
  return (
    <div ref={ref} style={narrow ? SNUG : undefined}>
      {children}
    </div>
  );
}
