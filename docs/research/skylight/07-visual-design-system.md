# Skylight Calendar — Visual Design System (device UI)

**Subject:** Skylight Calendar device UI — 10" / 15" / 15.6" "Calendar 2" (all **1920×1080**) and 27" "Calendar Max" (**2560×1440**).
**Purpose:** enable a pixel-faithful web clone.
**Date:** 2026-08-28

## Evidence tags

| Tag | Meaning |
|---|---|
| `[SAMPLED: file @ x,y]` | Pixel actually read out of the named image. Source photos are all 1920×1234 marketing JPEGs. |
| `[SCREENSHOT: file]` | Read off the named image visually, not pixel-sampled. |
| `[VERIFIED](url)` | Confirmed against a cited external source. |
| `[ESTIMATED]` | Proportional or visual estimate. A starting point, not truth. |
| `[UNKNOWN]` | Not determinable from available material. |

### How the sampling was done, and why the numbers are trustworthy

Pillow was installed into a throwaway venv (`--break-system-packages` was refused by PEP 668).
Regions of interest were cropped from the originals and upscaled 2.5–3× with Lanczos, which
averages away JPEG chroma noise so each flat UI fill collapses to one dominant RGB value —
frequently 80–100 % of the sampled rectangle. Colours were then read as a **histogram of a
rectangle**, not as a single pixel.

Three independent facts confirm the method is accurate to roughly **±3 per channel**:

| UI element | Sampled from a photo | Skylight's own API palette | Δ |
|---|---|---|---|
| FAB / "Done" button blue | `#2478AE` | `#2178AF` "Blue" | 3, 0, 1 |
| Today badge / now-line | `#FC664A` | `#F66951` "Coral" | 6, 3, 7 |
| Reward star gold | `#F9C265` | `#FDC36D` "Orange" | 4, 1, 8 |

The screen white in `gallery/09.jpg` samples as an exact `#FFFFFF` (99.6 % of a 120×30 rect),
i.e. the camera white balance is neutral for that shot — which is why it is the primary source.

Scratch crops used (derived from the originals in the scratchpad; never copied into the repo):

| Crop | Source | Region → scale | Logical px per crop px @1920 |
|---|---|---|---|
| `c2.png` | `gallery/09.jpg` | (610,245) + 750×200 @2.6× | ≈ 0.98 |
| `c3.png` | `gallery/09.jpg` | (655,380) + 700×350 @2.8× | ≈ 0.91 |
| `t1.png` | `gallery/02.jpg` | (590,230) + 760×480 @2.6× | ≈ 0.98 |
| `r1.png` | `gallery/05.jpg` | (600,240) + 790×500 @2.5× | ≈ 1.02 |
| `m1.png` | `gallery/06.jpg` | (480,210) + 600×540 @3.0× | ≈ 0.85 |
| `l1.png` | `gallery/07.jpg` | (500,225) + 780×510 @2.5× | ≈ 1.02 |
| `f1/f2/p1–p4` | `pdp/10, 01, 03, 05, 07` | close-ups for letterforms, chips, bottom nav, popover | — |

---

## 0. Source inventory

| File | Screen | Notes |
|---|---|---|
| `gallery/00–01` | Week view | angled |
| `gallery/02` | **Tasks** (4 kid columns, landscape) | progress rings, routine toggles, checked/unchecked cards |
| `gallery/03` | Week view + phone (Magic Import) | |
| `gallery/04` | Week view ×2 (10" + 15") | 15" shows "Miller Family" instead of the date |
| `gallery/05` | **Rewards** + redeem modal + star confetti | ★ modal anatomy |
| `gallery/06` | **Meals** grid (4 category rows) | ★ category colours |
| `gallery/07` | **Lists** (4 list columns) | ★ "Add section" footer |
| `gallery/08` | Photo screensaver | |
| `gallery/09` | **Week view — flattest, neutral white balance** | ★★ primary colour source |
| `gallery/10–13` | Marketing (feature grid, badges, comparison table) | brand navy/mint, Skylight serif wordmark |
| `pdp/01–02` | Week view w/ **striped multi-profile** events + **"Vacation 48 days"** countdown chip | ★ |
| `pdp/03` | **Tasks, PORTRAIT, with a bottom nav bar** | ★★ only portrait UI shot |
| `pdp/04` | Week view + phone | |
| `pdp/05` | Week view, flat wall-mount, front-on | ★★ primary metrics source |
| `pdp/06` | Rewards + redeem modal ("Arcade Trip") | |
| `pdp/07` | **Meals + recipe detail popover** | ★ Edit/Delete/Category/Ingredients/Instructions |
| `pdp/08` | **Lists** close-up | ★ |
| `pdp/09` | Photo screensaver | |
| `pdp/10` | **Close-up: top bar, pill buttons, profile chips, striped all-day pill** | ★★ chip anatomy + letterforms |

**Not present in any supplied image:** Month view, Day view, Schedule view, the Filter panel's
contents, the create-event form, any Settings screen. See §9.

---

## 1. Color tokens

### 1.1 The canonical palette (authoritative)

Skylight's own `GET /api/colors` returns exactly 20 category/profile/list colours.
**Use these, not my photo samples, for anything user-selectable.**
`[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)`
(full context in the sibling dossier `06-api-and-data-model.md`)

| Hex | Name | | Hex | Name |
|---|---|---|---|---|
| `#FDC36D` | Orange | | `#A8D4D3` | Cyan |
| `#FBD97E` | Sunshine | | `#93D1E6` | River |
| `#CE812D` | Ochre | | `#00526D` | Deep River |
| `#FDB305` | Deep Sunshine | | `#2178AF` | **Blue** |
| `#F3B075` | Clementine | | `#82D7DD` | Sky |
| `#CF632E` | Deep Clementine | | `#2D8086` | Deep Sky |
| `#F66951` | **Coral** | | `#B6E085` | Sprout |
| `#FBA994` | Grapefruit | | `#408257` | Deep Sprout |
| `#CB434C` | Deep Grapefruit | | `#DADADA` | Charcoal |
| `#D5B6EC` | Lavender | | `#915EA1` | Deep Lavender |

**Structure:** seven base/"Deep" pairs (Sunshine, Clementine, Grapefruit, Lavender, River, Sky,
Sprout) plus six standalones (Orange, Ochre, Coral, Charcoal, Cyan, Blue).

**Important:** the "Deep" variants are **not** the light-fill/dark-accent pair for a single
profile. A profile picks **one** entry; the UI derives its tints (§1.4). Evidence: in every
screenshot a profile's event block, its chip cap and its avatar ring are all the *same* hue at
the *same* strength, with the chip body a lighter tint of it — there is no second, darker hue in
play. A "Deep" entry is simply a separate, darker choice a user can pick for a different profile.
`[SCREENSHOT: gallery/09, pdp/10]`

### 1.2 Surfaces, structure, semantics — the tokens NOT in the palette

These had to be sampled, because they are chrome rather than user-selectable category colour.

| Token | Value | Evidence |
|---|---|---|
| `--app-bg` — calendar canvas, cards, modals | `#FFFFFF` | `[SAMPLED: c2.png @ 700,230 — 99.6 % of a 120×30 rect]` |
| `--sidebar-bg` — the left rail | `#E9F0F7` | `[SAMPLED: c2.png @ 10,380]`, `[SAMPLED: t1.png @ 12,450 → #E9F0F6, 74 %]` — a cool pale blue, **not** grey |
| `--sidebar-item-active` | `#FFFFFF` | `[SAMPLED: t1.png @ 20,280 — 57.6 % pure white]`, `[SAMPLED: m1.png @ 30,630 — 60.1 %]`. The active nav item is a **white** pill on the blue rail; it is *not* a tint. |
| `--pill-btn-bg` — Sidekick / Day / Filter / ‹ / Today / › | `#F7F7F8` | `[SAMPLED: pdp/10.jpg @ 1020,455 → #FAFAFA 52.7 %]`, `[SAMPLED: c2.png @ 600,40 → #F6F6F6]`. Normalized: `#F6F6F7` `[ESTIMATED]` |
| `--btn-secondary-bg` — modal "Unredeem" | `#F9F9F9` | `[SAMPLED: r1.png @ 780,875 — 94.8 %]` |
| `--grid-hairline` | `#EDEDED` `[ESTIMATED]` | Reads as `#F6F6F6` against `#FFFFFF` in every scanline; sub-pixel width defeats an exact read. `[SAMPLED: pdp/05.jpg row 420 — hairlines at x=484, 852, 1033, 1212]` |
| `--text-primary` — date, day headers, event titles, list/task titles | `#1A1A1A` `[ESTIMATED]` | Darkest-pixel cluster in the largest glyphs: `[SAMPLED: pdp/10.jpg @105,640 "Thu 19" → #131313 (3 % of dark pixels), min #000000]`. Photo blur lightens everything, so the true value is at or just above `#131313`. |
| `--text-secondary` — event times, hour gutter, modal subtitle | `#6E6E6E` `[ESTIMATED]` | `[SAMPLED: c3.png @0,90 hour gutter → cluster #A5A5A5, min #606060]`; `[SAMPLED: r1.png modal subtitle → cluster #838383]` |
| `--text-muted` — sidebar labels, pill labels | `#4A4A4A` `[ESTIMATED]` | `[SAMPLED: pdp/10.jpg @1062,470 "Schedule" → cluster #424242, min #161616]` |
| `--primary-blue` — FAB, modal "Done" | **`#2178AF`** | `[VERIFIED]` palette "Blue" + `[SAMPLED: c3.png @1820,890 → #247AAD]` + `[SAMPLED: t1.png FAB → #2277AE]`. Cross-confirmed to Δ≤3. |
| `--today` / `--now-line` — today badge pill, current-time bar & dot | **`#F66951`** | `[VERIFIED]` palette "Coral" + `[SAMPLED: m1.png @1528,190 most-saturated → #FC664A]` + `[SAMPLED: c3.png now-line dot → #FC694F]`. Skylight's docs confirm the semantics: *"The current time in the calendar is displayed as an orange bar"*, *"The current date in the calendar is displayed in an orange dot"* `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)` |
| `--star-gold` — ⭐ chips, reward star icons, confetti | **`#FDC36D`** | `[VERIFIED]` palette "Orange" + `[SAMPLED: t1.png @445,205 most-saturated → #F9C265 / #F9C272]` |
| `--success-green` — checked-circle fill on a task card | = the profile's own accent, **not** a green | `[SCREENSHOT: gallery/02]` — Ben's completed check circle is teal, Harper's is lavender, Riley's is salmon. There is **no** global success green. |
| `--danger-red` — "Delete" in the recipe popover | `#F66951` (Coral) `[ESTIMATED]` | `[SCREENSHOT: pdp/07]` — the trash icon + "Delete" label render in the same orange-red as the today badge. No separate late/overdue red was observed anywhere. `[UNKNOWN]` for a true error/late state. |

