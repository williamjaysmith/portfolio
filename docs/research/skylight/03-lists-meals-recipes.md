# Skylight Calendar — Lists Tab, Meals Tab & Recipes Tab (research draft)

Research as of 2026-08-28. Covers the Lists tab, Meals tab, and Recipes tab on the
Skylight Calendar device (Calendar 2 / Calendar Max) and companion mobile app, as of
2025–2026 software, for the purpose of building an identical clone web app.

Every fact is tagged `[VERIFIED](url)`, `[INFERRED]`, or `[UNKNOWN]`.

## 1. Lists Tab — Device Layout

- Lists are accessed via a "Lists" entry in the device's left navigation sidebar. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/37275069922971-The-Lists-Tab)
- Individual lists appear in a horizontally scrollable row of list cards/columns; swipe left/right to see additional lists beyond what fits on screen. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/37275069922971-The-Lists-Tab)
- Two default pre-made lists ship with the device: "Shopping" and "To-Dos". [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/37275069922971-The-Lists-Tab) A separate article (Manage Multiple Grocery Lists) refers to the grocery default simply as a "Grocery List" — naming/labels may have shifted across software versions; treat "Shopping" and "Grocery List" as referring to the same default grocery-type list. [INFERRED]
- Each list has a customizable pastel color, one color per list card. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/37275069922971-The-Lists-Tab)
- Home View (the device's main/overview screen) can also show a "Lists: To-Do Lists & Grocery Lists" tile alongside calendar and task tiles, i.e. lists surface outside the dedicated Lists tab too. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/48784194278683-Adjust-the-Display)
- List item rows: each item has a checkbox; tapping it checks the item off. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/37275069922971-The-Lists-Tab)
  - Checked/completed items display with "filled checkbox, in gray text, and with strikethrough." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/37275069922971-The-Lists-Tab)
  - A Filter control toggles whether completed items are shown/hidden ("Completed" visibility toggle). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/37275069922971-The-Lists-Tab)
  - In the mobile app specifically, a "Show Checked-off Items" control at the bottom of the list screen reveals previously crossed-out items after navigating away and back. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360041476692-How-do-you-use-the-grocery-list-in-the-mobile-app)
  - Items are **not** auto-deleted on check — they persist (grayed out, struck through) until manually cleared. A "Clear Completed" button removes all checked-off items from a list in one action. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/47603555960475--Feature-List-Improvements)[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/51482785426075--Feature-Calendar-Lists-Improvements)
  - Mobile app also allows outright deletion of an item (an "x" button) independent of checking it off. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360041476692-How-do-you-use-the-grocery-list-in-the-mobile-app)
- Adding items: an "Add item" textbox sits at the top of every list, or items can be added via the list's menu. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/37275069922971-The-Lists-Tab)
- Reordering items: long-press an item — space appears around it with a small orange pointer to the left — then drag to the new location. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/37275069922971-The-Lists-Tab) Drag-and-drop reordering of list items was also called out as a distinct 2026 feature-release item ("Reorder list items with drag and drop"). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/51482785426075--Feature-Calendar-Lists-Improvements)
- The "+"/Add control opens an "Add List" dialog with entry methods: type directly, or (Plus/Sidekick-gated) capture by photo or by voice. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/37275069922971-The-Lists-Tab)
- Editing a list: tap the list name or use the list's menu to change Title, List Type, or Color. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/37275069922971-The-Lists-Tab)
- List types: three categories are offered — "To do" (task-based lists), "Grocery" (grocery lists; default-named "Grocery List"), and "Other" (custom/general lists). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/37275069922971-The-Lists-Tab)
- Grocery-type lists show an "Instacart button" (Order) for direct-to-cart integration; this button and the Organize button only appear on Grocery-type lists. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/37275069922971-The-Lists-Tab)[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739335665051-Organize-with-Lists)
- **"Add section" count + chevron affordance**: not directly documented in any fetched article — [UNKNOWN]. What is confirmed is the underlying behavior (see Section 2).

## 2. Sections Within a List

- Sections break a large list into smaller, manageable groups. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739335665051-Organize-with-Lists)
- To add a section: open the list's menu, select "Add Section," type the section name, tap the checkmark. At least one item must exist/be added for the new section to actually be created — an empty section can't be created standalone. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739335665051-Organize-with-Lists)
  - If the chosen section name already exists, the selected items move into that existing section instead of creating a duplicate. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739335665051-Organize-with-Lists)
- Moving items between sections (mobile app): tap and hold a list item, drag it into a different section, release. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739335665051-Organize-with-Lists)
- Bulk move: select multiple items, then use a "Move" button to relocate them into an existing or new section. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739335665051-Organize-with-Lists)
- Sections can be removed when no longer needed. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/51482785426075--Feature-Calendar-Lists-Improvements)
- Sidekick's Magic Import can automatically sort imported items into sections when creating a list from a photo/voice/upload. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336282810779-Import-Lists)

## 3. Organize & Order buttons (Grocery lists only)

