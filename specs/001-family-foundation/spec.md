# Feature Specification: Family Foundation

**Feature Branch**: `001-family-foundation`
**Created**: 2026-08-28
**Amended**: 2026-09-02 — FR-002 is now a single shared household password, not Google sign-in (see Assumptions)
**Status**: Draft
**Input**: Phase 1 of the `/family` Skylight Calendar clone — the shared foundation every later phase stacks on: household access control, the punch-in actor model, the app shell, Profiles & Labels, the design-token layer, and PWA setup.

**Authoritative source**: `docs/research/skylight/00-master-map.md` (§2 information architecture, §3 design system, §4.1 categories, §4.7 settings, §6 access, §8 architecture), backed by eight source-tagged dossiers in the same directory. Per constitution §VIII, this spec asserts only facts tagged `[V]`; anything `[I]` or `[?]` appears below as an explicit decision in **Assumptions**.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Only our family can get in (Priority: P1)

Someone in the family opens `willsmith.dev/family` and is asked for one thing: the household password. They type it and the app opens on the Calendar tab. Anyone else — a stranger who finds the URL, or someone who does not know the password — is refused and never sees household data. There is no account to choose, no address to type, and nothing to sign up for; *who* is acting is decided later, inside, by the punch-in PINs.

**Why this priority**: This is a real family's schedule, including a child's. Without it nothing else may ship. Constitution §VII.

**Independent Test**: Enter the household password and reach the shell; enter a wrong one and be refused with a message that reveals nothing; request the page signed-out and be redirected. Query the database directly as a non-member and get zero rows.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor, **When** they request any `/family` route, **Then** they are redirected to the sign-in screen and no household data is sent in the response.
2. **Given** a person who knows the household password, **When** they enter it, **Then** they land on the Calendar tab of the shell.
3. **Given** a wrong password, **When** it is submitted, **Then** no session is created, no household data is returned, and the screen shows a single message that does not distinguish a wrong password from an account that does not exist.
4. **Given** the sign-in screen in any state, **When** its markup and network traffic are inspected, **Then** the household account's address appears in neither — it is held server-side and never sent to the browser.
5. **Given** an authenticated account that is not on the household allowlist, **When** it requests any `/family` route, **Then** it sees an "unrecognised account" message and no household data is returned. (No public path exists by which such an account can be created — FR-004.)
6. **Given** a signed-in member, **When** a request is made for another household's data, **Then** the store returns nothing regardless of what the interface requested.
7. **Given** the wall tablet signed in, **When** the household returns days later without re-authenticating, **Then** the session is still valid.
8. **Given** any visitor, **When** a search engine crawls the site, **Then** `/family` is excluded from indexing.

---

### User Story 2 — Punch in to act, browse freely (Priority: P1)

The tablet sits on the counter showing the calendar. Anybody walking past can read it. The moment someone tries to *change* something, the app asks "Who's here?", they tap their face and type their 4-digit PIN, and the action proceeds recorded against them. After a few idle minutes it forgets who they were and goes back to the shared view.

**Why this priority**: This is the reason the app exists rather than using Skylight. Skylight has no per-person identity, so anyone can complete anyone's chore `[V]` — the most-repeated complaint in owner reviews. Every later phase (task completion, star awards, parent-only settings) depends on knowing who is acting.

**Independent Test**: With nobody punched in, confirm the shell is fully readable and every mutating control prompts for a PIN. Punch in as a parent and confirm an admin action succeeds; punch in as a child and confirm the same action is refused by the server, not merely hidden.

**Acceptance Scenarios**:

