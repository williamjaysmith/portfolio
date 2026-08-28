# `/family` — Master Build Map

**A Skylight Calendar clone for one household, hosted at `willsmith.dev/family`.**

Compiled 2026-08-28 from the eight source-tagged dossiers in this directory (~5,300 lines).
This is the blueprint the Spec Kit feature specs are written from. It answers three questions:
**what exactly are we building**, **what does it look like**, and **how is it stored**.

## How to read this document

| Tag | Meaning |
|---|---|
| `[V]` | **Verified** in a dossier against a primary source (Skylight docs, their live API, or a photo of the device). |
| `[I]` | **Inferred** — a reasonable reading of verified facts, but not directly stated. Must be re-surfaced as an explicit product decision in the spec, never silently asserted. |
| `[?]` | **Unknown** — nobody could determine it. We choose, and we say so. |
| `[OURS]` | A **deliberate divergence** from Skylight. Every one is listed in §11. |

Constitution §VIII binds specs to this: **a spec may only assert `[V]`.** Anything `[I]` or `[?]`
becomes a written decision with a rationale.

---

## 1. Scope

### Building

| Area | Why |
|---|---|
| **Shell** — sidebar nav, top bar, profile chip row, FAB | The frame everything else lives in |
| **Calendar** — Schedule / Day / Week / Month, events, recurrence, countdowns | The core product |
| **Profiles & Labels** | Identity + colour, the spine of the whole UI |
| **Tasks** — chores, routines, up-for-grabs, skip/late | The second reason this exists |
| **Rewards** — stars, reward cards, redeem/unredeem | What makes chores work on a kid |
| **Lists** — to-do / grocery, sections | Free-tier on Skylight, cheap for us |
| **Meals** — 4 categories × 7 days, recipes | Explicitly requested |
| **Settings** | Display toggles, profiles, PINs, reminders |
| **Reminders** — on-tablet banner + Web Push to phones | Explicitly requested |
| **Punch-in access control** | `[OURS]` — see §6 |

### Not building

| Skipped | Reason |
|---|---|
| Photo screensaver, albums, Sleep mode | You said the tablet is opened intermittently, not a permanent wall display |
| External calendar sync (Google/Apple/Outlook/CalDAV) | This app is the source of truth |
| Sidekick AI, Magic Import, auto-creation intents | No AI in v1 |
| Disney Mode, Skylight Buddy, Nudges (spoken reminders), alarms | Hardware/licensing features with no analogue |
| Instacart ordering | Commercial integration |
| Multi-frame / device linking, invites, transfer ownership | One household, two adults |
| Plus-tier gating | Everything is "Plus" for us |

### Scope confirmed 2026-08-28

The full feature inventory was reviewed item by item. **Everything below is in**, beyond the
"Building" table above:

- **Calendar**: Schedule view (4th view, 1–7 day slider) · countdowns · diagonal striped
  multi-profile events with stacked avatars + "+N" · drag an event to another day/time `[OURS]` ·
  per-column "+ Add Event" · Week-starts-today · Month-starts-current-week · text size + density.
- **Tasks**: up-for-grabs · skip · habit streaks · seeded Task Box templates · the
  *Completed Date* repeat mode · drag-reorder columns and tasks · task descriptions · Tasks week view.
- **Rewards**: star confetti on redeem · emoji rain on whole-list completion · manual award/deduct.
- **Lists**: multiple colored lists · grocery vs to-do · clear-completed · drag-reorder.
- **Meals**: recipes folded in (no separate tab) · show meals on the Calendar · repeating meals ·
  push ingredients to a grocery list · **dietary restrictions per profile, shown while planning**.
- **Profiles**: Labels · photo avatars · birthdays on the calendar.
- **Other**: Home screen multi-pane · search · task reminders (When Due / When Completed) ·
  per-event reminder overrides · offline read-only cache.

