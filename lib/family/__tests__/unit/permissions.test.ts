import { describe, it, expect } from "vitest";
import type { Category, Role } from "@/lib/family/types";
import {
  type Decision,
  type OccurrenceTarget,
  type Operation,
  type PermissionContext,
  bootstrapRole,
  can,
  canChangeRole,
  canDelete,
  isLastParent,
  mayRedeemFor,
  ownsOccurrence,
  type PermissionActor,
} from "@/lib/family/permissions";

type Outcome = "ok" | "NO_ACTOR" | "FORBIDDEN";

interface OperationRule {
  parent: Outcome;
  member: Outcome;
  /** No actor, household already has a parent (the steady state). */
  noActor: Outcome;
  /** No actor, household has zero parents (bootstrap, D6). */
  noActorBootstrap: Outcome;
}

// The decision table from DECISIONS §3 / D5 / D6, written out per operation so
// a new Operation cannot be added without an explicit row here.
const MATRIX: Record<Operation, OperationRule> = {
  read: { parent: "ok", member: "ok", noActor: "ok", noActorBootstrap: "ok" },
  punch_in: { parent: "ok", member: "ok", noActor: "ok", noActorBootstrap: "ok" },
  punch_out: { parent: "ok", member: "ok", noActor: "ok", noActorBootstrap: "ok" },
  set_pin: { parent: "ok", member: "FORBIDDEN", noActor: "ok", noActorBootstrap: "ok" },
  manage_categories: {
    parent: "ok",
    member: "FORBIDDEN",
    noActor: "NO_ACTOR",
    noActorBootstrap: "ok",
  },
  reorder_categories: {
    parent: "ok",
    member: "FORBIDDEN",
    noActor: "NO_ACTOR",
    noActorBootstrap: "NO_ACTOR",
  },
  delete_category: {
    parent: "ok",
    member: "FORBIDDEN",
    noActor: "NO_ACTOR",
    noActorBootstrap: "NO_ACTOR",
  },
  upload_avatar: {
    parent: "ok",
    member: "FORBIDDEN",
    noActor: "NO_ACTOR",
    noActorBootstrap: "NO_ACTOR",
  },
  update_settings: {
    parent: "ok",
    member: "FORBIDDEN",
    noActor: "NO_ACTOR",
    noActorBootstrap: "NO_ACTOR",
  },
  clear_pin: {
    parent: "ok",
    member: "FORBIDDEN",
    noActor: "NO_ACTOR",
    noActorBootstrap: "NO_ACTOR",
  },
  // Phase 5 (005 FR-534). Lists are the one surface open to every punched-in
  // Profile; the Parents only gate is the `parentsOnly` block below, and this
  // sweep supplies no flag, which is a plain list.
  "list.create": { parent: "ok", member: "ok", noActor: "NO_ACTOR", noActorBootstrap: "NO_ACTOR" },
  "list.write": { parent: "ok", member: "ok", noActor: "NO_ACTOR", noActorBootstrap: "NO_ACTOR" },
  // Phase 6 (006 FR-639, FR-640). Meals and recipes are every punched-in
  // Profile's, like lists; a mealtime's name and colour are a parent's.
  "meal.write": { parent: "ok", member: "ok", noActor: "NO_ACTOR", noActorBootstrap: "NO_ACTOR" },
  "recipe.write": { parent: "ok", member: "ok", noActor: "NO_ACTOR", noActorBootstrap: "NO_ACTOR" },
  "mealtime.edit": { parent: "ok", member: "FORBIDDEN", noActor: "NO_ACTOR", noActorBootstrap: "NO_ACTOR" },
  // Phase 3 (FR-389). The two target-aware rows read "FORBIDDEN" for a member
  // because this sweep supplies no target — a member with no record in hand
  // owns nothing. What a member may do WITH a target is the FR-351 block below.
  manage_tasks: {
    parent: "ok",
    member: "FORBIDDEN",
    noActor: "NO_ACTOR",
    noActorBootstrap: "NO_ACTOR",
  },
  manage_task_box: {
    parent: "ok",
    member: "FORBIDDEN",
    noActor: "NO_ACTOR",
    noActorBootstrap: "NO_ACTOR",
  },
  resolve_occurrence: {
    parent: "ok",
    member: "FORBIDDEN",
    noActor: "NO_ACTOR",
    noActorBootstrap: "NO_ACTOR",
  },
  reorder_routines: {
    parent: "ok",
    member: "FORBIDDEN",
    noActor: "NO_ACTOR",
    noActorBootstrap: "NO_ACTOR",
  },
  // Phase 4 (R410). The four things a parent does TO the economy are parent-only
  // (FR-419, FR-435); the two redeem verbs read "FORBIDDEN" for a member here
  // because this sweep names no Profile to redeem for — FR-424's rule with a
  // target is the SC-407 block below.
  "reward.create": {
    parent: "ok",
    member: "FORBIDDEN",
    noActor: "NO_ACTOR",
    noActorBootstrap: "NO_ACTOR",
  },
  "reward.edit": {
    parent: "ok",
    member: "FORBIDDEN",
    noActor: "NO_ACTOR",
    noActorBootstrap: "NO_ACTOR",
  },
  "reward.delete": {
    parent: "ok",
    member: "FORBIDDEN",
    noActor: "NO_ACTOR",
    noActorBootstrap: "NO_ACTOR",
  },
  "stars.adjust": {
    parent: "ok",
    member: "FORBIDDEN",
    noActor: "NO_ACTOR",
    noActorBootstrap: "NO_ACTOR",
  },
  "reward.redeem": {
    parent: "ok",
    member: "FORBIDDEN",
    noActor: "NO_ACTOR",
    noActorBootstrap: "NO_ACTOR",
  },
  "reward.unredeem": {
    parent: "ok",
    member: "FORBIDDEN",
    noActor: "NO_ACTOR",
    noActorBootstrap: "NO_ACTOR",
  },
};

