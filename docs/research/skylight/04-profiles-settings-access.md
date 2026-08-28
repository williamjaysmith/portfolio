# Skylight Calendar — Profiles & Labels, Settings, Display, Access Control, Notifications, Sleep Mode, Photos/Screensaver, Onboarding

> **STATUS: RESEARCH COMPLETE** (primary pass). Compiled from the Skylight help center (help-center article count for this scope has visible signs of a mid-migration duplicate-article structure — see notes throughout) and myskylight.com. Every fact carries `[VERIFIED](url)`, `[INFERRED]`, or `[UNKNOWN]`; remaining gaps are listed in Open Questions.

**Subject:** Skylight Calendar (Calendar 2, Calendar Max) + companion mobile app, software as of 2025–2026.
**Purpose:** exhaustive reference for building an identical clone.
**Date compiled:** 2026-08-28.

## Evidence tags
| Tag | Meaning |
|---|---|
| `[VERIFIED](url)` | Confirmed against a cited Skylight help-center or myskylight.com page. |
| `[INFERRED]` | Reasonably inferred from adjacent/related verified facts, not directly stated. |
| `[UNKNOWN]` | Not determinable from available material at research time. |

## Table of contents
- Profiles
- Labels
- Settings catalog (General, Calendar, Notifications, Sleep Mode, Photos/Screensaver, Manage Users, Transfer Ownership, Privacy, Parental Lock, Device linking, Wi-Fi, software update, What's New, factory reset, language, time zone)
- Device onboarding flow
- Account model (Users vs Profiles, admins vs invited users, email invite flow, co-parent access)
- Skylight Plus (gating, pricing)
- Open questions
- Sources

---

## Profiles

Profiles represent "who" — each household member (or a group, e.g. "vacations", "sporting events") can have a Profile; events/tasks/rewards tagged to a Profile adopt its color. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44740240234139-Profiles-and-Labels)`

### Profile fields
| Field | Details |
|---|---|
| "Name" | Text field, identifies the Profile. `[VERIFIED]` |
| "Avatar" (Profile Picture) | Three distinct avatar modes, accessed by opening a Profile → "Profiles" → select Profile → picture options at top of Edit page: (1) **Default initial avatar** — the Profile's initials rendered as the avatar; (2) **Preset avatars** — swipe left/right through a built-in set of included illustrated avatars (specific character set not enumerated by the article); (3) **Photo upload** — tap "Add Photo" (bottom-left of the picture editor) → "Take Photo" (camera capture) or "Choose from Library" (camera-roll picker); iOS requires camera/photo-library permission. No emoji-as-avatar or licensed-character (Disney/Pixar/Marvel/Star Wars) option is documented for the *Profile avatar* specifically — licensed characters instead appear as a **screensaver/animation theme** ("Disney Mode") gated behind Calendar Plus, not as an avatar image (see Skylight Plus section). `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/42814221359003-Change-a-Profile-Picture-and-Profile-Color)` |
| "Color" | Swipe left/right on the color menu to choose one of a set of **preset colors** (exact names/hex not listed in the article), or tap the **Color Picker** button in the middle of the color menu to open a **custom color picker** — adjust a color-map/gradient picker or type a hex code directly, then "Save". `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/42814221359003-Change-a-Profile-Picture-and-Profile-Color)` — exact preset palette names/hex values still `[UNKNOWN]`, see Open Questions |
| "Birthday" | Optional. "tap **Birthday** to set a birthday for the Profile." How it renders on the calendar grid is not stated in any fetched article. `[VERIFIED]` (field exists), display behavior `[UNKNOWN]` |
| "Linked Calendars" | Optional. "Select one or more calendars to link to the Profile." `[VERIFIED]` |

### Creating a Profile
1. Tap the Profiles icon → "Tap **Add a Profile**"
2. Enter a name
3. Select an Avatar and color
4. Optionally set Birthday
5. Optionally set Linked Calendars
6. "Tap **Create Profile**"
`[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44740240234139-Profiles-and-Labels)`

### Editing a Profile
Tap the Profile → modify any field → "Tap **Save**". `[VERIFIED]`

### Deleting a Profile
Not documented in the source article (no deletion steps given). `[UNKNOWN]`

### Merging Profiles
1. Tap Profile → "Tap **Manage Profile**"
2. "Tap **Merge Profile**"
3. Select destination Profile
4. "Tap **Confirm and Merge**"

Only available when multiple Profiles exist. A Profile can only merge with another Profile — **not** with a Label. `[VERIFIED]`

### Converting a Profile to a Label (and back)
- Profile → Label: Tap Profile → "Tap **Manage Profile**" → "Tap **Convert to Label**" → proceed through color/emoji selection. `[VERIFIED]`
- Label → Profile: Tap Label → "Tap **Manage Label**" → "Tap **Convert to Profile**" → configure Profile settings (implies setting Avatar/Birthday/etc.). `[VERIFIED]`

### Maximum number of Profiles
Not specified in the source article. `[UNKNOWN]`

### Profile ordering
Not addressed in the source article. `[UNKNOWN]`

### Where the "Profiles icon" lives
"Tap the Profiles icon to view and manage your Profiles and Labels" — the article shows an icon image but does not textually describe its screen location (device top bar vs. app menu). Per the onboarding article, syncing a personal calendar auto-generates Profiles, and a "Profile section" exists in the app for viewing/editing/merging/creating Profiles. `[VERIFIED]` (existence), exact chrome location `[UNKNOWN]`

### Birthdays on the calendar
Not specified by any fetched article exactly how a birthday is rendered on the grid (e.g., automatic recurring all-day event vs. a passive field only). What **is** confirmed: a general-purpose **Countdowns** feature lets any editable event "automatically keep track of the number of days remaining until the date of the event," toggled per-event from the event-edit screen (not available for one-way-synced calendar events); countdown events surface in calendar preview bars (with automatic emoji assignment when appropriate), event detail views, the screensaver, and mobile-app search filters. Birthdays are cited as a canonical example use case for Countdowns, but the article stops short of stating that setting a Profile's Birthday field auto-creates a Countdown/event. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/40459070511515-Countdowns)`, direct birthday→event linkage `[UNKNOWN]`

