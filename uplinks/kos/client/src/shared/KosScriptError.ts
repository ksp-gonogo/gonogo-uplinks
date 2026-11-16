/**
 * Marker subclass: an error kOS stopped the running kerboscript on (a
 * runtime error such as an undefined variable, or a compile error in the
 * script), not one from transport or session bookkeeping. Raised by `KosUplinkExecutor` (via `kosUplinkExecutor.ts`)
 * so callers can distinguish a script-author fault from a transport error
 * without every failure mode collapsing into a generic `Error`.
 */
export class KosScriptError extends Error {
  readonly isScriptError = true;
  constructor(message: string) {
    super(message);
    this.name = "KosScriptError";
  }
}

/**
 * Duck-type check that survives bundling, structured-clone, and the
 * occasional cross-realm Error. Prefer this over `instanceof` at module
 * boundaries.
 */
export function isKosScriptError(err: unknown): err is KosScriptError {
  return (
    err !== null &&
    typeof err === "object" &&
    (err as { isScriptError?: unknown }).isScriptError === true
  );
}