1. **Given** nobody is punched in, **When** someone views any screen, **Then** all content is readable and no PIN is requested.
2. **Given** nobody is punched in, **When** someone activates a control that changes data, **Then** the "Who's here?" picker appears showing every profile that has a PIN.
3. **Given** the picker is open, **When** a person taps their profile and enters the correct PIN, **Then** they become the current actor and the original action completes.
4. **Given** the picker is open, **When** an incorrect PIN is entered, **Then** the action does not proceed and no indication is given of how close the guess was.
5. **Given** repeated incorrect PIN entries for one profile, **When** a threshold is passed, **Then** further attempts for that profile are refused for a cooling-off period.
6. **Given** a member (child) is punched in, **When** they attempt a parent-only action, **Then** the server refuses it even if the request is issued directly rather than through the interface.
7. **Given** someone is punched in, **When** the configured idle period passes with no interaction, **Then** the actor is cleared and the next change requires a PIN again.
8. **Given** someone is punched in, **When** they choose "punch out", **Then** the actor is cleared immediately.
9. **Given** a profile with no PIN set, **When** the picker is shown, **Then** that profile cannot be selected as an actor.

---

### User Story 3 — The household sees itself (Priority: P1)

A parent sets up the household: names it, adds a profile for each person with a colour and an avatar, and optionally adds Labels for things that belong to nobody — holidays, bin day. Everyone's colour then follows them consistently everywhere in the app.

**Why this priority**: Profiles are the spine of the product. Colour identity is how every later screen communicates ownership at a glance, and no later phase can be built or demonstrated without profiles to attach things to.

**Independent Test**: Create, edit, reorder and delete profiles and labels; confirm the chip row and colour treatment update; confirm a colour outside the sanctioned palette is refused.

**Acceptance Scenarios**:

1. **Given** a punched-in parent, **When** they create a profile with a name, colour and avatar, **Then** it appears in the chip row using that colour.
2. **Given** the colour picker, **When** a parent chooses a colour, **Then** only the 20 sanctioned palette colours are offered, and a value outside them is rejected by the store even if submitted directly.
3. **Given** a parent creating a profile, **When** they pick an avatar, **Then** they may choose an illustrated animal from the built-in set or upload a photo.
4. **Given** a parent, **When** they create a Label, **Then** it takes a name, a colour and an emoji, but no avatar, birthday, PIN or role.
5. **Given** existing profiles, **When** a parent reorders them, **Then** the new order persists and is reflected in the chip row.
6. **Given** a profile with a birthday, **When** that date arrives, **Then** the birthday is available to later phases for display (no calendar rendering in this phase).
7. **Given** a profile with dietary restrictions recorded, **When** later phases plan meals, **Then** those restrictions are readable (no meal UI in this phase).
8. **Given** a punched-in member (child), **When** they attempt to create or edit any profile, **Then** the action is refused.
9. **Given** a profile that later phases will reference, **When** a parent deletes it, **Then** they are warned about what will be affected and must confirm.

---

### User Story 4 — It looks and moves like the real thing (Priority: P2)

Mounted on the kitchen tablet in landscape, the app shows a left rail of tabs, a top bar with the household name and clock, and a row of colour-coded family chips — recognisably the Skylight layout. Turned to portrait or opened on a phone, the rail becomes a bottom bar and the content reflows.

**Why this priority**: Fidelity is the stated goal of the project (constitution §VIII), and the shell is what every later phase renders inside. It is P2 only because the access model must be correct first.

**Independent Test**: Load the shell at tablet-landscape, tablet-portrait and phone widths and compare against the reference layouts in `07-visual-design-system.md`; confirm nav position, active-tab treatment and chip anatomy match.

**Acceptance Scenarios**:

1. **Given** a landscape viewport, **When** the app loads, **Then** navigation is a left rail and the active tab is marked with a white pill.
2. **Given** a portrait or phone viewport, **When** the app loads, **Then** navigation is a bottom bar using the same active-pill treatment.
3. **Given** the shell, **When** it renders, **Then** the top bar shows either the household name or today's date (per setting), plus a clock that stays current.
4. **Given** profiles exist, **When** the chip row renders, **Then** each chip shows the profile's avatar on a solid cap and its name on a lighter body of the same colour.
5. **Given** any profile colour, **When** surfaces derive from it, **Then** they use exactly three strengths — full, medium and faint — from that one colour.
6. **Given** the shell, **When** a person navigates between tabs, **Then** the active tab updates and the address bar reflects the current tab.
7. **Given** a signed-in person, **When** they open the app, **Then** it opens on the Calendar tab.

---

### User Story 5 — It installs like an app (Priority: P3)

