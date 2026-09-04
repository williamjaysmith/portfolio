"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * How a tab hands the shell's one create control something to do (FR-034).
 *
 * The FAB lives in `AppShell`, above every page, so no page can render it —
 * instead a page that can create registers its opener here for as long as it
 * is mounted, and the FAB runs whatever is registered. The Week calendar
 * registers "Add event" (FR-254's primary create control). With nothing
 * registered the FAB keeps its Phase 1 placeholder, naming the phase that
 * brings the tab's creation.
 *
 * The default context is a no-op registry, so the FAB and any page render
 * correctly outside the shell (tests, previews) without a provider.
 */

export interface FabAction {
  /** The control's accessible name — "Add event". */
  label: string;
  run: () => void;
}

interface FabRegistry {
  action: FabAction | null;
  register: (action: FabAction | null) => void;
}

const FabActionContext = createContext<FabRegistry>({
  action: null,
  register: () => {
    // Nothing to register with outside the shell.
  },
});

export function FabActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<FabAction | null>(null);
  const value = useMemo<FabRegistry>(() => ({ action, register: setAction }), [action]);
  return <FabActionContext.Provider value={value}>{children}</FabActionContext.Provider>;
}

/** What the FAB should do on this tab right now — `null` keeps the placeholder. */
export function useFabAction(): FabAction | null {
  return useContext(FabActionContext).action;
}

/**
 * Register a page's create opener while the page is mounted.
 *
 * The registration is keyed on the label alone; `run` is read through a ref
 * at press time, so a page may hand over a fresh function every render
 * without re-registering every render — which, since registering re-renders
 * the provider and so the page, would otherwise loop without end.
 */
export function useRegisterFabAction(label: string, run: () => void): void {
  const { register } = useContext(FabActionContext);
  const latestRun = useRef(run);

  useEffect(() => {
    latestRun.current = run;
  });

  useEffect(() => {
    register({ label, run: () => latestRun.current() });
    return () => register(null);
  }, [label, register]);
}