**Explicitly out**: weather (all of it) · photo screensaver · sleep mode · external calendar sync ·
all AI (Sidekick, Magic Import, auto-emoji, AI sectioning) · Disney Mode · Skylight Buddy · spoken
reminders · Instacart · multi-device linking · invites/co-parent accounts · Plus-tier gating ·
separate Recipes tab · whole-device parental lock · pinch-to-zoom · invited emails on events.

---

## 2. Information architecture

**Yes — signed in, the app opens on the Calendar tab with the sidebar, exactly like the device.** `[V]`

Skylight's device has 8 nav tabs, left rail in landscape and a bottom bar in portrait `[V]`.
Ours drops Photos and Sleep:

```
Landscape (iPad, primary)          Portrait / phone
┌────┬──────────────────────┐      ┌──────────────────────┐
│ S  │ top bar              │      │ top bar              │
│ 📅 │                      │      │                      │
│ ☑  │                      │      │      content         │
│ ☆  │      content         │      │                      │
│ 🍴 │                      │      │                      │
│ ☰  │                      │      ├──────────────────────┤
│    │                      │      │ 📅  ☰  ☑  ☆  🍴   ⚙ │  ← bottom nav
│ ⚙  │                  (+) │      └──────────────────────┘
└────┴──────────────────────┘
```

Tab order (landscape rail): **Calendar · Tasks · Rewards · Meals · Lists**, then a flexible gap,
then **Settings** pinned to the bottom. Skylight's own order varies by frame `[V]` (one photo shows
Lists promoted above Tasks), so ours is a choice, not a fidelity risk.

**Top bar**, left → right `[V]`:
household name *or* today's date (a setting — Skylight calls it "Calendar Display Name" and it
replaces the date) · live clock · then right-aligned:
view-switcher pill (Calendar tab only) · `Filter` pill · `‹` `Today` `›`.

**Profile chip row** sits under the top bar: an optional countdown chip first, then one pill per
visible profile. Skylight's chip shows avatar + name + a task count `[I]` — the "1/20" format is
visible in product photography but appears in no Skylight document, so it's ours to define.

**FAB**: blue `+`, bottom-right, on Calendar / Tasks / Rewards / Lists / Meals. What it creates
depends on the active tab.

---

## 3. Design system

Full detail — sampled hexes, measured type scale, 16 component anatomies, per-screen ASCII
layouts — lives in **`07-visual-design-system.md`**. The load-bearing parts:

### 3.1 The tint system — the single most important finding

Every profile-coloured surface is **one accent hex composited on white at a fixed opacity per
role** `[V]` (derived numerically across four profiles and confirmed to within photo error):

| Role | Opacity |
|---|---|
| Timed event block · all-day pill · chip left cap · **completed** task card · stripe segment | **100%** |
| Chip body · **incomplete** task card | **40%** |
| Tasks/Rewards column header panel | **20%** |

So: store **one hex per profile** and derive the rest with
`color-mix(in srgb, var(--profile) 40%, white)`. Never hand-pick a tint. This one rule reproduces
most of the look.

### 3.2 Palette

The authoritative 20 colours come from Skylight's own `GET /api/colors` `[V]` — seven base/"Deep"
pairs plus six standalones. A "Deep" variant is **not** the dark half of a profile's pair; it's a
separate choice a different profile can take `[V]`.

```
#FDC36D Orange    #FBD97E Sunshine   #CE812D Ochre      #FDB305 Deep Sunshine
#F3B075 Clementine #CF632E Deep Clementine  #F66951 Coral  #FBA994 Grapefruit
#CB434C Deep Grapefruit  #DADADA Charcoal  #D5B6EC Lavender  #915EA1 Deep Lavender
#A8D4D3 Cyan      #93D1E6 River      #00526D Deep River  #2178AF Blue
#82D7DD Sky       #2D8086 Deep Sky    #B6E085 Sprout     #408257 Deep Sprout
```

