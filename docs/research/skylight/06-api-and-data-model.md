# Skylight Calendar — Unofficial API & Data Model (reverse-engineered)

> **STATUS: COMPLETE.** Every fact carries `[VERIFIED](url)`, `[INFERRED]`, or `[UNKNOWN]`. Remaining gaps are listed under Open Questions.

**Subject:** the unofficial/reverse-engineered Skylight Calendar (myskylight.com, `app.ourskylight.com`) backend API, as documented by open-source clients (Home Assistant integrations, an async Python client verified against a live account and live hardware, and two independent OpenAPI specs generated from captured browser/app traffic).
**Purpose:** exhaustive reference of real field names, enums, and JSON shapes so a clone's data model matches Skylight's semantics exactly.
**Date compiled:** 2026-08-28.

Skylight has no official public API. All information below comes from open-source projects that reverse-engineered the private API used by the Skylight web/mobile apps and the Calendar/Frame device. Field names, endpoint paths, and enum values are copied **verbatim** in code formatting from source. Any credentials/tokens encountered are already redacted upstream (`REDACTED`) or are further redacted here.

## Evidence tags
| Tag | Meaning |
|---|---|
| `[VERIFIED](url)` | Directly present in a cited repo's source/README/fixture/OpenAPI example. |
| `[INFERRED]` | Reasonably inferred from adjacent verified facts, not directly stated. |
| `[UNKNOWN]` | Not determinable from available material at research time. |

## Table of contents
- Projects found (repo inventory)
- Base URL(s) and API surface
- Authentication
- Frames (devices/households)
- Avatars & Colors (shared reference data)
- Categories / Profiles (people & labels)
- Family members
- Calendar events
- Chores / Routines / Task Box
- Nudges (spoken reminders)
- Rewards & reward points
- Lists & list items
- Meals: categories, recipes, sittings
- Photos / Messages / Albums
- Auto-creation intents (AI list/recipe import)
- Event notification settings
- Users / Sessions
- Errors
- Rate limits, pagination, real-time behavior
- Android/web app architecture
- Community discussion (HA forum, Reddit)
- Open questions
- Sources

---

## Projects found (repo inventory)