### Auto-generated "hashtag" Profiles from calendar sync
When Google Calendar events that use Google's own color-labels sync to Skylight, Skylight cannot automatically map each color to the correct existing Profile — instead it **auto-generates a new Profile named after the hex color** (e.g. a Profile literally named "#33ff66") for each distinct color-coded source calendar. Users are expected to merge these auto-generated hashtag Profiles into real Profiles/Labels via the standard Merge flow. This confirms Skylight's internal color representation is hex-based, even though the exact **preset** palette names/hex values were not found. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/31522288995995-What-are-profiles-with-a-hashtag-in-them)`

## Labels

Labels represent "what" — non-person-specific categories (e.g., national holidays) — functionally separate from Profiles. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44740240234139-Profiles-and-Labels)`

### Label fields
| Field | Details |
|---|---|
| "Label Name" | Text field: "Tap the **Label Name** textbox". `[VERIFIED]` |
| "Color" | Required: "Tap **Color** to open the color picker and choose a color." `[VERIFIED]` |
| "Emoji" | Optional: "tap **Emoji** to open the Emoji picker and choose an Emoji." `[VERIFIED]` |
| "Linked Calendars" | Optional external calendar associations, same mechanism as Profiles. `[VERIFIED]` |

### Creating a Label
1. "Tap **Add a Label**"
2. Enter name
3. Optionally link calendars
4. Select color
5. Optionally choose emoji
6. "Tap **Create Label**"
`[VERIFIED]`

### Editing / Merging / Converting a Label
- Edit: tap Label → modify fields → "Tap **Save**". `[VERIFIED]`
- Merge: tap Label → "Tap **Manage Label**" → "Tap **Merge Label**" → select destination → "Tap **Confirm and Merge**" (Labels cannot merge with Profiles). `[VERIFIED]`
- Convert to Profile: see above. `[VERIFIED]`

### Where Labels appear
Used the same way as Profiles for tagging events/tasks/rewards; events/tasks/rewards tagged with a Label adopt that Label's color (and, presumably, its emoji as an icon). `[VERIFIED]` (color adoption), emoji-as-icon `[INFERRED]`

## Settings catalog

Accessed from the Skylight Mobile App: tap **"My Skylight"** menu (upper right) → tap **"Settings"**. Settings can be per-device — a specific Skylight Calendar is selected from the first settings screen before individual settings groups are shown. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/45664471763995-Settings)`

### General settings
Per the dedicated "General Settings" article (`[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36835387462555-General-Settings)`, last updated 2026-08-17), General is split into sub-groups:

**Connectivity / locale**
| Setting | Options | Default |
|---|---|---|
| "Wi-Fi" | Connect to an available network; screen also surfaces MAC address and a refresh action | `[UNKNOWN]` |
| "Time zone" | Searchable list of time zones/locations; if exact location absent, use closest match | `[UNKNOWN]`, likely auto-detected at setup `[INFERRED]` |
| "Language" | Arabic, Danish, German, Spanish, French, Italian, Japanese, Malay, Dutch, Polish, Portuguese, Swedish, English | `[UNKNOWN]`, likely English (US) `[INFERRED]` |
| "Weather" | "Enter an address for more accurate weather data" — feeds the Information Bar and per-event weather. US addresses default to °F, non-US addresses default to °C. | No manual address set until entered; unit defaults per country as above `[VERIFIED](WebSearch summary of Weather Forecast section)` |

**Display**
| Setting | Options | Default |
|---|---|---|
| "Text size" | Small / Medium / Large | `[UNKNOWN]`; Adjust-the-Display article recommends "Large" for legibility (a recommendation, not necessarily factory default) |
| "Display density" | Cozy / Snug / **Roomy** (Roomy noted as available specifically "for Calendar Max") | `[UNKNOWN]`; Adjust-the-Display article recommends "Roomy" |
| "Automatic brightness" | Toggle On/Off | Appears enabled by default `[VERIFIED-ish, low confidence]` |
| "Brightness" | Manual adjustable percentage slider (relevant when Automatic brightness is off) | `[UNKNOWN]` |
| Orientation (landscape/portrait) | **Not a software toggle** — it's a physical mounting orientation. Models with a magnetic stand can be hung/stood in landscape or portrait; the device auto-detects orientation and **automatically rotates on-screen images** to match (auto-rotation only on Calendars purchased 2022+; earlier units need manual rotation via an on-screen menu). Orientation also affects layout: "the maximum number of viewable days in schedule view depends on the orientation," with landscape showing the most days. | n/a — determined by physical mounting, not a settings-menu value `[VERIFIED]` |

**Other General items**
| Setting | Options | Default |
|---|---|---|
| "Parental lock" | 4-digit PIN; inactivity timeout selectable 1–10 minutes | Disabled by default `[VERIFIED]` |
| "Video and reminder volume" | Adjustable percentage slider | `[UNKNOWN]` |
| "Keyboard clicks" | Toggle On/Off (on-screen keyboard key-click sound) | `[UNKNOWN]` |

**12/24-hour clock — CONFIRMED not configurable.** Per a dedicated FAQ: "Skylight Calendar can only display time in twelve hour time format (hours, minutes, and AM/PM)." There is no 24-hour/military-time option; the article notes users can request the feature via the Skylight product roadmap if desired. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36058190127899-Does-Skylight-Calendar-show-military-time)`

