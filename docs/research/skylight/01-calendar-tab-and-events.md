# Skylight Calendar — Calendar Tab & Events

Research compiled 2026-08-28, for building a web-app clone of the **Calendar tab** and its event system on the Skylight Calendar device (models "Calendar 2" / "Calendar Max"; companion Skylight Mobile App; software as of 2025–2026). Every fact below is tagged `[VERIFIED](url)`, `[INFERRED]`, or `[UNKNOWN]`. Quoted strings are exact UI labels as found in Skylight's own help-center articles (or, where noted, in close-paraphrase search snippets of those same articles — several individual articles sit behind a Zendesk "agent sign-in" wall that blocked direct fetching after the first hop, so some facts are sourced via search-engine excerpts of that same URL rather than a raw fetch; this is flagged inline).

---

## 1. Device navigation & top ("information") bar

- The device's main navigation bar has 8 tabs — "Calendar", "Tasks", "Rewards", "Meals", "Photos", "Lists", "Sleep", "Settings" — positioned on the left edge in landscape orientation and along the bottom in portrait orientation. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36824456433051-Navigation-and-Menus)
- Above the active tab's content sits an "information bar" showing contextual info: by default the date, time, and local weather. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36824456433051-Navigation-and-Menus)
- Setting a custom **"Calendar display name"** (Settings > Calendar > Calendar display name) replaces the date shown in the information bar with that name while the Calendar tab is active — i.e., the header can show either a family/household name or the date, not both. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36824456433051-Navigation-and-Menus)
- The information bar shows "the current local temperature and weather conditions in your area" along the top of the screen. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/40451094691995-How-Can-I-See-Weather-on-My-Calendar)
- If no address is configured, an exclamation-mark icon appears at the top of the device in place of the weather icon. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/40451094691995-How-Can-I-See-Weather-on-My-Calendar)
- **View switcher**: tapping the top-right of the screen cycles/opens a picker among the four calendar views — "Day", "Week", "Month", "Schedule". One source instead describes it as "tap the top left of the screen to switch between Day, Week, Month, and Schedule views" [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360059869651-How-do-I-view-more-days-on-the-Schedule-view-on-my-Skylight-Calendar) — the two Skylight articles disagree on left vs. right, so exact screen position is [UNKNOWN]; treat as "a view-switcher button in the top corner of the information bar." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360033104791-How-do-I-change-the-view-of-my-calendar)
- **Today/prior/next controls**: Week, Month, and Schedule views each have "arrows in the upper right corner" to step to the previous/next period. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360033104791-How-do-I-change-the-view-of-my-calendar) A dedicated "Today" button/control returns the view to the present date/time from anywhere. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)
- The companion mobile app's calendar screen uses a distinct button bar with six controls: "Previous", "Today", "Next", a "Week / Month" toggle, "Filter" (show/hide Profiles), and "Search". [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/45755784991131-Calendar) — note the mobile app only offers Week/Month (no Day/Schedule) per this source; treat as app-only, not device.
- TODO/[UNKNOWN]: precise clock format (12h vs 24h, whether seconds shown), and whether weather in the info bar is a single current-conditions icon+temp vs. also showing high/low.

## 2. The four calendar views (device)

Baseline capacities and switching mechanics: [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/48026687853083-Example-Calendar-Views) and [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360033104791-How-do-I-change-the-view-of-my-calendar) unless noted otherwise.

### 2.1 Schedule view
- "Displays the next one to seven days of your calendar, one day per column." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/48026687853083-Example-Calendar-Views)
- The number of days shown is **user-configurable**, not fixed by orientation: Settings > Calendar > **"Days displayed in Schedule View"** is a slider from 1–7 days ("You can choose to display 1-7 days at a time"). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360059869651-How-do-I-view-more-days-on-the-Schedule-view-on-my-Skylight-Calendar) This setting also has a "Start on current day" companion option (see §4). [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/36835449004315-Calendar-Settings)
- In addition to (or instead of) the settings slider, users can pinch/zoom with two fingers directly on-screen to increase or decrease the displayed hour range/day span. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360033104791-How-do-I-change-the-view-of-my-calendar) The relationship between the settings-slider day-count and the live pinch gesture (whether pinch temporarily overrides the slider, or pinch adjusts vertical hour-density while the slider controls horizontal day-count) is [UNKNOWN] — the two mechanisms are documented in separate articles that don't cross-reference each other.
- Swipe left/right moves between previous/future dates; swipe vertically scrolls through a day's events. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360033104791-How-do-I-change-the-view-of-my-calendar)
- Tap-and-hold a blank space creates a new event at that time slot. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360033104791-How-do-I-change-the-view-of-my-calendar)
- Displays event lengths and overlaps across the customizable time span (i.e., overlapping events render side-by-side within a day's column, similar to a Day/Week grid). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360033104791-How-do-I-change-the-view-of-my-calendar)
- Multi-day events render as a single bar spanning the days. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)
- Distinct landscape-vs-portrait fixed day counts (independent of the slider): [UNKNOWN] — not stated in any fetched source; the "Example Calendar Views" article explicitly notes Schedule is the one view *without* separate landscape/portrait screenshot examples. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/48026687853083-Example-Calendar-Views)

