/** A kOS LIST, UNIQUESET, QUEUE or STACK: `type` names which, `omitted` counts the items cut off after the first 500. */
export interface KosListValue {
  kind: "list";
  type: string;
  items: KosDataValue[];
  omitted: number;
}

/** A nested kOS LEXICON: its entries in order, each key as its text. */
export interface KosLexiconValue {
  kind: "lexicon";
  entries: { key: string; value: KosDataValue }[];
  omitted: number;
}

/** A kOS VECTOR: the components and their length. */
export interface KosVectorValue {
  kind: "vector";
  x: number;
  y: number;
  z: number;
  magnitude: number;
}

/** A kOS DIRECTION as the pitch, yaw and roll kOS prints for it, in degrees. */
export interface KosDirectionValue {
  kind: "direction";
  pitch: number;
  yaw: number;
  roll: number;
}

/** A kOS TIMESPAN: a length of time in seconds. */
export interface KosTimeSpanValue {
  kind: "timespan";
  seconds: number;
}

/** A kOS TIMESTAMP: an instant, in seconds since the game's epoch. */
export interface KosTimeStampValue {
  kind: "timestamp";
  seconds: number;
}

/** A kOS GEOPOSITION, in degrees. */
export interface KosGeoValue {
  kind: "geo";
  latitude: number;
  longitude: number;
}

/** A kOS PART or VESSEL a script handed back, by its name and id. */
export interface KosReferenceValue {
  kind: "part" | "vessel";
  name: string;
  id: string;
}

/** Any other kOS value: its kOS type name and the text kOS prints for it. */
export interface KosOtherValue {
  kind: "other";
  type: string;
  text: string;
}

/** A value a script handed back that is more than a number, boolean or string. */
export type KosStructuredValue =
  | KosListValue
  | KosLexiconValue
  | KosVectorValue
  | KosDirectionValue
  | KosTimeSpanValue
  | KosTimeStampValue
  | KosGeoValue
  | KosReferenceValue
  | KosOtherValue;

/** One value a script handed back with `ADDONS:GONOGO:RETURN`. */
export type KosDataValue =
  | number
  | boolean
  | string
  | null
  | KosStructuredValue;

/**
 * What a script handed back with `ADDONS:GONOGO:RETURN`: a lexicon's keys by
 * their text, or the single key `value` for any other value. Empty when the
 * script finished without handing anything back.
 */
export type KosData = Record<string, KosDataValue>;

/** One argument a script is run with: it reaches the script as the matching kOS value. */
export type KosScriptArg = number | string | boolean;

/** Whether `value` is one of the shapes a script hands back beyond a number, boolean or string. */
export function isStructured(value: KosDataValue): value is KosStructuredValue {
  return typeof value === "object" && value !== null && "kind" in value;
}
