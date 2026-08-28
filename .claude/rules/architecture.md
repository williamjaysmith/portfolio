# Architecture — Portfolio

A Next.js 16 App Router portfolio (willsmith.dev, deployed on Vercel) that also hosts
self-contained sub-apps. Each sub-app is a feature module that owns its own components,
state, and tests.

## Layers

```
app/**/page.tsx, layout.tsx      presentation (Server Components by default)
app/**/<Component>.tsx           feature components ('use client' only where needed)
app/api/**/route.ts              route handlers (none yet; arriving with /family)
lib/**                           domain + data access, framework-free where possible
```

## Import rules (enforced by fallow `boundaries` in `.fallowrc.json`)

| From         | May import                                        |
|--------------|---------------------------------------------------|
| `lib`        | `lib`                                             |
| `components` | `components`, `lib`                               |
| `ui-pages`   | `ui-pages`, `components`, `lib`                   |
| `api-routes` | `api-routes`, `lib`                               |
| `config`     | `config`, `lib`                                   |
| `tests`      | anything                                          |

`lib` must never import from `app/**`. A page must never talk to a storage backend directly —
it goes through a `lib` module.

## Sub-app conventions

- One folder per sub-app under `app/<name>/`, with its own `__tests__/` alongside.
- Persistence is accessed through a small interface in `lib/` (see `lib/colectivo-storage.ts`)
  so the backend can be swapped without touching UI.
- Shared, app-agnostic types live in `lib/types.ts`.

## Codebase orientation

`graphify-out/graph.json` holds a knowledge graph of this repo (516 nodes at last build).
Ask it before grepping: `npm run graph:query "<question>"`. Rebuild with `npm run graph`.
