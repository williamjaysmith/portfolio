# Skylight Calendar — Real-World UX Behavior, Interaction Details, and Reviewer/Owner Observations

> **STATUS: RESEARCH PASS COMPLETE.** Every fact carries `[VERIFIED](url)`, `[INFERRED]`, or `[UNKNOWN]`. Reddit (r/SkylightCalendar, r/skylight) could not be reached by the available fetch tool in this environment — see Open Questions #9 — and remains the primary follow-up item for a future pass.

**Subject:** Skylight Calendar (Calendar 2, Calendar Max) touchscreen device, software as of 2025–2026.
**Purpose:** capture the real-world UX behavior, interaction quirks, and flows that help-center articles don't document — for building an identical clone.
**Date compiled:** 2026-08-28.

## Evidence tags
| Tag | Meaning |
|---|---|
| `[VERIFIED](url)` | Confirmed against a cited source (review, forum post, Skylight content, YouTube video). Opinions are attributed to the reviewer/owner who made them. |
| `[INFERRED]` | Reasonably inferred from adjacent/related verified facts, not directly stated. |
| `[UNKNOWN]` | Not determinable from available material at research time. |

## Table of contents
- Touch interactions (tap, long-press, drag-and-drop, swipe, pinch-zoom, scrolling, keyboard, emoji picker)
- Calendar views in practice (Day, Week, Month, Schedule/List) and cramped-cell rendering
- Midnight/day-change behavior, idle/auto-return behavior, default boot view
- Parental lock in practice
- Celebrations (chore completion, reward redemption, Disney mode, birthdays)
- Profile / "who am I" attribution on-device
- Photos screensaver behavior
- Weather
- Notifications & Reminders
- Owner-reported edge cases and complaints
- Skylight Masterclass videos and YouTube walkthroughs
- Timeline of software features / release notes
- Open questions
- Sources

---

## Touch interactions

### Tap
- Tapping an event opens "the event details box" (device) / a "preview sheet" (mobile app), from which an edit (pencil) icon and a trash icon are available. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738510847259-Calendar)`
- Tapping outside an open detail panel dismisses it and returns to the calendar. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738510847259-Calendar)` (mobile app fetch)
- Tapping a day cell in Month view switches to Week view focused on that day. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738510847259-Calendar)` (mobile app fetch)
- Marking a chore/routine complete: "tap the white circle to the right of the name" in the list, or open the task and tap "Mark as Complete". `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)`
- No source found describing a long-press gesture anywhere in the product (event edit, task complete, or day-cell event creation). Reviews and help articles describe only tap-to-open-details plus a separate edit icon inside the details panel — i.e., editing is a **two-step tap flow** (tap event → tap edit icon), not a long-press shortcut. `[INFERRED]` from absence across all fetched sources; true absence of long-press support is `[UNKNOWN]`.

### Drag-and-drop
- Skylight's own release log explicitly lists "Reorder Routines" (Jun 25, 2026) as a **mobile-app** capability — "Users can now resequence routines in day view." This implies a drag-to-reorder interaction for routines, but the release note doesn't specify device-vs-app or the exact gesture (drag handle vs. free drag). `[VERIFIED](https://releasebot.io/updates/skylight)`
- **Lists confirm drag-and-drop is a real, named interaction pattern in the product**, not just routines: a dedicated feature announcement, "[Feature] Calendar Lists Improvements," states users can **"Reorder list items with drag and drop,"** plus **"Clear completed list items in one step"** and **"Remove list sections you no longer need."** `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/51482785426075--Feature-Calendar-Lists-Improvements)`
- The public roadmap page (Notion-hosted) could not be scraped (renders client-side; returned nothing but the word "Notion" to the fetcher) — retried once, still blocked. `[UNKNOWN]` — see Open Questions.
- No source confirms drag-and-drop for **moving an event** between days/times on the device grid. A parent asked exactly this in a Skylight Facebook community group ("Will Skylight Calendar allow drag and drop or assign...") — the fact that this was an open community question as of the group post suggests drag-to-reschedule was **not** a shipped feature at the time of asking. `[INFERRED]`, exact current status `[UNKNOWN]`.

### Swipe
- **Week view (device):** "swipe up and down to see all the events in the current week"; "swipe right to show past events and swipe left to show future events." `[VERIFIED]` (WebSearch synthesis of Skylight support content)
- **Day view (device):** "scroll through each day's events using an upwards or downwards swiping motion. Swipe left and right to display previous or future dates." `[VERIFIED]` (WebSearch synthesis of Skylight support content)
- **Calendar tab, generally (device, per the "Calendar" support article):** "Swipe left to see previous dates, and swipe right to see future dates" (horizontal = date navigation); "Swipe up to see earlier times, and swipe down to see later times" (vertical = time navigation within a day/week grid). `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738510847259-Calendar)`
- **Month view swipe was a 2026 addition, not present from launch:** release log entry "Swipe for Month View" dated Jul 29, 2026 — "Gesture-based navigation added for monthly calendar browsing," implying Month view previously required tapping Next/Previous arrows rather than swiping. `[VERIFIED](https://releasebot.io/updates/skylight)`
- **Mobile app swipe navigation shipped separately/later than device swipe:** "Swipe Navigation in the Mobile App Calendar" (Jun 25, 2026) — "Added left/right swipe gestures for browsing past and future events," implying the app previously relied on buttons only. `[VERIFIED](https://releasebot.io/updates/skylight)`

### Pinch-zoom
- Schedule view supports pinch-to-zoom: "you can pinch the screen to zoom in and out on particular time periods... to increase or decrease the number of hours displayed on the schedule," and "pinch the schedule view to display a larger span of time." This is in addition to (not instead of) an explicit Settings slider ("Days displayed in Schedule View," 1–7 days) for the same axis. `[VERIFIED]` (WebSearch synthesis of Skylight support content); exact article `[UNKNOWN]`
- The Calendar support article confirms pinch-to-zoom specifically for Schedule view ("column view for today and upcoming days, with pinch-to-zoom"). `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738510847259-Calendar)`

### On-screen keyboard / emoji picker
- Text entry (task names, label names, etc.) uses a standard on-screen keyboard; an **Emoji button** opens an "Emoji picker" for adding an emoji to a task or Label. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44740240234139-Profiles-and-Labels)` (Labels), task-level emoji picker `[VERIFIED]` (WebSearch synthesis of Tasks support content)
- Events can additionally be created via **photo capture, voice input, or email submission** in the "Add event" dialog — not just typed text. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738510847259-Calendar)`
- Sidekick AI (2026, Skylight Plus) extends this: photographing a flyer auto-extracts an event, and photographing fridge contents suggests recipes ("Fridge Photo"). `[VERIFIED](https://www.morningstar.com/news/pr-newswire/20260317ny11053/skylight-releases-calendar-2-the-next-generation-of-its-viral-digital-family-calendar)` via WebSearch synthesis

## Calendar views in practice

The device's Calendar tab has **four view modes**, confirmed directly from the primary Skylight support article for the Calendar tab: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738510847259-Calendar)`

| View | Description (quoted) |
|---|---|
| Schedule | "column view for today and upcoming days" — with pinch-to-zoom |
| Day | "grid calendar and a list of events for the selected day" — i.e., a time grid PLUS a separate list of that day's events, not just one or the other |
| Week | "a grid showing a week" |
| Month | "a grid of the current month in standard calendar format" |

