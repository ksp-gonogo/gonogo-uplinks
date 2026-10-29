import { GENERATED_COMMAND_IDS } from "../__generated__/command-map.js";

/** The `system.uplink.delays` report the mod sends for this Uplink: every command writes the active craft's plan, so each takes that craft's delay. */
export const EVERY_COMMAND_TO_THE_CRAFT = {
  activeVessel: [...GENERATED_COMMAND_IDS],
  elsewhere: [],
};