- **Organize button**: removes duplicate items and sorts the list. Wording differs slightly by article vintage — an earlier article says "sort your list by category," a March 2026 article says "sort your list by grocery aisle" — the sort key appears to have been upgraded from a generic category sort to an aisle-based sort over 2026. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739335665051-Organize-with-Lists)[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/47929314290203-Manage-Multiple-Grocery-Lists)
- **Order button**: transfers/adds the grocery list's items to an Instacart order; as of the March 2026 update this includes "ordering from Costco" (via Instacart's retailer options). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739335665051-Organize-with-Lists)[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/47929314290203-Manage-Multiple-Grocery-Lists)
- Both buttons are exclusive to Grocery-type lists; Order "will not work with any other kind of list." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39335191603867-Adding-Grocery-List-Items-to-Instacart)
- Skylight supports **multiple** grocery lists simultaneously (not just one default) — any list can be converted to Grocery type via the Mobile or Desktop App. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/47929314290203-Manage-Multiple-Grocery-Lists)

## 4. Instacart Integration — "Order Groceries with Instacart"

Requirements: Skylight Mobile App, Instacart App installed on the phone, US-only availability. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39335191603867-Adding-Grocery-List-Items-to-Instacart)

Flow (mobile app):
1. Open the Skylight Mobile App. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39335191603867-Adding-Grocery-List-Items-to-Instacart)
2. Tap "Lists". [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39335191603867-Adding-Grocery-List-Items-to-Instacart)
3. Select any Grocery List. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39335191603867-Adding-Grocery-List-Items-to-Instacart)
4. Tap the "Order" icon. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39335191603867-Adding-Grocery-List-Items-to-Instacart)
5. Tap "Get Ingredients". [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39335191603867-Adding-Grocery-List-Items-to-Instacart)
6. App copies items into a new Instacart order; a brief success screen appears; the Instacart app opens automatically. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39335191603867-Adding-Grocery-List-Items-to-Instacart)
7. User reviews the transferred order inside Instacart — "Specific items and quantities may not perfectly match what was on the Grocery List due to availability or how Instacart interprets the list" — then taps the green "Add items to cart" button in Instacart. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39335191603867-Adding-Grocery-List-Items-to-Instacart)

Note: one third-party review (Reviewed.com, Calendar 2 review) predates or missed this integration, complaining the grocery list "won't talk to other apps" and doesn't sync outside Skylight — likely written before/without noticing the Instacart feature, or referring to non-Instacart third-party sync. [VERIFIED, review context](https://www.reviewed.com/smarthome/content/skylight-calendar-2-review)

## 5. Creating a List (Device)

Older, likely-superseded device flow (no update date captured on this article): [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360033108051-How-do-I-create-a-list-on-my-Skylight-Calendar)
1. Tap the lists icon on the left sidebar.
2. Tap the dropdown box at the top next to the "X".
3. Tap "New List".
4. Name the list.
5. Tap the "X" to exit after adding items.

This older article does not mention color, emoji, or list-type fields — those are documented in the newer "The Lists Tab" article (Section 1: Title / List Type / Color, edited via list menu or by tapping the list name). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/37275069922971-The-Lists-Tab)

No **list-level** emoji field was found in any article — emoji appear to be a per-**item**, not per-list, concept, though the exact per-item auto-assignment algorithm (keyword-based lookup vs. AI) is not documented publicly. [UNKNOWN] One unrelated Skylight surface (Task/Chore items in the Tasks tab, and custom Labels) does expose a manual "tap Emoji to open the Emoji picker" affordance — it's possible list items work the same way (manual picker) rather than true auto-assignment, but this is not confirmed for list items specifically. [INFERRED, weak]

## 6. Lists in the Mobile App

- Navigate: select your calendar/device, then the Lists tab (icon described in an older article as "a rectangle with 3 horizontal lines"). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360041476692-How-do-you-use-the-grocery-list-in-the-mobile-app)
- Create a new list: "+ New List" control, then name the list. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360041476692-How-do-you-use-the-grocery-list-in-the-mobile-app)
- Item interactions: tap to cross an item out (complete); tap an "x" button to delete an item outright. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360041476692-How-do-you-use-the-grocery-list-in-the-mobile-app)
- "Show Checked-off Items" control at the bottom of the list screen reveals completed items after leaving/returning to the list. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/360041476692-How-do-you-use-the-grocery-list-in-the-mobile-app)
- "Hide on Device" — a per-list setting in the Mobile App that hides a given list from appearing on the household's Calendar device(s); example use case given: keeping gift-shopping or birthday-party-planning lists private/surprise. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/47603555960475--Feature-List-Improvements)
- The Lists screen shows each list with an item-count indicator ("X items"-style badge per list row) — this is referenced generically by search-engine synthesis of Skylight support content ("The Lists screen will display the available lists and item counts") but not yet confirmed via a directly quoted, single primary-source article/screenshot. [INFERRED — treat as very likely true given "5 items" is a standard list-row pattern, but not independently verified]
- "Create a new list with Sidekick" on mobile — confirmed button labels found across sources: "Photo" (with sub-options "Take Photo" and "Choose from Library"/"Add from library"), and "Talk into your Mic" (with "Start Recording"/"Stop Recording"), plus "Upload an Image" from the Sidekick menu. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336282810779-Import-Lists) The exact three-button row wording "Take Photo / Use Mic / Upload" as phrased in the task brief is a close paraphrase of these; treat "Take Photo," "Talk into your Mic" (or "Use Mic"), and "Upload an Image" as the closest verified equivalents. [VERIFIED, paraphrase-level]

