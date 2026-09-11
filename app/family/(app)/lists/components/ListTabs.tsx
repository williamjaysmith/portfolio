"use client";

import type { CSSProperties } from "react";

import { profileVars } from "@/lib/family/colors";
import type { List } from "@/lib/family/types";

/**
 * The row of list names above the cards, for the widths where only one card is
 * on screen (the operator's ask: *"on mobile, in order to know what other lists
 * exist, above the current list we could put buttons to navigate to the
 * available lists — just a simple row which can scroll horizontal as needed,
 * otherwise its aligned center"*).
 *
 * **It exists because paging is invisible.** A phone shows one card and the
 * rest are reachable only by swiping, so a reader who has not already swiped
 * has no way to know a second list exists — the board looks like a board with
 * one list on it. The Tasks and Rewards boards have the same shape and do not
 * have this problem: their columns are PEOPLE, and the shell's chip row names
 * everyone before you reach the tab.
 *
 * **Only while cards are actually withheld.** `ListsBoard` draws this on
 * `page.paged`, which is false the moment every card fits — on the wall tablet
 * the names are already on the cards, and a second copy of them would be the
 * duplication the profile chips were just rescued from.
 *
 * **Centred when it fits, scrolling when it does not**, which is one rule
 * rather than two: the inner row is `w-max` (its natural width) and `mx-auto`.
 * Under the scroller's width, `mx-auto` centres it; over, the margins collapse
 * and it scrolls. `justify-center` on the scroller itself is the obvious
 * alternative and is a known trap — it centres the overflow too, and the first
 * item becomes unreachable off the left edge.
 *
 * **Not a `tablist`.** The cards are not tab panels — they are all rendered,
 * and a swipe moves between them independently of this row — so claiming the
 * role would promise arrow-key semantics this does not implement. A row of
 * buttons with `aria-current` on the one showing is what is actually true.
 */

const TAB =
  "fam-profile flex min-h-(--fam-touch) items-center justify-center gap-2 rounded-full px-4 " +
  "text-(length:--fam-fs-pill) whitespace-nowrap text-(--fam-text-primary)";

/**
 * The current tab wears its list's own 40 % tint — the same fill the card below
 * it has, so the two read as one thing — and the rest take the neutral pill.
 *
 * Chosen in JS rather than as an `aria-[current]:` variant, and that is not a
 * style preference: `fam-tint-40` is a hand-written class in `tokens.css`, not
 * a Tailwind utility, so a variant prefix on it compiles to nothing at all. It
 * did, silently, and the active tab came out unfilled.
 */
function toneOf(current: boolean): string {
  return current ? "fam-tint-40 font-semibold" : "bg-(--fam-pill-btn-bg) font-medium";
}

export interface ListTabsProps {
  lists: readonly List[];
  /** The index of the card currently on screen — the page's own `start`. */
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function ListTabs({ lists, activeIndex, onSelect }: ListTabsProps) {
  if (lists.length < 2) return null;

  return (
    <nav
      aria-label="Lists"
      // The scroller is the thing that scrolls; `pb-1` keeps a focus ring from
      // being clipped by its own overflow.
      className="shrink-0 overflow-x-auto px-(--fam-edge-inset) pb-1"
    >
      <ul className="mx-auto flex w-max items-center gap-2">
        {lists.map((list, index) => (
          <li key={list.id}>
            <button
              type="button"
              // `aria-current="true"`, not `aria-selected`: this is "the one you
              // are looking at", which is exactly what current means, and it is
              // also what the styling above hangs off.
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => onSelect(index)}
              style={profileVars(list.color) as CSSProperties}
              className={`${TAB} ${toneOf(index === activeIndex)}`}
            >
              {/* The list's colour, so the row reads as the same set of things
                  the cards below it are. Decoration: the name is right there. */}
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full bg-(--fam-profile-100)"
              />
              {list.name}
              {/* An empty twin of the dot, on the other side.
                  `justify-center` centres the dot AND the name as one group, so
                  the NAME itself sat half a dot plus half a gap off centre —
                  measured at 8px on every tab, which is exactly that. Balancing
                  the row with a spacer of the dot's own size puts the name on
                  the button's centre line without moving the dot. */}
              <span aria-hidden="true" className="size-2 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
