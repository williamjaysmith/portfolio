import type { ReactNode } from "react";

import { PALETTE } from "@/lib/family/colors";
import type { ActorSession, Category, Household, HouseholdSettings, Role } from "@/lib/family/types";

import { FamilyContext, type FamilyContextValue } from "../FamilyProvider";

/**
 * Test scaffolding for components that read the family context.
 *
 * Tests stub the context rather than mounting the real provider: the provider
 * owns network, Realtime and timers, none of which belong in a unit test of a
 * chip or a picker.
 */

export function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: overrides.id ?? "category-1",
    householdId: "household-1",
    label: "Alex",
    color: PALETTE[13],
    isProfile: true,
    avatarKind: null,
    avatarId: null,
    avatarPath: null,
    birthday: null,
    dietaryPrefs: null,
    role: "parent",
    userId: null,
    emoji: null,
    showOnTasks: true,
    sortOrder: 1000,
    hasPin: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeSettings(overrides: Partial<HouseholdSettings> = {}): HouseholdSettings {
  return {
    householdId: "household-1",
    showNameNotDate: true,
    timeFormat: "12h",
    startWeekOn: 0,
    punchOutMinutes: 3,
    textSize: "medium",
    density: "roomy",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: "household-1",
    name: "Our Family",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeActor(role: Role = "parent", overrides: Partial<ActorSession> = {}): ActorSession {
  return {
    profileId: "category-1",
    label: "Alex",
    color: PALETTE[13],
    role,
    expiresAt: new Date("2026-01-01T00:03:00.000Z").toISOString(),
    ttlSeconds: 180,
    ...overrides,
  };
}

export function makeContext(overrides: Partial<FamilyContextValue> = {}): FamilyContextValue {
  const categories = overrides.categories ?? [];
  const profiles = categories.filter((category) => category.isProfile);

  return {
    householdId: "household-1",
    household: makeHousehold(),
    settings: makeSettings(),
    categories,
    profiles,
    labels: categories.filter((category) => !category.isProfile),
    userEmail: "parent@example.com",
    actor: null,
    isParent: false,
    withActor: async (run) => run(),
    openPunchIn: async () => null,
    punchOut: async () => {},
    refresh: () => {},
    hiddenIds: new Set<string>(),
    setHidden: () => {},
    showAll: () => {},
    visibilityPersists: true,
    visibleProfiles: profiles,
    avatarUrls: {},
    ...overrides,
  };
}

export function withFamily(value: FamilyContextValue, children: ReactNode) {
  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

/** jsdom implements `<dialog>` but not its modal methods. */
export function stubDialog(): void {
  if (typeof HTMLDialogElement === "undefined") return;
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
}
