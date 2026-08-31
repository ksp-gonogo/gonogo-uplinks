import { expectUplinkPageCurrent } from "@ksp-gonogo/ui-kit/page-check";
import { describe, it } from "vitest";
// The client itself, so its registrations happen. The check reads the same
// registries the renderer reads; with nothing imported it would find an Uplink
// with no widgets and cheerfully report the page correct.
import "./index.js";

/**
 * The generated page, gated without a browser.
 *
 * `gonogo-uplink docs --check` asks two questions and only one of them needs
 * Chromium: whether the committed images are current does, whether the PROSE
 * still matches the registrations does not. This is the second question, and it
 * runs here because this suite has already loaded the client under jsdom with a
 * host installed, which is exactly what the check needs and nothing more.
 *
 * Worth having in the template rather than only in a real Uplink, for two
 * reasons. The page tells an author to "run `npm run docs` and commit what it
 * writes", and a rule with no gate behind it is a rule that decays: registering a
 * widget and forgetting the regen leaves a page that lists three of four
 * registrations, which reads exactly like an Uplink with three. And the failure is
 * a diff of the committed page against the generated one, so it says what to do
 * rather than that something is wrong.
 */
describe("the generated Uplink page", () => {
  it("still describes what this Uplink registers", () => {
    expectUplinkPageCurrent();
  });
});
