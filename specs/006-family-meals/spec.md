# Feature Specification: Family Meals

**Feature Branch**: `006-family-meals`
**Created**: 2026-09-06
**Status**: Draft
**Input**: Phase 6 of the `/family` Skylight Calendar clone — the Meals tab: a week of mealtimes as a grid of seven days by up to four mealtime categories, each cell a slot the household plans a meal into from a saved recipe or a new entry; the recipes themselves, folded into the tab rather than given a tab of their own; repeating meals; a meal's ingredients pushed onto a list of the person's choosing; meals shown on the Week calendar behind a switch; and each Profile's dietary notes shown while planning. Phases 1 (household access, punch-in PINs, the shell, Profiles & Labels, tokens, PWA), 2 (the Week calendar and its recurrence), 3 (the Tasks tab and the board chassis), 4 (the Rewards tab) and 5 (the Lists tab, through migration 029) are shipped and deployed, and are the foundation this stacks on. This is the second half of the locked plan's `family-lists-meals`, split on 2026-09-05 (Phase 5, Assumption 1).

**Authoritative sources**: `docs/research/skylight/00-master-map.md` (§1 scope — "recipes folded in (no separate tab) · show meals on the Calendar · repeating meals · push ingredients to a list · dietary restrictions shown while planning, no AI"; §2 information architecture; §3 design system; §4.6 the meals sketch and the four seeded categories; §5.5 the Meals screen and the ingredient push; §6 permissions; §9 phasing; §11 divergence ledger, whose row 7 this phase builds) and the source-tagged dossiers beside it, principally `03-lists-meals-recipes.md` §8–§16 and §22–§24 (the Meals tab, the meal planner, mealtime categories, editing meals and recipes, creating a meal plan, ingredients, the Recipes tab and the phone's recipes, the Open Recipe release, the gating summary, the third-party corroboration, and its Open questions), `05-mobile-app.md` `shot12` (the phone's recipes list and meal planner), `01-calendar-tab-and-events.md` §3 (the Filter panel's "Show Meals"), `04-profiles-settings-access.md` §"Show meals" (the per-category switches in Settings), `06-api-and-data-model.md` (the four categories' live ids, names and colours; the recipe's `summary`/`description` shape), `07-visual-design-system.md` §1.6, §3.7, `gallery/06` and `pdp/07` (the meal category colours, every measured metric, the grid and the recipe popover); the shipped specs this phase extends — Phase 1 FR-024 (dietary restrictions, "readable by later phases"), FR-029 (the Meals placeholder), FR-032–FR-034 (the chip row flag, the Filter sheet, the create control); Phase 2 FR-203/FR-209/FR-210 (the today anchor, marker and rollover), FR-206 (the all-day band), FR-231–FR-238 (the four repeat choices, the series end, the canonical rule, the household-timezone expansion, the three scopes), FR-268 (the withheld "Show Meals" toggle), FR-283/FR-288 (the open write rule and refuse-never-queue); Phase 3 FR-379/FR-394–FR-398 (the press-and-hold machine, the chassis, accessibility and motion); Phase 5 FR-509/FR-510 (lists and their types), FR-516/FR-517 (items), FR-545 (nothing reserved for meals) and its Out of Scope naming this phase.

**The governing rule for this phase**, from the operator on 2026-09-04 and unchanged: *match the reference product wherever the research says what it does.* A behaviour tagged `[V]` or `[V-photo]` is adopted, not weighed and not improved. A decision is taken only where the research is `[?]`/`[I]`, or where the thing has no equivalent in the reference at all. Three of the reference's `[V]` behaviours are knowingly not matched, each for a reason already on the record: recipes get no navigation tab of their own (the locked scope, master map §1 — they live inside Meals); ingredients land on a list the person chooses, not a hard-wired default grocery list (the master map's divergence row 7); and a planned meal is a reference to one recipe rather than its own copy of the recipe's text, so the "Update Recipe" toggle has nothing to toggle (Assumption 9). And, as in every phase, there are no subscription tiers: the reference sells meal planning and recipes behind Calendar Plus `[V](36009559376795)`; here every feature is simply present.

**Evidence tags** — per constitution §VIII this spec asserts as fact only what a source verifies. Every requirement carries its tag:

| Tag | Meaning |
|---|---|
| `[V](id)` | Verified against a Skylight source. A bare number is a help-centre article id, resolvable as `https://skylight.zendesk.com/hc/en-us/articles/<id>`; named artifacts (`skylight-api`, `pyskylight`, `reviewed.com`, `myskylight`) are the live API captures, the third-party review and the marketing pages the dossiers cite. |
| `[V-photo]` | Verified by reading or pixel-sampling a product photograph or a store screenshot — here the device's Meals screen (`gallery/06`, `pdp/07`, dossier 07 §1.6/§3.7) and the phone's recipes list and meal planner (`shot12`, dossier 05). Real, but a measurement, not a document. |
| `[ESTIMATED]` | A proportional estimate from a photograph, ~±10 %. Every meals metric in dossier 07 §3.7 is one. |
| `[I]` | The dossiers' `[INFERRED]` grade carried through unchanged. Adopted as a decision where it appears, never asserted as fact. |
| `[?]` | Not in any source. Resolved here as a decision, never asserted. |
| `[OURS 2026-09-06 #n]` | A decision taken on that date under the operator's delegation; `#n` is its number in the Assumptions list below. |
| `[P1]` … `[P5]` | Already built and shipped in that phase; inherited, not rebuilt. Where a shipped *mechanism* is extended to this phase's records, the tag says so and names the new work. |

Requirement numbers are stable labels, not an order.

---

## Clarifications

### Session 2026-09-06

The operator delegated every question of this phase to research ("any questions you have, research Skylight and answer them yourself"). The five a clarification pass raises are recorded with the answer the sources gave.

- Q: Where do recipes live, given the reference has a Recipes tab `[V](43810243302811)` and the locked scope says "no separate tab"? → A: **Inside the Meals tab, as a pane opened from a "Recipes" control in its top bar** — the phone app's own arrangement (`shot12`: a "Recipes" book icon beside Today and Filter `[V-photo]`), with the reference's two-panel library inside it. The tab rail stays as Phase 1 shipped it. FR-601, FR-620, Assumption 2.
- Q: Which lines of a recipe become list items, when the reference's ingredients and instructions share one text field `[V](26933067959963)` and its push is asynchronous AI `[V](42181628465435)`? → A: **Every non-blank line of the text, offered as a checklist with all lines chosen, so the person unticks the instructions; then one write to the list they choose.** No parsing, no guessing, no waiting. FR-633–FR-635, Assumption 10.
- Q: Who may plan meals and keep recipes — parents only (Tasks, Rewards) or any punched-in Profile (events, lists)? → A: **Any punched-in Profile.** The reference's Parental Lock gates events and tasks and names neither meals nor recipes `[V](35089525796251)`, `[V](36824456433051)`; meals carry no stars; a teenager planning Friday's dinner is the feature. Renaming or recolouring a mealtime category is a household setting and stays with parents, as Labels do. FR-641, FR-642, Assumption 4.
- Q: What is a repeating meal's grammar, when the reference documents only "how often" and "when to stop" `[V](44739809442587)`? → A: **The calendar's four choices and its optional end date, stored as the same canonical rule, expanded in the household's timezone, with the same three scopes on edit and delete.** One recurrence engine, not two. FR-627–FR-630, Assumption 8.
- Q: Where do meals appear on the Week calendar, given the reference shows them "in the calendar's day grid" `[V](reviewed.com)` without saying how? → A: **As small tokens in the all-day band of their day, in category order, behind a per-device "Show Meals" switch in the Filter sheet.** A meal has a date and a mealtime, never a clock time, so the band is the honest place; the hour grid stays the events'. FR-636–FR-638, Assumption 11.

