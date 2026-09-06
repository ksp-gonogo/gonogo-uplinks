/**
 * How many typecheck errors each Uplink client still produces under
 * `moduleResolution: nodenext`, as a CEILING.
 *
 * ## Why both modes have to be checked at all
 *
 * The two disagree SILENTLY, which is what makes this worth a gate rather than a
 * note. `declare module "./types"` binds under `bundler` and does NOT bind under
 * `nodenext`, so a declaration merge vanishes and every key it contributed goes
 * with it. That shipped in the sdk and emptied `ContributionRegistry`. Every
 * Uplink here declares its own Topics through the same mechanism
 * (`declare module "@ksp-gonogo/sitrep-sdk"` extending `TopicPayloadMap`), so an
 * Uplink is exposed to the identical failure and a `bundler`-only typecheck cannot
 * see it.
 *
 * An author choosing `nodenext` is not doing anything exotic. It is the default a
 * modern Node package reaches for.
 *
 * ## A ceiling, never a floor, and never a red gate
 *
 * Above the entry fails. Below is REPORTED and does not fail, and is tightened
 * deliberately. Same rule and the same reason as `gonogo`'s
 * `uplink-extraction-debt.mjs`: the count moves for reasons that have nothing to
 * do with the branch under test, and a gate that failed on a downward move would
 * go red on an untouched tree on its own schedule.
 *
 * Seeded as a ceiling rather than red/green on purpose. A permanently-red job is
 * one this project has been bitten behind twice, and a second one would be the
 * same mistake with a new name.
 *
 * ## An Uplink with no entry is held to ZERO
 *
 * `example` has no entry, and that is the point: it was written extension-clean
 * from the start, so anything authored from here on has to be. Only what was
 * copied in could ever have been grandfathered.
 *
 * ## What the 112 actually is, measured 2026-08-27
 *
 * Not 112 problems. Three causes, and the count is dominated by the cascade off
 * the first:
 *
 *  - **65 x TS2835/TS2834**: scansat's own relative imports carry no extension.
 *    Mechanical, and the rest of the file's errors follow from them: once
 *    `../schema` does not resolve its types become `any`, which is where the 22
 *    TS7006 and 10 TS2322 come from
 *  - **3 x TS2339 on `styled.div`/`styled.canvas`**: `import styled from
 *    "styled-components"` resolves to the NAMESPACE, not the default, because
 *    styled-components 6.x publishes no `exports` field. This is the TYPE-level
 *    twin of the runtime `styled.span is not a function`, which means
 *    `server.deps.inline` does nothing for it: the workaround is a bundler
 *    setting and this is the compiler
 *  - **4 x TS2304 `Cannot find name 'TelemetryClient'`**: a type reachable under
 *    `bundler` and not here. Independent of the extensions, and worth a look on
 *    its own
 *  - **3 x TS2739/TS2741 in fixtures**: real shape mismatches (`BodyDefinition`
 *    missing `hasAtmosphere`/`maxAtmosphere`, `BodyMask` missing `layerId`) that
 *    `bundler` mode does not surface. These are the ones worth fixing first,
 *    because they are the only ones that say something is actually wrong
 *
 * 3 of the 112 are in generated code (`topic-map.ts` importing `./contract`), so
 * scansat cannot reach zero on its own however it is written: that fix belongs to
 * the unit-map codegen.
 *
 * ## What the 96 is, measured 2026-09-02 as kerbcast arrived
 *
 * Same shape as scansat's and the same single cause: 79 x TS2835 plus 4 x TS2834
 * are this client's own relative imports carrying no extension, and the 13 x
 * TS7006 follow from them, because a specifier that does not resolve makes every
 * name it exported `any`. 5 of the 96 are in generated code
 * (`topic-map.ts`/`units.ts` importing `./contract`), so this client cannot reach
 * zero on its own however it is written, exactly as scansat cannot.
 *
 * ## What the 11 is, measured 2026-09-02 as realfuels arrived
 *
 * The same single cause again, an order of magnitude smaller because this is a
 * much smaller client: 6 x TS2835 plus 1 x TS2834 are its own extensionless
 * relative imports, and all four remaining errors follow from them. The 2 x
 * TS7006 are a `.map` callback over an array whose element type came from a
 * specifier that did not resolve, and the 2 x TS2345 are `topics.ts` feeding the
 * generated unit maps to `registerTopicUnits`/`registerTypeUnits` as `unknown`
 * for the same reason. Two of the unresolved specifiers name generated files, so
 * this client cannot reach zero on its own either.
 *
 * ## What the 5 is, measured 2026-09-06 as avionics arrived
 *
 * The same single cause a fourth time and the smallest count yet: all 5 are this
 * client's own extensionless relative imports, 4 x TS2835 plus 1 x TS2834, and
 * nothing cascades off them. Unlike the three above, NONE of the 5 sits in
 * generated code: two of the specifiers name a generated file
 * (`./__generated__/contract`, `./__generated__/units`) but both import
 * statements are in the hand-written `topics.ts`, and the other three are in
 * `index.ts`, `AvionicsGoNoGo/index.tsx` and its test. So this is the first
 * client that could reach zero on its own, without waiting on the unit-map
 * codegen.
 *
 * Tighten with `node scripts/check-nodenext.mjs --update <name>` and commit the
 * diff beside whatever was fixed.
 */

export const NODENEXT_DEBT = {
  avionics: 5,
  kerbcast: 96,
  realfuels: 11,
  scansat: 112,
};