### 2.2 Day view
- A grid calendar with a chronological event list for the single selected day. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)
- Capacity: "up to ten events per screen in landscape, and up to sixteen events per screen in portrait view." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/48026687853083-Example-Calendar-Views)
- If more events exist than fit, swipe vertically to scroll to the rest. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/48026687853083-Example-Calendar-Views)
- Tapping an event opens details (invitees, location, etc.); from there the event can be reassigned to a different profile/category or deleted. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360033104791-How-do-I-change-the-view-of-my-calendar)

### 2.3 Week view
- Seven-day grid layout. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)
- Capacity: "shows up to four full events per day. If any day has more than four events, swipe up or down in the day to see more events." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/48026687853083-Example-Calendar-Views)
- Each day column has a **"+ Add Event"** button in its top-right corner to create a new event on that specific day. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360033104791-How-do-I-change-the-view-of-my-calendar)
- Arrows in the upper right navigate between weeks; a **"Next Week"** square/button in the bottom-right corner jumps directly to the following week. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360033104791-How-do-I-change-the-view-of-my-calendar)
- Called out elsewhere as "the most popular" view. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/48784194278683-Adjust-the-Display)
- Settings has a Week View option, **"Start on current day"**, which displays the current day instead of the calendar week's start day as the leftmost column. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36835449004315-Calendar-Settings)

### 2.4 Month view
- Standard monthly calendar grid — "a general overview of scheduled events for any month." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)
- Capacity/overflow: "displays up to three events per day. If any day has more than three events, the calendar will show two events, and an indicator of how many events could not be displayed." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/48026687853083-Example-Calendar-Views)
- That overflow indicator is a **"+ More"** button, which only appears on a date when not all of that date's events are visible; tapping it opens the full event list for that date. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360033104791-How-do-I-change-the-view-of-my-calendar)
- Navigate between months via arrows in the upper right. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360033104791-How-do-I-change-the-view-of-my-calendar)
- Multi-day events render as a single spanning bar (same as Schedule view). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)
- Settings has a Month View option, **"Start on current week"**, showing the current week instead of the 1st of the month as the top row. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36835449004315-Calendar-Settings)

### 2.5 Cross-view indicators & behaviors
- **Today badge**: an orange dot marks today's date. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)
- **Current-time indicator**: an orange bar marks the current time (in time-gridded views — Day/Week/Schedule). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)
- General swipe gestures apply across views: left/right changes date, up/down changes time or scrolls the visible event list; a "Today" button snaps back to now. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)
- Multi-day events appear as a single bar spanning their date range in both Schedule and Month views (explicitly called out; Day/Week rendering of multi-day events not separately documented — [UNKNOWN] whether Week view shows them as a banner row across the top like Google Calendar, or repeats them per day).
- "Dim past events" and "Shade weekends" are toggle settings (see §4) whose exact on-screen visual treatment (opacity level, shading color) is [UNKNOWN] beyond the toggle's name and on/off state.

## 3. Filter panel

- Opened via a **"Filter"** control near the view switcher (device); the mobile app's button bar separately documents "Filter (show/hide Profiles)". [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab) [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/45755784991131-Calendar)
- Confirmed toggles inside the device Filter panel:
  - **"Tasks Progress"** — shows task-completion progress above events, in all four calendar views. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)
  - **"Weather Forecast"** — shows a ten-day forecast of weather icons; requires an address configured in General Settings; appears only in Week and Month views. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)
  - **"Show Meals"** — toggles meal-plan visibility on the calendar (reduces clutter). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab) Elsewhere documented under Settings as a set of toggle switches for the four individual meal categories ("Show in Calendar" > "Meals" dropdown lets you enable/disable each meal category independently). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36835449004315-Calendar-Settings) [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/45795554249371-Settings)
  - Per-profile show/hide toggles, a **"Select All"** control to toggle every profile at once, and a pencil/edit icon to jump into editing profiles. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)
- Default states of each toggle: [UNKNOWN] — not stated in any fetched article (the "Adjust the Display" article gives *recommended* values for related settings, not factory defaults — see §4).
- Whether the Filter panel is a slide-out side panel vs. a modal/dropdown: [UNKNOWN].