## User Scenarios & Testing *(mandatory)*

The same example household as Phases 2–5: profiles **Ana** (parent), **Ben** (parent) and **Cleo** (child), the Label **Bin day**, the lists "Grocery List" and "To-Do List". Household timezone `America/Chicago`, week starting Sunday. Cleo's Profile carries the dietary note "no nuts".

### User Story 1 — The Meals grid and its mealtimes (Priority: P1)

The family opens the Meals tab and sees the week laid out: seven day columns with today marked, and a row for each mealtime — Breakfast, Lunch, Dinner, Snack — named down a narrow rail at the left, each row washed in its mealtime's colour. Arrows and a swipe move a week at a time; Today brings the week back. From a Categories control a parent renames "Snack" to "Tea" and gives it a new colour; anyone hides a mealtime they never plan from this device's grid.

**Why this priority**: The grid is the surface every other story lives inside, and the four seeded mealtimes make it legible before a single meal is planned.

**Independent Test**: On a fresh household open `/family/meals`: seven days from Sunday with today marked, four rows in the specified names and colours, every cell empty. Page a week forward and back; tap Today. Rename and recolour a mealtime as a parent; hide one on this device and see its row leave here and nowhere else.

**Acceptance Scenarios**:

1. **Given** a household that has just been set up, **When** anyone opens the Meals tab on a 1920×1080 wall display, **Then** the grid shows the current week's seven days from the household's start day with today's header marked, four rows named **Breakfast**, **Lunch**, **Dinner** and **Snack** in that order and in their seeded colours, every cell empty, no profile chip row above, and the `+` reading "Add Meal".
2. **Given** the grid, **When** someone taps the next-week arrow or swipes left, **Then** the seven days that follow are shown; **When** they tap Today, **Then** the current week returns with today marked.
3. **Given** Ana (parent) is punched in, **When** she opens Categories, taps the pencil beside Snack, renames it "Tea" and picks a new colour, **Then** the row's label and wash change on every device within five seconds, and every meal already planned as a Snack sits in the "Tea" row.
4. **Given** Cleo (member) is punched in, **When** she opens Categories, **Then** the pencils are not offered to her, and the show/hide switches are.
5. **Given** the wall display, **When** anyone switches Lunch off in Categories, **Then** the Lunch row leaves the grid on that device only, its meals stay planned, and the phone still shows the row; the choice survives a reload of that device.
6. **Given** a phone, **When** the tab opens, **Then** one whole day column fills the width with the rail beside it, a swipe pages one day at a time, and the page never scrolls sideways.

---

### User Story 2 — Planning a meal (Priority: P2)

Ana taps Wednesday's Dinner cell. She can pick from the household's recipes or type a new entry — "🍝 Spaghetti" — which is planned there and kept as a recipe for next time. The cell shows the meal's name. Later she taps it: a popover names the meal, its date and mealtime, and offers Open Recipe, Add to List, Edit and Delete. She edits it to Thursday with the note "Ben cooks". A long-press on the cell adds a second meal to the same slot.

**Why this priority**: Planning is what the tab is for; the grid without it is a blank table.

**Independent Test**: Plan a new entry into a cell, see it on a second device within five seconds, open its popover, move it to another day with a note, add a second meal to a slot, delete one meal from a slot and see the other stay.

**Acceptance Scenarios**:

1. **Given** Wednesday's Dinner cell is empty and Ana is punched in, **When** she taps it, chooses New Entry, types "🍝 Spaghetti" and confirms, **Then** the cell shows "🍝 Spaghetti", a recipe of that name in the Dinner category now exists in the library, and Ben's phone shows the meal within five seconds.
2. **Given** the library holds "Pancakes" (Breakfast), **When** Ben taps Saturday's Breakfast cell and chooses From Recipes → Pancakes, **Then** the cell shows "Pancakes" and no second recipe is made.
3. **Given** "🍝 Spaghetti" is planned, **When** anyone taps it, **Then** a popover shows its name, "Wednesday 9 September · Dinner", the note if any, and the four actions **Open Recipe**, **Add to List**, **Edit**, **Delete**.
4. **Given** the popover, **When** Ana taps Edit, changes the date to Thursday and the note to "Ben cooks" and saves, **Then** the meal leaves Wednesday's cell and appears in Thursday's, with the note shown in its popover, on every device within five seconds.
5. **Given** Thursday's Dinner holds "🍝 Spaghetti", **When** Cleo presses and holds the cell and picks "Garlic bread" From Recipes, **Then** the cell shows both meals, one under the other, scrolling within the cell once they outgrow it (FR-604's fixed cell).
6. **Given** a slot with two meals, **When** Ana deletes one from its popover, **Then** it is told which meal goes, and on confirming only that meal leaves; the other stays, and the recipe stays in the library.
7. **Given** nobody is punched in, **When** someone taps an empty cell, **Then** the punch-in keypad appears first, and the add sheet only after a PIN is accepted.
8. **Given** the add sheet is open, **When** Ana looks below the fields, **Then** she sees "Cleo: no nuts" — every Profile's dietary note, and only those Profiles that have one.

---

### User Story 3 — The recipes (Priority: P3)

From the Recipes control Ben opens the household's recipes: a list with a coloured category badge on each, filter chips for the four mealtimes, and a search box; tapping one shows its name, its mealtime and its text — ingredients and instructions as the family typed them. He adds "Banana bread" under Snack with its ingredients and method, corrects a typo in "Pancakes", plans "Pancakes" for Sunday from its detail, and deletes an old recipe — choosing whether the meals already planned with it stay.

**Why this priority**: Recipes are the reusable half of planning; every New Entry becomes one. They are documented and released, but a household can plan by name alone without ever opening the pane.

**Independent Test**: Create a recipe with text, find it by filter and by search, edit it, plan a meal from its detail, delete it "recipe only" and see its planned meals keep their name, delete another "and planned meals" and see its meals go.

**Acceptance Scenarios**:

1. **Given** the Meals tab, **When** anyone taps Recipes, **Then** a pane opens listing every recipe by name with its mealtime's coloured badge, four filter chips, a search box, and a **New recipe** control; on a wide screen the selected recipe's detail sits beside the list, on a phone it opens over it.
2. **Given** the pane, **When** Ben (punched in) taps New recipe, types "Banana bread", picks Snack, pastes the ingredients and the method into the one text field and saves, **Then** "Banana bread" appears in the list under Snack, and on Ana's tablet within five seconds.
3. **Given** twelve recipes, **When** someone taps the Breakfast chip, **Then** only Breakfast recipes are listed; **When** they type "bread" into the search, **Then** only recipes whose name or text contains "bread" are listed, within the chip's filter.
4. **Given** "Pancakes" is selected, **When** Ana taps Edit, fixes the text and saves, **Then** every planned "Pancakes" meal's Open Recipe shows the fixed text.
5. **Given** "Pancakes" is selected, **When** Ben taps Plan Meal, picks Sunday and Breakfast and confirms, **Then** Sunday's Breakfast cell shows "Pancakes".
6. **Given** "Old stew" is planned twice, **When** Ana deletes it and chooses "Just the recipe", **Then** it leaves the list and cannot be planned again, the two planned meals keep showing "Old stew" and their popovers still open its text; **When** she deletes "Older stew" and chooses "This recipe and planned meals", **Then** it and every meal planned with it are gone everywhere.
7. **Given** a recipe's text runs long, **When** its detail is open on the wall, **Then** the text scrolls inside the pane and the rest of the tab stays put.