Colours are **validated server-side against this list** on Skylight — an off-palette hex is
rejected `[V]`. We'll do the same with a CHECK constraint.

**Chrome tokens** (sampled from photos; three independently matched the API palette to Δ≤8,
which validates the sampling method) `[V]`:

```
--app-bg #FFFFFF   --sidebar-bg #E9F0F7   --sidebar-active #FFFFFF (a white pill, not a tint)
--pill-btn-bg #F7F7F8   --grid-hairline #EDEDED
--text-primary #1A1A1A   --text-secondary #6E6E6E   --text-muted #4A4A4A
--primary-blue #2178AF (FAB, "Done")   --today / --now-line #F66951   --star-gold #FDC36D
```

There is **no global success green** — a completed task's check circle uses that profile's own
accent `[V]`.

### 3.3 Type

Skylight's marketing CSS self-hosts **P22 Mackinac Pro** (serif) + **Matter** (sans) `[V]`; the
device UI is very likely the same family, judged from letterforms `[I]`. Neither is free.
Stand-ins: **Fraunces** (serif) and **DM Sans** (sans — it uniquely shares Matter's double-storey
`a` + single-storey `g`).

Serif carries: the date/household name, day headers, Tasks profile names, list titles, modal
titles. Sans carries everything else. **The event title is the only consistently semibold body
text** `[V]`.

### 3.4 Metrics

Measured at 1920×1080 and internally consistent on both axes `[V]`:

```
sidebar 102 + hour gutter 117 + (5 × day column 337) = 1904 ≈ 1920
top bar 85 + chip row 89 + day header 137 + grid 769  = 1080
hour row 195 (half-hour hairline at 97)
```

Chip h61 / cap 72 / avatar 48 · pill button h52 · FAB d90 inset 32 · event radius 20, padding 30,
avatar 40 · task column 400, card 155 (186 with a star chip) · list card 495, row 76, **square**
checkbox 63 (Lists use squares, Tasks use circles `[V]`) · meal cell 235×250 · modal 540×700.

Our iPad is 1024–1366 CSS px wide, not 1920, so these become **ratios on a scalable root**, not
literal pixels. Skylight itself ships Small/Medium/Large text sizes `[V]` — treat the table as the
"Medium" rung.

---

## 4. Data model

Schema `family` in the shared Supabase project. Naming follows Skylight's real semantics where
they got it right, and diverges where their API is shaped by legacy.

### 4.1 The big one: Profiles and Labels are one table

Skylight's backend resource is literally `category`. A **Profile** is a category with
`linked_to_profile: true` and a `family_member` relation; a **Label** is the same row with it
`false` `[V]`. Labels are "what" (holidays, garbage day), Profiles are "who" `[V]`. They share the
colour system, both can own events, and a Label can be **converted to a Profile** `[V]`.

```sql
family.categories (
  id, household_id,
  label            text not null,          -- person's name, or "Holidays"
  color            text not null check (color in (<the 20 palette hexes>)),
  is_profile       boolean not null default true,   -- false = Label
  avatar_id        text,                   -- fixed animal library, or an uploaded photo
  avatar_url       text,
  emoji            text,                   -- Labels use an emoji instead of an avatar
  birthday         date,                   -- profile-only
  dietary_prefs    text,                   -- profile-only; shown while meal planning (no AI)
  show_on_tasks    boolean default true,   -- their `selected_for_chore_chart`
  sort_order       int,
  -- [OURS] punch-in:
  role             text check (role in ('parent','member')) default 'member',
  pin_hash         text,                   -- null = cannot punch in (young kids)
  user_id          uuid references auth.users  -- links a profile to a real account
)
```

Avatars on Skylight are a **fixed illustrated-animal library** (raccoon, unicorn, lab, husky,
elephant, dinosaur, cat, bunny, beagle, bear) served as circular PNGs at 48/80/112/336 px `[V]`,
*plus* photo upload `[V]`. We'll ship our own animal set + photo upload to Supabase Storage.