## 4. Display / calendar settings (Settings > Calendar / Settings > Display)

Confirmed setting names, values, and location, primarily from the "Calendar Settings" article: [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36835449004315-Calendar-Settings) unless noted.

| Setting | Location | Allowed values / behavior |
|---|---|---|
| **Calendar Display Name** | Settings > Calendar | Free text; replaces the date in the info bar; confirmed with a green checkmark. |
| **Start Week On** | Settings > Calendar | "Sunday" or "Monday". |
| **Show Countdowns** | Settings > Calendar | "Always" / "3 months prior to the event" (also phrased "Three months prior") / "1 month prior to the event" ("One month prior"). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/40459070511515-Countdowns) |
| **Color Code Multi-Profile Events** | Settings > Calendar | On/off toggle. When on, an event with multiple assigned Profiles renders as a bar combining multiple profile colors (see §8). |
| **Shade Weekends** | Settings > Calendar | On/off toggle; adds a shaded background to Saturday and Sunday columns/cells. |
| **Dim Past Events** | Settings > Calendar | On/off toggle; events that have already occurred render dimmed. |
| **Show in Calendar > Meals** | Settings > Calendar | Dropdown of toggles, one per meal category (four categories total, e.g. breakfast/lunch/dinner/snack — exact 4 labels [UNKNOWN]). |
| **Start on current day** (Week view) | Settings > Calendar | On/off; when on, Week view's leftmost column is "today" rather than the week's configured start day. |
| **Start on current week** (Month view) | Settings > Calendar | On/off; when on, Month view scrolls/opens to the week containing today rather than the 1st of the month. |
| **Days displayed in Schedule View** | Settings > Calendar | Slider, 1–7 days. Also has its own "Start on current day" option. |

- The "Adjust the Display" article separately lists these as *recommended* values (framed as tips, not necessarily factory defaults): Text size "Large", Density "Roomy", Automatic brightness "On", Color-code "On", Show countdowns "Always", Dim past events "On", Shade weekends "On", Start week on "Sunday". [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/48784194278683-Adjust-the-Display) Actual factory defaults: [UNKNOWN].
- Photo screensaver settings (tangential, not Calendar tab, included for completeness): "Show time & date" On, "Album" "All photos", "Slideshow" "Chronological", "Blur background" On. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/48784194278683-Adjust-the-Display)
- Notification/reminder defaults are set globally under Settings > Reminders (see §7) but can be overridden per-event.
- Settings navigation path (mobile app): My Skylight menu (upper right) > Settings > Calendar. [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/45795554249371-Settings)

## 5. Profile chip row & countdown chip

- **Countdown chip**: any editable event can be marked as a Countdown (toggle in the edit-event form, see §6). Skylight then automatically tracks and displays the number of days remaining until the event date. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/40459070511515-Countdowns)
  - Countdowns display in a "preview bar" across all four calendar views, appearing alongside Tasks Progress; when space is limited, active countdowns rotate through the first position, and tapping opens a full list of all active countdowns. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/40459070511515-Countdowns)
  - Inside the event's own details popup, the countdown status shows directly under the event title, and the system may add a relevant emoji automatically. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/40459070511515-Countdowns)
  - Countdown events also appear in a row on the photo screensaver, swipeable left/right; screensaver countdown visibility has its own separate toggle at Settings > Photos > Screensaver > "Show countdowns". [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/40459070511515-Countdowns)
  - Only editable events can be Countdowns; events coming from a one-way (read-only) calendar sync cannot be toggled as a Countdown (workaround: create a duplicate native event). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/40459070511515-Countdowns)
  - Visibility is governed by the "Show Countdowns" setting (§4: Always / 3 months prior / 1 month prior). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/40459070511515-Countdowns)
  - The exact example wording "Vacation 48 days" (chip format "<Title> <N> days") is not found verbatim in any fetched source — [INFERRED] as a plausible rendering of "the number of days remaining" but the literal chip text/format (e.g., "48 days" vs "in 48 days" vs a numeral badge) is [UNKNOWN].