---

### User Story 4 — Ingredients onto a list (Priority: P4)

Sunday evening Ana opens "🍝 Spaghetti" and taps Add to List. A sheet shows the recipe's lines as a checklist, every line chosen; she unticks the three instruction lines, picks "Grocery List" and confirms. The six ingredient lines are on the Grocery List at once, unchecked, at the end. Ben's phone shows them within seconds.

**Why this priority**: The push is the reason meals and lists share a product, and the master map's row 7 divergence lives here. It depends on both tabs existing.

**Independent Test**: Add a recipe's lines to a list, confirm exactly the chosen lines arrive as ungrouped unchecked items in one write, at the end, on both devices.

**Acceptance Scenarios**:

1. **Given** "🍝 Spaghetti" has a nine-line text, **When** Ana taps Add to List, **Then** a sheet lists the nine non-blank lines each with a checkbox, all ticked, and a chooser of the household's lists with Grocery lists first.
2. **Given** the sheet, **When** Ana unticks three lines, chooses "Grocery List" and confirms, **Then** the six ticked lines become six items at the end of the Grocery List's ungrouped items, unchecked, in the recipe's order, in one write; the Lists tab on Ben's phone shows them within five seconds; the sheet closes with a one-line confirmation.
3. **Given** the household has no lists, **When** anyone taps Add to List, **Then** the sheet says there is no list to add to and points at the Lists tab; nothing is written.
4. **Given** the recipe's text is empty, **When** anyone taps Add to List, **Then** the sheet says there is nothing to add; nothing is written.
5. **Given** the same lines were added yesterday and are still on the list, **When** Ana adds them again, **Then** they are added again; nothing is de-duplicated or merged.

---

### User Story 5 — Repeating meals (Priority: P5)

"Family Pizza Friday": Ana plans "🍕 Pizza" on Friday and turns on Repeats — every week on Friday, until the end of the year. Every Friday's Dinner cell in every week shows it. In November she changes one Friday to "🌮 Tacos" — this meal only — and later ends the series from a Friday onward.

**Why this priority**: Documented and marketed by the reference, and the calendar's recurrence engine already does the hard part; still, a household can plan week by week without it.

**Independent Test**: Plan a weekly meal with an end; page through the weeks and see it on every matching day and not after the end; edit one occurrence, then "this and future", then delete "all", checking each scope's effect on the other weeks.

**Acceptance Scenarios**:

1. **Given** the add sheet, **When** Ana turns on Repeats and chooses Every week on Friday, until 31 December, **Then** every Friday's Dinner from this week to that date shows "🍕 Pizza", and no Friday after it does.
2. **Given** a repeating meal, **When** anyone opens one occurrence's popover and taps Edit, **Then** they are asked **This meal** / **This and future meals** / **All meals** before the form opens, in that wording, and a one-time meal is never asked.
3. **Given** the 13 November occurrence, **When** Ana deletes it with scope This meal and adds "🌮 Tacos" to that Friday's Dinner, **Then** only that Friday shows Tacos and every other Friday still shows Pizza (FR-630: a recipe never changes for one occurrence).
4. **Given** the 27 November occurrence, **When** Ana deletes it with scope This and future meals, **Then** Fridays before it keep Pizza and Fridays from it onward are empty.
5. **Given** the series, **When** Ben deletes an occurrence with scope All meals, **Then** every Friday's Pizza is gone, including the Tacos exception, and the Pizza recipe stays in the library.
6. **Given** the reference's repeat has "how often" and "when to stop", **When** the sheet offers Repeats, **Then** the choices are the calendar's — Never, Every day, Every week on chosen weekdays, Every month on the date — and an optional end date, and nothing else.

---

### User Story 6 — Meals on the calendar (Priority: P6)

On the Week calendar, above each day's events, the family sees what is for dinner: a small "🍝 Spaghetti" token with the Dinner colour in Wednesday's all-day band. Tapping it opens the same popover. On the wall, where the calendar is busy, a parent turns Show Meals off in the Filter sheet and the tokens leave that device only.

**Why this priority**: It is the reference's documented integration and Phase 2's withheld toggle, but it changes a shipped screen and is the last thing to switch on.

**Independent Test**: Plan meals; see tokens in the calendar's all-day band for their days in category order; hide a category on this device and see its tokens go; turn Show Meals off and see all of them go on this device only; tap a token and get the meal popover.

**Acceptance Scenarios**:

1. **Given** Wednesday has a Lunch and a Dinner planned, **When** the Week calendar shows Wednesday, **Then** its all-day band carries two tokens, Lunch's then Dinner's, each with its mealtime's colour and the meal's name, below any all-day events, and the hour grid is unchanged.
2. **Given** a token, **When** anyone taps it, **Then** the meal's popover opens with Open Recipe, Add to List, Edit and Delete, as on the Meals tab.
3. **Given** the Filter sheet, **When** someone turns **Show Meals** off, **Then** every token leaves the calendar on that device only; the Meals tab is unchanged; the choice survives a reload.
4. **Given** Lunch is hidden on this device in the Meals tab's Categories, **When** the calendar shows Wednesday, **Then** its Lunch token is absent here and present on other devices.
5. **Given** a repeating meal, **When** the calendar shows a matching day, **Then** its token appears there like any other meal.
6. **Given** a token, **When** someone presses and drags it, **Then** nothing lifts and nothing is written; meals are moved from their popover's Edit, not by drag.

---

### Edge Cases

- **Two devices plan into the same slot in the same second.** Both succeed; the slot holds two meals; neither device shows an error.
- **A recipe is deleted while its popover is open on another device.** "Just the recipe": the popover stays and still shows the text; "and planned meals": the popover closes with the shipped "no longer here" message within five seconds.
- **A mealtime is hidden on this device while a meal in it is being edited.** The edit completes; the row is simply not drawn afterwards on this device.
- **Every mealtime is hidden on a device.** The grid shows a note — "No mealtimes shown on this device" — with the Categories control still available; nothing is written.
- **A mealtime is renamed to another's name** ("Tea" when "Tea" exists, compared trimmed and case-insensitively). Refused against the field; nothing is written.
- **A recipe name is only spaces, or the text exceeds its limit.** Refused before it is sent, against the field; nothing is written.
- **A repeating meal's end date is before its first date.** Refused against the field.
- **The household's week start changes in Settings.** The grid's leftmost column follows the new start day on the next render; no meal moves.
- **The date rolls over at midnight with the grid open.** Today's marker moves; if the week has ended, Today brings the new week and the shown week does not jump on its own.
- **A meal is planned in the past.** Allowed; the reference does not forbid it and a family records what it ate.
- **A category's colour is changed while the calendar is open.** Its tokens take the new colour within five seconds.
- **The device is offline.** Every write on the tab is refused with a plain message where the tap happened; nothing is queued; the grid keeps showing what it last read.
- **Storage is refused on the device.** The hidden mealtimes and the Show Meals switch still work for the session and are simply not remembered; the Filter sheet says so, as it already does.
- **A Profile who planned meals and kept recipes is deleted.** Every meal and recipe stays exactly as it is; only the record of who made or changed it is cleared. The Profile delete confirmation gains no sentence about meals; a Profile's dietary note goes with the Profile.
- **The recipe's text has Windows line endings, or blank lines between ingredients.** Lines are split on any line break and blank lines are dropped; the checklist shows what is left.
- **A line of the recipe is longer than a list item may be** (200 characters). It is shown in the checklist, chosen, and truncated at 200 characters when it is added — the sheet says so beside it.

