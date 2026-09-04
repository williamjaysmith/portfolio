import { describe, it, expect } from "vitest";
import type { Category, Role } from "@/lib/family/types";
import {
  type Decision,
  type Operation,
  type PermissionContext,
  bootstrapRole,
  can,
  canChangeRole,
  canDelete,
  isLastParent,
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
    expect(CASES).toHaveLength(10 * 3 * 2);
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
    for (const op of ["reorder_categories", "delete_category", "upload_avatar", "update_settings", "clear_pin"] as const) {
      expect(can(null, op, bootstrap)).toEqual({ allowed: false, reason: "NO_ACTOR" });
    }
  });
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