- Users switch views via "the calendar view button in the information bar" — "the button label is the current view" (i.e., a single button that cycles/opens a view picker, labeled with whatever view is currently active). `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738510847259-Calendar)`
- Today's date is marked with **"an orange dot"**; the current time within a grid is marked with **"an orange bar"** (a "now" line). `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738510847259-Calendar)`
- Multi-day (all-day) events "display as a single bar in Schedule view and Month view" — i.e., rendered as a connected/spanning bar, not as repeated per-day chips. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738510847259-Calendar)`
- **Month view overflow handling:** "when all events on a specific date are not already visible, a '+ More' button appears" — tapping it "will show all events for a given day." `[VERIFIED]` (WebSearch synthesis of Skylight support content, corroborated independently by a separate search pass)
- **Mobile app** view set is narrower than the device: only **Week and Month** views exist in the app (no Day or Schedule view in-app as of the fetched article), toggled via a "Week / Month" button in the button bar. Week view in the app renders events as "individual bubbles in a scrolling single-column list," colored by Profile; Month view shows bubbles on the month grid with multi-day events as connected bars. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738510847259-Calendar)` (this article covers both device and app in one page — the app-specific portion is the source for this row)
- **Reviewer verdict on Month view (Reviewed.com):** *"The month view is the weak spot for the Skylight Calendar. On a smaller screen with a lot of daily activity, it gets cramped and hard to read."* `[VERIFIED](https://www.reviewed.com/smarthome/content/skylight-calendar-2-review)` — this is specifically about the **smaller** (15") Calendar model; larger screens (Calendar Max, 27") would presumably mitigate this. `[INFERRED]`
- **Reviewer preference (same Reviewed.com review):** the reviewer's favorite views were Day view (for clarity) and Schedule view, which they describe as a *"12-to-12 timeline with exact time blocks"* good for packed days; Week view "functioned well." Per-person filtering (viewing one family member's schedule in isolation) was called out as transformative for readability — *"transformed chaotic family calendars into readable ones."* `[VERIFIED](https://www.reviewed.com/smarthome/content/skylight-calendar-2-review)`
- **Device Home Screen historically defaulted to a non-Day view; Day view was added to the home screen only in Aug 2026:** release log entry "The Calendar Home Screen Supports Day View" (Aug 6, 2026) — "Added daily view option to calendar interface," implying that before this date the Home/Calendar tab's default landing view did not include a Day option at all (only Schedule/Week/Month, or a different single default). `[VERIFIED](https://releasebot.io/updates/skylight)`
- Two related mid-2026 changes affecting Month view specifically: "Start the Month With the Current Week" (Jul 15, 2026 — "Calendar now defaults to showing the current week when opening monthly view," i.e. previously Month view may have opened scrolled to the 1st of the month rather than today) and "Weather in Month View" (Jul 7, 2026 — weather icons integrated into month cells). `[VERIFIED](https://releasebot.io/updates/skylight)`