- **Profile chip row** (avatar + name + a count like "1/20"): the existence of a **"Tasks Progress"** filter that "displays the task progress of visible profiles above the events in all calendar views" is confirmed. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab) However, no fetched article gives the literal displayed format (e.g., "1/20" = completed/total tasks for that profile today). This is the closest confirmed analog:
  - Profiles have a selectable "Avatar and color". [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/31522050025627-What-are-Skylight-Calendar-Profiles)
  - A separate Tasks-tab "Tasks widget" (on the Home Screen, not the Calendar tab) "will only display today's tasks and displays the Task list name, the total number of tasks, and up to three tasks" — this confirms Skylight does show "N total tasks" counts elsewhere in the product, supporting the plausibility of a "1/20"-style count, but its exact Calendar-tab appearance is [UNKNOWN]. [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
  - Conclusion: the profile-chip-row's exact "avatar + name + N/M count" rendering on the Calendar tab specifically is **[UNKNOWN]** — not found in any Skylight support article despite targeted searching; likely documented only visually in in-app screenshots, not text.

## 6. Creating an event on the device

### 6.1 Entry points
- The device home screen's **"Add"** button opens a creation dialog (for tasks or events). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/49738702477723-The-Home-Screen)
- Week view: each day column has its own **"+ Add Event"** button (top-right of the column). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360033104791-How-do-I-change-the-view-of-my-calendar)
- Schedule view: tap-and-hold a blank space in the time grid. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360033104791-How-do-I-change-the-view-of-my-calendar)

### 6.2 Input-method row (Type / Photo / Talk / Email)
Across the top of the Add-event dialog is a row of buttons for how to add the event: [VERIFIED, via search snippet closely paraphrasing the source article](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)

1. **"Type"** — type the event directly into the calendar via the on-screen keyboard. This is the default selected method.
2. **"Photo"** — displays a QR code to quickly open Sidekick in the Skylight Mobile App; user taps "Take Photo" (or, per the mobile-app-side "Magic Import" flow, "Take a New Photo" / "Choose from Library"); Sidekick parses the photo and generates a draft event for the user to confirm/edit, then tap **"Add to Calendar"**. Requires Sidekick (a Skylight Plus subscription feature). [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/39335538450587-Import-Calendar-Events)
3. **"Talk"** — displays a QR code to open Sidekick on the mobile app; user taps **"Talk into your Mic"** → **"Start Recording"** → describes the event → **"Stop Recording"**; Sidekick generates a draft event to confirm/edit, then **"Add to Calendar"**. Requires Sidekick/Skylight Plus.
4. **"Email"** — user attaches documents/event info to an email and sends it to the household's dedicated Skylight email address shown in the dialog (format `(yourdevicename)@ourskylight.com`, confirmed elsewhere in setup docs). Magic Import scans the email's text, PDFs, photos, and screenshots for event details; putting a Profile's name in the email subject line auto-assigns the event to that Profile; a confirmation email is sent on success. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39335538450587-Import-Calendar-Events) [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30561875063707-Skylight-Calendar-Set-Up-Guide)

### 6.3 Create-event form fields
Compiled from the "Calendar" articles and reminder/countdown/label docs (fields listed in the rough order they're described, though the precise on-screen order is not guaranteed by the sources): [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/44738510847259-Calendar) [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/45755784991131-Calendar) plus cross-refs noted inline.

- **"Title"** (also called "Event Title") — textbox, on-screen keyboard. [VERIFIED, via search snippet]
- Date/time boxes for start and end, **or** an **"All day"** checkbox to make it a full-day event instead of timed. [VERIFIED, via search snippet]
- **"Repeats"** — a switch/toggle; once on, tap additional boxes to configure frequency. Confirmed frequency granularity: "daily, weekly, or monthly" at minimum, with "additional options" appearing depending on the chosen frequency (exact full list, e.g. yearly, custom "every N", specific weekdays — [UNKNOWN], not enumerated in any fetched source). [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)
- **"Repeats until"** — a separate switch to cap a repeating series with an end date. [VERIFIED, via search snippet]
- **"Countdown"** — toggle to mark the event as a Countdown (see §5). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/40459070511515-Countdowns)
- Reminders — configurable per event (see §7); event-level reminders override the calendar-level default. [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/32083277890075-How-to-Set-Reminders)
- **"Description"** (also referred to as a notes/details field) — textbox for event details. [VERIFIED, via search snippet]
- **"Location & weather"** — optional textbox/field for a physical address; if set and the event is within 7 days, its forecast shows in event details (see §10). [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/40451094691995-How-Can-I-See-Weather-on-My-Calendar)
- Profile selection — select one or more Profiles (or a Label) to assign the event to; a **"+"** affordance lets you add a new profile inline. [VERIFIED, via search snippet]
- **"Pick a Synced Calendar"** — a dropdown to attach the event to a two-way-synced remote calendar (Google or iCloud), so the new event also appears on that outside calendar. Any event can sync to at most one remote calendar. [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/44738510847259-Calendar)
- **"Invited Emails"** — field to invite others to the event via email. [VERIFIED, via search snippet]
- Labels: the create form lets you tag the event to a Label instead of / in addition to a Profile (see §9); exact field name in the form (vs. reusing the Profile picker) is [UNKNOWN].