## 7. Magic Import / Sidekick List Creation (Mobile App)

Requires Calendar Plus subscription. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336282810779-Import-Lists)

Flow:
1. From Sidekick, choose an import method: "Photo" (Take Photo or Choose from Library) or "Talk into your Mic" (Start Recording → speak items → Stop Recording), or "Upload an Image" from the Sidekick menu. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336282810779-Import-Lists)
2. Sidekick can automatically sort parsed items into sections. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336282810779-Import-Lists)
3. Review generated draft; each field has an edit button; user confirms with "Go to Lists" or edits first. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336282810779-Import-Lists)

(Out of scope to build the AI backend — described here for UI parity only, per task instructions.)

## 8. Meals Tab — Device Layout

- Grid layout: 7 columns (one per day of the week) by up to 4 rows (one per enabled meal category/period). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/41418036777371-The-Meals-Tab)[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739809442587-Using-the-Meal-Planner)
- Default categories: "Breakfast," "Lunch," "Dinner," and "Snack." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/41418036777371-The-Meals-Tab)[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739809442587-Using-the-Meal-Planner)
- Each category has its own fixed color, editable via a pencil/edit icon inside the "Mealtime Categories" dropdown (see Section 10). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/41418036777371-The-Meals-Tab)[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/26902149028379-Editing-Mealtime-Categories)
- Category visibility and rename controlled from a Filter/"Categories" menu with per-category toggle switches. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/41418036777371-The-Meals-Tab)
- Tapping a scheduled meal/recipe tile opens a pop-up ("meal detail popover") with: "Open Recipe" (jumps directly to that recipe's full card in the Recipes tab — added as a dedicated one-click feature, released/updated March 9–11 2026), "Add to List" (adds the recipe's ingredients to a Grocery List), "Edit," and "Delete." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/41418036777371-The-Meals-Tab)[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/47693297240347--Release-Go-From-Menu-To-Recipe-In-One-Click)
- Adding a meal: choose "From Recipes" (pick a saved recipe) or "New Entry." New Entry supports input methods "Type," "Website," "Photo," "Talk," or "Fridge" — the latter four require Sidekick/Plus. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/41418036777371-The-Meals-Tab)
- Calendar tab integration: meals appear in the Calendar tab's Schedule view, and — per third-party review and marketing copy — can be shown/hidden with a single toggle "across Week and Month views" too, not just Schedule. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/41418036777371-The-Meals-Tab)[VERIFIED, third-party](search-engine synthesis of skylight.zendesk.com results) A Reviewed.com review confirms meals rendering directly inside the calendar's day grid ("how meal plans appear in calendar view," dinners visible on the calendar grid). [VERIFIED](https://www.reviewed.com/smarthome/content/skylight-calendar-2-review)
- Week navigation controls and a "today" indicator on the Meals grid: existence is strongly implied (grid mirrors the Calendar tab's own week view, which has documented "today" affordances) but no article directly quotes the exact control labels/arrows for the Meals grid specifically. [UNKNOWN — inferred parity with Calendar tab, not independently confirmed for the Meals tab]

## 9. Using the Meal Planner (requires Calendar Plus)

- Meal Planner requires a Calendar Plus subscription. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739809442587-Using-the-Meal-Planner)
- Up to 4 customizable categories, default "Breakfast, Lunch, Dinner, and Snack"; each can be toggled on/off or renamed via the filter menu — reviewers describe this as choosing "all four, none, or just some" to display on the calendar. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739809442587-Using-the-Meal-Planner)[VERIFIED, third-party](https://www.reviewed.com/smarthome/content/skylight-calendar-2-review)
- Adding meals: select an existing recipe, type a new entry, submit a recipe website URL (Sidekick/Plus), photograph a handwritten/printed recipe (Sidekick), record a voice description (Sidekick), or use a fridge photo for recipe inspiration (Sidekick). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739809442587-Using-the-Meal-Planner)
- Long-press an existing recipe tile to add an additional recipe to the same meal slot — supports multiple recipes per meal/day/category. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739809442587-Using-the-Meal-Planner)[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/26901740297627-How-To-Create-A-Meal-Plan)
- Tap a recipe tile to edit meal-level details: date, category, notes. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739809442587-Using-the-Meal-Planner)
- Menu button on a meal lets you edit or delete the recipe from that meal slot. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739809442587-Using-the-Meal-Planner)
- **Repeating meals**: a "Repeats" toggle sets a recurring meal (marketing copy example: "Family Pizza Fridays"), with a configurable repeat interval and a stop/end condition ("select how often you would like the meal to repeat, and when you would like the repeat to stop"). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739809442587-Using-the-Meal-Planner)[VERIFIED](search-engine synthesis of skylight.zendesk.com content)[VERIFIED, marketing](https://myskylight.com/how-to-meal-plan-with-skylight-calendar-time-saving-tips-for-families/)
- **"Update Recipe" toggle**: when editing a meal's recipe content, toggling this saves the edits back to the underlying saved recipe for future reuse (otherwise the edit applies to that one meal instance only). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739809442587-Using-the-Meal-Planner)
- Deleting a recipe from a specific meal instance removes it only from that meal-plan slot, not from the saved Recipes library. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739809442587-Using-the-Meal-Planner)
- **Copying an entire week** of meals to another week: not documented in any Skylight help-center article, blog post, or third-party review found. [UNKNOWN — likely not a distinct named feature; repeating meals (per-item "Repeats" toggle) appears to be the supported mechanism for recurring weekly patterns rather than a bulk "duplicate week" action]