const OPERATIONS = Object.keys(MATRIX) as Operation[];
const ACTORS: readonly (Role | null)[] = ["parent", "member", null];
const CONTEXTS: readonly PermissionContext[] = [
  { householdHasParent: true },
  { householdHasParent: false },
];

function expectedFor(op: Operation, actor: Role | null, ctx: PermissionContext): Decision {
  const rule = MATRIX[op];
  let outcome: Outcome;
  if (actor === null) {
    outcome = ctx.householdHasParent ? rule.noActor : rule.noActorBootstrap;
  } else {
    outcome = rule[actor];
  }
  return outcome === "ok" ? { allowed: true } : { allowed: false, reason: outcome };
}

const CASES = OPERATIONS.flatMap((op) =>
  ACTORS.flatMap((actor) =>
    CONTEXTS.map((ctx) => ({
      op,
      actor,
      ctx,
      actorName: actor ?? "no actor",
      expected: expectedFor(op, actor, ctx),
    })),
  ),
);

describe("can", () => {
  it("covers every operation × actor × household state", () => {
    expect(CASES).toHaveLength(25 * 3 * 2);
  });

  it.each(CASES)(
    "$op as $actorName with householdHasParent=$ctx.householdHasParent → $expected",
    ({ op, actor, ctx, expected }) => {
      expect(can(actor === null ? null : { role: actor }, op, ctx)).toEqual(expected);
    },
  );

  it("lets nobody-punched-in set a PIN (FR-018) but refuses a member actor (D5)", () => {
    const ctx = { householdHasParent: true };
    expect(can(null, "set_pin", ctx)).toEqual({ allowed: true });
    expect(can({ role: "member" }, "set_pin", ctx)).toEqual({ allowed: false, reason: "FORBIDDEN" });
  });

  it("opens manage_categories to a signed-in device only while no parent exists (D6)", () => {
    expect(can(null, "manage_categories", { householdHasParent: false })).toEqual({ allowed: true });
    expect(can(null, "manage_categories", { householdHasParent: true })).toEqual({
      allowed: false,
      reason: "NO_ACTOR",
    });
  });

  it("does not let bootstrap open any other write", () => {
    const bootstrap = { householdHasParent: false };
    for (const op of [
      "reorder_categories",
      "delete_category",
      "upload_avatar",
      "update_settings",
      "clear_pin",
      "manage_tasks",
      "manage_task_box",
      "resolve_occurrence",
      "reorder_routines",
      "reward.create",
      "reward.edit",
      "reward.delete",
      "stars.adjust",
      "reward.redeem",
      "reward.unredeem",
    ] as const) {
      expect(can(null, op, bootstrap)).toEqual({ allowed: false, reason: "NO_ACTOR" });
    }
  });
});

/* ------------------------------------------------ FR-351: the first target -- */

