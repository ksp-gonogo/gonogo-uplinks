// testflight.repair, registered in both halves off the generated command map:
// the `CommandArgsMap`/`CommandReplyMap` augmentation types
// `useCommand("testflight.repair")`, and `registerUplinkCommand` feeds the
// runtime registry with the command's delay-rail row. `index.ts` re-exports this
// module so the augmentation reaches the emitted `dist/index.d.ts`.
import { registerUplinkCommand } from "@ksp-gonogo/sitrep-sdk";
import {
  GENERATED_COMMAND_IDS,
  GENERATED_COMMAND_RAIL,
  type GeneratedCommandArgsMap,
  type GeneratedCommandReplyMap,
} from "./__generated__/command-map.js";

declare module "@ksp-gonogo/sitrep-sdk" {
  interface CommandArgsMap extends GeneratedCommandArgsMap {}
  interface CommandReplyMap extends GeneratedCommandReplyMap {}
}

for (const id of GENERATED_COMMAND_IDS) {
  registerUplinkCommand(id, GENERATED_COMMAND_RAIL[id]);
}

/** This Uplink's own command ids, as the generated map declares them. */
export { GENERATED_COMMAND_IDS as UPLINK_COMMAND_IDS };
