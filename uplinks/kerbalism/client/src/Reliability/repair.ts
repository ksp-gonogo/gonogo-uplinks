import type { CrewMember, InventoryStore } from "@ksp-gonogo/sitrep-sdk";
import { magnitudeOf } from "@ksp-gonogo/ui-kit";
import type { KerbalismRepairCostItem } from "../__generated__/contract.js";

/**
 * One line of a repair's stated cost. `label` is the item's display title where
 * anything aboard names it, its config id otherwise; `reserve` is what the
 * craft's part stores hold, which a repair fetches from when the kerbal is short.
 */
export interface CostLine {
  name: string;
  label: string;
  needed: number;
  reserve: number;
}

/** How many of one item this kerbal carries, joined on the id Kerbalism stated. */
export function carriedOf(member: CrewMember, itemName: string): number {
  let held = 0;
  for (const item of member.carrying ?? []) {
    if (item.name === itemName) held += magnitudeOf(item.quantity) ?? 0;
  }
  return held;
}

/** The conditions `kerbalism.repair` acts on: Kerbalism's Repair() clears a service with the same call. */
export function actionable(condition: string | null | undefined): boolean {
  return (
    condition === "failed" ||
    condition === "failed-critical" ||
    condition === "service-due"
  );
}

/** `Repair` for a failure, `Service` for a part that is merely due one. */
export function verbFor(condition: string | null | undefined): string {
  return condition === "service-due" ? "Service" : "Repair";
}

/**
 * Whether Kerbalism's repair specs accept this kerbal, off the requirement it
 * stated: no trait means anyone, comma-separated traits mean any of them.
 * Filtering here spares the operator a round trip to a known refusal.
 */
export function mayAct(
  member: CrewMember,
  trait: string | null | undefined,
  level: number | null | undefined,
): boolean {
  if (trait) {
    const accepted = trait.split(",").map((t) => t.trim().toLowerCase());
    if (!accepted.includes((member.trait ?? "").toLowerCase())) return false;
  }
  if (level != null && (magnitudeOf(member.experienceLevel) ?? 0) < level) {
    return false;
  }
  return true;
}

/**
 * Kerbalism's stated cost for a part, resolved against the craft. A part with
 * no stated cost resolves to no lines: that is "nothing is consumed", never a
 * cost of zero, so it draws no ledger and gates nothing.
 */
export function repairCostResolver(
  crew: readonly CrewMember[],
  stores: readonly InventoryStore[],
): (
  cost: readonly KerbalismRepairCostItem[] | null | undefined,
) => CostLine[] {
  // Part-hosted stores only: a repair never takes an item out of another kerbal's pocket.
  const aboard = new Map<string, { quantity: number; title?: string | null }>();
  for (const store of stores) {
    for (const item of store.items ?? []) {
      const seen = aboard.get(item.name);
      aboard.set(item.name, {
        quantity: (seen?.quantity ?? 0) + (magnitudeOf(item.quantity) ?? 0),
        title: seen?.title ?? item.title,
      });
    }
  }
  const titleOf = (name: string): string | undefined => {
    const stored = aboard.get(name)?.title;
    if (stored) return stored;
    for (const member of crew) {
      for (const item of member.carrying ?? []) {
        if (item.name === name && item.title) return item.title;
      }
    }
    return undefined;
  };
  return (cost) =>
    (cost ?? []).map((item) => ({
      name: item.name,
      label: titleOf(item.name) ?? item.name,
      needed: magnitudeOf(item.quantity) ?? 0,
      reserve: aboard.get(item.name)?.quantity ?? 0,
    }));
}