Temperature-unit-as-a-standalone-toggle was **not** found in any fetched article — temperature unit instead appears to be inferred automatically from the Weather address's country (°F for US, °C elsewhere), with no confirmed manual override. `[UNKNOWN]` whether an explicit temperature-unit override exists elsewhere in the app.

### Calendar settings
Per the dedicated "Calendar Settings" article `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36835449004315-Calendar-Settings)` (last updated 2026-07-15), plus the general "Settings" and "Adjust the Display" articles:

| Setting | Options | Default |
|---|---|---|
| "Calendar display name" | Free-text field; when set, replaces the date in the device's Information Bar header | Empty/date shown `[INFERRED]` — this is the "header: family-name vs. date" behavior called out in the research brief |
| "Start week on" | Sunday / Monday | `[UNKNOWN]` |
| "Show countdowns" | Always / 3 months prior to event / 1 month prior to event | Display article recommends "Always"; true factory default `[UNKNOWN]` |
| "Color code multi-profile events" | Toggle — shared events display as a multi-color bar reflecting all tagged Profiles | `[UNKNOWN]` |
| "Shade weekends" | Toggle — shaded background for Saturday/Sunday columns | Display article recommends "On"; factory default `[UNKNOWN]` |
| "Dim past events" | Toggle — completed/past events render dimmed | Display article recommends "On"; factory default `[UNKNOWN]` |
| "Show meals" | Displays one toggle switch per meal category, toggle individually to show/hide on the device; category names are editable via a pencil icon. **Default four categories: "Breakfast", "Lunch", "Dinner", "Snack"** (confirmed) | All four shown by default `[INFERRED]`; feature requires a **Calendar Plus** subscription `[VERIFIED]` |
| "Start on current day" (Week View) | Toggle | `[UNKNOWN]` |
| "Start on current week" (Month View) | Toggle | `[UNKNOWN]` |
| "Days displayed in schedule view" | Slider, 1–7 days | `[UNKNOWN]` |
| "Start on current day" (Schedule View) | Toggle | `[UNKNOWN]` |
| "Synced Calendars" | Manage which external calendars sync to the Skylight Account | n/a |
| "By default, events sync back to…" | Select exactly one calendar as the default destination for new events; overridable per individual event | `[UNKNOWN]` |
| "Color-coding" (color-code events by Profile) | Toggle | Display article recommends "On" |

Not found as Calendar-tab settings in any fetched article: a standalone 12/24-hour clock toggle, a standalone temperature-unit toggle, or a "weather location" field under Calendar specifically — weather/address and language/time zone live under **General** (see above), and temperature unit appears to auto-derive from the Weather address's country rather than being a separate Calendar setting. `[UNKNOWN]` whether Calendar has its own copy of these.

Sources: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/45664471763995-Settings)`, `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/48784194278683-Adjust-the-Display)`, `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36835449004315-Calendar-Settings)`

### Notifications settings
| Setting | Options | Default |
|---|---|---|
| "At time of event" | Toggle — displays a popup reminder when an event starts | `[UNKNOWN]` |
| "Before event" / "Minutes before event" | Two slightly different descriptions were found across two articles: the general **Settings** article describes preset choices **"10 minutes before"**, **"30 minutes before"**, **"1 hour before"**, or **"Custom"** (arbitrary Minutes/Hours/Days); the dedicated **Reminders Settings** article instead describes a single free-entry **"Minutes before event"** number field, range **1–120 minutes**, set by tapping the field and typing a value. These may reflect two different UI surfaces (e.g., per-event reminder vs. calendar-level default) or an app update between the two articles' last-updated dates (2026-08-25 vs. 2026-06-30) — treat both as valid, unreconciled `[VERIFIED, with internal inconsistency noted]` |
| "When Due" | Toggle — task notification on due tasks; Reminders Settings clarifies "Reminders are only available for tasks with times attached" | `[UNKNOWN]` |
| "When Completed" | Toggle — task completion notification. Appears only in the general Settings article; the dedicated Reminders Settings article does not mention it, so its exact location/existence in the current UI is `[UNKNOWN]`/unreconciled | `[UNKNOWN]` |
| "Reminder sound" | Toggle (Settings → **Reminders** → **"Reminder sound"**) — when on, Calendar plays a chime alongside the on-screen popup when a reminder fires; volume is controlled via the General-settings **"Video and reminder volume"** slider. Alerts can be an on-screen popup, a chime, or both. **Only one chime sound is offered — sounds are not yet customizable** ("more offerings are planned for a future release"). | `[UNKNOWN]` on/off default |

Sources: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/45664471763995-Settings)`, `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36836043247131-Reminders-Settings)` (last updated 2026-06-30)

