import { screen, waitFor } from "@ksp-gonogo/sitrep-sdk/testing";

function matches(reason: string | RegExp, description: string): boolean {
  return typeof reason === "string"
    ? description === reason
    : reason.test(description);
}

/**
 * Every button whose description, the tip a command control gives, matches. A
 * blocked command control keeps its own name and gives the game's reason as its
 * description, so a test finds it by the reason here and by its name elsewhere.
 */
export function getAllButtonsDescribedBy(
  reason: string | RegExp,
): HTMLElement[] {
  const found = screen
    .queryAllByRole("button")
    .filter((el) =>
      matches(reason, el.getAttribute("aria-description") ?? ""),
    );
  if (found.length === 0) {
    throw new Error(`No button is described by ${String(reason)}`);
  }
  return found;
}

/** The one button {@link getAllButtonsDescribedBy} finds. */
export function getButtonDescribedBy(reason: string | RegExp): HTMLElement {
  const found = getAllButtonsDescribedBy(reason);
  if (found.length > 1) {
    throw new Error(
      `${found.length} buttons are described by ${String(reason)}`,
    );
  }
  return found[0];
}

/** {@link getButtonDescribedBy}, waiting for the description to arrive. */
export function findButtonDescribedBy(
  reason: string | RegExp,
): Promise<HTMLElement> {
  return waitFor(() => getButtonDescribedBy(reason));
}

/** {@link getAllButtonsDescribedBy}, waiting for the description to arrive. */
export function findAllButtonsDescribedBy(
  reason: string | RegExp,
): Promise<HTMLElement[]> {
  return waitFor(() => getAllButtonsDescribedBy(reason));
}