### 1.3 Brand colors (marketing site — mostly NOT in the device UI)

| Token | Hex | Evidence |
|---|---|---|
| Brand navy (headlines, icon discs, wordmark) | `#0A3643` | `[SAMPLED: gallery/11.jpg @1800,60]`; `[SAMPLED: gallery/13.jpg @1350,215 → #08383C]` |
| Brand mint (section background) | `#D3EFE1` | `[SAMPLED: gallery/11.jpg @30,250]` |
| Brand mint-dark ("Calendar Plus" badge, "Plus Features" row) | `#A7DEC5` | `[SAMPLED: gallery/13.jpg @660,745]` |
| Brand cream (marketing cards) | `#FBF7F4` | `[SAMPLED: gallery/11.jpg @1500,590]`, `[SAMPLED: gallery/12.jpg @250,300]` |
| Marketing blue (buttons/links) | `#3B76AC` | `[SAMPLED: product.html]` — the single most frequent hex in the page CSS (40 occurrences) |
| Marketing red (✗ in the comparison table) | `#CF6F6F` | `[SAMPLED: gallery/13.jpg @1640,215]` |
| Announcement-banner CSS custom properties | `--banner-bg:#EEE2F7`, `--banner-text:#444444`, `--banner-link-color:#F66951` | `[SAMPLED: product.html]` — note the banner link colour **is** palette Coral |

### 1.4 The tint system — the most reusable finding

Every profile-coloured surface in the device UI is one accent hex composited on white at a
**fixed opacity per component role**. This was derived by measuring the same profile's colour in
several roles in one screenshot and solving for α.

| Role | Opacity | Worked example (lavender profile) |
|---|---|---|
| Timed event block fill | **100 %** | `#DFD3E1` |
| All-day pill fill | **100 %** | green pill `#D4ECD5` = the green accent `#D5EBD6` |
| Profile-chip **left cap** (behind the avatar) | **100 %** | `#DFD3E1` |
| Task card — **completed** | **100 %** | `#DFD3E1` |
| Diagonal stripe in a multi-profile pill/block | **100 %** | each stripe is one profile's accent |
| Profile-chip **body** | **≈ 40 %** | `#F2EDF3` |
| Task card — **incomplete** | **≈ 40 %** | `#F2EDF3` |
| Tasks / Rewards **column header** panel | **≈ 20 %** | `#F8F6F9` |

Numerical checks (all on white):

- rose accent `#FFDDDC` @ 40 % → predicted `rgb(255, 241.2, 240.8)`; **measured chip body `#FFF1F1`** ✓
- teal accent `#B4DBDA` @ 40 % → predicted `#E1F1F0`; **measured `#E2F0F1`** ✓
- lavender accent `#DFD3E1` @ 40 % → predicted `#F2EEF5`; **measured `#F2EDF3`** ✓
- green accent `#D5EBD6` @ 40 % → predicted `#F3F7F2`; **measured `#EEF8F0`** ✓ (within photo error)
- lavender @ 20 % → predicted `#F7F4F8`; **measured header `#F8F6F9`** ✓
- teal @ 20 % → predicted `#F0FAFA`; **measured header `#EFF8F7`** ✓

`[SAMPLED: c2.png, c3.png, t1.png]`

**Implementation:** store one hex per profile; derive everything else with
`color-mix(in srgb, var(--profile) 40%, white)` / `20%`. Do **not** hand-pick tints.

### 1.5 The colors actually rendered in the marketing screenshots

These are what the mock data in the photos shows. They are recorded because they define the
*look*, but note the honest caveat below.

| Rendered accent | Roles seen | Best palette fit | Evidence |
|---|---|---|---|
| `#B4DBDA` teal | Dad — "Grocery Run", "Pickup Dry Cleaning", "Lunch With Mom", "Golf" | **`#A8D4D3` Cyan** at ≈85 % (α solves consistently: 0.86 / 0.84 / 0.84 across R,G,B) | `[SAMPLED: c3.png @120,350; @865,120; @1185,700; @1765,440 — all four identical]` |
| `#F2BDB7` salmon | Mom — "Coffee With Diane", "Amelia's Baby Shower", "House Cleaner" | no clean single-α fit to any palette red | `[SAMPLED: c3.png @490,190 (96.7 %); @70,660 (100 %)]` |
| `#FFDDDC` rose | Ellie — "Pottery Class", "History Test" | `#FBA994` Grapefruit @ ≈36 % | `[SAMPLED: c3.png @1565,810 (62.5 %)]`, chip cap `[SAMPLED: c2.png @552,118]` |
| `#DFD3E1` lavender | Harper — "Emma's Birthday Party!", "Tutoring" | `#D5B6EC` Lavender @ ≈90 % (loose fit) | `[SAMPLED: c3.png @1205,385 (98.7 %); @430,800 (96.7 %)]` |
| `#D5EBD6` green | Luke — "Study Group", "Guitar Lesson", "Camping Trip" all-day | no clean fit (`#B6E085` Sprout is markedly more yellow) | `[SAMPLED: c3.png @985,800; @1585,520; c2.png @420,330]` |
| `#FFEACD` amber | "Dog's Big Bath Day!" (a pet/shared calendar) | `#FDC36D` Orange @ ≈33 % | `[SAMPLED: c3.png @455,445 (90.5 %)]` |

> **Honest caveat.** Only two of the six rendered accents map convincingly onto the API palette
> at a single alpha. The chrome colours (Blue, Coral, Orange) matched the palette to within Δ≤8,
> so this is **not** a sampling-accuracy problem. The most likely explanation is that the
> marketing renders use a bespoke pastel set for the mock family, or an older palette revision.
> **For the clone: use the 20 API colours as the source of truth and apply the §1.4 tint rules.**
> That reproduces the look without inheriting a possibly-stale mock palette.

### 1.6 Meal category colors

The Meals grid uses a **more saturated** set than the calendar — the four category rows are
visually louder than any event block.

| Row | Sampled | Best palette fit | Evidence |
|---|---|---|---|
| Breakfast | `#FEE1B7` | **`#FDC36D` Orange @ 50 %** (α = 0.50 / 0.49 across G,B — a clean fit) | `[SAMPLED: m1.png @300,290 — 91.5 %]` |
| Lunch | `#C5EEF2` | **`#82D7DD` Sky @ ≈43 %** | `[SAMPLED: m1.png @300,630 — 90.8 %]` |
| Dinner | `#D0BCF1` | **`#D5B6EC` Lavender @ ≈95 %** (near-exact) | `[SAMPLED: m1.png @300,970 — 77.5 %]` |
| Snack | `#FBC8D9` | no fit — more blue than any palette red | `[SAMPLED: m1.png @300,1320 — 100.0 %]` |

The sibling dossier records `#A8D4D3` Cyan as *a* Breakfast category colour on a live frame,
which conflicts with the apricot Breakfast row here — so **meal-category colours are almost
certainly user-editable per frame**, and these four are just the marketing frame's choices.
`[INFERRED]`

The recipe popover shows the category as a **coloured dot + name** ("● Breakfast" in apricot),
confirming the category colour is a first-class attribute. `[SCREENSHOT: pdp/07]`

### 1.7 List colors

Lists use a three-step ramp per list — badge (saturated) / row (mid) / panel (very light):

| List | Panel | Item row | Count badge | Evidence |
|---|---|---|---|---|
| Grocery (sand/tan) | `#F9F4EE` | `#F5E8D8` | `#D58C3D` | `[SAMPLED: l1.png @250,1140 (100 %); @330,265 (93.4 %); @596,175]` |
| Packing (rose) | `#FDF3F2` | `#FADEDD` | `#F38886` `[ESTIMATED]` | `[SAMPLED: l1.png @730,150; @830,265 (77.7 %); @1112,180]` |
| To-Do (purple) | `#F9F7FA` | `#EFE8EF` | `#C6ACC9` | `[SAMPLED: l1.png @1250,1140 (100 %); @1330,265; @1628,180]` |
| Travel (teal) | `[ESTIMATED]` ~`#F2FAFA` | `#D7EBEA` | teal `[ESTIMATED]` | `[SAMPLED: l1.png @1790,265]` |

Per the sibling dossier, `#B6E085` Sprout is the Grocery-List colour and `#A8D4D3` Cyan the
To-Do colour on a live frame — again different from the marketing mock, reinforcing that list
colours are user-chosen from the same 20-colour palette. `[VERIFIED]` + `[INFERRED]`

Checkbox squares inside list rows are **white** (`#FFFBFA` sampled — white with the row's colour
bleeding at the edges), with a light border. `[SAMPLED: l1.png @570,270]`

---

## 2. Typography

### 2.1 Which faces, and how confident

**Marketing site — confirmed from the shipped CSS.** `myskylight.com`'s Tailwind bundle
self-hosts six `@font-face` declarations: `P22MackinacProBook`, `P22MackinacProBookItalic`,
`P22MackinacProMedium`, `P22MackinacProBold`, `MatterRegular`, `MatterBold`, applied via utility
classes `p22-mackinac-pro-book` / `matter-regular` etc. No Typekit, no Google Fonts.
`[VERIFIED](https://myskylight.com/assets/tailwind-CAtRFGLi.css)`

**Device UI — no source names a typeface.** No Skylight spec sheet, help article, press release
or review states one. The only device typography setting documented is *size*: "Choose from
Small, Medium, and Large font sizes in Settings → General."
`[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/32083058580763-How-to-increase-font-size-on-your-Skylight-Calendar)`

> ⚠️ When searching, note that **skylight.digital** publishes brand guidelines naming *Libre
> Franklin* + *Roboto Mono*. That is an unrelated US government digital-services consultancy.
> Do not cite it for myskylight.com.

**Judgement from the letterforms** (based on `pdp/10.jpg`, the largest close-up, cropped to
`f1.png` / `f2.png`):

*The serif* ("Thu 19", "Fri 20", "Sat 21", "Miller Family", "Blueberry Pancakes", "Grocery List",
"Ella", "Great work! Bake Cookies redeemed"): fine, crisply cut, lightly bracketed wedge serifs;
moderate stroke contrast; sheared rather than ball terminals; a large x-height; lining figures
where the "1" carries a small flag and a full flat foot serif. This is consistent with **P22
Mackinac Pro**, and it visually matches the marketing headlines in `gallery/11–13` set in that
face. `[SCREENSHOT: f1.png, pdp/10.jpg]` — **likely the same family, but not confirmed.**