A parent opens `/family` in Safari on the iPad, adds it to the home screen, and from then on it launches full-screen with its own icon and no browser furniture, still signed in.

**Why this priority**: It is what makes the web app acceptable as a wall calendar, but the app is fully usable in a browser tab without it.

**Independent Test**: Install to the iPad home screen, launch from the icon, confirm full-screen presentation, correct icon and title, and a live session.

**Acceptance Scenarios**:

1. **Given** the app in a mobile browser, **When** a parent adds it to the home screen, **Then** it installs with the family icon and name.
2. **Given** the installed app, **When** launched from the icon, **Then** it opens full-screen with no browser chrome.
3. **Given** the installed app on a tablet, **When** launched, **Then** it presents landscape-first.
4. **Given** the installed app, **When** relaunched after days idle, **Then** the session is still valid and no sign-in is required.

---

### Edge Cases

- **A person is deleted while punched in as themselves** — the actor is cleared immediately and the next action re-prompts.
- **Two people punch in from different devices at once** — each device tracks its own actor independently; neither displaces the other.
- **The tablet is offline when someone punches in** — the PIN cannot be verified, so the action is refused with a clear "can't reach the house" message rather than being allowed optimistically.
- **A parent forgets their PIN** — a signed-in parent can reset any PIN from settings, including their own; there is no separate recovery channel because household sign-in is already proof of identity.
- **The household password is forgotten** — there is no "forgot password" mail, because no mailbox is in the loop by design. It is reset from the Supabase dashboard by whoever administers the project, and every device then signs in again with the new one. Devices already signed in are unaffected until their session ends.
- **Every profile lacks a PIN** — the app is read-only until a signed-in parent sets one; setting the first PIN is gated on the Supabase session, not on being punched in, so the household cannot lock itself out.
- **A photo avatar upload is very large or not an image** — it is rejected with a clear message and the previous avatar is retained.
- **The household has no profiles yet** — the shell renders with an empty chip row and prompts a parent to add the first person.
- **Two profiles pick the same colour** — permitted but warned, since colour is the primary way people are told apart at a glance.
- **The clock crosses midnight while the app is open** — the date in the top bar updates without a reload.
- **A session expires while the app is open** — the person is returned to sign-in without a crash and without exposing stale household data.
- **A tab is opened directly by URL while signed out** — treated exactly as an unauthenticated request; no flash of household content before the redirect.

## Requirements *(mandatory)*

### Functional Requirements

**Household access**

- **FR-001**: The system MUST require an authenticated session for every `/family` route and redirect unauthenticated requests to a sign-in screen without rendering household content.
- **FR-002**: The system MUST authenticate the household with a single shared credential: **one account for the whole household, entered as a password and nothing else**. It MUST NOT require, offer or depend on a per-person account — per-person identity is the punch-in layer (FR-008 … FR-018), not the sign-in. The account's address MUST live in server-side configuration and MUST never be typed, displayed, or sent to the browser; the password MUST be validated by the authentication service, never held or compared by this application; and a failed sign-in MUST NOT distinguish a wrong password from an account that does not exist.
- **FR-003**: The system MUST restrict access to email addresses on an explicit household allowlist, and MUST refuse any authenticated account not on it.
- **FR-004**: The system MUST NOT provide any public sign-up path, and account creation MUST be disabled at the authentication service itself rather than merely absent from the interface.
- **FR-005**: The system MUST enforce household membership at the data store, so that a request for data belonging to another household returns nothing regardless of what the interface asked for.
- **FR-006**: The system MUST keep a session valid across days of inactivity so a wall-mounted tablet does not require repeated sign-in.
- **FR-007**: The system MUST exclude `/family` from search-engine indexing.

**Punch-in actor model**

