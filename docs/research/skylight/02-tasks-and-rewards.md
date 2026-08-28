# Skylight Calendar — Tasks Tab & Rewards Tab

Research compiled 2026-08-28, covering the Tasks tab (Chores + Routines) and Rewards tab
(stars, rewards) on the Skylight Calendar device (Calendar 2 / Calendar Max) and companion
Skylight Mobile App / Desktop App, as documented in Skylight's help center and marketing
site as of 2025–2026. This document exists to support building an identical clone as a web
app, so every UI string, field, default, and flow is captured as literally as the sources
allow.

Every fact is tagged `[VERIFIED](url)` (directly stated in a fetched source),
`[INFERRED]` (reasonably deduced from adjacent facts but not directly stated), or
`[UNKNOWN]` (not found in any source consulted).

## Task types: Chore vs Routine

Skylight's Tasks system has exactly two task types, both of which live in the Tasks tab
and both of which can earn stars.

- **Chore**: "A task that can be assigned to one or more people, and can be used to track
  completion of singular events or repeating events. Chores do not need to happen at a
  particular time of the day."
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
  A parallel definition: chores are "sets of tasks that occur at the time of your choosing,
  can be set to repeat or not and usually used for specific things that need to be done
  that aren't a regular habit" — examples given are yard work and cleaning the garage.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/35335515611803-What-Are-Tasks)
- **Routine**: "A task that is meant to repeat, to build a habit or make steady progress on
  an open-ended goal. Routines occur around the same time of day, which repeat on a daily
  basis and can be set for morning, afternoon, and evening."
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
  Also: "sets of tasks that occur around the same time of day, which repeat on a daily
  basis" — well suited to habitual, multiple-times-daily activities like hygiene or meal
  prep. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/35335515611803-What-Are-Tasks)
- Both award stars on completion, redeemable for Rewards.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738601403931-Tasks-Routines-and-Chores)
- A Chore can be converted to a Routine and vice versa: tap the task → **Edit** → select
  the target type toggle (**Routine** / **Chore**) → adjust settings, because "Routines do
  not have timing options available to Chores" (you must set repetition pattern, day, and
  time-of-day for the new Routine).
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/35340626864027-How-To-Convert-Chores-to-Routines)

## Types of Chores (by scheduling)

A dedicated article breaks Chores into four scheduling sub-types, all of which count
toward daily chore-completion goals except where noted:

| Type | How it's created | Behavior |
|---|---|---|
| **Timed Chore** | Add a specific time via the **Time** toggle when creating/editing | Due by a specific time; counts toward daily goals |
| **All-day Chore** | Add a date but no time | Completable anytime during that day; counts toward daily goals |
| **Anytime Chore** | No date and no time selected | No deadline; still counts toward daily objectives |
| **Late Chore** | (Automatic) | A Timed or All-day chore not completed by its due date automatically carries forward to subsequent days; persists (and keeps counting toward goals) until marked complete |

[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/32082293222043-Types-Of-Chores)

## Tasks tab layout (device)

### Views: Day vs Week/All
- The Skylight App's Tasks tab documentation states plainly: "There are two views of tasks:
  day and week." In Day view, "Skylight Calendar shows a list of Tasks with for each
  Profile in columns." [VERIFIED (search-extracted snippet, source: myskylight support content indexed via web search)](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- A separate, differently-numbered "Tasks: Routines and Chores" article (mobile-app
  flavored) does **not** mention a Day/Week toggle at all — it describes only
  Previous/Today/Next date navigation within a single day-by-day view ("The Tasks view
  displays the current tasks for each Profile by day").
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/45761249913499-Tasks-Routines-and-Chores)
- Yet a third article (also titled "Tasks: Routines and Chores", different article ID)
  describes a **"Day/All"** toggle instead: "Day View" shows tasks by day for a single
  profile or all profiles; "All View" shows the complete task list, one instance per task.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738601403931-Tasks-Routines-and-Chores)
  [INFERRED: Skylight appears to have iterated the Tasks view UI more than once across
  2025–2026 (evidenced by three separate "Tasks: Routines and Chores"-titled articles at
  IDs 36846381293979, 44738601403931, and 45761249913499, likely device/mobile/desktop
  variants or successive revisions). Treat "Week" and "All" as possibly the same concept
  renamed, or as genuinely different views on different platforms — flagged in Open
  Questions.]
- All variants agree on: per-profile columns, and navigation via **Previous / Today /
  Next**. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738601403931-Tasks-Routines-and-Chores)
- A **Search** icon finds tasks by name/description.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738601403931-Tasks-Routines-and-Chores)
- Habit-tracking release notes separately mention a "weekly task interface allowing each
  family member to track their progress," suggesting a week-oriented habit view is at
  least part of the newer Track Habits feature.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/50672642373019--Feature-Track-Your-Habits)

### Per-profile columns and column header
- Day view displays tasks in per-profile columns; each column shows that profile's
  assigned Routines and Chores. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- Column headers show the profile name. Progress indicators — described as "icons at the
  top of each column" — track the completion rate for that profile.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- [UNKNOWN: the literal header string format. No fetched source quotes a header reading
  something like "✓ 2/20" and "⭐ 10" verbatim — this remains an assumption from the
  research brief, not a confirmed UI string. The **concept** of a per-column completion
  count and a per-column star total is corroborated (stars displayed "under each Profile
  picture and name" on the Rewards tab, and a completion progress icon at the top of each
  Tasks column) but the exact combined format is not documented.]
- Reordering columns: "tap and hold a Profile name, then drag the Profile's column to a
  new position on the screen." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)

### Circular progress ring
- Marking a chore complete visually fills a circular progress indicator: "as a person
  marks a chore as complete, a circular progress bar will fill around the category."
  [VERIFIED (search-extracted, legacy Chore Chart feature context)](https://skylight.zendesk.com/hc/en-us/articles/8204862253339-How-do-I-complete-and-track-chore-progress)
  [Note: this specific article (8204862253339) returned an authentication wall on two
  direct-fetch attempts, so this fact is sourced from a search-engine snippet of its
  content rather than a direct read — treat as [VERIFIED] with lower confidence, flagged
  in Open Questions.]
- A skipped task is explicitly excluded from this ring: "The task is no longer counted in
  the total tasks or the circular completion bar."
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- Each Routine also shows its own progress bar indicating how many instances have been
  completed, in addition to the per-column ring/icon.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)