## Requirements *(mandatory)*

### Functional Requirements

**The Meals tab**

- **FR-601**: The system MUST replace the Phase 1 placeholder behind the shipped Meals navigation tab with this tab, keeping the tab's place, label and icon, and MUST NOT add a Recipes tab to the rail; recipes are reached from a **Recipes** control in the tab's top bar. `[P1]` FR-029 fulfilled for Meals; no tab is the locked scope `[V](00-master-map §1 — "recipes folded in (no separate tab)")`; the control's place is the phone's `[V-photo]` (`shot12` — "Today / Filter / Recipes") `[OURS 2026-09-06 #2]`.
- **FR-602**: The tab MUST present one week as a grid: one column per day, seven for a full week, in the household's stored week-start order, and one row per mealtime category shown on this device, in the household's category order, with the category names on a narrow rail at the left, rotated to read upward. Seven columns by up to four rows `[V](41418036777371)`, `[V](44739809442587)`; the rotated ~40-unit rail `[V-photo]` (`pdp/07`); the week-start order `[P1]` (Settings "Start week on") `[OURS 2026-09-06 #3]`.
- **FR-603**: The grid MUST mark today's column in its day header the way the Week calendar marks today, and MUST offer a previous-week and a next-week control and a **Today** control that returns to the current week; on a display where seven whole columns do not fit, the grid MUST show as many whole day columns as fit, never fewer than one, and page by that many days on the arrows and on a horizontal swipe. The controls are `[I]` (dossier 03 §8 — "inferred parity with the Calendar tab"), adopted; the marker `[P2]` FR-209; the whole-column fit and paging are the shipped chassis `[P3]` FR-394/FR-395 `[OURS 2026-09-06 #3]`.
- **FR-604**: Each cell MUST be one slot — a date and a mealtime — and MUST show every meal planned into it, one under the other, each by the name of its recipe; a slot with nothing planned MUST be drawn empty. Cells carry the meal's name `[V-photo]` (`gallery/06`, `pdp/07`); multiple meals per slot `[V](44739809442587 — "supports multiple recipes per meal/day/category")`; the metrics — cell ~235 wide, ~250 high, radius ~25, gaps ~20 across and ~38 down, the rail ~40, the popover ~700 wide with radius ~32 — are `[ESTIMATED]` and live in the token layer.
- **FR-605**: Each mealtime's row MUST be washed in that mealtime's colour, derived from its one stored colour by the shipped tint rule, and its name on the rail and its badge elsewhere MUST use the same colour; nothing about a mealtime's look MAY be hand-picked outside that colour. Category colour as a first-class attribute `[V-photo]` (`pdp/07` — the popover's "● Breakfast" dot); the ramp `[V-photo]` (dossier 07 §1.6); derivation `[P1]`.
- **FR-606**: The system MUST NOT render the shell's profile chip row on the Meals tab; meals are not per-Profile. `[V-photo]` (`pdp/07` — the top bar goes straight into the grid); `[P1]` FR-032 changed, as Phases 3 and 5 did `[OURS 2026-09-06 #2]`.
- **FR-607**: The shipped create control (the `+`) MUST read **Add Meal** on this tab and open the add sheet with today and the first shown mealtime selected, both changeable inside it. `[?]` for the device; the phone's `+` on the planner `[V-photo]` (`shot12`); `[P1]` FR-034 registered for Meals `[OURS 2026-09-06 #2]`.

**Mealtime categories**

- **FR-608**: A newly set-up household MUST have four mealtime categories ready, in this order and with these colours: **Breakfast** `#A8D4D3`, **Lunch** `#F66951`, **Dinner** `#915EA1`, **Snack** `#FDC36D`; they MUST be made once and never re-created while the household has any. The four defaults `[V](41418036777371)`, `[V](44739809442587)`; their live colours and order `[V](skylight-api)`; Contradiction 1 `[OURS 2026-09-06 #5]`.
- **FR-609**: A household MUST have exactly four mealtime categories: none may be added and none deleted. Every source caps at four and none adds a fifth `[I]` (dossier 03 §10 — "fixed at 4"), adopted `[OURS 2026-09-06 #5]`.
- **FR-610**: The tab MUST offer a **Categories** control opening a sheet that lists the four mealtimes, each with a show/hide switch for this device and, for a punched-in parent, a pencil that opens its name (1–40 characters, trimmed, unique within the household compared trimmed and case-insensitively) and its colour from the household's 20-colour palette for editing. The control, the switches and the pencil `[V](26902149028379 — "Tap the 'Categories' button… toggle button next to its name… pencil icon… change its color or rename it")`, `[V](41418036777371)`; the palette `[P1]`; who edits `[OURS 2026-09-06 #4]`; the bound `[?]` `[OURS 2026-09-06 #5]`.
- **FR-611**: Hiding a mealtime MUST remove its row from this device's grid and its tokens from this device's calendar, MUST leave every meal planned in it untouched, MUST be remembered per device and never written to the household; all four MUST be shown by default. Per-device visibility with per-category switches `[V](36835449004315 — Settings "Show meals": "one toggle switch per meal category… show/hide on the device")`; default `[I]` (dossier 04 — "All four shown by default"); Contradiction 2 `[OURS 2026-09-06 #6]`.
- **FR-612**: Renaming or recolouring a mealtime MUST change it for the household, everywhere, and MUST carry every meal planned in it with it; the category a recipe or meal names is the category record, never its name. `[V](26902149028379)`; the record identity `[OURS 2026-09-06 #5]`.

**Recipes**

- **FR-613**: A recipe MUST have a name (1–120 characters, trimmed), exactly one mealtime category, and one free-text field of ingredients and instructions together (0–10 000 characters). Name, one category and the combined text `[V](43810243302811 — "Name… Category, and a combined 'Instructions or ingredients' text field")`, `[V](44338446585115 — "Recipes can only be in one category at a time")`, `[V](26933067959963 — ingredients and instructions "together into that one field")`, `[V](skylight-api — `summary` and one `description` blob)`; the bounds `[?]` `[OURS 2026-09-06 #7]`.
- **FR-614**: A recipe's name MUST be plain text; emoji are whatever the person types into it ("🍝 Spaghetti"), and no emoji is ever assigned for the person. Emoji + name on the cell `[V](00-master-map §5.5 — "Cells carry emoji + name")`; auto-emoji is AI and excluded `[V](00-master-map §1)` `[OURS 2026-09-06 #7]`.
- **FR-615**: Any punched-in Profile MUST be able to create a recipe from the Recipes pane, and to edit a recipe's name, category and text from its detail; every planned meal that references it MUST show the edited recipe. Creation and editing `[V](43810243302811)`, `[V](26902065343771)`; who `[OURS 2026-09-06 #4]`; one recipe, no copies — Assumption 9.
- **FR-616**: Deleting a recipe MUST offer exactly two choices — **Just the recipe** and **This recipe and planned meals** — MUST confirm which is chosen and how many planned meals it touches, and MUST NOT be undoable. With the first, the recipe MUST leave the library and be un-plannable while every meal already planned with it keeps its name and its text; with the second, the recipe and every meal planned with it MUST be removed everywhere. The two choices and no undo `[V](26902065343771 — "delete just the recipe (meals already planned with it remain on the Meal Plan), or delete 'This recipe and planned meals'")`, `[V](44338446585115 — "deletions are not undoable")`; the confirmation is constitution §VI; how the first keeps the meals is `[OURS 2026-09-06 #12]`.
- **FR-617**: A recipe MUST belong to the household and record which Profile created it and which last changed it. `[P1]` FR-016.