### 6.4 On-screen keyboard
- Appears automatically for any text-entry field; completed by tapping "the blue checkbox." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/54029071887899-The-Calendar-Keyboard)
- Does not float over side panels — instead it appears adjacent to them. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/54029071887899-The-Calendar-Keyboard)
- Includes an Emoji key: swipe left/right through emoji, category-jump icons, and a "Search Emoji" box that surfaces "Relevant Emojis…as you type." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/54029071887899-The-Calendar-Keyboard)

## 7. Reminders

Two levels exist: **calendar-level** (global default, applies to all events) and **event-level** (per-event, overrides the calendar-level default). [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/32083277890075-How-to-Set-Reminders)

- Configuration path: Settings > Reminders. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36836043247131-Reminders-Settings)
- Calendar-event reminder options:
  - **"At time of event"** — pop-up listing all scheduled events/tasks when the event begins. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36836043247131-Reminders-Settings)
  - **"Minutes before event"** / **"Before event"** — advance notice; a number field accepts **1–120 minutes**. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36836043247131-Reminders-Settings) A different (search-sourced) rendering of the same settings screen lists quick presets — "10 minutes before", "30 minutes before", "1 hour before" — plus a **"Custom"** option where you enter a number and choose the unit: **Minutes, Hours, or Days**. [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/45795554249371-Settings) These two descriptions (1–120 minute field vs. preset buttons + custom unit picker) may reflect the device UI vs. the mobile-app UI, or an older vs. newer software version — reconciling them exactly is [UNKNOWN].
  - **"Reminder sound"** / **"Play sound with reminder on Calendar"** — plays a chime with the reminder popup; volume controlled via General Settings' Volume control (or device volume buttons). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36836043247131-Reminders-Settings)
- Task reminders (adjacent, not calendar events): **"When Due"** (time-attached tasks only) and **"When Completed"**. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36836043247131-Reminders-Settings) [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/45795554249371-Settings)
- In-app push notifications were, as of this article's writing, listed as "unavailable but under development" — status as of August 2026 is [UNKNOWN] (may have since shipped). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/32083277890075-How-to-Set-Reminders)
- Multiple simultaneous reminders per event (e.g., both a 30-min and a 1-day reminder): [UNKNOWN] — not addressed by any fetched source.

## 8. Event details popup (view / edit / delete)

- Tapping an event opens a details view showing: title, date/time, reminders, profiles, sync status, invitees, and notes. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)
- One of the "Calendar" articles instead describes this screen as showing "the name, day/date/time, repeat information, connected Profiles, and synced calendar status." [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/45755784991131-Calendar) Combined, the details popup shows: title/name, date & time, repeat info, reminders, assigned Profile(s)/Label, synced-calendar status, invitees, notes/description, and (if a Countdown) the countdown status under the title.
- **Edit**: tap event → tap the menu/edit icon → **"Edit"** → modify fields → **"Save"**. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab) [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/44738510847259-Calendar)
- **Delete**: tap event → tap the menu/trash icon → **"Delete"** → confirm; the "Using the Calendar Tab" article describes this as irreversible. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)
- **Repeating-event edit/delete scope**: for a repeating series, both editing and deleting present a choice of scope. Search-derived synthesis across Skylight's tasks/chores docs (which explicitly describe the same repeat/delete-scope pattern used for events) gives:
  - Delete: **"this event"** (current instance only) / **"this and future events"** (this instance and all later ones) / **"all events"** (every instance, past and future, in the series).
  - Edit: **"This and following events"** (updates this instance forward) or **"All events"** (updates the entire series).
  - [VERIFIED, via search snippet — sourced from Skylight's general repeat-item deletion/edit pattern, described in the same terms for both tasks and events](https://skylight.zendesk.com/hc/en-us/articles/36835449004315-Calendar-Settings) — not confirmed against a screenshot of the actual event delete-confirmation dialog, so the exact three-option wording for *events specifically* (vs. tasks) carries some residual uncertainty; treat the option set as [INFERRED] with high confidence, not hard-[VERIFIED].
  - Editing a single instance of a repeating event and choosing the "this event only" scope (if offered) presumably detaches that instance from the series going forward — this specific behavior (does the edited single instance become a standalone non-repeating event, or does it stay logically "in" the series but with overridden fields) is [UNKNOWN].
- Day view specifically: tapping an event offers reassigning it to a different profile/category, or deleting it. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360033104791-How-do-I-change-the-view-of-my-calendar)

## 9. Labels

Labels are a first-class, distinct concept from Profiles. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44740240234139-Profiles-and-Labels) [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/50636378891419--Feature-Profiles-and-Labels)