### Time-of-day toggles ("Morning / Afternoon / Evening / Chores")
- Users can tap **Morning**, **Afternoon**, **Evening**, or **Chores** icons/toggles to
  show/hide routines "at any time," overriding automatic time-based selection.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- Automatic time-of-day auto-selection windows, confirmed identically across two sources:
  - **Midnight–Noon** → Morning routines shown
  - **Noon–6pm** → Afternoon routines shown
  - **6pm–Midnight** → Evening routines shown
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/35336169688475-How-To-Create-Routines)

### Up for Grabs column
- Appears "as the left-most column in tasks view." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- Claimable household tasks, credited to whichever profile completes them; full workflow
  below. A toggle in the Filter menu shows/hides the Up for Grabs column.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738601403931-Tasks-Routines-and-Chores)
- "With Up for Grabs, your family can work together to make sure that everything gets
  done" — positioned as tasks that "can be done by anyone: they just need to get done."
  Feature announced **April 23, 2026** (last updated June 2, 2026), documented separately
  across the Calendar Tasks Tab, Mobile App, and Desktop App help sections.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/49525040352795--Feature-Up-for-Grabs-Chores)
- A Taste of Home review corroborates the shipped feature: "there's an 'up for grabs'
  column that any of the children can tackle in order to earn extra stars."
  [VERIFIED](https://www.tasteofhome.com/article/skylight-calendar-review/)

### Filters
Tap **Filter** to toggle:
- **Completed tasks** (show/hide) [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- **Late chores** (show/hide overdue chores) [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- Individual **profile** toggles — used e.g. to reveal a newly created profile that's
  invisible by default in task creation until enabled here.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/37235464368795-Profiles-Are-Missing-When-Creating-Tasks)
- **Up for Grabs** toggle [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- **Skipped tasks** toggle [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)

## Task card anatomy and states

- **Incomplete**: white circle indicator to the right of the name.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- **Complete**: circle becomes a checkmark. "Tap the white circle to the right of the name"
  to mark incomplete → complete; "Tap the checkmark to the right of the name" to mark
  complete → incomplete (checkmark is removed). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- **Late**: an overdue Timed or All-day chore, automatically carried forward each day it's
  incomplete; visible/hidden via the "Late chores" filter toggle. Completing a late chore
  "will mark the chore as completed on the day it was checked, not the day it was
  originally due" — i.e., **the completion timestamp uses the completion date, not the due
  date.** [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- **Skipped**: shown/hidden via "Skipped tasks" filter. Skip is available only for
  "routines and repeating chores." When skipped: "The Profile for the task receives no
  stars. The task is no longer counted in the total tasks or the circular completion bar.
  Skipped tasks do not break a streak." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
  Skip Tasks was announced as a feature **April 7, 2026**, framed around real-life
  disruptions (illness, urgent errands): "your routine will be there for you when you're
  ready to come back." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/48841217883675--Feature-Skip-Tasks)
- **Un-checking a completed chore**: stars already awarded are retracted from the reward
  total. "The stars associated with un-checked or uncompleted chores will not be counted
  towards Rewards." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30453883731739-What-happens-when-a-chore-is-un-checked)
- Tapping the **card body** (not the circle) opens a **Task Details popup** with, as
  applicable: Mark as Complete / Mark as Incomplete, Skip (routines & repeating chores
  only), Unskip (skipped tasks only), Delete, Save (after edits).
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- Emoji and title appear on the card face; [INFERRED: a star-value chip likely also
  appears on the card given stars are a first-class per-task attribute, but no source
  explicitly confirms a visible per-card star badge on the Tasks tab card face itself
  (versus only appearing in the edit/details popup's Stars textbox) — flagged as Open
  Question.]

### Completion celebration
- When every task in a profile's list is checked off, "the screen will burst into a fun
  explosion of emojis to celebrate." [VERIFIED](https://myskylight.com/how-to-manage-chores-and-family-tasks-with-skylight-calendar/)
- A themed variant exists via **Disney Mode** (an Add-On): the celebration "alternat[es]
  between stickers inspired by their chosen franchise and Skylight's randomized emoji
  rain," with kids "guessing which emoji will rain down after they finish their tasks."
  [VERIFIED](https://myskylight.com/introducing-skylight-disney-mode/)
- This celebration triggers on completing **all** tasks in a list, not necessarily on each
  individual task completion. [INFERRED from the "when every chore in someone's list is
  checked off" phrasing.]
- [UNKNOWN: whether an individual-task completion (not the "all done" state) has its own
  micro-animation or sound effect distinct from the full-list emoji burst; no source
  confirms or denies this. Reminder sounds ("Reminder sound" chime) are documented for
  due-time notifications, but not tied to the act of completion itself.]

## Creating a Chore

Workflow (device, "Add Task" flow): [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738601403931-Tasks-Routines-and-Chores)
1. Tap **Add** (**+**, bottom-right) → **Add Task**
2. Enter **Title** (onscreen keyboard; tap the green check button to confirm)
   [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
3. Optional: **Emoji**, **Description** — "The task description can be a short piece of
   text describing the task or listing the steps." Emoji: "This function is especially
   popular with customers who have children who cannot yet read, but can also be used as a
   fun way to spice up your daily routines."
   [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
4. Tap **Assign** to select one or more Profiles. "Tap a profile to assign or unassign the
   task to that Profile. All tasks need to be assigned to at least one Profile." An
   **Add** button lets you add another profile if needed.
   [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
5. Choose task type: **Chore** (or **Routine**)
   [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738601403931-Tasks-Routines-and-Chores)

Chore-specific fields:
- **Date** toggle: optional; "If you want the chore to be due on a specific day, enable
  Date," picked via a calendar popup. Off = Anytime Chore; on with no time = All-day
  Chore. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- **Due Time / Time** toggle: optional; enabling it turns the chore into a Timed Chore and
  allows a reminder to be sent when it's due ("If you give a chore a time, a reminder can
  be sent when it's time to do the chore"); time is picked via hour/minute/AM-PM.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/32082293222043-Types-Of-Chores)
- **Repeats** toggle: optional, "If you would like the chore to be automatically
  rescheduled, enable Repeats." Two mutually exclusive modes:
  - **Scheduled Date** mode: "The chore will always repeat after the set interval. The new
    chore will not be delayed if the earlier scheduled chore was not completed."
    Sub-fields: **Every** [N] + **Unit of time** (day / week / month), **On** (position
    within the unit, e.g. which weekday/day-of-month), optional **Repeats until** end
    date toggle. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
  - **Completed Date** mode: "You can set up a chore to be rescheduled only after it has
    been completed." Sub-fields: **After** → **Immediately** or **Custom** (Custom adds an
    **After** [N] + **Unit of time** delay), optional **Repeats until** end date toggle.
    [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
  - Also summarized in marketing copy simply as Daily / Weekly / Monthly / Custom repeat
    options. [VERIFIED](https://myskylight.com/how-to-manage-chores-and-family-tasks-with-skylight-calendar/)
- **Up for Grabs** toggle: "Only chores can be set as Up For Grabs" (Routines cannot).
  Same Date / Due Time / Repeats options apply to an Up for Grabs chore.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- **Stars** field: a numeric textbox — **app/desktop only, not settable on the Calendar
  device.** "You cannot assign or edit star values in the Calendar. To assign star values
  to a chore or routine, use the Mobile App."
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
  Guidance on values: "We expect most chores would be worth a small number of stars (1, 2,
  3, 5), and most Rewards would be worth a number of chores worth of stars (10, 20, 50)."
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30453539229979-How-many-stars-should-I-assign)
  A different marketing source suggests a wider band: "five to ten stars" for daily
  routines and up to "one hundred stars" for a big/important chore.
  [VERIFIED](https://myskylight.com/how-to-manage-chores-and-family-tasks-with-skylight-calendar/)
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846200077723-Stars-Tasks-and-Rewards)
  Assigning stars requires **Calendar Plus**: "This feature requires a Calendar Plus
  subscription." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30485221515163-How-do-I-assign-stars-to-new-chores)
- **Save to task box**: optional checkbox, preserves the chore as a reusable template in
  the Task Box. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738601403931-Tasks-Routines-and-Chores)
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39074226341659-Using-the-Task-Box)
- Tap **Add** to create.

### Assigning stars to an existing chore
1. Open the Skylight App (Mobile or Desktop) → **Tasks**
2. Select the Task
3. Tap the context menu (three horizontal dots, upper right)
4. Tap **Edit**
5. Enter the value in the **Stars** textbox (may require scrolling to locate)
6. Tap **Save**
[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30486916645531-How-do-I-assign-stars-to-existing-chores)

## Creating a Routine

Same base fields as a Chore (Title, Emoji, Description, Assign via **Assign**/Profiles),
plus, per the dedicated "How To Create Routines" walkthrough (device "Add Task" sidebar,
opened via the bottom-right **+** icon):

- **🔁 Every**: repetition base — "weekly or daily basis."
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/35336169688475-How-To-Create-Routines)
- **📅 On**: "choose the day or days this Routine will repeat" (for weekly routines).
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/35336169688475-How-To-Create-Routines)
- **In the**: time-of-day selector, choosing from **Morning / Afternoon / Evening**.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/35336169688475-How-To-Create-Routines)
- **⭐ Rewards**: star value, but "you'll need to assign the stars for the Routines on the
  Skylight App" (same device-vs-app restriction as chores).
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/35336169688475-How-To-Create-Routines)
- Restated by the help-center core article with more granularity:
  - **Track Habit**: toggle enabling streak tracking (see Habit tracking section below).
    [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
  - **Daily** repeats: choose frequency ("Every day," "Every 2 days," etc.); pick any
    combination of Morning/Afternoon/Evening — "Routines can be assigned to multiple times
    of day." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
  - **Weekly** repeats: choose frequency, choose specific weekdays ("Routines can be
    assigned to multiple days"), and any combination of Morning/Afternoon/Evening.
    [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- **Add a Timer on Buddy**: sets an automatic countdown timer preset (minutes/seconds),
  specific to routines used on the Skylight **Buddy** kids' device.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738601403931-Tasks-Routines-and-Chores)
- **Save to task box**: optional template preservation, same as chores.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738601403931-Tasks-Routines-and-Chores)
- Routines have **no** Date/Due-Time fields (those are chore-only); a Routine's timing is
  entirely governed by its day-of-week + Morning/Afternoon/Evening selection.
  [INFERRED from the Chore↔Routine conversion note that "Routines do not have timing
  options available to Chores."] [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/35340626864027-How-To-Convert-Chores-to-Routines)
- Tap **Add** to create.

Auto-display windows for Morning/Afternoon/Evening routines (device default view) — same
windows as the manual toggle section above: Midnight–Noon (Morning), Noon–6pm (Afternoon),
6pm–Midnight (Evening). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/35336169688475-How-To-Create-Routines)

## Habit tracking (streaks)

- Enable via the **Track Habit** toggle switch when creating or editing a Routine.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/50672917447067-Track-Your-Habits)
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36012047730459-Does-Skylight-Calendar-have-a-habit-tracker)
- With it on, Skylight keeps "a running tally of how many days in a row you have completed
  the Routine" — i.e. a streak counter. A badge with a **lightning bolt** icon appears next
  to the task name, incrementing with each daily completion.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/50672917447067-Track-Your-Habits)
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36012047730459-Does-Skylight-Calendar-have-a-habit-tracker)
- Skipping a day does **not** break the streak: "If you need to skip a day, that's okay:
  your streak will be protected" / "Skipped tasks do not break a streak."
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36012047730459-Does-Skylight-Calendar-have-a-habit-tracker)
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/50672917447067-Track-Your-Habits)
- Extended streaks trigger celebration messages — a full week of completed routine tasks
  earns an **"Amazing Week"** celebration.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/50672917447067-Track-Your-Habits)
