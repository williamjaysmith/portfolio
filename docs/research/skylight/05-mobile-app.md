# Skylight Calendar — Mobile App (iOS/Android Companion App)

> **STATUS: Research pass complete.** 10 App Store screenshots viewed and described; 40+ help-center articles fetched, including the full 48-entry official "What's New" changelog (via public Zendesk API) and third-party review coverage. Remaining gaps are listed in Open Questions. Every fact carries `[VERIFIED](url)`, `[SCREENSHOT: filename]`, `[INFERRED]`, or `[UNKNOWN]`.

**Subject:** Skylight App — companion mobile app for Skylight Calendar/Frame devices.
- iOS: App Store id1438779037, `https://apps.apple.com/us/app/skylight-app/id1438779037` `[VERIFIED]`
- Android: package `com.skylightframe.mobile`, `https://play.google.com/store/apps/details?id=com.skylightframe.mobile` `[VERIFIED]`

**Scope:** the phone app experience only, as it relates to the Calendar product, for building an identical clone's responsive/phone layout.
**Purpose:** exhaustive reference for replicating the mobile app's information architecture, screens, flows, and notifications.
**Date compiled:** 2026-08-28.

## Evidence tags
| Tag | Meaning |
|---|---|
| `[VERIFIED](url)` | Confirmed against a cited App Store, Google Play, Skylight help-center, or myskylight.com page. |
| `[SCREENSHOT: filename]` | Confirmed by viewing a downloaded App Store/Google Play screenshot (stored in scratchpad `skylight/app/`, filename referenced). |
| `[INFERRED]` | Reasonably inferred from adjacent/related verified facts, not directly stated. |
| `[UNKNOWN]` | Not determinable from available material at research time. |

## Table of contents
- 1. App identity & store listings
- 2. Screenshots reviewed (full descriptions)
- 3. Information architecture (bottom tabs, home screen, device switching)
- 4. Onboarding & login
- 5. Device pairing / adding a second device
- 6. Calendar in the app
- 7. Tasks (chores, routines, star values)
- 8. Rewards
- 9. Lists
- 10. Meals / Recipes
- 11. Photos
- 12. Profiles
- 13. Sidekick (AI import)
- 14. Manage Users / invites / sharing access
- 15. Settings & notification preferences
- 16. Notifications sent by the app / activity feed
- 17. Release notes / version history
- 18. Reviews & third-party coverage
- Open questions
- Sources

---

## 1. App identity & store listings

### iOS (App Store)
- App name: "Skylight App". Subtitle: "Your Family Calendar + Photos". `[VERIFIED](https://apps.apple.com/us/app/skylight-app/id1438779037)`
- Developer: Skylight Frame. `[VERIFIED]`
- Rating: 4.8 out of 5, ~51K ratings. `[VERIFIED](https://apps.apple.com/us/app/skylight-app/id1438779037)`
- Price: Free with in-app purchases. `[VERIFIED]`
- Category: Photo & Video. `[VERIFIED]`
- Compatible devices: iPhone, iPad, Mac (Apple silicon M1+), Apple Vision; requires iOS 16.6+. `[VERIFIED]`
- Description summarized: "family operating system" consolidating calendars, lists, routines, memories; unlimited calendar syncing, recurring chores, shared grocery lists, rewards for completed tasks, family recipe collections, photo/video uploads; Frame integration for WiFi-connected digital display management with uploads via app or email. `[VERIFIED]`
- Recent "What's New" entries visible at fetch time (all generic): v2.21.0, v2.20.0 (Aug 17), v2.19.0 (Aug 10) — all "Bug fixes and performance improvements." `[VERIFIED]` — see §17 for more.
- User feedback (App Store, aggregated): praised for simplicity, especially email photo-sharing and intuitive UI; criticized for requiring constant internet connectivity (no offline viewing) and for recurring-event editing bugs around midnight/timezone boundaries. `[VERIFIED]`