- **Profiles = "who"**: individual household members, or a group profile for shared activities (e.g., "vacation"). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44740240234139-Profiles-and-Labels)
- **Labels = "what"**: event categories not tied to any person, e.g. national holidays, garbage-pickup days, home games for a local sports team. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44740240234139-Profiles-and-Labels) [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/50636378891419--Feature-Profiles-and-Labels)
- Exact quote: "national holidays aren't tied to any person or group of people in your household, so they can be added to your Skylight device without being tied to a Profile, under a Label." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44740240234139-Profiles-and-Labels)
- Creating a Label: tap **"Add a Label"** → enter a name in the **"Label Name"** textbox → optionally tap **"Linked Calendars"** to associate one or more external synced calendars with the Label → tap **"Color"** to pick a color from the color picker → optionally tap **"Emoji"** to assign an emoji → tap **"Create Label"**. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44740240234139-Profiles-and-Labels)
- Editing: tap the Label, modify name/linked calendars/color/emoji, save.
- Labels are colored exactly like Profiles are — "colors are tied to Profiles and Labels…anything connected to a Profile or Label (like events or tasks) will automatically show in that color," i.e. Label-tagged events display on the calendar in the Label's assigned color, the same visual mechanism as a Profile's color. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44740240234139-Profiles-and-Labels)
- Advanced operations: a Label can be merged with another Label via **"Merge Label"** (consolidates events under one), or converted to a full Profile via **"Convert to Profile"** (gains avatar, birthday, and other Profile-only features). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44740240234139-Profiles-and-Labels)
- Labels appear in the same Filter-panel-style show/hide list as Profiles: [UNKNOWN] — not explicitly confirmed, but plausible given they share the color/visibility system; treat as [INFERRED].

## 10. Multi-profile events & color coding

- An event can be assigned multiple Profiles at once — "Events can support multiple Profiles, so it's often easier to add multiple Profiles to an event, rather than creating a new Profile for a group." [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/31522050025627-What-are-Skylight-Calendar-Profiles)
- Setting: **"Color Code Multi-Profile Events"** — a Settings > Calendar toggle. When enabled, an event tied to more than one Profile is displayed as a bar using multiple profile colors rather than a single color. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36835449004315-Calendar-Settings) [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/45795554249371-Settings) ("enables/disables events with multiple associated profiles as bars with multiple colors")
- Independent third-party summary corroborates: "a 'Color Code Multi-Profile Events' toggle switch that enables or disables events with multiple associated profiles as bars with multiple colors… striped bars showing different colors" [VERIFIED, via search snippet, third-party paraphrase]. The specific word **"diagonal"** for the stripe orientation was not found in any Skylight-authored source — the "diagonal stripe" visual detail from the task brief is **[UNKNOWN]/[INFERRED]** (plausible given "striped"/"multi-colored bar" language, but not confirmed as diagonal vs. vertical/horizontal split vs. side-by-side blocks).
- Avatar stacking on an event chip and a "+2"-style overflow badge for profiles beyond what fits: [UNKNOWN] — not found in any fetched source; no article documents the exact avatar-badge rendering on an event bar itself (as opposed to the profile filter list).
- When "Color Code Multi-Profile Events" is off, the presumed behavior is a single color per event (e.g., the first/primary assigned Profile's color, or a neutral default) — exact fallback rule is [UNKNOWN].

## 11. Weather on the calendar

- **Forecast strip**: the "Weather Forecast" Filter toggle shows a ten-day forecast of icons; appears only on Week and Month views; requires an address configured in General Settings. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)
- **Info-bar current conditions**: current local temperature/conditions shown at the top of the screen at all times (Calendar tab or otherwise). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/40451094691995-How-Can-I-See-Weather-on-My-Calendar)
- **Per-event weather**: an event's own forecast appears within its event-details popup when (a) the event falls within the next 7 days, and (b) the event has a valid address entered in its "Location & weather" field. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/40451094691995-How-Can-I-See-Weather-on-My-Calendar) The same 7-day + address rule applies in the mobile app's event details. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/40451094691995-How-Can-I-See-Weather-on-My-Calendar)
- **Units**: user can choose Fahrenheit or Celsius regardless of location; US addresses default to Fahrenheit, international addresses default to Celsius. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/40451094691995-How-Can-I-See-Weather-on-My-Calendar)
- **Setup requirement**: address must be entered via device Settings (select country → search/confirm address → save); without it, the info bar shows an exclamation-mark icon instead of a weather icon. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/40451094691995-How-Can-I-See-Weather-on-My-Calendar)
- "Calendar Features" separately reconfirms "Weather display alongside schedules" as a headline feature. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/48778850390171-Calendar-Features)