const ANA = "profile-ana";
const CLEO = "profile-cleo";
const STEADY: PermissionContext = { householdHasParent: true };

/** Cleo's own homework — an assigned occurrence whose chain owner is Cleo. */
const cleosOwn: OccurrenceTarget = { upForGrabs: false, assigneeId: CLEO };

/** The dishwasher, unclaimed: it belongs to nobody until a claim names a Profile. */
function upForGrabs(creditProfileId?: string | null): OccurrenceTarget {
  return { upForGrabs: true, assigneeId: null, creditProfileId };
}

describe("ownsOccurrence (FR-351, FR-353)", () => {
  it("is true for the occurrence whose chain owner is the actor", () => {
    expect(ownsOccurrence({ profileId: CLEO }, cleosOwn)).toBe(true);
  });

  it("is false for another Profile's occurrence", () => {
    expect(ownsOccurrence({ profileId: ANA }, cleosOwn)).toBe(false);
  });

  it("is false for the household chain of an unassigned task", () => {
    expect(ownsOccurrence({ profileId: CLEO }, { upForGrabs: false, assigneeId: null })).toBe(false);
  });

  it("lets the credit ride the assignee, and refuses a credit pointing elsewhere", () => {
    expect(ownsOccurrence({ profileId: CLEO }, { ...cleosOwn, creditProfileId: CLEO })).toBe(true);
    expect(ownsOccurrence({ profileId: CLEO }, { ...cleosOwn, creditProfileId: ANA })).toBe(false);
    expect(ownsOccurrence({ profileId: CLEO }, { ...cleosOwn, creditProfileId: null })).toBe(true);
  });

  it("lets a claim of an unclaimed up-for-grabs occurrence credit only the actor (US3-13)", () => {
    expect(ownsOccurrence({ profileId: CLEO }, upForGrabs(CLEO))).toBe(true);
    expect(ownsOccurrence({ profileId: CLEO }, upForGrabs(ANA))).toBe(false);
  });

  it("refuses an up-for-grabs write that names no Profile — a claim is never anonymous", () => {
    expect(ownsOccurrence({ profileId: CLEO }, upForGrabs())).toBe(false);
    expect(ownsOccurrence({ profileId: CLEO }, upForGrabs(null))).toBe(false);
  });

  it("refuses an up-for-grabs occurrence that somehow carries a chain owner", () => {
    // The 018 trigger forbids the row; the rule does not depend on it holding.
    expect(
      ownsOccurrence({ profileId: CLEO }, {
        upForGrabs: true,
        assigneeId: CLEO,
        creditProfileId: CLEO,
      }),
    ).toBe(false);
  });
});

describe("can, with a target (FR-351, FR-389)", () => {
  const member = { role: "member" as const, profileId: CLEO };
  const parent = { role: "parent" as const, profileId: ANA };

  it("lets a member resolve their own occurrence", () => {
    expect(can(member, "resolve_occurrence", { ...STEADY, target: cleosOwn })).toEqual({
      allowed: true,
    });
  });

  it("refuses a member another Profile's occurrence", () => {
    expect(
      can(member, "resolve_occurrence", {
        ...STEADY,
        target: { upForGrabs: false, assigneeId: ANA },
      }),
    ).toEqual({ allowed: false, reason: "FORBIDDEN" });
  });

  it("lets a parent resolve anyone's, and credit a claim to anyone", () => {
    expect(
      can(parent, "resolve_occurrence", {
        ...STEADY,
        target: { upForGrabs: false, assigneeId: CLEO },
      }),
    ).toEqual({ allowed: true });
    expect(can(parent, "resolve_occurrence", { ...STEADY, target: upForGrabs(CLEO) })).toEqual({
      allowed: true,
    });
  });

  it("lets a member claim for themselves and nobody else", () => {
    expect(can(member, "resolve_occurrence", { ...STEADY, target: upForGrabs(CLEO) })).toEqual({
      allowed: true,
    });
    expect(can(member, "resolve_occurrence", { ...STEADY, target: upForGrabs(ANA) })).toEqual({
      allowed: false,
      reason: "FORBIDDEN",
    });
  });

  it("refuses a member with no target and a member with no profile", () => {
    expect(can(member, "resolve_occurrence", STEADY)).toEqual({
      allowed: false,
      reason: "FORBIDDEN",
    });
    expect(
      can({ role: "member" }, "resolve_occurrence", { ...STEADY, target: cleosOwn }),
    ).toEqual({ allowed: false, reason: "FORBIDDEN" });
  });

  it("still demands a punch-in for a resolution, target or not (FR-350)", () => {
    expect(can(null, "resolve_occurrence", { ...STEADY, target: cleosOwn })).toEqual({
      allowed: false,
      reason: "NO_ACTOR",
    });
    expect(
      can(null, "resolve_occurrence", { householdHasParent: false, target: cleosOwn }),
    ).toEqual({ allowed: false, reason: "NO_ACTOR" });
  });

  it("orders routines within one's own column only", () => {
    expect(can(member, "reorder_routines", { ...STEADY, target: cleosOwn })).toEqual({
      allowed: true,
    });
    expect(
      can(member, "reorder_routines", { ...STEADY, target: { upForGrabs: false, assigneeId: ANA } }),
    ).toEqual({ allowed: false, reason: "FORBIDDEN" });
  });

  it("keeps the parent-only verbs parent-only however the target reads", () => {
    for (const op of ["manage_tasks", "manage_task_box"] as const) {
      expect(can(member, op, { ...STEADY, target: cleosOwn })).toEqual({
        allowed: false,
        reason: "FORBIDDEN",
      });
      expect(can(parent, op, { ...STEADY, target: cleosOwn })).toEqual({ allowed: true });
    }
  });

  it("ignores a target on an operation that has no record to own", () => {
    expect(can(member, "read", { ...STEADY, target: upForGrabs(ANA) })).toEqual({ allowed: true });
    expect(can(member, "update_settings", { ...STEADY, target: cleosOwn })).toEqual({
      allowed: false,
      reason: "FORBIDDEN",
    });
  });
});

