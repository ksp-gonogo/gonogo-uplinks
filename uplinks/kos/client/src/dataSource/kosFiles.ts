import type {
  KosFilesDeleteArgs,
  KosFilesListArgs,
  KosFilesReadArgs,
  KosFilesRenameArgs,
  KosFilesWriteArgs,
} from "../__generated__/contract.js";
import type { KosData } from "../shared/kos-data.js";

/** A CPU volume a file command reaches: `0:` the Archive, `1:` the CPU's own drive. */
export type KosVolume = "0:" | "1:";

type Addressed = "coreId" | "requestId";

/** One `kos.files.*` command as the per-CPU queue sends it, before the CPU and request are named. */
export type KosFileCall =
  | { command: "kos.files.list"; args: Omit<KosFilesListArgs, Addressed> }
  | { command: "kos.files.read"; args: Omit<KosFilesReadArgs, Addressed> }
  | { command: "kos.files.write"; args: Omit<KosFilesWriteArgs, Addressed> }
  | { command: "kos.files.delete"; args: Omit<KosFilesDeleteArgs, Addressed> }
  | { command: "kos.files.rename"; args: Omit<KosFilesRenameArgs, Addressed> };

/**
 * One file's text as a CPU volume holds it, with the content hash a later
 * write, delete or rename of it names to be sure the file has not changed
 * since.
 */
export interface KosFileText {
  volume: KosVolume;
  /** The file's path inside the volume, such as `lib/launch.ks`. */
  path: string;
  /** The file's UTF-8 text, line endings as `\n`. */
  text: string;
  hash: string;
  /** In bytes. */
  size: number;
}

/** A file a write saved, with the hash of what is now on the volume. */
export interface KosFileWritten {
  volume: KosVolume;
  path: string;
  hash: string;
  /** In bytes. */
  size: number;
}

/** A file a delete removed. */
export interface KosFileDeleted {
  volume: KosVolume;
  path: string;
}

/** A file a rename moved, with its hash under the new name. */
export interface KosFileRenamed {
  volume: KosVolume;
  path: string;
  newPath: string;
  hash: string;
}

function field<T extends "string" | "number">(
  command: string,
  fields: KosData,
  name: string,
  kind: T,
): T extends "string" ? string : number {
  const value = fields[name];
  if (typeof value !== kind) {
    throw new Error(
      `${command}: the CPU's answer has no ${kind} "${name}", so it could not be read`,
    );
  }
  return value as T extends "string" ? string : number;
}

function volumeOf(command: string, fields: KosData): KosVolume {
  const volume = field(command, fields, "volume", "string");
  if (volume !== "0:" && volume !== "1:") {
    throw new Error(`${command}: the CPU answered for an unknown volume "${volume}"`);
  }
  return volume;
}

export function readAnswer(fields: KosData): KosFileText {
  const c = "kos.files.read";
  return {
    volume: volumeOf(c, fields),
    path: field(c, fields, "path", "string"),
    text: field(c, fields, "text", "string"),
    hash: field(c, fields, "hash", "string"),
    size: field(c, fields, "size", "number"),
  };
}

export function writeAnswer(fields: KosData): KosFileWritten {
  const c = "kos.files.write";
  return {
    volume: volumeOf(c, fields),
    path: field(c, fields, "path", "string"),
    hash: field(c, fields, "hash", "string"),
    size: field(c, fields, "size", "number"),
  };
}

export function deleteAnswer(fields: KosData): KosFileDeleted {
  const c = "kos.files.delete";
  return {
    volume: volumeOf(c, fields),
    path: field(c, fields, "path", "string"),
  };
}

export function renameAnswer(fields: KosData): KosFileRenamed {
  const c = "kos.files.rename";
  return {
    volume: volumeOf(c, fields),
    path: field(c, fields, "path", "string"),
    newPath: field(c, fields, "newPath", "string"),
    hash: field(c, fields, "hash", "string"),
  };
}