## 12. Sidebar-style panels (adjacent tabs, not a literal calendar sidebar)

No fetched source describes a persistent sidebar rendered *beside* the Calendar tab's grid itself (i.e., no evidence of a split-pane "calendar + chores list" single screen while in the Calendar tab). What does exist:

- The **Home Screen** (a distinct, separate screen from the Calendar tab, reachable from the nav bar) shows three panes together: Calendar, Tasks, and Lists — user-customizable which panes appear. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/49738702477723-The-Home-Screen)
  - Its Calendar pane offers day view and week view mini-previews.
  - Its Tasks pane shows "available tasks for Profiles on the calendar" (swipe between profiles, mark tasks complete); a per-Tab task filter on the Tasks tab excludes that profile from this Home pane too.
  - Its Lists pane shows account lists (swipeable), with inline "Add item".
  - A single "Add" button here creates either a new task or event.
- Tasks/chores, Meals, and Lists are otherwise each their own full nav-bar tab (not literally inside the Calendar tab): tapping "Tasks" shows chores/routines; tapping "Meals" lets you tap a date tile to add a meal; tapping "Lists" shows the lists. [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores) [VERIFIED, via search snippet]
- Conclusion: a literal in-Calendar-tab sidebar showing chores/lists/meals next to the grid is **[UNKNOWN]** / likely does not exist as a persistent element — the Home Screen's multi-pane layout is the closest analog, but it is a separate screen from the Calendar tab per Skylight's own navigation model (8 distinct nav-bar tabs, Calendar being just one).

## 13. Synced calendars (short — not building sync)

- Skylight supports two-way and one-way sync with external providers. Setup guide names Google, Apple iCloud, and Outlook as syncable calendar services, plus (via "Linked Calendars" on a Profile) Cozi, TeamSnap, and Readdle Calendars. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/48784221491995-Set-Up-the-Calendar-for-Daily-Use) [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30561875063707-Skylight-Calendar-Set-Up-Guide)
- Only Google Calendar was noted as supporting full two-way sync as of the setup guide; the user must be the direct owner of a calendar to sync it. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30561875063707-Skylight-Calendar-Set-Up-Guide)
- Synced personal calendars auto-generate matching Profiles. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30561875063707-Skylight-Calendar-Set-Up-Guide)
- A native (Skylight-created) event can optionally be attached to one synced remote calendar via the "Pick a Synced Calendar" control so it also appears there. [VERIFIED, via search snippet](https://skylight.zendesk.com/hc/en-us/articles/44738510847259-Calendar)
- Events from a one-way (read-only) sync cannot be edited/countdown-toggled on Skylight directly. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/40459070511515-Countdowns)
- (Full sync behavior, conflict handling, and field-mapping are out of scope per the task brief — not researched further.)

## Open questions