### Sleep Mode settings
| Setting | Options | Default |
|---|---|---|
| "Sleep Mode Schedule" | Toggle on/off | `[UNKNOWN]` |
| "From" | Time the Calendar enters sleep (screen disabled, lower power) | `[UNKNOWN]` |
| "To" | Time the Calendar wakes | `[UNKNOWN]` |
| "Enter Sleep Mode Now" | Manual immediate-activation button (accessed via **Sleep** in the navigation bar → popup) | n/a (action, not a setting) |

Behavior: sleep mode "disables the screen" and "lowers the power consumption." Tapping the screen wakes the device immediately. The From/To schedule recurs daily (not a one-time event). `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/37235485034779-Using-Sleep-Mode)`

### Photos / Screensaver settings
Per the dedicated "Photo Settings" article `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36835919949339-Photo-Settings)` (last updated 2026-08-26):

**Screensaver**
| Setting | Options | Default |
|---|---|---|
| "Photo Screensaver" | Toggle Enable/Disable — requires a **Calendar Plus** subscription | Off `[INFERRED]` (gated feature) |
| "Weather" | Toggle Show/Hide on the screensaver overlay; requires a valid address to be entered | `[UNKNOWN]` |
| "Time and date" | Toggle Show/Hide on the screensaver overlay (this is the "Show time & date" setting from the brief) | `[UNKNOWN]` |
| "Upcoming events" | Toggle Show/Hide on the screensaver overlay | `[UNKNOWN]` |
| "Countdowns" | Toggle Show/Hide on the screensaver overlay | `[UNKNOWN]` |
| "Album" | Choose "All media" or a specific photo album as the slideshow source | "All media" `[INFERRED]` |
| "Turn on after (minutes)" | Slider, 1–10 minutes — this is the idle timeout before the screensaver activates | `[UNKNOWN]` |

**Slideshow**
| Setting | Options | Default |
|---|---|---|
| "Order" | Chronological / Shuffle | `[UNKNOWN]` |
| "Blur Background" | "Blur effect" / "Black" — controls the fill behind bordered (non-full-bleed) photos | `[UNKNOWN]` |
| "Show vertical items" | One photo / two photos (side-by-side for portrait-oriented images) | `[UNKNOWN]` — note a separate help article exists titled "How Do I Turn Off Side-By-Side Images?" confirming this is user-configurable |
| "Position" | "Fit to screen" / "Fill screen" | `[UNKNOWN]` |
| "Seconds until next item" | Slider, 1–120 seconds | `[UNKNOWN]` |
| "Video sound off by default" | Toggle On/Off — auto-mute for video clips in the slideshow | `[UNKNOWN]` |

Additional notes: automatic image rotation (portrait/landscape auto-orient) is available on Calendars purchased 2022 or later; manual photo rotation is available via an on-screen menu on older units. `[VERIFIED]`

### Manage Users
| Setting | Options | Default |
|---|---|---|
| "Invite Users" | Enter email address → "Send" | n/a |
| "Has access" (Users With Access) | Lists users with access; "Block" option per user | n/a |
| "Blocked Users" | Lists blocked users; "Unblock" option per user | n/a |

Source: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/45664471763995-Settings)`

### Transfer Ownership
- Enter new owner's email address
- Two-step confirmation to complete transfer
- New owner receives sole administrative access
- Original owner is demoted to content-sending capability only (no longer admin)
`[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/45664471763995-Settings)`

### Privacy settings
| Setting | Options | Default |
|---|---|---|
| "Who can send photos?" | "Senders who I approve" (requires authorization) / "Anyone" (unrestricted) | `[UNKNOWN]` |
| "Senders can see" | "All photos" / "Only photos they have sent" | `[UNKNOWN]` |

Source: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/45664471763995-Settings)`

### Parental lock / "Lock"
Per the "Parental Lock" article `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/35089525796251-Parental-Lock)` (last updated 2026-07-08) and cross-referenced against General Settings:

- **Purpose:** restricts what can be changed directly on the physical Calendar screen, "preserving Calendar as the source of truth for events and tasks" — i.e. it is a device-side child-lockout, not an app-account permission system. `[VERIFIED]`
- **PIN:** a 4-digit PIN, unique to the device. `[VERIFIED]`
- **Scope options:** when enabling, the owner chooses whether the PIN is required for **"Add events and tasks"** and/or **"Modify events and tasks"** (independently toggleable — i.e., you can lock modification while leaving adding open, or vice versa). `[VERIFIED]`
- **Setup steps:**
  1. Tap the **Parental lock** toggle (in General Settings)
  2. Enter a PIN using the on-screen number pad
  3. Tap the green check
  4. Choose whether the PIN is required to "Add events and tasks" and/or "Modify events and tasks"
  5. Tap **Confirm**
  `[VERIFIED]`
- **Toggle location:** General Settings (device settings), alongside an **inactivity timeout** selectable 1–10 minutes (how long before the lock re-engages after a correct PIN entry, `[INFERRED]` from context) — default state is **disabled**. `[VERIFIED]`
- **Unlocking:** enter the correct 4-digit PIN on-screen. `[INFERRED]`
- **Forgot-PIN recovery:** two paths — (1) self-service: in the PIN-entry dialog tap **"Forgot PIN?"** → **"Send email"** → a magic link is emailed to the personal address on the Skylight account; (2) contact Skylight Support (help-request form or vip@myskylight.com) for a manual reset. `[VERIFIED]`