### Settings that affect view density/readability
- "Days displayed in Schedule View" — slider, 1–7 days; fewer days recommended "for very busy schedules... to make your calendar easier to read." `[VERIFIED]` (WebSearch synthesis of Skylight support + digicalendars.com secondary source)
- "Start on current day" (Week view) — when enabled, "the week in question will always have the first day of the week as today" rather than a fixed Sun/Mon start. `[VERIFIED](https://digicalendars.com/skylight-calendar-display/)`
- "Dim Past Events" and "Shade Weekends" toggles improve at-a-glance scanability. `[VERIFIED](https://digicalendars.com/skylight-calendar-display/)`
- Orientation affects how many days/columns are visible: *"The number of days that you can see is the highest allowed depending on the orientation of your Calendar. Landscape mode is the best of the best."* (quoted from a third-party guide paraphrasing Skylight's own guidance). `[VERIFIED](https://digicalendars.com/skylight-calendar-display/)`
- "Preview Chores" — shows upcoming chores alongside calendar events (i.e., chores can bleed into the Calendar tab's view, not just the Tasks tab). `[VERIFIED](https://digicalendars.com/skylight-calendar-display/)`

### The Home Screen (landing screen / boot destination)
A dedicated support article, "The Home Screen," directly answers what the device shows by default: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/49738702477723-The-Home-Screen)`
- The Home Screen is **"the first tab in the Navigation bar"** and is the app's overview/landing screen — it **"shows an overview of your Calendar, tasks, and lists"** in one place, rather than a single-purpose full calendar grid.
- It's composed of three panes: a **Calendar pane** (rendering "day view or week view" — i.e., a compact calendar preview, not the full Month/Schedule modes), a **Tasks pane** ("available tasks for Profiles on the calendar," swipeable), and a **Lists pane** (lists in the account, also swipeable).
- Users can **"customize the home screen to show tasks, or lists, or both tasks and lists along with your calendar"** — both panes are independently show/hideable via a "Customize" menu, meaning the Home Screen's layout is user-configurable, not fixed.
- An **Add button** on the Home Screen creates a new task or event directly from this overview, and tasks can be **"marked as done from the Home Screen"** itself (i.e., chore-checking doesn't require drilling into the Tasks tab).
- This effectively answers (with high confidence, though not 100% certainty it's *literally* the first screen after a cold boot vs. Sleep Mode wake) what the device shows on landing: the **Home Screen**, not directly the full Calendar tab — the full Day/Week/Month/Schedule views live one tap away via "Using the Calendar Tab." `[VERIFIED]` for Home Screen being the first nav tab; boot-vs-wake-specific confirmation remains `[INFERRED]`.

## Midnight / day-change and idle/auto-return behavior

- `[UNKNOWN]` — No source directly describes what happens on-screen at midnight (does Day view auto-advance live? does a static Day view go stale until touched?). Not found in any fetched review or support doc.
- `[UNKNOWN]` — No source confirms whether the device auto-returns to the Calendar tab / Today after a period of inactivity on some *other* tab (e.g., left on Tasks or Photos-album-picker). The **only** documented idle-triggered behavior found is the **Photo Screensaver** activating after 1–10 minutes of inactivity (configurable), which is a distinct, opt-in (Plus-gated) feature, not a "return to Today" behavior. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36835919949339-Photo-Settings)` for the screensaver-timeout mechanism itself.
- **Sleep Mode** is a separate, scheduled (not idle-triggered) power state: "Skylight Calendar's Sleep Mode ensures your screen goes to sleep at the same time each night and wakes up at the same time each morning." One reviewer (Reviewed.com) set it 10 p.m.–6 a.m. and called it *"one of my favorite small features."* A second reviewer (Alyssa Rachelle, year-long owner) independently confirms the same mechanism, describing it as setting "the Skylight to 'sleep' during off-hours." `[VERIFIED](https://www.reviewed.com/smarthome/content/skylight-calendar-2-review)`, `[VERIFIED](https://alyssa-rachelle.com/skylight-calendar-review/)`, mechanism description `[VERIFIED]` (WebSearch synthesis of Skylight support content)
- Default view on boot / after Sleep Mode wake: the **Home Screen** is confirmed as the first Navigation-bar tab and general landing overview (see above) — this is the closest available answer, though whether the device literally re-lands on the Home Screen specifically after a Sleep Mode wake (vs. resuming whatever was on screen before sleep) is not separately confirmed. `[VERIFIED]` (Home Screen = first tab) + `[INFERRED]` (this is also the post-wake destination)
- 2026 release note "Weather and Events on Screensaver" (Aug 27, 2026) — "Enhanced idle display with weather and event information" — confirms the screensaver is not purely a photo slideshow; it can overlay upcoming events and weather (this generalizes/extends the earlier documented Photo Settings toggles for "Weather," "Time and date," "Upcoming events," and "Countdowns" overlays). `[VERIFIED](https://releasebot.io/updates/skylight)` for the release note; `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36835919949339-Photo-Settings)` for the underlying toggle set that predates it.

## Parental lock in practice

- Support documentation found is thin and centers on PIN **recovery**, not on first-time setup or exact scope of what gets locked. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/35089525796251-Parental-Lock)` (article fetched, confirmed limited)
- To disable Parental Lock when the PIN is known: "tap the Parental lock switch to disable the parental lock PIN" (implies a toggle switch, likely in General Settings, gated behind PIN entry). `[VERIFIED]` (WebSearch synthesis of Skylight support content)
- PIN recovery flow, confirmed directly from the support article:
  1. Tap **"Forgot PIN?"** in the PIN entry dialog.
  2. Tap **"Send email"**.
  3. A reset/magic link is emailed to "the personal email associated with the Skylight account."
  4. Alternative: contact Skylight customer support, who "can assist by manually resetting the Parental Lock."
  `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/35089525796251-Parental-Lock)`
- Parental Lock lives under **General Settings** per the related article title ("General Settings" cross-references Parental Lock as a subsection). `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36835387462555-General-Settings)` (existence of cross-reference), exact settings-screen location `[UNKNOWN]`
- **What gets locked, in an owner's own words:** a reviewer (Mama of Minis) directly states the scope: **"the parental lock prevents children from creating and editing routines, chores, etc."** — i.e., the lock is scoped to task/routine/chore *authoring and editing*, not just to Settings, and specifically to keep kids from tampering with the chore system (adding fake chores, editing star values, deleting assignments) rather than gating simple event viewing. `[VERIFIED](https://mamaofminis.com/skylight-calendar-review/)` — this is the single clearest owner-sourced statement of Parental Lock's actual scope found in this research pass, and meaningfully narrows the earlier `[UNKNOWN]`.
- Whether the lock *also* covers Settings access, event deletion, or general navigation (beyond Tasks/Routines/Chores editing specifically) is still not separately confirmed — `[UNKNOWN]`.
- No reviewer or owner post found describing what it *feels like* to hit the lock in daily use (e.g., "my kid couldn't delete an event," "I have to unlock it every time I want to add something"). `[UNKNOWN]`

## Celebrations

### Chore/task completion
- Baseline (non-Disney) behavior per Tasks support article: completing a task earns **stars**, redeemable for **Rewards**; the article does **not** describe any animation or sound for baseline completion. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)`
- **Direct owner description of the visual effect (Skylight Calendar Max, WeTried.it review):** *"My kids actually enjoy doing their chores because they get to check off a task like 'make your bed' and **watch the stars dance across the screen**."* This is the most concrete, first-hand description of the completion animation found — stars visibly animate/move across the screen on task completion, independent of Disney Mode. `[VERIFIED](https://wetried.it/skylight-calendar-max-review/)`
- Skylight's own baseline celebration (independent of Disney Mode) is described in the Disney Mode announcement as **"Skylight's randomized emoji rain"** — implying that even without Disney Mode active, completing tasks triggers an emoji-rain animation on the device, and Disney Mode's sticker bursts *alternate* with this existing baseline emoji rain rather than fully replacing it. `[VERIFIED](https://myskylight.com/introducing-skylight-disney-mode/)` — quote: "a playful burst — alternating between stickers inspired by their chosen franchise and Skylight's randomized emoji rain — turning chores into rewarding moments kids feel proud of." A third reviewer (Alyssa Rachelle) independently corroborates the emoji framing, describing kids who "track progress, and earn **emoji-filled rewards**." `[VERIFIED](https://alyssa-rachelle.com/skylight-calendar-review/)`
- No source confirms or denies a **sound effect** accompanying completion/celebration (chime, cheer, etc.) — `[UNKNOWN]`. Note this is distinct from the confirmed **reminder chime** (see Notifications & Reminders below), which plays for upcoming-event/task alerts, not for completion celebrations.

### Star values and reward redemption mechanics
Source: "Stars, Tasks, and Rewards" support article. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846200077723-Stars-Tasks-and-Rewards)`
- Parents set a star value per task at creation time, with wide suggested range: **"a handful of stars (five to ten stars) for daily routines"** up to **"a large number of stars (one hundred stars!) for finishing a big, important chore."**
- Accrued stars are tracked per-Profile and surfaced in a dedicated **Rewards tab**.
- Creating a Reward sets its redemption cost, **1–500 stars**; redeeming a Reward deducts that many stars from the Profile's balance and **"cannot be used for another reward"** (i.e., stars are consumed/spent, not left ambiguous).
- **Device/app parity gap (owner-reported):** one reviewer (Mama of Minis) notes **"you are only able to input the number of desired stars for each routine/chore through the phone app"** — star-value assignment is app-only, not settable directly on the device touchscreen. `[VERIFIED](https://mamaofminis.com/skylight-calendar-review/)`

### Reward redemption
- Redeeming a Reward triggers "themed celebrations that make incentives feel more exciting" under Disney Mode. `[VERIFIED](https://myskylight.com/introducing-skylight-disney-mode/)`
- Baseline (non-Disney) reward-redeem confetti: not explicitly confirmed by name, though "confetti" is referenced obliquely by third-party content (a TikTok discovery-page title "Change Confetti on Skylight Calendar" and another "Skylight Chores Confetti" imply confetti is a real, user-recognized, and apparently *customizable* animation independent of Disney Mode) — but no primary-source article was fetched describing it directly. `[INFERRED]` from TikTok topic-page titles surfaced in search; direct confirmation `[UNKNOWN]`.

### Disney Mode (launched 2026, Skylight Plus add-on)
Full detail from Skylight's own announcement: `[VERIFIED](https://myskylight.com/introducing-skylight-disney-mode/)`
- **Availability:** opt-in add-on for Skylight Plus members in the US, Canada, UK, and Australia; can be "turned on or off at any time."
- **Task-completion celebration:** "a playful burst — alternating between stickers inspired by their chosen franchise and Skylight's randomized emoji rain."
- **Reward-redemption celebration:** "themed celebrations."
- **Profile personalization:** 16 Disney/Pixar/Marvel/Star Wars character profile icons to choose from.
- **Screensaver integration:** "a rotating collection of Disney, Pixar, Marvel and Star Wars artwork can transform the calendar into a nostalgic screensaver throughout the day" — i.e., Disney Mode swaps in franchise artwork as screensaver content, on top of (or as an alternative to) personal photos.
- **Featured characters called out by name:** Stitch, Moana, Elsa ("and more").
- **Framing/marketing language:** described as bringing "emotional resonance to the structure families already rely on," with characters "cheering them on" during task completion.
- Separately, the Aug 24, 2026 release note "Buddy Characters" — "New companion characters added to the platform" — may be a related or overlapping feature to Disney Mode's character system, though the release note doesn't explicitly tie it to the Disney IP partnership. `[VERIFIED](https://releasebot.io/updates/skylight)` for the note; the connection to Disney Mode is `[INFERRED]`.

### Birthdays
- Profiles support an optional "Birthday" field ("tap **Birthday** to set a birthday for the Profile"), confirmed elsewhere in this research set. How a birthday renders on the calendar (recurring all-day event? banner? cake icon? special animation on the day?) is **not** documented in any source fetched for this file. `[UNKNOWN]`
- No dedicated "birthday celebration" animation (distinct from the general task/reward celebration system) was found in any source. `[UNKNOWN]`

## Profile / "who am I" attribution on-device

- There is **no evidence of a profile-selection or "who am I" login/PIN gate** on the device itself for everyday interaction (e.g., before checking off a chore). The device instead appears to attribute completion by **which task/chore was tapped**, not by who is standing at the screen: tasks are pre-assigned to one or more Profiles at creation time ("Tap **Assign** to assign the task to one or more Profiles... All tasks need to be assigned to at least one Profile"), and completing that specific task item (via its checkbox) is what registers the completion — the system does not appear to separately ask "who are you" before allowing the tap. `[VERIFIED]` (task-assignment mechanism, from Tasks support article) + `[INFERRED]` (no login gate) — this is the most direct explanation available for the "siblings checking off siblings' chores" failure mode owners report (see Edge Cases below): anyone standing at the shared screen can tap any visible chore's checkbox regardless of whose name it's assigned to, because there's no per-person authentication step, only a pre-assigned label.
- Only gate found anywhere in the product that resembles a "who may do this" check is **Parental Lock** (PIN), which is scoped to settings/administrative actions, not to routine task-checking. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/35089525796251-Parental-Lock)`
- "Up for Grabs" chores are explicitly the *opposite* of per-person attribution — they exist specifically to be claimable by anyone in the household ("aren't assigned to anyone and can be claimed by whoever gets to them first"), reinforcing that the device's normal task model is shared-access, not identity-gated. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/49525040352795--Feature-Up-for-Grabs-Chores)` (WebSearch synthesis)
- Per-person **filtering** exists as a *viewing* convenience (Reviewed.com: filtering "transformed chaotic family calendars into readable ones... allowing views of individual family members' schedules separately") — but filtering the view is different from authenticating as that person; it's a display filter, not a login. `[VERIFIED](https://www.reviewed.com/smarthome/content/skylight-calendar-2-review)`

