"use client";

import { useState } from "react";

import { Avatar } from "./Avatar";
import { DialogClose } from "./DialogClose";
import { useFamily } from "./FamilyProvider";
import { useModalDialog } from "./useModalDialog";

/**
 * Who is punched in, and the way out (FR-013). Renders nothing when the shell
 * is in its shared, read-only state — which is most of the time.
 *
 * **014 turned it from a pill into a face.** It was `● Ana  Punch out`: a wide
 * grey pill that was the largest object in the top bar and repeated, as text,
 * the identity the chip row already draws one line below. The operator: *"kinda
 * strange to put it up at the top when we already have this profile icon bar …
 * maybe we could just style it better"*.
 *
 * **Why it stays in the top bar** rather than hanging off the punched-in
 * person's chip, which is the nicer idea: the chip row is only on Calendar and
 * Settings. Tasks, Rewards, Meals and Lists each decline it (FR-314, 004 R409,
 * 005 Assumption 12), so a control living there would be unreachable on four of
 * six tabs — and punching out has to work from wherever you are.
 *
 * So: their face, in the same circle as Filter and the nav arrows, ringed in
 * their own colour so a glance says who is in without reading anything. The
 * name and the way out are one tap away rather than permanently on screen.
 *
 * **It is a dialog, not a bare popover**, which buys the shell's own idiom for
 * free: Escape, the focus trap, a click outside to dismiss, and the X — all of
 * it already shared, none of it re-implemented here.
 */
export function ActorBadge() {
  const { actor, profiles, avatarUrls, punchOut } = useFamily();
  const [open, setOpen] = useState(false);
  const dialogRef = useModalDialog(open);

  if (!actor) return null;

  // The session carries a colour and a label; the FACE lives on the category.
  const profile = profiles.find((candidate) => candidate.id === actor.profileId);

  return (
    <>
      <button
        type="button"
        aria-label={`Punched in as ${actor.label}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="fam-glyph-btn grid h-(--fam-touch) w-(--fam-touch) shrink-0 place-items-center rounded-full"
      >
        {profile === undefined ? (
          // A punched-in profile that is not in the list is possible for one
          // render after somebody deletes it elsewhere. A dot beats a crash.
          <span
            aria-hidden="true"
            style={{ backgroundColor: actor.color }}
            className="h-6 w-6 rounded-full"
          />
        ) : (
          // 40px of face plus the 2px `fam-ring` on each side is a 44px
          // circle — the same disc as the Filter button beside it, so the two
          // read as one pair rather than a big control and a small one. The
          // button itself was always --fam-touch; it was the FACE inside it
          // that was smaller, which is what showed.
          <Avatar
            category={profile}
            size={40}
            photoUrl={avatarUrls[profile.id]}
            ring
            sizeClassName="h-10 w-10"
          />
        )}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="actor-badge-title"
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        className="m-auto w-[min(92vw,20rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
      >
        <DialogClose onClose={() => setOpen(false)} />
        <h2
          id="actor-badge-title"
          className="pr-(--fam-touch) font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)"
        >
          {actor.label}
        </h2>
        <p className="mt-1 text-(length:--fam-fs-body) text-(--fam-text-secondary)">
          Punched in on this device.
        </p>
        <button
          type="button"
          // AWAIT the punch-out, then close. Three orderings were tried and
          // only this one holds on every project: closing first re-rendered
          // before the action was dispatched, and fire-and-forget left the
          // badge up on the wall. Awaiting means the panel is still on screen
          // while the write is in flight — which is also the honest signal
          // that something is happening.
          onClick={async () => {
            await punchOut();
            setOpen(false);
          }}
          className="mt-4 min-h-(--fam-touch) w-full rounded-full bg-(--fam-pill-btn-bg) px-5 text-(length:--fam-fs-body) font-medium text-(--fam-text-primary)"
        >
          Punch out
        </button>
      </dialog>
    </>
  );
}