### Device linking
Lets a household with more than one Skylight Calendar (or more than one Frame — Calendars and Frames cannot cross-link with each other) keep them in sync. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/37835556346011-Link-Two-Skylight-Calendars)`

- **What syncs:** all Calendar data — events, chores, lists, meals, and more — from the first-activated device to every linked device. "You cannot link only some of the data - all of the data will be on all of the linked Calendars." `[VERIFIED]`
- **Ownership requirement:** you can only link Calendars/Frames you personally own; one device must already be activated before others can link to it. `[VERIFIED]`
- **Time zone recommendation:** keep all linked Calendars in the same time zone. `[VERIFIED]`
- **Linking steps:**
  1. Open the Skylight App (Mobile or Desktop) → tap **"My Skylight Menu"** (upper right) → tap **"App Settings"** → tap **"Linked devices"**
  2. Tap the blue **"+"** (Add) button → opens "New Linked Device" screen
  3. Enter a descriptive name for the linked device (e.g. by location or user)
  4. Tap **"Next"**
  5. Choose whether the calendar being linked is **"Not activated"** or **"Activated"**:
     - *Not activated:* power on and Wi-Fi-connect the new Calendar → note its one-day-valid activation code → enter the code on the new Calendar → tap **"Done"**
     - *Already activated:* on that device go to Settings → **"Reset device"** → **"Reset"** (confirm twice) → **"Continue"** → reconnect to Wi-Fi → note the new activation code shown in the Mobile App → enter it on the Calendar → tap **"Done"**
  - An activation code can also be shared via the device's native share menu using **"Share activation code."**
  `[VERIFIED]`
- **Unlinking:** handled via a separate "Removing and Resetting a Calendar from the Linked Devices List" flow — not fetched in full detail; the mechanism exists under the Linked Devices list. `[INFERRED]` (title confirms existence, full steps `[UNKNOWN]`)

### Factory reset ("Reset Device")
1. On the Calendar, go to **Settings** → **General** tab
2. Tap **"Reset Device"**
3. Confirm
4. Save/note the activation code shown
5. Wait for the Calendar to restart

Effect: erases "all data from your Skylight Calendar's internal storage" — account-level data in the cloud remains intact, so the same activation code (or a newly generated one) can be used to reactivate the same Calendar, or a different Calendar can be activated in its place. A separate WebSearch summary distinguished a **"soft reset"** (erases user data, Wi-Fi settings preserved) from a **"full reset"** (only unlinks the device from your data, doesn't delete it — data can be restored by reactivating), though the fetched article itself describes only one unified "Reset Device" flow; the soft/full distinction should be treated as `[UNKNOWN]`/unconfirmed pending a direct article read. If the activation code is lost, recovery is via the help-request form or vip@myskylight.com. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/20452503990939-How-To-Factory-Reset-Your-Skylight-Calendar)`, soft/full distinction `[UNKNOWN]`

### "What's New" dialogs / software update
- The help center runs a dedicated **"What's New"** category (separate from "Calendar"), with a **"Calendar" section** and a **"Buddy" section**, each listing dated release entries — cadence is roughly weekly to biweekly across 2025–2026 (dated entries observed from 2025-08-25 through 2026-08-27 at research time). `[VERIFIED](https://skylight.zendesk.com/hc/en-us/categories/42813896436763-What-s-New)`
- Example confirmed entries: a **May 13, 2026** release covering "Profiles and Labels," "Task Description," and "Remove Stars"; an **April 30, 2026** release covering "Home Screen." `[VERIFIED]` (via search summary; full article contents not individually fetched)
- **Software version:** General Settings on the device includes a **"Software Version"** field reporting the Calendar's current software version (Settings → General). `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36835387462555-General-Settings)` (existence per WebSearch summary), update-trigger mechanism (auto vs. manual) `[UNKNOWN]`

## Device onboarding flow

**High-level flow (per the Set Up Guide):**
1. **Download & connect Wi-Fi:** "Download the Skylight app from the App Store or Google Play." Open the app and follow prompts to connect the calendar to Wi-Fi. Device must be "plugged in and powered on." `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30561875063707-Skylight-Calendar-Set-Up-Guide)`
2. **Activate the Calendar:** The app creates a unique device email address in the form `(yourdevicename)@ourskylight.com`. "Enter the provided activation code directly on your calendar's screen." `[VERIFIED]`
3. **Sync personal calendars:** Use "Sync" in the Skylight app → select the logo of your personal calendar service → follow on-screen instructions. Supported: Google Calendar, Outlook, iCalendar. "Only Google Calendar supports two-way syncing." Requires the calendar allow external sync permissions and that the user be its direct owner. `[VERIFIED]`
4. **Review & set up Profiles:** Synced personal calendars automatically generate Profiles (including auto-generated "hashtag" Profiles for Google-Calendar-color-coded events — see Profiles section above). The app's Profile section lets you view existing Profiles, edit names/colors, merge Profiles, and create new ones. `[VERIFIED]`
5. **Create events:** Events can be created from either the physical Calendar or the Skylight app; "Each event needs to be tagged to a specific Profile." `[VERIFIED]`
6–7. Explore Chores/Lists/Meal Planning; optionally upgrade to "Calendar Plus + Sidekick" subscription. `[VERIFIED]`