/* ------------------------------------- FR-424: the redemption target (R410) -- */

const PARENT_ONLY_REWARD_OPERATIONS = [
  "reward.create",
  "reward.edit",
  "reward.delete",
  "stars.adjust",
] as const;

const REDEEM_OPERATIONS = ["reward.redeem", "reward.unredeem"] as const;

describe("mayRedeemFor (FR-424, SC-407)", () => {
  const memberCleo = { role: "member" as const, profileId: CLEO };
  const parentAna = { role: "parent" as const, profileId: ANA };

  // SC-407's four checks: a member for themselves, a member for another
  // Profile, a parent for another Profile, and nobody at all.
  it.each([
    { who: "a member for themselves", actor: memberCleo, target: CLEO, expected: true },
    { who: "a member for another Profile", actor: memberCleo, target: ANA, expected: false },
    { who: "a parent for another Profile", actor: parentAna, target: CLEO, expected: true },
    { who: "nobody punched in", actor: null, target: CLEO, expected: false },
  ])("$who → $expected", ({ actor, target, expected }) => {
    expect(mayRedeemFor(actor, target)).toBe(expected);
  });

  it("lets a parent redeem for themselves too", () => {
    expect(mayRedeemFor(parentAna, ANA)).toBe(true);
  });

  it("refuses a member whose identity the caller does not know — a redemption is never anonymous", () => {
    expect(mayRedeemFor({ role: "member" }, CLEO)).toBe(false);
  });
});