## 10. Editing Mealtime Categories

Steps: [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/26902149028379-Editing-Mealtime-Categories)
1. Tap the "Categories" button at the top of the Meals tab to open the "Mealtime Categories" dropdown.
2. Show/hide a mealtime by tapping the toggle button next to its name.
3. Tap the pencil icon next to any category to change its color or rename it; tap "Save" when finished.

The article does not confirm whether users can add wholly new categories beyond the default 4, or only show/hide/rename/recolor the existing 4 — all sourced descriptions consistently cap at "four meal categories," suggesting the category *set* itself (Breakfast/Lunch/Dinner/Snack) is fixed and only cosmetic/visibility edits are allowed. [INFERRED, consistent-but-not-explicit across multiple articles]

## 11. Editing Meals and Recipes

- Edit a meal: tap the meal's tile, tap "Edit." From there: change recipe details/ingredients, change meal category (Breakfast/Lunch/Dinner/Snack), change recurrence, or delete the meal from the schedule. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/26902065343771-Editing-Meals-and-Recipes)
- Edit/delete a saved recipe: tap the three-dot menu to the right of the recipe title in the Recipes library. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/26902065343771-Editing-Meals-and-Recipes)
- Deleting a recipe offers a choice: delete just the recipe (meals already planned with it remain on the Meal Plan), or delete "This recipe and planned meals" (removes it everywhere, including all upcoming scheduled meals). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/26902065343771-Editing-Meals-and-Recipes)[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44338446585115-Keep-Track-of-Recipes)
- Deleted recipes cannot be restored/undone. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44338446585115-Keep-Track-of-Recipes)

## 12. How to Create a Meal Plan (manual step flow)

Requires Calendar Plus subscription. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/26901740297627-How-To-Create-A-Meal-Plan)
1. Go to Meals in the sidebar, select the tile for the desired date/category.
2. Choose a pre-loaded meal or tap "Add Recipe," pick a Category, enter details in a Description field.
3. Tap "Add" — the recipe is saved into the Recipes library for reuse in future meal plans.
4. To add multiple meals to one slot: tap-and-hold the tile, select an additional meal.
5. To pick a meal from a different category for a given mealtime: tap the relevant tile, use the back control to browse other library categories, and select.

## 13. How to Add Ingredients to a Recipe (manual)

1. Open Skylight App → "Meals." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/26933067959963-How-To-Add-Ingredients-To-Recipes)
2. Tap the desired mealtime tile → "Add Recipe."
3. Enter the recipe title, tap "Description," paste/type ingredients and instructions together into that one field, tap "Add."
4. Recipe detail (including ingredients) is viewable by tapping the meal tile on either the mobile app or the device.

Ingredients and instructions appear to share a single free-text field ("Description," or "Instructions or ingredients" on the Recipes tab — see Section 14) rather than being two structured fields. This is consistent across two independent articles. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/26933067959963-How-To-Add-Ingredients-To-Recipes)[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/43810243302811-Using-the-Recipes-Tab)

## 14. Adding Recipe Ingredients to the Grocery/Shopping List

Four documented methods: [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/42181628465435-How-can-I-add-recipe-ingredients-to-the-shopping-list)

1. **From the meal grid**: Mobile App → Meals → tap an empty slot or long-press a filled slot → select a recipe → tap "Add to Grocery List" when prompted.
2. **Via the Add button**: Mobile App → Meals → Add button → choose a recipe → "Add to Grocery List."
3. **From Recipe details**: Mobile App → Recipes → select a recipe → tap "Add to Grocery List" button at the top.
4. **Via Sidekick Meal Planner**: an automatic option to add all planned ingredients to the grocery list is offered as part of the AI meal-planning flow (see Section 18 — "Add Ingredients to Grocery List" button).

Note: "It may take a moment for all of the ingredients in the recipe to appear in your Grocery List" across all methods. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/42181628465435-How-can-I-add-recipe-ingredients-to-the-shopping-list)

## 15. Recipes Tab — Device