- **FR-008**: The system MUST allow all household content to be viewed without selecting an actor.
- **FR-009**: The system MUST require an actor before any operation that creates, changes or deletes data.
- **FR-010**: The system MUST establish an actor by having the person select their profile and enter that profile's numeric PIN.
- **FR-011**: The system MUST store PINs only in a non-reversible form and MUST NOT expose them, or any hint of their value, to any client.
- **FR-012**: The system MUST limit consecutive failed PIN attempts per profile and refuse further attempts for a cooling-off period once the limit is reached.
- **FR-013**: The system MUST clear the actor automatically after a configurable idle period, and MUST offer an explicit "punch out".
- **FR-014**: The system MUST assign every profile a role of either parent or member.
- **FR-015**: The system MUST permit only parents to manage profiles, labels, PINs, roles and household settings, and MUST enforce this on the server rather than by hiding controls.
- **FR-016**: The system MUST record the acting profile on every change it makes, so later phases can attribute completions and awards.
- **FR-017**: The system MUST allow a profile to exist without a PIN, in which case it cannot be selected as an actor.
- **FR-018**: The system MUST allow a signed-in parent to set or reset any profile's PIN using their household session alone, so the household cannot become permanently locked out.

**Profiles and Labels**

- **FR-019**: The system MUST represent people (Profiles) and non-person categories (Labels) as one kind of record distinguished by a single flag, so both can own items and share the colour system.
- **FR-020**: The system MUST require a name and a colour on every profile and label.
- **FR-021**: The system MUST restrict colours to the 20 sanctioned palette values and MUST reject any other value at the data store.
- **FR-022**: The system MUST let a profile take either an illustrated avatar from a built-in set or an uploaded photograph.
- **FR-023**: The system MUST let a label take an emoji instead of an avatar.
- **FR-024**: The system MUST support an optional birthday and optional free-text dietary restrictions on a profile, both readable by later phases.
- **FR-025**: The system MUST let parents create, edit, reorder and delete profiles and labels.
- **FR-026**: The system MUST warn before deleting a profile or label and require confirmation.
- **FR-027**: The system MUST let a profile be marked as hidden from the task view without deleting it.

**Shell and navigation**

- **FR-028**: The system MUST present navigation as a left rail in landscape and a bottom bar in portrait and on phones, with the same tab set and the same active-item treatment.
- **FR-029**: The system MUST expose tabs for Calendar, Tasks, Rewards, Meals and Lists, with Settings separated at the end; tabs whose features arrive in later phases MUST be present but may show a placeholder.
- **FR-030**: The system MUST open on the Calendar tab after sign-in.
- **FR-031**: The system MUST show, in the top bar, either the household name or today's date according to a setting, plus a clock that remains accurate and updates across a date change without reload.
- **FR-032**: The system MUST show a row of profile chips beneath the top bar, each carrying the profile's avatar and name in that profile's colour.
- **FR-033**: The system MUST let a person show or hide individual profiles, and MUST persist that choice per device.
- **FR-034**: The system MUST present a primary create control positioned consistently across tabs.
- **FR-035**: The system MUST give every interactive control a touch target no smaller than 44×44 points.

**Design tokens**

- **FR-036**: The system MUST derive every profile-coloured surface from that profile's single colour at exactly three strengths — full, medium and faint — rather than from separately chosen values.
- **FR-037**: The system MUST define one shared set of colour, type and spacing tokens used by every later phase.
- **FR-038**: The system MUST scale text and spacing from a single root so a future text-size preference can adjust the whole interface proportionally.
- **FR-039**: The system MUST meet WCAG 2.1 AA for text contrast, keyboard navigability and visible focus, and MUST NOT use colour as the only means of conveying who something belongs to.

**Installation**

- **FR-040**: The system MUST be installable to a device home screen with a name and icon, launching full-screen without browser chrome.
- **FR-041**: The system MUST present landscape-first on tablets when launched from the home screen.
- **FR-042**: The system MUST retain the signed-in session across relaunches of the installed app.

**Household settings**

- **FR-043**: The system MUST provide a settings area, available to parents only, covering household name, the display of name-versus-date, profile and label management, PIN management, and the punch-out idle period.

### Key Entities

