"use client";

import { X } from "lucide-react";

/**
 * The quick way out of any modal (014, the operator's ask: "every modal type
 * pop up … should have a quick exit x at the top right for canceling").
 *
 * It is a component and not a line of markup in each dialog because there are
 * twenty-eight of them: an X drawn per dialog drifts in position, size and
 * accessible name, which is the same drift that gave three tabs three different
 * ‹ Today › clusters.
 *
 * **Position.** `absolute` against the `<dialog>` itself — a modal dialog is
 * positioned by the UA, so it is already the containing block and no `relative`
 * is needed on the caller. It sits inside the shipped `p-6` inset so it never
 * covers the title beside it.
 *
 * **It cancels, it does not confirm.** Every caller passes the same function
 * its `onCancel` runs, so the X, Escape and a click outside are one behaviour
 * with three triggers. A dialog whose close SAVES must not pass a save here.
 *
 * **Named "Dismiss", not "Close", and that is deliberate.** The glyph is
 * `aria-hidden`, so `aria-label` is this button's only accessible name — and
 * most of these dialogs already ship a footer button whose visible word is
 * "Close". Two controls with one name is ambiguous to a screen reader before it
 * is ambiguous to a test, and the suite caught it as "Found multiple elements
 * with the role button and name Close" in eighteen places. The footer keeps the
 * deliberate exit; this is the quick one.
 *
 * **No circle and no ring.** It has no background, and `fam-glyph-btn`
 * suppresses the global 3px blue focus outline — at a 2px offset on a round
 * button that outline IS a blue circle, and it is the only thing the operator
 * saw. Focus darkens the glyph instead, which is all this control has to show.
 */
export function DialogClose({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Dismiss"
      onClick={onClose}
      // `min-h`/`min-w` rather than `h`/`w`: 44 is a FLOOR, which is what
      // FR-445 asserts of every control in these dialogs, and a fixed height
      // quietly failed that guarantee for this one.
      className="fam-glyph-btn absolute right-4 top-4 grid min-h-(--fam-touch) min-w-(--fam-touch) place-items-center text-(--fam-text-muted)"
    >
      <X aria-hidden="true" size={20} strokeWidth={1.5} />
    </button>
  );
}