## Photos as screensaver

Primary source: Photo Settings support article. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36835919949339-Photo-Settings)`
- **Gating:** Photo Screensaver requires a Calendar Plus subscription.
- **Idle timeout:** "Turn on after (minutes)" slider, range **1–10 minutes**. The screensaver is suppressed while a Recipe is displayed (i.e., it has at least one documented exception/interrupt condition).
- **Overlays available on top of photos:** "Weather" (requires a valid address on file), "Time and date," "Upcoming events," "Countdowns" — all independently toggleable. The Aug 27, 2026 release ("Weather and Events on Screensaver") appears to be an enhancement/expansion of this same overlay system. `[VERIFIED](https://releasebot.io/updates/skylight)`
- **Media types:** supports both photos *and videos*; a "Video sound off by default" toggle auto-mutes video playback in the rotation.
- **Ordering:** "Chronological" (upload order) or "Shuffle" (random).
- **Background fill for non-matching aspect ratios:** either a "Blur effect" (blurred edge fill) or solid "Black" border.
- **Source selection:** "Album" picker — all media, or a specific album curated via the Mobile App.
- **How to wake the screen from the screensaver:** not documented in any source — `[UNKNOWN]`. (Reasonably a simple tap given it's a touchscreen, but no source states this explicitly. `[INFERRED, weak]`)
- **Reviewer reaction (Chris Loves Julia):** *"The kids love it"* — rotating family photos make "the calendar feel more personal." `[VERIFIED](https://chrislovesjulia.com/skylight-calendar-review/)`
- **Disney Mode overlap:** Disney Mode can substitute "a rotating collection of Disney, Pixar, Marvel and Star Wars artwork" as screensaver content instead of/alongside personal photos. `[VERIFIED](https://myskylight.com/introducing-skylight-disney-mode/)`

## Weather

- **Source/provider:** not identified by name in any fetched source (no article names the underlying weather API/vendor). `[UNKNOWN]`
- **Location:** defaults to IP-address-derived location; user can enter a physical address in Settings on the **device itself** ("Enter an address for more accurate weather data") for improved accuracy — address entry is device-only, not available in the mobile app. `[VERIFIED]` (WebSearch synthesis of Skylight support content)
- **Units:** US addresses default to Fahrenheit, non-US to Celsius; user can override the unit regardless of location. `[VERIFIED]` (WebSearch synthesis of Skylight support content)
- **Display locations:**
  - Information bar along the top of the Calendar screen shows current local temperature/conditions, typically upper-left. `[VERIFIED]`
  - **Per-event weather:** tapping an event shows a forecast for that event *only if* the event is within 7 days AND has a valid address attached — the event's own address (not the household address) drives the forecast shown. `[VERIFIED]` (WebSearch synthesis of Skylight support content)
  - Without any address configured, the device shows "an exclamation mark icon at the top of the device instead of the weather icon" — a clear, named error-state indicator. `[VERIFIED]` (WebSearch synthesis of Skylight support content)
  - **Weather in Month view** was a mid-2026 addition (Jul 7, 2026 release note), meaning weather was previously visible only in the info bar / per-event, not inline in the Month grid. `[VERIFIED](https://releasebot.io/updates/skylight)`
- **Availability:** weather functionality is US-only. `[VERIFIED]` (WebSearch synthesis of Skylight support content) — note: potentially superseded/expanded since, as Disney Mode and other 2026 features expanded to Canada/UK/Australia; whether weather specifically remains US-only as of Aug 2026 is `[UNKNOWN]`.
- **Owner critique (year-long review, Alyssa Rachelle):** *"Weather widget = very basic"* — listed alongside "no smart speaker integration" and "no audio reminders" as one of three persistent gaps after a year of ownership. `[VERIFIED](https://alyssa-rachelle.com/skylight-calendar-review/)`

## Notifications & Reminders

Source: "Reminders Settings" support article, plus corroborating release-log and Best Buy Q&A material. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36836043247131-Reminders-Settings)` unless noted otherwise.
- **Two notification mechanisms, confirmed by name:** an **on-screen popup** (shows scheduled events/tasks) and a **chime sound**, whose volume is adjustable in General settings.
- **Timing options for calendar-event reminders:**
  - **"At time of event"** — toggle to alert exactly when an event starts.
  - **"Minutes before event"** — toggle plus a custom lead time, range **1–120 minutes**.
- **Task-specific reminders:** a **"When Due"** option exists for tasks, but only for **tasks that have an assigned time** (time-less chores can't get a due-time reminder).
- **Sound toggle:** "Enable Reminder sound if you would like Calendar to play a chime when displaying a reminder popup" — i.e., the popup and the chime are independently controllable (you can have a silent popup).
- Configuration path: **Settings → Reminders** on the device; settings apply as defaults across all calendar events (with per-event overrides available elsewhere per the Calendar-tab research, e.g., "How do I set per-event reminders").
- **Push notifications were explicitly NOT available for a period, then added:** a Best Buy Q&A response states *"currently, in-app push notifications are unavailable, but Skylight is actively working on making this feature accessible in the near future"* — and indeed, the "Task Due Reminders" release (Jun 30, 2026) later shipped exactly this, offering alerts "via push or pop-up alerts." This is a useful before/after data point: **push notifications are a mid-2026 addition**, not a day-one capability. `[VERIFIED]` (WebSearch synthesis of Best Buy Q&A) for the "unavailable" state; `[VERIFIED](https://releasebot.io/updates/skylight)` for the later ship date.
- **Owner critique (year-long review, Alyssa Rachelle):** explicitly lists **"No audio reminders shouting 'Get your backpack!'"** as a still-missing capability after a year of ownership — i.e., even with chimes/popups, there's no spoken/voice-announcement reminder style. `[VERIFIED](https://alyssa-rachelle.com/skylight-calendar-review/)`

## Owner-reported edge cases and complaints

| Complaint / quirk | Source | Tag |
|---|---|---|
| Month view "gets cramped and hard to read" on the smaller (15") screen with heavy daily activity — explicitly called "the weak spot for the Skylight Calendar." | Reviewed.com | `[VERIFIED](https://www.reviewed.com/smarthome/content/skylight-calendar-2-review)` |
| No magnetic fridge mount on Calendar 2 — a "primary complaint" for the reviewer's intended placement. | Reviewed.com | `[VERIFIED](https://www.reviewed.com/smarthome/content/skylight-calendar-2-review)` |
| Grocery/shopping list "doesn't sync with outside apps" (e.g., AnyList) — isolated from the family's existing grocery-app workflow. | Reviewed.com | `[VERIFIED](https://www.reviewed.com/smarthome/content/skylight-calendar-2-review)` |
| Chore-tracking honesty/attention gap: chores "kids were going to do anyway would be forgotten, and then marked complete a week's worth right when they wanted to cash in the rewards" — i.e., batch-checking-off stale chores right before reward redemption, undermining the tracker's accuracy. | thediyplaybook.substack.com (quoted via search synthesis) | `[VERIFIED]` (quote surfaced via WebSearch synthesis; full article 403'd on direct fetch) |
| Time zone mismatches: events show at the "wrong" time when a synced source calendar's time zone doesn't match the Skylight device's configured time zone; explicitly called out for **Yahoo and AOL** calendars, which "require you to manually change your time zone" on the source side. | Skylight support ("Why are my events showing up at the wrong time?") | `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360033876271-Why-are-my-events-showing-up-at-the-wrong-time)` (title/topic confirmed via search synthesis; full body not separately fetched) |
| Wi-Fi as a troubleshooting step: Skylight's own support guidance for time/sync problems includes "resetting your Wi-Fi connection," implying Wi-Fi flakiness is a common enough cause of stale/incorrect calendar data that it's a standard first fix. | Skylight support (Troubleshooting section) | `[VERIFIED]` (WebSearch synthesis) |
| Customer-service complaints (delivery failures, "no phone support and only AI responses," a "sneaky subscription to use some features," perceived poor value) — sourced from Trustpilot-style aggregator commentary rather than a single named reviewer. | Trustpilot / aggregator review synthesis | `[VERIFIED]` (WebSearch synthesis of Trustpilot review content); individual reviewer attribution `[UNKNOWN]` |
| **One-way vs two-way sync is the single most-repeated complaint across independent reviews:** "Google Calendar is the only one with full two-way syncing. If you use Outlook, Apple, Cozi, or Yahoo, it's still do-able, but it's a little clunky" (WeTried.it); "Only Google offers full two-way integration, while other services like Outlook, iCloud, Cozi sync only one-way or need manual adjustments" (Absolute Gadget); Apple Calendar specifically called out as one-way-only with two-way "promised... before the end of the year" (Shortlist.com, UK reviewer). Independently corroborated by **three separate reviewers** of two different hardware models (Calendar 2 and Calendar Max). | WeTried.it, Absolute Gadget, Shortlist.com | `[VERIFIED](https://wetried.it/skylight-calendar-max-review/)`, `[VERIFIED]` (Absolute Gadget, WebSearch synthesis), `[VERIFIED]` (Shortlist.com, WebSearch synthesis) |
| **Wi-Fi dependency called out explicitly as a hard failure mode, not just a sync delay:** *"It's basically useless without Wi-Fi. If your internet goes down, so does your calendar functionality."* | WeTried.it (Calendar Max review) | `[VERIFIED](https://wetried.it/skylight-calendar-max-review/)` |
| **Sync failure requiring a manual power-cycle:** *"We couldn't get our calendar to sync originally. We reached out to customer support and they had us simply restart the Skylight Cal Max by unplugging and plugging back in."* — i.e., Skylight's own support's first-line fix for a stuck sync is a hard reboot. | Absolute Gadget (Calendar Max review) | `[VERIFIED]` (WebSearch synthesis) |
| **Calendar Max app-dependency complaint:** *"Many key features, like toggling calendars or creating profiles, require the companion app, which can feel inconvenient"* — explicitly called "cumbersome for users who prefer managing settings directly on the device." Corroborates the separately-found "stars can only be set via the app" gap (see Celebrations section) as part of a broader device/app parity pattern. | Absolute Gadget | `[VERIFIED]` (WebSearch synthesis) |
| **Calendar Max hardware install friction:** the power adapter is large enough that *"you'll need a recessed outlet to avoid visible cords, which might complicate setup,"* and may "affect mounting options, especially if you prefer a horizontal orientation." | Absolute Gadget | `[VERIFIED]` (WebSearch synthesis) |
| **Subscription-gating is a recurring complaint theme across multiple independent reviewers, not just one:** *"too many features are hidden behind the subscription aspect"* with Photo Screensaver specifically singled out as feeling unwarranted given its simplicity (Shortlist.com, UK); *"Accessing the digital photo frame functionality requires a Skylight Plus membership, adding an ongoing cost"* — "basic features like displaying photos are locked behind a monthly paywall" (Absolute Gadget); *"without the addition of Skylight Plus, the skylight calendar may not be worth the money in our opinion"* (Mama of Minis); a Bless'er House reviewer separately says "the price and subscription do give them pause." | Shortlist.com, Absolute Gadget, Mama of Minis, Bless'er House | `[VERIFIED]` (WebSearch synthesis, all four) |
| Grocery/shopping list "doesn't sync with outside apps" (e.g., AnyList) — isolated from the family's existing grocery-app workflow. | Reviewed.com | `[VERIFIED](https://www.reviewed.com/smarthome/content/skylight-calendar-2-review)` |
| **Conflicting reports on Calendar Max weather support:** WeTried.it's review describes "weather forecasts tied to event locations and times" as present, while Absolute Gadget's review of the same product states plainly that "the review notes the device lacks weather integration." These two Calendar Max reviews directly contradict each other — flagged as an open discrepancy rather than resolved. | WeTried.it vs. Absolute Gadget | `[VERIFIED]` (both, WebSearch synthesis) — **contradiction noted, not resolved** |
| On-device typing is more friction than the app: one reviewer notes event entry via the mobile app is *"arguably easier"* than the on-screen keyboard, implying the on-device keyboard flow is the less-preferred path when the app is available. | Shortlist.com | `[VERIFIED]` (WebSearch synthesis) |
| Reddit-specific complaint threads (r/SkylightCalendar, r/skylight) could **not** be retrieved — `old.reddit.com` and `www.reddit.com` were both blocked/unreachable by the fetch tool in this environment (old.reddit.com: "unable to fetch"; www.reddit.com/.json: "unable to fetch"). WebSearch queries targeting `site:reddit.com` did not surface specific Reddit threads either. This is a genuine coverage gap for this file. | — | `[UNKNOWN]` — flagged as an explicit research limitation, see Open Questions. |
| "Too many profiles" cramping the UI, "long event titles" truncation/wrapping behavior, and "overlapping event" rendering rules (side-by-side columns vs. stacking vs. z-order) — no source (review or support doc) was found describing these specifically. | — | `[UNKNOWN]` |
| Recurring-event editing pain: Skylight does implement a standard three-way edit-scope prompt on recurring events — "This event" (single instance), "This and following events," or "All events" (confirmed in the context of per-event reminder edits) — but no reviewer or owner complaint about this flow specifically was found, despite it being a common pain point in competing calendar apps. | Skylight support (per-event reminders context) | `[VERIFIED]` (WebSearch synthesis) for the flow's existence; complaint sentiment `[UNKNOWN]` |

## Skylight Masterclass videos and YouTube walkthroughs

- The official Masterclasses hub article lists exactly **two** live/recurring Masterclass sessions (not on-demand video library entries but Calendly-bookable live sessions): `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30401784361499-Skylight-Calendar-Masterclasses)`
  1. **"Skylight Calendar 101 - New User Masterclass"** — described as helping "get you started with all of the basic features of your Skylight Calendar."
  2. **"Sidekick and Plus for Skylight Calendar"** — described as covering "the advanced features offered with our Plus Subscription that can help simplify a busy household."
  - Both are booked via `calendly.com/skylightconcierge` — i.e., these are **live concierge sessions**, not static pre-recorded videos, which explains why the support page itself carries little embedded video detail.
- A YouTube video also titled **"Skylight Calendar 101- New User Masterclass"** exists (`youtube.com/watch?v=FCmFuKiBBeo`), separately confirmed via WebSearch to have been uploaded **December 2024** and to cover "device settings, the Plus Photo Screensaver, and syncing iCalendars." Direct WebFetch of the video page returned only YouTube's page footer (no title/description metadata reachable by the fetch tool in this environment) — the December 2024 upload date and content summary come from WebSearch result synthesis, not a direct page fetch, and should be treated as lower-confidence. `[VERIFIED, low-confidence]` (WebSearch synthesis only)
- Additional related YouTube videos surfaced by search (not fetched in detail due to the same YouTube page-fetch limitation encountered above):
  - **"Skylight Plus Master Class"** (`watch?v=IXpGdqgJb6Q`) — uploaded January 2025 per search snippet. `[VERIFIED, low-confidence]`
  - **"Skylight Calendar Setup Tutorial | Get Your Family Organized FAST"** (`watch?v=F-g4Qqk9yRk`). `[UNKNOWN]` content detail
  - **"Getting To Know Skylight Calendar"** — a YouTube **playlist** (`playlist?list=PLnu71u5SgCSWt-5IHPsxgkAow_DfOj1Lp`), implying a multi-part official walkthrough series exists beyond the two Masterclasses. `[UNKNOWN]` per-episode content
  - **"Watch Me Unbox and Set Up My Skylight Calendar From Scratch"** and **"How-to: Setting Up Your New Skylight Calendar"** — unboxing/setup-focused, not deep UX walkthroughs per their titles. `[UNKNOWN]` content detail
  - **"3 Skylight Calendar Hacks to Try This Summer"** (YouTube Short) — implies informal power-user tips content exists in short-form video. `[UNKNOWN]` content detail
- **Limitation:** the WebFetch tool in this environment could not retrieve YouTube video description text directly (returns only page chrome/footer, not the player metadata) for any of the above. This is a genuine tool limitation encountered, not a decision to skip; content summaries above are WebSearch-snippet-derived only and are flagged low-confidence accordingly.

## Timeline of software features (release notes)

Source: Releasebot.io's Skylight changelog aggregator, fetched directly. `[VERIFIED](https://releasebot.io/updates/skylight)` for every row below. Only entries from roughly the last two months (per the page's default view — attempts to page further back returned the same content, meaning older history was not reachable through this source) — this is a **partial** timeline, most recent entries only:

| Date (2026) | Feature | Description (as given) |
|---|---|---|
| Aug 27 | "Weather and Events on Screensaver" | Enhanced idle display with weather and event information |
| Aug 24 | "Up For Grabs Improvements" | Refinements to the Up For Grabs feature |
| Aug 24 | "Buddy Characters" | New companion characters added to the platform |
| Aug 17 | "More Supported Languages" | Expanded language support for global accessibility |
| Aug 6 | "The Calendar Home Screen Supports Day View" | Added daily view option to calendar interface |
| Aug 3 | "Repeat a Chore After Completion" | Tasks can now be configured to recur automatically |
| Jul 29 | "Swipe for Month View" | Gesture-based navigation added for monthly calendar browsing |
| Jul 15 | "Start the Month With the Current Week" | Calendar now defaults to showing the current week when opening monthly view |
| Jul 7 | "Weather in Month View" | Weather data integrated into the month calendar display |
| Jun 30 | "Task Due Reminders" | Notifications for upcoming task deadlines, via push or pop-up alerts |
| Jun 25 | "Swipe Navigation in the Mobile App Calendar" | Left/right swipe gestures added for browsing past and future events in the app |
| Jun 25 | "Reorder Routines" | Users can resequence routines in day view |

### Other dated milestones gathered outside the Releasebot log
- **CES 2026 (~Jan 7, 2026):** Skylight Calendar 2 unveiled — "sleeker design than the original 15-inch calendar but smaller than the 27-inch wall-mounted Calendar Max," 20% thinner, magnetic swappable Snap Frames, brighter/more color-accurate display, "3x faster performance," touch response "noticeably quicker" per Forbes Vetted. Sidekick AI announced alongside it (flyer-photo event extraction, fridge-photo recipe suggestions), gated to Skylight Plus ($79/yr) and priced at $380 for the device. `[VERIFIED](https://techcrunch.com/2026/01/07/skylight-debuts-calendar-2-to-keep-your-family-organized)`, pricing/Plus-gating `[VERIFIED]` (WebSearch synthesis of Forbes Vetted content, direct fetch 403'd)
- **2026 (exact date unconfirmed):** Disney Mode add-on launched (16 character profile icons; Stitch/Moana/Elsa etc.; task-completion sticker bursts + emoji rain; themed reward-redemption celebrations; franchise-artwork screensaver), for Skylight Plus members in US/Canada/UK/Australia. `[VERIFIED](https://myskylight.com/introducing-skylight-disney-mode/)`
- **Prior hardware milestone (pre-2026, for context):** Skylight Calendar Max (27") launched — press release dated **Jan 30, 2024** per Business Wire, "A Beautifully Designed Large Screen Smart Family Calendar." `[VERIFIED](https://www.businesswire.com/news/home/20240130407306/en/Skylight-Launches-27-Inch-Calendar-Max-A-Beautifully-Designed-Large-Screen-Smart-Family-Calendar)` (title/date only; body not separately fetched for this file — de-prioritized as background context since Calendar Max's hardware form factor is out of this file's UX-behavior scope)

**Note on Timeline completeness:** the Releasebot aggregator's list did not extend earlier than late June 2026 despite requesting an older page — attempts to page back (`?page=2`) returned identical content, suggesting either the source only surfaces a rolling recent window or the aggregator only began tracking Skylight in mid-2026.

### Skylight's own "What's New" support category — fuller date index (titles not recoverable)
Skylight maintains a primary **"What's New" support category** directly on its own Zendesk (`skylight.zendesk.com/hc/en-us/categories/42813896436763-What-s-New`), organized into at least two sub-tracks: a **"Calendar"** track and a separate **"Buddy"** track (the latter presumably tracking the Buddy Characters companion-character feature line). `[VERIFIED](https://skylight.zendesk.com/hc/en-us/categories/42813896436763-What-s-New)` for the category's existence and structure — but the fetch tool could only recover the **dates** of entries, not their titles/descriptions (the page's article titles did not render to the fetcher). This extends the known release cadence significantly further back than the Releasebot log:

**Calendar track dates found (most recent first):** Aug 27, Aug 24, Aug 17, Aug 6, Aug 3, Jul 29, Jul 15, Jul 7, Jun 30, Jun 25, Jun 22, Jun 9, Jun 1, May 13, Apr 30, Apr 27, Apr 23, Apr 14, Apr 7, Mar 17, Mar 9, Feb 24, Feb 13, Feb 9, Feb 4, Jan 26 (all 2026), then Dec 1 2025, Nov 10 2025, Oct 29 2025, Aug 25 2025 — i.e., Skylight has shipped a "What's New" entry roughly **every 1–3 weeks** since at least August 2025, with a visible gap between Dec 2025 and Jan 2026 (no entries logged for that stretch in what was recovered).

**Buddy track dates found:** Aug 24, Aug 11, Aug 4, Jul 17, Jul 15, Jul 2, Jun 12 (all 2026) — a separate, parallel release cadence specifically for the Buddy Characters feature line, suggesting it's developed/shipped somewhat independently of core Calendar features.

Two of the dated-but-title-recovered entries from this window, found via targeted follow-up searches:
- **May 13, 2026:** three features shipped together — **"Profiles and Labels,"** **"Task Description,"** and **"Remove Stars"** (exact per-feature descriptions not recovered — titles only, via WebSearch synthesis of the category listing). `[VERIFIED, low-confidence]` (title-only, via search snippet)
- **Apr 30, 2026:** **"Home Screen"** shipped — matches the dedicated Home Screen support article (see "Calendar views in practice" above): the Home Screen "shows an overview of your Calendar, tasks, and lists," with the weekly-events pane always visible and tasks/lists independently toggleable. This confirms the current Home Screen paradigm (nav-bar-first-tab, overview-of-everything) is itself a **2026 addition**, not present from the device's original launch. `[VERIFIED]` (date via search synthesis) + `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/49738702477723-The-Home-Screen)` (feature content)

A pre-August-2025 feature timeline (i.e., 2023–mid-2025 "What's New" history, covering the original Calendar and Calendar Max launch eras) was **not** established from primary Skylight sources in this pass — this remains a gap; see Open Questions.

## Open questions

1. **Long-press gesture:** Does the device support long-press anywhere (event edit shortcut, task-complete shortcut, day-cell "tap-and-hold to create an event")? No source confirms or denies this directly; all documented flows use tap-then-secondary-tap instead.
2. **Drag-and-drop for rescheduling events:** Is there a way to drag an event to a different day/time on the device grid itself? Drag-and-drop is confirmed for reordering mobile-app Routines and for reordering List items (both `[VERIFIED]`), but not for moving an *event* between days/times. The Notion-hosted public roadmap (`roadmap.ourskylight.com/484b83eda396400899300f233e692ff0`) likely has the authoritative planned/shipped answer but renders client-side and could not be scraped by the available fetch tool.
3. **Parental Lock full scope:** Partially resolved — an owner review confirms the lock scope includes "creating and editing routines, chores, etc." Still unconfirmed: whether it also covers Settings access, event deletion, or general navigation, and what the on-screen prompt/flow looks like the *first* time it's triggered (only the PIN-recovery flow was found in primary docs).
4. **Midnight/day-change behavior:** Does Day/Week/Today view live-update at midnight, or does it require a touch/refresh? Still unresolved.
5. **Idle auto-return-to-Today:** Is there any idle-triggered return to the Calendar/Home tab from other tabs (Tasks, Lists, Photos-picker, Settings) distinct from the opt-in Photo Screensaver? Still unresolved.
6. **Default view on boot / after Sleep Mode wake:** Largely resolved — the **Home Screen** ("first tab in the Navigation bar," an overview combining Calendar+Tasks+Lists panes) is confirmed as the app's landing screen. Whether this is literally what's shown immediately after a cold boot or a Sleep Mode wake specifically (vs. resuming a prior screen) remains `[INFERRED]` rather than directly confirmed.
7. **Birthday rendering on-calendar:** Still unresolved — no source describes whether a Profile's birthday renders as a recurring all-day event, banner, icon, or triggers its own celebration.
8. **Completion celebration sound:** Still unresolved for chore/reward celebrations specifically (visual-only vs. audible was not confirmed either way). Note this is now distinguished from the separately-confirmed **reminder chime** (Reminders Settings), which is a different, confirmed-audible feature for upcoming-event alerts, not for completion celebrations.
9. **Reddit community sentiment (r/SkylightCalendar, r/skylight, r/homeautomation):** could not be retrieved — both `old.reddit.com` and `www.reddit.com` JSON/HTML endpoints were unreachable by the available fetch tool in this environment, across multiple attempts. This remains the single biggest coverage gap against the assignment's stated source list; a follow-up pass with a different fetch method (e.g., a tool capable of reaching Reddit, or Google-cache/third-party Reddit mirrors) is recommended.
10. **Overlapping-event rendering and long-title truncation rules:** no source documents the exact layout algorithm (side-by-side columns, stacking with a "+N" indicator, text truncation/ellipsis/wrap) for either Day/Week grid overlaps or Month-cell long titles. Still unresolved despite a dedicated search pass.
11. **Recurring-event edit prompts:** partially resolved — the standard "This event / This and following events / All events" three-way edit-scope pattern is confirmed to exist (in the context of per-event reminders), but no owner complaint or UX friction specific to Skylight's implementation of it was found.
12. **Notification behavior in detail:** substantially resolved — see the new "Notifications & Reminders" section (on-screen popup + chime, "At time of event" / "Minutes before event" 1–120min / task "When Due," reminder-sound toggle, push notifications added mid-2026 via "Task Due Reminders"). Still unknown: quiet-hours behavior and whether Sleep Mode suppresses reminders.
13. **Pre-August-2025 feature timeline:** partially resolved — Skylight's own "What's New" category confirms a steady release cadence back to Aug 25, 2025 (dates only, titles not recoverable by the fetch tool), but nothing earlier (i.e., the original 2022–2024 Calendar/Calendar Max launch-era feature timeline) was established in this pass.
14. **Weather provider/vendor name** — still not identified.
15. Several review fetches returned HTTP 403 or failed outright (Forbes Vetted, Tom's Guide/CNET/The Verge/Wired/NYT-Wirecutter not located or inaccessible, chrislovesjulia.com on retry, thediyplaybook.substack.com and cubbyathome.com direct bodies, bsimbframes.com Calendar Max article) and had to be worked around via WebSearch-snippet synthesis rather than full-text quotes — flagged per-fact above with `[VERIFIED, low-confidence]` or noting the synthesis path; a follow-up with an alternate fetch method could upgrade these to full direct quotes.
16. **Contradictory Calendar Max weather claim:** two reviews of the same Calendar Max hardware directly disagree on whether weather integration exists (WeTried.it says yes, Absolute Gadget says no) — unresolved, flagged in the complaints table.

## Sources

### Skylight primary sources (support articles, official blog)
- Skylight Support — Calendar tab: https://skylight.zendesk.com/hc/en-us/articles/44738510847259-Calendar
- Skylight Support — Using the Calendar Tab: https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab
- Skylight Support — Using the Tasks Tab: Routines and Chores: https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores
- Skylight Support — Tasks: Routines and Chores: https://skylight.zendesk.com/hc/en-us/articles/44738601403931-Tasks-Routines-and-Chores
- Skylight Support — Stars, Tasks, and Rewards: https://skylight.zendesk.com/hc/en-us/articles/36846200077723-Stars-Tasks-and-Rewards
- Skylight Support — Parental Lock: https://skylight.zendesk.com/hc/en-us/articles/35089525796251-Parental-Lock
- Skylight Support — General Settings: https://skylight.zendesk.com/hc/en-us/articles/36835387462555-General-Settings
- Skylight Support — Photo Settings: https://skylight.zendesk.com/hc/en-us/articles/36835919949339-Photo-Settings
- Skylight Support — How Can I See Weather on My Calendar: https://skylight.zendesk.com/hc/en-us/articles/40451094691995-How-Can-I-See-Weather-on-My-Calendar
- Skylight Support — Why are my events showing up at the wrong time: https://skylight.zendesk.com/hc/en-us/articles/360033876271-Why-are-my-events-showing-up-at-the-wrong-time
- Skylight Support — [Feature] Up for Grabs Chores: https://skylight.zendesk.com/hc/en-us/articles/49525040352795--Feature-Up-for-Grabs-Chores
- Skylight Support — [Feature] Calendar Lists Improvements: https://skylight.zendesk.com/hc/en-us/articles/51482785426075--Feature-Calendar-Lists-Improvements
- Skylight Support — Profiles and Labels: https://skylight.zendesk.com/hc/en-us/articles/44740240234139-Profiles-and-Labels
- Skylight Support — Skylight Calendar Masterclasses: https://skylight.zendesk.com/hc/en-us/articles/30401784361499-Skylight-Calendar-Masterclasses
- Skylight Support — Reminders Settings: https://skylight.zendesk.com/hc/en-us/articles/36836043247131-Reminders-Settings
- Skylight Support — The Home Screen: https://skylight.zendesk.com/hc/en-us/articles/49738702477723-The-Home-Screen
- Skylight Support — What's New (category index): https://skylight.zendesk.com/hc/en-us/categories/42813896436763-What-s-New
- Skylight Support — Calendar Features: https://skylight.zendesk.com/hc/en-us/articles/48778850390171-Calendar-Features
- Skylight (myskylight.com) — Introducing Disney Mode: https://myskylight.com/introducing-skylight-disney-mode/

### Reviews (owner/reviewer, real-world usage)
- Reviewed.com — Skylight Calendar 2 review: https://www.reviewed.com/smarthome/content/skylight-calendar-2-review
- Chris Loves Julia — Our Skylight Calendar Review: https://chrislovesjulia.com/skylight-calendar-review/
- The DIY Playbook (Substack) — We Tried The Skylight Calendar: https://thediyplaybook.substack.com/p/we-tried-the-skylight-calendar-heres
- WeTried.it — Skylight Calendar Max Review: https://wetried.it/skylight-calendar-max-review/
- Absolute Gadget — Skylight Calendar Max Review: https://absolutegadget.com/2025/08/10/skylight-calendar-max-review-the-27-inch-wall-brain-that-might-just-save-your-sanity/33310
- Shortlist.com — Skylight Calendar review: https://www.shortlist.com/tech/skylight-calendar-review
- Mama of Minis — Skylight Calendar Review: https://mamaofminis.com/skylight-calendar-review/
- Alyssa Rachelle — Skylight Calendar Review 2026 (year-long take): https://alyssa-rachelle.com/skylight-calendar-review/
- Cubby — I Tried the Skylight Calendar (title/topic located; full body 403'd): https://www.cubbyathome.com/skylight-calendar-review-80042154
- Bless'er House — Our Family Tried the Skylight Calendar: https://www.blesserhouse.com/our-family-tried-the-skylight-calendar-heres-what-we-loved-didnt/
- digicalendars.com — Skylight Calendar Display & View Settings Guide: https://digicalendars.com/skylight-calendar-display/

### News / industry coverage
- Releasebot.io — Skylight release/update log: https://releasebot.io/updates/skylight
- TechCrunch — Skylight debuts Calendar 2: https://techcrunch.com/2026/01/07/skylight-debuts-calendar-2-to-keep-your-family-organized
- Business Wire — Skylight Launches 27" Calendar Max: https://www.businesswire.com/news/home/20240130407306/en/Skylight-Launches-27-Inch-Calendar-Max-A-Beautifully-Designed-Large-Screen-Smart-Family-Calendar
- Morningstar/PR Newswire — Skylight Releases Calendar 2: https://www.morningstar.com/news/pr-newswire/20260317ny11053/skylight-releases-calendar-2-the-next-generation-of-its-viral-digital-family-calendar

### YouTube
- YouTube — "Skylight Calendar 101 - New User Masterclass": https://www.youtube.com/watch?v=FCmFuKiBBeo
- YouTube — "Skylight Plus Master Class": https://www.youtube.com/watch?v=IXpGdqgJb6Q

### Attempted but not accessible (fetch failures — see Open Questions #15)
- Skylight Calendar Roadmap (Notion): https://roadmap.ourskylight.com/484b83eda396400899300f233e692ff0 (client-side render, not scrapable)
- Forbes Vetted — Skylight Calendar 2 Review: https://www.forbes.com/sites/forbes-personal-shopper/article/skylight-calendar-2-review/ (403)
- Taste of Home — Skylight Calendar Review: https://www.tasteofhome.com/article/skylight-calendar-review/ (403)
- bsimbframes.com — Skylight Calendar Max Review: https://bsimbframes.com/blogs/bsimb-blogs/skylight-calendar-max-27-inch-review-worth-buying (timeout)
- r/SkylightCalendar and r/skylight (old.reddit.com and www.reddit.com both unreachable by fetch tool in this environment; no site:reddit.com results surfaced via WebSearch either)
- Tom's Guide, CNET, The Verge, Wired, NYT/Wirecutter — no Skylight Calendar review located at these outlets via WebSearch in this pass (Wirecutter is referenced as a *badge* on Amazon product listings, but no Wirecutter-authored review article itself was located)
