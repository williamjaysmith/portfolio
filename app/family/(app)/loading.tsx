/**
 * What a tab shows while the next one is being fetched.
 *
 * **The gap this fills.** Every `/family` route is dynamic: a tab click cannot
 * be answered without a server render — `requireMember`'s `my_household` RPC,
 * then the household reads, then the tab's own, two to three serial round trips
 * to Supabase — and until this file existed there was **no loading boundary
 * anywhere in the app**, so Next kept the OLD tab on screen for the whole trip.
 * The operator's report, and it was exactly right: *"it feels very slow and not
 * performant when I click tabs… like a 1 second lag after clicking"*. Nothing
 * moved, so as far as anyone could tell nothing had happened.
 *
 * **This does not make the fetch faster. It makes the tap answered.** Those are
 * different problems, and this is the one that made the app feel broken: a
 * control that does nothing for a second reads as a missed tap, and the
 * household taps it again.
 *
 * It sits at the `(app)` group so one file covers all six tabs. The shell — the
 * nav, the top bar, the Profile chips — is the shared layout and is NOT
 * re-rendered by a tab change, so what the household sees is the chrome holding
 * still with the body marked as pending. That is also why this stays plain:
 * anything that guessed at the shape of the incoming tab would flash the wrong
 * furniture, which is worse than an honest gap.
 *
 * **Under `prefers-reduced-motion` the ring does not spin** — it is drawn
 * static, which still reads as "working" without animating. FR-252's rule, which
 * this project applies to every animation it draws.
 */
export default function TabLoading() {
  return (
    <div
      // `absolute inset-0` rather than `flex-1`: the shell's `<main>` is a flex
      // CHILD that stretches, but it is not a flex CONTAINER, so `flex-1` here
      // resolved to nothing and the spinner sat at the top of the tab. `main`
      // carries `relative` for exactly this, so filling it is what centres.
      className="absolute inset-0 flex items-center justify-center p-(--fam-edge-inset)"
      // Polite, so a screen reader is told the tab is coming rather than being
      // left reading the previous one as though it were still current.
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading</span>
      <span
        aria-hidden="true"
        className="size-8 rounded-full border-2 border-(--fam-hairline) border-t-(--fam-text-muted) motion-safe:animate-spin"
      />
    </div>
  );
}