Support contact: vip@myskylight.com, or submit a help request. `[VERIFIED]`

**Granular field-level detail (per the "Configuring Your Calendar" article, last updated 2026-07-08):** `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/37234772893851-Configuring-Your-Calendar)`

- **Mobile-app account creation:** Email address, Password, and a Terms-of-Service acceptance checkbox.
- **Owner's own User Profile:** First Name (required), Phone Number (optional), Birthday (required for the owner, notably — unlike Profiles created later where Birthday is optional), and a "Keep me in the loop!" checkbox opting into product/deal marketing emails (optional).
- **Household setup:** a "Household Nickname" field names the connected device group.
- **Device Wi-Fi:** select network name → enter password → a MAC-address display option is also available on this screen.
- **Location settings:** City/Address field (feeds weather forecasts) with a Country picker and a "Search Address" textbox with validation.
- **Time zone:** a searchable, swipeable time-zone list with a "Save" button to confirm. **Location and time zone are auto-guessed from IP address** before the user confirms/overrides them. `[VERIFIED]`
- **Profile customization (first Profiles):** Profile color selection, profile picture upload, Name field, Birthday field — same mechanism as the general "Change a Profile Picture and Profile Color" flow documented above.
- **Optional steps:** external calendar sync can be skipped via a "Skip This Step" option; additional Profiles can be created; Skylight Plus subscription enrollment is offered as an optional step in the flow.

This "Configuring Your Calendar" article's account-creation field list (Email/Password/ToS, then First Name/Phone/Birthday/marketing-opt-in) is the most granular documented onboarding source found and should be treated as authoritative over the higher-level Set Up Guide numbered list above where they overlap.

## Account model: Users vs. Profiles

- A **User** = an account holder with app/device access (owner/admin or invited); a **Profile** = a household member or group represented on the calendar for tagging events/tasks/rewards — Profiles are not necessarily tied 1:1 to a User account. `[INFERRED]` from the separate "Manage Users" vs. "Profiles and Labels" mechanisms described above; not explicitly stated as a unified model in any single source yet.
- Admin/owner: has full settings access, can invite/block/unblock Users, and can "Transfer Ownership." `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/45664471763995-Settings)`
- **Two documented invite mechanisms** exist and appear to overlap/duplicate in the help-center's current vs. legacy content:
  1. **"Invite Users" (Settings → Manage Users)** — enter the invitee's email address in a textbox → tap **"Send"**. Invited users then appear under **"Has access"** (with a per-user **"Block"** action) or, once blocked, under **"Blocked Users"** (with a per-user **"Unblock"** action). `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/45664471763995-Settings)`
  2. **"Invite Others" (My Skylight menu → Invite Others)** — a simpler, link-based flow: open the app → select the target device → tap **"My Skylight Menu"** (upper right) → tap **"Invite Others"** → tap **"Invite"** to share a link via messaging/email/other apps. "Anyone who activates the link will be able to view and manage your calendar." `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/32077029247643-Sharing-Access-To-Calendar)`
  - It is `[UNKNOWN]` whether these are two names for the same underlying flow (current UI) or whether the help center has both a current and a legacy/duplicate article — the numbering pattern across fetched articles (multiple "Settings", multiple "Profiles" article IDs) suggests the help center is mid-migration to a restructured article set, so some duplication/inconsistency is expected. Treat both as valid alternate entry points until confirmed otherwise.
- Invited-User capability granularity (view-only vs. edit vs. admin-equivalent) is **not** broken out anywhere in the fetched articles — the only stated behavior is that link-invitees "can view and manage" the calendar, which suggests invited Users get broad edit access by default, not a restricted role. `[VERIFIED]` (as stated), finer-grained permission tiers `[UNKNOWN]`
- Email invite flow (Manage Users variant): enter the invitee's email in "Invite Users" → tap "Send". `[VERIFIED]`
- Co-parent access: not documented as a distinct named flow — appears to be accomplished via either of the two generic invite flows above, both of which grant "view and manage" access. `[INFERRED]`

## Skylight Plus

**Pricing:** "$79/year" — annual subscription only, no monthly option listed on the product page. The page notes "Individual Calendar Plus subscriptions are excluded from marketing promotions and discounts." `[VERIFIED](https://myskylight.com/products/calendar-skylight-plus)`

**Plus-exclusive features (gated behind Calendar Plus):**
| Feature | What it does |
|---|---|
| "Sidekick: Magic Family Assistant" | Auto-imports events from forwarded school emails, generates recipes, creates lists |
| "Smart Meal Planning" | Weekly meal planning, shareable with family; this is the same subscription gate confirmed for "Show meals" toggles in Calendar Settings |
| "Photo & Video Screensaver" | Displays personal photos/videos when the Calendar is inactive — this is the same "Photo Screensaver" toggle documented in the Photos/Screensaver settings section above |
| "Rewards" | Tracks milestones, awards stars for completed chores |
| "Disney Mode" | Add-on unlocking Disney/Pixar/Marvel/Star Wars content — see detail below |
| "Sync Online Calendars" | Listed in the Plus feature-comparison chart |
| "Chore Chart" | Listed in the Plus feature-comparison chart |