- Purpose: a saved-recipe library. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/43810243302811-Using-the-Recipes-Tab)
- Layout: two-panel — left panel lists all recipes, right panel shows the selected recipe's detail. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/43810243302811-Using-the-Recipes-Tab)
- The device screensaver will not activate while a recipe is open/displayed (useful mid-cooking). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/43810243302811-Using-the-Recipes-Tab)
- Recipe fields: Name (entered via a "What Are We Eating?" textbox when creating), Category, and a combined "Instructions or ingredients" text field. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/43810243302811-Using-the-Recipes-Tab)
- Scheduling a recipe as a meal: tap "Plan Meal," set Date, Category, and optionally a "Repeats" toggle for recurrence. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/43810243302811-Using-the-Recipes-Tab)
- Optional "Add to Grocery List" step automatically imports the recipe's ingredients into a Grocery List at the point of scheduling. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/43810243302811-Using-the-Recipes-Tab)
- Importing recipes (5 methods, Sidekick/Plus gated except direct typing): Type; Website (URL, e.g. via a QR code that activates Sidekick on your phone); Photo (photograph a written/printed recipe); Talk (describe by voice); Fridge (photograph fridge contents for AI recipe suggestions). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/43810243302811-Using-the-Recipes-Tab)

## 16. Recipes in the Mobile App

- Requires Calendar Plus subscription to "view and manage all of your recipes." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44338446585115-Keep-Track-of-Recipes)
- Access via a "Recipe" icon which opens the recipe pane. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44338446585115-Keep-Track-of-Recipes)
- Organize by category filter buttons at the top of the recipe list, plus a keyword search box. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44338446585115-Keep-Track-of-Recipes)
- Recipe detail screen: title, category, full recipe text, plus action buttons. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44338446585115-Keep-Track-of-Recipes)
- Editable fields: Name (textbox), Category (single-select — "Recipes can only be in one category at a time"), and a combined "Instructions or ingredients" text field. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44338446585115-Keep-Track-of-Recipes)
- Meal-planning integration mirrors the device: "Plan Meal" button → Date, Category, Repeats toggle, optional "Add to Grocery List." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44338446585115-Keep-Track-of-Recipes)
- Edit/delete via a menu icon on the recipe detail pane; delete offers "remove from recipe list only" vs. "from the list and all upcoming meals"; deletions are not undoable. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44338446585115-Keep-Track-of-Recipes)
- A third-party review (Reviewed.com) notes preloaded/default recipes are minimal: "The recipes that come preloaded are basic and, honestly, not good. They're fine as a demo of the feature, but the real value is in importing your own." [VERIFIED, third-party opinion](https://www.reviewed.com/smarthome/content/skylight-calendar-2-review)

## 17. Importing Recipes — Detail (Sidekick)

Requires Calendar Plus. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336437922843-Import-Recipes)

- **Website import**: "Paste a URL" of a copied recipe link, or "Find Online" to browse and send a page to Sidekick; both let you edit title/category/notes before saving. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336437922843-Import-Recipes)
- **Photo import**: take a new photo or choose from your camera library; "Photo import only works with one photo per recipe" (cannot combine multiple photos into one recipe — contrast with Fridge Photo, Section 19, which allows up to 5 photos for ingredient recognition). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336437922843-Import-Recipes)
- **Voice recording**: tap "Start Recording," describe title/ingredients/steps aloud; app processes and shows a draft for confirmation. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336437922843-Import-Recipes)
- **Email import**: send a recipe to the device's dedicated email address (see Section 20 for full format/detail); supports full recipe text pasted into the email body, a recipe URL, or a recipe image (.png/.jpeg attachment); "Only use one text recipe per email." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336437922843-Import-Recipes)
- **Fridge photo**: separate flow for ingredient/recipe suggestions from a photo of fridge contents (Section 19). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336437922843-Import-Recipes)
- After any import method, user can edit the draft (tap fields to change title/category/notes) then "Save to Recipes." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336437922843-Import-Recipes)

## 18. Sidekick "Plan Meals" — Full AI Meal-Planning Flow

Requires Calendar Plus subscription throughout. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336509179931-Meal-Planning)

Step-by-step, as documented:
1. Tap "Sidekick," then tap "Plan Meals." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336509179931-Meal-Planning)
2. Select the meal type: one of "Breakfast," "Lunch," "Dinner," or "Snack." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336509179931-Meal-Planning)
3. Enter free-text preferences in a "What sounds good?" textbox — examples given: "No dairy, we need to use up the peppers, Mexican?" and "Let's try some Thai food. Make it spicy!" [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336509179931-Meal-Planning)
4. Choose which day(s) to plan for by tapping one or more buttons under "Which days this week?" [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336509179931-Meal-Planning)
5. Set serving size with a slider for 1–12 people, under "How many mouths to feed?" [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336509179931-Meal-Planning)
6. Choose the recipe source — three explicit options: [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336509179931-Meal-Planning)
   - **"Only my existing recipes"** — find recipes in the Recipe Box that match requirements.
   - **"Generate new recipes"** — use requirements to generate a new recipe with AI.
   - **"Both new and existing recipes"** — search existing and generated recipes together.
7. Review/edit the generated recipes before finalizing. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336509179931-Meal-Planning)
8. Optionally tap "Add Ingredients to Grocery List" to push all resulting ingredients into the grocery list at once. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39336509179931-Meal-Planning)
9. Finalized meals are "automatically added to your Calendar." [VERIFIED](search-engine synthesis of skylight.zendesk.com content)
10. Any meal created this way can still use the standard "Repeats" toggle to recur, with a chosen frequency and a stop condition. [VERIFIED](search-engine synthesis of skylight.zendesk.com content)

(Not building the AI backend — captured for UI/flow parity only, per task scope.)