**The Recipes pane**

- **FR-618**: The Recipes control MUST open a pane listing every recipe of the household by name, each with its mealtime's coloured badge, and MUST NOT list recipes removed by FR-616's first choice. The list and the badge `[V-photo]` (`shot12` — a coloured category-letter badge on every row), `[V](43810243302811 — "left panel lists all recipes")`.
- **FR-619**: The pane MUST offer one filter chip per mealtime and a keyword search box; the list MUST show only recipes whose category matches the chosen chip, if any, and whose name or text contains the typed words, case-insensitively. Chips and search `[V](44338446585115 — "category filter buttons at the top of the recipe list, plus a keyword search box")`, `[V-photo]` (`shot12`); searching the text as well as the name `[?]` `[OURS 2026-09-06 #7]`.
- **FR-620**: Selecting a recipe MUST show its detail — its name, its mealtime as a coloured dot and name, and its text with line breaks kept — beside the list where the width allows and over it on a phone; the detail MUST offer **Plan Meal**, **Add to List**, **Edit** and **Delete**. The two-panel library `[V](43810243302811 — "two-panel — left panel lists all recipes, right panel shows the selected recipe's detail")`; the four actions `[V](43810243302811)`, `[V](44338446585115 — "Plan Meal… Add to Grocery List… Edit/delete via a menu icon")`; the phone's single panel `[OURS 2026-09-06 #2]`.
- **FR-621**: **Plan Meal** from a recipe's detail MUST open the add sheet with that recipe chosen and a date, a mealtime (defaulting to the recipe's) and Repeats to set. `[V](43810243302811 — "tap 'Plan Meal,' set Date, Category, and optionally a 'Repeats' toggle")`.

**Planning meals**

- **FR-622**: Tapping an empty cell MUST open the add sheet for that slot, offering **From Recipes** — the household's recipes, the slot's mealtime first — and **New Entry** — a name and, optionally, the text — and confirming MUST plan one meal into the slot; a New Entry MUST also save a recipe of that name in the slot's mealtime, so it can be planned again. The two paths `[V](41418036777371 — "choose 'From Recipes' (pick a saved recipe) or 'New Entry'")`; the saved recipe `[V](26901740297627 — "the recipe is saved into the Recipes library for reuse")`; browsing other categories `[V](26901740297627)`.
- **FR-623**: Pressing and holding a cell that already holds a meal MUST open the same add sheet for that slot, so a second meal joins the first; the popover of any meal in the slot MUST also offer **Add another meal**, so the slot can be added to from the keyboard. Long-press `[V](44739809442587 — "Long-press an existing recipe tile to add an additional recipe to the same meal slot")`; the keyboard path is constitution §III `[OURS 2026-09-06 #13]`.
- **FR-624**: A planned meal MUST have a date, a mealtime, one recipe and an optional note (0–200 characters); meals in one slot MUST be drawn in the order they were planned. Date, category and note `[V](44739809442587 — "edit meal-level details: date, category, notes")`; the order and the bound `[?]` `[OURS 2026-09-06 #7]`.
- **FR-625**: Tapping a planned meal MUST open a popover showing its name, its date and mealtime, its note, and exactly the actions **Open Recipe**, **Add to List**, **Edit**, **Delete**; Open Recipe MUST show the recipe's detail (FR-620). The popover and its actions `[V](41418036777371 — "'Open Recipe'… 'Add to List'… 'Edit,' and 'Delete'")`, `[V](47693297240347)`, `[V-photo]` (`pdp/07` — title, Edit/Delete pills, date, category dot, the text).
- **FR-626**: **Edit** MUST let any punched-in Profile change the meal's date, mealtime, note and — for a non-repeating meal — its recipe; **Delete** MUST, after a confirmation naming the meal, remove that meal from its slot and leave the recipe in the library. Edit `[V](26902065343771)`; delete from the slot only `[V](44739809442587 — "removes it only from that meal-plan slot, not from the saved Recipes library")`; the confirmation is constitution §VI.

**Repeating meals**

- **FR-627**: The add and edit sheets MUST offer **Repeats** with exactly the Week calendar's choices — Never, Every day, Every week on chosen weekdays, Every month on the date — and its optional end date, and no count. The toggle, an interval and a stop `[V](44739809442587 — "select how often you would like the meal to repeat, and when you would like the repeat to stop")`, `[V](myskylight — "Family Pizza Fridays")`; the grammar is `[P2]` FR-231/FR-232 `[OURS 2026-09-06 #8]`.
- **FR-628**: A repeat MUST be stored as the same canonical recurrence rule the calendar stores, with its occurrences generated as dates in the household's timezone, and MUST be drawn in every slot it lands on within the shown week and on the calendar. `[P2]` FR-233/FR-234 mechanism applied to meals `[OURS 2026-09-06 #8]`.
- **FR-629**: Editing or deleting one occurrence of a repeating meal MUST first ask **This meal** / **This and future meals** / **All meals**, in that wording, and MUST NOT ask for a one-time meal; the answer MUST bind exactly as the calendar's scopes do — one occurrence changed or removed as an exception, the series cut and continued from a date, or the whole series. `[P2]` FR-237/FR-238 pattern, the split and the exceptions reused `[OURS 2026-09-06 #8]`.
- **FR-630**: Changing a repeating meal's recipe MUST be offered at series scopes only, so one occurrence can be replaced by another meal (Delete this meal, then add) but never carry a different recipe under the series' name. `[?]`, the calendar's FR-287 reasoning `[OURS 2026-09-06 #8]`.

**Ingredients onto a list**

- **FR-631**: **Add to List** — from a meal's popover and from a recipe's detail — MUST open a sheet listing every non-blank line of the recipe's text as a checklist with every line chosen, and a chooser of the household's lists with Grocery lists first, then the rest, in their stored order; a member MUST see only the lists a member may see. The action from both places `[V](42181628465435)`, `[V](43810243302811)`; the destination choice is the master map's divergence `[V](00-master-map §5.5, §11 row 7 — "do let the user pick the list")`; the checklist `[OURS 2026-09-06 #10]`; Parents only lists `[P5]` FR-514.
- **FR-632**: Confirming MUST add exactly the chosen lines to the chosen list as items — each trimmed, cut to 200 characters, unchecked, ungrouped, at the end in the recipe's order — in one write attributed to the punched-in Profile, MUST NOT de-duplicate against the list, and MUST close with a one-line confirmation naming the count and the list. The push `[V](42181628465435)`; synchronous and whole `[V](00-master-map §5.5)`; the item shape is `[P5]` FR-516/FR-517; no de-duplication `[?]` `[OURS 2026-09-06 #10]`.
- **FR-633**: With no list to add to, or no non-blank line to add, the sheet MUST say so and write nothing. `[OURS 2026-09-06 #10]`.

**Meals on the calendar**

