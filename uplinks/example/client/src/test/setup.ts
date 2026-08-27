import "@testing-library/jest-dom/vitest";
import { PerfBudget } from "@ksp-gonogo/sitrep-sdk";
import {
  installDomStubs,
  installRealTestHost,
} from "@ksp-gonogo/sitrep-sdk/testing";
import {
  AugmentSlot,
  clearAugments,
  getAugmentsForSlot,
  registerAugment,
  setQuantityLocale,
} from "@ksp-gonogo/ui-kit";

// jsdom is missing a handful of APIs widgets legitimately use (ResizeObserver
// and friends). The harness supplies them so a widget does not have to know it
// is being tested.
installDomStubs();

// Any test that pushes a registered PerfBudget past its threshold fails. Cheap,
// and it catches a runaway subscription before it reaches a dashboard.
PerfBudget.installTestGate();

/*
 * The host MUST be installed here, in setupFiles, and not in a `beforeEach`.
 *
 * `defineUplinkClient` and `registerComponent` run at MODULE SCOPE, so they fire
 * the moment a test file imports the widget, which is before any hook runs. A
 * `beforeEach` is too late and the failure is a clear one:
 * "the gonogo host has not been installed".
 *
 * Every member, not the subset this client happens to call today: a partial host
 * fails as `getHost().<member> is not a function` the first time a widget reaches
 * for something new, and a test gains nothing from the host being incomplete. The
 * four augment members come from ui-kit because that is where the augment
 * registry lives, and ui-kit imports the sdk, so the sdk cannot import them back.
 */
installRealTestHost({
  AugmentSlot,
  clearAugments,
  getAugmentsForSlot,
  registerAugment,
});

// Pin the locale every quantity is formatted in. It defaults to the READER's,
// which is right for an operator and wrong for an assertion: a render on a
// French machine has to match one on an American CI runner.
setQuantityLocale("en-GB");