describe("can, with a redemption target (FR-424, FR-431, SC-407)", () => {
  const member = { role: "member" as const, profileId: CLEO };
  const parent = { role: "parent" as const, profileId: ANA };

  it.each(REDEEM_OPERATIONS)("%s: a member for themselves, refused for anyone else", (op) => {
    expect(can(member, op, { ...STEADY, redeemFor: CLEO })).toEqual({ allowed: true });
    expect(can(member, op, { ...STEADY, redeemFor: ANA })).toEqual({
      allowed: false,
      reason: "FORBIDDEN",
    });
  });

  it.each(REDEEM_OPERATIONS)("%s: a parent for anyone", (op) => {
    expect(can(parent, op, { ...STEADY, redeemFor: CLEO })).toEqual({ allowed: true });
    expect(can(parent, op, { ...STEADY, redeemFor: ANA })).toEqual({ allowed: true });
  });

  it.each(REDEEM_OPERATIONS)("%s: nobody without an actor, bootstrap or not", (op) => {
    expect(can(null, op, { ...STEADY, redeemFor: CLEO })).toEqual({
      allowed: false,
      reason: "NO_ACTOR",
    });
    expect(can(null, op, { householdHasParent: false, redeemFor: CLEO })).toEqual({
      allowed: false,
      reason: "NO_ACTOR",
    });
  });

  it("refuses a member who names no Profile, and one whose identity is unknown", () => {
    expect(can(member, "reward.redeem", STEADY)).toEqual({ allowed: false, reason: "FORBIDDEN" });
    expect(can({ role: "member" }, "reward.redeem", { ...STEADY, redeemFor: CLEO })).toEqual({
      allowed: false,
      reason: "FORBIDDEN",
    });
  });

  it("does not let an occurrence target stand in for a redemption target", () => {
    expect(can(member, "reward.redeem", { ...STEADY, target: cleosOwn })).toEqual({
      allowed: false,
      reason: "FORBIDDEN",
    });
  });

  it("does not let a redemption target open an occurrence verb", () => {
    expect(can(member, "resolve_occurrence", { ...STEADY, redeemFor: CLEO })).toEqual({
      allowed: false,
      reason: "FORBIDDEN",
    });
  });

  it.each(PARENT_ONLY_REWARD_OPERATIONS)(
    "%s stays parent-only however the target reads (FR-419, FR-435)",
    (op) => {
      expect(can(member, op, { ...STEADY, redeemFor: CLEO })).toEqual({
        allowed: false,
        reason: "FORBIDDEN",
      });
      expect(can(member, op, { ...STEADY, target: cleosOwn })).toEqual({
        allowed: false,
        reason: "FORBIDDEN",
      });
      expect(can(parent, op, STEADY)).toEqual({ allowed: true });
    },
  );
});

type Member = Pick<Category, "id" | "isProfile" | "role">;

const parentA: Member = { id: "a", isProfile: true, role: "parent" };
const parentB: Member = { id: "b", isProfile: true, role: "parent" };
const child: Member = { id: "c", isProfile: true, role: "member" };
const label: Member = { id: "l", isProfile: false, role: "member" };
// The DB CHECK forbids a label with role parent; the permission layer must not
// count one even if it ever showed up.
const rogueLabel: Member = { id: "r", isProfile: false, role: "parent" };

describe("isLastParent", () => {
  it("is true for the only parent profile in the household", () => {
    expect(isLastParent(parentA, [parentA, child, label])).toBe(true);
  });

  it("is true when the list is empty", () => {
    expect(isLastParent(parentA, [])).toBe(true);
  });

  it("is false when another parent profile exists", () => {
    expect(isLastParent(parentA, [parentA, parentB, child])).toBe(false);
    expect(isLastParent(parentB, [parentA, parentB, child])).toBe(false);
  });

  it("ignores labels even if they carry the parent role", () => {
    expect(isLastParent(parentA, [parentA, rogueLabel, label])).toBe(true);
  });

  it("is false for members and labels", () => {
    expect(isLastParent(child, [parentA, child])).toBe(false);
    expect(isLastParent(child, [child])).toBe(false);
    expect(isLastParent(label, [label])).toBe(false);
    expect(isLastParent(rogueLabel, [rogueLabel])).toBe(false);
  });

  it("only looks at OTHER profiles, so the target need not be in the list", () => {
    expect(isLastParent(parentA, [child, label])).toBe(true);
    expect(isLastParent(parentA, [parentB])).toBe(false);
  });

  it("matches the target by id, not by reference", () => {
    const copyOfA: Member = { ...parentA };
    expect(isLastParent(copyOfA, [parentA, child])).toBe(true);
  });
});

describe("canDelete", () => {
  it("refuses to delete the last parent", () => {
    expect(canDelete(parentA, [parentA, child, label])).toEqual({
      allowed: false,
      reason: "LAST_PARENT",
    });
  });

  it("allows deleting a parent when another parent remains", () => {
    expect(canDelete(parentA, [parentA, parentB])).toEqual({ allowed: true });
  });

  it("allows deleting members and labels regardless of parents", () => {
    expect(canDelete(child, [parentA, child])).toEqual({ allowed: true });
    expect(canDelete(child, [child])).toEqual({ allowed: true });
    expect(canDelete(label, [parentA, label])).toEqual({ allowed: true });
  });
});