### 4.2 Events

```sql
family.events (
  id, household_id,
  summary          text not null,          -- Skylight calls the title `summary`
  description      text,
  location         text,
  starts_at        timestamptz,            -- all-day rows use plain dates instead
  ends_at          timestamptz,
  start_date       date,  end_date  date,  -- all-day only
  all_day          boolean not null default false,
  timezone         text not null,
  rrule            text,                   -- RFC-5545, e.g. 'FREQ=WEEKLY;BYDAY=MO,TU;UNTIL=...'
  recurring_until  date,
  countdown_enabled boolean default false,
  created_by_profile uuid references family.categories
)
family.event_categories (event_id, category_id)    -- many-to-many: multi-profile events
family.event_exceptions (event_id, occurrence_date, action, overrides jsonb)
```

**All-day events use plain `YYYY-MM-DD`, timed events use full ISO with offset** `[V]` — Skylight
does exactly this and it avoids a whole class of timezone bug.

**Recurrence editing scope** is a solved question: `apply_to` ∈ **`this` / `this_and_future` /
`all`** `[V]` (verified in a live client, not guessed). Skylight expands recurring series
server-side into per-instance rows with composite ids `<master>-<epoch>` `[V]`; we'll expand
client-side with the `rrule` library and store only exceptions — simpler, and our data volume is
one family's.

### 4.3 Tasks

One table for chores *and* routines, distinguished by a `routine` boolean — Skylight's design,
and it's the right one `[V]`.

```sql
family.tasks (
  id, household_id,
  summary text not null, description text, emoji text,
  routine       boolean not null default false,   -- true = Routine, false = Chore
  category_id   uuid references family.categories,  -- null only when up_for_grabs
  up_for_grabs  boolean not null default false,
  -- chore scheduling (all optional → the four sub-types below)
  due_date date, due_time time,
  -- routine scheduling
  times_of_day text[],       -- any of {morning, afternoon, evening}
  weekdays     int[],
  rrule text, recurring_until date,
  repeat_mode  text check (repeat_mode in ('scheduled_date','completed_date')),
  repeat_after_interval int, repeat_after_unit text,
  reward_points int,
  track_habit  boolean default false,
  sort_order   numeric        -- fractional index [OURS], see below
)
family.task_completions (task_id, occurrence_date, occurrence_time,
                         status, completed_at, completed_by_category_id)
```

**The four chore sub-types fall out of the date/time fields** `[V]`:

| Type | Fields | Behaviour |
|---|---|---|
| Timed | date + time | Due by a time; can fire a reminder |
| All-day | date only | Any time that day |
| Anytime | neither | No deadline, still counts toward the daily total |
| **Late** | *(automatic)* | An uncompleted Timed/All-day chore **carries forward to subsequent days** until done |

**Late completion timestamps use the completion date, not the due date** `[V]`.

**Two repeat modes for chores** `[V]`: *Scheduled Date* ("always repeats after the interval; not
delayed if the previous one wasn't done") vs *Completed Date* ("reschedules only after completion",
either Immediately or after a custom delay). Routines have neither — their timing is entirely
weekday + morning/afternoon/evening `[V]`.

**Skip** exists for routines and repeating chores only: no stars, removed from the total and the
progress ring, and **does not break a habit streak** `[V]`.

**Up for grabs**: unassigned until claimed. Skylight's API refuses to complete one anonymously —
the completion call *must* name who claimed it `[V]`. We keep that rule; it's exactly what our
punch-in gives us for free.

**Ordering** `[OURS]`: Skylight's API takes `{"position": {"before": <id>}}` — relative, not an
index `[V]`. We'll use a fractional index (`sort_order numeric`), which gives the same
drag-to-reorder semantics with a simpler write.

### 4.4 Rewards