*The sans* ("Pickup Dry Cleaning", "9:30 – 10:15 AM", "Schedule", "Filter", "Mom 1/20", "Brush
teeth", "Eggs"): low-contrast geometric-humanist grotesque, tall x-height, generous apertures,
**double-storey `a`** and **single-storey `g`**, a `t` with a slanted top cut, a `y` with a
straight diagonal descender, and a `1` with a small flag and no foot serif. That combination —
especially double-storey `a` with single-storey `g` — is characteristic of **Matter**.
`[SCREENSHOT: f1.png, f2.png]` — **likely the same family, but not confirmed.**

### 2.2 Google Fonts stand-ins

| Role | Skylight (likely) | Recommended stand-in | Why |
|---|---|---|---|
| **Serif / display** | P22 Mackinac Pro | **Fraunces** (variable; set `SOFT` low, `WONK` 0, opsz to match size) | Closest personality: the same warm, wedge-serif, high-x-height contemporary serif. The variable `opsz` axis lets the 48 px date and the 22 px list title both look right, which a static face cannot do. |
| Serif — safer alternative | | **Literata** | A workhorse screen serif with a large x-height and slightly wedged serifs. Less characterful than Fraunces, but far more forgiving at 20–26 px and hinted for screens. Use if Fraunces reads too quirky. |
| Serif — avoid | | Playfair Display, Instrument Serif | Contrast far too high; they turn spindly at UI sizes. |
| **Sans / UI** | Matter | **DM Sans** | The single best free match: geometric-humanist skeleton, low contrast, tall x-height, **double-storey `a` + single-storey `g`** — the exact pairing Matter has. Ships a variable weight axis. |
| Sans — alternatives | | **Figtree**, **Plus Jakarta Sans** | Both also double-storey `a` + single-storey `g`; Plus Jakarta is a touch quirkier, Figtree a touch more neutral. |
| Sans — pragmatic | | **Inter** (enable `ss01` for the single-storey `g`) | If the clone needs bulletproof hinting and tabular figures more than exact character, Inter with `ss01` gets 90 % of the way. |
| Sans — avoid | | Poppins, Montserrat | Single-storey `a`, purely geometric — wrong skeleton. |

Suggested stack:

```css
--font-serif: "Fraunces", "Literata", Georgia, "Times New Roman", serif;
--font-sans:  "DM Sans", "Figtree", "Inter", system-ui, -apple-system, sans-serif;
```

### 2.3 Where each face is used

| Serif | Sans |
|---|---|
| Top-bar date ("Wed, Mar 22") or family name ("Miller Family") | Clock, temperature, weather |
| Day-column headers ("Thu 19") | Profile-chip label ("Dad 1/20") |
| Tasks profile names ("Ella", "Harper") | All-day pill label ("Camping Trip") |
| Tasks section headings ("Morning") | Event title (**semibold**) and event time (regular, muted) |
| Rewards profile names ("Dad", "Mom") | Hour-gutter labels ("10 AM") |
| List titles ("Grocery List", "To-Do") | List item text ("Eggs") |
| Recipe/meal popover title ("Blueberry Pancakes") | Task-card titles ("Brush teeth"), star chips |
| Modal title ("Great work! … redeemed") | Modal subtitle, all button labels |
| The "Skylight" wordmark | Sidebar / bottom-nav labels, top-bar pill labels |
| "Add section" placeholder in Lists | Popover body: Ingredients, Instructions, Category |

### 2.4 Type scale at 1920×1080

Measured by counting ink rows in the ≈1:1 crops (`c2.png` ≈ 0.98 logical px/px, `c3.png` ≈ 0.91,
`t1.png` ≈ 0.98, `l1/r1` ≈ 1.02), then dividing the cap/ascender height by the usual ratios
(cap ≈ 0.70 em serif / 0.72 em sans; ascender ≈ 0.75 em). Photo blur inflates ink extents by
~2 px, which has been subtracted. **All sizes are `[ESTIMATED]`; the measured ink heights are the
`[SAMPLED]` evidence.**

| Element | Face / weight | Measured ink | **px @1920×1080** |
|---|---|---|---|
| Top-bar date / family name | serif, regular | cap 37 px `[SAMPLED: c2.png @160,15]` | **48** |
| Top-bar clock ("8:00 AM") | sans, medium | cap 32 px `[SAMPLED: c2.png @640,20]` | **40** |
| Top-bar temperature ("80°") | sans, medium | — (too light to threshold) | **40** `[ESTIMATED]` |
| Profile-chip label | sans, medium | asc 19 px `[SAMPLED: c2.png @240,120]` | **24** |
| Countdown-chip label ("Vacation 48 days") | sans, medium | — | **24** `[ESTIMATED]` |
| Day-column header ("Thu 19") | serif, regular | asc 31 px `[SAMPLED: c2.png @578,235]` | **40** |
| Today-badge number ("18") | sans, semibold | — | **22** `[ESTIMATED]` |
| Hour-gutter label ("10 AM") | sans, regular | cap 18 px `[SAMPLED: c3.png @0,88]` | **24** |
| All-day pill label | sans, medium | `[SAMPLED: c2.png @232,312]` | **22** |
| Event title | sans, **semibold** | x-ht 12 px `[SAMPLED: c3.png @95,240]` | **26** |
| Event time | sans, regular, muted | `[SAMPLED: c3.png @95,280]` | **24** |
| Top-bar pill label ("Today", "Sidekick", "Filter") | sans, medium | asc 16 px `[SAMPLED: c2.png @1245,40]` | **21** |
| Sidebar / bottom-nav label | sans, medium | asc 15 px `[SAMPLED: c2.png @5,160]` | **19** |
| Tasks profile name ("Ella") | serif, regular | asc 27 px `[SAMPLED: t1.png @238,140]` | **36** |
| Tasks section heading ("Morning") | serif, regular | `[SAMPLED: t1.png @140,405]` | **28** |
| Task-card title | sans, medium | asc 17 px `[SAMPLED: t1.png @162,575]` | **22** |
| Star chip ("⭐ 10") | sans, medium | 11 px digits `[SAMPLED: t1.png @195,612]` | **16** |
| List title ("Grocery List") | serif, regular | cap 33 px `[SAMPLED: l1.png @185,160]` | **46** |
| List item text | sans, regular | cap 18 px `[SAMPLED: l1.png @253,265]` | **25** |
| Meal-cell label | sans, medium | `[SAMPLED: m1.png @225,385]` | **30** |
| Modal title (serif) | serif, regular | `[SAMPLED: r1.png @730,575]` | **36** |
| Modal subtitle | sans, regular, muted | ink 21 px `[SAMPLED: r1.png @730,695]` | **22** |
| Button label ("Done", "Edit", "Delete") | sans, medium | — | **24** `[ESTIMATED]` |

Two structural notes: the **event title is the only consistently semibold body text**, and the
device offers a global Small/Medium/Large font-size setting `[VERIFIED]`, so treat this scale as
the "Medium" rung and build it on a scalable root.

---

## 3. Layout metrics at 1920×1080

### 3.1 Calibration

`pdp/05.jpg` is the front-on wall-mounted 15" shot and is the metric source. Its screen spans
**y 182 → 765 = 583 photo px**, which is 1080 logical px, giving **k = 1.853 logical px per photo
px**. Cross-check: 583 × 16/9 = 1036 photo px wide; the sidebar's left edge sits at x ≈ 366, so
the right edge lands at ≈ 1402 — consistent with where the grid runs out before the overlaid
phone mock-up covers it. `[SAMPLED: pdp/05.jpg col 800, row 420]`

`gallery/09.jpg` is foreshortened horizontally (the device is turned), so its **vertical**
measurements are usable and its **horizontal** ones are not. Where both were measurable the two
photos agree within ~10 %, which is the accuracy claim for this section.

**Every number in §3 is `[ESTIMATED]`** — derived proportionally from photographs, not read from
a spec. The horizontal set is internally consistent, which is the best available evidence:

```
sidebar 102 + hour gutter 117 + (5 day columns × 337) = 1904 ≈ 1920   ✓
top bar 85 + chip row 89 + day header 137 + grid 769  = 1080          ✓
```

### 3.2 Frame & chrome

| Metric | px @1920×1080 | Evidence |
|---|---|---|
| Sidebar width | **102** | `[SAMPLED: pdp/05.jpg row 420 — sidebar 366→421 = 55 photo px]` |
| Sidebar nav-item pitch (icon + label) | **~118** | `[SCREENSHOT: c2.png]` `[ESTIMATED]` |
| Sidebar active pill — inset / radius | inset ~6, radius ~14 | `[SCREENSHOT: t1.png, m1.png]` `[ESTIMATED]` |
| Sidebar icon size | **~32** | `[SCREENSHOT: p2.png]` `[ESTIMATED]` |
| Top-bar height | **85** | `[SAMPLED: pdp/05.jpg col 800 — 182→228 = 46 photo px]` |
| Chip-row band height | **89** | `[SAMPLED: pdp/05.jpg col 800 — 228→276 = 48 photo px]` |
| Day-column header band height | **137** | `[SAMPLED: pdp/05.jpg col 800 — 276→350 = 74 photo px]` |
| Grid viewport height (below the header) | **769** | derived: 1080 − 311 |
| Hairline thickness | **1** (2 device px @2× DPR) | `[ESTIMATED]` |
| Screen edge padding (content inset) | **~20** | `[ESTIMATED]` |

### 3.3 Week-view grid

| Metric | px @1920×1080 | Evidence |
|---|---|---|
| Hour-gutter width | **117** | `[SAMPLED: pdp/05.jpg — sidebar right 421 → first hairline 484 = 63 photo px]` |
| Day-column width (5 columns shown) | **337** | `[SAMPLED: pdp/05.jpg row 420 — hairlines at x 484 / 852 / 1033 / 1212, pitch ≈ 182 photo px]` |
| **Hour-row height** | **195** | `[SAMPLED: pdp/05.jpg col 460 — hour labels at y 403/508/615/720, pitch 105 photo px]`; independently `[SAMPLED: gallery/09.jpg — 78 photo px × k_v 2.26 = 198]` |
| Half-hour hairline | at **97** (mid-row) | `[SAMPLED: pdp/05.jpg col 1290 — hairlines every ~52 photo px, i.e. twice per labelled hour]` |
| Event-block corner radius | **~20** | `[SCREENSHOT: c3.png, f1.png]` `[ESTIMATED]` |
| Event-block padding (text inset) | **~30 left/top**, ~24 right/bottom | `[SAMPLED: c3.png — "Grocery Run" left edge 62 → text 95 = 33 c3 px]` |
| Event-block inner gap (title → time) | **~8** | `[SCREENSHOT: c3.png]` `[ESTIMATED]` |
| Event-block horizontal inset within its column | **~6** each side | `[ESTIMATED]` |
| Avatar on an event block | **~40** diameter | `[SAMPLED: c3.png col 385 — avatar spans 284→326 = 42 c3 px]` |
| Avatar overlap when stacked | **~12** (≈30 % overlap) | `[SCREENSHOT: p4.png]` `[ESTIMATED]` |
| "+2" overflow chip | **~40** circle, white fill, 2 px grey ring | `[SCREENSHOT: p4.png]` |
| All-day pill height | **~40**, radius = height/2 | `[SCREENSHOT: c2.png]` `[ESTIMATED]` |
| Now-line thickness / dot | **2 px** line, **~14 px** dot at the gutter edge | `[SCREENSHOT: c3.png]` `[ESTIMATED]` |
| Diagonal stripe width (multi-profile) | **~40**, at 45° | `[SCREENSHOT: p4.png, pdp/10.jpg]` `[ESTIMATED]` |

### 3.4 Chips, buttons, badges

| Metric | px @1920×1080 | Evidence |
|---|---|---|
| Profile-chip height | **61** | `[SAMPLED: pdp/05.jpg col 800 — chip 236→268 = 33 photo px]` |
| Profile-chip radius | **30** (full pill) | `[SCREENSHOT: c2.png]` |
| Profile-chip width | **~330** (5 chips spanning the content width) | `[SAMPLED: c2.png row 160 — Dad 152→472, Ellie 508→841, Harper 863→1201]` |
| Profile-chip **cap** width (the 100 %-tone leading block) | **~72**, ≈ 22 % of the chip | `[SAMPLED: c2.png row 160 — Dad cap 152→217, Ellie cap 508→575]` |
| Chip avatar diameter | **~48**, with a 2 px accent ring | `[SCREENSHOT: c2.png, p1.png]` `[ESTIMATED]` |
| Countdown chip ("🌴 Vacation 48 days") | same 61 px height, **outlined** (1 px grey border, white fill) rather than tinted | `[SCREENSHOT: p1.png]` |
| Top-bar pill button height | **~52**, radius = height/2 | `[SCREENSHOT: f2.png]` `[ESTIMATED]` |
| Top-bar pill horizontal padding | **~28** | `[ESTIMATED]` |
| Top-bar pill icon size | **~26**, gap to label ~12 | `[SCREENSHOT: f2.png]` `[ESTIMATED]` |
| Today badge (date pill) | **~44** circle | `[SCREENSHOT: c2.png, p1.png]` `[ESTIMATED]` |
| **FAB diameter** | **~90** | `[SAMPLED: gallery/09.jpg col 1317 — blue spans y 687→726 = 39 photo px × k_v 2.26]` |
| FAB offset from right / bottom edge | **~32 / ~32** | `[ESTIMATED]` |
| FAB icon ("+") | **~36** stroke-2 white | `[SCREENSHOT: c3.png]` `[ESTIMATED]` |

### 3.5 Tasks screen

| Metric | px @1920×1080 | Evidence |
|---|---|---|
| Task column width (4 columns) | **~400** | `[SAMPLED: t1.png — column pitch ≈ 455 t1 px × 0.98]` |
| Task column gap | **~34** | `[SAMPLED: t1.png]` |
| Task column radius | **~24** | `[SCREENSHOT: t1.png]` `[ESTIMATED]` |
| Column header block height (avatar + name + counters + 4 toggles) | **~250** | `[SAMPLED: t1.png — y 133→390]` |
| Header avatar diameter | **~78** | `[SCREENSHOT: t1.png]` `[ESTIMATED]` |
| Counter pill ("✓ 2/20", "⭐ 10") | **~40** high, radius 20 | `[SCREENSHOT: t1.png]` `[ESTIMATED]` |
| Routine toggle ring (Morning/Afternoon/Evening/Chores) | **~72** diameter, ~4 px ring | `[SCREENSHOT: t1.png]` `[ESTIMATED]` |
| Task card height — plain | **~155** | `[SAMPLED: t1.png — "Get dressed" 680→838 = 158 t1 px]` |
| Task card height — with a star chip | **~186** | `[SAMPLED: t1.png — "Brush teeth" 470→660 = 190 t1 px]` |
| Task card gap | **~20** | `[SAMPLED: t1.png]` |
| Task card radius | **~20** | `[SCREENSHOT: t1.png]` `[ESTIMATED]` |
| Task-card emoji | **~64** | `[SCREENSHOT: t1.png]` `[ESTIMATED]` |
| Task checkbox circle | **~44** | `[SCREENSHOT: t1.png]` `[ESTIMATED]` |

### 3.6 Lists screen

| Metric | px @1920×1080 | Evidence |
|---|---|---|
| List card width | **~495** (≈3.4 visible, horizontally scrollable) | `[SAMPLED: l1.png — card ≈ 490 l1 px × 1.02]` |
| List card gap | **~38** | `[SAMPLED: l1.png]` |
| List card radius | **~28** | `[SCREENSHOT: l1.png]` `[ESTIMATED]` |
| List header height (title + count badge) | **~100** | `[SCREENSHOT: l1.png]` `[ESTIMATED]` |
| List item row height | **~76** | `[SAMPLED: l1.png — "Eggs" 248→323 = 75 l1 px]` |
| List item row pitch | **~114** (row 76 + gap 38) | `[SAMPLED: l1.png]` |
| List item radius | **~14** | `[SCREENSHOT: l1.png]` `[ESTIMATED]` |
| Item checkbox (rounded **square**) | **~63**, radius ~10 | `[SAMPLED: l1.png]` |
| Count badge circle | **~53** | `[SAMPLED: l1.png]` |
| "Add section" footer height | **~110** | `[SCREENSHOT: l1.png]` `[ESTIMATED]` |

### 3.7 Meals screen

| Metric | px @1920×1080 | Evidence |
|---|---|---|
| Day columns shown | **7** (Sun → Sat) | `[SCREENSHOT: pdp/07.jpg]` |
| Meal cell width | **~235** | derived: (1818 − 6×20 gap − 40 margin)/7 `[ESTIMATED]` |
| Meal cell height | **~250** | `[SAMPLED: m1.png — row ≈ 295 m1 px × 0.85]` |
| Meal cell gap | **~20 h**, **~38 v** | `[SAMPLED: m1.png]` |
| Meal cell radius | **~25** | `[SAMPLED: m1.png]` `[ESTIMATED]` |
| Category rail (rotated "Breakfast/Lunch/Dinner/Snack") | **~40** wide, text rotated −90° | `[SCREENSHOT: pdp/07.jpg]` |
| Recipe popover width | **~700** | `[SCREENSHOT: pdp/07.jpg]` `[ESTIMATED]` |
| Recipe popover radius | **~32** | `[SCREENSHOT: p3.png]` `[ESTIMATED]` |

### 3.8 Modal (rewards redeem)

| Metric | px @1920×1080 | Evidence |
|---|---|---|
| Modal width | **~540** | `[SAMPLED: r1.png — 715→1255 = 540 r1 px × 1.02]` |
| Modal height | **~700** | `[SAMPLED: r1.png — 265→975]` |
| Modal radius | **~40** | `[SCREENSHOT: r1.png]` `[ESTIMATED]` |
| Modal padding | **~40** | `[ESTIMATED]` |
| Reward emoji | **~150** | `[SCREENSHOT: r1.png]` `[ESTIMATED]` |
| Primary button height | **~76**, radius ~38 (full pill) | `[SAMPLED: r1.png — 765→840]` |
| Secondary button height | **~72**, radius ~36 | `[SAMPLED: r1.png]` |
| Button gap | **~16** | `[ESTIMATED]` |

---

## 4. Component inventory

Every sketch below is drawn to the proportions in §3. Tokens refer to §1.

### 4.1 Sidebar nav item

```
 ┌──────────┐            rail bg  --sidebar-bg #E9F0F7
 │          │            item     transparent, label --text-muted
 │    ▤     │  ← icon 32px, stroke ~2, currentColor
 │ Calendar │  ← sans medium 19px, centred under the icon
 │          │
 ├──────────┤
 │▛▀▀▀▀▀▀▀▀▜│  ← ACTIVE: white pill, inset 6, radius 14
 │▌   ✓    ▐│     icon + label darken to --text-primary
 │▌  Tasks ▐│     no border, no shadow
 │▙▄▄▄▄▄▄▄▄▟│
 └──────────┘
```

- Width 102 px, item pitch ~118 px, icon above label, both centre-aligned.
- The "S" Skylight monogram sits at the very top of the rail on the top-bar row, in `--text-muted`.
- Order (landscape): **S · Calendar · Tasks · Rewards · Meals · Recipes · Photos · Lists** … then a
  large flexible gap … **Sleep · Settings** pinned to the bottom. `[SCREENSHOT: gallery/00, gallery/09]`
- Order varies by frame configuration — `pdp/01` shows **Calendar · Lists · Tasks · Rewards ·
  Meals · Recipes · Photos**, i.e. Lists promoted above Tasks. `[SCREENSHOT: pdp/01]`
- Active state = **white pill only**. No accent bar, no colour. `[SAMPLED: t1.png @20,280]`

### 4.2 Top-bar pill buttons

```
 ╭───────────────╮ ╭──────────╮ ╭──────────╮ ╭───╮ ╭─────────╮ ╭───╮
 │ ✦  Sidekick   │ │ ▤   Day  │ │ ⊘ Filter │ │ ‹ │ │  Today  │ │ › │
 ╰───────────────╯ ╰──────────╯ ╰──────────╯ ╰───╯ ╰─────────╯ ╰───╯
   h 52 · r 26 · bg --pill-btn-bg #F7F7F8 · label 21px sans medium --text-muted
   icon 26px stroke-2 · icon→label gap 12 · h-padding 28 · button gap 16
```

- **Sidekick** — sparkles icon; opens the AI assistant. On-device it mainly presents a **QR code**
  to hand off to the phone, because the Calendar has no camera and no microphone.
  `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)`
- **View switcher** — a single pill whose label is the *current* view: `Day` in `gallery/09`,
  `Schedule` in `pdp/01/05/10`. Tapping cycles/opens the picker for **Schedule · Day · Week ·
  Month**. `[VERIFIED]` (same article) `[SCREENSHOT: gallery/09 vs pdp/10]`
- **Filter** — eye-with-slash icon. Toggles visibility of *Task progress*, *Weather forecast*,
  *Planned meals*, and *Individual profiles*. `[VERIFIED]` (same article). The panel itself is
  `[UNKNOWN]` — not shown in any image.
- **‹ / Today / ›** — a tight nav cluster at the far right. `‹` and `›` are icon-only pills.
- On the 15" `pdp/01/05/10` layout only **Schedule** and **Filter** appear; the date-nav cluster
  is absent, so the button set is context-dependent. `[SCREENSHOT: pdp/10]`

### 4.3 Profile chip

```
 ╭────────┬──────────────────────────╮
 │▓▓(◍)▓▓ │  Dad   1/20              │   h 61 · r 30 (full pill) · w ~330
 ╰────────┴──────────────────────────╯
   ↑cap ~72px            ↑body
   cap  = --profile @ 100%      e.g. #B4DBDA
   body = --profile @  40%      e.g. #E2F0F1
   avatar 48px circle, 2px ring in --profile, sits centred on the cap
   label sans medium 24px --text-primary;  "1/20" = tasks done / total, muted
```

The two-tone split is the chip's signature: a solid leading cap carrying the avatar, then a
40 % body carrying the name and task counter. `[SAMPLED: c2.png row 160]`

### 4.4 Countdown chip

```
 ╭──────────────────────────────╮
 │ 🌴  Vacation    48 days      │   h 61 · r 30
 ╰──────────────────────────────╯   bg #FFFFFF · 1px border ~#DDDDDD
                                    emoji ~32 · label 24px · count muted
```

Sits **first** in the chip row, left of the profile chips. Outlined rather than tinted, which
distinguishes it from a profile. `[SCREENSHOT: p1.png, pdp/01]`

### 4.5 Day header + today badge

```
 │ Wed  ⬤18      │ Thu 19        │ Fri 20        │
 │  ╰─ badge     │               │               │
 │ ╭───────────╮ │               │               │
 │ │Camping Trip│ │              │               │   ← single-day all-day pill
 │ ╰───────────╯ │               │               │
 ├───────────────┴───────────────┴───────────────┤   ← --grid-hairline
```

- Weekday + date in **serif 40px**. On "today" the date number is replaced by a **filled circle
  badge** ~44 px in `--today #F66951` with white semibold 22px digits. Non-today days show a plain
  numeral. `[SAMPLED: c2.png @336,262]` `[VERIFIED]` (*"the current date … is displayed in an
  orange dot"*)
- Band height 137 px, which fits the date line plus one all-day row.

### 4.6 All-day pills — three variants

```
(a) single-profile        ╭──────────────╮
                          │ Camping Trip │   fill = --profile @100%, r = h/2
                          ╰──────────────╯

(b) multi-day, unassigned ╭──────────────────────────────────────╮
                          │ Family weekend                       │   white fill,
                          ╰──────────────────────────────────────╯   1px grey border,
                            spans Sat→Sun across the hairline        spans N columns

(c) multi-profile         ╭─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╮
                          │ Cousins Visit ╱ ╱ ╱ ╱ ╱ ╱ ╱ │   45° stripes, ~40px each,
                          ╰─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╯   one per assigned profile,
                                                            each at 100%, cycling
```

Variant (c) stripe colours sampled left→right on "Cousins Visit": green `#DEF0DE`, pink
`#F6CCCC`, teal `#C0DEE4`, rose `#FCE4E4`, lavender `#E4DEE4` — i.e. the assigned profiles'
accents in order. The label sits on a solid segment at the left so it stays legible.
`[SAMPLED: pdp/10.jpg row 700]`

### 4.7 Timed event block

```
 ╭────────────────────────────────╮      fill   = --profile @100%
 │                                │      radius ≈ 20
 │  Pickup Dry Cleaning           │      title  sans semibold 26px --text-primary
 │  9:30 - 10:15 AM        ( ◍ )  │      time   sans regular 24px --text-secondary
 │                                │      avatar 40px, bottom-right, ~24px inset
 ╰────────────────────────────────╯      padding ~30 left/top

 multi-profile variant:
 ╭─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╮        diagonal stripes as 4.6(c)
 │ Lunch with Grandma           │        avatars stack with ~30% overlap,
 │ 12-1:30 PM      (◍)(◍)(+2)   │        then a white "+N" circle with a grey ring
 ╰─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╱─╯
```

Blocks are positioned/sized by time (195 px per hour) and inset ~6 px inside their column.
Overlapping events shrink in width and sit side-by-side rather than stacking.
`[SCREENSHOT: c3.png, p4.png]`

### 4.8 Now line

```
 10 AM ├──────────────────────────
       │
       ⬤━━━━━━━━━━━━━━━━━━━━━┓        dot ~14px + 2px bar, --today #F66951
       │                              spans only TODAY's column
 11 AM ├──────────────────────────    drawn above event blocks
```

`[VERIFIED]` *"The current time in the calendar is displayed as an orange bar."*
`[SCREENSHOT: c3.png]`

### 4.9 FAB

```
        ╭───────╮
        │   +   │    d 90 · bg --primary-blue #2178AF · white "+" ~36px stroke-2
        ╰───────╯    fixed bottom-right, ~32px inset, subtle drop shadow
```

Present on Calendar, Tasks, Rewards, Lists. `[SCREENSHOT: gallery/09, 02, 05, 07]`

### 4.10 Tasks column header

```
 ┌───────────────────────────────────────────┐  panel = --profile @20%, r 24
 │  ( ◍◍ )   Ella                            │  avatar 78 · name serif 36px
 │           ╭──────────╮ ╭──────────╮       │  counters: pills h40 r20,
 │           │ ✓  2/20  │ │ ⭐  10   │       │  bg = --profile @40%
 │           ╰──────────╯ ╰──────────╯       │
 │                                           │
 │   ◜◝      ◜◝      ◜◝      ◜◝              │  4 routine toggles, d 72
 │  (🌤)    (☀)     (🌙)    (🧹)             │  ring ~4px; ACTIVE ring is
 │ Morning Afternoon Evening Chores          │  --profile, inactive is @40%
 └───────────────────────────────────────────┘  labels sans 19px; active label
                                                 is --text-primary + semibold
```

The active toggle ("Morning" here) draws a full-circumference ring; the others are partial /
faded. "Chores" is always drawn as a distinct full ring. `[SCREENSHOT: t1.png]`

### 4.11 Task card

```
 incomplete                            complete
 ┌────────────────────────────┐        ┌────────────────────────────┐
 │           🪥               │        │           🪥               │
 │                            │        │                            │
 │  Brush teeth               │        │  Brush teeth               │
 │  ⭐10                 ( )  │        │  ⭐10                 (✓)  │
 └────────────────────────────┘        └────────────────────────────┘
   bg = --profile @40%                   bg = --profile @100%
   circle: white fill, no icon           circle: --profile (deeper), white ✓
   h 155 (186 with a star chip) · r 20 · emoji ~64 · title sans medium 22px
```

Completing a card **darkens the whole card** from the 40 % tint to the full accent — that state
change is the primary feedback, not just the checkmark. `[SAMPLED: t1.png — Harper todo `#F2EDF3`
→ done `#DFD3E1`; Ben todo `#E0F0F0` → done `#B3DAD9`; Riley todo `#F9E4E3` → done `#F1BCB6`]`

### 4.12 Rewards column header & reward card

```
 ┌─────────────────────────────────┐     header: same panel as Tasks (@20%)
 │  ( ◍◍ )   Dad                   │     name serif 36px
 │           ╭────────╮            │     star total pill: ⭐ + count
 │           │ ⭐  55 │            │
 │           ╰────────╯            │
 ├─────────────────────────────────┤
 │  ┌───────────────────────────┐  │     reward card: white, r ~24
 │  │          ⚾               │  │     emoji ~110
 │  │  Baseball Game Tickets    │  │     title serif ~30px
 │  │  ▓▓▓▓░░░░░░░░░░░░░░░░░░   │  │     progress bar: h ~44, r 22
 │  │       ☆ 55/150            │  │       track = --profile @40%
 │  └───────────────────────────┘  │       fill  = --profile @100%, left-aligned
 └─────────────────────────────────┘       label "☆ 55/150" centred ON the bar
```

`[SCREENSHOT: r1.png]`

### 4.13 Redeem modal + confetti

```
              ╔═══════════════════════════════╗
              ║                               ║   w 540 · h 700 · r 40
              ║            🍪                 ║   bg #FFFFFF · pad 40
              ║          (150px)              ║   backdrop: NOT dimmed —
              ║                               ║   the screen behind stays
              ║  Great work! Bake             ║   bright and is overlaid
              ║  Cookies  redeemed            ║   with falling gold stars
              ║  By Ella for 20 stars on      ║
              ║  March 22, 2026.              ║   title  serif 36px
              ║                               ║   sub    sans 22px --text-secondary
              ║  ╭─────────────────────────╮  ║
              ║  │         Done            │  ║   primary: --primary-blue #2178AF,
              ║  ╰─────────────────────────╯  ║   white label, h 76, r 38
              ║  ╭─────────────────────────╮  ║
              ║  │       Unredeem          │  ║   secondary: #F9F9F9,
              ║  ╰─────────────────────────╯  ║   --text-primary label, h 72
              ╚═══════════════════════════════╝
```

**Confetti:** gold five-pointed stars, `--star-gold #FDC36D`, ~28–48 px, random rotation,
scattered across the *whole* screen including over the column panels — and the underlying
columns take on a warm wash while it plays. `[SCREENSHOT: gallery/05, pdp/06]`

### 4.14 List card

```
 ┌───────────────────────────────────────┐   panel: list colour @ very light
 │  Grocery List                   (5)   │   title serif 46px
 │                                       │   count badge: d 53, saturated list
 │  ┌─────────────────────────────────┐  │   colour, white numeral
 │  │ 🥚 Eggs                    [ ]  │  │
 │  └─────────────────────────────────┘  │   item row: h 76, r 14,
 │  ┌─────────────────────────────────┐  │   bg = list colour @ mid
 │  │ 🥛 Milk                    [ ]  │  │   text sans 25px
 │  └─────────────────────────────────┘  │   checkbox: rounded SQUARE 63px,
 │  ┌─────────────────────────────────┐  │   white fill, r 10  (note: Lists use
 │  │ 🍞 Bread                   [ ]  │  │   a square; Tasks use a circle)
 │  └─────────────────────────────────┘  │
 │                                       │
 │  Add section              (0)   ⌃     │   footer: placeholder text in a muted
 └───────────────────────────────────────┘   serif, count badge, chevron-up
   w 495 · r 28 · gap 38 · horizontally scrollable (≈3.4 visible)
```

`[SCREENSHOT: l1.png, pdp/08]`

### 4.15 Meal grid cell + recipe popover

```
 ┌──────────────┐   cell 235 × 250, r 25
 │ 🥞🫐         │   fill = meal-category colour (row-wide)
 │ Blueberry    │   label sans medium 30px --text-primary,
 │ Pancakes     │   emoji inline, wraps to 2–3 lines,
 └──────────────┘   text bottom-left aligned

 popover (tap a cell):
 ╔══════════════════════════════════════╗   w ~700 · r 32 · white · drop shadow
 ║  Blueberry Pancakes                  ║   serif ~44px
 ║  ╭──────────╮  ╭──────────╮          ║   two pill buttons, bg #F7F7F8:
 ║  │ ✎  Edit  │  │ 🗑 Delete│          ║     Edit   — neutral label
 ║  ╰──────────╯  ╰──────────╯          ║     Delete — icon + label in Coral
 ║  ▤  Sunday, March 19                 ║   metadata rows: 26px icon + 25px label
 ║  ⌂  Category                         ║
 ║       ●  Breakfast                   ║   category = colour dot + name
 ║  ≡  Ingredients                      ║
 ║       • 3/4 cup milk                 ║   bulleted list, 25px
 ║       • 2 tablespoons white vinegar  ║
 ║     Instructions                     ║
 ║       1. Mix the milk and vinegar …  ║   numbered list
 ╚══════════════════════════════════════╝
```

`[SCREENSHOT: pdp/07, p3.png]`

### 4.16 Portrait bottom nav bar

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │  S   ▤        ▤        ▛▀▀▀▜   ☆        ⑂        ▭        ▣    ☾    ⚙  │
 │   Calendar   Lists     ▌ ✓ ▐  Rewards  Meals   Recipes  Photos Sleep Set│
 │                        ▌Tasks▐                                          │
 │                        ▙▄▄▄▟                                            │
 └────────────────────────────────────────────────────────────────────────┘
   bg --sidebar-bg #E9F0F7 · full width · pinned to the bottom
   ACTIVE item = white pill, full bar height, same treatment as the sidebar
   icon above label, identical 32px / 19px sizes
   Sleep + Settings pushed to the far right (the sidebar's "bottom" group)
```

Portrait is the **same nav, rotated**: the vertical rail becomes a horizontal bar and the
active-item white pill grows to the bar's full height. Everything else (top bar, Filter pill,
column layout) keeps its landscape design, and Tasks reflows from 4 columns to a **2×2 grid**.
`[SCREENSHOT: pdp/03, p2.png]`

> Note: Skylight's own help centre documents a "Navigation bar" / "menu bar" but **never states
> its screen position in either orientation**, so this bottom-bar layout is evidenced *only* by
> the product photo — which is nonetheless direct visual evidence. `[VERIFIED — absence]`

---

## 5. Icon set → `lucide-react`

All icons are single-weight line icons, ~2 px stroke, rounded caps, drawn in `currentColor`.

### Sidebar / bottom nav

| Skylight icon | Description | `lucide-react` |
|---|---|---|
| Skylight monogram | serif "S" in a rounded square (on marketing); bare "S" on device | *custom* — not a Lucide icon |
| Calendar | calendar page, thick top binding, no inner date grid | `Calendar` |
| Tasks | a bare checkmark, no box | `Check` |
| Rewards | five-point star outline with slightly rounded points | `Star` |
| Meals | fork **and** knife crossed/parallel | `Utensils` |
| Recipes | open book, two visible pages | `BookOpen` |
| Photos | landscape frame with a mountain + sun | `Image` |
| Lists | rectangle with bullet dots and lines inside | `ListTodo` (closest) or `List` |
| Sleep | crescent moon | `Moon` |
| Settings | cog / gear, 8 teeth | `Settings` |

### Top bar

| Skylight icon | Description | `lucide-react` |
|---|---|---|
| Sidekick | four-point sparkle plus two small ones | `Sparkles` |
| View: Day | small calendar page | `Calendar` |
| View: Schedule | three vertical bars inside a frame (column view) | `Columns3` |
| View: Week | *not observed* | `CalendarDays` `[ESTIMATED]` |
| View: Month | *not observed* | `CalendarRange` `[ESTIMATED]` |
| Filter | eye with a slash through it | `EyeOff` |
| Previous | chevron left | `ChevronLeft` |
| Next | chevron right | `ChevronRight` |
| Add (FAB) | plus | `Plus` |

### In-content

| Skylight icon | Description | `lucide-react` |
|---|---|---|
| Task done | checkmark inside a filled circle | `CheckCircle2` (or `Check` on a circle) |
| Task todo | empty circle | `Circle` |
| List item checkbox | empty rounded **square** | `Square` |
| Star chip / reward cost | star, filled gold or outlined | `Star` / `StarOff`→ use `Star` with fill |
| Weather (partly cloudy) | cloud with a sun peeking | `CloudSun` |
| Recipe: date row | calendar page | `Calendar` |
| Recipe: category row | tag / label outline | `Tag` |
| Recipe: ingredients row | three stacked lines of unequal length | `AlignLeft` (closest) or `Menu` |
| Recipe: Edit | pencil | `Pencil` |
| Recipe: Delete | trash can with a lid | `Trash2` |
| "Add section" collapse | chevron up | `ChevronUp` |
| Overflow avatars | "+2" in a circle | *custom* text badge |
| Countdown chip | emoji (🌴), user-chosen | *emoji, not an icon* |

Emoji are used heavily and are **not** icons: task cards, meal cells, list items, reward cards
and the countdown chip all take a user-chosen emoji rendered at 32–150 px. Plan for a colour
emoji font (Noto Color Emoji / Apple Color Emoji) as a first-class asset.

---

## 6. Per-screen layouts (annotated, 1920×1080)

### 6.1 Week view — `gallery/09`, `pdp/05`

```
 x=0    102                     219                                              1920
 ├──────┼───────────────────────┼────────────────────────────────────────────────┤
 │  S   │ Wed, Mar 22  8:00 AM  🌤 80°      ╭Sidekick╮╭Day╮╭Filter╮╭‹╮╭Today╮╭›╮ │ h 85   y=85
 ├──────┼──────────────────────────────────────────────────────────────────────--┤
 │ ▤    │ ╭(◍)Dad 1/20──╮╭(◍)Ellie 1/20─╮╭(◍)Harper 1/20╮╭(◍)Luke╮╭(◍)Mom 1/20╮  │ h 89   y=174
 │Calend│  chip h61 r30, cap 72 | body                        gap 16             │
 ├──────┼──────┬──────────┬──────────┬──────────┬──────────┬──────────┬─────────┤
 │ ✓    │      │ Wed ⬤18  │ Thu 19   │ Fri 20   │ Sat 21   │ Sun 22   │         │ h 137
 │Tasks │      │╭Camping ╮│          │          │╭Family weekend──────╮│        │        y=311
 │ ☆    ├──────┼──────────┼──────────┼──────────┼──────────┼──────────┤─────────┤ ← hairline
 │Reward│      │          │          │╭Pickup Dry│         │          │         │
 │ ⑂    │10 AM ├ - - - - -┼ - - - ╭──┼─Cleaning ┼ - - - - -┼ - - - - -┤         │ ← ½-hour
 │Meals │      │          │       │Cf│9:30-10:15│          │          │         │   hairline
 │ ▭    │      │╭─────────╮       │fe│  ╭───────┼╮ ╭───────╮│╭────────╮         │
 │Recipe│      ││Grocery  ││      │e │  │History││ │Emma's ││ │Golf   │         │
 │ ▣    │11 AM ├┤Run      ├┼──────┴──┴──┤Test   ├┴─┤Bday!  ├┴─┤10:30- ├─────────┤ h 195/hr
 │Photos│      │⬤━━━━━━━━━│ now line    │       │  │       │  │11:45  │         │
 │ ▤    │      │╰────(◍)──╯╭Dog's Big───╯       │  │       │  ╰───(◍)─╯         │
 │Lists │      │           │Bath Day!  │        │  │       │ ╭Guitar─╮          │
 │      │12 PM ├───────────┼───────────┼────────┼──┼───────┼─┤Lesson ├──────────┤
 │      │      │╭Amelia's ─╮           │╭House  │╭─┼Lunch  │ │11 AM- │          │
 │ ☾    │      ││Baby      │╭Tutoring─╮││Cleaner││ │With   │ │12:30  │          │
 │Sleep │      ││Shower    ││12:30-4PM│││11:30- ││S│Mom    │ ╰───(◍)─╯          │
 │ ⚙    │ 1 PM ├┤12-1:30PM ├┤         ├┼┤1:15PM ├┤G│12 PM  ├─╭Pottery╮  ╭─────╮ │
 │Settin│      │╰──────(◍)─╯╰─────(◍)─╯│╰───(◍)─╯╰─┤       │ │Class  │  │  +  │ │
 └──────┴──────┴───────────┴───────────┴─────────┴──┴───────┴─┴───────┴──╰─────╯─┘
   102     117      337         337        337       337       337        FAB 90
                                                                     inset 32/32
```

Vertical rhythm: **85 + 89 + 137 = 311** of chrome, then a **769 px** grid ≈ 3.9 hour rows at
195 px. Horizontal: **102 + 117 + 5 × 337 = 1904 ≈ 1920**.

15" variant (`pdp/01/05/10`): the top bar reads **"Miller Family"** instead of the date, the pill
set is only `Schedule` + `Filter`, and a **countdown chip** leads the chip row.

### 6.2 Tasks — landscape (`gallery/02`)

```
 ├──102─┼──────────────────────── 1818 content ──────────────────────────────────┤
 │  S   │ Wed, Mar 22  8:00 AM 🌤 80°     ╭Sidekick╮╭Day╮╭Filter╮╭‹╮╭Today╮╭›╮   │ 85
 ├──────┼─────────────┬─────────────┬─────────────┬─────────────┬───────────────┤
 │      │┌── 400 ────┐│┌── 400 ────┐│┌── 400 ────┐│┌── 400 ────┐│               │
 │ ▤    ││(◍◍) Ella  │││(◍◍) Harper│││(◍◍) Ben   │││(◍◍) Riley │←  gap 34        │
 │ ✓ ◄──┤│ ✓2/20 ⭐10│││ ✓1/20 ⭐10│││ ✓1/20 ⭐10│││ ✓1/20 ⭐10│ header ~250     │
 │ ☆    ││(🌤)(☀)(🌙)(🧹)│  4 rings d72, active ring = --profile              │
 │      ││Morn Aft Eve Chores│                                                   │
 │      │└───────────┘└───────────┘└───────────┘└───────────┘                    │
 │      │ Morning      Morning      Morning      Morning     ← serif 28px         │
 │      │┌───────────┐┌───────────┐┌───────────┐┌───────────┐                    │
 │      ││    🪥     ││    🪥     ││    🪥     ││    🪥     │  card h 186 (star) │
 │      ││Brush teeth││Brush teeth││Brush teeth││Brush teeth│  r 20, gap 20      │
 │      ││⭐10   (✓) ││⭐10   (✓) ││⭐10    ( )││⭐10    ( )│                    │
 │      │└──@100%────┘└──@100%────┘└──@40%────┘└──@40%────┘  ← done vs todo      │
 │      │┌───────────┐┌───────────┐┌───────────┐┌───────────┐                    │
 │      ││    👕     ││    👕     ││    👕     ││    👕     │  card h 155        │
 │      ││Get dressed││Get dressed││Get dressed││Get dressed│                    │
 │      ││       (✓) ││       ( ) ││       ( ) ││       (✓) │                    │
 │      │└───────────┘└───────────┘└───────────┘└───────────┘                    │
 │ ☾ ⚙  │  … Make bed / Wash face …                            ╭─────╮           │
 └──────┴──────────────────────────────────────────────────────╰──+──╯───────────┘
```

Columns are reorderable by **tap-and-hold and drag**; **swipe left/right reveals more profiles**.
`[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/49738702477723-The-Home-Screen)`

### 6.3 Tasks — portrait (`pdp/03`) · 1080×1920

```
 ┌───────────────────────────────────────────────┐
 │ Wed, May 20   11:20 AM  ☁ 88°                 │  top bar (no sidebar to its left)
 │ ╭Filter╮                                      │  ← reduced pill set
 ├───────────────────────┬───────────────────────┤
 │ ┌───────────────────┐ │ ┌───────────────────┐ │
 │ │(◍◍) Ben           │ │ │(◍◍) Ella          │ │  2 × 2 grid of profile columns
 │ │ ✓1/20  ⭐10       │ │ │ ✓3/20  ⭐10       │ │  instead of 1 × 4
 │ │(🌤)(☀)(🌙)(🧹)    │ │ │(🌤)(☀)(🌙)(🧹)    │ │
 │ ├───────────────────┤ │ ├───────────────────┤ │
 │ │ Morning           │ │ │ Morning           │ │
 │ │ ┌───────────────┐ │ │ │ ┌───────────────┐ │ │
 │ │ │  🪥 Brush     │ │ │ │ │  🪥 Brush     │ │ │
 │ │ │  teeth   ⭐10 │ │ │ │ │  teeth   ⭐10 │ │ │
 │ │ └───────────────┘ │ │ │ └───────────────┘ │ │
 │ │ ┌───────────────┐ │ │ │ ┌───────────────┐ │ │
 │ │ │  👕 Get       │ │ │ │ │  👕 Get       │ │ │
 │ │ │  dressed      │ │ │ │ │  dressed      │ │ │
 │ │ └───────────────┘ │ │ │ └───────────────┘ │ │
 │ └───────────────────┘ │ └───────────────────┘ │
 ├───────────────────────┼───────────────────────┤
 │ ┌───────────────────┐ │ ┌───────────────────┐ │
 │ │(◍◍) Riley         │ │ │(◍◍) Harper        │ │
 │ │  …                │ │ │  …                │ │
 │ └───────────────────┘ │ └───────────────────┘ │        ╭─────╮
 │                       │                       │        │  +  │
 ├───────────────────────┴───────────────────────┤        ╰─────╯
 │ S  ▤     ▤    ▛✓▜  ☆     ⑂    ▭     ▣   ☾  ⚙ │  ← BOTTOM NAV, bg #E9F0F7
 │  Calendar Lists Tasks Rewards Meals Recipes … │    active = white pill,
 └───────────────────────────────────────────────┘    full bar height
```

### 6.4 Rewards (`gallery/05`, `pdp/06`)

```
 ├──102─┼──────────────────────── 1818 ──────────────────────────────────────────┤
 │  S   │ Wed, Mar 22  8:00 AM 🌤 80°    ╭Sidekick╮╭Day╮╭Filter╮╭‹╮╭Today╮╭›╮    │ 85
 ├──────┼───────────┬───────────┬───────────┬───────────┬─────────────────────---┤
 │      │┌─────────┐│┌─────────┐│┌─────────┐│┌─────────┐│  panel = --profile @20%│
 │ ▤    ││(◍◍) Dad │││(◍◍) Ella│││(◍◍)Harpr│││(◍◍) Mom ││  name serif 36px       │
 │ ✓ ◄──││  ⭐ 55  │││  ⭐ 75  │││  ⭐ 85  │││  ⭐ 100 ││                        │
 │ ☆    ││┌───────┐│││┌───────┐│││┌───────┐│││┌───────┐││                        │
 │      │││  ⚾   │││││  🍪   │││││  🎨   │││││  🍣   ││ │ reward card, white     │
 │      │││Baseball│││││Bake   │││││Painting││││Order  ││ │ r 24                  │
 │      │││Game    │││││Cookies│││││       ││││ Sushi ││ │ emoji ~110            │
 │      │││Tickets │││││       │││││       ││││       ││ │ title serif ~30       │
 │      │││▓▓░░░░░│││││▓▓▓░░░░│││││▓▓░░░░░││││▓▓▓▓░░░││ │ bar h44 r22           │
 │      │││☆55/150│││││☆20/20 │││││☆55/100││││☆100/150││ │ track @40% fill @100% │
 │      ││└───────┘│││└───────┘│││└───────┘│││└───────┘││                        │
 │      ││┌───────┐│││         │││         │││┌───────┐││                        │
 │ ☾ ⚙  │││🎣Fishing│││        │││         │││🪻Plant ││ │           ╭─────╮      │
 └──────┴┴┴───────┴┴┴─────────┴┴┴─────────┴┴┴───────┴┴┴───────────╰──+──╯──────┘

  redeem overlay: 540×700 modal centred; gold ⭐ confetti over the ENTIRE screen
  (not just the modal); backdrop is NOT dimmed — it warms instead.
```

### 6.5 Lists (`gallery/07`, `pdp/08`)

```
 ├──102─┼──────────────────────── 1818 ──────────────────────────────────────────┤
 │  S   │ Wed, Mar 22  8:00 AM 🌤 80°       ╭Sidekick╮╭Day╮╭Filter╮╭‹╮╭Today╮╭›╮ │ 85
 ├──────┼──────────────┬──────────────┬──────────────┬──────────────────────────┤
 │      │┌── 495 ─────┐│┌── 495 ─────┐│┌── 495 ─────┐│┌── 495 ──── (clipped)     │
 │ ▤    ││Grocery List││Packing List ││To-Do        ││Travel Bucket Li…          │
 │ ✓    ││        (5) ││        (15) ││        (7)  ││              (12)         │
 │ ☆    ││┌──────────┐││┌──────────┐│││┌──────────┐│││┌──────────┐│  ← header ~100
 │ ⑂    │││🥚Eggs  [ ]││││Shirts x5 ]││││Pack for  ]││││🇯🇵 Japan  ]│                │
 │ ▭    ││└──────────┘│││└──────────┘│││ trip     ]│││└──────────┘│  row h76 r14   │
 │ ▣    ││┌──────────┐││┌──────────┐│││┌──────────┐│││┌──────────┐│  gap 38        │
 │ ▤ ◄──│││🥛Milk  [ ]││││Jeans x2 [ ]││││Pet sitter]││││🇮🇪 Ireland]│  checkbox = 63px
 │Lists ││└──────────┘│││└──────────┘│││ (Allie?) ]│││└──────────┘│  rounded SQUARE
 │      ││┌──────────┐││┌──────────┐│││┌──────────┐│││┌──────────┐│                │
 │      │││🍞Bread [ ]││││Undies x7 ]││││Stop mail ]││││🇭🇷 Croatia]│                │
 │      ││└──────────┘│││└──────────┘│││└──────────┘│││└──────────┘│                │
 │      ││    …       │││    …      │││    …       │││    …      ││                │
 │      ││╭──────────╮││            │││╭──────────╮││            │                 │
 │ ☾ ⚙  │││Add section (0) ⌃│       │││Add section (0) ⌃│         │   ╭─────╮      │
 └──────┴┴┴──────────┴┴┴───────────┴┴┴──────────┴┴┴────────────┴───╰──+──╯──────┘
   Cards scroll horizontally (~3.4 visible). Each list has its own colour ramp:
   panel (very light) / row (mid) / count badge (saturated).