### Android (Google Play)
- App name: "Skylight". Package id **`com.skylightframe.mobile`** (NOT `com.skylightframe.app`, which 404s). `[VERIFIED](https://play.google.com/store/apps/details?id=com.skylightframe.mobile&hl=en_US)`
- Rating: 4.0 out of 5 stars, 27.4K reviews (as rendered in the page's primary rating block; other locale/aggregation snippets on the same page showed slightly different counts, e.g. 26.9K — likely regional variants of the same metric). `[VERIFIED]`
- Description opens: "Skylight is the operating system for your family, bringing everyone's calendars, lists, routines, and memories into one place." Description also separately markets the Frame side: "Skylight Frame — Easy setup: Connect to WiFi and go..." `[VERIFIED]`
- Google Play developer account listing name: "Skylight Frame". `[VERIFIED]`
- A review snippet visible in the page (developer reply) references a known bug: "...Skylight on a blue background. The only fix I've found is to uninstall..." — i.e. some users report a stuck splash/loading screen requiring reinstall. `[VERIFIED]` (as a review excerpt, not an official statement)

### Also on the App Store (adjacent listings noticed, not in scope but worth noting for disambiguation)
- Distinct unrelated apps named "Skylight Social" (`social.skylight`) and "Skylight" games publishers exist on Google Play; these are NOT the family-calendar app. `[VERIFIED]` (surfaced during package-id search, excluded from this research)

---

## 2. Screenshots reviewed (full descriptions)

10 iPhone marketing screenshots were downloaded from the App Store CDN (mzstatic.com) and viewed directly. Local files: `skylight/app/shot01.jpg` … `shot13.jpg` (numbering follows Apple's internal frame numbering, which skips some indices). All are iOS marketing screenshots — each combines a headline, a device photo/mockup, and (mostly) a real in-app screen capture. Device chrome shown is an iPhone with Dynamic Island, status bar reading "9:41" (Apple's standard mock time) in most shots.

### shot01.jpg — Cover / hero slide
`[SCREENSHOT: shot01.jpg]`
- Dark teal-green background. "Skylight" wordmark (white serif) at top.
- Headline: "Always Connected" in large light-blue bold sans-serif, on two lines.
- Subhead: "Spend less time scheduling and more time together with technology built for families." (white, regular weight)
- Below: a wide tablet/frame-shaped device mockup showing the **Skylight Calendar's Week view**: header "Miller Family · 11:20 AM · ☀ 80°"; a settings/user icon top-right; four profile pills ("Dad 1/20", "Ellie 1/20", "Harper 1/20", "Luke 1/20"); a left icon rail (Calendar, Tasks, Rewards, Meals, Photos, Lists, Sleep, Settings); a 4-day columns view (Wed 18–Sat 21) with color-coded event blocks (e.g. "Grocery Run", "Coffee With Diane", "Dog's Big Bath Day!", "Pickup Dry Cleaning", "House Cleaner", "Study Group", "Emma's Birthday Part[y]", "Lunch With Mom", "Amelia's Baby Shower", "Tutoring"), each block tinted per profile color and showing a small circular avatar.
- Bottom: two framed family photos (a father/daughter portrait; a girl jumping on a beach), representing the physical Skylight Frame hardware.
- This slide is a device/hero image, not a phone-app screen itself, but it documents on-device chrome for cross-reference with `01-calendar-tab-and-events.md`.

### shot02.jpg — Photos / Albums screen
`[SCREENSHOT: shot02.jpg]`
- Headline: "Share Photos That Show up in Seconds" (dark navy bold serif/sans mix, with green underline highlight under "in Seconds").
- Phone screenshot below, cream background:
  - Top-left: hamburger menu icon (≡).
  - Title: "millerfamily" (the Family Email/account name), serif italic-ish display font.
  - Row of 4 circular icon buttons with labels: "Albums" (stacked-photos icon), "Invite" (person+ icon), "Slideshow" (play icon), "Remote" (a small speaker/remote icon).
  - Below: a 3-column photo grid (thumbnails of family photos — beach, paddleboard, dog, kids, etc.), roughly 5 rows visible.
  - Floating circular blue "+" button bottom-right for adding photos.
  - Confirms Photos-tab IA: Albums / Invite / Slideshow / Remote as the four top-level actions.

### shot03.jpg — Home / family dashboard screen
`[SCREENSHOT: shot03.jpg]`
- Headline: "Keep Track of Every Detail, All in One App" (dark bold serif-ish, green underline on "All in One App").
- Phone screenshot, cream/white:
  - Top bar: back arrow (←), title "Miller Family" (serif), and a profile/settings icon (person with gear) top-right.
  - 3×3 grid of circular colored icon buttons with labels — this is the app's **top-level feature grid / home screen**: "Calendar" (red calendar icon), "Tasks" (green checkmark), "Rewards" (yellow star), "Lists" (blue clipboard/list), "Meals" (orange fork+knife), "Recipes" (blue open-book), "Photos" (light-blue image icon), "Profiles" (gray people icon), "Sidekick" (purple sparkle icon).
  - Below the grid: an agenda-style card, "Thurs, Nov 13" heading, listing 3 upcoming events as colored rows with time range and a small avatar on the right: "Science Fair at School Playground · 10 – 11 AM" (purple), "Visit Grandma · 6 – 7 PM" (green), "Choir Concert · 5 – 6 PM" (red/pink).
  - This is the **family/account home screen** — the screen a user lands on after picking a device/family, showing the full app IA as 9 icons plus a rolling agenda preview.

### shot04.jpg — Week/Schedule calendar view with event creation
`[SCREENSHOT: shot04.jpg]`
- Headline: "Sync Everyone's Schedules Anytime, Anywhere" (green underline on "Sync Everyone's").
- Phone screenshot, cream/white:
  - Top bar: back arrow, title "Nov 16 - Nov 22" (date range, serif).
  - Toolbar row of 5 icon+label buttons: "Previous" (‹), "Today" (calendar icon), "Next" (›), "Week" (crossed-eye-like calendar icon — likely a view switcher, icon looks like an eye with slash, ambiguous but labeled "Week"), "Filter" (eye-slash icon), "Search" (magnifying glass). Note: label order in the screenshot reads Previous / Today / Next / Week / Filter / Search — 6 controls total in one horizontal row.
  - Below: a day-grouped agenda list ("Tue 18", "Wed 19" with a red circular date badge "19", "Thu 20"), each date showing its events as colored full-width rows with title, time range, and avatar chip: "Spanish class 5–6 PM", "Math tutor 6–7 PM" (purple/lavender); an **in-progress event-creation row** shown as an outlined/unfilled card reading "Spaghetti" with an orange "Dinner" pill — this is the inline "type a title" state of creating a new event/meal directly in the list; "Painting class 10–11 AM", "Soccer 10:30 AM–12:30 PM", "Cook dinner 5–6 PM", "Pack dishwasher 7–8 PM" (this row shows TWO avatars, confirming multi-profile assignment renders as a split/dual-color block), "Garbage truck 6–7 AM", partially cut off "Pep rally".
  - Floating circular blue "+" button bottom-right (persistent add button, present on nearly every list-style screen in the app).
  - This is best evidence for the phone's **primary calendar view being an "agenda"/Schedule-like list grouped by day** (not a grid), with a lightweight inline quick-add row.

### shot05.jpg — Grocery list screen
`[SCREENSHOT: shot05.jpg]`
- Headline: "Track To-Dos & Groceries with Customizable Lists" (green underline on "Track To-Dos &").
- Phone screenshot, cream/white:
  - Top bar: back arrow, title "Grocery list".
  - Toolbar row of 5 icon+label buttons: "Select" (checkbox icon), "Edit list" (pencil/doc icon), "Completed" (eye icon), "Organize" (sparkle icon — likely AI-assisted sorting), "Order" (carrot icon — likely "sort/reorder by aisle" or grocery-specific ordering).
  - Below: list items grouped into collapsible category sections with light peach/tan background bars: "Bakery ··· 2 items ⌃" (containing "Bread", "Bagels" each with an empty checkbox), "Dairy ··· 1 item ⌃" ("Milk"), "Household ··· 1 item ⌃" ("Dish soap"), "Pantry ··· 1 it[em]" ("Kosher salt", cut off at bottom).
  - Each category header shows a "•••" overflow menu, item count, and a collapse/expand chevron.
  - Floating circular blue "+" button bottom-right.
  - Confirms Lists feature: category-grouped grocery lists with AI "Organize" and "Order" actions.

### shot06.jpg — Tasks (chores) day view with per-profile stars
`[SCREENSHOT: shot06.jpg]`
- Headline: "Help Your Family Get Things Done with Intuitive Task Trackers" (green underline on "Get Things Done").
- Phone screenshot, cream/white:
  - Top bar: back arrow, title "Wed, Nov 19".
  - Toolbar row of 5 icon+label buttons: "Previous" (‹), "Today" (calendar icon), "Next" (›), "Filter" (eye-slash icon), "Task Box" (a box/archive icon — likely an inbox for unscheduled/unassigned tasks).
  - Below: a horizontally scrollable row of circular profile avatars with names: "Harper" (selected/highlighted with a colored ring), "Luke", "Ellie", "Dad", "Mom".
  - Below that: a summary card for the selected profile "Harper" showing a progress bar "1/20" (tasks done today) and a star count pill "⭐ 10".
  - Below the summary card: 4 time-of-day / category filter buttons: "Morning" (sun+cloud icon), "Afternoon" (sun icon), "Evening" (moon icon), "Chores" (broom icon) — confirms tasks are organized into Morning/Afternoon/Evening routines plus a separate "Chores" bucket.
  - Section header: "Morning".
  - Task rows shown as cards with an icon/illustration, title, and a star-value pill: "Brush teeth" (toothbrush icon) "⭐ 10" with an empty circular checkbox at the right; "Get dressed" (shirt icon), row cut off at bottom before showing its star value/checkbox.
  - Floating circular blue "+" button bottom-right.
  - This is the single richest screenshot for the Tasks feature: profile selector → per-profile progress/star summary → Morning/Afternoon/Evening/Chores routine buckets → individual task cards with icon + title + star value + completion checkbox.

### shot10.jpg — Profile edit screen (avatar/photo picker)
`[SCREENSHOT: shot10.jpg]`
- Headline: "Personalize Your Profile with Photos or Avatars" (green underline on "with Photos or Avatars").
- Phone screenshot, cream/white:
  - Top bar: back arrow, title "Theresa" (the profile's name).
  - Large horizontally-scrollable avatar picker strip: a selected circular photo avatar (a real photo of a smiling woman) in the center with an orange ring and a small orange pencil/edit badge bottom-right of the avatar; flanking it, partially visible illustrated animal avatar icons (a cat/fox-like icon on the left edge, a husky-dog icon and another cropped icon on the right edge) — confirms preset illustrated-animal avatars exist alongside photo-upload avatars.
  - Below the avatar strip: a horizontal row of color swatches (about 10 dots: shades including tan, gold/orange (selected, shown with a ring), pale yellow, brown, dark green, medium green, light green, teal, light blue, and more offscreen) — the Profile color picker.
  - Below: three list rows, each with a leading icon: a "name badge" icon + "Theresa" (name field), a "cake/gift" icon + "Birthday" (tap to set), a "calendar-sync" icon + "Linked Calendars" with a chevron/dropdown on the right.
  - Bottom: full-width rounded blue button "Add" (this is the create-profile screen, since the button reads "Add" not "Save").
  - This is the clearest evidence for the Profile creation/edit form: Avatar (photo or preset illustrated icon) → Color swatch → Name → Birthday → Linked Calendars → Add/Save button.

### shot11.jpg — Sidekick (AI import) screen
`[SCREENSHOT: shot11.jpg]`
- Headline: "Magically Import Details From Emails, PDFs, & Printouts with Sidekick*" (green underline on "Magically Import").
- Phone screenshot, cream/white:
  - Top bar: back arrow, title "Sidekick".
  - Subhead text: "Meet Sidekick, the easiest way to stay organized."
  - A 2-column grid of 5 feature cards, each with an icon, bold title, and short description:
    - "Import Events" (calendar-sync icon) — "Turn PDFs, emails, photos, and more into smart events."
    - "Import List" (document/lines icon) — "From any photo, screenshot, or handwritten list."
    - "Import a Recipe" (open book icon) — "From a cookbook, website, or Grandma's handwritten recipes."
    - "Fridge Photo" (fridge icon) — "Generate a recipe from the food you have on hand."
    - "Plan Meals" (stacked-bowl icon) — "Tell us what sounds good and we'll plan a week of meals." (this card spans/sits alone in the last row)
  - Bottom link: "See Past Imports" (blue text link, centered).
  - Footnote below the phone mockup: "*Sidekick is included with Calendar Plus."
  - Sidekick is a distinct AI-powered utility, reachable from the family home-screen 3×3 grid (see shot03), for OCR/AI-assisted content import across Events, Lists, Recipes, and Meal Planning. Gated behind the "Calendar Plus" paid tier.

### shot12.jpg — Recipes list + Meal planner (two phones)
`[SCREENSHOT: shot12.jpg]`
- Headline: "Design Meal Plans & Create New Recipes from Scratch*" (green underline on "Design Meal Plans &").
- Two overlapping phone screenshots:
  - **Back phone — Recipes list:** top bar "← Recipes"; 3 filter chips "Breakfast" (red B), "Lunch" (teal L), "Dinner" (yellow D); a "Search" input field; an alphabetical(ish) list of recipe rows each with a small colored category-letter badge and title: "Acai bowl" (B), "Avocado and po[tatoes?]" (B), "Banana bread" (L), "Chia seed oatme[al]" (B), "Cornflakes" (B), "Granola" (S — snack, orange badge), "Oatmeal muffins" (S), "Pancakes" (B), cut off "Peanut butter [...]".
  - **Front phone — Meal planner day view:** top bar "← November 2025"; toolbar "Today" / "Filter" (eye-slash) / "Recipes" (book icon) / "Plan Meals" (sparkle icon); a day list "Wed" with red badge "2", grouped by meal: "Breakfast" section — "Pancakes", "Milk & Cereal", "Yogurt Parfait" (all pink/red rows); "Lunch" section — "Sandwiches", "Hot Lunch" (light-teal rows); "Dinner" section — "Spaghetti and Meatballs" (yellow/tan row); "Snack" section heading visible at the very bottom, cut off.
  - Floating circular blue "+" button bottom-right on the front phone.
  - Footnote: "*Meal Planning & recipe generation is included with Calendar Plus."
  - Confirms Recipes are tagged by meal-category (Breakfast/Lunch/Dinner/Snack, color-coded) and the Meal Planner is a separate calendar-like view organized by date → meal-category → assigned recipe/food item, with an "AI Plan Meals" shortcut.

### shot13.jpg — Rewards screen
`[SCREENSHOT: shot13.jpg]`
- Headline: "Motivate Kids to Accomplish Goals with Rewards*" (green underline on "Accomplish Goals").
- Phone screenshot, cream/white:
  - Top bar: back arrow, title "Rewards".
  - Two icon+label toggle buttons: "Give Stars" (star icon) and "Redeemed" (eye-slash icon, i.e. toggle to view redeemed-reward history).
  - Horizontally scrollable profile avatar row, each avatar with a star-count pill beneath: Harper "⭐25", Luke "⭐10", Ellie "⭐30", Dad "⭐0", Mom "⭐0".
  - Selected-profile summary card: avatar + "Harper" + "⭐25".
  - List of reward cards below, each with an emoji icon, title, and either a redeem button or progress bar:
    - "🍿 Popcorn & a Movie" — full-width purple/mauve pill button "Redeem ⭐25" (enabled — profile has enough stars).
    - "🧩 Family Game Night" — a progress bar reading "⭐25/30" (not yet enough stars; bar ~83% filled, muted/grey styling since not redeemable yet).
    - "🍨 Scoop of ice cream" — greyed-out row with "Redeemed on Sep 27" (past redemption, no longer actionable).
  - Floating circular blue "+" button bottom-right (create new reward).
  - Footnote: "*Rewards is included with Calendar Plus."
  - This is the clearest evidence for the Rewards screen: Give Stars/Redeemed toggle → profile star-balance strip → per-reward cards showing either an active "Redeem ⭐N" button, an in-progress "⭐current/goal" bar, or a greyed "Redeemed on [date]" state.

### Screenshots not downloaded / not iPhone marketing set
- iPad screenshot base URLs were also present in the App Store HTML (e.g. `Apple_iPad_Preview_Frame_01` through `_12`) but were out of scope (task specifies phone experience); not downloaded.
- Google Play screenshot URLs (play-lh.googleusercontent.com) were extracted (dozens of hashed URLs, no filenames indicating content) but could not be reliably identified as "the app's actual screenshots" vs. unrelated CDN assets on the page (icons, review-author avatars, other apps' promo tiles) without opening each one; time was prioritized on the definitively-identified, high-yield App Store set instead. `[UNKNOWN]` — Play Store screenshot content not independently verified beyond what the 10 App Store shots already established (the apps are the same product/UI).

**Total screenshots viewed: 10** (all from the iOS App Store CDN).

---

## 3. Information architecture

### App home / navigation shell
- After choosing an account/family, the user lands on a **family home screen** (`[SCREENSHOT: shot03.jpg]`) titled with the family's display name (e.g. "Miller Family"), showing a **3×3 grid of 9 feature icons**: Calendar, Tasks, Rewards, Lists, Meals, Recipes, Photos, Profiles, Sidekick — plus a rolling "upcoming events" agenda card below the grid. `[SCREENSHOT: shot03.jpg]`
- This 9-icon grid is the phone app's primary IA — unlike the on-device Calendar hardware, which uses a persistent left/bottom icon rail with 8 tabs (Calendar, Tasks, Rewards, Meals, Photos, Lists, Sleep, Settings) per `01-calendar-tab-and-events.md`. The phone app's grid additionally surfaces **Recipes** and **Sidekick** as top-level, and does not show "Sleep" as a top-level icon (Sleep Mode is presumably nested in Settings on mobile). `[SCREENSHOT: shot03.jpg]` cross-referenced against `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36824456433051-Navigation-and-Menus)` (device nav, per sibling doc 01)
- Top-right of the family home screen is a person+gear icon — likely the account/profile-management or settings entry point. `[SCREENSHOT: shot03.jpg]`
- **"My Skylight Menu" location — minor source discrepancy:** every Settings/Invite/Transfer-Ownership/Approve-Sender help article fetched in this pass (§14, §15) independently and consistently describes tapping "the My Skylight Menu button in the **upper right** corner" to reach Settings, Invite Others, Linked Devices, etc. However, the "A New Look for Skylight Apps" redesign changelog summary (an AI-generated summary of that article, not a verbatim quote) described the new "My Skylight menu" button as appearing in the "upper **left** corner." Given 5+ independently-fetched articles agree on upper-right and only one (lower-confidence, summarized rather than quoted) source says upper-left, **upper-right is treated as the more reliable reading** in this document, but this should be re-verified visually (e.g. against a fresh screenshot of the current hamburger/menu icon position) before being treated as ground truth for a clone. `[UNKNOWN]` — flagged in Open Questions.
- The Photos section, once entered, has its own sub-navigation bar (Albums / Invite / Slideshow / Remote) rather than living inside the 3×3 grid permanently — i.e., tapping "Photos" drills into a dedicated screen with its own toolbar, titled with the Family Email handle (e.g. "millerfamily") and a hamburger (≡) menu for further navigation (likely switching between multiple devices/families). `[SCREENSHOT: shot02.jpg]`
- **Bottom option bar with a notification bell**: per the help center, "the notification bell icon in the center of the option bar at the bottom of the page" opens a feed of "recent interactions with any device under your account." This describes a **persistent bottom tab/option bar** distinct from the 3×3 home grid — implying the 9-icon grid is the content of one particular screen (likely a "Home" or per-device landing tab), while a bottom bar (with icons flanking a center notification bell) persists app-wide for cross-device navigation. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360053148432-How-do-I-view-notifications-for-recent-account-interactions-with-my-frames)` — exact bottom-bar icon set beyond "bell in the center" `[UNKNOWN]`.
- Switching between multiple Skylight devices/frames: the Photos screen's hamburger menu (≡) is the most likely device-switcher entry point (shown next to the family/device name "millerfamily"), consistent with the "confirm you're on the correct device's home screen if you have multiple Skylight devices" instruction found in the sharing-access article. `[SCREENSHOT: shot02.jpg]` + `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/32077029247643-Sharing-Access-To-Calendar)` (existence of multi-device switching), exact UI `[INFERRED]`

### Per-section entry toolbars (consistent pattern)
Nearly every list-type screen (Calendar/Schedule, Tasks, Lists) uses the same header pattern: back arrow + screen title (often a date/date-range), then a horizontal row of icon+label buttons for view/utility actions, then the content list, then a persistent circular blue "+" FAB bottom-right for quick-add. `[SCREENSHOT: shot04.jpg, shot05.jpg, shot06.jpg]`

---

## 4. Onboarding & login

### Account creation (no device required)
Source: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/40925182674331-Sign-Up-for-a-Skylight-Account-Without-a-Device)`
1. Download the app (App Store / Google Play) or use the desktop app at ourskylight.com.
2. On first launch, a textbox reads "Enter your email to start" — enter email.
3. Tap "Next".
4. Complete a "Create Account" screen (fields not fully enumerated by this article beyond "your information") → tap "Create Account".
5. A welcome dialog appears; tap "Let's get started."
6. To proceed without a physical device, choose "Just exploring the app for now."
7. Set up a **Family Email**: enter a unique name (validated as not-a-duplicate) that becomes `[name]@ourskylight.com`; tap "Next" to confirm.
8. The Family Email is the mechanism by which non-account-holders (family/friends) can send photos/events via email or use it to log into the mobile/desktop app to view and manage content.

### Account creation with a device (frame activation flow)
Source: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360022893312-Can-I-activate-my-frame-using-the-mobile-app)`
1. Download app → enter email → "Next Step".
2. Enter name, phone number, create a password → "Create account". (Confirms **email + password** is a supported sign-in method; no mention in this article of magic-link, Google, or Apple sign-in — see Open Questions.)
3. Tap "Add Device" (+ icon).
4. Select "Photo Frame" as device type.
5. Choose "Yes" to activate a new Skylight device.
6. Designate who the frame is for (i.e., assign/create an owner Profile).
7. Create a unique Skylight email address in the format `__________@ourskylight.com` (this is the Family Email / device email, format confirmed distinct from the account email).
8. Optionally link a Skylight Plus subscription.
9. Set privacy preferences (who can send photos — see §14/§15 Privacy settings).
10. Invite loved ones to share photos.
11. The app displays an **activation code**, valid for **1 hour**.
12. Once the physical frame connects to Wi-Fi, the user enters the code on the frame to complete pairing.
13. If the code expires: return to the app, tap the device (or the Skylight email address) → "Activate Device" → receive a new code.

### Adding a second device
- The "+"/"Add Device" flow (steps 3–13 above) is re-usable for pairing additional frames to the same account; the app's device list (reachable via hamburger menu per shot02, or via the "choose the device to transfer/configure" step seen in Settings and Transfer Ownership flows) shows all paired devices. `[VERIFIED]` (existence of multi-device list) + `[INFERRED]` (exact "add another device" entry point beyond the original onboarding "+ Add Device" button)

### Sign-in methods observed/confirmed
- Email + password: confirmed via account-creation flow (password created at signup) and via the "log in to the app using your personal email address and the password created during account setup" instruction in the notifications article. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360053148432-How-do-I-view-notifications-for-recent-account-interactions-with-my-frames)`
- Family Email access: anyone with the Family Email can use it with the Mobile or Desktop App "to view and manage all of your events and photos" — this suggests the Family Email itself may function as an alternate/shared login credential (exact mechanism — magic link email vs. shared password — not stated). `[VERIFIED]` (capability), mechanism `[UNKNOWN]`
- Google / Apple social sign-in: not mentioned in any fetched help-center article. `[UNKNOWN]`
- Magic-link sign-in: not explicitly documented, though the "Family Email" + "Invite" link-sharing pattern (§14) functions similarly (an activation link grants access without a traditional password). `[UNKNOWN]` whether a literal passwordless "magic link to your email" option exists on the standard login screen.