1. Exact visual layout pixel/geometry of each view (column widths, hour-gutter width, header heights) — no screenshots were textually described in enough detail by any fetched source.
2. Whether the view-switcher button sits top-left or top-right of the information bar (two Skylight articles disagree).
3. Full enumerated "Repeats" frequency list beyond "daily, weekly, or monthly" (is there Yearly? Custom "every N days/weeks"? specific weekdays for weekly? "the 3rd Tuesday" style monthly?).
4. Full enumerated event-level reminder value set — reconcile the "1–120 minutes free-entry" description against the "10/30/60-min presets + Custom Minutes/Hours/Days" description; can multiple reminders be attached to one event?
5. Exact repeating-event delete/edit scope wording for *events* specifically (the three/two-option pattern was sourced from general repeat-item docs shared with tasks/chores, not confirmed against an event-specific screenshot).
6. Does editing "this event only" in a series detach that instance permanently, or keep it logically grouped with overridden fields?
7. Exact profile-chip-row format on the Calendar tab (does it show "1/20"-style task counts? What does "20" represent — today's tasks, all pending tasks?).
8. Exact countdown chip text format (e.g., "Vacation · 48 days" vs. "48 days" vs. a numeral-only badge).
9. Whether multi-profile event bars use diagonal stripes specifically, vertical splits, side-by-side color blocks, or something else; whether avatars appear on the event bar itself and whether a "+2"-style overflow badge exists for profile avatars.
10. Default (factory) states of every Filter-panel toggle and every Calendar Settings toggle (fetched sources give *recommended*, not default, values).
11. Whether Labels appear in the Filter panel's profile list alongside Profiles, with their own show/hide toggles.
12. Whether Week view renders a multi-day/all-day event as a spanning banner row versus repeating it in each day cell (only Schedule and Month are explicitly documented for multi-day-event rendering).
13. Whether an "all-day row" is a visually distinct row above the hour grid in Day/Week/Schedule views (its existence is architecturally implied by the "All day" checkbox but never explicitly described as a rendered UI row in any fetched source).
14. Clock format (12h/24h) and whether the info bar shows a forecast high/low alongside current conditions.
15. Current status of in-app push notifications (a 2025-dated article called them "unavailable but under development"; unconfirmed whether shipped by August 2026).

## Sources

Fetched directly (WebFetch):
- https://skylight.zendesk.com/hc/en-us/sections/36625018789787-Use-Calendar
- https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab
- https://skylight.zendesk.com/hc/en-us/articles/360033104791-How-do-I-change-the-view-of-my-calendar
- https://skylight.zendesk.com/hc/en-us/articles/48778850390171-Calendar-Features
- https://skylight.zendesk.com/hc/en-us/articles/48784194278683-Adjust-the-Display
- https://skylight.zendesk.com/hc/en-us/articles/48026687853083-Example-Calendar-Views
- https://skylight.zendesk.com/hc/en-us/articles/36824456433051-Navigation-and-Menus
- https://skylight.zendesk.com/hc/en-us/articles/49738702477723-The-Home-Screen
- https://skylight.zendesk.com/hc/en-us/articles/54029071887899-The-Calendar-Keyboard
- https://skylight.zendesk.com/hc/en-us/articles/44740240234139-Profiles-and-Labels
- https://skylight.zendesk.com/hc/en-us/articles/50636378891419--Feature-Profiles-and-Labels
- https://skylight.zendesk.com/hc/en-us/articles/48784221491995-Set-Up-the-Calendar-for-Daily-Use
- https://skylight.zendesk.com/hc/en-us/articles/36836043247131-Reminders-Settings
- https://skylight.zendesk.com/hc/en-us/articles/32083277890075-How-to-Set-Reminders
- https://skylight.zendesk.com/hc/en-us/articles/30561875063707-Skylight-Calendar-Set-Up-Guide
- https://skylight.zendesk.com/hc/en-us/articles/40459070511515-Countdowns
- https://skylight.zendesk.com/hc/en-us/articles/360059869651-How-do-I-view-more-days-on-the-Schedule-view-on-my-Skylight-Calendar
- https://skylight.zendesk.com/hc/en-us/articles/39335538450587-Import-Calendar-Events
- https://skylight.zendesk.com/hc/en-us/articles/40451094691995-How-Can-I-See-Weather-on-My-Calendar
- https://skylight.zendesk.com/hc/en-us/articles/37234772893851-Configuring-Your-Calendar
- https://skylight.zendesk.com/hc/en-us/articles/36835449004315-Calendar-Settings (also fetched directly, content confirmed)
- https://www.forbes.com/sites/forbes-personal-shopper/article/skylight-calendar-2-review/

Attempted directly but blocked by a Zendesk agent sign-in wall (content instead sourced via WebSearch excerpts of the same URL, cited inline above as "via search snippet"):
- https://skylight.zendesk.com/hc/en-us/articles/44738510847259-Calendar
- https://skylight.zendesk.com/hc/en-us/articles/45755784991131-Calendar
- https://skylight.zendesk.com/hc/en-us/articles/360041476432-How-do-you-add-an-event-through-the-mobile-app- (retried once with a URL-form variant, still blocked)
- https://skylight.zendesk.com/hc/en-us/articles/10071451324315-How-do-I-set-event-level-reminders-on-my-Skylight-Calendar
- https://skylight.zendesk.com/hc/en-us/articles/360041959831-How-do-you-change-calendar-categories-on-the-mobile-app- (retried once, still blocked)
- https://skylight.zendesk.com/hc/en-us/articles/45795554249371-Settings (fetched directly, succeeded despite earlier sign-in walls on sibling articles)
- https://skylight.zendesk.com/hc/en-us/articles/31522050025627-What-are-Skylight-Calendar-Profiles

Referenced via WebSearch result snippets only (not independently fetched):
- Third-party review/paraphrase content on "Color Code Multi-Profile Events" striped-bar rendering (search aggregation, no single stable URL to cite beyond the Skylight Settings articles above).

Not yet reconciled / for a future pass if deeper visual fidelity is needed: myskylight.com product pages, and additional consumer reviews (Tom's Guide, CNET, The Verge, Reviewed.com) beyond the Forbes Vetted review fetched above — these were queried via WebSearch but did not surface Calendar-tab UI detail beyond what's already captured; a dedicated screenshot-by-screenshot pass through the Skylight Mobile App itself (not available to this research method) would be needed to close the remaining [UNKNOWN] items in §5, §8, §10.