| Repo | What it is | Language | Notes |
|---|---|---|---|
| `TheEagleByte/skylight-api` | HAR-to-OpenAPI converter + generated **OpenAPI 3.0.3 spec** (781KB YAML, ~38 endpoints) reverse-engineered from captured browser network traffic against the real Skylight web app | TypeScript (tool) + YAML (spec) | **Primary source for this document** — the spec embeds real request/response JSON examples with redacted PII but real field names, enums, and structure. `[VERIFIED](https://github.com/TheEagleByte/skylight-api)` |
| `TheEagleByte/skylight-mcp` (npm: `@eaglebyte/skylight-mcp`) | MCP server letting AI assistants (Claude, etc.) manage calendar, chores, lists, meals, rewards | TypeScript | Built on top of the same reverse-engineered API; "powers" relationship confirmed in skylight-api's README. `[VERIFIED](https://github.com/TheEagleByte/skylight-mcp)` |
| `dknowles2/pyskylight` | Python library for the Skylight API; powers the `ha-skylight` Home Assistant integration | Python | Repo referenced by `ha-skylight` README but not directly fetched (rate/time constraints). `[VERIFIED](https://github.com/dknowles2/ha-skylight)` (reference), library itself `[UNKNOWN]` in detail |
| `dknowles2/ha-skylight` | Home Assistant custom integration for Skylight calendar frames + chore charts, built on `pyskylight` | Python | Exposes chores, rewards, lists, calendar, display controls as HA entities; polling-based (1 min refresh). `[VERIFIED](https://github.com/dknowles2/ha-skylight)` |
| Gist: `dknowles2/b8eab833eb23eb388c3d78999a3565f8` ("Skylight REST API Documentation") | Standalone API documentation gist by the same author as `pyskylight`/`ha-skylight` | Markdown | Documents a **different/additional auth flow** (OAuth 2.0 + PKCE via `/oauth/authorize` and `/oauth/token`) than the OpenAPI spec's simple `POST /api/sessions`. Both are plausible: OAuth+PKCE for the mobile app, direct session POST for the web app / other clients. `[VERIFIED](https://gist.github.com/dknowles2/b8eab833eb23eb388c3d78999a3565f8)` |
| `riyadchowdhury/ha-skylight-tasks` | Home Assistant custom integration to create chores programmatically via HA actions/services | Python | Auto-sets today's date on new chores, auto-reauthenticates on token expiry; setup needs Skylight email/password + Frame ID. `[VERIFIED](https://github.com/riyadchowdhury/ha-skylight-tasks)` |
| `chrischall/skylight-mcp` | Another, independent MCP server: "read/write family calendar events, chores, rewards, and shared lists" | Unknown (likely TS/Python) | Not deeply fetched; listed as a distinct project from TheEagleByte's. `[VERIFIED](https://github.com/chrischall/skylight-mcp)` (existence only) |
| `rjhalvorson/skylight-mcp` | Another MCP server repo (has a `CLAUDE.md`) | Unknown | Existence only; not fetched in depth. `[VERIFIED](https://github.com/rjhalvorson/skylight-mcp)` |
| `lancereinsmith/claude-skylight-plugin` | "A Claude skill and MCP for managing events in a Skylight calendar," described elsewhere as adding/reading/deleting events via the unofficial `app.ourskylight.com` API | Unknown | Existence only. `[VERIFIED]` (search result) |
| `logich/Skylight-swift` — `skylight_api_resources.md` | A Swift-oriented project whose markdown doc is mostly a **curated list of the other tools above** (skylight-mcp, `ramseys1990/Skylight`) rather than raw API docs itself | Markdown | Documents endpoint *patterns* like `/api/frames/{frameId}/chores`, `/api/frames/{frameId}/calendar`, `/api/frames/{frameId}/lists`, `/api/frames/{frameId}/tasks`, `/api/frames/{frameId}/family`, `/api/frames/{frameId}/rewards` — these look like paraphrased/simplified path names rather than the literal API (compare to the OpenAPI spec's actual paths below, e.g. real chores path has no `/family` or generic `/tasks` resource). Treat with caution. `[VERIFIED](https://github.com/logich/Skylight-swift/blob/main/skylight_api_resources.md)` (existence/content), path accuracy `[UNKNOWN]`/likely paraphrase |
| `ramseys1990/Skylight` | Python scraper that extracts calendar info and generates `.ics` files (not proper API client — likely scrapes or uses a narrower endpoint) | Python | Referenced from logich's doc; not independently fetched. `[VERIFIED]` (existence only) |
| `MegaTheLEGEND/skylight_calendar` | HACS-installable Home Assistant integration ("Integrate skylight calendar into home assistant") | Unknown | Existence only. `[VERIFIED](https://github.com/MegaTheLEGEND/skylight_calendar)` |
| `kylebjordahl/skylight-calendar-home-assistant` | Home Assistant custom component for Skylight Calendar | Unknown | Existence only. `[VERIFIED](https://github.com/kylebjordahl/skylight-calendar-home-assistant)` |
| `mohesles/my-skylight-calendar` | Unknown-purpose repo surfaced in search | Unknown | Existence only, not fetched. `[UNKNOWN]` beyond name |
| `superdingo101/daylight-calendar-card` (formerly "skylight-calendar-card") / `tienou/ha-skylight-family-calendar-card` | Home Assistant **dashboard cards** styled after Skylight, not API clients | JS/HA frontend | Frontend-only projects, not API sources; noted for completeness. `[VERIFIED]` (existence) |

| `dknowles2/pyskylight` (full detail) | Async Python client, on PyPI. **The single best source found for this dossier** — its `docs/api-notes.md` documents endpoints *verified live against a real Skylight account and a real activated `15-CAL-2.0` calendar display*, including writes exercised (and cleaned up) against a throwaway test frame. It explicitly reconciles two independent OpenAPI reverse-engineering efforts (`TheEagleByte/skylight-api` and `mightybandito/Skylight`) and a hand-written endpoint gist, calling out exactly where each is wrong or incomplete. | Python | `[VERIFIED](https://github.com/dknowles2/pyskylight)` — README, `docs/api-notes.md`, and `pyskylight/models.py` all fetched and read in full. |
| `mightybandito/Skylight` | A **second, independent** OpenAPI 3.0.3 spec (v0.3.0), also reverse-engineered from captured traffic — distinct from `TheEagleByte/skylight-api` (barely overlapping coverage, per `pyskylight`'s notes). Documents 12 paths including `GET /api/frames/{frameId}` (frame details), `GET /api/frames/{frameId}/devices` (device list), `GET /api/frames/{frameId}/source_calendars`, and a JSON:API-wrapped `POST /chores` — the last of which `pyskylight`'s live-write testing proved is **not actually how the live API accepts writes** (see Chores section). | YAML | `[VERIFIED](https://raw.githubusercontent.com/mightybandito/Skylight/main/docs/openapi/openapi.yaml)` |

**Most valuable sources:** `TheEagleByte/skylight-api`'s `docs/openapi/openapi.yaml` — downloaded directly (20,053 lines) and read in full, containing real observed JSON:API-style request/response bodies from the live web app at `app.ourskylight.com` — and `dknowles2/pyskylight`'s `docs/api-notes.md` (485 lines) plus `pyskylight/models.py` (613 lines), which go further: they document fields and behavior **verified by actually calling the live API** (36/36 GET calls, 34/34 write calls against a disposable test frame, plus direct testing against real activated hardware), catching several places where the two OpenAPI specs are simply wrong (e.g. the "JSON:API-wrapped write body" both specs show is not what the live API accepts). All field-name tables and JSON examples below, unless otherwise cited, come from one of these two sources; where `pyskylight`'s live-verified notes **correct or extend** the OpenAPI spec's captured examples, that is called out explicitly. `[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)`, `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`, `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/pyskylight/models.py)`

---

## Base URL(s) and API surface

- Base URL: **`https://app.ourskylight.com`**, all resource paths under **`/api/...`**. `[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)` (`servers: - url: https://app.ourskylight.com`)
- The web app itself (distinct from the API host) is `ourskylight.com` (no `app.` prefix) — used as the OAuth redirect target in the gist's flow (`redirect_uri=https://ourskylight.com/welcome`). `[VERIFIED](https://gist.github.com/dknowles2/b8eab833eb23eb388c3d78999a3565f8)`
- API responses follow a **JSON:API-flavored** convention: a top-level `data` object/array with `id`, `type`, `attributes`, and `relationships`, plus a sideloaded `included` array for related resources, and sometimes a `meta` object. `[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)` — explicitly called out in the spec's `info.description`: *"JSON:API-style resources are common (type, id, attributes, relationships)."*
- Backend is Rails-based: response headers include `x-runtime` (Rails' request-timing header) and the auth gist describes a Rails CSRF `authenticity_token` flow at `app.ourskylight.com`. `[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)` (headers), `[VERIFIED](https://gist.github.com/dknowles2/b8eab833eb23eb388c3d78999a3565f8)` (CSRF/Rails)
- Fronted by Cloudflare: every response carries `cf-cache-status`, `cf-ray`, `nel` (Network Error Logging) headers. `[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)`
- Media assets (avatars, category profile pictures) are served from **Cloudinary** at `skylight-frame-res.cloudinary.com`. `[VERIFIED]` (see Avatars section below)
- Message/photo attachments are served from a **CloudFront** distribution (`d31bkqsbdz9wty.cloudfront.net`) backed by an S3-style bucket named `darkroom-production`, with signed/expiring URLs (`Expires`, `Signature`, `Key-Pair-Id` query params). `[VERIFIED]` (see Photos/Messages section below)
- No top-level `GET /api/frames` (list all frames for the account) or `GET /api/frames/{id}` (single frame details) endpoint appears in the captured HAR-derived spec — the capture session evidently always operated within one already-selected frame. This is a **gap**, not proof the endpoint doesn't exist; the gist independently confirms endpoints `GET /api/frames`, `POST /api/frames`, `GET /api/frames/:frameId`, `PUT /api/frames/:frameId`, `POST /api/frames/:frameId/hide` exist. `[VERIFIED](https://gist.github.com/dknowles2/b8eab833eb23eb388c3d78999a3565f8)` (paths only, no schemas)

---

## Authentication

Two authentication mechanisms are documented by different sources — likely because they were captured from **different clients** (mobile app vs. web app) or represent old/new flows. Both are given verbatim.

### Mechanism A — Simple session POST (from the OpenAPI spec, i.e. observed live web-app traffic)

```
POST /api/sessions
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "REDACTED"
}
```

Response (200):
```json
{
  "data": {
    "attributes": {
      "email": "user@example.com",
      "subscription_status": "plus",
      "token": "REDACTED_TOKEN"
    },
    "id": "12677864",
    "type": "authenticated_user"
  },
  "meta": {
    "password_reset": true
  }
}
```
`[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)`

- `subscription_status` enum observed value: `"plus"` (i.e. Skylight Plus subscriber). Other values `[UNKNOWN]` (likely `"free"`/`"none"`/similar).
- `meta.password_reset: true` in the example — meaning/trigger condition not explained by the spec; possibly indicates "user must reset password" or is an artifact of the specific captured request. `[UNKNOWN]` semantics.
- Every request declares both auth schemes as acceptable:
  ```yaml
  security:
    - bearerAuth: []
    - basicToken: []
  ```
  with `bearerAuth` defined as `type: http, scheme: bearer, bearerFormat: JWT` and `basicToken` as `type: http, scheme: basic` with the note *"Observed Authorization header uses an opaque Basic token. Treat as secret."* `[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)` — meaning the web app was observed sending **either** a `Bearer <JWT>` **or** an `Authorization: Basic <opaque token>` header (not classic HTTP Basic user:pass — an opaque token used with the Basic scheme, presumably `token` from the session response above, base64'd).
- A companion endpoint, `POST /api/users`, appears to be a "check if this email is known" / pre-signup probe:
  ```
  POST /api/users
  { "email": "user@example.com", "emailValid": true, "has_an_account": false, "on_mobile": true }
  ```
  Response: `{ "data": { "attributes": { "email": "..." }, "id": "...", "type": "user" }, "meta": { "knows_password": true } }`. `[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)` — `meta.knows_password` suggests this is used by the login UI to decide whether to show a password field or an "invite/signup" flow.

### Mechanism B — OAuth 2.0 + PKCE (from the `dknowles2` gist, presumably the mobile app flow)

```
GET https://app.ourskylight.com/auth/session/new
```
→ HTML page with CSRF token in `<meta name="csrf-token" content="<token>">`.

```
GET https://app.ourskylight.com/oauth/authorize
  ?client_id=skylight-mobile
  &response_type=code
  &scope=everything
  &redirect_uri=https://ourskylight.com/welcome
  &state=<random_state>
  &code_challenge=<S256_hash>
  &code_challenge_method=S256
```

```
POST https://app.ourskylight.com/auth/session
Content-Type: application/x-www-form-urlencoded

authenticity_token=<from meta tag>&email=user@example.com&password=password123
```
→ `302` redirect to `https://ourskylight.com/welcome?code=<code>&state=<state>`.

```
POST https://app.ourskylight.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&client_id=skylight-mobile&code=<auth_code>&redirect_uri=https://ourskylight.com/welcome&code_verifier=<PKCE_verifier>
```
Response:
```json
{ "access_token": "...", "refresh_token": "...", "expires_in": 3600, "token_type": "Bearer" }
```

Sign-out: `POST https://app.ourskylight.com/oauth/revoke`. `[VERIFIED](https://gist.github.com/dknowles2/b8eab833eb23eb388c3d78999a3565f8)`

- `client_id` value `skylight-mobile` strongly implies this is the flow used specifically by the **native mobile app** (`scope=everything` is also mobile-app-flavored — a broad, single-scope grant). `[INFERRED]`
- The gist separately notes standard headers sent on authenticated calls: `User-Agent: SkylightMobile (web)`, `Skylight-Api-Version: 2026-05-01`, `Accept: application/json`. `[VERIFIED](https://gist.github.com/dknowles2/b8eab833eb23eb388c3d78999a3565f8)` — the `Skylight-Api-Version` header (date-versioned, like Stripe's) is a notable finding: it implies the API is explicitly versioned by request header rather than by URL path.
- Reconciling A and B: `pyskylight`'s `docs/api-notes.md` resolves this directly rather than leaving it inferred — **the OAuth 2.0 + PKCE flow (Mechanism B) is the real, current one**, and `pyskylight` implements it end-to-end as its only supported login flow (`pyskylight/auth.py`, class `PasswordAuth`). The `Authorization: Basic <opaque token>` scheme that `TheEagleByte/skylight-api`'s spec captured (Mechanism A's `basicToken` security scheme) is explained as *"almost certainly a legacy token seen in older captures"* — and the gist independently documents a corroborating endpoint: `POST /api/oauth/legacy_token_exchange`, i.e. an explicit migration path for exchanging an old-style opaque token for a modern one. `pyskylight` still supports consuming a pre-obtained token directly via a `TokenAuth` class (for a client that already captured one, e.g. by proxying the app once), but cannot refresh it — a rejected `TokenAuth` token raises `AuthenticationError`. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`, `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/README.md)`
- Additional auth mechanics from `pyskylight`'s README: `PasswordAuth` never follows the OAuth flow's final redirect — it reads the authorization code straight out of the `Location` response header — and the Rails `skylightcloud_session` cookie set at step 1 is confined to a private cookie jar for the duration of the login. `PasswordAuth` also proactively refreshes the access token before it expires (using `expires_in` from the token response), rather than waiting for a 401. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/README.md)`
- `POST /api/sessions` (Mechanism A) may simply be a **separate, additional login endpoint used by the web app specifically** rather than a deprecated flow — `TheEagleByte/skylight-api`'s capture is from `app.ourskylight.com`'s own web client, and it's plausible the web app never runs the redirect-based OAuth dance at all, instead calling `/api/sessions` directly and receiving a token good enough for `/api/...` calls. This is not fully disambiguated by any source. `[INFERRED]`

### Password reset
`POST /api/password_resets` `[VERIFIED](https://gist.github.com/dknowles2/b8eab833eb23eb388c3d78999a3565f8)` (path only, body schema `[UNKNOWN]`)

### User profile management
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/user` | Fetch profile `[VERIFIED](https://gist.github.com/dknowles2/b8eab833eb23eb388c3d78999a3565f8)` |
| `PUT` | `/api/user` | Update profile `[VERIFIED]` |
| `DELETE` | `/api/user` | Delete account `[VERIFIED]` |

(Note: singular `/api/user`, distinct from plural `/api/users` used for the pre-signup email-check POST above.)

---

## Frames (devices/households)

A "Frame" is Skylight's internal name for a household/account-level container — effectively one physical Calendar device's household data (or the account households map to before a physical device is even provisioned). Every resource in the API is scoped under `/api/frames/{id}/...`. `[VERIFIED]` (path structure, pervasive throughout the OpenAPI spec)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/frames` | List frames for the account `[VERIFIED](https://gist.github.com/dknowles2/b8eab833eb23eb388c3d78999a3565f8)` (path only) |
| `POST` | `/api/frames` | Create a frame `[VERIFIED]` (path only) |
| `GET` | `/api/frames/:frameId` | Frame details `[VERIFIED]` (path only) |
| `PUT` | `/api/frames/:frameId` | Update frame `[VERIFIED]` (path only) |
| `POST` | `/api/frames/:frameId/hide` | Hide a frame (e.g. remove from a user's visible list without deleting) `[VERIFIED]` (path only) |

The example `id` used pervasively throughout the OpenAPI spec's other endpoints is `"4418006"`. `[VERIFIED]` (appears as the default/example frame ID on ~30 endpoints in that spec)

`ha-skylight`'s config flow lets a user "choose which frames to show," implying an account can have multiple frames (e.g. multiple physical devices/households) and per-integration frame selection. `[VERIFIED](https://github.com/dknowles2/ha-skylight)`

### Frame attributes — full schema (verified live, 36 fields)

`pyskylight`'s `docs/api-notes.md` states plainly that "**attribute coverage is much wider than either [OpenAPI] source documented** — frames carry 36 attributes (sleep schedule, slideshow settings, feature bundle, share token)," all of which are now modeled in `pyskylight/models.py`'s `Frame` dataclass. Field list, verbatim from that source:

| Field | Type | Meaning |
|---|---|---|
| `name` | string | Frame/device display name |
| `household_name` | string | The family/household's name |
| `timezone` | string | IANA timezone |
| `access` | string | Access-level string (values not enumerated) |
| `mine` | boolean | Whether the requesting user owns this frame |
| `plus` | boolean | Whether this frame has Skylight Plus |
| `activated` | boolean | Whether hardware has been paired/activated |
| `activated_at` | datetime | |
| `user_created_at` | datetime | |
| `destroyed_at` | datetime or null | Soft-delete timestamp |
| `apps` | array of strings | Enabled app/tab list (relates to `feature_bundle` below) |
| `feature_bundle` | object | See below |
| `brightness` | integer | **Display setting — writes here are silently ignored; see below** |
| `blur_effect` | boolean | Same caveat |
| `current_album_id` | integer | Currently-displayed photo album |
| `currently_sleeping` | boolean | Live sleep-state flag |
| `sleep_mode_on` | boolean | Whether sleep mode is enabled at all |
| `sleeps_at` | string (`"HH:MM"`) | Sleep schedule start |
| `wakes_at` | string (`"HH:MM"`) | Sleep schedule end |
| `slideshow_speed` | integer | |
| `slideshow_style` | integer | |
| `side_by_side` | boolean | Side-by-side photo display mode |
| `show_caption` | boolean | |
| `show_heart` | boolean | "Like"/heart reaction display toggle |
| `start_sound` | boolean | |
| `message_viewability` | string | Who can see photo messages (values not enumerated) |
| `notification_email` | string | |
| `open_to_public` | boolean | |
| `share_token` | string | Token for a shareable invite/join link |
| `gift_status` | string | Gifting-flow state (values not enumerated) |
| `gift_recipient_name` | string | |
| `trialing` | boolean | In a free-trial period |
| `trial_expires_at` | datetime | |
| `assistant_household_id` | string | Links to some kind of "assistant"/voice-household id |
| `hardware_model` | string | **Only present here, not on the device or the frame-list endpoint** — observed value `"15-CAL-2.0"` |
| `owner_name` | string | |
| `owner_birthday` | date | |
| `device_ids` | array (relationship → `devices`) | |
| `user_id` | string (relationship → `user`) | |

`[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/pyskylight/models.py)`, cross-referenced against `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

**Critical write-path gotcha, verified against real hardware:** display-related fields (`brightness`, `sleeps_at`, `wakes_at`, `slideshow_speed`, `show_caption`, etc.) *look* like frame attributes and are accepted by `PUT /api/frames/{id}` with a `200` response — but **nothing actually changes**. Those settings live on the **device** sub-resource, not the frame, and only `PUT /api/frames/{frameId}/devices/{deviceId}` actually applies them. This is a silent no-op, not an error — `pyskylight`'s README calls it out as "the worst kind of failure for a client" and its `update_frame()` method carries an explicit warning for this reason. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/README.md)`, `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

`hardware_model` is notable: it is present **only** on `GET /api/frames/{id}` (single-frame detail), omitted entirely from the list-all-frames response, and not present on the device resource either. Observed value: `"15-CAL-2.0"` — i.e. Skylight's internal model code for (presumably) the Calendar 2.0 hardware generation. `[VERIFIED]`

### `feature_bundle`
An object on the frame, keyed by feature name, each value `{"enabled": bool}` — roughly 20+ keys observed including `albums`, `chores`, `timers`, `screensaver`, under an overall `bundle_name` (observed value `cal_plus` on a Plus-subscribed calendar). This is the frame's capability/entitlement map — **but it is incomplete**: neither `alarms` nor `nightlight` appear in it, even on devices where those fields are present and writable (see Device below). `pyskylight`'s notes conclude "there is no capability map covering any of this" and that `role` (on the Device resource) is "the only signal" for gating hardware-specific features. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)` — the exact full key list beyond `albums`/`chores`/`timers`/`screensaver` is `[UNKNOWN]` (only a partial list was quoted).

### Device — `GET/PUT /api/frames/{id}/devices`, `/api/frames/{id}/devices/{deviceId}`

A **separate resource from the frame**, one row per physical hardware unit paired to a household (a frame can have more than one device — e.g. a Calendar plus a Buddy). 24 attributes, verified live:

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `role` | string or `null` | **The capability discriminator.** Observed value `"buddy"` on a Skylight Buddy device; `null` on a calendar/photo display. See below. |
| `activated` | boolean | |
| `timezone` | string | |
| `category_id` | integer | |
| `brightness` | integer | **This is where display brightness actually applies** (unlike the same-named frame field) |
| `blur_effect` | boolean | |
| `current_album_id` | integer | |
| `currently_sleeping` | boolean | |
| `sleep_mode` | string | Enum, only partially confirmed — see below |
| `sleep_mode_on` | boolean | |
| `sleeps_at` | string (`"HH:MM"`) | **The actual, effective sleep-schedule start time** |
| `wakes_at` | string (`"HH:MM"`) | **The actual, effective sleep-schedule end time** |
| `sleep_sound` | string or `null` | Buddy-only in practice (see below); `null` on a calendar |
| `sleep_sound_volume` | integer | Stored/writable even on non-Buddy hardware |
| `nightlight` | boolean | Buddy-only in practice; writable and persisted on a calendar display too, but has no effect there |
| `nightlight_brightness` | integer | Same caveat |
| `nightlight_color` | string enum | See `NightlightColor` below |
| `slideshow_speed` | integer | |
| `slideshow_style` | integer | |
| `side_by_side` | boolean | |
| `show_caption` | boolean | |
| `show_heart` | boolean | |
| `start_sound` | boolean | |

`[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/pyskylight/models.py)`, `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)` — "Writable on a device (all verified, changed and restored)" per the live-hardware test pass.

**`nightlight_color` enum** — probed against a live display: accepted values `off`, `red`, `orange`, `yellow`, `green`, `blue`, `pink`; rejected (`422 Nightlight color is not included in the list`): `white`, `warm`, `purple`. `[VERIFIED]`

**`sleep_mode` enum — only partially known.** Guessed candidate values `off`, `nightlight`, `dim`, `clock_only`, `photo`, `sleep_sound` were all tried against a live `15-CAL-2.0` and **every one returned `HTTP 500`** (a server error, not a `422` validation error) — implying those modes may require additional configuration to select, or are simply wrong guesses, but the 500 (rather than 422) makes it impossible to distinguish "invalid value" from "valid value, missing prerequisite" by probing alone. Reverse-engineering the vendor's own web-client JS bundle later turned up the real pair of values from its `buddyConstants`: **`screen_off`** and **`dim_clock`** — but this was *not itself re-verified against live hardware* (i.e. these two strings are believed correct but unconfirmed by an actual successful `PUT`). `[VERIFIED]` (the 500s and the guessed-wrong values), `[VERIFIED]` (the `screen_off`/`dim_clock` strings, sourced from the app bundle) — but the pairing "these two values actually work" is `[UNKNOWN]`/untested.

**Sleep sounds** (Buddy-only, from the same `buddyConstants` bundle source): `brown_noise`, `ocean_waves`, `rain`, `stream`, `white_noise`. A calendar-display device reports `sleep_sound: null` with a stored (but functionally inert) `sleep_sound_volume`. `[VERIFIED]` (sourced from app bundle constants, not a live API write-and-confirm test)

**The Buddy-only trap, verified in one live test run against a single `15-CAL-2.0` (a non-Buddy calendar display):**

| Call | Result |
|---|---|
| `POST .../devices/{id}/alarms` (any body) | `422 Device must be a buddy device` |
| `GET .../devices/{id}` | Returns `nightlight`, `nightlight_brightness`, `nightlight_color` fields, with non-default stored values |
| `PUT nightlight: true` | `200`, confirmed on re-read |
| `PUT nightlight_brightness: 33` | `200`, confirmed on re-read |
| `PUT nightlight_color: "green"` | `200`, confirmed on re-read |
| `PUT nightlight_color: "purple"` | `422` (invalid enum value) |

So the server **persists and enum-validates** nightlight/sleep-sound fields on any device, calendar or Buddy alike, and only the `alarms` endpoint actually gates on hardware type. The only reliable way to know whether a given device supports these features in practice is checking `role == "buddy"` — confirmed by directly reading the vendor's own web client bundle, whose capability check is verbatim:
```js
function t(t){return !!t && 'buddy' === t.attributes.role}
```
(`deviceUtils.isBuddy`), with `areAllBuddyDevices` (every device on the frame passing that same check) determining whether the app routes a household to its Buddy-specific screens instead of its calendar screens. `pyskylight` models this as `Device.is_buddy`. **Conclusion for a clone: gate nightlight/sleep-sound UI on device role/type, not on whether the write succeeds — the write always "succeeds" regardless of hardware.** `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

### Alarms (Buddy-only)
`POST /api/frames/{id}/devices/{deviceId}/alarms` — rejected outright with `422 Device must be a buddy device` on non-Buddy hardware, before any field validation runs (an empty body, a `time`, and a `name` all fail identically). `GET`/`DELETE` on the alarms collection work on non-Buddy hardware and simply report zero alarms. Because no Buddy device was available to test against, **the true alarm request/response schema was never captured from live traffic** — but the default attribute shape is known from the vendor web app's own `defaultAlarmAttributes` object:

| Field | Example/type |
|---|---|
| `time` | `"08:30"` |
| `hour` | integer |
| `minute` | integer |
| `enabled` | boolean |
| `volume` | integer/number |
| `sound` | `"marimba"` (default) |
| `label` | string |
| `snoozable` | boolean |
| `rrule` | RRULE string/array (repeat pattern) |
| `fires_on` | (days-of-week list, inferred from name) |

`[VERIFIED]` (sourced from app bundle constants), but unverified against a real create/read round-trip — `pyskylight`'s `Alarm` model therefore stays a "thin" model (only raw `.attributes`, no typed fields) pending Buddy hardware access. `reset_device` (factory reset) and `delete_device` (unpairing) endpoints are referenced but were deliberately not exercised by `pyskylight`'s test pass; `reset_device` isn't even implemented in the client yet. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

### `/api/frames/calendar` and `/api/frames/photo`
Despite the singular-looking paths, these return **collections**, not one frame — resource type `approved_viewer_frame`. `pyskylight` exposes them as `get_calendar_frames()` and `get_photo_frames()` (both pluralized in the client despite the path names). Exact purpose/distinction between "calendar frames" and "photo frames" for a multi-frame household: `[UNKNOWN]` beyond the plural-list-of-`approved_viewer_frame` shape. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

### Occasional transient 500s
One healthy-account poll returned a bare `500 Internal Server Error` with no other signal; 30 consecutive follow-up calls across every endpoint were clean. `pyskylight`'s conclusion: treat an occasional 500 as transient noise a client should tolerate/retry, not evidence of an outage or a bug to chase. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

---

## Avatars & Colors (shared reference data)

### `GET /api/avatars`
Returns the platform's fixed library of illustrated animal-avatar images (used for Category/Profile pictures). No auth-scoped params beyond standard headers. `[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)`

Response shape: `{ "data": [ { "attributes": { "image_url": "...", "name": "..." }, "id": "37", "type": "avatar" }, ... ] }`

Observed avatars (id → name, all served from `https://skylight-frame-res.cloudinary.com/image/upload/.../avatars/avatar_<name>.png`):

| id | name |
|---|---|
| 37 | raccoon |
| 38 | unicorn |
| 39 | lab |
| 40 | husky |
| 41 | elephant |
| 42 | dinosaur |
| 43 | cat |
| 44 | bunny |
| 45 | beagle |
| 46 | bear |

`[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)` — list is almost certainly not exhaustive (ids run at least 37–46 in the captured page; lower/higher ids very likely exist but weren't captured in this HAR session).

### `GET /api/colors`
Returns the **exact category/profile/list color palette** with hex values and names — this is the canonical palette to replicate for pixel-accurate cloning:

| Hex | Name |
|---|---|
| `#FDC36D` | Orange |
| `#FBD97E` | Sunshine |
| `#CE812D` | Ochre |
| `#FDB305` | Deep Sunshine |
| `#F3B075` | Clementine |
| `#CF632E` | Deep Clementine |
| `#F66951` | Coral |
| `#FBA994` | Grapefruit |
| `#CB434C` | Deep Grapefruit |
| `#DADADA` | Charcoal |
| `#D5B6EC` | Lavender |
| `#915EA1` | Deep Lavender |
| `#A8D4D3` | Cyan |
| `#93D1E6` | River |
| `#00526D` | Deep River |
| `#2178AF` | Blue |
| `#82D7DD` | Sky |
| `#2D8086` | Deep Sky |
| `#B6E085` | Sprout |
| `#408257` | Deep Sprout |

`[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)` — response schema is a flat array of `{hex, name}` (no `data`/`type` JSON:API envelope for this one endpoint, unlike almost everything else). This list of 20 appears to be the **complete** palette (colors repeat consistently as category/list colors elsewhere in the spec — e.g. `#B6E085`/Sprout is the Grocery List color, `#A8D4D3`/Cyan is the To-Do List color and also the Breakfast meal-category color).

A color `#4986e7` (Google Calendar's own default blue) also appears once as a category color for an auto-created "Family" category derived from a synced calendar — this is a **Google-sourced** color, not from Skylight's own 20-color palette, confirming synced-calendar categories can inherit the source calendar's native color rather than a Skylight palette color. `[VERIFIED]` (see Categories section)

---

## Categories / Profiles (people & labels)

Skylight's API resource is literally named **`category`** (list/detail responses) or **`category_detail`** (single-category GET) — this is the backend name for what the help-center UI calls "Profiles" and "Labels" (a Profile = a category with `linked_to_profile: true` and a `family_member` relationship; a Label = a category with `linked_to_profile: false` and no family member). `[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)` — inference of Profile/Label mapping is `[INFERRED]` from the `linked_to_profile` boolean and `family_member` relationship pattern, cross-referenced against the separately-researched help-center Profiles/Labels article in `04-profiles-settings-access.md`.

### `GET /api/frames/{id}/categories`

Category attributes:

| Field | Type | Meaning | Example |
|---|---|---|---|
| `color` | string (hex) | Category color, from the `/api/colors` palette (or a synced-calendar-derived hex) | `"#915EA1"` |
| `id` | integer | Numeric id (also present as the JSON:API `id` string) | `13624117` |
| `label` | string | Display name — the person's name for a Profile, or the label text for a Label | `"Kayla"`, `"Garrett"`, `"Crew"`, `"Family"` |
| `linked_to_profile` | boolean | `true` = this category is a Profile (has an associated `family_member`); `false` = a Label | `true` / `false` |
| `profile_pic_url` | string (uri) or `null` | Direct picture URL (redacted/null in most captured examples) | `null` |
| `profile_picture_urls` | object | Cloudinary-derived responsive image URLs, keyed by size | see below |
| `selected_for_chore_chart` | boolean | Whether this category/profile shows on the chore chart (Tasks tab) | `true` |

`profile_picture_urls` sub-object — sizes `large`, `medium`, `original`, `small`, `xl`, each a Cloudinary URL with named transform params, e.g.:
```
large:  https://skylight-frame-res.cloudinary.com/image/upload/w_112,h_112,c_thumb,r_max,f_png/v.../avatars/avatar_elephant.png
medium: .../w_80,h_80,c_thumb,r_max,f_png/...
small:  .../w_48,h_48,c_thumb,r_max,f_png/...
xl:     .../w_336,h_336,c_thumb,r_max,f_png/...
original: .../avatars/avatar_elephant.png   (no transform params)
```
i.e. Cloudinary's `w_<n>,h_<n>,c_thumb,r_max,f_png` transformation string (crop-to-thumb, max corner radius = circular crop, force PNG) at four fixed pixel sizes (48/80/112/336) plus the untransformed original. `[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)` — this is a very concrete, copyable spec for how to render avatar images at multiple resolutions.

For a Label (non-Profile) category, `profile_picture_urls` is present but all five values are `null`, and `avatar`/`family_member` relationships are also `null`. `[VERIFIED]` (the "Family" example, id 14463836, `linked_to_profile: false`)

Category relationships:
| Relationship | Points to | Notes |
|---|---|---|
| `avatar` | `avatar` resource (or `null` for Labels) | The chosen avatar illustration |
| `family_member` | `family_member` resource (or `null`) | Only present for Profile categories |
| `source_calendar_categorizations` | array of `source_calendar_categorization` | Links this category to specific external-calendar categorizations (see below) |
| `source_calendars` | array of `source_calendar` | The external (Google/CalDAV) calendars associated |

`source_calendar` included-resource attributes: `default_for_new_events` (bool), `kind` (enum: `gmail`, `caldav` — **confirms Skylight supports Google and generic CalDAV sources**), `label` (string), `role` (enum, only observed value `owner`), `source_id` (string — either the account email or an opaque calendar-provider URI). `[VERIFIED]`

`source_calendar_categorization` attributes: `category_id` (int), `color_hex` (nullable string — an override color from the *source* calendar, distinct from the Skylight category's own `color`), `source_calendar_id` (int), `source_color_id` (nullable — the *source* provider's own color-id, e.g. Google Calendar's numbered color slots). `[VERIFIED]`

`pyskylight`'s `Category` dataclass confirms this exact field set from live traffic and adds naming clarity: the addressable id is aliased from `id`, and `avatar_id`/`family_member_id`/`source_calendar_ids` are modeled as relationships exactly as shown above — no additional undocumented fields turned up in live verification, beyond noting that **`profile_pic_url` (singular, from the OpenAPI spec) does not actually exist on live responses** — only the `profile_picture_urls` dict form is real. (`TheEagleByte/skylight-api`'s captured examples do show a `profile_pic_url` key on category responses, sometimes non-null; `pyskylight`'s notes flag this as one of the two sources' contradictions and say the *dict* form is what's actually live — treat a captured `profile_pic_url` example as historical/inconsistent rather than a currently reliable field.) `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

### Category CRUD via calendar-event side effects
Categories are also returned as `included` sideloads on calendar-event and chore responses, confirming category creation/lookup is tightly coupled to event/chore assignment flows (a category is chosen by `category_ids` when creating an event or chore — see below). `[VERIFIED]`

### `PUT /api/frames/{id}/categories/{id1}/family_member`
Updates the family-member sub-resource attached to a Profile category (not the category itself):
```json
// request
{ "birthday": "2025-03-22", "dietary_preferences": "" }
// response
{ "data": { "attributes": { "birthday": "2025-03-22", "dietary_preferences": "" }, "id": "803102", "type": "family_member" } }
```
`[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)`

## Family members

The `family_member` resource is deliberately thin — it's the extra data hung off a `linked_to_profile: true` category:

| Field | Type | Example |
|---|---|---|
| `birthday` | date (`format: date`) | `"2025-03-22"` |
| `dietary_preferences` | string (free text, can be empty) | `""` |

`[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)` — confirms the help-center-documented "Birthday" field on a Profile, and additionally reveals an **undocumented-by-help-center `dietary_preferences` free-text field** (presumably surfaced in Meal planning to flag allergies/preferences per family member).

---

## Calendar events

Resource type: **`calendar_event`**. Endpoint: `/api/frames/{id}/calendar_events` (GET list, POST create), `/api/frames/{id}/calendar_events/{id1}` (PUT update), `/api/frames/{id}/calendar_events/{calendarEventId}` (DELETE — note the differently-named path param, an artifact of how the HAR-derived spec parameterized two different captured requests). `[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)`

### List query params (`GET`)
| Param | Example | Meaning |
|---|---|---|
| `date_min` | `2025-12-29` | Range start |
| `date_max` | `2026-02-03` | Range end |
| `timezone` | `America/New_York` | IANA tz name used to interpret the range |
| `include` | `categories,calendar_account,event_notification_setting` | JSON:API sideload directive |

`[VERIFIED]`

### `calendar_event` attributes
| Field | Type | Meaning | Example |
|---|---|---|---|
| `all_day` | boolean | All-day flag | `false` / `true` |
| `calendar_id` | string | Source calendar identifier (often the owning email, or a Google calendar-group id) | `"user@example.com"` |
| `countdown_enabled` | boolean | The "countdown" feature toggle for this event | `false` |
| `description` | string or `null` | Free-text notes | `"Test Description"` |
| `editable` | boolean | Whether the current user/device can edit it (false for read-only synced events) | `true` |
| `ends_at` | ISO 8601 datetime **or** plain date (all-day) | End | `"2025-12-29T10:00:00.000-05:00"`; all-day PUT example uses `"2025-12-30"` |
| `invited_emails` | array | Invitee email list | `[]` |
| `kind` | string enum (observed: `standard`) | Event kind/type | `"standard"` |
| `lat` / `lng` | nullable numbers | Geocoordinates for `location` | `null` |
| `location` | string or `null` | Free-text location | `null` |
| `master_event_id` | nullable | For a recurring-instance exception, the parent event id | `null` |
| `owner_email` | string | Creator/owner email | `"user@example.com"` |
| `recurring` | boolean | Whether this event belongs to a recurring series | `true` |
| `recurring_config` | boolean | Distinct flag alongside `recurring` (possibly "has custom recurrence config" vs. a simple repeat) — exact distinction from `recurring` **`[UNKNOWN]`** | `true` |
| `rrule` | array of strings, or `null` | **Standard iCal RRULE strings**, wrapped in an array (even though only one rule was ever observed per event) | `["RRULE:FREQ=WEEKLY;WKST=MO"]` |
| `source` | string | Origin of the event | `"google"` |
| `starts_at` | ISO 8601 datetime or plain date | Start | `"2025-12-29T09:30:00.000-05:00"` |
| `status` | string enum (observed: `approved`) | Approval/sync status | `"approved"` |
| `summary` | string | Title | `"Kaha 1:1"` |
| `timezone` | string (IANA) or `null` | Event's own timezone (null on some POST-created events observed) | `"America/New_York"` |
| `uid` | string | A long opaque calendar UID (iCal-style UID, e.g. from Google) | `"69i62or364p6cbb474sj0b9k6osmcbb1cosm6bb16kpjcchi74p66e9i6c"` |

Relationships: `calendar_account` (→ `calendar_account` resource), `categories` (array, on GET-list) or singular `category` (on POST/PUT responses — inconsistent pluralization between list and mutate responses, verbatim as observed), `event_notification_setting` (nullable). `[VERIFIED]`

The `id` field for list-returned recurring instances is a composite string: `"<master_event_id>-<epoch_seconds_of_instance_start>"`, e.g. `"5355662012-1767018600"` — confirming recurring events are **expanded server-side into per-instance rows** for the list endpoint (not left as a single row + client-side RRULE expansion), while still carrying the shared `rrule` and a `master_event_id` link back to the series when the row is itself an exception. `[VERIFIED]` (`[INFERRED]` for the exact composite-id construction rule, since it's pattern-matched from ~7 observed rows rather than documented explicitly)

### `POST` create-event request body
```json
{
  "all_day": false,
  "calendar_account_id": "1570313",
  "calendar_id": "user@example.com",
  "category_ids": ["13600771"],
  "countdown_enabled": false,
  "description": "Test Description",
  "ends_at": "2025-12-29T20:00:00.000Z",
  "event_notification_setting_attributes": null,
  "invited_emails": [],
  "kind": "standard",
  "lat": null,
  "lng": null,
  "location": "",
  "rrule": null,
  "starts_at": "2025-12-29T19:00:00.000Z",
  "summary": "Test Event",
  "timezone": "America/New_York"
}
```
`[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)` — note `category_ids` (plural, array) on write vs. singular `category` relationship key on the create response, and that `calendar_account_id` must be supplied (i.e. every event is filed under one of the account's linked source calendars, even a manually-created one — there's no calendar-account-less "local only" event observed).

### `PUT` update — all-day + recurrence example
```json
{
  "all_day": true,
  "category_ids": ["13600771"],
  "countdown_enabled": false,
  "description": "Test Description - Updated - Again",
  "ends_at": "2025-12-30",
  "event_notification_setting_attributes": null,
  "invited_emails": [],
  "lat": null, "lng": null, "location": "",
  "rrule": ["RRULE:FREQ=WEEKLY;INTERVAL=1;UNTIL=20260106T235959Z;WKST=SU;BYDAY=MO,TU"],
  "starts_at": "2025-12-29",
  "summary": "Test Event - All Day",
  "timezone": "America/New_York"
}
```
`[VERIFIED]` — confirms all-day events use **plain `YYYY-MM-DD` date strings** for `starts_at`/`ends_at` (no time-of-day component), while timed events use full `ISO 8601` datetimes with offset. Confirms `rrule` accepts standard `UNTIL=<basic-format-UTC-datetime>Z` and `BYDAY=` multi-day lists.

### `DELETE`
`DELETE /api/frames/{id}/calendar_events/{calendarEventId}?apply_to=all` → `{ "meta": { "destroyed_id": "<id>" } }`. The `apply_to` query param (observed value `all`) strongly implies **other values exist for "this instance only" vs. "this and future instances" vs. "all instances"** of a recurring series (a very standard three-way recurring-delete UX) — exact enum values beyond `all` are `[UNKNOWN]`. `[VERIFIED]` (path/param existence and the one observed value), `[INFERRED]` (full enum)

### `calendar_account` (included resource)
| Field | Type | Example |
|---|---|---|
| `active_calendars` | array of `{editable, id, name, role}` | one entry per linked external calendar (Google/CalDAV) under this account |
| `email` | string | `"user@example.com"` |
| `provider` | string enum (observed: `gmail`) | `"gmail"` |

Each `active_calendars[]` entry's `id` is either the account owner's own email or a Google calendar-group id like `xxxx@group.calendar.google.com`; `role` observed value `owner`. `[VERIFIED]`

---

## Chores / Routines / Task Box

Resource type: **`chore`**. This single resource type covers both **one-off tasks** and **recurring routines** — distinguished by the `routine` boolean, not by separate resource types. `[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)`

### `GET /api/frames/{id}/chores` query params
| Param | Example | Meaning |
|---|---|---|
| `after` | `2025-12-29` | Range start |
| `before` | `2025-12-29` | Range end |
| `include_late` | `"true"` | Include overdue/late chores outside the date range |
| `filter` | `linked_to_profile` | Filters to only chores on Profile-linked categories (as opposed to, presumably, Label-only or "up for grabs"/unassigned chores) |

`[VERIFIED]` — the `filter=linked_to_profile` value strongly corroborates the "Up for Grabs" concept found in `ha-skylight`'s feature list: chores exist that are **not** linked to any profile (unassigned/up-for-grabs), and this filter param is how a client asks for just the assigned ones. `[INFERRED]` for the up-for-grabs↔unfiltered-chores connection specifically (not spelled out in the spec text itself, but consistent with `ha-skylight`'s documented `todo.<frame>_up_for_grabs` entity).

### `chore` attributes
| Field | Type | Meaning | Example |
|---|---|---|---|
| `completed_on` | date or `null` | Date the chore instance was marked done | `"2025-12-29"` / `null` |
| `emoji_icon` | string (emoji) or `null` | Icon shown on the chore chart | `"🐻‍❄️"`, `"🐾"` |
| `group` | string (stringified integer) | Groups recurring instances of the same underlying chore definition together | `"55780859"` |
| `id` | integer or composite string | For recurring instances: `"<id>-<date>-<HHMM>"` | `55900629` (one-off) vs. `"55780859-2025-12-29-0600"` (routine instance) |
| `position` | integer | Sort order among that day's/category's chores | `1` |
| `recurrence_set` | array of RRULE strings, or `null` | The routine's recurrence rule(s) | `["RRULE:FREQ=DAILY;INTERVAL=1;BYHOUR=6"]` |
| `recurring` | boolean | Whether it repeats | `true` / `false` |
| `recurring_until` | nullable | End date for recurrence, if any | `null` (observed only) |
| `reward_points` | integer or `null` | Points awarded for completing this chore | `1` / `null` |
| `routine` | boolean | `true` = a repeating "routine," `false` = a one-off "task" | `true` / `false` |
| `start` | date | The date this chore instance applies to | `"2025-12-29"` |
| `start_time` | string `"HH:MM"` or `null` | Time-of-day the routine triggers, using `BYHOUR` from its rrule | `"06:00"`, `"20:00"`, `"14:00"`, or `null` for date-only (no time-of-day) tasks |
| `status` | string enum: `pending`, `complete` | Completion state | `"pending"` |
| `summary` | string | Title | `"Feed Animals"` |

`[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)` — the `recurrence_set` uses **`BYHOUR=`** (not a separate time field) to encode time-of-day, e.g. `RRULE:FREQ=DAILY;INTERVAL=1;BYHOUR=6,14,20` when creating three times a day at once (see multi-create below); `start_time` is then presumably derived server-side from the matching `BYHOUR` for display/sort convenience per generated instance.

Relationship: `category` → single `category` resource (the assigned Profile/Label).

### Full attribute list, verified live (22 fields) — supersedes the partial list above
`pyskylight`'s live testing found chores carry substantially more fields than either OpenAPI capture showed. Complete verified set, from `pyskylight/models.py`'s `Chore` dataclass:

`chore_id` (aliased from the API's `group` field — **this, not `id`, is the addressable chore**), `series`, `summary`, `description`, `status`, `start`, `start_time`, `completed_on`, `completed_at`, `is_future`, `recurring`, `recurring_until`, `recurrence_set`, `renewal_interval`, `renewal_unit`, `reward_points`, `emoji_icon`, `routine`, `position`, `origin`, `up_for_grabs`, `timer_seconds`, `category_id` (relationship), `completed_category_id` (relationship). `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/pyskylight/models.py)`

Notable additions beyond the OpenAPI-captured set: `description` (chores can carry free-text notes, not just a `summary` title — not shown in any captured OpenAPI example), `completed_at` (a full timestamp alongside the date-only `completed_on`), `is_future`, `renewal_interval`/`renewal_unit` (a second, more general recurrence mechanism alongside `recurrence_set`/RRULE — exact relationship between the two `[UNKNOWN]`), `origin` (presumably tracks how the chore was created — manually, from the task box, etc. — enum values `[UNKNOWN]`), `timer_seconds` (a countdown-timer duration attachable to a chore — a feature not documented anywhere else in this research), and **`up_for_grabs`** (see below). `[VERIFIED]`, enum values for `origin`/`renewal_unit` `[UNKNOWN]`

### `chore_id` vs. `id` — the addressable-id correction
`pyskylight`'s live verification directly corrects a claim implied by the OpenAPI spec's schema: *"`attributes.id` is not the numeric chore id the spec implies; it repeats the occurrence id."* The value to use when updating, deleting, or completing a chore is the **`group`** attribute (aliased to `chore_id` in the model), with a separate `series` attribute alongside it. This matches — and sharpens — what was independently observed in the raw OpenAPI examples above (composite ids like `"55780859-2025-12-29-0600"` where the leading number equals `group`). `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

### `chore.status` values — corrected
The OpenAPI spec's captured examples only ever showed `pending`/`complete` as read values. Live write-testing confirms the accepted set is narrower and easy to get wrong: the completions endpoint (see below) accepts exactly **`"complete"`** and **`"pending"`** — critically **not** `"completed"` (past tense) and not `"skipped"`; both of those are rejected with `status is not included in the list`. `pyskylight` models this as a `ChoreStatus` class with `COMPLETE = "complete"` / `PENDING = "pending"`. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/pyskylight/models.py)`

### `PUT /api/frames/{id}/chores/{id}/completions` — the real completion endpoint, with sharp edges
Live-write testing surfaced an entire completions sub-resource and several undocumented validation rules not visible from the OpenAPI captures alone:

- `instance_date` is **required** when completing a recurring chore occurrence, and **rejected** (`must be blank`) for a one-time chore.
- `instance_time` is **also required**, specifically for a chore that has a time-of-day: sending only `instance_date` on a chore with `start_time: "06:00"` fails with `422 instance_time can't be blank`. The fix is to pass `start_time` straight back unchanged. This is exactly what distinguishes two occurrences of a chore that repeats morning and evening — consistent with the composite occurrence-id format `"<chore_id>-<date>-<HHMM>"` seen for timed routines vs. `"<chore_id>-<date>"` for untimed ones.
- **Whether `category_id` belongs in the completion body depends on the chore**, verified both directions on a live test frame:

  | Chore type | `category_id` sent | Result |
  |---|---|---|
  | Assigned (has a category already) | yes | `422` |
  | Assigned | no | `200`, server sets `completed_category` to the chore's own existing category |
  | Up for grabs (`up_for_grabs: true`, no category) | yes | `200`, `completed_category` set to the supplied category |
  | Up for grabs | no | `422` |

  I.e. an up-for-grabs chore **cannot be completed anonymously** — the API insists on knowing who claimed it, and the field name for "who claimed it" is `category_id` (not `completed_category_id`, `completed_category`, or `completed_by` — all three of those are rejected outright).

`[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)` — this whole completions-endpoint behavior set was verified by direct writes against a live test frame, both success and failure paths.

### "Up for Grabs" chores — full mechanics (previously an open question, now resolved)
A chore with `up_for_grabs: true` has **no `category_id`** — it belongs to nobody until claimed. Critically:

- **`GET /api/frames/{id}/chores` never returns up-for-grabs chores, in any query window** — verified by querying today, today+late, and a full week, all returning zero uncategorized chores while the bucketed `/chores/all` endpoint (below) held eight at the same moment.
- Neither `up_for_grabs` nor `filter` are accepted as query parameters on the plain `/chores` endpoint to ask for them — both return `422`. **The only way to retrieve up-for-grabs chores is `GET /api/frames/{id}/chores/all`.**
- **Creating** an up-for-grabs chore directly is not possible: `POST` (create) always answers `422 Category is required`, regardless of whether `up_for_grabs` is set and regardless of an explicit `null` category.
- **Making an existing chore up-for-grabs takes two fields set together**, not one: `PUT .../chores/{id}` with only `{"up_for_grabs": true}` returns `200` but silently changes nothing; `{"up_for_grabs": true, "category_id": null}` is what actually works.
- Completion mechanics for an up-for-grabs chore are covered above (claiming via `category_id` in the completion call).

`[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)` — this directly resolves the open question from the OpenAPI-only research about whether `category_ids` (plural) on chores was vestigial: it is not about multi-assignment at all, but about the bulk-create fan-out (see `create_multiple` below) and about clearing/setting the single `category_id` for up-for-grabs semantics.

### `ApplyTo` — the full recurring-scope enum (previously only `all` was observed)
`pyskylight` models a class `ApplyTo` with three values: **`THIS = "this"`**, **`THIS_AND_FUTURE = "this_and_future"`**, **`ALL = "all"`** — used on both chore and calendar-event recurring update/delete calls. This resolves the earlier open question about the full enum behind the `apply_to` query parameter (only `all` had been directly observed in the OpenAPI captures). `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/pyskylight/models.py)`

**`apply_to` is conditionally required/forbidden**, verified live: `DELETE /chores/{id}` **rejects** `apply_to` on a one-time chore (`400 one-time chores should not have a value for apply_to`) and **needs** it for a recurring one; it's optional on a plain update. `pyskylight` defaults it to unset rather than guessing. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

### `GET /api/frames/{id}/chores/all` — the bucketed "everything" endpoint
Not JSON:API-shaped at the top level. Returns `{"chores": {...}, "routines": {...}}`, where **each** of `chores` and `routines` is itself bucketed by time-relevance into `late`, `today`, `today_timed`, `any_day`, and `future` — and each of *those* buckets is its own full `{data, included}` JSON:API document. `pyskylight` models the whole thing as `ChoreGroups`, with `.chores["late"]`/`.chores["today"]`/etc., `.routines[...]`, and a flattening `.all` property across every bucket. This is the endpoint that surfaces up-for-grabs chores (see above) — the plain `/chores` list endpoint never does. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`, `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/pyskylight/models.py)`

### Reordering — `position` takes a neighbor, not an index
Every attempt to set `position` as a plain integer on a chore update fails with `422 Position is required`, across query-param and form-encoded attempts alike. The real shape, discovered from the resulting error message once `position` was sent as an object, is relative: `{"position": {"before": <chore_id>}}` or `{"position": {"after": <chore_id>}}` — the error `position must include at least one of \`before\` or \`after\`` only surfaces once the client already sends an object. **A clone implementing drag-to-reorder should model chore ordering as "insert before/after this other chore," not as an absolute index.** `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

### Live-verified write-format correction — writes are flat, not JSON:API
Both OpenAPI specs (`TheEagleByte/skylight-api`'s captured chore-adjacent examples matched this; `mightybandito/Skylight`'s spec, not independently fetched in full here, documents a JSON:API-*wrapped* body for `POST /chores`: `{"data": {"type": "chore", "attributes": {...}}}`) — but `pyskylight`'s live write-testing proved **the wrapped shape is rejected**. Sending it against a real endpoint (demonstrated for `POST /lists` but stated to hold across every writable resource) drops the wrapper silently and fails validation on the now-missing top-level fields:
```
POST /lists  {"data": {"type": "list", "attributes": {"label": "x", ...}}}
→ 422 Label can't be blank; Kind can't be blank; Color can't be blank
```
**Every create/update call actually wants a flat body** — e.g. `{"label": "x", "kind": "shopping", "color": "#00526D"}` — confirmed across categories, chores, task box items, lists, list items, calendar events, rewards, nudges, and albums. This matches what `TheEagleByte/skylight-api`'s own captured examples already showed throughout this document (all flat bodies, as reproduced above) — so treat any JSON:API-wrapped *write* example from any source as stale/wrong. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

**Singular vs. plural category fields on write, precisely:** `POST /chores` (single create) takes `category_id` and rejects `category_ids`; `POST /chores/create_multiple` is the exact reverse — it takes `category_ids` and that plural array is what "multiple" actually means: **one chore created per profile in the array, not a batch of differently-worded chores** (a `{"chores": [...]}` array shape returns a `500`). Rewards, nudges, and reward-points writes all take the plural `category_ids`. A category is **mandatory** for chores, rewards, nudges, and reward-points writes (`422 Category is required` / `Category ids is required`). `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

### `POST /api/frames/{id}/chores/{choreId}reate_multiple` (sic — literally `.../chores/{choreId}reate_multiple`, a path-templating artifact from `create_multiple` where the HAR converter mis-split the id-boundary; the real path is almost certainly `/api/frames/{id}/chores/create_multiple`)
Bulk-creates one chore row **per `BYHOUR` value** in a single `recurrence_set` entry — i.e. "Test Routine" at `BYHOUR=6,14,20` becomes three separate `chore` rows (ids `56018116`/`117`/`118`), each with its own single-hour `recurrence_set`:
```json
// request
{
  "category_id": "13600771",
  "category_ids": ["13600771"],
  "recurrence_set": ["RRULE:FREQ=DAILY;INTERVAL=1;BYHOUR=6,14,20"],
  "recurring": true,
  "recurring_until": null,
  "reward_points": 1,
  "routine": true,
  "start": "2025-12-29",
  "start_time": null,
  "summary": "Test Routine"
}
```
`[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)` — this is the **"3x/day routine" creation pattern**: one API call, multiple `BYHOUR` values, server fans out into N chore rows sharing a `summary` but distinct `id`/`group`/`position`/single-hour `recurrence_set`.

### `PUT /api/frames/{id}/chores/{id1}` — general editing
This is the plain chore-update endpoint (distinct from the dedicated `.../completions` sub-resource documented above, which is the live-verified way to toggle completion). The OpenAPI capture's minimal example sends `{"status": "pending"}` directly to this endpoint, suggesting a plain status PUT is also accepted here in at least some cases — but see the completions endpoint above for the fuller, live-verified rules (required `instance_date`/`instance_time`, and `category_id` handling that depends on assigned-vs-up-for-grabs) which a clone should treat as authoritative for completion specifically. Full editable field set observed on this general PUT: `category_id`, `category_ids`, `emoji_icon`, `group`, `position`, `recurrence_set`, `recurring`, `recurring_until`, `reward_points`, `routine`, `start`, `start_time`, `status`, `summary`. `[VERIFIED]`

Completion response includes a `meta.reward_points` block showing the **live point balance after this mutation**:
```json
"meta": {
  "reward_points": {
    "category_id": 13600771,
    "current_point_balance": 0,
    "lifetime_points_earned": 0
  }
}
```
`[VERIFIED]` — confirms marking a chore complete/pending server-side recomputes and returns the assignee's point balance inline, so a client doesn't need a separate round-trip to `reward_points` after completing a point-earning chore.

### `DELETE`
- `DELETE /api/frames/{id}/chores/{id1}` — delete a single chore/instance.
- `DELETE /api/frames/{id}/chores/{date}?apply_to=all` — delete by a composite `date`-style id (actually the instance's composite id, e.g. `56018116-2025-12-29-0600`, despite the path param being named `date`) with the same `apply_to` recurring-scope pattern seen on calendar events. `[VERIFIED]`

### Task Box — `GET /api/frames/{id}/task_box/items`
A **fixed/seeded library of common chore templates** a family can quickly add from, resource type `task_box_item`:

| Field | Type |
|---|---|
| `emoji_icon` | string or `null` |
| `id` | integer |
| `reward_points` | nullable integer |
| `routine` | boolean |
| `summary` | string |

Observed full seed set (17 items, ids 33536830–33536846), first 9 with `routine: false, emoji_icon: null` (generic one-off chores), last 8 with `routine: true` and an emoji:

Non-routine: `Laundry`, `Dishes`, `Clean room`, `Vacuum`, `Take out trash`, `Clean bathroom`, `Set the table`, `Clear the table`, `Put away toys`

Routine (with emoji): 🛏️ `Make bed`, 🪥 `Brush teeth`, 🚿 `Shower`, 🛁 `Bath`, 📝 `Homework`, 🧴 `Skincare`, 🧽 `Wash face`, 🪞 `Do hair`

`[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)` — this is a directly copyable seed-data list for a clone's own "quick add chore" template library.

The OpenAPI capture only showed `GET .../task_box/items` and, separately, a `POST` operation; `pyskylight`'s notes add that the gist documents (and `pyskylight` implements) the **full CRUD set** — `GET`, `PATCH`, and `DELETE` also exist on task box items, not just create. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

---

## Nudges (spoken reminders)

A resource type not present in either OpenAPI capture at all — discovered entirely through `pyskylight`'s live-verified notes and gist cross-reference. A **nudge is a spoken reminder**: the frame is meant to read a text body aloud, at a scheduled time, to a specific set of profiles.

### `nudge` attributes
| Field | Type | Notes |
|---|---|---|
| `nudge_id` | integer (aliased from `id`) | |
| `body` | string | The text to be spoken — **not** `summary` (a naming trap: nudges use `body`/`deliver_at`, not the `summary`/`start` naming used by chores and events) |
| `deliver_at` | datetime | When it should be spoken |
| `recurring` | boolean | |
| `recurring_until` | datetime | |
| `rrule` | array of RRULE strings | |
| `voice_kind` | string | Defaults to `kirk_voice` if unset. **An unrecognized value returns `500`, not a validation error** — so the full valid voice set cannot be enumerated by probing, and there is no `GET /api/colors`-style endpoint listing available voices. |
| `audio_url` | string or `null` | **`null` immediately after creation; a presigned S3 URL for a rendered `nudge_<id>.mp3` appears roughly ten seconds later** — the speech is synthesized server-side, asynchronously. The URL is signed per-read with a short expiry — fetch fresh, never cache/store. |

`[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/pyskylight/models.py)`, `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

### Validation and behavior, verified live
- **Both `deliver_at` and `category_ids` are required** on create — an empty `category_ids` list is `422 Category ids is required`; a `deliver_at` in the past is accepted **without complaint** (whether a frame would actually speak an already-past nudge is unknown/unobservable through the API).
- **`after`/`before` list-query params are both required** (`422 After/Before is required` if either is missing), and `before` behaves as an **exact UTC-midnight instant, not an inclusive calendar day** — a nudge at `2026-08-09T03:01Z` was absent from a query with `before=2026-08-09` even though that instant is still "the evening of the 8th" in the frame's own local timezone. To reliably cover a given local day, query with `before` set to the *day after* it.
- **Delivered nudges are never cleaned up** — the listing endpoint is a permanent history as well as a forward schedule.
- **A calendar display never actually spoke a nudge in testing**, despite every API signal indicating success (resource created, audio rendered, listing showed it) — two nudges were sent to a real `15-CAL-2.0`, one due immediately and one two minutes out, and neither was heard nor appeared on-screen. The most likely explanation, cross-referenced against the Buddy-only findings elsewhere in this document: nudges may be a **Skylight Buddy** feature that the API layer doesn't actually gate (unlike alarms, which explicitly reject non-Buddy devices with `422 Device must be a buddy device` before any body validation) — nudges instead "hang off the frame," where nothing in the write path knows or cares what hardware will ultimately need to speak them.

`[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)` — **caution for a clone spec: a successful `create_nudge` API call is not evidence that any physical device will actually play it.**

---

## Rewards & reward points

Two related resources: `reward` (a redeemable prize) and a bare `reward_points` array (per-category point ledger — **note: keyed by `category_id`, i.e. points are tracked per Profile/category, not per literal person-account**).

### `GET /api/frames/{id}/reward_points`
```json
[
  {"category_id": 13624117, "current_point_balance": 0, "lifetime_points_earned": 0},
  {"category_id": 13600771, "current_point_balance": 0, "lifetime_points_earned": 0}
]
```
Note this endpoint's top-level response is a **bare array**, not the usual `{"data": [...]}` envelope — one of very few non-JSON:API-shaped endpoints in the whole spec. `[VERIFIED]`

### `POST /api/frames/{id}/reward_points` — manually award/adjust points
```json
// request
{ "category_ids": ["14463835"], "points": 3 }
```
Response (`201`) is the same bare array shape as GET, now updated (`current_point_balance` and `lifetime_points_earned` both increment by 3 for category `14463835`). A negative `points` value presumably deducts (matches `ha-skylight`'s documented `skylight.award_points` / `skylight.deduct_points` actions) — not directly demonstrated with a negative example. `[VERIFIED]` (positive case), `[INFERRED]` (negative/deduct case)

### `reward` attributes (`GET`/`POST /api/frames/{id}/rewards`)
| Field | Type | Example |
|---|---|---|
| `description` | string | `"This is a test reward"` |
| `emoji_icon` | string (emoji) | `"😋"` |
| `name` | string | `"Test Reward"` |
| `point_value` | integer | `3` |
| `redeemed_at` | ISO datetime or `null` | `"2025-12-29T18:31:45.183Z"` / `null` |
| `respawn_on_redemption` | boolean | `true` — if true, redeeming doesn't consume/retire the reward; it becomes available again (an infinitely-repeatable reward, vs. a one-time prize) |

Relationship: `category` → the Profile/category this reward is scoped to (a reward can be created against multiple `category_ids` at once on POST, generating one `reward` row per category — same fan-out pattern as chores' `create_multiple`). `[VERIFIED]`

Create request:
```json
{
  "category_ids": ["13600771", "14463835"],
  "description": "This is a test reward",
  "emoji_icon": "😋",
  "name": "Test Reward",
  "point_value": 3,
  "respawn_on_redemption": true
}
```
`[VERIFIED]`

### Redeem / unredeem
- `POST /api/frames/{id}/rewards/{id1}/redeem` → sets `redeemed_at` to now, returns `meta.reward_points` with the post-redemption balance (mirrors the chore-completion pattern — point balance deducted and returned inline):
  ```json
  "meta": { "reward_points": { "category_id": 14463835, "current_point_balance": 0, "lifetime_points_earned": 3 } }
  ```
  (Balance drops to 0 after spending the 3 earned points — confirms `current_point_balance` is spendable/decrementing while `lifetime_points_earned` is a monotonic counter.) `[VERIFIED]`
- `POST /api/frames/{id}/rewards/{id1}/unredeem` — path confirmed to exist; body/response not captured in the excerpt reviewed (symmetric to redeem, presumably clears `redeemed_at` and refunds points). `[VERIFIED]` (path only), behavior `[INFERRED]`

`GET /api/frames/{id}/rewards?redeemed_at_min=<datetime>` supports filtering the reward-redemption history by a minimum redeemed timestamp. `[VERIFIED]`

---

## Lists & list items

Resource types: `list` and `list_item`.

### `list` attributes
| Field | Type | Example |
|---|---|---|
| `color` | string (hex, from the shared palette) | `"#B6E085"` (Sprout) |
| `default_grocery_list` | boolean | `true` for the one list that recipe "add to grocery list" actions target by default |
| `hide_on_device` | boolean | Hide this list from the physical Calendar's Lists tab |
| `kind` | string enum: `shopping`, `to_do` | `"shopping"` |
| `label` | string | `"Grocery List"`, `"To-Do List"` |
| `draft` | boolean | Present in `pyskylight`'s live-verified `SkylightList` model but not in either OpenAPI capture — likely marks a list created by an in-progress AI auto-creation import (see Auto-creation intents) before it's confirmed/finalized. Exact semantics `[UNKNOWN]`. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/pyskylight/models.py)` (field exists), meaning `[INFERRED]` |

Relationship: `list_items` → array of `list_item`. `[VERIFIED]`

`list.color` — live write-testing (documented under Chores above, applying equally here) confirms colors are **validated server-side against the palette from `GET /api/colors`**; an arbitrary hex not in that list is rejected with `422 Color is invalid`. Also worth noting: one captured live example (`get-lists-listid.json`, per `pyskylight`'s notes) showed a color value **without** the leading `#`, so a client reading colors back should treat the `#` prefix as optional/normalize it rather than assume it's always present. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

### `list_item` attributes
| Field | Type | Example |
|---|---|---|
| `created_at` | ISO datetime | `"2025-12-29T18:33:24.183Z"` |
| `label` | string | `"Eggs"`, `"Bagels"` |
| `position` | integer | Sort order within its section |
| `section` | string or `null` | Grocery-list aisle/category grouping, e.g. `"Bakery"`, `"Dairy"`, `"Canned & Jarred Goods"`, `"Produce"` (freeform, not a fixed enum — these look AI/auto-categorized) |
| `status` | string enum: `pending`, `completed` | `"pending"` |

`[VERIFIED]` — the `section` values look like automatically-assigned **grocery-aisle categorization** (Bakery/Dairy/Canned & Jarred Goods/Produce), most plausibly assigned by the same AI "auto-creation" engine documented below (`list_importer`), since a plain manually-typed To-Do list item (`"Take down Christmas decorations"`) has `section: null`.

### Create item — `POST /api/frames/{id}/lists/{id1}/list_items`
```json
// request
{ "label": "Another test item" }
// response
{ "data": { "attributes": { "created_at": "...", "id": 104852989, "label": "Another test item", "position": 2, "section": null, "status": "pending" }, "id": "104852989", "relationships": { "list": {"data": {"id": "4817756", "type": "list"}} }, "type": "list_item" } }
```
`[VERIFIED]` — minimal create only needs `label`; `section`/`status`/`position` are server-assigned.

### `PUT .../list_items/bulk_update_section` — batch re-section items
```json
{ "item_ids": ["104851519"], "section": "test section - renamed" }
```
Response returns the **whole parent `list`** (with updated `included` list_items) plus `meta.sections: ["test section - renamed"]` — i.e. this endpoint doubles as "rename a section across all its items" and returns the full current set of distinct section names for that list. `[VERIFIED]`

`GET /api/frames/{id}/lists/{listId}` (single-list detail) returns list items under the standard `included` sideload array **and** section names separately under `meta.sections` — `pyskylight`'s `get_list()` call resolves both into one `SkylightList.items`/`.sections`. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

---

## Meals: categories, recipes, sittings

Three related resources under `/api/frames/{id}/meals/...`: `meal_category`, `meal_recipe`, `meal_sitting`.

### `meal_category` — `GET /api/frames/{id}/meals/categories`
Fixed default set of 4, each with `color`, `enabled` (bool), `label`, `position`:

| id | label | color | position |
|---|---|---|---|
| 6353078 | Breakfast | `#A8D4D3` | 0 |
| 6353079 | Lunch | `#F66951` | 1 |
| 6353080 | Dinner | `#915EA1` | 2 |
| 6353081 | Snack | `#FDC36D` | 3 |

`[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)` — this directly confirms and supersedes the earlier `[UNKNOWN]`-tagged guess in `04-profiles-settings-access.md` about the four meal-category names/order; also gives their exact default colors (drawn from the same 20-color palette).

### `meal_recipe` — `GET /api/frames/{id}/meals/recipes?include=meal_category`
| Field | Type | Example |
|---|---|---|
| `description` | string (free text) or `null` | A single free-text blob combining "Ingredients:" and "Instructions:" sections as plain text with `-`/numbered-list formatting — **not structured ingredient/step arrays**, just one Markdown-ish string |
| `summary` | string | Recipe title, e.g. `"Pancakes"`, `"Tacos"` |

Relationship: `meal_category`. `[VERIFIED]`

**Confirmed live: a recipe's name field is `summary` — there is no `title` field at all**, and `description` really is the single free-text field carrying both the ingredient list and the method, in whatever loose shape the app happens to write (the `Ingredients:` / `Instructions:` convention shown above is a convention, not an enforced structure) — **there is no structured ingredient array anywhere on the resource**. `meal_category_id` is **required** to create a recipe, and — unusually for this API, which is otherwise fairly good about naming the missing field — its absence produces a bare, field-less `422 Unprocessable Entity`. The four meal categories (Breakfast/Lunch/Dinner/Snack) ship with the frame and nothing observed in live testing created a fifth. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

The frame ships with a **default seed recipe box**, observed recipes include (by meal_category): Breakfast — Milk & Cereal, Eggs, Pancakes, Bagels, Oatmeal, Grilled Cheese(*); Lunch — Grilled Cheese, Salad, Soup, Wraps, Pizza, Leftovers; Dinner — Pizza, Tacos, Burgers, Hot Dogs, Spaghetti, Takeout. (*Grilled Cheese appears under Lunch's category id in the captured data even though intuitively a breakfast/lunch crossover item — verbatim as observed.) `Leftovers` and `Takeout` have `description: null` (title-only placeholder recipes). `[VERIFIED]` — full ingredient/instruction text for each is present verbatim in the fetched spec if needed for exact seed-data replication (not reproduced in full here for space; available in the downloaded `openapi.yaml`).

### `POST /api/frames/{id}/meals/recipes/{id1}/add_to_grocery_list`
No request body; pushes the recipe's ingredients onto the default grocery list and returns the recipe plus `meta.auto_creation_intent_id` — linking this action to the **auto-creation-intent / AI-ingestion pipeline** (see below), i.e. turning recipe text into structured grocery list items is handled by the same AI engine used for photo/list imports, not simple string-splitting of the `description` field. `[VERIFIED]`

**Confirmed live: this call is asynchronous.** The response returns the recipe immediately, along with `meta.auto_creation_intent_id` and a matching `tool_call_id` — but re-reading the grocery list right after the call shows nothing new. In one measured live test, a recipe's `Tortillas`/`Ground beef`/`Salsa` ingredients took roughly **ten seconds** to actually appear as three separate list items; Skylight parses the free-text `description` into structured items server-side, out of band. **A client cannot assume the grocery list is updated synchronously after this call returns — it must poll or wait.** `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

**The destination list is not a client choice.** Ingredients always land on whichever list has `default_grocery_list: true` — verified by creating a second shopping list on a test frame and adding a recipe: all three ingredients went to the default list, the second list stayed completely empty. **A clone should not offer a "choose which list to add to" control for this action — it would misrepresent what the real API does.** `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

### `meal_sitting` — `GET /api/frames/{id}/meals/sittings?date_min=...&date_max=...&include=meal_category,meal_recipe`
A **scheduled instance of eating a recipe** on the calendar:

| Field | Type | Example |
|---|---|---|
| `description` | string | Copied from the linked recipe at scheduling time (or independently editable — not fully disambiguated) |
| `instances` | array of dates | The specific calendar date(s) this sitting occurs, e.g. `["2025-12-29"]` |
| `note` | string | Freeform note, can be empty `""` |
| `recurring` | boolean | Whether this sitting repeats |
| `rrule` | nullable | Recurrence rule if repeating |
| `summary` | string | Title (mirrors recipe's `summary` when linked) |

Relationships: `meal_category`, `meal_recipe`. `[VERIFIED]`

Create (`POST /api/frames/{id}/meals/sittings`):
```json
{
  "add_to_grocery_list": false,
  "date": "2025-12-29",
  "description": null,
  "meal_category_id": "6353078",
  "meal_recipe_id": "45017219",
  "note": "",
  "rrule": null,
  "saveToRecipeBox": false,
  "summary": null
}
```
`[VERIFIED]` — `add_to_grocery_list` and `saveToRecipeBox` booleans on create confirm scheduling a meal can **simultaneously** (a) push its ingredients to groceries and (b) save a one-off `summary`/`description` combo as a new permanent recipe, in one call.

`GET /api/frames/{id}/meals/sittings/{id1}/instances?date_min=...&date_max=...` — fetches just the date-instances of one sitting within a range (for recurring sittings). `[VERIFIED]`

**`date_min`/`date_max` are hard-required on `meals/sittings`** — omitting either fails with `422 Date min is required` (confirmed via direct testing, not just inferred from the OpenAPI example always including them). Two other endpoints share this "looks optional, actually required" trap: `calendar_events/countdowns` requires `timezone` (`422 Timezone is required` — this is a **separate endpoint from the plain `calendar_events` list**, presumably surfacing just the subset of events with `countdown_enabled: true` in a countdown-widget-friendly shape; its own response schema was not otherwise captured), and `nudges` requires **both** `after` and `before` (see the Nudges section). `pyskylight` makes all of these required arguments in its own function signatures rather than optional/defaulted, specifically to route around this trap. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

---

## Photos / Messages / Albums

Resource types `message` (list item, resource `type` unlabeled but implied) / `message_detail` (single-item GET). Skylight's own internal name for the photo feed is literally **"messages"** — `pyskylight` names the model `Message` for exactly this reason. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

### `GET /api/frames/{id}/messages?page_token=__START__&sync_token=<token>`
Cursor-paginated (see Pagination section). List-item attributes: `asset_type`, `asset_url`, `created_at`, `destroyed_at` (nullable), `id`, `sender_id`, `status`, `thumbnail_url`, `updated_at`. `[VERIFIED]`

**Live testing surfaced page-number pagination behavior on this same endpoint**, seemingly in tension with the cursor-based `page_token`/`sync_token` params captured by the OpenAPI spec — a real account's messages endpoint returned photos **newest-first, 30 per page**, with `meta.current_page`/`meta.num_pages` (180 photos across 6 pages on the tested account). `page` selects a page; `per_page` and `limit` query params are both **silently accepted and ignored** (the page size is not configurable), and a JSON:API-style `page[size]` parameter is a flat `404`. **A client wanting just the newest photo should request page 1 and take the first entry**, not try to request a page size of 1. (Both pagination styles may coexist on the same endpoint for different API-version headers, or one may supersede the other — not disambiguated by either source; treat `page`/`meta.current_page`/`meta.num_pages` as the live-confirmed behavior.) `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

### `GET /api/frames/{id}/messages/{id1}` — full detail
| Field | Type | Example |
|---|---|---|
| `asset_bucket` | string | `"darkroom-production"` |
| `asset_key` | string | `"nS8WfXJpIeErSB2M4D6B-A-0.jpg"` |
| `asset_type` | string | `"photo"` |
| `asset_url` | signed CloudFront URL | `https://d31bkqsbdz9wty.cloudfront.net/<key>?Expires=...&Signature=...&Key-Pair-Id=...` |
| `caption` | string | `""` |
| `comments_count` | integer | `0` |
| `created_at` | ISO datetime | |
| `download_token` | string | `"4NZauCnPUJYQzA"` |
| `frame_owner_id` | integer | |
| `from_email` | string | |
| `layered_with_caption_asset_key` | nullable string | A second rendered-with-caption-overlay image variant, when present |
| `sender_id` | integer | |
| `sender_name` | string | `"Garrett Bromley"` |
| `thumbnail_key` / `thumbnail_url` | nullable | |

`[VERIFIED]` — the backend asset store is named `darkroom-production` (Skylight's internal codename for its image pipeline), and signed CloudFront URLs use the standard CloudFront canned-policy query params (`Expires`, `Signature`, `Key-Pair-Id`), meaning asset URLs **expire** and must be re-fetched, not cached long-term.

Also: `GET .../messages/{id1}/all_likes` (array, empty in example) and `GET .../messages/{id1}/comments` (paginated: `meta.current_page`, `meta.num_pages`) — confirming Photos supports a lightweight social layer (likes + threaded comments) per photo. `[VERIFIED]` (paths + shape), comment/like body schema `[UNKNOWN]` (both examples were empty)

Both messages and message details carry a `meta.plus_gated_content: {captions: bool, message(s): bool}` block — confirming **captions and photo messages themselves are gated behind Skylight Plus** for some accounts/content. `[VERIFIED]`

**Asset-URL expiry, precisely:** `asset_url`/`thumbnail_url` are CloudFront URLs carrying an `Expires` value roughly **one week** out, and a fresh one is minted on every read — confirmed by live testing, sharpening the earlier "expires, don't cache long-term" note into a concrete rough duration. Every message observed on the tested account had `asset_type: "photo"` with empty captions throughout, so `caption` is a real, live field but was unexercised; frames are known to support video, so other `asset_type` values presumably exist but weren't characterized. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

### `GET /api/frames/{id}/albums`
Path exists; example response was an empty array in the captured session, so **no album attribute schema was observed** from response bodies. `[VERIFIED]` (path only), attributes `[UNKNOWN]`

One field is nonetheless confirmed from live **write** testing (per the flat-body write-format findings in the Chores section, which explicitly lists albums among the resources it verified): **albums take a `title` field, not `name`** — a naming trap worth calling out since most other labeled resources in this API use `label` or `name`/`summary`, and `title` appears nowhere else in the schema. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

Upload path (from the gist, not independently schema-verified): `POST /api/messages/uploads`. `[VERIFIED](https://gist.github.com/dknowles2/b8eab833eb23eb388c3d78999a3565f8)` (path only)

---

## Auto-creation intents (AI list/recipe import)

Resource type `auto_creation_intent` — this is Skylight's backend name for its **AI-assisted content ingestion** feature (e.g. "import a grocery list from a photo," "add a recipe from a screenshot/URL," and the recipe→grocery-list ingredient extraction seen above).

`GET /api/frames/{id}/auto_creation_intents/{id1}`:
| Field | Type | Example |
|---|---|---|
| `attachment_put_url` | nullable string | Presumably a presigned S3/upload URL for submitting a source image, when applicable |
| `created_at` | ISO datetime | |
| `created_via` | string | `"app_form"` |
| `engine` | string | `"list_importer"` |
| `external_result_url` | nullable string | |
| `result` | nullable | The structured extraction result once processing completes |
| `status` | string | `"approved"` |

`[VERIFIED](https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml)` — `engine: "list_importer"` and `created_via: "app_form"` confirm at least one concrete engine/creation-path pair; other `engine`/`created_via`/`status` enum values (e.g. a recipe-OCR engine, a photo-import path, pending/rejected statuses) are **`[UNKNOWN]`** — only one example was captured.

---

## Event notification settings

`GET /api/frames/{id}/event_notification_settings` (frame-level default; also embeddable per-event via `event_notification_setting_attributes` on calendar-event create/update):

| Field | Type | Example |
|---|---|---|
| `early` | boolean | Whether an "early" reminder is enabled |
| `early_minutes_before` | nullable integer | How many minutes before the event the early reminder fires |
| `on_time` | boolean | Whether an at-start-time reminder is enabled |
| `sound_on` | nullable boolean | Whether a sound plays with the notification |

`[VERIFIED]` — all four fields were `false`/`null` in the one captured (default/unset) example, so the actual minute-value enum for `early_minutes_before` (e.g. 5/10/15/30/60) is **`[UNKNOWN]`**.

---

## Users / Sessions

Covered in Authentication above (`POST /api/sessions`, `POST /api/users`, `GET/PUT/DELETE /api/user`, `POST /api/password_resets`, `POST /api/oauth/legacy_token_exchange`). No additional user-list/invite/co-parent-access endpoints were present in the OpenAPI spec; the gist doesn't add any either. Multi-user/invite flow endpoints: **`[UNKNOWN]`** — likely exist (the help-center documents co-parent/invited-user access in the product) but weren't captured in either source. `[UNKNOWN]`

### `User` — full field set, verified live
`pyskylight`'s notes state plainly that `GET /api/user` is "not JSON:API-shaped in observed traffic" — it's a plain object (possibly nested under a `user` key), unlike almost every other resource in this API. Verified fields, from `pyskylight/models.py`:

`email`, `name` (falls back to a nested `profile.name` if not present directly on the top-level object — the display name genuinely lives in two possible places depending on response shape), `phone`, `birthday`, `created_at`, `subscription_status`, `plus_billing_provider`, `was_plus_purchaser`, `trial_days_remaining`, `trial_expires_at`, `email_mfa_enabled`, `agreed_to_marketing`, `notification_preference`, and a raw `profile` object holding whatever wasn't promoted to a top-level field. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/pyskylight/models.py)`

This is a considerably richer field set than the single `email`/`subscription_status`/`token` triple shown by the `POST /api/sessions` response captured earlier — confirming that endpoint's response is a minimal login payload, not the full user profile (fetch `GET /api/user` separately for the rest). `[INFERRED]` (relationship between the two payloads), field list itself `[VERIFIED]`

---

## Errors

Both the shape of error responses and the corresponding HTTP status codes are undocumented by either OpenAPI spec, and were only characterized through `pyskylight`'s live negative-testing (i.e. deliberately sending invalid requests to a real test frame and reading back what came out).

### Two distinct error-body shapes
A complaint about the request **as a whole** arrives as a flat list of sentences:
```json
{"errors": ["only repeating chores can be skipped"]}
```
A complaint about **specific fields** arrives as a mapping instead — and the message text alone is useless without knowing which field it's attached to:
```json
{"errors": {"instance_date": ["must be blank"]}}
{"errors": {"category_id": ["must be blank"]}}
{"errors": {"summary": ["can't be blank"]}}
```
Both shapes were captured from real `422` responses on a test frame. **Which shape you get depends on the specific endpoint, not the HTTP status** — `PUT .../chores/{id}/completions` and `PUT .../chores/{id}` return the field-mapping shape, while a rejected `status` value on that same completions endpoint returns the flat-list shape. `pyskylight` normalizes both into `ApiError.errors` (always a flat `list[str]`, with the field name joined onto its message when one exists), so `str(error)` is always safe to log/display regardless of which shape the server happened to return. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

### HTTP status → exception mapping (`pyskylight`'s client)
| Status/condition | Exception |
|---|---|
| Login failed, or a token was rejected and couldn't be refreshed | `AuthenticationError` |
| `401`/`403`, after one refresh attempt | `NotAuthorizedError` |
| `404` | `NotFoundError` |
| `429` | `RateLimitError` |
| Anything else unsuccessful | `ApiError` |
| `304 Not Modified` / `204 No Content` | Not an error — returns `None` (or an empty list for list endpoints) |

All exceptions derive from a common `SkylightError`. **The existence of a dedicated `RateLimitError` mapped to HTTP `429` confirms the API does enforce rate limiting in practice** — even though no source documents a specific numeric threshold (requests/minute, burst size, etc.). `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/README.md)`

---

## Rate limits, pagination, real-time behavior

- **Pagination styles observed differ by resource** (verbatim, not unified):
  - Messages/photos: **both** a cursor-based scheme (`page_token` starting as the literal string `"__START__"`, plus `sync_token`, with `meta.has_next`/`next_sync_token`/`next_page_token`/`current_page_token`) **and**, per live testing, a classic page-number scheme (`page` query param, `meta.current_page`/`meta.num_pages`, fixed at 30 items/page — see Photos section). `[VERIFIED]`
  - Message comments: page-number pagination — `meta.current_page`, `meta.num_pages`. `[VERIFIED]`
  - Everything else observed (events, chores, categories, lists, rewards, meals) returns its **full result set in one response** for the given date/query range, with no pagination metadata — i.e. pagination is scoped by date-range query params (`date_min`/`date_max`, `after`/`before`) rather than page tokens. `[VERIFIED]` (absence of pagination meta across ~10 other list endpoints)
- **Conditional GET / caching**: nearly every documented `GET` supports a **`304 Not Modified`** response alongside `200` — `pyskylight`'s notes independently confirm this ("304 Not Modified is documented on nearly every GET, so the API is conditional-request aware") and describe its own current behavior as returning `None`/an empty list for a 304 rather than treating it as an error, while noting it does **not yet itself send `If-None-Match`** on the way out (i.e. it currently relies on the server choosing to 304 rather than driving conditional requests proactively) — a clone implementing a from-scratch client should send `If-None-Match`/`If-Modified-Since` itself to actually benefit from this. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`
- **Real-time behavior**: confirmed **polling, not push** — `ha-skylight`'s documentation explicitly states data refreshes on a fixed interval: *"Data refreshes every minute; immediate updates after user changes... Polling-based (no push support from Skylight API)."* `[VERIFIED](https://github.com/dknowles2/ha-skylight)` — no WebSocket/SSE/webhook endpoints appear anywhere in either OpenAPI spec or in `pyskylight`'s exhaustively-tested endpoint list.
- **Rate limits**: no explicit rate-limit *headers* (`X-RateLimit-*`, `Retry-After`, etc.) appear in the captured response-header list for any endpoint (only `cf-cache-status`, `cf-ray`, `nel`, `x-content-type-options`, `x-permitted-cross-domain-policies`, `x-runtime`) — but `pyskylight`'s dedicated `RateLimitError` (see Errors section) confirms the server **does** return `429` under some condition; the exact numeric threshold remains **`[UNKNOWN]`**, as no source documents one and it wasn't deliberately triggered/characterized during live testing. `ha-skylight`'s 1-minute polling interval and its graceful auth-token-refresh handling suggest the integration authors have been conservative about call volume as a precaution rather than in response to an observed documented limit. `[UNKNOWN]` (the number), `[VERIFIED]` (that a 429 path exists at all)
- **Occasional transient 500s**: one healthy-account request returned a bare `500` with no other signal, followed immediately by 30 clean calls across every other endpoint — treat a stray 500 as noise to retry, not a systemic failure. `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`
- **API versioning**: the `Skylight-Api-Version: 2026-05-01` header (from the gist, and confirmed sent by `pyskylight` on every request per its `const.py`) implies date-based API versioning similar to Stripe's — clients likely pin a version string and the backend maintains behavior per pinned date. `[VERIFIED](https://gist.github.com/dknowles2/b8eab833eb23eb388c3d78999a3565f8)`, `[VERIFIED](https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md)`

---

## Android/web app architecture

- User-Agent observed in the auth flow: `SkylightMobile (web)` — an odd/notable value, suggesting either (a) the mobile app embeds a webview that self-identifies this way, or (b) this was actually captured from a browser session masquerading with that UA, or (c) Skylight's "mobile" app is itself substantially web-based (e.g. React Native + WebView, or Capacitor/Cordova-style). `[VERIFIED](https://gist.github.com/dknowles2/b8eab833eb23eb388c3d78999a3565f8)` (string itself), interpretation `[INFERRED]`
- OAuth `client_id=skylight-mobile` with `scope=everything` — a single coarse-grained scope, not fine-grained per-resource scopes. `[VERIFIED]`
- Backend: Rails (CSRF `authenticity_token`, `x-runtime` header, `/auth/session` conventions all match Rails/Devise-style patterns), fronted by Cloudflare. `[VERIFIED]` (headers/paths), explicit "this is Rails" confirmation `[INFERRED]` from those signals rather than directly stated by any source
- No APK teardown, package name (`com.skylight...`), or React Native/native-Android tech-stack confirmation was found in the sources actually fetched for this document — earlier web-search snippets mentioned "Expo/React Native Web app at ourskylight.com" and "server-rendered Rails app at app.ourskylight.com," but these came from an AI-summarized search result rather than a primary source page this research directly fetched and verified; **treat that specific Expo/RN-Web claim as `[UNKNOWN]`/unverified** pending a primary source (e.g. an actual APK teardown or job posting) — none was located in the time available. `[UNKNOWN]`
- No job-posting evidence ("Skylight Frame engineer react native," etc.) was located during this research pass. `[UNKNOWN]`

---

## Community discussion (HA forum, Reddit)

Time/budget did not permit a dedicated old.reddit.com / Home Assistant Community forum crawl beyond what's already reflected in the `ha-skylight` GitHub README (itself linked from, and consistent with, the Home Assistant Community thread "DIY Family Calendar (Skylight)" surfaced during initial search but not independently fetched). **This is a gap** relative to the assignment's instructions to check the HA community forum and Reddit directly. `[UNKNOWN]` — flagged as an open question below rather than fabricated.

---

## Open questions

Several items from the initial OpenAPI-only research pass were **resolved** by `pyskylight`'s live-verified notes (frame/device schema, `apply_to` full enum, up-for-grabs/`category_ids` semantics, auth-flow reconciliation, `list.kind` — confirmed exactly two values via live testing) and are no longer open; what follows is what's still genuinely unconfirmed after incorporating that source.

1. Full `avatar` id range — only ids 37–46 (10 raccoon/unicorn/lab/husky/elephant/dinosaur/cat/bunny/beagle/bear) were captured; the true full library size and lower-numbered ids are unknown.
2. Exact semantics distinguishing `calendar_event.recurring` from `calendar_event.recurring_config` (both booleans, both `true` on the same observed recurring events — redundant or subtly different?). Not addressed by `pyskylight`'s notes either (both are modeled as separate optional booleans with no further explanation).
3. Full enum for `event_notification_setting.early_minutes_before` (reminder-minutes options).
4. `auto_creation_intent.engine`/`created_via`/`status` full enums — only `list_importer`/`app_form`/`approved` observed (the recipe→grocery-list flow confirms the same pipeline handles at least two trigger types — manual list import and recipe-ingredient extraction — but doesn't expand the enum); what other engines exist (photo OCR? URL recipe import?) and what do pending/rejected/failed states look like?
5. Full `album` resource **read** schema — the list endpoint returned empty in every captured example; only one write field (`title`) is confirmed, via `pyskylight`'s live write-testing.
6. User invite / co-parent / multi-user account-sharing endpoints — referenced by the product's help center (per `04-profiles-settings-access.md`) but no corresponding API endpoint was found in any of the three sources consulted here (two OpenAPI specs plus `pyskylight`).
7. Numeric rate-limit threshold — `pyskylight`'s dedicated `RateLimitError`/`429` mapping confirms a limit is enforced, but no source states the actual number (requests/minute, burst allowance, or whether it's per-token, per-account, or per-IP).
8. The real Buddy **alarm** request/response schema — the field names (`time`, `hour`, `minute`, `enabled`, `volume`, `sound`, `label`, `snoozable`, `rrule`, `fires_on`) are known only from the vendor web app's own JS bundle constants, never from an actual create/read round-trip (no Buddy hardware was available to `pyskylight`'s testers). Likewise `device.sleep_mode`'s two candidate values (`screen_off`, `dim_clock`) are sourced from the same bundle-constants approach and were never confirmed by a successful live `PUT`.
9. `reset_device` (factory reset) and `delete_device` (unpairing) — endpoints referenced but deliberately not exercised (irreversible on real hardware); `reset_device` isn't even implemented in `pyskylight` yet.
10. Account-level writes — `update_user`, `delete_user`, and notification-preference toggles — were left untested by `pyskylight`'s authors specifically because they have no clean undo path on a real account.
11. Direct confirmation (APK teardown, job posting, or other primary source) of the mobile app's actual tech stack/package name — not found in this research pass; the "Expo/React Native Web" claim seen in an AI search summary was not independently verified and should not be treated as confirmed. (The `pyskylight` notes do newly confirm the vendor ships a minified **web** client bundle containing readable JS — `deviceUtils.isBuddy`, `buddyConstants`, `defaultAlarmAttributes` — which is a real, if narrow, data point about the web app's tech stack, but says nothing about the native mobile app specifically.)
12. Direct Home Assistant Community forum and Reddit (old.reddit.com) discussion threads were not crawled in this pass — the one HA Community thread found and fetched ("DIY Family Calendar (Skylight)") turned out to be an unrelated from-scratch clone-in-HA project with no bearing on the real API, and no Reddit results surfaced via web search at all; genuine forum/Reddit API discussion may simply be scarce, or may require a dedicated old.reddit.com crawl not attempted here.
13. `mightybandito/Skylight`'s OpenAPI spec was located and its endpoint list confirmed, but not read in full depth (only its 11 paths' summaries/parameters, not every captured example) — it may contain additional field-level detail for `GET /api/frames/{frameId}` (frame attributes), `GET /api/frames/{frameId}/devices`, and `GET /api/frames/{frameId}/source_calendars` beyond what `pyskylight`'s notes already extracted and are reported above.

---

## Sources

- `[PRIMARY]` OpenAPI spec (downloaded and read in full, 20,053 lines): https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/docs/openapi/openapi.yaml
- Repo README: https://github.com/TheEagleByte/skylight-api (and raw: https://raw.githubusercontent.com/TheEagleByte/skylight-api/main/README.md)
- Live rendered docs referenced by that repo: https://theeaglebyte.github.io/skylight-api/swagger.html , https://theeaglebyte.github.io/skylight-api/redoc.html
- Gist: "Skylight REST API Documentation" — https://gist.github.com/dknowles2/b8eab833eb23eb388c3d78999a3565f8
- `[PRIMARY]` `dknowles2/pyskylight` — README (downloaded and read in full): https://raw.githubusercontent.com/dknowles2/pyskylight/main/README.md
- `[PRIMARY]` `dknowles2/pyskylight` — `docs/api-notes.md`, 485 lines, live-verified endpoint notes (downloaded and read in full): https://raw.githubusercontent.com/dknowles2/pyskylight/main/docs/api-notes.md
- `[PRIMARY]` `dknowles2/pyskylight` — `pyskylight/models.py`, 613 lines, typed data models (downloaded and read in full): https://raw.githubusercontent.com/dknowles2/pyskylight/main/pyskylight/models.py
- `mightybandito/Skylight` — a second, independent OpenAPI spec (path/parameter list checked, not read in full depth): https://raw.githubusercontent.com/mightybandito/Skylight/main/docs/openapi/openapi.yaml
- https://github.com/dknowles2/ha-skylight
- https://github.com/riyadchowdhury/ha-skylight-tasks
- https://github.com/TheEagleByte/skylight-mcp (npm: https://www.npmjs.com/package/@eaglebyte/skylight-mcp)
- https://github.com/chrischall/skylight-mcp
- https://github.com/rjhalvorson/skylight-mcp
- https://github.com/lancereinsmith/claude-skylight-plugin
- https://github.com/logich/Skylight-swift/blob/main/skylight_api_resources.md
- https://github.com/ramseys1990/Skylight (referenced from the above, not independently fetched)
- https://github.com/MegaTheLEGEND/skylight_calendar
- https://github.com/kylebjordahl/skylight-calendar-home-assistant
- https://github.com/mohesles/my-skylight-calendar
- https://github.com/superdingo101/daylight-calendar-card
- https://github.com/tienou/ha-skylight-family-calendar-card
- https://community.home-assistant.io/t/diy-family-calendar-skylight/844830 (fetched — an unrelated from-scratch HA clone project, not a Skylight API discussion; see Open Questions #12)
- https://github.com/topics/skylight (GitHub topic index used for discovery)