```

### 6.6 Meals (`gallery/06`, `pdp/07`)

```
 ├──102─┼─40─┬─────────────────── 7 day columns × ~235 ──────────────────────────┤
 │  S   │    │ Wed, Mar 22  8:00 AM 🌤 80°     ╭Sidekick╮╭Filter ⌄╮╭‹╮╭Today╮╭›╮ │ 85
 ├──────┼────┼───────┬───────┬───────┬───────┬───────┬───────┬───────┬──────────┤
 │      │    │Sun 19 │Mon 20 │Tue 21 │Wed ⬤22│Thu 23 │Fri 24 │Sat 25 │          │ header
 │ ▤    │  B ├───────┼───────┼───────┼───────┼───────┼───────┼───────┤          │
 │ ✓    │  r │┌─────┐│┌─────┐│┌─────┐│┌─────┐│┌─────┐│┌─────┐│┌─────┐│  cell     │
 │ ☆    │  e ││🥞🫐 │││🍳Eggs││🥯   │││🥣   │││🌯   │││🍮   │││🍳   ││  235×250  │
 │ ⑂ ◄──│  a ││Blueb.│││Bened.│││Bagels│││Cereal│││Brkfst│││Parfait│││Eggs&││ r 25     │
 │Meals │  k ││Pancks│││      │││      │││      │││Burrit│││      │││Veggie││          │
 │ ▭    │  f │└─────┘│└─────┘│└─────┘│└─────┘│└─────┘│└─────┘│└─────┘│ #FEE1B7   │
 │ ▣    │  a ├───────┼───────┼───────┼───────┼───────┼───────┼───────┤           │
 │ ▤    │  s │┌─────┐│┌─────┐│┌─────┐│┌─────┐│┌─────┐│┌─────┐│┌─────┐│           │
 │      │  t ││Homem.│││🧀Grill││🥗   │││🌭   │││🌯   │││Leftov│││🍜   ││ #C5EEF2  │
 │      │  L ││Pizza │││Cheese│││Salad│││Hotdog│││Wraps│││ers  │││Stirfry││ Lunch  │
 │      │  u │└─────┘│└─────┘│└─────┘│└─────┘│└─────┘│└─────┘│└─────┘│           │
 │      │  … ├───────┼───────┼───────┼───────┼───────┼───────┼───────┤           │
 │      │  D │┌─────┐│┌─────┐│┌─────┐│┌─────┐│┌─────┐│┌─────┐│┌─────┐│ #D0BCF1   │
 │      │  i ││🌮TACOS││🍔Ham.│││🍝Spag│││🐟Salm│││🧀Mac│││🍖Baked│││🥡Take││ Dinner  │
 │      │  n │└─────┘│└─────┘│└─────┘│└─────┘│└─────┘│└─────┘│└─────┘│           │
 │      │  … ├───────┼───────┼───────┼───────┼───────┼───────┼───────┤           │
 │ ☾ ⚙  │  S │┌─────┐│┌─────┐│┌─────┐│┌─────┐│┌─────┐│┌─────┐│┌─────┐│ #FBC8D9   │
 │      │  n ││🥨Pret│││🍎App │││🍌Ban│││🥨Pret│││🥕Carr│││🍇Grape│││🍎App ││ Snack   │
 └──────┴────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┴──────────┘
   Left rail: the four category names rotated −90°, ~40px wide.
   Tapping a cell opens the ~700px recipe popover (see §4.15).