describe("canChangeRole", () => {
  it("refuses demoting the last parent to member", () => {
    expect(canChangeRole(parentA, "member", [parentA, child])).toEqual({
      allowed: false,
      reason: "LAST_PARENT",
    });
  });

  it("allows demoting a parent when another parent remains", () => {
    expect(canChangeRole(parentA, "member", [parentA, parentB])).toEqual({ allowed: true });
  });

  it("allows keeping the last parent as parent", () => {
    expect(canChangeRole(parentA, "parent", [parentA, child])).toEqual({ allowed: true });
  });

  it("always allows promotion", () => {
    expect(canChangeRole(child, "parent", [parentA, child])).toEqual({ allowed: true });
    expect(canChangeRole(child, "parent", [child])).toEqual({ allowed: true });
  });

  it("allows a member staying a member", () => {
    expect(canChangeRole(child, "member", [child])).toEqual({ allowed: true });
  });
});

describe("bootstrapRole", () => {
  const bootstrap = { householdHasParent: false };
  const steady = { householdHasParent: true };

  it("forces parent while the household has no parent, whatever was asked for", () => {
    expect(bootstrapRole({ role: "member" }, bootstrap)).toBe("parent");
    expect(bootstrapRole({ role: "parent" }, bootstrap)).toBe("parent");
    expect(bootstrapRole({}, bootstrap)).toBe("parent");
  });

  it("honours the requested role once a parent exists", () => {
    expect(bootstrapRole({ role: "member" }, steady)).toBe("member");
    expect(bootstrapRole({ role: "parent" }, steady)).toBe("parent");
  });

  it("defaults to member once a parent exists", () => {
    expect(bootstrapRole({}, steady)).toBe("member");
    expect(bootstrapRole({ role: undefined }, steady)).toBe("member");
  });
});

describe("the two list operations (005 FR-534, FR-535, R505)", () => {
  const member = { role: "member" as const, profileId: CLEO };
  const parent = { role: "parent" as const, profileId: ANA };

  it("list.create is any punched-in Profile's, and nobody's without an actor", () => {
    expect(can(member, "list.create", STEADY)).toEqual({ allowed: true });
    expect(can(parent, "list.create", STEADY)).toEqual({ allowed: true });
    expect(can(null, "list.create", STEADY)).toEqual({ allowed: false, reason: "NO_ACTOR" });
  });

  it("list.write on a plain list is any punched-in Profile's — with or without the flag named", () => {
    expect(can(member, "list.write", STEADY)).toEqual({ allowed: true });
    expect(can(member, "list.write", { ...STEADY, parentsOnly: false })).toEqual({ allowed: true });
    expect(can(parent, "list.write", { ...STEADY, parentsOnly: false })).toEqual({ allowed: true });
  });

  it("list.write on a Parents only list is a parent's alone", () => {
    expect(can(member, "list.write", { ...STEADY, parentsOnly: true })).toEqual({
      allowed: false,
      reason: "FORBIDDEN",
    });
    expect(can(parent, "list.write", { ...STEADY, parentsOnly: true })).toEqual({ allowed: true });
    expect(can(null, "list.write", { ...STEADY, parentsOnly: true })).toEqual({
      allowed: false,
      reason: "NO_ACTOR",
    });
  });

  it("does not let a list flag open any other verb, nor the other targets open a list verb", () => {
    expect(can(member, "reward.create", { ...STEADY, parentsOnly: false })).toEqual({
      allowed: false,
      reason: "FORBIDDEN",
    });
    expect(can(member, "manage_tasks", { ...STEADY, parentsOnly: false })).toEqual({
      allowed: false,
      reason: "FORBIDDEN",
    });
  });
});

describe("006 FR-639 / FR-640 — meals, recipes and mealtimes", () => {
  const parent: PermissionActor = { role: "parent", profileId: "a" };
  const member: PermissionActor = { role: "member", profileId: "c" };

  it("meal.write and recipe.write are any punched-in Profile's, and nobody's without an actor", () => {
    for (const op of ["meal.write", "recipe.write"] as const) {
      expect(can(member, op, STEADY), op).toEqual({ allowed: true });
      expect(can(parent, op, STEADY), op).toEqual({ allowed: true });
      expect(can(null, op, STEADY), op).toEqual({ allowed: false, reason: "NO_ACTOR" });
    }
  });

  it("mealtime.edit is a parent's alone", () => {
    expect(can(parent, "mealtime.edit", STEADY)).toEqual({ allowed: true });
    expect(can(member, "mealtime.edit", STEADY)).toEqual({ allowed: false, reason: "FORBIDDEN" });
    expect(can(null, "mealtime.edit", STEADY)).toEqual({ allowed: false, reason: "NO_ACTOR" });
  });
});