---

## 5. Device pairing / adding a second device
(Merged into §4 above — the activation-code flow is identical for first and subsequent devices.) Pairing code format: alphanumeric, generated per-device, **expires after 1 hour**, regenerable from the app via device → "Activate Device". `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360022893312-Can-I-activate-my-frame-using-the-mobile-app)`

---

## 6. Calendar in the app

### Views
- The phone app's calendar defaults to an **agenda/list view grouped by day** with date headers (e.g. "Tue 18", "Wed 19") and a top toolbar reading "[date range]" with Previous/Today/Next/[view toggle]/Filter/Search controls. `[SCREENSHOT: shot04.jpg]`
- A labeled "Week" toolbar icon appears (icon rendered as an eye-like glyph in the screenshot, ambiguous whether that's a rendering artifact or intentional) suggesting a **view-switcher control** exists to toggle between Week and other views (Day/Month) from this toolbar, consistent with the on-device Calendar's Day/Week/Month/Schedule view family. `[SCREENSHOT: shot04.jpg]` — exact full list of phone-available views (whether Month grid exists on phone, or only agenda-style Day/Week) `[UNKNOWN]`, best evidence points to an agenda-first design.
- A "Search" icon/control exists on the calendar toolbar (magnifying glass) — event search is available on mobile. `[SCREENSHOT: shot04.jpg]`
- A "Filter" icon (eye-slash) exists on the same toolbar — consistent with the device Filter panel (profile show/hide, weather, meals, tasks progress) documented in `01-calendar-tab-and-events.md`, though the phone's filter panel contents were not separately screenshotted. `[SCREENSHOT: shot04.jpg]` (control exists) / `[UNKNOWN]` (phone filter panel contents)

### Event rendering in list/agenda view
- Each event renders as a full-width, rounded, color-tinted row: **Title** (bold), **time range** (e.g. "10 – 11 AM") below it, and a small circular **profile avatar** chip at the row's right edge. `[SCREENSHOT: shot03.jpg, shot04.jpg]`
- Multi-profile events render as a single row with **two (or more) avatar chips** and the row background split/blended between the profiles' colors (seen on "Pack dishwasher 7–8 PM" with two avatars in shot04). `[SCREENSHOT: shot04.jpg]`
- An event/meal being actively created shows as an **outlined (unfilled) card** with just the title text and, for a meal, a colored category pill (e.g. "Dinner") — i.e., a lightweight inline-creation affordance directly in the agenda list, separate from any full-screen "create event" sheet. `[SCREENSHOT: shot04.jpg]`
- A red circular date badge (e.g. "19") appears next to "today" in the date-grouped list — analogous to the on-device orange "today" dot documented in doc 01, but rendered here as a red numbered badge. `[SCREENSHOT: shot04.jpg]`

### Event create/edit sheet — fields (from help-center evidence, not directly screenshotted)
Not directly captured in the 10 downloaded screenshots (no full-screen "add event" modal was among them). Based on the Tasks-creation-form evidence (§7) and general list-based creation pattern (outlined inline row in shot04), the calendar likely uses a **similar sheet**: Title → Profile(s) → Date/time → (recurrence, location, reminder — not directly evidenced). `[INFERRED]` — full field-by-field order for Events specifically is `[UNKNOWN]` from material gathered in this pass; cross-reference with doc 01 (device-side event sheet) recommended, since the phone and device forms are likely near-identical per Skylight's "sync across devices" model.

### Event details
Not separately screenshotted in this pass. `[UNKNOWN]`

---

## 7. Tasks (chores, routines, star values)

### Screen layout (from shot06)
1. Top toolbar: Previous / Today / Next / Filter / **Task Box** (an inbox-style bucket, likely for unscheduled or unassigned tasks). `[SCREENSHOT: shot06.jpg]`
2. Horizontally scrollable **profile selector** row (avatars + names); selecting a profile filters the task list to that person. `[SCREENSHOT: shot06.jpg]`
3. Selected-profile **summary card**: a progress bar showing tasks completed today (e.g. "1/20") and a star-balance pill (e.g. "⭐10"). `[SCREENSHOT: shot06.jpg]`
4. **Routine bucket selector**: four buttons — "Morning" (sun+cloud), "Afternoon" (sun), "Evening" (moon), "Chores" (broom) — confirming tasks are split into time-of-day routines plus a standalone Chores bucket. `[SCREENSHOT: shot06.jpg]`
5. Section-headed task list (e.g. "Morning"): each task is a card with an illustrative icon (e.g. toothbrush for "Brush teeth", shirt for "Get dressed"), the task title, a star-value pill (e.g. "⭐10"), and a circular completion checkbox on the right. `[SCREENSHOT: shot06.jpg]`
6. Floating "+" FAB to add a new task. `[SCREENSHOT: shot06.jpg]`

### Creating a task/chore with a star value (help-center flow)
Source: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30485221515163-How-do-I-assign-stars-to-new-chores)` (requires Calendar Plus subscription)
1. Open the Skylight App (Mobile or Desktop).
2. Select "Tasks".
3. Tap the Add button.
4. Tap "Add task".
5. Enter a title in the **Title** textbox.
6. Select one or more **Profiles** for the task.
7. In the **Stars** textbox, set the number of stars awarded for completion.
8. Tap "Add".

### Star values — app-only constraint
- **Confirmed:** "Rewards and stars can only be created, edited, and managed via the Skylight App" — the on-device Calendar can only *view* reward progress and *redeem* rewards once enough stars are earned; it cannot create rewards, assign star values to tasks, or manually give/take away stars. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30453280620187-What-can-I-manage-in-the-Skylight-App-vs-on-the-device)` and `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846860676123-Using-the-Rewards-Tab)`
- Capability matrix:

| Capability | Skylight App (mobile/desktop) | Calendar device |
|---|---|---|
| Create rewards | Yes | No |
| Assign stars to chores | Yes | No |
| Give / take away stars manually | Yes | No |
| View rewards | Yes | Yes |
| Redeem rewards | Yes | Yes |

`[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30453280620187-What-can-I-manage-in-the-Skylight-App-vs-on-the-device)`

### Editing stars on an existing chore
Source: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30486916645531-How-do-I-assign-stars-to-existing-chores)`
1. Open the Skylight App (Mobile or Desktop).
2. Select Tasks.
3. Select the Task.
4. Tap the context menu (⋯, upper right).
5. Tap "Edit."
6. Enter the value in the **Stars** textbox (may require scrolling to find it).
7. Tap "Save."

### Removing / deducting stars manually
Source: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30479963424667-Can-I-take-away-stars)`, shipped feature: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/50338072005147--Feature-Remove-Stars)` (released 2026-05-13, Calendar Plus only)
1. Select Rewards.
2. Select "Give stars."
3. Choose the profile(s) to deduct from.
4. In the Stars field, enter a **negative number** (a dash `-` in front of the amount) — e.g. `-5` removes 5 stars.
5. Tap Confirm.
- Framed by Skylight as a correction tool: "Sometimes, members of our household are awarded stars they did not earn."

### Recurring rewards
Source: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30453829370011-What-is-a-recurring-Reward-and-how-does-it-work)`
- A recurring Reward "resets after each redemption" — e.g. a reward for "30 minutes of screentime": once redeemed, its progress counter returns to 0 and the family member can work toward earning it again. Distinct from one-time rewards, which are permanently consumed after a single redemption. Controlled by the "Renew after redeeming" toggle in the reward-creation form (§8 above).

---

## 8. Rewards

### Screen layout (from shot13)
1. Top toolbar: back arrow, title "Rewards".
2. Two-button toggle: "Give Stars" / "Redeemed" (switches list content between active management and redemption history). `[SCREENSHOT: shot13.jpg]`
3. Horizontally scrollable profile row with each avatar showing its current star balance underneath (e.g. Harper ⭐25, Luke ⭐10, Ellie ⭐30, Dad ⭐0, Mom ⭐0). `[SCREENSHOT: shot13.jpg]`
4. Selected-profile header card (avatar + name + star balance). `[SCREENSHOT: shot13.jpg]`
5. Reward cards, each with an emoji + title, in one of three states:
   - **Redeemable:** full-width colored pill button "Redeem ⭐N". `[SCREENSHOT: shot13.jpg]`
   - **In progress:** a progress bar reading "⭐current/goal" (e.g. "25/30"), muted styling, no button. `[SCREENSHOT: shot13.jpg]`
   - **Already redeemed:** greyed-out row reading "Redeemed on [Month Day]" (e.g. "Redeemed on Sep 27"). `[SCREENSHOT: shot13.jpg]`
6. Floating "+" FAB to create a new reward. `[SCREENSHOT: shot13.jpg]`
- Feature gated behind "Calendar Plus" subscription (footnote on marketing slide: "*Rewards is included with Calendar Plus."). `[SCREENSHOT: shot13.jpg]`