- **FR-634**: The Week calendar MUST show each planned meal of a day as a token — its mealtime's colour and the meal's name — in that day's all-day band below any all-day events, tokens in the household's mealtime order; the hour grid MUST be unchanged. Meals on the calendar `[V](41418036777371 — "meals appear in the Calendar tab")`, `[V](reviewed.com — "dinners visible on the calendar grid")`; the band and the token are `[?]` `[OURS 2026-09-06 #11]`; the band `[P2]` FR-206 extended.
- **FR-635**: The shipped Filter sheet MUST gain a **Show Meals** switch, per device, on by default; off, every meal token leaves that device's calendar and nothing else changes. The toggle `[V](36625171368987 — "'Show Meals' — toggles meal-plan visibility on the calendar (reduces clutter)")`; `[P2]` FR-268 lifted; default `[I]` `[OURS 2026-09-06 #11]`; Contradiction 2.
- **FR-636**: Tapping a token MUST open the meal's popover (FR-625); a token MUST NOT lift or drag, and the calendar's drag of events MUST be unaffected by the tokens. `[?]` `[OURS 2026-09-06 #11]`.
- **FR-637**: A mealtime hidden on this device (FR-611) MUST hide its tokens on this device's calendar too. `[V](36835449004315)` `[OURS 2026-09-06 #6]`.

**Dietary notes**

- **FR-638**: The add sheet, the edit sheet and the recipe form MUST show, below their fields, each Profile's dietary note as "Name: note", for every Profile that has one and no other, read-only. `[V](00-master-map §1 — "per-profile dietary restrictions shown while planning, no AI")`; the field `[P1]` FR-024.

**Who may do what**

- **FR-639**: Every write on this tab — planning, editing and deleting meals; creating, editing and deleting recipes; adding to a list — MUST require a punched-in Profile and MUST be open to every punched-in Profile, parent or member. Punch-in `[P1]` FR-013; open to all is the events and lists rule `[P2]` FR-283, `[P5]` FR-534: the reference's Parental Lock names neither meals nor recipes `[V](35089525796251)`, `[V](36824456433051)` `[OURS 2026-09-06 #4]`.
- **FR-640**: Renaming or recolouring a mealtime category MUST require a punched-in **parent**; a member MUST NOT be offered the pencil, and the server MUST refuse a member's attempt. Household settings are parents' `[P1]` FR-015 (Labels) `[OURS 2026-09-06 #4]`.
- **FR-641**: The tab MUST decide what to offer from the punched-in Profile's role, and every action MUST re-check that role at the server against the database, never trusting the client. `[P1]` FR-015 mechanism, `[P3]` FR-389 pattern.
- **FR-642**: The actions this phase adds MUST refuse, never queue and never optimistically show as done, a write they cannot complete — offline, or where the meal, recipe, category or list no longer exists because another device changed it — with a plain message where the tap happened. `[P2]` FR-288, `[P3]` FR-393, `[P5]` FR-537.

**Shared rules**

- **FR-643**: The system MUST show another device's change to any meal, recipe or mealtime within seconds, through the shipped live channel carrying a bare "something changed" notice and no content. `[P1]` channel extended to this phase's records `[OURS 2026-09-06]`.
- **FR-644**: The system MUST keep every meal, recipe and mealtime inside its household: another household's MUST be invisible on every path that reads and unwritable on every path that writes, without a client-side write path of any kind. `[P1]` FR-005 mechanism; `[P4]` FR-442, `[P5]` FR-539 pattern.
- **FR-645**: Deleting a Profile MUST leave every meal and recipe exactly as it is, clearing only who created or changed it; the Profile delete confirmation MUST NOT gain a sentence about meals. `[P1]` FR-026, `[P5]` FR-540 `[OURS 2026-09-06 #12]`.
- **FR-646**: Every control on this tab MUST meet the shipped touch and accessibility rules: a 44×44 target, an accessible name — a cell by its day and mealtime and what it holds, a meal by its name, a token by its mealtime and name, a category switch by its name and state — visible focus, and a keyboard path for every gesture: the long-press's "add another" is the popover's **Add another meal**, and week paging is the arrows. Constitution §III; `[P3]` FR-397 `[OURS 2026-09-06 #13]`.
- **FR-647**: Opening a popover, a pane or a sheet, and a cell's change, MUST collapse under a reduced-motion preference to instant changes with the same end state. `[P3]` FR-398.
- **FR-648**: Per-device state on this tab — the hidden mealtimes and the calendar's Show Meals switch — MUST live on the device, never in the household's store, and MUST keep working for the session when storage is refused, with the Filter sheet's shipped "won't be remembered on this device" notice. `[P1]` FR-033 pattern, constitution §VI `[OURS 2026-09-06 #6]`.
- **FR-649**: Nothing this phase stores MAY presume a later phase's notifications, home screen or search: no reminder field on a meal, no reserved column. `[OURS 2026-09-06 #14]`.

### Key Entities

