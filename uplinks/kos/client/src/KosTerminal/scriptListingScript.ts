/**
 * One entry of a volume listing as the `kos.files.list` answer reports it,
 * `{ name, size, isDir }`. `size` and `isDir` are both JSON null when the
 * volume could not report them, never a substituted 0 or false.
 */
export interface KosFileEntry {
  name: string;
  /**
   * The entry's size in bytes, or null/absent when the volume could not say
   * (an older kOS with no size suffix). Optional rather than `number`, because the field could
   * not carry the absence at all while it was declared non-optional, and a
   * substituted 0 reads as a file that is genuinely empty.
   */
  size?: number | null;
  /**
   * The entry's kind, as three states rather than two: true for a
   * subdirectory, false for a file, and null or absent when the volume could
   * not say (an older kOS with no ISFILE suffix, ). Null is not a file, and a caller that treats
   * it as one offers a directory as something to run.
   */
  isDir?: boolean | null;
}

/** What a listing entry is, once the two-state flag is read as three. */
export type KosEntryKind = "file" | "directory" | "unknown";

/**
 * Which of the three an entry reported. Only an explicit
 * `false` is evidence the entry is a file.
 */
export function kosEntryKind(entry: KosFileEntry): KosEntryKind {
  if (entry.isDir === true) return "directory";
  if (entry.isDir === false) return "file";
  return "unknown";
}