```sql
family.rewards (id, household_id, name, description, emoji,
                point_value int, category_id, respawn_on_redemption boolean,
                redeemed_at timestamptz, redeemed_by uuid)
family.point_ledger (id, category_id, delta int, reason, task_completion_id, created_at)
```

Skylight tracks `current_point_balance` (spendable, decrements) and `lifetime_points_earned`
(monotonic) per **category** `[V]`. We derive both from an append-only ledger instead of storing
mutable counters — same numbers, full history, and un-checking a chore becomes a compensating row
rather than a subtraction we have to trust.

**Un-checking a completed chore retracts its stars** `[V]`. **Redeeming permanently spends them**,
and `respawn_on_redemption` decides whether the reward returns to the board `[V]`.
Star guidance from Skylight: chores 1–5, rewards 10–50; a big chore up to 100; rewards cost 1–500 `[V]`.

### 4.5 Lists

```sql
family.lists (id, household_id, label, color, kind, is_default_grocery, hide_on_device)
family.list_items (id, list_id, label, section text, status, sort_order)
```

`kind` has exactly two values: **`shopping` | `to_do`** `[V]`. Sections are freeform strings, not
an enum (Skylight's are AI-assigned grocery aisles — ours are typed) `[V]`. Checked items stay
visible, greyed and struck through, until an explicit **"Clear Completed"** `[V]`.

### 4.6 Meals

```sql
family.meal_categories (id, household_id, label, color, enabled, position)
family.meal_recipes    (id, household_id, summary, description, meal_category_id)
family.meal_sittings   (id, household_id, date, meal_category_id, meal_recipe_id, note, rrule)
```

The four categories ship as seed data with these exact ids/colours/order `[V]`:
**Breakfast `#A8D4D3` · Lunch `#F66951` · Dinner `#915EA1` · Snack `#FDC36D`.**
(Note the marketing photos show *different* colours — apricot/cyan/lavender/pink — so meal colours
are user-editable per household `[I]`. We seed the API values and let Settings change them.)

A recipe's title field is `summary`, and `description` is **one free-text blob** holding both
ingredients and instructions — there is no structured ingredient array anywhere `[V]`. We'll keep
that shape; it's honest about what a family actually types.

### 4.7 Settings

One `family.settings` row per household. From Skylight's documented catalogue `[V]`:
`start_week_on` (Sunday|Monday) · `show_countdowns` (always | 3_months | 1_month) ·
`dim_past_events` · `shade_weekends` · `color_code_multi_profile` · `week_start_on_current_day` ·
`month_start_on_current_week` · `schedule_days` (1–7 slider) · `calendar_display_name` ·
`text_size` (small|medium|large) · `density` (cozy|snug|roomy) · per-meal-category visibility ·
reminder defaults · temperature unit.

Skylight is **12-hour only, with no 24-hour option** `[V]` — we'll add one, it's free.

---

## 5. Screens

### 5.1 Calendar

Four views `[V]`, with documented capacities we should honour because they're real layout constraints:

| View | Layout | Capacity |
|---|---|---|
| **Schedule** | 1–7 upcoming days as columns, count set by a settings slider *and* pinch-zoom | user-set |
| **Day** | grid + chronological list for one day | 10 events landscape, 16 portrait |
| **Week** | 7-day grid; each column has its own `+ Add Event`; a `Next Week` button bottom-right | **4 events/day**, then scroll |
| **Month** | month grid | **3/day; at 4+ it shows 2 plus a `+ More`** opening that day's list |

Cross-view: orange **dot** on today's date, orange **bar** for the current time `[V]`.
Multi-day events render as one spanning bar `[V]`.

**Gestures** `[V]`: swipe left/right = dates, up/down = times, pinch (Schedule) = span,
tap-and-hold blank space = create at that slot, tap event = details.

**Create-event fields** `[V]`: Title · start/end or **All day** · **Repeats** (daily/weekly/monthly
confirmed; the full enum is `[?]`) · **Repeats until** · **Countdown** toggle · reminders ·
Description · **Location** · profile/label selection with inline `+` · Invited Emails.
We drop "Pick a Synced Calendar" (no sync) and the Photo/Talk/Email input row (no AI).

**Countdowns** are just a per-event boolean, not a separate object `[V]`. They render in a preview
bar across all four views, rotate when space is tight, and are governed by the Always / 3-months /
1-month setting `[V]`.

**Multi-profile events** render as a striped bar when "Color Code Multi-Profile Events" is on `[V]`.
Photos show **45° diagonal stripes**, one per assigned profile at 100%, with the label on a solid
segment at the left, avatars stacked ~30% overlapped and a white `+N` circle for overflow `[V]` —
though Skylight's own docs never say "diagonal" `[I]`.

### 5.2 Tasks

Per-profile columns `[V]`. Header: avatar, name, a completion progress ring, a star total, and four
round toggles — **Morning / Afternoon / Evening / Chores** `[V]`.

**Time-of-day auto-selects** `[V]`: midnight–noon → Morning, noon–6pm → Afternoon, 6pm–midnight →
Evening. Tapping a toggle overrides it.

**Up for Grabs is the left-most column** `[V]`. Columns reorder by tap-and-hold-and-drag `[V]`;
swipe left/right reveals more profiles `[V]`.

Card states: incomplete (white circle) → complete (checkmark) `[V]`. The real feedback is the
**whole card darkening from the 40% tint to the full accent** `[V]`. Tapping the card body — not
the circle — opens details with Mark Complete/Incomplete, Skip, Unskip, Delete `[V]`.

Filters `[V]`: completed · late · skipped · per-profile · up-for-grabs.

**Celebration**: an emoji burst fires when a profile completes their *whole* list, not per task
`[V]`. Skylight's name for it is "randomized emoji rain" `[V]`. Respect `prefers-reduced-motion`.

### 5.3 Rewards

Per-profile columns with a star balance; reward cards carry emoji, title, and a progress bar
(`track` = accent 40%, `fill` = accent 100%, label centred *on* the bar) `[V]`.

Redeem opens a 540×700 modal — "Great work! <Reward> redeemed", "By <name> for N stars on <date>",
then **Done** (blue) and **Unredeem** (grey) `[V]`. Gold star confetti scatters across the *whole*
screen and the backdrop is **not dimmed — it warms** `[V]`.

Star values are settable **only in the app, never on the device** on Skylight `[V]`.
`[OURS]` we allow it anywhere a parent is punched in — the device restriction exists because
their device has no per-user identity, which is precisely the gap we're closing.

### 5.4 Lists

Horizontally scrolling cards (~3.4 visible) `[V]`. Each list has a three-step colour ramp: panel
(very light) / item row (mid) / count badge (saturated) `[V]`. Rounded **square** checkboxes.
An "Add section" footer with a count and a chevron `[V]`.

### 5.5 Meals

7 day-columns × 4 category rows, category names rotated −90° in a ~40px left rail `[V]`. Cells carry
emoji + name. Tapping opens a ~700px popover: title, **Edit** / **Delete** pills, then date,
Category (a coloured dot + name), Ingredients, Instructions `[V]`.

Skylight also has "Add to Grocery List" from a recipe — asynchronous, ~10 s, always targeting the
list flagged `is_default_grocery`, with **no way to choose a destination** `[V]`. We can do this
synchronously since we're not parsing with AI: `[OURS]` split the description on newlines into
list items, and *do* let the user pick the list.

---

## 6. Access & permissions `[OURS]`

This is our largest deliberate divergence, and it's a fix rather than a liberty.

**Skylight has no per-person login.** Attribution is by pre-assigned label, so **anyone can tap
anyone's checkbox** `[V]` — the single most-repeated complaint in owner reviews ("siblings checking
off siblings' chores"). Their Parental Lock is a 4-digit device PIN that gates *creating and
editing* events/tasks, independently for "Add" vs "Modify", with magic-link recovery `[V]` — it does
not gate completion at all.

Ours, two layers:

1. **Household access** — Supabase Auth, email allowlist, no public sign-up. RLS refuses any
   session whose user isn't in `family.household_users`. Next.js middleware redirects everyone else
   to sign-in. The iPad signs in once and stays signed in. `/family` is `noindex`.
2. **Punch-in** — viewing is free (the calendar is a wall display). Acting requires tapping your
   avatar and entering a 4-digit PIN; the actor lives in a signed, HTTP-only cookie and
   auto-expires after inactivity. `parent` profiles may edit anything; a `member` may complete
   **their own** tasks and claim up-for-grabs, nothing else. Parent-only writes go through server
   actions that re-check the cookie; ordinary writes go straight to Supabase under RLS.

PINs are hashed (bcrypt/argon2), never stored plain, rate-limited on failure. This directly
satisfies constitution §VII.

---

## 7. Cross-cutting

**Realtime.** Skylight polls once a minute with no push `[V]`. `[OURS]` we use Supabase Realtime —
the wall tablet updates the moment a phone writes. TanStack Query holds the cache; a Realtime event
invalidates it. Optimistic updates on every tap so the iPad feels instant.

**Reminders.** Skylight has two levels — a global default and a per-event override `[V]`. Event
reminders: "At time of event" and "Before event"; the docs contradict themselves on whether it's a
free 1–120-minute field or 10/30/60 presets plus a custom unit picker `[?]`. **We'll ship presets +
custom.** Task reminders are "When Due" and "When Completed" `[V]`. Delivery: banner + chime on the
tablet, plus Web Push to phones (VAPID, service worker, `pg_cron` → Edge Function scanning for due
reminders).

**PWA.** Manifest + service worker, `display: standalone`, Add to Home Screen on the iPad,
landscape-primary. Guided Access gives kiosk mode if you want it.

---

## 8. Architecture

Follows `.claude/rules/architecture.md`; boundaries are fallow-enforced.

```
app/family/
  layout.tsx                     own shell, fonts, theme, manifest; no portfolio Nav
  (auth)/sign-in/page.tsx
  (app)/layout.tsx               FamilyProvider: session, actor, profiles, settings, realtime
  (app)/page.tsx                 → redirect to /family/calendar
  (app)/calendar/                ScheduleView DayView WeekView MonthView EventSheet EventDetails
  (app)/tasks/                   TaskColumn TaskCard TaskSheet UpForGrabsColumn
  (app)/rewards/                 RewardColumn RewardCard RedeemModal Confetti
  (app)/lists/                   ListCard ListItemRow
  (app)/meals/                   MealGrid MealCell RecipePopover
  (app)/settings/
  components/                    Sidebar TopBar ProfileChipRow CountdownChip Fab PunchInSheet
lib/family/
  types.ts  queries.ts  mutations.ts  recurrence.ts  permissions.ts  colors.ts  push.ts
supabase/migrations/             family schema + RLS
```

`lib/family/**` stays framework-free where it can — `recurrence.ts` and `permissions.ts` are pure
and unit-tested per constitution §II.

---

## 9. Phases → Spec Kit features

Each is one `/speckit.specify` run on its own numbered branch. Nothing ships to the iPad until
Phase 4 (your "wait till it's mostly done").

| # | Feature | Contents |
|---|---|---|
| **1** | `family-foundation` | Supabase project + `family` schema + RLS + seed; auth & allowlist; punch-in; shell (sidebar, top bar, chip row, FAB); Profiles & Labels CRUD; design tokens; PWA |
| **2** | `family-calendar` | Four views; event CRUD; RRULE + `this`/`this_and_future`/`all`; multi-profile stripes; countdowns; Filter panel; calendar settings |
| **3** | `family-tasks-rewards` | Chores + routines; four chore sub-types; late/skip; up-for-grabs; time-of-day toggles; progress rings; stars, ledger, rewards, redeem modal + confetti |
| **4** | `family-lists-meals` | Lists with sections + clear-completed; meals grid; recipes; add-to-list |
| **5** | `family-notifications` | Reminder engine; tablet banner; Web Push; search; offline cache; Home screen; keep-alive Action; polish |

---

## 10. Verification

Per constitution §II, pure logic is unit-tested first:
`recurrence.ts` (RRULE expansion, the three edit scopes, exceptions, DST) ·
`permissions.ts` (parent vs member vs not-punched-in, every write path) ·
task scheduling (the four sub-types, late carry-forward, skip semantics) ·
points ledger (award, retract on un-check, redeem, unredeem) ·
`colors.ts` (palette validation, the 40%/20% derivations).

Visual and gesture layers are verified by running the app, with Chrome DevTools MCP for screenshots
at iPad landscape, iPad portrait, and phone widths.

---

## 11. Divergence ledger

Every place we knowingly differ, with why. Specs must cite this table rather than re-litigating.

| # | Divergence | Why |
|---|---|---|
| 1 | **Punch-in PIN attribution** | Fixes Skylight's most-complained-about gap: anyone can complete anyone's chore `[V]` |
| 2 | **Parents can set star values anywhere** | Their device-only restriction exists because the device has no identity; ours does |
| 3 | **Realtime instead of 1-minute polling** | Supabase gives it free; the wall display should be live |
| 4 | **Client-side RRULE expansion + exceptions table** | Simpler than server-expanded instance rows at one household's scale |
| 5 | **Fractional-index ordering** | Same drag semantics as their `{before: id}` with a simpler write |
| 6 | **Points as an append-only ledger** | Full history; un-checking becomes a compensating row |
| 7 | **Choose the destination list for recipe ingredients** | Theirs is hard-wired to the default grocery list `[V]`; no reason to inherit that |
| 8 | **24-hour time option** | Skylight is 12-hour only `[V]` |
| 9 | **No external calendar sync** | This app is the source of truth (your call) |
| 10 | **No AI, photos, sleep, Disney, Buddy, Instacart** | Out of scope (§1) |

---

## 12. What is still unknown

Carried from the dossiers; each becomes an explicit decision in its spec rather than a guess.

- **Never photographed or documented**: Month view, Day view, Schedule view, the Filter panel, the
  create-event form, and every Settings screen. We design these from the documented option lists and
  the established component vocabulary.
- The profile chip's exact `1/20` format and what the denominator counts.
- The countdown chip's exact text ("Vacation 48 days" is a plausible reading, not a quote).
- Whether multi-profile stripes are truly diagonal (photos say yes, docs never say).
- The full "Repeats" frequency enum beyond daily/weekly/monthly.
- Reminder minute options — two Skylight articles contradict each other.
- Factory defaults for every toggle (docs give *recommended* values, not defaults).
- Animation durations and easing — no source documents any; still photos can't show them.
- Whether a completion sound exists.

---

## Dossiers

| File | Lines | Contents |
|---|---|---|
| `01-calendar-tab-and-events.md` | 278 | Views, filter panel, event form, reminders, labels, weather |
| `02-tasks-and-rewards.md` | 797 | Chores/routines, four sub-types, skip/late, stars, rewards |
| `03-lists-meals-recipes.md` | 351 | Lists, meals grid, recipes, Plus gating |
| `04-profiles-settings-access.md` | 400 | Profiles/labels, full settings catalogue, parental lock, onboarding |
| `05-mobile-app.md` | 735 | Phone IA, 10 screenshots, 48-entry dated changelog |
| `06-api-and-data-model.md` | 1134 | Real field names, enums, JSON — live-verified against hardware |
| `07-visual-design-system.md` | 1244 | Sampled palette, tint system, type scale, metrics, 16 components |
| `08-ux-behaviors-and-reviews.md` | 354 | Gestures, quirks, owner complaints, celebrations |
