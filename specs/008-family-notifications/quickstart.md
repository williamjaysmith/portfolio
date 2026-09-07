# Quickstart — 008 Family Notifications

Setting the phase up locally, the one step the operator takes on the hosted project, how to see each
guarantee for yourself, and what to do when a reminder does not appear.

---

## 0. What this phase is, before you run anything

Everything here happens inside a browser with `/family` open. There is no sender, no schedule and no
device registry: a reminder is computed by the pages that are looking, and appears on those pages
only. A moment that passes with every tab closed is simply missed. That is a deliberate property of
the design, stated in the spec and stated to the household in Settings, not a gap waiting to be
filled.

Two things follow, and they are worth knowing before you try to verify anything:

- **The banner does not read whichever tab you are on.** It mounts in the app shell and keeps a small
  query of its own — the household's events and timed chore occurrences across the reminder horizon
  (R802). It has to: on the Lists or Meals tab the calendar's data is not loaded at all, and a lead
  time of up to seven days can be owed for an event no visible window contains.
- **"Shown once" is this browser's memory.** The dismissed keys are a Set in `localStorage` on the
  device (R813, FR-816). Clearing site data, a private window or a second browser profile forgets
  them, and a reminder still inside its freshness window will show again; two tabs each keep their
  own set and each show their own banner.

There are **no secrets and no environment variables** in this phase.

## 1. Local setup

```bash
supabase start                      # this repository's stack, on 553xx
supabase db reset                   # applies 034 and 035 with everything before them
npm run family:seed -- --local
npm run dev:local
```

Sign in as `dev@family.local` with `family-dev-password`, then **set the PINs in Settings** — Ana
`1234`, Cleo `2468`. The seed never sets a PIN, and every write in this phase needs a punch-in.

There is nothing to trigger. Leave a page open across a reminder's moment and the banner arrives on
its own, because the page is what computes it. To see one without waiting, create an event a few
minutes out and give it a lead time that puts its moment inside the next minute — the shell's clock
publishes on the minute, so that is the resolution to expect.

To see a reminder a second time while testing, clear the site's storage or open a private window. It
is the same forgetting the household would experience, so use it deliberately rather than being
surprised by it.

## 2. The operator's one step on the hosted project

**Push the migrations, before the branch is merged or deployed (R818):**

```bash
supabase db push          # 034 and 035
```

The client names the new columns in `SETTINGS_COLUMNS` and `EVENT_COLUMNS`, so a deployment that
reaches a database without them makes the settings read and the calendar read fail. This is narrower
than the ordering rule has been in earlier phases — nothing new joins the realtime publication, so
the shared channel is not at risk — but Settings and the calendar are enough to want the migration
first. The rule has held since Phase 2; it holds here.

That is the whole of the hosted work. No extensions, no scheduler, no environment variables, and
nothing to install on anybody's phone.

## 3. Verifying the guarantees

Each success criterion, and how to see it.

| Criterion | How to check it |
|---|---|
| **SC-801** four choices, two groups, the stated defaults | A fresh `supabase db reset`, then open Settings → Notifications and read it, including the line telling the household that reminders appear on screens that are open |
| **SC-802** a banner within a minute of its moment | Create an event twelve minutes out, leave a page open, watch it arrive at the ten-minute mark |
| **SC-803** one banner, not several | Two events at the same time. One banner naming both |
| **SC-804** once per device | Leave one page open across the moment: one banner. Dismiss it and reload — it stays gone, because the key is in this browser's storage. A private window is a different device and will show it again; that is the honest limit of the guarantee |
| **SC-805** nothing older than fifteen minutes | Set a reminder and leave the device asleep, or every tab closed, across its moment. Open the app an hour later: nothing from an hour ago appears. Only a moment inside the last fifteen minutes still shows |
| **SC-806** an override survives a default change | One event set to two hours, one left inheriting; change the household to 30 minutes; reload; check both |
| **SC-807** the three scopes | A weekly event; change its reminder at each scope; check the occurrence before and after the changed one, across two weeks |
| **SC-808** timed chores only, and once | Practice piano (timed), an anytime chore, a routine, and a chore left to carry forward overnight |
| **SC-809** a completion within a minute | Tick a task with **When Completed** on, in one browser, with a second browser open on any tab: the second banners who finished what, the first does not — it is looking at the card that just flipped. Then turn the setting off and tick another |
| **SC-810** silence about stars | Award, redeem, break a streak, finish a week. No banner appears anywhere |
| **SC-813** deleted, skipped, moved | Each of the three, arranged to have a reminder pending, with a page left open across the old moment |
| **SC-814** the decisions are unit-tested | `npm run test:coverage`, then read `lib/family/notifications/**` — including a DST boundary and midnight in the household's zone |
| **SC-815** anonymous gets a refusal | `npm run test:policies` |
| **SC-816** nothing else broke | The four gates, then `npm run test:e2e` |

## 4. What only a person can check

Shorter than it would once have been, because nothing here leaves the browser. What remains needs
real hardware in a real room:

- The **chime** at the volume a kitchen actually is, from across the room.
- The **two-device realtime check** on the live site, still outstanding since Phase 5.
- The wall tablet **left overnight** and looked at in the morning: no pile of banners.

## 5. When a reminder does not appear

| Symptom | Likely cause |
|---|---|
| Nothing appeared on this device | Its banner switch is off. The switch is per-device local state (FR-815), so a device that has never been turned on stays silent while the others banner. No browser permission is involved — if a device is asking for one, that is a defect |
| Nothing appeared anywhere | No page was open at the moment. Reminders are computed by open pages; once the moment is more than fifteen minutes old it is gone even from a page opened afterwards. This is the design, not a fault |
| The banner appears twice on one device | Two tabs. Each keeps its own dismissed set, by design |
| A dismissed reminder came back | Site data cleared, a private window, or a second browser profile. The dismissed keys live in that browser and nowhere else |
| The banner works on the calendar but not on Lists or Meals | A defect, and a specific one: the banner runs its own query over the reminder horizon rather than reading the visible tab's data (R802). Check that query before anything else |
| A completion is never announced | The ticking device suppresses its own (FR-819). Check a second browser. If that hears nothing either, the realtime channel is the suspect — `family.task_resolutions` is already on the publication and the page learns of completions through it |
| Reminders arrive an hour out | The household's timezone, not the device's, is what everything is judged in. Check Settings |

## 6. Where this fits

The four gates run before every commit. `npm run test:e2e` is the phase gate and gains this phase's
journeys. The hosted `db push` precedes the merge (R818), and it is the only hosted step there is.