- The feature's own announcement (dated **May 21, 2026**) frames it as "badges on your
  Routines will help you keep track of streaks," paired with a weekly progress interface
  "[so] each family member can track their progress."
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/50672642373019--Feature-Track-Your-Habits)
- Habit tracking is available consistently across the Calendar device, Mobile App, Desktop
  App, and Buddy device. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36012047730459-Does-Skylight-Calendar-have-a-habit-tracker)
- Habit tracking (the Track Habit toggle and streak display) appears to be a **free**
  Tasks/Routines feature, not gated behind Calendar Plus — the free-tier summary lists
  "Keep track of chores and routines that happen at regular times" as included without a
  subscription, distinct from the Plus-gated "Track and award rewards for completing
  chores." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36009559376795-Does-Skylight-Calendar-require-a-subscription)
  [INFERRED: this implies habit streak badges are free while the *star/reward* economy
  tied to routines is Plus-only — not explicitly cross-referenced in one single source, so
  flagged as inferred.]

## Task management operations

- **Complete/uncomplete**: tap the circle/checkmark (see Task card anatomy), or use the
  Details popup's **Mark as Complete** / **Mark as Incomplete**.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- **Skip/unskip**: tap task → **Skip** (routines and repeating chores only) → tap outside
  the details popup to close. Reverse via **Unskip** (only shown on already-skipped
  tasks). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- **Reorder Routines**: tap-and-hold a Routine, drag to a new position, release. Scoping
  rule: "Routines can only be reordered within their section for a particular Profile...
  Routines cannot be dragged into different times of day, or across into other Profiles.
  **Chores cannot be reordered.**"
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- **Edit**: tap task → adjust fields in the popup → **Save**. Editing includes converting
  between Chore/Routine type. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
  [VERIFIED](https://myskylight.com/how-to-manage-chores-and-family-tasks-with-skylight-calendar/)
- **Delete a Chore**: tap chore → **Delete** → choose "only the current instance of the
  task, all future tasks, or all tasks for this chore" → confirm **Delete**.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- **Delete a Routine**: tap routine → **Delete** → choose "all future tasks or all tasks
  for this routine" → confirm **Delete**. (No "current instance only" option — a
  deliberate difference from Chores.)
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)