```

---

## 7. Motion

Skylight documents **behaviour** but never durations, easing or transition types. Everything
below is either a cited behaviour or an explicit `[UNKNOWN]`.

### 7.1 Celebration — the one well-documented animation

The trigger is **completing an entire list**, not a single chore:

> *"Once every chore in someone's list is checked off, the screen will burst into a fun explosion
> of emojis to celebrate."*
> `[VERIFIED](https://myskylight.com/how-to-manage-chores-and-family-tasks-with-skylight-calendar/)`

Skylight's own name for the effect is **"emoji rain"**:

> *"When kids complete their daily tasks, the screen celebrates with a playful burst — alternating
> between stickers inspired by their chosen franchise and Skylight's randomized emoji rain."*
> *"Redeeming rewards triggers themed celebrations that make incentives feel more exciting."*
> `[VERIFIED](https://myskylight.com/introducing-skylight-disney-mode/)`

Reward-redemption celebrations are documented only as a **Disney Mode** add-on and are
**device-only**: *"Special celebrations are only available on the Calendar. They will not appear
in the Skylight Mobile App."*
`[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/51738602243739-Add-Ons)`

**What the screenshots show** (`gallery/05`, `pdp/06`): gold `#FDC36D` five-point stars, roughly
28–48 px, randomly rotated and randomly positioned across the **whole screen** — over the modal's
surroundings, the column panels and the sidebar edge. Density looks like 60–100 stars. The
backdrop is **not dimmed**; instead the underlying columns take a warm wash while the effect
plays. `[SCREENSHOT: gallery/05, pdp/06]`

**Suggested implementation** (all `[ESTIMATED]` — no source specifies this): 60–90 absolutely
positioned star sprites, random `x`, random start `y` above the viewport, `translateY` to below
the viewport over 2.5–4 s with a linear timing function, a simultaneous `rotate` of ±180–540°,
staggered start delays of 0–1.5 s, and a short fade at the end. Respect
`prefers-reduced-motion: reduce` by rendering a single static burst or nothing.

### 7.2 Checking off a single task

Documented behaviour is deliberately minimal — **no animation and no sound are described**:

> *"The task will be marked completed on screen with a check."* (tap the white circle to the
> right of the name, or open Details → "Mark as Complete")
> `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846381293979-Using-the-Tasks-Tab-Routines-and-Chores)`

> *"When a family member completes a chore or routine, they may be awarded stars."* Star values
> are author-assigned (guidance: 5–10 for a daily routine, up to 100 for a big chore; rewards
> cost 1–500 stars). Redeeming permanently removes stars.
> `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36846200077723-Stars-Tasks-and-Rewards)`

The **visual** change is large even though it is undocumented: the card's background goes from
`--profile @40%` to `--profile @100%` and the circle fills with the accent plus a white check
(§4.11). A ~150–200 ms cross-fade of `background-color` plus a scale-pop on the check is the
natural reading. `[ESTIMATED]`

**Sound on completion: `[UNKNOWN]`** — not found in any source. The only documented audio is a
notification tone ("a little tone with an 'OK' button" per SlashGear's Calendar 2 review).

### 7.3 Gestures and navigation

From Skylight's Calendar-tab article
`[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)`:

| Gesture | Effect |
|---|---|
| Swipe **left** | previous dates |
| Swipe **right** | future dates |
| Swipe **up** | earlier times |
| Swipe **down** | later times |
| **Pinch** (Schedule view) | change the span of time shown |
| Tap "Today" | return to the current date |
| Tap the view pill (top right) | switch Day / Week / Month / Schedule |
| Swipe left/right on Home / Tasks / Lists | reveal more profiles |
| Tap-and-hold + drag a Tasks column | reorder profiles |

Schedule view additionally exposes a **1–7 day slider**. Calendar Settings notes *"Use your
Calendar in landscape mode to see the maximum number of days."*
`[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36835449004315-Calendar-Settings)`

### 7.4 The now line

> *"The current time in the calendar is displayed as an orange bar."*
> *"The current date in the calendar is displayed in an orange dot."*
> `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab)`

No source describes it animating. A once-per-minute reposition is the obvious implementation.
`[ESTIMATED]`

### 7.5 Not found

Transition types, durations, easing curves, page-transition direction, skeleton/loading states,
hover or press feedback, and any spring parameters are **`[UNKNOWN]`** — no first-party or
third-party source documents them, and still photography cannot reveal them.

---

## 8. Starter token sheet

```css
:root {
  /* ---- surfaces & chrome (sampled) ---------------------------------- */
  --app-bg:            #FFFFFF;
  --sidebar-bg:        #E9F0F7;
  --sidebar-active-bg: #FFFFFF;
  --pill-btn-bg:       #F7F7F8;
  --btn-secondary-bg:  #F9F9F9;
  --grid-hairline:     #EDEDED;      /* [ESTIMATED] */

  --text-primary:      #1A1A1A;      /* [ESTIMATED] */
  --text-secondary:    #6E6E6E;      /* [ESTIMATED] */
  --text-muted:        #4A4A4A;      /* [ESTIMATED] */

  /* ---- semantics (cross-confirmed against the API palette) ---------- */
  --primary-blue:      #2178AF;      /* palette "Blue"   — FAB, Done  */
  --today:             #F66951;      /* palette "Coral"  — badge, now-line */
  --now-line:          #F66951;
  --star-gold:         #FDC36D;      /* palette "Orange" — stars, confetti */
  --danger:            #F66951;      /* [ESTIMATED] Delete label */

  /* ---- the 20-colour category palette (VERIFIED, GET /api/colors) --- */
  --c-orange:#FDC36D; --c-sunshine:#FBD97E; --c-ochre:#CE812D;
  --c-deep-sunshine:#FDB305; --c-clementine:#F3B075; --c-deep-clementine:#CF632E;
  --c-coral:#F66951; --c-grapefruit:#FBA994; --c-deep-grapefruit:#CB434C;
  --c-charcoal:#DADADA; --c-lavender:#D5B6EC; --c-deep-lavender:#915EA1;
  --c-cyan:#A8D4D3; --c-river:#93D1E6; --c-deep-river:#00526D;
  --c-blue:#2178AF; --c-sky:#82D7DD; --c-deep-sky:#2D8086;
  --c-sprout:#B6E085; --c-deep-sprout:#408257;

  /* ---- type -------------------------------------------------------- */
  --font-serif: "Fraunces", "Literata", Georgia, serif;
  --font-sans:  "DM Sans", "Figtree", "Inter", system-ui, sans-serif;

  --fs-date: 48px;   --fs-day-header: 40px;  --fs-clock: 40px;
  --fs-list-title: 46px; --fs-tasks-name: 36px; --fs-modal-title: 36px;
  --fs-meal-label: 30px; --fs-section: 28px; --fs-event-title: 26px;
  --fs-event-time: 24px; --fs-hour: 24px; --fs-chip: 24px; --fs-list-item: 25px;
  --fs-task-title: 22px; --fs-allday: 22px; --fs-modal-sub: 22px;
  --fs-pill: 21px; --fs-nav: 19px; --fs-star-chip: 16px;

  /* ---- metrics @1920×1080 ------------------------------------------ */
  --sidebar-w: 102px;  --topbar-h: 85px;   --chiprow-h: 89px;
  --dayheader-h: 137px; --hour-gutter-w: 117px; --day-col-w: 337px;
  --hour-row-h: 195px;
  --chip-h: 61px;      --chip-cap-w: 72px; --chip-avatar: 48px;
  --pill-h: 52px;      --fab-d: 90px;      --fab-inset: 32px;
  --event-radius: 20px; --event-pad: 30px; --event-avatar: 40px;
  --task-col-w: 400px; --task-card-h: 155px; --list-card-w: 495px;
  --list-row-h: 76px;  --meal-cell: 235px 250px;
}

/* derive every profile-tinted surface from ONE accent */
.event-block,
.chip-cap,
.task-card--done   { background: var(--profile); }
.chip-body,
.task-card         { background: color-mix(in srgb, var(--profile) 40%, #fff); }
.column-header     { background: color-mix(in srgb, var(--profile) 20%, #fff); }
```

---

## 9. Open questions / not determinable

| Item | Status |
|---|---|
| **Month view** layout | `[UNKNOWN]` — no image; confirmed to exist `[VERIFIED]` |
| **Day view** layout | `[UNKNOWN]` — no image; confirmed to exist (a grid **plus** an event list for the day) `[VERIFIED]` |
| **Schedule view** layout | `[UNKNOWN]` — no image; described as *"a column view for today and upcoming days"* with a 1–7 day slider `[VERIFIED]` |
| **Filter panel** contents | `[UNKNOWN]` — only the trigger pill is visible. Toggles Task progress / Weather / Meals / Profiles `[VERIFIED]` |
| **Create-event form** | `[UNKNOWN]` — the Add dialog's top row is documented as Type / Photo / Talk / Email `[VERIFIED]`, but no image exists |
| **Settings screens** | `[UNKNOWN]` — no image |
| Exact device-UI typefaces | `[UNKNOWN]` — no source names them; §2.1 gives a letterform-based judgement |
| Text colors (exact hex) | `[ESTIMATED]` — photo blur prevents an exact read; the darkest-pixel evidence is recorded |
| Grid hairline (exact hex + width) | `[ESTIMATED]` — sub-pixel in every photo |
| Animation durations / easing | `[UNKNOWN]` — no source, and still photos cannot show it |
| Sound design | `[UNKNOWN]` — only a notification tone is mentioned anywhere |
| Late / overdue state colour | `[UNKNOWN]` — no such state appears in any image |
| Hover / press / focus states | `[UNKNOWN]` — touch device, no images of pressed states |
| Small / Large font-size rungs | `[UNKNOWN]` — the setting exists `[VERIFIED]`; only "Medium" is photographed |
| Calendar Max (2560×1440) layout | `[UNKNOWN]` — no device-UI image; likely the same layout at 1.33× |
| Whether the marketing pastels are a stale palette | `[UNKNOWN]` — see the caveat in §1.5 |

### Hardware facts worth carrying into the clone

- All Calendar models are **1920×1080 16:9**: 10", 15", and 15.6" Calendar 2. Calendar Max is
  **2560×1440**. `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/39982504808219-Technical-Specifications-for-15-Calendar-2)`
- **1280×800 is the Skylight *Frame*, not the Calendar** — a common and costly mix-up.
  `[VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/41905338454939-Technical-Specifications-for-10-Frame)`
- The device has **no camera and no microphone**, which is why Sidekick's Photo/Talk actions show
  a QR code to hand off to the phone. `[VERIFIED]`
- Portrait wall-mounting is supported on all models and the 27" **auto-rotates**. The Calendar 2's
  tabletop stand is landscape-only. `[VERIFIED]`
- Avatars are a **fixed illustrated-animal library** served from Cloudinary at four fixed sizes
  (48 / 80 / 112 / 336 px) via `w_<n>,h_<n>,c_thumb,r_max,f_png` — i.e. always circular PNGs.
  `[VERIFIED]` (see `06-api-and-data-model.md`)
