"use client";

import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";

import { signAvatarUrls } from "@/lib/family/actions/avatars";
import type { ActionResult } from "@/lib/family/errors";
import { familyKeys, useCategories, useHousehold, useSettings } from "@/lib/family/queries";
import type { ActorSession, Category, Household, HouseholdSettings } from "@/lib/family/types";

import { PunchInSheet } from "./PunchInSheet";
import { useActorSession } from "./useActorSession";
import { useDeviceVisibility } from "./useDeviceVisibility";
import { useFamilyRealtime } from "./useFamilyRealtime";
import { usePunchInPrompt } from "./usePunchInPrompt";

/**
 * The shell's shared state: household data, who is punched in, and the
 * `withActor` interceptor every mutating control goes through.
 */

const AVATAR_URL_STALE_MS = 50 * 60 * 1000;

export interface FamilyInitialData {
  householdId: string;
  household: Household;
  settings: HouseholdSettings;
  categories: Category[];
  actor: ActorSession | null;
  userEmail: string | null;
}

export interface FamilyContextValue {
  householdId: string;
  household: Household;
  settings: HouseholdSettings;
  categories: Category[];
  profiles: Category[];
  labels: Category[];
  userEmail: string | null;
  actor: ActorSession | null;
  isParent: boolean;
  /** Run a mutation, prompting for a punch-in when one is needed. */
  withActor: <T>(run: () => Promise<ActionResult<T>>) => Promise<ActionResult<T>>;
  openPunchIn: () => Promise<ActorSession | null>;
  punchOut: () => Promise<void>;
  /** Refetch household data after a mutation that did not go through `withActor`. */
  refresh: () => void;
  hiddenIds: ReadonlySet<string>;
  setHidden: (id: string, hidden: boolean) => void;
  showAll: () => void;
  visibilityPersists: boolean;
  visibleProfiles: Category[];
  avatarUrls: Record<string, string>;
}

export const FamilyContext = createContext<FamilyContextValue | null>(null);

export function useFamily(): FamilyContextValue {
  const value = useContext(FamilyContext);
  if (!value) throw new Error("useFamily must be used inside <FamilyProvider>");
  return value;
}

/**
 * One QueryClient per browser tab. A `useState` initialiser would be discarded
 * if React suspended above the provider, silently emptying the cache.
 */
let browserQueryClient: QueryClient | undefined;

function newQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  });
}

function getQueryClient(): QueryClient {
  // A module-level singleton is right in the browser and wrong on the server,
  // where the module is shared by every request: one household's cache would
  // be handed to the next render. On the server each request gets its own.
  if (typeof window === "undefined") return newQueryClient();
  browserQueryClient ??= newQueryClient();
  return browserQueryClient;
}

export function FamilyProvider({
  initial,
  children,
}: {
  initial: FamilyInitialData;
  children: ReactNode;
}) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <FamilyStore initial={initial}>{children}</FamilyStore>
    </QueryClientProvider>
  );
}

/** Signed URLs for photo avatars, refreshed comfortably inside their hour. */
function useAvatarUrls(householdId: string, profiles: Category[]): Record<string, string> {
  const photoIds = useMemo(
    () => profiles.filter((profile) => profile.avatarKind === "photo").map((profile) => profile.id),
    [profiles],
  );

  const query = useQuery({
    queryKey: [...familyKeys.avatarUrls(householdId), photoIds.join(",")],
    queryFn: async () => {
      const result = await signAvatarUrls(photoIds);
      return result.ok ? result.data : {};
    },
    enabled: photoIds.length > 0,
    staleTime: AVATAR_URL_STALE_MS,
  });

  const data = query.data;
  return useMemo(() => data ?? {}, [data]);
}

/**
 * Live household data, seeded from what the server already rendered so the
 * first paint has no loading state and no flicker.
 */
function useHouseholdData(initial: FamilyInitialData) {
  const { householdId } = initial;
  const categories = useCategories(householdId, initial.categories).data ?? initial.categories;
  const settings = useSettings(householdId, initial.settings).data ?? initial.settings;
  const household = useHousehold(householdId, initial.household).data ?? initial.household;

  const profiles = useMemo(() => categories.filter((c) => c.isProfile), [categories]);
  const labels = useMemo(() => categories.filter((c) => !c.isProfile), [categories]);

  return { householdId, categories, settings, household, profiles, labels };
}

function FamilyStore({ initial, children }: { initial: FamilyInitialData; children: ReactNode }) {
  const queryClient = useQueryClient();
  const { householdId, categories, settings, household, profiles, labels } =
    useHouseholdData(initial);

  const { actor, setActor, extend, punchOut } = useActorSession(initial.actor);
  const { hiddenIds, setHidden, showAll, pruneTo, persistent } = useDeviceVisibility();
  const avatarUrls = useAvatarUrls(householdId, categories);
  useFamilyRealtime(householdId);

  const visibleProfiles = useMemo(
    () => profiles.filter((profile) => !hiddenIds.has(profile.id)),
    [profiles, hiddenIds],
  );

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: familyKeys.all });
  }, [queryClient]);

  // Every successful change refreshes the household and pushes the idle
  // expiry forward, so working through a list never punches you out.
  const onMutationSuccess = useCallback(() => {
    void extend(true);
    refresh();
  }, [extend, refresh]);

  const { sheetOpen, openPunchIn, resolveSheet, withActor } = usePunchInPrompt({
    actor,
    setActor,
    onSuccess: onMutationSuccess,
  });

  // A deleted profile must not stay hidden on this device forever.
  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories]);
  useEffect(() => {
    pruneTo(categoryIds);
  }, [categoryIds, pruneTo]);

  const value = useMemo<FamilyContextValue>(
    () => ({
      householdId,
      household,
      settings,
      categories,
      profiles,
      labels,
      userEmail: initial.userEmail,
      actor,
      isParent: actor?.role === "parent",
      withActor,
      openPunchIn,
      punchOut,
      refresh,
      hiddenIds,
      setHidden,
      showAll,
      visibilityPersists: persistent,
      visibleProfiles,
      avatarUrls,
    }),
    [
      householdId,
      household,
      settings,
      categories,
      profiles,
      labels,
      initial.userEmail,
      actor,
      withActor,
      openPunchIn,
      punchOut,
      refresh,
      hiddenIds,
      setHidden,
      showAll,
      persistent,
      visibleProfiles,
      avatarUrls,
    ],
  );

  return (
    <FamilyContext.Provider value={value}>
      {children}
      <PunchInSheet
        open={sheetOpen}
        profiles={profiles}
        avatarUrls={avatarUrls}
        onResolve={resolveSheet}
      />
    </FamilyContext.Provider>
  );
}