## Up for Grabs workflow

1. Create a chore and enable the **Up for Grabs** toggle (chore-only capability).
   [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
2. The task appears in the left-most "Up for Grabs" column, claimable by any household
   member. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
3. **Claim**: tap the (completed) Up for Grabs task → tap a profile from the popup list to
   credit them → tap **Complete**. The task then appears in that profile's column and
   awards its stars to the chosen profile.
   [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
4. **Undo**: tap the completed task → **Mark as Incomplete** → task returns to the Up for
   Grabs column. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
5. **Skip**: tap task → **Skip** → tap outside details.
   [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)

## Task Box (reusable templates)

- "The Task Box is a convenient place to store chores and routines that you will want to
  add to Profiles more than once" — particularly useful for recurring, non-scheduled work
  like homework. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39074226341659-Using-the-Task-Box)
- Ships with "a set of pre-made chores and routines available," which users can edit or
  delete. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39074226341659-Using-the-Task-Box)
- Save a new task to it via the **Save to task box** checkbox during creation.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39074226341659-Using-the-Task-Box)
- Accessed via **Add → Task Box**, with separate Chores/Routines sections and a search box
  (type to filter). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738601403931-Tasks-Routines-and-Chores)
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39074226341659-Using-the-Task-Box)
- Templates are editable (tap the ellipsis → **Edit** — title, emoji, task type, star
  value are all editable) or deletable (deletion is irreversible, per a warning).
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39074226341659-Using-the-Task-Box)

## Device vs. App capability split

A dedicated comparison article gives this explicit breakdown for Rewards/Stars:

| Capability | Skylight App | Calendar Device |
|---|---|---|
| Create Rewards | Yes | No |
| View Rewards | Yes | Yes |
| Redeem Rewards | Yes | Yes |
| Assign Stars to Chores | Yes | No |
| Give or Take Away Stars | Yes | No |

"Rewards and stars can only be created, edited, and managed via the Skylight App. On the
Calendar device, the Rewards tab displays progress toward Reward goals and allows Rewards
to be redeemed once enough stars have been earned."
[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30453280620187-What-can-I-manage-in-the-Skylight-App-vs-on-the-device)

For Tasks/Chores/Routines themselves (not just stars), the device supports the full
create/edit/delete/complete/skip/reorder/Task-Box lifecycle — only the **Stars** numeric
field is locked out on-device.
[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)

Reward **editing/deletion** is elsewhere attributed to the **Desktop App** specifically
(rather than "the Skylight App" generically), and **giving/removing stars manually** and
initial **reward redemption** to the **Mobile App** specifically — these two sources are
not perfectly reconciled; see Open Questions.
[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739096640667-Create-and-Redeem-Rewards)
[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/45763229367451-Rewards)

## Stars — earning, ledger, and manual adjustment

- Stars are earned per-task on completion, at the star value configured for that specific
  chore/routine. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846200077723-Stars-Tasks-and-Rewards)
- Un-completing ("un-checking") a chore retracts its stars from the reward total: "The
  stars associated with un-checked or uncompleted chores will not be counted towards
  Rewards." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30453883731739-What-happens-when-a-chore-is-un-checked)
- Skipped tasks earn **zero** stars for the assigned profile.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- **Giving stars outside of chores** (Mobile or Desktop App):
  1. Open the Skylight App → **Rewards**
  2. Tap **Give stars**
  3. Choose one or more Profiles to receive stars
  4. Enter the amount in the **Stars** textbox
  5. Review the **Before and After** table
  6. Tap **Confirm**
  Example use cases given: "Good grades," "Performing a random act of kindness" — anything
  worthy of recognition outside the chore chart.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30456865333403-Can-I-give-stars-outside-of-chores)