### Creating a reward — form fields, in order
Source: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739096640667-Create-and-Redeem-Rewards)`
1. **Title** (required) — "will appear on the reward card."
2. **Description** (optional) — "will appear on the reward details popup."
3. **Emoji** (optional) — "will appear on the reward card."
4. **Renew after redeeming** — toggle for whether the reward is recurring/repeatable.
5. **Stars required** (required) — numeric, any amount between 1 and 500 per earlier search result. `[VERIFIED](from Stars/Tasks/Rewards search summary)`
6. **Profile(s) eligible** (required) — "Select at least one Profile that is eligible for the reward."

### Redeeming a reward
1. Open Skylight Mobile App.
2. Go to Rewards.
3. Select the Profile (swipe if needed).
4. Tap "Redeem" on the desired reward — only shown/enabled when that profile has enough stars.
5. On redemption, the star cost is deducted from the profile's balance and cannot be reused for another reward.
`[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739096640667-Create-and-Redeem-Rewards)`, `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846860676123-Using-the-Rewards-Tab)`

### Approving rewards
- No distinct "approval" step beyond redemption itself was found in fetched articles — redemption directly deducts stars once tapped (no evidence of a parent-approval queue for reward redemption specifically, as opposed to photo-sender approval, which is a separate feature — see §14). `[UNKNOWN]` whether a "request reward" / parental-approval step exists for kid-only profiles; not found in material gathered.

### Recurring rewards
- A help-center article "What is a recurring Reward and how does it work?" exists (URL found, not fetched this pass) — the "Renew after redeeming" toggle in the creation form (item 4 above) is presumably this feature's UI entry point. `[INFERRED]`

---

## 9. Lists

### Screen layout (from shot05, "Grocery list" example)
1. Top toolbar: back arrow, title (list name, e.g. "Grocery list").
2. Toolbar row: "Select" (multi-select mode), "Edit list" (rename/reorder categories), "Completed" (view checked-off items), "Organize" (AI/sparkle icon — likely AI-assisted category sorting), "Order" (carrot icon — likely aisle/shopping-order sorting). `[SCREENSHOT: shot05.jpg]`
3. Items grouped into named, collapsible categories with a light tan/peach background bar per category: category name, "•••" overflow menu, item count (e.g. "2 items"), and a chevron to collapse/expand. `[SCREENSHOT: shot05.jpg]`
4. Each item is a row with its name and an empty circular checkbox (tap to mark complete). `[SCREENSHOT: shot05.jpg]`
5. Floating "+" FAB to add a new item. `[SCREENSHOT: shot05.jpg]`
- Categories observed in the sample data: Bakery, Dairy, Household, Pantry. `[SCREENSHOT: shot05.jpg]`
- Lists appear to support both grocery-specific lists (with aisle/category organization) and general to-do lists (marketing headline: "Track To-Dos & Groceries with Customizable Lists"), implying Lists is a generic feature with grocery-specific affordances ("Organize"/"Order") shown contextually. `[SCREENSHOT: shot05.jpg]`
- Ingredients from a Recipe can be added directly to a shopping List, via **four distinct methods**: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/42181628465435-How-can-I-add-recipe-ingredients-to-the-shopping-list)`
  1. **Meal grid:** Meals tab → tap an empty meal slot (or long-press a filled one) → choose a recipe → "Add to Grocery List" when prompted.
  2. **Add button:** Meals tab → tap Add → select a recipe → "Add to Grocery List" in the confirmation dialog.
  3. **Recipe details:** Recipes tab → open a recipe → tap "Add to Grocery List" button at the top of the recipe-details page.
  4. **Sidekick Meal Planner:** when Sidekick auto-plans a week of meals, all ingredients are added to the grocery list automatically.
  - Note: "It may take a moment for all of the ingredients in the recipe to appear in your Grocery List" (async processing) — works across multiple linked Skylight Calendars.

---

## 10. Meals / Recipes

### Recipes screen (from shot12, back phone)
1. Top toolbar: back arrow, title "Recipes".
2. Three filter chips by meal category: "Breakfast" (red "B" badge), "Lunch" (teal "L" badge), "Dinner" (yellow "D" badge). (A 4th category, Snack — orange "S" badge — appears on individual recipe rows, e.g. "Granola", even though not shown as a top filter chip in this particular screenshot; likely scrolls off or the chip row itself scrolls.) `[SCREENSHOT: shot12.jpg]`
3. Search field.
4. Alphabetized(ish) list of recipe rows, each with a small colored category-letter badge and the recipe title (e.g. "Acai bowl" (B), "Banana bread" (L), "Granola" (S), "Pancakes" (B)). `[SCREENSHOT: shot12.jpg]`
- "Recipes" is the renamed/expanded successor to an older "Recipe Box" feature; both a Calendar-device "Recipes" tab and an app "Recipes" icon exist and sync. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44968259875099-Where-is-the-Recipe-Box)`

### Meal Planner screen (from shot12, front phone)
1. Top toolbar: back arrow, title = month/year (e.g. "November 2025") — i.e. the meal planner is navigated by **month**, not week.
2. Toolbar: "Today", "Filter" (eye-slash), "Recipes" (book icon — jump to Recipes list), "Plan Meals" (sparkle/AI icon — auto-generate a week of meals).
3. Day-by-day list, each date showing a red numbered badge (e.g. "2") and meal-category sub-sections: **Breakfast** (e.g. "Pancakes", "Milk & Cereal", "Yogurt Parfait" — pink/red rows), **Lunch** (e.g. "Sandwiches", "Hot Lunch" — teal rows), **Dinner** (e.g. "Spaghetti and Meatballs" — yellow/tan row), **Snack** (section visible, content cut off).
4. Floating "+" FAB to add a meal/recipe to a slot.
`[SCREENSHOT: shot12.jpg]`
- Meal Planning and recipe generation via AI both gated behind "Calendar Plus" (marketing footnote: "*Meal Planning & recipe generation is included with Calendar Plus."). `[SCREENSHOT: shot12.jpg]`
- The calendar's own agenda view can show meals inline too — the earlier "Spaghetti / Dinner" outlined creation card in shot04 (calendar view) demonstrates meals surfacing directly on the main calendar timeline when the "Show Meals" filter is enabled (cross-reference doc 01's Filter panel "Show Meals" toggle). `[SCREENSHOT: shot04.jpg]`

---

## 11. Photos

### Screen layout (from shot02)
1. Hamburger menu (≡) top-left — likely device/account switcher.
2. Title: the account's Family Email handle (e.g. "millerfamily"), displayed without the "@ourskylight.com" suffix, in a display serif italic font.
3. Toolbar row of 4 icon+label buttons: "Albums", "Invite", "Slideshow", "Remote".
4. 3-column photo thumbnail grid (chronological, most recent likely first — order not independently confirmed).
5. Floating "+" FAB to upload/add photos.
`[SCREENSHOT: shot02.jpg]`

### Photo-sending / approval model (from help-center, not screenshotted)
- Devices can run in "Private mode," which requires the account owner to **approve new photo senders**. When an unapproved sender emails/sends a photo, the owner receives an **email notification** and must approve via a link/prompt in that email — approval is not done on the frame itself. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/42966379395995-How-to-Approve-a-Sender)`
- To manage (block/unblock) senders directly in the app: log in with the registration email → select device → tap settings icon (upper-right) → "App Settings" → "Manage Users" → manage the sender's email. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/42966379395995-How-to-Approve-a-Sender)`
- Non-account-holders can send photos/video to a frame by using the Family Email or by accepting a Skylight Invitation (see §14). `[VERIFIED](article title: "Accept a Skylight Invitation to Send Photos and Video")`
- Photos can be uploaded to the calendar "via app or email" per the App Store description. `[VERIFIED]`
- "Remote" toolbar button (shot02) likely provides a physical-remote-style control for the connected Frame's slideshow (play/pause/navigate) from the phone. `[INFERRED]`
- "Slideshow" toolbar button likely previews/manages the photo slideshow that plays on the physical Frame when idle. `[INFERRED]`

---

## 12. Profiles

### Create/Edit Profile screen (from shot10 — this screen's "Add" button indicates it is the creation flow)
1. Top: back arrow + profile name as the screen title (e.g. "Theresa" — updates live as the name is typed, or reflects the name already entered).
2. **Avatar picker**: horizontally scrollable strip. Center/selected slot can hold either an uploaded **photo** (shown with an orange ring + small pencil edit-badge) or a **preset illustrated avatar** (animal icons observed: fox/cat-like, husky dog, etc., partially visible at the strip edges). `[SCREENSHOT: shot10.jpg]`
3. **Color swatches**: a row of ~10 solid-color circles (tan, gold/orange, pale yellow, brown, dark green, medium green, light green, teal, light blue, +more offscreen); selection shown via a ring around the chosen swatch. `[SCREENSHOT: shot10.jpg]`
4. **Name** field — row with a name-badge icon, pre-filled/editable text ("Theresa"). `[SCREENSHOT: shot10.jpg]`
5. **Birthday** field — row with a cake/gift icon, tap to set (shows placeholder label "Birthday" when unset). `[SCREENSHOT: shot10.jpg]`
6. **Linked Calendars** field — row with a sync icon, shows a chevron/dropdown to select one or more external calendars. `[SCREENSHOT: shot10.jpg]`
7. Full-width rounded blue **"Add"** button pinned at the bottom (would read "Save" when editing an existing profile, per the separate help-center Edit-Profile flow). `[SCREENSHOT: shot10.jpg]` + `[VERIFIED]` ("Save" on edit, from `44740240234139-Profiles-and-Labels`, cross-referenced in doc 04)

This visually confirms and extends the field list already documented (from the help-center text alone) in `04-profiles-settings-access.md` — specifically resolving that "Open Question" as: avatar options include both **photo upload** and **preset illustrated-animal icons**, and the color palette is a **fixed swatch row of at least ~10 named/unnamed colors** (exact hex values / names not determinable from the screenshot alone). `[SCREENSHOT: shot10.jpg]`

### Default avatar state & interaction model (from dated changelog, resolves detail above)
- **Default:** before any customization, a Profile displays the person's **initials** (not a blank silhouette, not a random avatar). `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/42815603725979--Feature-Customize-Your-Profile-Picture-and-Color)`
- **Avatar picker interaction:** "swipe left or right to choose one of the included avatars," or upload your own photo — the horizontally-scrollable strip in shot10 is a swipe carousel, not a static grid. `[VERIFIED]`
- **Color picker interaction:** "swipe left and right on the color menu to set your Profile color to one of the preset colors," or use a **full custom color picker** for an arbitrary color beyond the preset swatches. `[VERIFIED]`
- This "Customize Your Profile Picture and Color" capability shipped **2025-11-03** (published 2025-10-29 per the redesign rollup), i.e. shortly after the broader app redesign. `[VERIFIED]`
- Customized profile pictures/colors apply consistently across the Mobile App, Desktop App, and the physical Calendar device. `[VERIFIED]`

---

## 13. Sidekick (AI import) — mobile-app-only feature noticed during this research