- **Household** — the single family this deployment serves. Owns every other record. Carries the household name and shared display preferences.
- **Household Member** — the link between an authenticated account and the household; the allowlist. Determines whether a session may see anything at all. In this deployment it holds exactly one row: the household's single shared account (FR-002).
- **Category** — one record type covering both **Profiles** (people) and **Labels** (non-person categories), distinguished by a single flag. Carries name, colour, avatar or emoji, display order, and — for profiles only — birthday, dietary restrictions, role, PIN and an optional link to an authenticated account. Everything in later phases attaches to a Category.
- **Actor session** — the record of who is currently punched in on a given device, and until when. Not shared between devices.
- **Household Settings** — the household's display and behaviour preferences, including the punch-out idle period.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person who does not have the household password cannot reach household content by any route — signed out, submitting a wrong password, or requesting data directly with the browser key. Verified by an explicit test for each of the three paths. An authenticated account that is somehow not on the allowlist reads nothing either, which the policy suite proves at the database.
- **SC-002**: A child punched in as themselves cannot perform a single parent-only action, including when the request bypasses the interface entirely.
- **SC-003**: Someone standing at the tablet can go from touching a control to having their change recorded in **under 5 seconds**, including selecting their profile and entering a PIN.
- **SC-004**: A person can read the whole calendar, and identify whose events are whose, **without any interaction at all**.
- **SC-005**: A parent can add a complete family profile — name, colour, avatar — in **under 60 seconds**.
- **SC-006**: The shell renders correctly at tablet-landscape, tablet-portrait and phone widths with no horizontal scrolling and no overlapping controls at any of the three.
- **SC-007**: Every profile-coloured surface in the app can be traced to one stored colour per profile; no surface uses a hand-picked tint. Verified by inspection of the token layer.
- **SC-008**: The app installs to an iPad home screen and launches full-screen, still signed in after **at least 7 days** of not being opened.
- **SC-009**: All interactive controls pass automated accessibility checks for contrast, focus visibility and accessible naming, and the shell is fully operable by keyboard.
- **SC-010**: The household cannot lock itself out: from a state where no profile has a PIN, a signed-in parent can restore full control without developer intervention.

## Assumptions

Decisions made where the research was tagged `[I]` (inferred) or `[?]` (unknown), or where the source product had no equivalent. Recorded here rather than asserted as fact, per constitution §VIII.

- **Punch-in is our own invention.** The reference product has no per-person identity at all; attribution is by pre-assigned label, so anyone can complete anyone's task `[V]`. Its "parental lock" is a single device-wide PIN gating *creation and editing* only `[V]`. Our two-layer model deliberately replaces it and is recorded as divergence #1 in the master map.
- **Idle punch-out defaults to 3 minutes**, configurable. No source value exists; chosen to be long enough to complete a few chores and short enough that a child cannot act as a parent who walked away.
- **PIN length is 4 digits**, matching the reference product's parental lock `[V]`.
- **The household signs in with one shared password** (decided 2026-09-02, replacing Google sign-in). The household is two adults who wanted neither a Google account nor an email service in the loop, so `/family` has exactly one Supabase account and the sign-in screen is a single password field. What was weighed: Google needed an OAuth client in a Google Cloud project the household would have to keep alive, and magic links needed either Supabase's built-in mailer (rate-limited and explicitly not for production) or an SMTP provider they did not want to buy or run — against one secret the two of them already share, typed once per device. The cost accepted: a lost password is reset from the Supabase dashboard, because no mail is ever sent anywhere; and a shared secret cannot say who used it. That last point costs nothing the design relied on — **the account is a door, not an identity**. Attribution has never come from the sign-in; it comes from the punch-in PINs (FR-008 … FR-018), which are unchanged, so sharing the door among the household is exactly what it is for. The address of the account lives in server-side configuration and is never shown to the browser, so the sign-in screen offers a stranger nothing to attack but a password field. `[OURS]`
- **Profiles and Labels share one record type.** Taken from the reference product's own data model, where a Label is a category with its profile flag off `[V]`.
- **The colour palette is fixed at the 20 sanctioned values** and enforced at the data store, mirroring the reference product's server-side validation `[V]`. Custom colours are not offered in this phase.
- **The chip's task counter is deferred.** The reference product shows a per-profile count on each chip, but no source documents its format or what the denominator counts `[I]`. The chip renders avatar and name in this phase; the counter is specified when Tasks are built.
- **Profile visibility is per-device**, not per-household, so the tablet and a phone can show different subsets.
- **Illustrated avatars are our own artwork.** The reference set is copyrighted; only the *shape* of the feature — a small fixed library of circular illustrated animals, plus photo upload `[V]` — is reproduced.
- **Typefaces are substitutes.** The reference product's faces are commercial and unconfirmed for the device UI `[I]`; free equivalents chosen for the closest letterform match are specified in the design-token layer.
- **Tabs for later phases ship as placeholders** so navigation is complete and testable from this phase onward.
- **One household only.** Records carry a household reference so the model is correct, but no interface exists for creating a second household, and none is planned.
- **Offline behaviour is out of scope for this phase.** The read-only cache is Phase 5; here, loss of connectivity produces clear failures rather than optimistic writes.