- **Taking stars away**: same **Give stars** flow, entering a **negative** value (a dash
  prefix, e.g. `-5`) in the Stars textbox, then **Confirm**. There is no separate "remove
  stars" control — negative numbers in the same field accomplish it.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30479963424667-Can-I-take-away-stars)
- [UNKNOWN: a dedicated star transaction ledger/history view listing each earn/spend/
  manual-adjustment event with timestamps — no source describes such a screen; only the
  live current balance and the "Before and After" confirmation table at the moment of a
  manual adjustment are documented.]
- [UNKNOWN: any explicit "reset all stars" bulk action — not found in any fetched source.]

## Rewards tab layout

- Rewards are organized per-profile: "assigned to individual profiles so that each
  individual can track their progress."
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846860676123-Using-the-Rewards-Tab)
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30453626667547-Must-every-Reward-be-attached-to-a-Profile)
- With multiple profiles, swiping between profile columns/panes may be required depending
  on profile count and Calendar orientation.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846860676123-Using-the-Rewards-Tab)
- Star balance is displayed "under each Profile picture and name."
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/45763229367451-Rewards)
- Each reward card shows a **Redeem** button once the profile has enough stars; below that
  threshold it shows progress instead. "Calendar will only show the Redeem button on
  Rewards you have enough stars for."
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846860676123-Using-the-Rewards-Tab)
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/45763229367451-Rewards)
- A reward's card shows its emoji and title (both configured at creation — see below); an
  emoji is explicitly recommended "to help even your littlest family members track what
  they're working towards." [VERIFIED](https://myskylight.com/lp/rewards/)
- [UNKNOWN: the exact progress-bar string format on a not-yet-affordable reward card, e.g.
  whether it literally reads "⭐ 55/150" as hypothesized in the brief — no source quotes
  this string verbatim; only the qualitative behavior (shows progress; swaps to a Redeem
  button once affordable) is confirmed.]

## Creating a Reward

Fields, per "Create and Redeem Rewards": [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739096640667-Create-and-Redeem-Rewards)
- **Title** (required): "will appear on the reward card."
- **Description** (optional): "will appear on the reward details popup."
- **Emoji** (optional): "will appear on the reward card."
- **Renew after redeeming** toggle: determines one-time vs. repeatable/recurring reward
  (see Recurring Rewards below).
- **Stars** / star cost (required): "the number of Stars required for this reward" — any
  amount **between 1 and 500**.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739096640667-Create-and-Redeem-Rewards)
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846200077723-Stars-Tasks-and-Rewards)
- **Profile assignment** (required, ≥1): "Select at least one Profile that is eligible for
  the reward." Multiple profiles can be assigned to one Reward, but progress toward it is
  tracked **separately per profile** — it's not a shared/pooled goal.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739096640667-Create-and-Redeem-Rewards)
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30453626667547-Must-every-Reward-be-attached-to-a-Profile)
- **No approval flow exists** for reward creation.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739096640667-Create-and-Redeem-Rewards)
- Creation steps: tap **Rewards** → tap **Add** (add button) → fill in the fields above →
  select ≥1 eligible profile → save. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739096640667-Create-and-Redeem-Rewards)
- Every Reward **must** be attached to at least one Profile — there's no "household-wide,
  unattached" reward type.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30453626667547-Must-every-Reward-be-attached-to-a-Profile)

### Recurring Rewards
- "Recurring Rewards reset after each redemption." Example: a recurring reward for 30
  minutes of screen time resets its progress bar to zero (relative to its star cost)
  immediately after being redeemed, ready to be earned again.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30453829370011-What-is-a-recurring-Reward-and-how-does-it-work)
- This corresponds to the **Renew after redeeming** toggle at creation time.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739096640667-Create-and-Redeem-Rewards)
- [INFERRED: a non-recurring ("one-time") reward, once redeemed, presumably stops
  accepting further redemptions / is removed from the active list — not explicitly stated,
  but implied by contrast with the recurring behavior; flagged as inferred.]

## Redeem flow

**Mobile App:** [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846860676123-Using-the-Rewards-Tab)
1. Tap **Rewards**
2. Find the relevant profile (swipe if needed)
3. Tap **Redeem** on the desired reward card (button only present if the profile has
   enough stars)

**Desktop App:** [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/45763229367451-Rewards)
1. Open the Skylight Desktop App
2. Select the Calendar device
3. Go to **Rewards**
4. Choose the profile
5. Tap **Redeem**

**Calendar device:** redemption is also possible directly on-device once affordable (per
the device-vs-app capability table above, "Redeem Rewards" = Yes on both App and Device),
though the step-by-step is not separately documented for the touchscreen; presumably
mirrors the Mobile App flow (tap Rewards → tap Redeem on an affordable card).
[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30453280620187-What-can-I-manage-in-the-Skylight-App-vs-on-the-device)
[INFERRED for the exact on-device tap sequence specifically.]

Effect of redeeming: stars are "removed from that person's Profile and cannot be used for
another reward." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739096640667-Create-and-Redeem-Rewards)

### Unredeeming
- A dedicated FAQ confirms an unredeem concept exists at the data/visibility level:
  "Unredeemed Rewards will be visible on the Skylight Calendar under the Rewards tab
  unless deleted in the Skylight App."
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30453438405531-What-happens-when-a-Reward-is-unredeemed)
- [UNKNOWN: this article's title implies an explicit "Unredeem" user action exists (matching
  the brief's hypothesized "Unredeem" button), but the fetched content only describes
  passive visibility/deletion behavior for rewards that simply haven't been redeemed yet —
  it does not confirm or describe a button that reverses an already-completed redemption.
  Whether tapping "Unredeem" on a just-redeemed reward refunds the spent stars is not
  confirmed by any source.]

