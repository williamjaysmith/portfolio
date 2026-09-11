"use client";

import { Lock } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useFamily } from "../FamilyProvider";

/**
 * The door on the Settings tab: a parent has to be punched in before the screen
 * is drawn at all.
 *
 * **This reverses a shipped decision, deliberately.** `SettingsScreen` used to
 * say, in its own docstring, that the screen "is readable by anyone signed in —
 * hiding it would hide household content, which FR-008 says is free to view",
 * and that parents-only applied to the controls rather than the page. FR-350
 * says the same thing more strongly: do not hide controls as the enforcement
 * mechanism. The operator's call, about their own household: *"i feel like my
 * daughter doesnt need to get into the settings tab — so maybe that could be
 * gated prior to getting in, rather than on a selection"*.
 *
 * **It is a door, not a lock, and the difference matters.** Nothing here
 * protects data: the rows behind this screen are readable by anything holding
 * the household session, and a determined reader can simply ask the API. What
 * enforces "parents only" is what always did — the server, through RLS and the
 * actions' own actor checks — and none of that changed. This stops somebody
 * WANDERING in, which is the actual problem being reported: a child who taps
 * Settings out of curiosity and starts changing PINs.
 *
 * **The tab stays in the nav.** Removing it would be the other reading of the
 * ask, and a worse one: a control that vanishes for some people is a control
 * nobody can learn, and a parent on a device where a child is punched in would
 * have no way back in. The tab is reachable, and the door asks who you are.
 *
 * **A member who is already punched in is offered the sheet anyway**, because
 * `openPunchIn` always opens it — so a parent standing beside their child takes
 * the device, taps once and enters, rather than having to punch the child out
 * first.
 *
 * **It stands aside entirely until a parent HOLDS a PIN, and it has to.** PINs
 * are set in Settings, and punching in requires one — so a gate that asked for
 * a parent before any parent had a PIN would lock the household out of its own
 * settings permanently, with no way back in short of the database. That is not
 * a hypothetical: it is the state every fresh household and every `db reset`
 * starts in. `lib/family/actions/pins.ts` already draws this exact line
 * server-side and calls it the no-lockout rule — *"no parent has a PIN yet → a
 * signed-in member may set one, no actor needed"* — and this mirrors it rather
 * than inventing a second one that could disagree.
 *
 * **That bypass LATCHES, and it latches on the first KNOWN answer — not the
 * first render.** Two bugs live here and the browser pass found both.
 *
 * Without a latch, setting the first PIN threw the person out of Settings at
 * the exact moment they used it: they typed a PIN, saved, `has_pin` flipped,
 * this re-rendered and replaced the form they were standing in with a door they
 * could not open — they had just made the first PIN and were not punched in.
 *
 * Latching at MOUNT was worse, and quietly so. On a full page load the
 * household's profiles have not arrived on the first client render, so the list
 * is empty, "no parent has a PIN" is vacuously true, and the gate latched open
 * for the rest of the session — for everyone, including the child it exists
 * for. It let a punched-in MEMBER into the whole screen, which is the one thing
 * it is supposed to prevent.
 *
 * So the question is asked only once there are profiles to ask it of, and the
 * answer is kept from then on. Before that this returns the door, which is the
 * safe direction to be wrong in: a parent gets one extra tap, where the other
 * way round the gate is not a gate.
 */
export function SettingsGate({ children }: { children: ReactNode }) {
  const { actor, openPunchIn, profiles } = useFamily();

  // `null` until the household is loaded enough to answer, then fixed. Set
  // during render on purpose — React's own "adjusting state when props change"
  // pattern: the setter on THIS component re-renders before anything is
  // committed, so there is no flash and no effect to sequence. A ref would read
  // more naturally and is not allowed to be read during render (and the lint
  // rule that says so is right — a ref cannot make this re-render).
  const [arrivedBeforeAnyPin, setArrivedBeforeAnyPin] = useState<boolean | null>(null);
  if (arrivedBeforeAnyPin === null && profiles.length > 0) {
    setArrivedBeforeAnyPin(!profiles.some((profile) => profile.role === "parent" && profile.hasPin));
  }

  if (actor?.role === "parent") return <>{children}</>;
  if (arrivedBeforeAnyPin === true) return <>{children}</>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 p-(--fam-edge-inset) pt-16 text-center">
      <span
        aria-hidden="true"
        className="grid size-16 place-items-center rounded-full bg-(--fam-pill-btn-bg) text-(--fam-text-muted)"
      >
        <Lock size={28} strokeWidth={1.5} />
      </span>
      <h2 className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)">
        Settings is for parents
      </h2>
      <p className="max-w-sm text-(length:--fam-fs-body) text-(--fam-text-secondary)">
        {actor === null
          ? "Punch in as a parent to change how the family calendar works."
          : `${actor.label} is punched in. Punch in as a parent to change how the family calendar works.`}
      </p>
      <button
        type="button"
        onClick={() => void openPunchIn()}
        className="mt-2 min-h-(--fam-touch) rounded-full bg-(--fam-pill-btn-bg) px-6 text-(length:--fam-fs-body) font-medium text-(--fam-text-primary)"
      >
        Punch in
      </button>
    </div>
  );
}