## 19. Sidekick "Fridge Photo" (recipe-from-ingredients)

Requires Calendar Plus subscription. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/43147348740123-Fridge-Photo)

1. Select "Sidekick" → "Fridge Photo."
2. Choose the recipe type (one type at a time).
3. Add up to **five photos** of fridge/pantry contents — "Take a Photo" or "Add from library" — Sidekick recognizes ingredients from the photos to inform the recipe.
4. Enter servings under "How Many People?" — via arrow-key increment/decrement or direct text entry.
5. Optionally tap suggested preference keywords to guide the recipe; selected keywords render "brighter, with a thin black outline."
6. Optionally fill in "Anything else?" with free text — examples given: "Food allergies," "A preferred cuisine," "Ingredients you have on hand."
7. Tap "Create."

All steps [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/43147348740123-Fridge-Photo).

## 20. Sidekick — Emailing Recipes/Menus In

Requires Calendar Plus. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/47278643288091-Email-Events-Recipes-Menus-and-Photos-With-Sidekick)

- Device email address format: `<device-name>@ourskylight.com`. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/47278643288091-Email-Events-Recipes-Menus-and-Photos-With-Sidekick)
- Supported content in the email: an event description, recipe, or menu as body text; one or more recipe URLs in the body; one or more PDF attachments of events/menus; one or more image attachments (events, recipes, menus, photos); a zip file of recipe/photo images; attached spreadsheet files of events/menus. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/47278643288091-Email-Events-Recipes-Menus-and-Photos-With-Sidekick)
- Menus can be tagged to specific family members by listing names, comma-separated, in the email subject line — imported meals then display with those names prepended, e.g. "Emma, Jake: Grilled Cheese & Chicken Tenders." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/47278643288091-Email-Events-Recipes-Menus-and-Photos-With-Sidekick)
- After import, Sidekick sends a confirmation email; users can remove incorrect items via a trash icon next to each, or tap "Undo Import" to revert the whole batch. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/47278643288091-Email-Events-Recipes-Menus-and-Photos-With-Sidekick)

## 21. "Where is the Recipe Box?" (naming history)

- The old "Recipe Box" feature has been renamed/replaced by "Recipes" — described as "an improved and expanded version of the Recipe Box." [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44968259875099-Where-is-the-Recipe-Box)
- On the Calendar device: "Recipes" tab in the nav bar. In the Mobile/Desktop App: "Recipes" icon. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44968259875099-Where-is-the-Recipe-Box)
- Several other, apparently older, articles (Sections 12, 13, 18) still say "Recipe Box" — legacy terminology from articles not yet fully updated to "Recipes." Treat "Recipe Box" and "Recipes" (tab/library) as the same underlying feature across two naming eras of Skylight's docs. [INFERRED]

## 22. Feature-Release Notes (Lists & Meals)

- **[Feature] Calendar Lists Improvements** (device), updated June 9 2026: drag-and-drop item reordering; one-step "Clear Completed" bulk action; ability to remove list sections. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/51482785426075--Feature-Calendar-Lists-Improvements)
- **[Feature] List Improvements** (mobile app), published Feb 24 2026 / updated Mar 9 2026: "Hide on Device" per-list visibility setting; "Clear Completed" button. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/47603555960475--Feature-List-Improvements)
- **Manage Multiple Grocery Lists**, updated Mar 17 2026: multiple grocery lists now supported; any list can be made Grocery-type; Organize sorts "by grocery aisle" (up from "by category"); Order supports Costco via Instacart. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/47929314290203-Manage-Multiple-Grocery-Lists)
- **[Release] Go From Menu To Recipe In One Click**, released Mar 9 2026 / updated Mar 11 2026: adds an "Open Recipe" button to the meal detail pop-up on the Meals tab so users can jump straight from a scheduled meal to its full recipe card — aimed at people keeping the calendar visible while cooking. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/47693297240347--Release-Go-From-Menu-To-Recipe-In-One-Click)

## 23. Plus-Gated Features Summary

Per Skylight's own subscription FAQ, exact breakdown: [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36009559376795-Does-Skylight-Calendar-require-a-subscription)

**Free / no subscription required:**
- "Add, update, and remove events from your local calendar"
- "Sync online calendar events to your local calendar"
- "Keep track of chores and routines that happen at regular times"
- "Make and share lists" — **Lists (device + mobile) are confirmed free**, including basic list creation/editing, checking off items, sections, and (per Section 3/4) the Organize and Order/Instacart buttons, none of which are called out as Plus-only anywhere. [VERIFIED]

**Requires paid Plus (Calendar Plus) subscription:**
- "Track and award rewards for completing chores" (Rewards tab — out of this doc's scope)
- **"Plan meals, with recipes"** — i.e. Meal Planner/Meals tab meal-planning functionality and the Recipes tab/library as a whole. [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36009559376795-Does-Skylight-Calendar-require-a-subscription)[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739809442587-Using-the-Meal-Planner)[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44338446585115-Keep-Track-of-Recipes)
- "Upload and automatically scan events, recipes and more with Sidekick" — all Sidekick AI-assisted capture (photo/voice/URL/email import for Lists, Recipes, Meal planning, Fridge Photo). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36009559376795-Does-Skylight-Calendar-require-a-subscription)[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39335273393947-Sidekick)
- "Use your calendar to show pictures and videos" (Frame/photo features — out of scope)