### Redeem confirmation modal
- [UNKNOWN: no source quotes exact confirmation-modal copy. The brief's hypothesized
  strings — "Great work! Bake Cookies redeemed", "By Ella for 20 stars on March 22, 2026",
  buttons "Done" / "Unredeem" — could not be verified verbatim in help docs, blog posts, or
  review sites consulted. Likely only observable by using the live app or finding an
  App Store screenshot / TikTok demo video (one such Skylight TikTok, "🎉 Meet Rewards!",
  was found by search but not fetched as it is a video, not text content).]

### Star confetti / celebration
- [UNKNOWN: no source explicitly confirms a confetti animation tied specifically to
  reward redemption (as distinct from the task-completion "emoji explosion" documented
  above). Plausible by analogy to the task-completion celebration, but not verified.]

## Skylight Plus / Calendar Plus gating

Free tier (no subscription) includes, per the official comparison: [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36009559376795-Does-Skylight-Calendar-require-a-subscription)
- "Add, update, and remove events from your local calendar"
- "Sync online calendar events to your local calendar"
- "Keep track of chores and routines that happen at regular times" — i.e., basic Tasks
  (chores, routines, habit-streak badges) work without a subscription.
- "Make and share lists"

Skylight Plus (paid) additionally unlocks: [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36009559376795-Does-Skylight-Calendar-require-a-subscription)
- "Track and award rewards for completing chores" — i.e., the entire **Stars/Rewards**
  economy (assigning star values, creating Rewards, redeeming) is Plus-gated.
- "Plan meals, with recipes"
- Sidekick auto-scan for events/recipes
- Photo/video display

This is corroborated directly: "Yes, Rewards is part of Calendar Plus. Without a Calendar
Plus subscription, users will not be able to assign stars to chores or create Rewards."
[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30450768494235-Is-Rewards-part-of-Calendar-Plus)
Rewards became broadly available (per one support summary) around **December 2024**, ahead
of the 2025–2026 window this research targets.
[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/30450528727835-What-are-Rewards)

Review coverage agrees: "setting up basic chore checklists is free, [while] the Calendar
Plus subscription unlocks the star-based tracking and reward features."
[VERIFIED](https://www.tasteofhome.com/article/skylight-calendar-review/)

Summary of what's gated:
| Free | Requires Skylight/Calendar Plus |
|---|---|
| Create/edit/delete Chores & Routines | Assign or edit **Stars** on a Chore/Routine |
| Complete / uncomplete / skip / unskip | Create a **Reward** |
| Day navigation, filters, Up for Grabs, Task Box | Redeem a Reward |
| Track Habit streak badges (routines) | Give/take stars manually |

[VERIFIED, synthesized across the sources cited in this section]

## Task notifications

Settings live under **Settings → Notifications**, which has two groups:
[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/45795554249371-Settings)
- **Calendar Notifications**: "At time of event" and "Before event" toggles, with timing
  options of 10 minutes, 30 minutes, 1 hour, or custom.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/45795554249371-Settings)
- **Task Notifications**: **"When Due"** and **"When Completed"** toggles.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/45795554249371-Settings)

A separate Reminders Settings article (older/device-level naming) similarly documents a
task reminder: enabling **"When Due"** "show[s] a reminder when the Task is due," but notes
reminders "are only available for tasks with times attached" (i.e., Timed Chores only, not
Anytime/All-day). A **"Reminder sound"** toggle plays a chime when any reminder popup
displays, with overall volume controlled from General Settings.
[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36836043247131-Reminders-Settings)
This "When Due" behavior is also referenced in the Tasks-tab article itself: "If you give a
chore a time, a reminder can be sent when it's time to do the chore."
[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- [UNKNOWN: precise wording/behavior of "When Completed" — found only as a toggle label in
  the Settings article; no source describes what the resulting notification says or who it
  notifies (e.g., a parent being told a child finished a chore).]
- As of the Reminders Settings article's writing, "in-app push notifications are
  unavailable, but the developers are actively working on making this feature accessible
  in the near future" — i.e., these are on-device/on-app popup reminders, not push
  notifications to a phone, at least as of that article's writing.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36836043247131-Reminders-Settings)

## Parental Lock (relevance to Tasks/Rewards)

- Parental Lock "helps parents control what their kids have access to on Skylight
  Calendar, preserving Calendar as the source of truth for events and tasks." A **4-digit
  PIN** restricts:
  - "Add events and tasks"
  - "Modify events and tasks"
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/35089525796251-Parental-Lock)
- Auto-lock (re-engage after inactivity) is configurable — General Settings documents a
  1–10 minute inactivity window before the lock re-engages after the last addition/
  modification of a chore or event.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/35089525796251-Parental-Lock)
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36835387462555-General-Settings)
- PIN reset is available via an emailed magic link.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36835387462555-General-Settings)
- [UNKNOWN: whether Parental Lock separately gates *completing/checking off* a task (as
  opposed to adding/modifying one) — sources describe the lock as covering add/modify
  only, which would leave day-to-day task completion by kids unlocked; not explicitly
  confirmed either way for Rewards redemption specifically.]

## Skylight Buddy (kids' companion device) — Tasks & Rewards surface

Buddy is a separate, kids-facing hardware device that surfaces the same Tasks/Rewards data
in a simplified home screen:
- **Routines**: home-screen cards grouped by time of day (morning/afternoon/evening); each
  card shows "how many routines in that part of the day, and how many you have completed."
  A card appears only if routines exist for that period; tapping opens the full list.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/50564241301147-The-Buddy-Home-Screen)
- **Chores**: one dedicated card shows "how many chores you need to do, and how many of
  them you have completed" (only appears if chores are assigned).
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/50564241301147-The-Buddy-Home-Screen)
- **Stars**: the home screen displays "the number of stars you have saved up"; tapping the
  stars button opens star/reward management. "Stars are managed in the Skylight Mobile
  App" (not on Buddy itself) — this is a Skylight Plus feature.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/50564241301147-The-Buddy-Home-Screen)
- Additional home screen elements: profile picture (upper-left), a clock button, weather
  (if configured), a Timer button (Skylight Plus only), and an interactive Buddy character.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/50564241301147-The-Buddy-Home-Screen)
