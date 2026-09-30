import {
  classifyCommandRejection,
  useCommand,
  useViewUt,
  type Value,
} from "@ksp-gonogo/sitrep-sdk";
import { useCallback, useState, useSyncExternalStore } from "react";
import type { PrincipiaComposedBurn } from "./__generated__/contract.js";
import { PrincipiaBurnProfile } from "./__generated__/contract.js";

/**
 * The command that installs a composed plan whole, as Principia's flight plan.
 */
export const PLAN_SEND_COMMAND = "principia.plan.send";

/**
 * One burn of a plan being composed, in the Frenet trihedron.
 *
 * <p>Principia's planner states every burn as tangent, normal and binormal, so a
 * draft holds nothing else and names its components by what they are.</p>
 */
export interface DraftBurn {
  ignitionUt: Value<"ut">;
  deltaVTangent: Value<"m/s">;
  deltaVNormal: Value<"m/s">;
  deltaVBinormal: Value<"m/s">;
  inertiallyFixed: boolean;
}

/**
 * A plan being composed at a command centre, before anything has been sent.
 *
 * <p>Drafts are command-centre objects, so two operators can work on different
 * plans for the same vessel without either touching the game. The observed
 * instant is recorded when the draft is built, because it says how old the
 * information was that the operator decided on; an edit takes a new one.</p>
 */
export interface PlanDraft {
  /** This draft's own id, assigned by the store and never the game's. */
  id: string;

  /**
   * How many times what this draft would SEND has changed. The mod answers a
   * request id it has already seen out of its replay cache without reading the
   * plan, so the request id is the draft at its revision: a corrected plan gets
   * a new id and a retransmission of the same one does not.
   */
  revision: number;

  /** What the operator calls it. Never sent. */
  name: string;

  vesselId?: string;

  burns: DraftBurn[];

  /** How far the plan is asked to run. */
  desiredFinalTimeUt?: number;

  /** The instant the state this draft was built from was actually true. */
  observedAt: Value<"ut">;

  /** Whether the operator has finished composing it. Only a saved draft is offered for sending. */
  saved?: boolean;
}

/** The fields that reach the craft, so a change to one of them is a new intent. */
const WIRE_FIELDS = [
  "burns",
  "observedAt",
  "vesselId",
  "desiredFinalTimeUt",
] as const satisfies readonly (keyof PlanDraft)[];

/**
 * The command centre's own plans, as a plain observable collection that a
 * widget, a test or anything else reads without a renderer.
 */
export class PlanDraftStore {
  private readonly drafts = new Map<string, PlanDraft>();
  private readonly listeners = new Set<() => void>();
  private nextId = 1;

  /** Rebuilt only on change, because `useSyncExternalStore` compares by identity. */
  private snapshot: readonly PlanDraft[] = [];

  list(): readonly PlanDraft[] {
    return this.snapshot;
  }

  create(draft: Omit<PlanDraft, "id" | "revision">): PlanDraft {
    const created: PlanDraft = { ...draft, id: `draft-${this.nextId}`, revision: 1 };
    this.nextId += 1;
    this.drafts.set(created.id, created);
    this.changed();
    return created;
  }

  update(
    id: string,
    changes: Partial<Omit<PlanDraft, "id" | "revision">>,
  ): PlanDraft | undefined {
    const existing = this.drafts.get(id);
    if (existing === undefined) return undefined;
    const touchesTheWire = WIRE_FIELDS.some((field) => field in changes);
    const updated: PlanDraft = {
      ...existing,
      ...changes,
      id,
      revision: existing.revision + (touchesTheWire ? 1 : 0),
    };
    this.drafts.set(id, updated);
    this.changed();
    return updated;
  }

