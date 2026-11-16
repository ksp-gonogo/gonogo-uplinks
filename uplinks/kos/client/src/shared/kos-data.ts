/** One value in the lexicon a script hands back with `ADDONS:GONOGO:RETURN`. */
export type KosDataValue = number | boolean | string;

/**
 * The lexicon a script handed back with `ADDONS:GONOGO:RETURN`, keyed by the
 * text of its keys. Empty when the script finished without handing anything
 * back.
 */
export type KosData = Record<string, KosDataValue>;

/** One argument a script is run with: it reaches the script as the matching kOS value. */
export type KosScriptArg = number | string | boolean;