- Buddy's **Settings menu** (accessed via Profile icon, top-left → **Settings**) includes a
  **"Show Late Chores"** toggle — showing late chores suits tasks that must be completed a
  specific number of times, while hiding them suits chores that are okay to skip. Users can
  also "explicitly skip chores in the Skylight Mobile App."
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/50543283056795-Settings-Menu-on-Buddy)
  Other Buddy settings sections: General (Wi-Fi, timezone, weather address, auto-
  brightness, volume), Screensaver (clock screensaver on/off, idle-time activation 5–30
  min in 5-min increments), About (household name, software/firmware versions), and Device
  Reset (clears local data only; account data unaffected).
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/50543283056795-Settings-Menu-on-Buddy)
- Routine creation on the Buddy-linked account supports an **"Add a Timer on Buddy"** field
  (minutes/seconds preset) not mentioned for the plain Calendar device flow.
  [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44738601403931-Tasks-Routines-and-Chores)

## Legacy/possibly-superseded terminology: "Chore Chart"

- Skylight's help center retains a separate, older **"Chore Chart"** section/category
  (URL slug `sections/8139189630619-Chore-Chart`) alongside the modern **"Tasks"** section
  — suggesting "Chore Chart" is either an older product name for the same feature or a
  distinct legacy view (e.g., the Calendar tab's own chore-progress display, as opposed to
  the dedicated Tasks tab). [INFERRED from the section's continued existence and naming;
  both this section and its "How can I set up Chore Chart..." and "How do I complete and
  track chore progress?" articles returned an authentication wall on repeated fetch
  attempts and could not be read directly.]
- A related, indirectly-sourced (search-snippet only) claim: chore progress is visible "in
  Day, Week, Month, and Schedule view" of the main Calendar (not just the Tasks tab), with
  an on/off setting for this display. [UNKNOWN — could not be verified against primary
  source text due to the access wall; flagged for follow-up.]

## Open questions

1. **Exact Tasks-tab column header string.** Whether the per-profile column header
   literally displays something like "✓ 2/20" (completed/total) and "⭐ 10" (stars) as
   hypothesized in the brief — corroborated only conceptually (a completion-progress icon
   and a stars total exist somewhere in the UI), never confirmed as a literal combined
   string.
2. **"Day/Week" vs "Day/All" vs date-only navigation.** Three different help articles
   describe three different Tasks-view navigation schemes (Day+Week; Day+All; Previous/
   Today/Next only). This may reflect real UI iteration over 2025–2026, or documentation
   drift across device/mobile/desktop variants. Needs resolution via a dated screenshot,
   App Store changelog, or hands-on device testing.
3. **Exact redeem-confirmation modal copy.** No source quotes the modal shown immediately
   after tapping Redeem (hypothesized: "Great work! [Reward] redeemed", "By [Name] for [N]
   stars on [Date]", "Done" / "Unredeem" buttons). Confirmed only that redemption removes
   the spent stars from the profile.
4. **Whether "Unredeem" is a literal button that reverses a completed redemption** (and
   refunds stars), versus the confirmed-but-different concept of an *unredeemed* (i.e.
   not-yet-redeemed) reward simply remaining visible until deleted.
5. **Star confetti/celebration on reward redemption specifically** — only the task-list
   "emoji explosion" completion celebration is confirmed; redemption-specific animation is
   unconfirmed.
6. **Whether an individual task-completion (not "all done") has its own micro-animation or
   sound**, separate from the full-list emoji burst and from due-time reminder chimes.
7. **Precise division of Reward management between Mobile App and Desktop App** —
   one source attributes create=Mobile/edit+delete=Desktop; another attributes
   create/edit/delete all to "Desktop App," with give/remove-stars to "Mobile App." These
   were not reconciled.
8. **"When Completed" notification's exact behavior/copy and audience** (e.g., does it
   notify the parent, the child, or both when a task is checked off?).
9. **Whether a star transaction ledger/history screen exists** beyond the live balance and
   the momentary "Before and After" table shown when manually giving/taking stars.