Added after the adversarial design review (2026-08-31):

- **Setting a PIN needs no actor only until a parent could provide one.** FR-018/SC-010 are satisfied by the first case: while no parent profile holds a PIN, nobody can punch in, so a signed-in account on the allowlist may set one and the household can always restore itself. The moment any parent holds a PIN, `setProfilePin` requires a punched-in **parent** — so a child, or a visitor, at the always-signed-in tablet can no longer reset a parent's PIN and take over their profile. A punched-in member is refused in both cases (FR-015). `[OURS]`
- **A fresh household bootstraps itself.** While the household has zero parent profiles, a signed-in member may create the first profile without an actor, and it is forced to be a parent. The path closes the moment a parent exists, and the data store refuses to delete or demote the last parent, so it cannot reopen. Without this an empty household would be a dead end. `[OURS]`
- **Landscape-first is a layout guarantee, not an orientation lock, on iPadOS.** The manifest declares `orientation: landscape-primary` (honoured by Android); iPadOS ignores the member and follows the device, so rotating to portrait yields the bottom-bar layout rather than a failure of FR-041. `[I]` — platform behaviour, verified by install (SC-008).
- **The manifest is served from a route handler**, `app/family/manifest.webmanifest/route.ts`, and linked from the `/family` layout. Next.js only recognises a `manifest` metadata file at the app root, and the portfolio must not carry `/family` as its site-wide manifest. `[OURS]`
- **FR-004 is enforced at the Auth API, not only in the interface.** On the hosted project **"Allow new users to sign up" is off**, anonymous sign-ins are off, and a Before-User-Created hook refuses account creation for any address not on the allowlist. Amended 2026-09-02: the Email provider can no longer be the thing that is switched off — it is the door the household password goes through — so the sign-up switch and the hook are what close the hole, and they are checked in that order (see quickstart §4). Without them, Supabase Auth itself would mint a session for anyone holding the publishable key, which ships in the browser. `[OURS]`
- **A Label's emoji is optional.** The source says a Label *may* take an emoji ("optionally choose an Emoji") `[V]`; the earlier reading that Labels use an emoji *instead of* an avatar was an inference. Name and colour remain required.
- **Idle punch-out range is 1–60 minutes**, wider than the reference product's parental-lock inactivity timeout of 1–10 minutes `[V]`. Recorded as a divergence: the range exists to let a parent keep the tablet unlocked through a long task session; the 3-minute default is unchanged.

## Dependencies

- A provisioned Supabase project (`portfolio`, East US / Ohio) with the Data API enabled, automatic table exposure disabled, and automatic RLS enabled.
- One Supabase account for the household, created by the seed script before public sign-up is closed, and allowlisted. Its address is configuration (`FAMILY_ACCOUNT_EMAIL`), read only on the server; its password is known to the household and validated only by Supabase. No mail service and no external identity provider is required or configured.
- The eight research dossiers and master map in `docs/research/skylight/`, which this specification treats as the product definition.

## Out of Scope

Deferred to later phases: calendar views and events, tasks and routines, rewards and stars, lists, meals and recipes, reminders and push notifications, search, the multi-pane home screen, and the offline cache.

Excluded from the project entirely: weather, photo screensaver, sleep mode, external calendar synchronisation, all AI features, themed character modes, companion hardware, grocery-ordering integrations, multi-device linking, guest invitations, and subscription tiers.