`[VERIFIED](https://myskylight.com/products/calendar-skylight-plus)`

**Disney Mode (add-on, requires Skylight Plus):**
- Unlocks Disney avatars for Profiles: "you have the option of adding Disney avatars to your Profiles" — this is the licensed-character avatar option that the base "Change a Profile Picture" article did not mention (confirming it's Plus/add-on-gated rather than a base-tier avatar option). `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/51738788434203--Add-On-Disney-Mode)`
- Adding a Disney avatar unlocks **special animated celebrations** that trigger when all of a Profile's Tasks are completed for the day, or when a Reward is redeemed. `[VERIFIED]`
- Unlocks a dedicated **"special Disney Album"** for the screensaver slideshow — a curated Disney/Pixar/Marvel/Star Wars artwork collection. `[VERIFIED]`
- Marketing copy (myskylight.com announcement) specifies **16 characters total** across Disney, Pixar, Marvel, and Star Wars, naming Stitch, Moana, and Elsa among them. `[VERIFIED](WebSearch of myskylight.com/introducing-skylight-disney-mode/)`
- Exact add-on price (whether it's included in the $79/year Plus price or billed separately) and full character roster were not confirmed by the fetched article. `[UNKNOWN]`

## Open questions

- Exact preset color swatch names and hex values for Profile/Label colors — confirmed a swipeable preset strip plus a custom color picker (map + hex-entry) exists, but no official hex list was found; the only hex codes surfaced were from an unrelated third-party Pinterest/color-hex palette and should **not** be treated as authoritative.
- Whether Profile avatar "preset avatars" (non-Disney, base-tier) are illustrated characters, icon/emoji-style graphics, or something else — confirmed to exist (swipeable set) but visual style not described in text.
- How a birthday renders on the calendar grid (e.g., automatic recurring annual event vs. a passive countdown-only field vs. manual event creation required). Confirmed: the "Countdown" feature can be used for birthdays, and events can be manually set to repeat annually via a "Repeats" toggle — but it is **not confirmed** whether setting a Profile's Birthday field automatically generates a calendar event/marker.
- Maximum number of Profiles — no cap stated in any article; UI explicitly supports scrolling ("swipe up and down to see more of the list") for large Profile/Label counts, suggesting no small hard limit, but no explicit maximum was ever stated.
- Whether Profiles can be manually reordered (drag-to-reorder) — not found; a "[Feature] Reorder Your Routines" article exists for a different feature (Routines) and should not be confused with Profile ordering.
- Exact device-UI chrome location of the "Profiles icon" on the physical Calendar screen (vs. the confirmed app-side "Profiles" homescreen section).
- Full enumeration of "Text size" (confirmed: Small/Medium/Large) and "Display density" (confirmed: Cozy/Snug/Roomy, with Roomy available specifically on Calendar Max) true factory defaults — recommendations ("Large"/"Roomy") are given for legibility, not necessarily shipped defaults.
- "Start week on" default (Sunday vs. Monday confirmed as the two options).
- Whether a temperature-unit override exists independent of the Weather address's inferred country default (US→°F, non-US→°C confirmed).
- "Show countdowns" true factory default among Always / 3 months prior / 1 month prior (all three options confirmed).
- Soft-reset vs. full-reset distinction for factory reset — a WebSearch summary described two reset tiers with different data effects, but the single dedicated reset article fetched describes only one unified "Reset Device" flow; needs a direct read of "Resetting your Skylight Calendar" (https://skylight.zendesk.com/hc/en-us/articles/32084484108187) to reconcile.
- Full unlink-a-linked-device steps (article exists: "Removing and Resetting a Calendar from the Linked Devices List").
- Precise invited-User permission boundaries vs. owner/admin — confirmed invited users via the link-based "Invite Others" flow get full "view and manage" access; unclear whether the email-based "Invite Users" (Manage Users) flow grants a different/lesser role, or whether these are simply two names/entry points for the same underlying mechanism (the help center shows signs of being mid-restructure, with duplicate article IDs for "Settings" and "Profiles").
- Co-parent access flow, if distinct from the generic user-invite flows.
- Disney Mode: exact add-on price (separate charge vs. bundled in the $79/year Plus price) and the full 16-character roster (only Stitch, Moana, and Elsa confirmed by name).
- Wi-Fi settings screen details beyond "connect to a network" + MAC address + refresh.
- Language default (English (US) inferred, not confirmed) among the 13 confirmed supported languages.
- Time zone: confirmed auto-detection is likely at setup and manual override via a searchable list exists, but auto vs. manual default behavior not explicitly confirmed.

## Sources

- [Profiles and Labels](https://skylight.zendesk.com/hc/en-us/articles/44740240234139-Profiles-and-Labels) — fetched 2026-08-28, article last updated 2026-08-27
- [Settings](https://skylight.zendesk.com/hc/en-us/articles/45664471763995-Settings) — fetched 2026-08-28, article last updated 2026-08-25
- [Adjust the Display](https://skylight.zendesk.com/hc/en-us/articles/48784194278683-Adjust-the-Display) — fetched 2026-08-28, article last updated 2026-05-11
- [Using Sleep Mode](https://skylight.zendesk.com/hc/en-us/articles/37235485034779-Using-Sleep-Mode) — fetched 2026-08-28, article last updated 2025-05-21
- [Skylight Calendar Set Up Guide](https://skylight.zendesk.com/hc/en-us/articles/30561875063707-Skylight-Calendar-Set-Up-Guide) — fetched 2026-08-28, article last updated 2026-03-10
- [Skylight Support help center home](https://skylight.zendesk.com/hc/en-us) — fetched 2026-08-28 (category listing)
- [Parental Lock](https://skylight.zendesk.com/hc/en-us/articles/35089525796251-Parental-Lock) — fetched 2026-08-28, article last updated 2026-07-08
- [General Settings](https://skylight.zendesk.com/hc/en-us/articles/36835387462555-General-Settings) — fetched 2026-08-28, article last updated 2026-08-17
- [Calendar Settings](https://skylight.zendesk.com/hc/en-us/articles/36835449004315-Calendar-Settings) — fetched 2026-08-28, article last updated 2026-07-15
- [Change a Profile Picture and Profile Color](https://skylight.zendesk.com/hc/en-us/articles/42814221359003-Change-a-Profile-Picture-and-Profile-Color) — fetched 2026-08-28, article last updated 2026-08-27
- [Photo Settings](https://skylight.zendesk.com/hc/en-us/articles/36835919949339-Photo-Settings) — fetched 2026-08-28, article last updated 2026-08-26
- [Sharing Access To Calendar](https://skylight.zendesk.com/hc/en-us/articles/32077029247643-Sharing-Access-To-Calendar) — fetched 2026-08-28, article last updated 2026-06-16
- [How To Factory Reset Your Skylight Calendar](https://skylight.zendesk.com/hc/en-us/articles/20452503990939-How-To-Factory-Reset-Your-Skylight-Calendar) — fetched 2026-08-28, article last updated 2026-03-10
- [[Add-On] Disney Mode](https://skylight.zendesk.com/hc/en-us/articles/51738788434203--Add-On-Disney-Mode) — fetched 2026-08-28, article last updated 2026-06-22
- [How to set profiles up for your family](https://skylight.zendesk.com/hc/en-us/articles/31522159833883-How-to-set-profiles-up-for-your-family) — fetched 2026-08-28, article last updated 2026-07-09
- [What are people profiles and other colors?](https://skylight.zendesk.com/hc/en-us/articles/31522096591131-What-are-people-profiles-and-other-colors) — fetched 2026-08-28, article last updated 2026-07-09
- [Link Two Skylight Calendars](https://skylight.zendesk.com/hc/en-us/articles/37835556346011-Link-Two-Skylight-Calendars) — fetched 2026-08-28, article last updated 2026-06-16
- [What's New category](https://skylight.zendesk.com/hc/en-us/categories/42813896436763-What-s-New) — fetched 2026-08-28
- [Configuring Your Calendar](https://skylight.zendesk.com/hc/en-us/articles/37234772893851-Configuring-Your-Calendar) — fetched 2026-08-28, article last updated 2026-07-08
- [Reminders Settings](https://skylight.zendesk.com/hc/en-us/articles/36836043247131-Reminders-Settings) — fetched 2026-08-28, article last updated 2026-06-30
- [Countdowns](https://skylight.zendesk.com/hc/en-us/articles/40459070511515-Countdowns) — fetched 2026-08-28, article last updated 2025-08-28
- [What are profiles with a hashtag (#) in them?](https://skylight.zendesk.com/hc/en-us/articles/31522288995995-What-are-profiles-with-a-hashtag-in-them) — fetched 2026-08-28
- [Does Skylight Calendar show military time?](https://skylight.zendesk.com/hc/en-us/articles/36058190127899-Does-Skylight-Calendar-show-military-time) — fetched 2026-08-28, article last updated 2026-06-16
- [Skylight Calendar Plus product page](https://myskylight.com/products/calendar-skylight-plus) — fetched 2026-08-28
- WebSearch (skylight.zendesk.com, restricted domain) for: parental lock PIN; profile avatar color options; screensaver album slideshow settings; time zone/12-hour/temperature/weather location settings; reminder sound options; "Show Meals" categories; birthday auto-event; orientation portrait/landscape; device linking; maximum/reorder profiles; factory reset; What's New/software update — result summaries incorporated above and cited inline where used. Underlying result links included: [Reminders Settings](https://skylight.zendesk.com/hc/en-us/articles/36836043247131-Reminders-Settings), [Using the Meal Planner](https://skylight.zendesk.com/hc/en-us/articles/44739809442587-Using-the-Meal-Planner), [Skylight Device Linking - How It Works](https://skylight.zendesk.com/hc/en-us/articles/31486128072603-Skylight-Device-Linking-How-It-Works) (fetch blocked by a sign-in wall — not independently verified, superseded by the successfully-fetched "Link Two Skylight Calendars" article above), [Resetting your Skylight Calendar](https://skylight.zendesk.com/hc/en-us/articles/32084484108187-Resetting-your-Skylight-Calendar) (not independently fetched — see Open Questions), [Removing and Resetting a Calendar from the Linked Devices List](https://skylight.zendesk.com/hc/en-us/articles/37835680255131-Removing-and-Resetting-a-Calendar-from-the-Linked-Devices-List) (not independently fetched).
- WebSearch (unrestricted) for "Skylight Disney Mode characters" surfaced [myskylight.com/introducing-skylight-disney-mode/](https://myskylight.com/introducing-skylight-disney-mode/) (Disney Mode announcement, not independently fetched in full — summary only).