10. **Whether an explicit "reset all stars" bulk action exists.**
11. **Whether a visible star-value chip appears directly on the Tasks-tab task card face**
    (vs. only inside the edit/details popup's Stars field).
12. **The "Chore Chart" legacy section's exact content** — two of its articles ("How can I
    set up Chore Chart," "How do I complete and track chore progress?") were persistently
    behind an authentication wall across repeated fetch attempts and could not be read; a
    search-snippet-only claim about "Day, Week, Month, and Schedule view" chore progress on
    the main Calendar tab (not the Tasks tab) needs primary-source confirmation.
13. **Whether Parental Lock also restricts task completion / reward redemption**, or only
    add/modify actions as documented.
14. **Exact on-device (touchscreen) redeem tap sequence** — inferred to mirror the Mobile
    App's "tap Rewards → tap Redeem," not separately documented step-by-step.

## Sources

Primary help-center articles (skylight.zendesk.com):
- [Using the Tasks Tab: Routines and Chores](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)
- [Tasks: Routines and Chores (44738601403931)](https://skylight.zendesk.com/hc/en-us/articles/44738601403931-Tasks-Routines-and-Chores)
- [Tasks: Routines and Chores (45761249913499)](https://skylight.zendesk.com/hc/en-us/articles/45761249913499-Tasks-Routines-and-Chores)
- [What Are Tasks?](https://skylight.zendesk.com/hc/en-us/articles/35335515611803-What-Are-Tasks)
- [How To Create Routines](https://skylight.zendesk.com/hc/en-us/articles/35336169688475-How-To-Create-Routines)
- [Types Of Chores](https://skylight.zendesk.com/hc/en-us/articles/32082293222043-Types-Of-Chores)
- [How To Convert Chores to Routines](https://skylight.zendesk.com/hc/en-us/articles/35340626864027-How-To-Convert-Chores-to-Routines)
- [Profiles Are Missing When Creating Tasks](https://skylight.zendesk.com/hc/en-us/articles/37235464368795-Profiles-Are-Missing-When-Creating-Tasks)
- [Using the Task Box](https://skylight.zendesk.com/hc/en-us/articles/39074226341659-Using-the-Task-Box)
- [Tasks section listing](https://skylight.zendesk.com/hc/en-us/sections/35335533724315-Tasks)
- [Track Your Habits](https://skylight.zendesk.com/hc/en-us/articles/50672917447067-Track-Your-Habits)
- [\[Feature\] Track Your Habits](https://skylight.zendesk.com/hc/en-us/articles/50672642373019--Feature-Track-Your-Habits)
- [Does Skylight Calendar have a habit tracker?](https://skylight.zendesk.com/hc/en-us/articles/36012047730459-Does-Skylight-Calendar-have-a-habit-tracker)
- [\[Feature\] Up for Grabs Chores](https://skylight.zendesk.com/hc/en-us/articles/49525040352795--Feature-Up-for-Grabs-Chores)
- [\[Feature\] Skip Tasks](https://skylight.zendesk.com/hc/en-us/articles/48841217883675--Feature-Skip-Tasks)
- [Stars, Tasks, and Rewards](https://skylight.zendesk.com/hc/en-us/articles/36846200077723-Stars-Tasks-and-Rewards)
- [Using the Rewards Tab](https://skylight.zendesk.com/hc/en-us/articles/36846860676123-Using-the-Rewards-Tab)
- [Create and Redeem Rewards](https://skylight.zendesk.com/hc/en-us/articles/44739096640667-Create-and-Redeem-Rewards)
- [Rewards](https://skylight.zendesk.com/hc/en-us/articles/45763229367451-Rewards)
- [Rewards section listing](https://skylight.zendesk.com/hc/en-us/sections/30450617398299-Rewards)
- [What are Rewards?](https://skylight.zendesk.com/hc/en-us/articles/30450528727835-What-are-Rewards)
- [Is Rewards part of Calendar Plus?](https://skylight.zendesk.com/hc/en-us/articles/30450768494235-Is-Rewards-part-of-Calendar-Plus)
- [How many stars should I assign?](https://skylight.zendesk.com/hc/en-us/articles/30453539229979-How-many-stars-should-I-assign)
- [How do I assign stars to new chores?](https://skylight.zendesk.com/hc/en-us/articles/30485221515163-How-do-I-assign-stars-to-new-chores)
- [How do I assign stars to existing chores?](https://skylight.zendesk.com/hc/en-us/articles/30486916645531-How-do-I-assign-stars-to-existing-chores)
- [Can I give stars outside of chores?](https://skylight.zendesk.com/hc/en-us/articles/30456865333403-Can-I-give-stars-outside-of-chores)
- [Can I take away stars?](https://skylight.zendesk.com/hc/en-us/articles/30479963424667-Can-I-take-away-stars)
- [What happens when a chore is un-checked?](https://skylight.zendesk.com/hc/en-us/articles/30453883731739-What-happens-when-a-chore-is-un-checked)
- [What is a recurring Reward and how does it work?](https://skylight.zendesk.com/hc/en-us/articles/30453829370011-What-is-a-recurring-Reward-and-how-does-it-work)
- [Must every Reward be attached to a Profile?](https://skylight.zendesk.com/hc/en-us/articles/30453626667547-Must-every-Reward-be-attached-to-a-Profile)
- [What happens when a Reward is unredeemed?](https://skylight.zendesk.com/hc/en-us/articles/30453438405531-What-happens-when-a-Reward-is-unredeemed)
- [What can I manage in the Skylight App vs on the device?](https://skylight.zendesk.com/hc/en-us/articles/30453280620187-What-can-I-manage-in-the-Skylight-App-vs-on-the-device)
- [Does Skylight Calendar require a subscription?](https://skylight.zendesk.com/hc/en-us/articles/36009559376795-Does-Skylight-Calendar-require-a-subscription)
- [Settings](https://skylight.zendesk.com/hc/en-us/articles/45795554249371-Settings)
- [General Settings](https://skylight.zendesk.com/hc/en-us/articles/36835387462555-General-Settings)
- [Reminders Settings](https://skylight.zendesk.com/hc/en-us/articles/36836043247131-Reminders-Settings)
- [Parental Lock](https://skylight.zendesk.com/hc/en-us/articles/35089525796251-Parental-Lock)
- [Calendar Features](https://skylight.zendesk.com/hc/en-us/articles/48778850390171-Calendar-Features)
- [The Buddy Home Screen](https://skylight.zendesk.com/hc/en-us/articles/50564241301147-The-Buddy-Home-Screen)
- [Settings Menu on Buddy](https://skylight.zendesk.com/hc/en-us/articles/50543283056795-Settings-Menu-on-Buddy)

myskylight.com (marketing/blog):
- [How to Manage Chores and Family Tasks with Skylight Calendar](https://myskylight.com/how-to-manage-chores-and-family-tasks-with-skylight-calendar/)
- [Rewards landing page](https://myskylight.com/lp/rewards/)
- [Skylight Announces Disney Mode](https://myskylight.com/introducing-skylight-disney-mode/)

Third-party reviews:
- [Skylight Calendar Review: A Busy Mom's Honest Take (Taste of Home)](https://www.tasteofhome.com/article/skylight-calendar-review/)
- [I Tried the Skylight Calendar, and Here's My Honest Review (Cubby)](https://www.cubbyathome.com/skylight-calendar-review-80042154) — direct fetch returned HTTP 403; content referenced here only via search-result snippets, not a full read.

Inaccessible (authentication wall on repeated direct fetch — retried once each per
protocol, still blocked; content not verified beyond incidental search-snippet mentions):
- [How can I set up Chore Chart on my Skylight Calendar?](https://skylight.zendesk.com/hc/en-us/articles/8139191033627-How-can-I-set-up-Chore-Chart-on-my-Skylight-Calendar)
- [How do I complete and track chore progress?](https://skylight.zendesk.com/hc/en-us/articles/8204862253339-How-do-I-complete-and-track-chore-progress)
- [Chore Chart section listing](https://skylight.zendesk.com/hc/en-us/sections/8139189630619-Chore-Chart)