Not explicitly requested in the task brief, but material enough to a "clone the app" effort to record: `[SCREENSHOT: shot11.jpg]`
- Reached from the family home screen's 3×3 grid (purple sparkle icon, shot03).
- Screen layout: title "Sidekick", subhead "Meet Sidekick, the easiest way to stay organized," then a 2-column card grid:
  1. **Import Events** — "Turn PDFs, emails, photos, and more into smart events."
  2. **Import List** — "From any photo, screenshot, or handwritten list."
  3. **Import a Recipe** — "From a cookbook, website, or Grandma's handwritten recipes."
  4. **Fridge Photo** — "Generate a recipe from the food you have on hand."
  5. **Plan Meals** — "Tell us what sounds good and we'll plan a week of meals."
- Bottom link: "See Past Imports" (import history log).
- Gated behind "Calendar Plus" subscription.
- This is an AI/OCR content-ingestion utility layered across Events, Lists, Recipes, and Meal Planning — relevant to a clone if any AI-assisted quick-add functionality is in scope.

---

## 14. Manage Users / invites / sharing access

### Invite others to view/manage the calendar (link-sharing)
Source: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/32077029247643-Sharing-Access-To-Calendar)`
1. Open the app; if multiple devices, confirm you're on the correct device's home screen.
2. Tap the "My Skylight Menu" (upper-right corner).
3. Tap "Invite Others."
4. Tap "Invite" to open the native share sheet (Messages, Email, or any other app).
5. Tap the back arrow when done.
- **Anyone who activates the link gets full view-and-manage access to the calendar** (not read-only).

### Manage Users (settings-based, per-device access control)
Source: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/45664471763995-App-Settings)`
- Path: My Skylight Menu → Settings → choose device → **Manage Users**.
- Sub-sections:
  - **Invite Users** — enter an email address to invite.
  - **Has access** — list of current users with a "Block" option per user.
  - **Blocked Users** — list with an "Unblock" option.
- Separately, photo-sender approval also routes through Settings → App Settings → Manage Users (see §11) — i.e. Manage Users appears to be the single admin surface for both "who can edit the calendar" and "who can send photos," at least for blocking/unblocking.

### Transfer Ownership
Source: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44215589734299-Transfer-Ownership-of-a-Skylight-Device)`
1. My Skylight Menu (upper-right) → Settings.
2. Choose the device to transfer.
3. Tap "Transfer Ownership."
4. Enter the new owner's email address.
5. Tap "Transfer."
- The new owner then controls device access permissions; the original owner retains the ability to send photos/videos but loses administrative control.

### Accepting an invitation (recipient side) / joining someone else's Skylight
Source: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360022893272-Can-others-use-the-mobile-app-to-send-photos-and-videos-to-my-Skylight)`
This is a **distinct flow** from the link-sharing "Invite Others" flow in the sub-section above — this one is initiated by the *recipient*, using a known Family Email, rather than by tapping a received link:
1. Download and install the Skylight Mobile App (or use the Desktop App).
2. Create your own account: enter email in the startup textbox → complete the account-creation form → confirm at the welcome screen.
3. Tap the "My Skylight Menu" button (upper-right corner).
4. Select "Linked Devices."
5. Choose "Add a Device."
6. Select "I'm joining someone else's Skylight."
7. Select the device type (Calendar or Frame).
8. Enter the first part of the target Family Email address (the name portion before `@ourskylight.com`).
9. Tap "Add."
- Once approved, the joining user can immediately send photos/videos to that device; **sending video specifically requires the inviter to have a Frame Plus subscription.**
- This confirms a "Linked Devices" screen (reached via My Skylight Menu) as the canonical place both to add/activate a new owned device AND to join an existing device someone else owns — i.e. "Add Device" from onboarding (§4/§5) and "Add a Device" here are the same entry point, branching on "I'm activating a new Skylight" vs. "I'm joining someone else's Skylight."

---

## 15. Settings & notification preferences

### Navigation
- Open app → tap "My Skylight" menu (upper-right) → tap "Settings" → choose which Skylight Calendar/device to configure (settings are per-device). `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/45664471763995-App-Settings)`

### Settings menu structure (as documented for the mobile/desktop "App Settings")
1. **Calendar**
   - Synced Calendars
   - "Shade Weekends" toggle
   - "Dim Past Events" toggle
   - "Color Code Multi-Profile Events" toggle
   - "Show Meals" (with 4 per-meal-category toggles)
   - Default Sync calendar selection
2. **Notifications**
   - Calendar: "At time of event" toggle, "Before event" toggle
   - Before-event timing options: 10 min / 30 min / 1 hour / custom
   - Task Notifications: "When Due" toggle, "When Completed" toggle
3. **Manage Users** (see §14)
4. **Transfer Ownership** (see §14)
5. **Privacy Settings**
   - "Who can send photos?" — Approve senders / Anyone
   - "Senders can see" — All photos / Only their own
`[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/45664471763995-App-Settings)`

