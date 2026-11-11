import type { MeterEntry } from "@ksp-gonogo/sitrep-sdk";
import { magnitudeOf } from "@ksp-gonogo/ui-kit";

/*
 * A meter draws whole percent, so its figure, its model and the ends of its
 * interval cannot be told apart below this step.
 */
const DISPLAY_STEP = 0.01;

type MeterValue = MeterEntry["value"];

const previousByMeter = new Map<
  string,
  { signature: string; value: MeterValue }
>();

function step(magnitude: unknown): string {
  const n = magnitudeOf(magnitude as never);
  return n === null || n === undefined || Number.isNaN(n)
    ? "-"
    : String(Math.round(n / DISPLAY_STEP));
}

/** Everything a meter draws from one value, at the precision it draws it. */
function drawnSignature(value: MeterValue): string {
  if (value === null || typeof value !== "object") return String(value);
  const v = value as unknown as Record<string, unknown>;
  if (typeof v.state !== "string") return `v:${step(value)}`;
  const parts = [v.state, step(v.value), String(v.grade ?? "")];
  const reckoning = v.reckoning as Record<string, unknown> | undefined;
  parts.push(String(reckoning?.status ?? "none"));
  if (reckoning?.status === "available") {
    const band = reckoning.band as Record<string, unknown> | undefined;
    parts.push(
      String(reckoning.basis),
      String(reckoning.beyondReceived),
      step(reckoning.modelled),
      band
        ? [step(band.lo), step(band.value), step(band.hi), band.kind].join(",")
        : "no-band",
    );
  }
  return parts.join("|");
}

/**
 * Hands back the entries with each meter's value replaced by the object it had
 * last time whenever nothing a meter draws has moved. A modelled reading is a
 * new object on every frame the view time advances, which would otherwise make
 * the host rebuild every meter on every frame for a bar that has not visibly
 * changed. A meter that left the list is forgotten.
 */
export function steadyMeters(entries: MeterEntry[] | null): MeterEntry[] | null {
  const seen = new Set<string>();
  const steady = entries?.map((entry) => {
    seen.add(entry.id);
    const signature = drawnSignature(entry.value);
    const before = previousByMeter.get(entry.id);
    if (before?.signature === signature) {
      return { ...entry, value: before.value };
    }
    previousByMeter.set(entry.id, { signature, value: entry.value });
    return entry;
  });
  for (const id of previousByMeter.keys()) {
    if (!seen.has(id)) previousByMeter.delete(id);
  }
  return steady ?? null;
}