  remove(id: string): boolean {
    const had = this.drafts.delete(id);
    if (had) this.changed();
    return had;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private changed(): void {
    this.snapshot = [...this.drafts.values()];
    for (const listener of this.listeners) listener();
  }
}

/**
 * The screen's draft store. Module scope, so a plan composed in one panel is
 * the same object another panel installs.
 */
const PLAN_DRAFTS = new PlanDraftStore();

/** The command centre's plans for this screen, and a live view of them. */
export function usePlanDrafts(): {
  store: PlanDraftStore;
  drafts: readonly PlanDraft[];
} {
  const subscribe = useCallback(
    (listener: () => void) => PLAN_DRAFTS.subscribe(listener),
    [],
  );
  const drafts = useSyncExternalStore(
    subscribe,
    () => PLAN_DRAFTS.list(),
    () => PLAN_DRAFTS.list(),
  );
  return { store: PLAN_DRAFTS, drafts };
}

/**
 * Discards every draft on this screen. Test-facing: the store outlives a
 * rendered tree, so call it after unmounting.
 */
export function clearPlanDrafts(): void {
  for (const draft of PLAN_DRAFTS.list()) PLAN_DRAFTS.remove(draft.id);
}

/**
 * A draft burn in the shape `principia.plan.send` binds.
 *
 * <p>Magnitudes rather than `Value`s: the receiving side binds each field to a
 * plain double and refuses an object with "Cannot bind wire value of type
 * Dictionary to numeric Double" from inside the handler, losing the whole plan.
 * `Unchanged` keeps whichever engine the plan already has, because the composer
 * does not offer one.</p>
 */
export function composedBurn(burn: DraftBurn): PrincipiaComposedBurn {
  return {
    ignitionUt: burn.ignitionUt.magnitude,
    deltaVTangent: burn.deltaVTangent.magnitude,
    deltaVNormal: burn.deltaVNormal.magnitude,
    deltaVBinormal: burn.deltaVBinormal.magnitude,
    inertiallyFixed: burn.inertiallyFixed,
    profile: PrincipiaBurnProfile.Unchanged,
  } as unknown as PrincipiaComposedBurn;
}

/** What became of one send. */
export interface SendDraftOutcome {
  accepted: boolean;
  /** Why not, when it was not accepted. Never empty. */
  refusal?: string;
}

/**
 * Transmit a saved draft through `principia.plan.send`, and track the one send
 * in flight.
 *
 * <p>The composed-at instant is stamped off the view clock at the press, and a
 * draft built from a state later than that view is refused before a message
 * leaves. A reply the mod declined and a message that never arrived resolve as
 * different refusals, so an operator knows whether a retransmit could double a
 * plan. `send` never throws.</p>
 */
export function useSendDraft(): {
  send: (draft: PlanDraft) => Promise<SendDraftOutcome>;
  pending: boolean;
  outcome: SendDraftOutcome | null;
} {
  const command = useCommand(PLAN_SEND_COMMAND);
  const viewUt = useViewUt();
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<SendDraftOutcome | null>(null);

  const send = useCallback(
    async (draft: PlanDraft): Promise<SendDraftOutcome> => {
      const composedAtViewUt = viewUt?.magnitude;
      const refusal = whyNotSendable(draft, composedAtViewUt);
      if (refusal) {
        const refused = { accepted: false, refusal };
        setOutcome(refused);
        return refused;
      }

      setPending(true);
      try {
        const reply = await command.send({
          vesselId: draft.vesselId,
          requestId: `${draft.id}@${draft.revision}`,
          composedAtViewUt,
          observedAtUt: draft.observedAt.magnitude,
          desiredFinalTimeUt: draft.desiredFinalTimeUt,
          burns: draft.burns.map(composedBurn),
        });
        const next = outcomeOfReply(
          reply as { success?: boolean; detail?: string } | undefined,
        );
        setOutcome(next);
        return next;
      } catch (error) {
        const failed = refusalFromError(error);
        setOutcome(failed);
        return failed;
      } finally {
        setPending(false);
      }
    },
    [command, viewUt],
  );

  return { send, pending, outcome };
}

function whyNotSendable(
  draft: PlanDraft,
  composedAtViewUt: number | undefined,
): string | undefined {
  if (composedAtViewUt === undefined) {
    return "No view clock is mounted, so there is nothing to record as the instant this plan was composed against.";
  }
  if (draft.observedAt.magnitude > composedAtViewUt) {
    return "This plan was built from a state later than the view it was composed at, which cannot have been seen from here.";
  }
  return undefined;
}

function outcomeOfReply(
  reply: { success?: boolean; detail?: string } | undefined,
): SendDraftOutcome {
  if (reply?.success) return { accepted: true };
  return {
    accepted: false,
    refusal:
      reply?.detail && reply.detail.length > 0
        ? reply.detail
        : "The vessel declined the plan and gave no reason. Check the flight-plan write surface is armed.",
  };
}

function refusalFromError(error: unknown): SendDraftOutcome {
  const rejection = classifyCommandRejection(error);
  if (rejection.kind === "refused") {
    return { accepted: false, refusal: rejection.detail ?? rejection.message };
  }
  if (rejection.kind === "lost") {
    return {
      accepted: false,
      refusal: `No answer to the plan arrived: ${rejection.message}. It may have been installed anyway.`,
    };
  }
  return {
    accepted: false,
    refusal: `The plan did not reach the game: ${rejection.message}`,
  };
}