- **Mealtime category** — one of the household's four mealtimes: a name, one colour from the palette, its place in the row order, and which Profile last changed it. Exactly four exist per household, made once; hidden or shown per device, never deleted.
- **Recipe** — one saved recipe of the household: a name, one mealtime category, one free-text field of ingredients and instructions, whether it has been removed from the library (FR-616's first choice), and which Profile created it and last changed it. Planned meals reference it; it never copies into them.
- **Planned meal** — one entry in one slot: a date, a mealtime category, one recipe, an optional note, an optional repeat rule with an optional end, and which Profile planned it and last changed it. A repeating meal's exceptions — an occurrence changed or removed alone — are kept the way the calendar keeps an event's.
- **Slot** — not a record: a date and a mealtime. It holds whatever meals land on it, one-time or by repeat, in the order they were planned.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-601**: On a fresh household the Meals tab shows exactly four mealtime rows — Breakfast, Lunch, Dinner, Snack — in the specified colours and order, and re-running the household set-up creates no fifth.
- **SC-602**: A meal planned on one device appears in the same slot on a second device **within 5 seconds** with no reload; a New Entry appears in both devices' Recipes pane in the same interval.
- **SC-603**: A meal edited, moved, noted or deleted on one device is drawn so on a second device **within 5 seconds**; two devices planning into the same slot in the same second both succeed and neither shows an error.
- **SC-604**: A renamed or recoloured mealtime is drawn so on every device **within 5 seconds**, with every meal planned in it still in its row; a hidden mealtime leaves the grid on that device **within 1 second** and on no other.
- **SC-605**: A repeating meal with a weekly rule and an end date is drawn on **every** matching day inside the visible range and on **none** after the end, on the grid and on the calendar; each of the three scopes changes exactly the occurrences it names and no other.
- **SC-606**: Add to List with N lines chosen creates exactly N items on the chosen list in **one** write, at the end, unchecked and ungrouped, in the recipe's order, and the Lists tab on a second device shows them **within 5 seconds**.
- **SC-607**: Deleting a recipe "Just the recipe" removes it from the pane and leaves every planned meal in place with its name and text; "This recipe and planned meals" removes the recipe and every meal planned with it on every device **within 5 seconds**.
- **SC-608**: Every write on this tab from a device that is offline is refused with a message **within 5 seconds**, stores nothing, and never appears later; every write with nobody punched in opens the keypad first and stores nothing until a PIN is accepted; a member's attempt to rename or recolour a mealtime is refused at the server.
- **SC-609**: An anonymous session reading any of this phase's tables gets a refusal, not an empty result; an authenticated session from another household reads **zero** rows on every path; an authenticated session of this household cannot insert, update or delete a meal, recipe or category directly.
- **SC-610**: At 1920×1080 seven whole day columns are visible beside the rail; at 1180×820 and 820×1180 as many whole columns as the cell width allows, never a clipped one; at 390×844 one column fills the width; at every width the page never scrolls sideways, a horizontal swipe pages by the visible days, and every control's touch target is at least 44×44 CSS px.
- **SC-611**: Every meals metric named in FR-604 is a single token in the shipped token layer, each tagged `[ESTIMATED]`, read back by a unit test; no cell, rail, gap or popover size is written in a component.
- **SC-612**: Every cell, meal, token, category switch, pencil, chip and action has an accessible name that a screen reader announces with its state; the whole tab is operable by keyboard, including adding a second meal to a slot and paging weeks.
- **SC-613**: The pure logic of this phase — which meals land in which slot of a week including repeats and exceptions, the slot order, the visible-column fit, the recipe filter and search, the line split for Add to List, what the device switches hide — is covered by unit tests that fail before the behaviour and pass after; the new tables' policies, grants and the actions' refusals are covered by the policies suite against the local stack.
- **SC-614**: After this phase is live, the Week calendar, the Tasks board, the Rewards tab and the Lists tab still receive another device's changes **within 5 seconds** — the shared live channel is not taken down by the new tables — and the calendar's event drag is unchanged with tokens present.
- **SC-615**: The Phase 1 placeholder is gone from the Meals tab, the profile chip row is absent on it, the `+` reads "Add Meal", the rail has no Recipes tab, and the Tasks, Rewards and Lists tabs are unchanged to the pixel.

## Assumptions

Decisions taken on **2026-09-06** under the operator's delegation ("any questions you have, research Skylight and answer them yourself"), wherever the research was inferred, unknown, contradictory, or had no equivalent in the reference product. Recorded here rather than asserted as fact, per constitution §VIII. The numbers are the reference used by the `[OURS 2026-09-06 #n]` tags above.

1. **This phase is Meals with recipes folded in; Phase 7 follows.** The split from Lists is Phase 5's Assumption 1. The reference gates all of it behind Calendar Plus `[V](36009559376795)`; here there are no tiers, and the gating is recorded only to explain why the reference's articles keep saying "requires a subscription". Reminders, Web Push, the home screen, search and the offline cache remain Phase 7. `[OURS]`
2. **Recipes are a pane in the Meals tab, not a tab.** The locked scope says "recipes folded in (no separate tab)" `[V](00-master-map §1)`, while the device has a Recipes tab `[V](43810243302811)` (Contradiction 3). The phone app already reaches recipes from a "Recipes" control on the meal planner `[V-photo]` (`shot12`), so that arrangement is taken for every width: the pane keeps the reference's two-panel library on a wide screen and stacks on a phone. The chip row is off, as on Tasks and Lists, and the `+` reads Add Meal. `[OURS]`
3. **The grid is the household's week, anchored on its start day; today is marked; narrow screens show as many whole days as fit.** The photographed grid runs Sunday to Saturday `[V-photo]` (`pdp/07`), and a planning grid is a week, not the calendar's rolling window anchored on today (Phase 2 Assumption on "Start on current day") — a family plans "this week" and "next week". Week navigation and a today marker are inferred from the calendar `[I]` and adopted. On a phone the shipped chassis rule applies: whole columns, paged by as many as fit (the phone app shows a day list `[V-photo]`; a one-column grid reads the same). `[OURS]`
4. **Every meal and recipe write is open to any punched-in Profile; category edits are parents'.** The reference's Parental Lock gates events and tasks and never meals `[V]`; meals carry no stars; so the events/lists rule applies (Phase 2 FR-283, Phase 5 FR-534). Renaming and recolouring a mealtime is a household setting like a Label's name and colour, which Phase 1 reserved to parents; hiding one is per device and open to anyone at the device. `[OURS]`
5. **Exactly four mealtimes, seeded once with the API's names and colours, renamable and recolourable, never added or deleted.** The four defaults are verified `[V]`; whether a fifth can be added is not, and every article caps at four `[I]`, so the set is fixed and the category is a record with an identity — a rename carries its meals. The seeded colours are the live API's (`#A8D4D3`, `#F66951`, `#915EA1`, `#FDC36D`) rather than the marketing frame's apricot/sky/lavender/pink `[V-photo]` (Contradiction 1), because the API values are what the product stores and the photograph shows a household that recoloured. Names are bounded at 40 characters to fit the rotated rail. `[OURS]`
6. **Per-category visibility is per device, in the Meals tab's Categories sheet; the calendar's Show Meals is one per-device switch in the Filter sheet.** The device's Categories menu toggles categories `[V](26902149028379)`; Settings has the same four switches under "Show meals" `[V](36835449004315)`; the Calendar's Filter panel has a single "Show Meals" `[V](36625171368987)`; the phone's Show Meals carries four per-category toggles `[V-photo]` (dossier 05) (Contradiction 2). Resolution: one place for each — the four category switches live in the Meals tab's Categories sheet and govern both the grid and the calendar; the Filter sheet's Show Meals is the calendar's one master switch. Both are device state, all shown by default `[I]`. `[OURS]`
7. **A recipe is a name, one category and one text; a meal has a note; searches cover the text.** The one-field shape is verified `[V]` and kept — no ingredient array, no parsing. Bounds are ours: 120 for the name (the events' title bound), 10 000 for the text (a long recipe pasted from a page), 200 for a meal's note (an item's bound). Emoji are typed into the name, as on lists. Search covers name and text because the phone's "keyword search" `[V]` does not say, and an ingredient is what a family searches for. Meals within a slot keep planning order; nothing reorders them (`[?]`). `[OURS]`
8. **Repeats are the calendar's engine: four choices, an optional end, canonical rules, three scopes.** The reference documents a "how often" and a "when to stop" `[V]` and nothing more. Phase 2 shipped exactly that grammar, its canonical storage, its household-timezone expansion, its exceptions and its this / this-and-future / all scopes, and building a second recurrence for date-only meals would fork it. The scope wording becomes "This meal / This and future meals / All meals". A series' recipe changes at series scope only, for the reason FR-287 gave for an event's colours. `[OURS]`
9. **A planned meal references one recipe; the "Update Recipe" toggle is not reproduced.** The reference lets an edit to a meal's recipe content apply to that one meal unless "Update Recipe" is on `[V](44739809442587)`, which means its meal carries its own copy of the text. Here a meal is a reference: editing the recipe changes it everywhere, and a one-off variation is the meal's note or a different recipe. Rejected: a per-meal text override — two sources of truth for one dish, and a recipe's "Open Recipe" that shows different text on different days. This is a knowing divergence from a `[V]` behaviour and is recorded as such. `[OURS]`
10. **Add to List is a checklist of the text's lines, all chosen, onto a list the person picks; no parsing, no de-duplication.** The reference's push is asynchronous AI onto a hard-wired default grocery list `[V]`; the master map's row 7 already rejects the hard-wired destination and proposes splitting on newlines `[V](00-master-map §5.5)`. Because ingredients and instructions share one field, the person unticks the instruction lines — one glance, no guessing. Lines are trimmed and cut to the item bound; nothing is de-duplicated, because the reference does not and a second "Milk" is cheaper than a lost one. Grocery lists are listed first because they are what the reference targets. `[OURS]`
11. **Meals on the calendar are tokens in the all-day band, behind Show Meals, on by default, not draggable.** The reference shows meals "in the calendar's day grid" `[V](reviewed.com)` and toggles them from the Filter `[V]`, without saying where in the day. A meal has a date and a mealtime, never a clock time, so the all-day band — which Phase 2 built for exactly the no-time case — is its place, below all-day events, in mealtime order. Tokens open the meal's popover and never drag; the calendar's drag is events' alone, and a meal moves from Edit. Default on because the reference's is inferred on `[I]` and the point of the integration is seeing dinner on the wall. `[OURS]`
12. **"Just the recipe" hides the recipe rather than orphaning its meals; Profile deletion touches nothing.** With the reference's first delete choice the planned meals "remain on the Meal Plan" `[V]` — so the recipe must still be readable by them. It is marked removed: gone from the pane, un-plannable, still named and openable from the meals that reference it. The second choice cascades. Meals and recipes belong to the household; a deleted Profile's stay with attribution cleared, the way lists do; a Profile's dietary note is the Profile's and goes with it. `[OURS]`
13. **Long-press adds to a slot, as the reference does; its keyboard path is the popover's "Add another meal".** On the Tasks and Lists tabs a press-and-hold lifts a row for reorder; here nothing reorders, and the reference's long-press adds a second meal `[V]`. Both gestures are the same hold on different tabs, each doing the one documented thing for its tab. `[OURS]`
14. **Nothing is reserved for Phase 7.** No reminder time on a meal, no "cooked" tick, no home-screen field. `[OURS]`

Smaller calls are carried by the requirement that makes them and each states its reasoning inline: FR-603 (the fit rule), FR-610 (the name bound and uniqueness), FR-624 (slot order), FR-633 (the empty cases).

## Contradictions in the research, and how each is resolved

Four places where the research sources disagree with each other, or the research disagrees with this project's locked scope. Each is recorded with both readings and the resolution.

1. **What colour is Breakfast?** The live API seeds Breakfast Cyan `#A8D4D3`, Lunch Coral `#F66951`, Dinner Plum `#915EA1`, Snack Orange `#FDC36D` `[V](skylight-api)`; the marketing frame's rows sample as apricot, sky, lavender and pink `[V-photo]` (dossier 07 §1.6), and the same dossier reads the conflict as "colours are user-editable per frame" `[I]`. **Resolution**: seed the API's values, make every category recolourable from the palette, and treat the photograph as one household's choice. `[OURS 2026-09-06 #5]`
2. **Where do the meal visibility switches live, and how many are there?** The Meals tab's Categories menu `[V](26902149028379)`; Settings > "Show meals" with one switch per category `[V](36835449004315)`; the Calendar's Filter with a single "Show Meals" `[V](36625171368987)`; the phone's Show Meals with four `[V-photo]`. **Resolution**: the four category switches in the Meals tab's Categories sheet, governing grid and calendar; one Show Meals in the Filter sheet for the calendar; all per device. `[OURS 2026-09-06 #6]`
3. **A Recipes tab, or none?** The device has one `[V](43810243302811)`; the locked scope forbids one `[V](00-master-map §1)`. **Resolution**: the phone app's arrangement — a Recipes control inside Meals opening the library as a pane. The library's two panels are kept inside it. `[OURS 2026-09-06 #2]`
4. **What does "Just the recipe" leave behind?** Deleting only the recipe leaves its planned meals on the plan `[V](26902065343771)`; a planned meal is, in the API, a reference to a recipe `[V](skylight-api — `meal_recipe_id`)`. Read literally the two cannot both hold. **Resolution**: the recipe is marked removed and kept for the meals that reference it (Assumption 12).

One further disagreement is between the research and this project rather than within the research: the reference's per-meal "Update Recipe" toggle against a single recipe record (Assumption 9).

## Dependencies

- **Phase 1** (`001-family-foundation`, shipped): the household and its single account; punch-in PINs, the actor cookie and the roles (FR-013, FR-015, FR-016); the shell with its Meals tab placeholder (FR-029), the chip row flag, the Filter sheet and the create control (FR-032–FR-034); Profiles with their dietary notes (FR-024); the 20-colour palette and the tint ladder; the household's week-start setting; the live channel; the per-device preference pattern (FR-033).
- **Phase 2** (`002-family-week-calendar`, shipped): the Week grid and its all-day band (FR-206), the today anchor, marker and rollover (FR-203, FR-209, FR-210), the recurrence grammar, storage, expansion, exceptions and scopes (FR-231–FR-238), the household timezone (FR-284), the open write rule (FR-283), refuse-never-queue (FR-288), the withheld Show Meals toggle (FR-268).
- **Phase 3** (`003-family-tasks`, shipped): the board chassis — measured column fit and the pager (FR-394, FR-395); the details-sheet, form and write-surface patterns; the accessibility and reduced-motion rules (FR-397, FR-398).
- **Phase 4** (`004-family-rewards`, shipped): the second board on the chassis, the serialised-writes hook, the per-device switch store, the tenancy and no-client-write rules (FR-441, FR-442).
- **Phase 5** (`005-family-lists`, shipped): lists and their types (FR-509, FR-510), items and their bounds (FR-516, FR-517), Parents only lists (FR-514), the item queue and its attribution, the Filter sheet's Lists section, the per-device key set, and FR-545's promise that nothing was reserved.

Six shipped surfaces this phase **changes** rather than inherits: the Meals tab's placeholder (replaced, FR-601); the tab definition's chip-row flag (off, FR-606); the Filter sheet (a Show Meals switch, FR-635); the Week calendar's all-day band (meal tokens, FR-634); the live channel's table list (FR-643); and the household set-up that seeds a new household (four mealtimes, FR-608). Each is listed as work in the plan. One shipped surface is **used** rather than changed: the Lists tab's item write, called once per Add to List with many items (FR-632).

Research: `docs/research/skylight/03-lists-meals-recipes.md`, `05-mobile-app.md`, `01-calendar-tab-and-events.md`, `04-profiles-settings-access.md`, `06-api-and-data-model.md`, `07-visual-design-system.md`, `00-master-map.md`; the operator's delegation of 2026-09-05.

## Out of Scope

Deferred to a later phase of this project: **Phase 7**, `family-notifications`: reminders and Web Push, the home screen and its panes, search across tabs, the read-only offline cache and the service worker; **reordering the meals within a slot** (`[?]`, they keep planning order); **a "cooked" or "eaten" mark** on a meal (`[?]`, the reference has none); **copying a week's meals to another week** (`[?]`, dossier 03 — "leaning does not exist"; Repeats is the documented mechanism); **a per-meal copy of the recipe's text** and the "Update Recipe" toggle (Assumption 9); **a fifth mealtime** (Assumption 5); **an undo or a trash** for deleted meals and recipes (`[V]` — the reference has none).

Excluded from the project entirely: subscription tiers, of which this project has none; every Sidekick capture and generation — website, photo, voice, fridge-photo and email import of recipes `[V](39336437922843)`, "Plan Meals" and generated menus `[V](39336509179931)`, automatic emoji; **preloaded demo recipes** (`[V](reviewed.com — "basic and, honestly, not good")`); Instacart and any ordering; a separate Recipes navigation tab (the locked scope); the screensaver hold while a recipe is open (no screensaver exists here); the phone's home-screen widgets; external recipe apps and sync; and everything Phase 5 already excluded — weather, companion hardware, themed modes, guest invitations.
