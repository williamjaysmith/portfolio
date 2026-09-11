"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * How a tab puts its search box in the shell's top bar.
 *
 * **Why it moved there.** The search shared the ‹ Today › row with the view
 * switcher and the arrows, and on an iPhone SE those five controls do not fit:
 * the row wrapped and the Day/Week/Month switcher went off the bottom of it —
 * the operator could not reach it at all. The top bar had a whole line to
 * itself carrying the time, and a phone and a tablet both already show a clock
 * of their own: *"i cant see the day/week/month toggle on calendar view … so i
 * wonder if we could put the search bar where we currently have the time on the
 * top left … we dont need the time because these devices already have a
 * clock"*. So the bar gives up the clock and takes the search, and the nav row
 * gets that width back.
 *
 * **A PORTAL, not a registry** — and the difference matters. `FabAction` next
 * door registers a `{label, run}` and is careful to read `run` through a ref,
 * because re-registering on every render would re-render the provider, which
 * re-renders the page, which registers again. A search box is not a value but a
 * subtree with its own state and its own handlers, and handing one to a
 * provider hits that loop immediately with nothing to hold steady in a ref. A
 * portal sidesteps it: the page keeps ownership of the element and React just
 * puts it somewhere else in the tree.
 *
 * That also keeps the search box's state where it belongs. It stays mounted
 * inside the page that owns the query, so paging, filtering and the results
 * list all behave exactly as they did when it sat in the nav row — nothing
 * about the search MOVED except where it is painted.
 *
 * With no page registering one, the slot renders an empty box and the bar is
 * the badges alone.
 */

interface SlotRegistry {
  /** Is there a shell at all? False only for the default context. */
  shelled: boolean;
  node: HTMLElement | null;
  setNode: (node: HTMLElement | null) => void;
}

const TopBarSearchContext = createContext<SlotRegistry>({
  shelled: false,
  node: null,
  setNode: () => {
    // No shell, nothing to register with.
  },
});

export function TopBarSearchProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const value = useMemo<SlotRegistry>(() => ({ shelled: true, node, setNode }), [node]);
  return <TopBarSearchContext.Provider value={value}>{children}</TopBarSearchContext.Provider>;
}

/** The target, rendered once by `TopBar`. */
export function TopBarSearchSlot({ className }: { className?: string }) {
  const { setNode } = useContext(TopBarSearchContext);
  return <div ref={setNode} className={className} />;
}

/**
 * Paint a page's search into the bar, for as long as that page is mounted.
 *
 * **Outside the shell it renders where it stands.** A board rendered on its own
 * — a component test, a preview — has no top bar to portal into, and a search
 * that silently disappears there is a control the page no longer has. Falling
 * back to rendering in place keeps the page whole wherever it is used.
 *
 * `shelled` is what separates that from the one frame INSIDE the shell before
 * the slot's ref has been set. Both have a null node; only one of them wants
 * the fallback. Using the null alone would flash the search into the nav row
 * and then move it to the bar on the very next commit.
 */
export function TopBarSearch({ children }: { children: ReactNode }) {
  const { shelled, node } = useContext(TopBarSearchContext);
  if (!shelled) return <>{children}</>;
  return node === null ? null : createPortal(children, node);
}