Net effect for this clone's scope: **Lists tab = fully free-tier**; **Meals tab and Recipes tab = entirely Plus-gated**, including manual/non-AI meal creation (the "How To Create A Meal Plan" and "Using the Meal Planner" articles both explicitly state the Plus requirement even for manual flows, not just the Sidekick/AI parts). [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/26901740297627-How-To-Create-A-Meal-Plan)[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/44739809442587-Using-the-Meal-Planner)

## 24. Third-Party Review Corroboration

- **Reviewed.com** (Calendar 2 review): meal planner lets you "map out breakfast, lunch, dinner, and snack for the week" and choose "all four, none, or just some" to show on the calendar; a screenshot shows meals rendered directly in calendar day-grid view; preloaded recipes called "basic... not good," real value in importing your own; Sidekick can auto-generate a recipe and "dropped it into my meal plan for Wednesday dinner automatically." [VERIFIED](https://www.reviewed.com/smarthome/content/skylight-calendar-2-review)
- **Reviewed.com** (parenting/family review): grocery list "syncs with the Skylight app," a "2023 upgrade" (per this review) expanded lists to "create and customize just about any list you can imagine, including to-do lists, shopping lists, reminder lists, and more"; meal plan can be filled out from the device or from the phone app and populates to the Calendar. [VERIFIED](https://www.reviewed.com/parenting/content/skylight-calendar-review-perfect-busy-families)
- **Cubby (cubbyathome.com)**: describes Custom Lists as a free feature for "writing out to-dos, grocery lists, and more"; describes the Plus-gated "Meal planning & recipes tool, with AI-generated menus, ingredient lists, and grocery export"; does not give granular UI detail beyond that. [VERIFIED](https://www.cubbyathome.com/skylight-calendar-review-80042154)
- **Bless'er House**, **Taste of Home**: could not be fetched directly (HTTP 403 on all attempts, including one retry each per the research rules); only search-engine-snippet-level content was recoverable for these two, already folded into the notes above. [UNKNOWN — full article content inaccessible]
- **myskylight.com** meal-planner landing page: "Skylight helps you effortlessly plan meals for the week and generates a shopping list in seconds"; "Upload handwritten recipes or dinner ideas and digitize them into your calendar"; grocery list "creates... based on your meal plan." [VERIFIED](https://myskylight.com/lp/meal-planner/)
- **myskylight.com** "How to Meal Plan" blog post: reiterates the 7-day grid, Recipe Box reuse flow, repeating meals ("Family Pizza Fridays"), and gives the fullest available description of the Sidekick "Plan Meals" flow (category → preferences like "no cilantro"/"dairy-free" → party size → days needed → recipe-source choice → auto-added to Calendar → ingredient syncing). [VERIFIED](https://myskylight.com/how-to-meal-plan-with-skylight-calendar-time-saving-tips-for-families/)

## Open questions

Resolved during research (kept here for traceability, now answered in the body above):
- Whether checking a list item auto-deletes it — **No**; it's grayed + struck-through until manually cleared via "Clear Completed." (Section 1)
- Whether Lists are free or Plus-gated — **Free** ("Make and share lists" is listed under no-subscription features). Meals and Recipes are **fully Plus-gated**, including manual (non-AI) flows. (Section 23)
- Whether Sidekick meal planning lets you choose the recipe source — **Yes**, three explicit radio-style options: "Only my existing recipes," "Generate new recipes," "Both new and existing recipes." (Section 18)

Still open / unresolved:
- Exact per-**item** auto-emoji-assignment mechanism for list items (keyword→emoji mapping vs. AI vs. manual picker) — [UNKNOWN].
- Exact "Add section" control affordance on the device: does it show a count + chevron as described in the task brief? Not directly confirmed by any fetched source. [UNKNOWN]
- Item-level fields: does a list item support quantity, notes, or an assignee field, or just free-text name? No article describes anything beyond a name/text string per item. [UNKNOWN, leaning "name only"]
- Exact wording/placement of item-count badges ("5 items") on the mobile Lists screen — inferred as very likely true (standard pattern, referenced generically in search synthesis) but not confirmed via a directly quoted primary source or screenshot. [UNKNOWN, low-confidence-yes]
- Whether meals render on the Calendar tab's Month/Week grid views identically to Schedule view, and exactly how (mini emoji+text token vs. colored dot) — Month/Week toggle existence is fairly well corroborated, exact rendering token is not. [UNKNOWN in detail]
- Exact week-navigation control labels and whether a "today" badge exists on the Meals grid specifically (vs. just inferred from Calendar tab parity). [UNKNOWN]
- Whether a bulk "copy this week's meals to another week" feature exists — no source found; "Repeats" toggle on individual meals appears to be the only supported recurrence mechanism. [UNKNOWN, leaning "does not exist as a separate feature"]
- Could not access "How do you add a Dinner Plan through the mobile app?" (https://skylight.zendesk.com/hc/en-us/articles/360048559211) — returned a login wall on both fetch attempts; likely a legacy or de-listed article.
- Could not fetch full article text for Bless'er House or Taste of Home reviews (HTTP 403, retried once each per rules) — only snippet-level content recovered via search.
- Whether adding wholly new mealtime categories (beyond the fixed 4) is possible, vs. only show/hide/rename/recolor of the existing 4. [UNKNOWN, leaning "fixed at 4"]

## Sources

Skylight help center (primary):
- https://skylight.zendesk.com/hc/en-us (help center home)
- https://skylight.zendesk.com/hc/en-us/articles/37275069922971-The-Lists-Tab
- https://skylight.zendesk.com/hc/en-us/articles/39336282810779-Import-Lists
- https://skylight.zendesk.com/hc/en-us/articles/44739335665051-Organize-with-Lists
- https://skylight.zendesk.com/hc/en-us/articles/47929314290203-Manage-Multiple-Grocery-Lists
- https://skylight.zendesk.com/hc/en-us/articles/360033108051-How-do-I-create-a-list-on-my-Skylight-Calendar
- https://skylight.zendesk.com/hc/en-us/sections/8328029530523-Custom-Lists
- https://skylight.zendesk.com/hc/en-us/articles/51482785426075--Feature-Calendar-Lists-Improvements
- https://skylight.zendesk.com/hc/en-us/articles/47603555960475--Feature-List-Improvements
- https://skylight.zendesk.com/hc/en-us/articles/39335191603867-Adding-Grocery-List-Items-to-Instacart
- https://skylight.zendesk.com/hc/en-us/articles/360041476692-How-do-you-use-the-grocery-list-in-the-mobile-app
- https://skylight.zendesk.com/hc/en-us/articles/41418036777371-The-Meals-Tab
- https://skylight.zendesk.com/hc/en-us/articles/44739809442587-Using-the-Meal-Planner
- https://skylight.zendesk.com/hc/en-us/articles/26901740297627-How-To-Create-A-Meal-Plan
- https://skylight.zendesk.com/hc/en-us/articles/26902065343771-Editing-Meals-and-Recipes
- https://skylight.zendesk.com/hc/en-us/articles/26902149028379-Editing-Mealtime-Categories
- https://skylight.zendesk.com/hc/en-us/articles/43810243302811-Using-the-Recipes-Tab
- https://skylight.zendesk.com/hc/en-us/articles/44338446585115-Keep-Track-of-Recipes
- https://skylight.zendesk.com/hc/en-us/articles/26933067959963-How-To-Add-Ingredients-To-Recipes
- https://skylight.zendesk.com/hc/en-us/articles/42181628465435-How-can-I-add-recipe-ingredients-to-the-shopping-list
- https://skylight.zendesk.com/hc/en-us/articles/39336437922843-Import-Recipes
- https://skylight.zendesk.com/hc/en-us/articles/44968259875099-Where-is-the-Recipe-Box
- https://skylight.zendesk.com/hc/en-us/articles/39335273393947-Sidekick
- https://skylight.zendesk.com/hc/en-us/articles/39336509179931-Meal-Planning
- https://skylight.zendesk.com/hc/en-us/articles/43147348740123-Fridge-Photo
- https://skylight.zendesk.com/hc/en-us/articles/47278643288091-Email-Events-Recipes-Menus-and-Photos-With-Sidekick
- https://skylight.zendesk.com/hc/en-us/articles/47693297240347--Release-Go-From-Menu-To-Recipe-In-One-Click
- https://skylight.zendesk.com/hc/en-us/sections/26901713892507-Meal-Planning
- https://skylight.zendesk.com/hc/en-us/articles/36835449004315-Calendar-Settings
- https://skylight.zendesk.com/hc/en-us/articles/36009559376795-Does-Skylight-Calendar-require-a-subscription
- https://skylight.zendesk.com/hc/en-us/articles/48784194278683-Adjust-the-Display
- https://skylight.zendesk.com/hc/en-us/articles/45664471763995-App-Settings
- https://skylight.zendesk.com/hc/en-us/articles/45795554249371-Settings
- https://skylight.zendesk.com/hc/en-us/articles/360048559211-How-do-you-add-a-Dinner-Plan-through-the-mobile-app- (inaccessible — login wall on 2 attempts)

myskylight.com:
- https://myskylight.com/lp/meal-planner/
- https://myskylight.com/how-to-meal-plan-with-skylight-calendar-time-saving-tips-for-families/

Third-party reviews:
- https://www.reviewed.com/smarthome/content/skylight-calendar-2-review
- https://www.reviewed.com/parenting/content/skylight-calendar-review-perfect-busy-families
- https://www.cubbyathome.com/skylight-calendar-review-80042154
- https://www.blesserhouse.com/our-family-tried-the-skylight-calendar-heres-what-we-loved-didnt/ (HTTP 403, snippet-only via search)
- https://www.tasteofhome.com/article/skylight-calendar-review/ (HTTP 403, snippet-only via search)

Not accessible / not usable:
- cnet.com (blocked from WebSearch tool's allowed-domains for this session)
- https://roadmap.ourskylight.com/484b83eda396400899300f233e692ff0 (Notion-embedded roadmap; rendered as empty shell, no content retrievable)