### Push notification status (resolved — now live as of 2026)
- An older help-center snapshot (article last updated **December 20, 2024**) stated: **"in-app push notifications are unavailable"** at that time, with the company "actively working on making this feature accessible in the near future." `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/32083277890075-How-to-Set-Reminders)` — this is now **stale**.
- **Confirmed shipped**, per Skylight's own dated "What's New" changelog (see §17):
  - **"[Feature] Task Due Reminders"** (published 2026-07-30): "configure your chores to show a notification when they are due." Delivered as a **push notification on phones** or a **pop-up dialog on the Calendar device**; "Notifications will only appear if enabled, and will only appear for those chores that are due at a specific time." `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/52390654789659--Feature-Task-Due-Reminders)`
  - **"[Feature] Task Completion Notifications"** (published 2026-08-25): "Skylight now supports receiving notifications when a task is completed" — example shown is a real iOS push notification banner reading "Olivia dried the dinner dishes." Configurable via Mobile App or Desktop App Settings. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/54930439904923--Feature-Task-Completion-Notifications)`
  - These two dated feature releases, both from mid-to-late 2026, directly supersede the Dec 2024 "unavailable" statement — **iOS push notifications for task-due and task-completed events are live as of this research date (2026-08-28).**
- Reminder mechanics (device-side, but configured via Settings/per-event, and the same options are exposed in-app):
  - **At time of event**
  - **X minutes before** (custom)
  - **Play sound with reminder on Calendar** toggle (device-only, volume via hardware buttons)
  - Reminders can be set globally (Settings → Reminders tab) or per-event (open the event → enable reminder).
`[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/32083277890075-How-to-Set-Reminders)`

---

## 16. Notifications sent by the app / activity feed

### In-app notification/activity bell
Source: `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360053148432-How-do-I-view-notifications-for-recent-account-interactions-with-my-frames)`
1. Log in with personal email + password.
2. Tap "the notification bell icon in the center of the option bar at the bottom of the page."
3. View "an overview of the recent interactions with any device under your account" — example given: someone sending a photo to your frame.
- This confirms a **persistent bottom option bar** with a centered bell icon, distinct from the 3×3 home-screen grid — i.e., the bell is likely a fixed, app-wide chrome element (not buried in a per-device screen). Article dated April 10, 2023 — UI may have shifted since, but the underlying "activity feed" concept is corroborating evidence for a real, still-relevant feature.

### Notification categories implied by Settings (§15) and confirmed shipped (§17)
- Calendar event reminders ("at time of" / "before event"). `[VERIFIED]`
- **Task due** push notifications — "Task Due Reminders" feature (2026-07-30), configurable, fires only for chores due at a specific time. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/52390654789659--Feature-Task-Due-Reminders)`
- **Task completed** push notifications — "Task Completion Notifications" feature (2026-08-25); example push banner: "Olivia dried the dinner dishes." `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/54930439904923--Feature-Task-Completion-Notifications)`
- Photo-sender approval emails (out-of-app, sent to the account owner's email — see §11/§14). `[VERIFIED]`
- Account-interaction activity feed (in-app bell — new photos received, etc., per above). `[VERIFIED]`
- Reward-redeemed notifications: not explicitly documented in any fetched article; plausible given the "activity" framing but `[UNKNOWN]` whether redemption triggers a push/bell notification to parents.

---

## 17. Release notes / version history

### App Store "What's New" (undifferentiated recent builds)
- v2.21.0 (~Aug 25, 2026): "Bug fixes and performance improvements."
- v2.20.0 (Aug 17, 2026): "Bug fixes and performance improvements."
- v2.19.0 (Aug 10, 2026): "Bug fixes and performance improvements."
`[VERIFIED](https://apps.apple.com/us/app/skylight-app/id1438779037)` — Apple's web listing only shows the current version's notes, not a historical archive, and Skylight ships generic "bug fixes" copy rather than per-version feature notes on the store page itself. The real feature changelog lives on the help center (below).
- Google Play "What's New" changelog was not successfully extracted (page is JS-rendered; the section was not present in static HTML and was not pursued further given the much richer help-center changelog found). `[UNKNOWN]`

### Official "What's New" changelog (Skylight help center)
Found via the public Zendesk Help Center API (`skylight.zendesk.com/api/v2/help_center/en-us/categories/42813896436763/articles.json`), category id `42813896436763`, titled "What's New," split into a **"Calendar"** sub-section (covers Calendar device + Mobile/Desktop Apps — the changelog does not separate phone-app-only changes from device-only changes, so entries below are all changes to the broader Skylight software family, with mobile-specific ones flagged) and a **"Buddy"** sub-section (Skylight's separate kids' smart-alarm/robot product line — out of scope, not detailed here). All 48 "Calendar" articles returned by the API are listed below, newest first, with publish/update date. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/categories/42813896436763-What-s-New)`

| Date | Feature |
|---|---|
| 2026-08-26 | [Feature] Weather and Events on Screensaver |
| 2026-08-25 | **[Feature] Task Completion Notifications** — push notification when a household member finishes a task (e.g. "Olivia dried the dinner dishes"). `[VERIFIED]` see §16 |
| 2026-08-24 | [Feature] Up For Grabs Improvements |
| 2026-08-24 | [Feature] Buddy Characters *(Buddy product, out of scope)* |
| 2026-08-17 | [Feature] More Supported Languages |
| 2026-08-11 | [Feature] Snooze on Buddy *(out of scope)* |
| 2026-08-06 | [Feature] The Calendar Home Screen Supports Day View |
| 2026-08-04 | [Feature] Multiple Alarms on Buddy *(out of scope)* |
| 2026-08-03 | [Feature] Repeat a Chore After Completion |
| 2026-07-29 | [Feature] Swipe for Month View |
| 2026-07-20 | [Feature] Buddy Character Animations *(out of scope)* |
| 2026-07-17 | [Feature] Change Buddy's Color *(out of scope)* |
| 2026-07-29 | [Feature] Weather Forecast on Buddy *(out of scope)* |
| 2026-07-15 | [Feature] Start the Month With the Current Week |
| 2026-07-07 | [Feature] Weather in Month View |
| 2026-07-02 | [Feature] Stars and Rewards on Buddy *(out of scope)* |
| 2026-07-30 | **[Feature] Task Due Reminders** — push notification / device pop-up when a scheduled chore is due. `[VERIFIED]` see §16 |
| 2026-06-30 | **[Feature] Swipe Navigation in the Mobile App Calendar** — "swipe left to show the past, and swipe right to show the future," plus a "Today" button to jump back to the current day. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/52208087026203--Feature-Swipe-Navigation-in-the-Mobile-App-Calendar)` — explicitly mobile-app-specific. |
| 2026-06-25 | [Feature] Reorder Routines |
| 2026-06-22 | [Add-On] Disney Mode |
| 2026-06-23 | [Feature] Buddy Clock Button and Weather *(out of scope)* |
| 2026-06-09 | [Feature] All Tasks View |
| 2026-06-30 | [Feature] Calendar Lists Improvements |
| 2026-06-01 | [Feature] Search for Tasks |
| 2026-06-01 | [Feature] Track Your Habits |
| 2026-05-30 | **[Feature] Profiles and Labels** — dated release announcing Profiles ("organizing the people in your household," linking events/tasks/rewards to a person) and Labels ("organizing events that are not specifically connected to an individual Profile," e.g. national holidays, garbage-pickup days, local sports schedules). `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/50636378891419--Feature-Profiles-and-Labels)` |
| 2026-05-19 | [Feature] Task Description |
| 2026-05-13 | **[Feature] Remove Stars** — "Sometimes, members of our household are awarded stars they did not earn. With the Skylight Mobile App, it's now easy to adjust a Profile to have fewer stars." Requires Calendar Plus. This is the shipped feature behind the "take away stars" help article in §7. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/50338072005147--Feature-Remove-Stars)` |
| 2026-05-30 | **[Feature] Home Screen** — "When life gets busy, it can help to see the whole picture." Consolidated view showing upcoming events (always visible) plus toggleable Tasks and Lists visibility. This is the feature behind the family-home-screen agenda card seen in shot03. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/49738858986907--Feature-Home-Screen)` |
| 2026-06-02 | [Feature] Up for Grabs Chores — unassigned/claimable chores any household member can pick up |
| 2026-04-16 | [Feature] Improved Week View for Calendar |
| 2026-04-27 | [Feature] Ask Sidekick to Help Find Local Events and Family Activities — Sidekick can search for local events matching criteria and turn results into calendar entries |
| 2026-04-14 | [Feature] Skip Tasks |
| 2026-04-08 | [Feature] Week View for Tasks |
| 2026-03-17 | Manage Multiple Grocery Lists |
| 2026-03-11 | [Release] Go From Menu To Recipe In One Click |
| 2026-03-09 | [Feature] List Improvements |
| 2026-03-09 | [Feature] Add Menus By Email |
| 2026-03-09 | [Feature] Add Recipes By Email |
| 2026-02-09 | **[Feature] List and Task Widgets For Android** — adds List/Task home-screen widgets alongside the earlier Calendar widgets documented in §"Widgets" |
| 2026-03-05 | [Feature] No Screensaver While Showing a Recipe |
| 2026-04-09 | [Feature] Upload Images With the Skylight Desktop App |
| 2025-12-01 | [Feature] Easier Recipe Access |
| 2025-12-01 | [Feature] Get Excited With Countdowns |
| 2025-11-12 | [Feature] Use Fridge Photo to Create Recipes |
| 2025-11-03 | **[Feature] A New Look for Skylight Apps** (published 2025-10-29) — major redesign: replaced the old layout with "a colorful grid of icons, collecting all of the Skylight functions in one place" (the 3×3 grid documented in §3/shot03) and added a "My Skylight menu" button for centralized account/settings access. Explicitly stated purpose: "give them a new look, and reorganized the user interface to better support adding future features." `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/42815236998299--Feature-A-New-Look-for-Skylight-Apps)` — **this dates the current app IA (9-icon grid home screen) to ~October 29, 2025.** |
| 2025-11-03 | **[Feature] Customize Your Profile Picture and Color** — profiles default to showing **initials**; users can swipe left/right through preset illustrated avatars or upload a photo, and swipe left/right through preset colors or use a full custom color picker. Applies across all Skylight Apps and on the Calendar device. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/42815603725979--Feature-Customize-Your-Profile-Picture-and-Color)` — refines §12: the avatar/color picker shown in shot10 is this shipped feature; default state before customization is initials, not a blank/photo avatar. |
| 2025-11-03 | [Feature] Reorder Your Routines |

- Note on "[Feature] Profiles and Labels" appearing twice conceptually: the dated changelog entry (2026-05-30) is a separate, newer artifact from the general evergreen help article `44740240234139-Profiles-and-Labels` used elsewhere in this doc/doc 04 — the evergreen article documents the feature as it exists today, while this changelog entry is the original release announcement.
- A "Mobile App Update (Fall 2025)" article was also referenced by search (URL not resolved to a direct id in this pass) — likely a rollup announcement overlapping with "A New Look for Skylight Apps" above. `[UNKNOWN]` exact content, not fetched.
- **Cadence observation**: Skylight ships a dated, user-facing "What's New" feature article roughly every 3–10 days across 2025–2026 — a notably fast release cadence for a family-calendar product, useful context for scoping how iteratively a clone's roadmap might need to move to stay comparable. `[VERIFIED]` (derived from the 48-entry date list above)

---

## 18. Reviews & third-party coverage

- **Reviewed.com** ("Skylight Calendar review: Perfect for busy families") — specifically on the mobile app: downloading it "while initially seeming like 'another app' to manage, actually proves valuable." Through the app, users "add meal plans, chores, and to-do lists, and the grocery list syncs with the app so you can check off items from your phone while you're at the store." On meal planning specifically: "You can add a meal plan from the device itself, and the app has a specific meal plan option that you can fill out from your phone and it will populate to the Skylight Calendar." On photos: users "simply add photos through the app on your phone." No app-specific criticisms were raised by this review. `[VERIFIED](https://www.reviewed.com/parenting/content/skylight-calendar-review-perfect-busy-families)`
- **Cubby (cubbyathome.com)** and **Taste of Home** both returned relevant review titles in search ("I Tried the Skylight Calendar, and Here's My Honest Review"; "Skylight Calendar Review: A Busy Mom's Honest Take [2026]") but both **blocked direct fetches with HTTP 403** (retried once each, per protocol, still blocked). Search-snippet-level takeaways only: Cubby/general aggregated sentiment noted "the calendar has worked smoothly since day one" with no glitches reported, easy setup, and that Sidekick's "activity planner function is a standout" (search for local events by criteria → auto-generate a calendar entry). Taste of Home's search snippet did not surface app-specific detail beyond general praise. `[UNKNOWN]` for anything beyond these snippets — full article bodies not obtained.
- **Tom's Guide** coverage found was about the **Skylight Frame hardware**, not the mobile app specifically (`tomsguide.com/reviews/skylight-frame`): praises the high-res touchscreen, flexible image uploading "via email, app, or web," and offline photo viewing; criticizes the lack of an ambient-light sensor, no motion sensor, and a required $39/year subscription to upload/view video, cloud-back-up photos, add captions, and create albums. Not fetched in full (out of scope — hardware-focused); summarized from search snippet only. `[VERIFIED](search snippet, https://www.tomsguide.com/reviews/skylight-frame)`
- **digicalendars.com** ("Skylight App Review 2025: Features & Usability") — fully fetched. Praises shared family calendar with real-time sync, chore/task tracking with color-coded scheduling, real-time-syncing grocery lists, Frame photo/video integration with text captions and cloud backup, and multi-device (multi-Frame) control from one app. Calls the app usable "by people of all ages without frustrations," positioning it as a single hub replacing separate note apps, messaging apps, and calendars. States pricing as "Free with optional in-app purchases." **No criticisms were raised** — this review reads as entirely promotional/positive with no drawbacks section. `[VERIFIED](https://digicalendars.com/skylight-app/)`
- App Store aggregate sentiment (from the store's own AI-generated review summary surfaced during fetch): praised for simple UI and instant email-to-frame photo sharing; criticized for requiring constant connectivity (no offline mode) and for bugs in recurring-event editing around midnight/timezone boundaries. `[VERIFIED](https://apps.apple.com/us/app/skylight-app/id1438779037)`
- One relevant first-party signal from Google Play itself: a review excerpt visible on the listing page references a reproducible bug — app can get stuck on a "Skylight on a blue background" splash/loading screen, with the only known fix (per that reviewer) being to uninstall and reinstall. Skylight's own help center separately confirms reinstalling **never deletes account data** — "all of your events, tasks, lists, photos, and other data will be preserved" server-side, since data is not stored locally. `[VERIFIED](Google Play listing page review excerpt, https://play.google.com/store/apps/details?id=com.skylightframe.mobile)` + `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/47443790129947-Will-reinstalling-the-Skylight-Mobile-App-delete-my-data)`

---

## Open questions

**Resolved during research (kept for traceability):**
- ~~Push notifications unclear~~ — **RESOLVED**: confirmed live via dated changelog entries "Task Due Reminders" (2026-07-30) and "Task Completion Notifications" (2026-08-25). See §16/§17.
- ~~Star deduction / recurring reward mechanism unclear~~ — **RESOLVED**: §8 now documents the negative-number "Give Stars" deduction flow and the "Renew after redeeming" recurring-reward toggle.
- ~~Recipe→shopping-list mechanism unclear~~ — **RESOLVED**: §9 now documents all 4 methods.
- ~~Default avatar state unclear~~ — **RESOLVED**: profiles default to initials, not blank/photo. See §12.

**Still open:**
1. **Full Event create/edit sheet field list on mobile** (title, profile(s), date/time, all-day toggle, recurrence rule + options, location, notes/description, reminder, sync-destination calendar, color/label) — not directly screenshotted; only inferred from the Tasks-creation pattern and the inline outlined-row quick-add seen in shot04. No dedicated "How do I add an event" mobile-specific article was located. Should be cross-verified against `01-calendar-tab-and-events.md`'s device-side event sheet.
2. **Sign-in methods**: Is there Google/Apple social sign-in or a magic-link option, or is email+password the only method? No fetched article confirms or denies social login.
3. **Exact bottom tab bar contents** beyond "notification bell in the center" — full icon set of the persistent app-wide bottom bar (as opposed to the 3×3 home grid) not enumerated by any source found.
4. **"My Skylight Menu" corner placement** — upper-right (5+ sources) vs. upper-left (1 lower-confidence AI-summarized source) — see flagged discrepancy in §3. Worth a direct visual re-check.
5. **Google Play screenshot content** — not independently viewed (only App Store screenshots were downloaded/viewed); Play Store listing likely uses the same or very similar screenshots given both apps share one codebase/design, but this is `[INFERRED]`, not `[VERIFIED]`.
6. **Google Play "What's New" changelog** — not successfully extracted (page is JS-rendered).
7. **Reward approval / parental gating** — whether a child-only profile's reward redemption requires a separate parent-approval step (as opposed to instant deduction) is unconfirmed.
8. **cubbyathome.com and tasteofhome.com full review bodies** — both blocked fetches with HTTP 403 (retried once each); only search-snippet-level detail obtained. cnet.com was entirely inaccessible to the web-search tool (domain not crawlable).
9. **Task Box** (icon seen in shot06 toolbar) — exact function not confirmed beyond "inbox-style bucket" inference.
10. **iOS widget details** — only "Widgets for Android" and the later "List and Task Widgets For Android" (2026-02-09) changelog entry were found; whether iOS has equivalent home-screen/lock-screen widgets is unconfirmed.
11. **"Mobile App Update (Fall 2025)"** article — referenced by a search result's redirect-tracking URL but its direct article id/URL was not resolved or fetched; likely overlaps with "A New Look for Skylight Apps" (2025-10-29).
12. **"Buddy" product** — a parallel Skylight hardware line (kids' smart alarm/character device) surfaced repeatedly in the changelog's "Buddy" sub-section; confirmed to exist as a distinct product but entirely out of scope for this Calendar-app research and not detailed here.

---

## Sources

- App Store listing: https://apps.apple.com/us/app/skylight-app/id1438779037
- Google Play listing: https://play.google.com/store/apps/details?id=com.skylightframe.mobile&hl=en_US
- https://skylight.zendesk.com/hc/en-us/categories/14147037941659-Mobile-App
- https://skylight.zendesk.com/hc/en-us/sections/360003639251-Skylight-Mobile-and-Desktop-Apps
- https://skylight.zendesk.com/hc/en-us/articles/44736560618267-Skylight-Mobile-App-for-iOS
- https://skylight.zendesk.com/hc/en-us/articles/44736458501915-Skylight-Mobile-App-for-Android
- https://skylight.zendesk.com/hc/en-us/articles/360023142791-How-can-I-download-the-Skylight-mobile-app
- https://skylight.zendesk.com/hc/en-us/articles/43652529058331-Widgets-for-Android
- https://skylight.zendesk.com/hc/en-us/articles/40925182674331-Sign-Up-for-a-Skylight-Account-Without-a-Device
- https://skylight.zendesk.com/hc/en-us/articles/360022893312-Can-I-activate-my-frame-using-the-mobile-app
- https://skylight.zendesk.com/hc/en-us/articles/360022893272-Can-others-use-the-mobile-app-to-send-photos-and-videos-to-my-Skylight (title only, not fetched)
- https://skylight.zendesk.com/hc/en-us/articles/32077029247643-Sharing-Access-To-Calendar
- https://skylight.zendesk.com/hc/en-us/articles/42966379395995-How-to-Approve-a-Sender
- https://skylight.zendesk.com/hc/en-us/articles/44215589734299-Transfer-Ownership-of-a-Skylight-Device
- https://skylight.zendesk.com/hc/en-us/articles/45664471763995-App-Settings (also served at /Settings-— same content, two slugs)
- https://skylight.zendesk.com/hc/en-us/articles/360053148432-How-do-I-view-notifications-for-recent-account-interactions-with-my-frames
- https://skylight.zendesk.com/hc/en-us/articles/32083277890075-How-to-Set-Reminders
- https://skylight.zendesk.com/hc/en-us/articles/360039655551-How-do-I-adjust-my-notification-preferences-for-Frame-notifications
- https://skylight.zendesk.com/hc/en-us/articles/44968259875099-Where-is-the-Recipe-Box
- https://skylight.zendesk.com/hc/en-us/articles/30453280620187-What-can-I-manage-in-the-Skylight-App-vs-on-the-device
- https://skylight.zendesk.com/hc/en-us/articles/36846860676123-Using-the-Rewards-Tab
- https://skylight.zendesk.com/hc/en-us/articles/44739096640667-Create-and-Redeem-Rewards
- https://skylight.zendesk.com/hc/en-us/articles/30485221515163-How-do-I-assign-stars-to-new-chores
- https://skylight.zendesk.com/hc/en-us/articles/30486916645531-How-do-I-assign-stars-to-existing-chores (title only, not fetched)
- https://skylight.zendesk.com/hc/en-us/articles/30479963424667-Can-I-take-away-stars (title only, not fetched)
- https://skylight.zendesk.com/hc/en-us/articles/30450528727835-What-are-Rewards (title only, not fetched)
- https://skylight.zendesk.com/hc/en-us/articles/30453829370011-What-is-a-recurring-Reward-and-how-does-it-work (title only, not fetched)
- https://skylight.zendesk.com/hc/en-us/articles/42181628465435-How-can-I-add-recipe-ingredients-to-the-shopping-list (title only, not fetched)
- https://skylight.zendesk.com/hc/en-us/articles/47443790129947-Will-reinstalling-the-Skylight-Mobile-App-delete-my-data
- https://skylight.zendesk.com/hc/en-us/articles/360022893272-Can-others-use-the-mobile-app-to-send-photos-and-videos-to-my-Skylight
- https://skylight.zendesk.com/hc/en-us/categories/42813896436763-What-s-New (and its public API: `skylight.zendesk.com/api/v2/help_center/en-us/categories/42813896436763/articles.json`)
- https://skylight.zendesk.com/hc/en-us/articles/49738858986907--Feature-Home-Screen
- https://skylight.zendesk.com/hc/en-us/articles/52208087026203--Feature-Swipe-Navigation-in-the-Mobile-App-Calendar
- https://skylight.zendesk.com/hc/en-us/articles/42815236998299--Feature-A-New-Look-for-Skylight-Apps
- https://skylight.zendesk.com/hc/en-us/articles/54930439904923--Feature-Task-Completion-Notifications
- https://skylight.zendesk.com/hc/en-us/articles/50338072005147--Feature-Remove-Stars
- https://skylight.zendesk.com/hc/en-us/articles/42815603725979--Feature-Customize-Your-Profile-Picture-and-Color
- https://skylight.zendesk.com/hc/en-us/articles/50636378891419--Feature-Profiles-and-Labels
- https://skylight.zendesk.com/hc/en-us/articles/52390654789659--Feature-Task-Due-Reminders
- https://www.reviewed.com/parenting/content/skylight-calendar-review-perfect-busy-families
- https://digicalendars.com/skylight-app/
- https://www.tomsguide.com/reviews/skylight-frame (search snippet only)
- https://www.cubbyathome.com/skylight-calendar-review-80042154 (blocked, HTTP 403, search snippet only)
- https://www.tasteofhome.com/article/skylight-calendar-review/ (blocked, HTTP 403, search snippet only)
- Cross-referenced sibling research docs (same repo, other in-progress agents): `01-calendar-tab-and-events.md`, `04-profiles-settings-access.md`

### Screenshot files (local, scratchpad only — not committed to repo)
`/private/tmp/claude-501/-Users-williamsmith-Documents-GITHUB-Portfolio/4238ca41-eaee-4717-8dee-c634bcaa9327/scratchpad/skylight/app/shot01.jpg` through `shot13.jpg` (10 files: 01,02,03,04,05,06,10,11,12,13), sourced from `is1-ssl.mzstatic.com` App Store CDN, `appstore.html` (raw App Store page), `playstore.html` (raw Google Play page).
