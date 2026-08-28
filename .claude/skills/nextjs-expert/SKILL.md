---
name: 'nextjs-expert'
description: 'Use PROACTIVELY when creating or modifying Next.js App Router pages, layouts, or route handlers. MUST BE USED for any .tsx files in app/ directory, implementing data fetching, routing patterns, Server/Client component decisions, or when user mentions App Router, server components, client components, use client, loading, error boundary, layout, page, route, or Next.js-specific patterns. Do NOT use for API routes (use backend-developer) or general React (use react-expert).'

tools: [Read, Write, Edit, mcp__context7__resolve-library-id, mcp__context7__get-library-docs]
external_docs:
  primary: 'Context7 /vercel/next.js'
  official: 'https://nextjs.org/docs'
  version: '15.5.3'
---

# Next.js Expert Skill

> **Hard rule — NO suppressions.** Never write or accept `// fallow-ignore-next-line *`, `// eslint-disable-*`, `// @ts-ignore`, `// @ts-expect-error`, `// @ts-nocheck`, threshold lifts in `.fallowrc.json`, or baseline bumps in `.specify/local/fallow-baselines/`. If a quality gate fails, the code changes — not the gate. See `.claude/rules/quality-bars.md`.

## Overview

The nextjs-expert skill guides Next.js 15 App Router implementation, Server/Client Component patterns, and data fetching strategies. Use this skill when:

- Implementing Next.js pages, layouts, or route handlers
- Deciding between Server Components and Client Components
- Implementing data fetching patterns (SSG, SSR, ISR, streaming)
- Setting up routing, error boundaries, or loading states
- Troubleshooting hydration errors or caching issues

This skill prevents common Next.js pitfalls like unnecessary client-side rendering, sequential data fetching, missing error states, and improper caching strategies.

## Core Workflow

1. **Validate requirements**: Confirm route purpose, data requirements, interactivity needs, and SEO/performance requirements
2. **Choose component type**: Server Component by default, Client Component only for interactivity (see Quick Reference decision matrix)
3. **Check Context7 MCP**: For Next.js API patterns, use Context7 MCP to fetch latest docs (see `reference/when-to-use-context7.md`)
4. **Implement route**: Create page.tsx with Server Component, extract Client Components to leaf nodes (see `examples/server-component-composition.md`)
5. **Add data fetching**: Parallel fetching with Promise.all(), cache strategies with fetch options (see `examples/data-fetching-patterns.md`)
6. **Add error/loading states**: Create error.tsx and loading.tsx or use Suspense boundaries (see `examples/error-loading-states.md`)
7. **Verify performance**: Check no unnecessary 'use client', parallel fetching, proper caching (code-reviewer validates before commit)

**Apply Feedback Loop Pattern**: After implementation, verify with `npx tsc --noEmit`, `npm test`, `npm run build`. Max 3 verification cycles. See CLAUDE.md for details.

## Context7 Integration

Use Context7 MCP to fetch always-current Next.js 15.5.3 documentation for App Router patterns, Server Components, and routing.

### When to Use Context7

- Next.js 15.5.3 App Router API reference
- Server Component patterns and data fetching
- Route handler specifications and caching behavior
- Latest Next.js configuration options

### When to Use Bundled References

- project-specific patterns (protected routes, auth integration)
- Next.js + Supabase integration examples
- Project-specific caching strategies

### Working Example: Fetching Next.js Documentation

**Step 1 - Resolve Library ID**:

```typescript
// Resolve Next.js library in Context7
mcp__context7__resolve - library - id('nextjs');
// Returns: [{"id": "/vercel/next.js", "version": "15.5.3", "trustScore": 10}]
```

**Step 2 - Get Documentation**:

```typescript
// Fetch Server Components documentation
mcp__context7__get - library - docs('/vercel/next.js/v15.5.3', (topic = 'server-components'));
// Returns: Latest Next.js Server Components documentation
```

**Step 3 - Apply Documentation**:
Use returned documentation to implement Server Component patterns with current Next.js 15.5.3 APIs.

### Fallback Strategy

If Context7 MCP is unavailable:

1. Check bundled references in `reference/` directory
2. Use official docs: https://nextjs.org/docs
3. Consult project-specific examples in `examples/` directory

## Table of Contents

### Reference Documentation


### Code Examples


### Troubleshooting


## Quick Reference

### Server vs Client Decision Matrix

| Need                               | Use    | Directive        |
| ---------------------------------- | ------ | ---------------- |
| Data fetching (DB/API)             | Server | (none - default) |
| Static content                     | Server | (none - default) |
| SEO-critical content               | Server | (none - default) |
| onClick, onChange handlers         | Client | `'use client'`   |
| useState, useEffect, hooks         | Client | `'use client'`   |
| window, localStorage, browser APIs | Client | `'use client'`   |

**Core Principle**: Server Components by default. Client Components only when necessary.

### File Conventions Cheat Sheet

```
app/
├── page.tsx           # Route page - Server Component by default
├── layout.tsx         # Shared layout - Persists across navigation
├── loading.tsx        # Loading UI - Auto-wraps page in Suspense
├── error.tsx          # Error boundary - Must use 'use client'
├── not-found.tsx      # 404 page - Server or Client Component
├── route.ts           # API route handler - GET, POST, PUT, DELETE, PATCH
│
├── [id]/              # Dynamic route - :id parameter
│   └── page.tsx       # Receives { params: { id: string } }
│
├── [...slug]/         # Catch-all route - Matches /a, /a/b, /a/b/c
│   └── page.tsx       # Receives { params: { slug: string[] } }
│
└── (group)/           # Route group - No URL segment
    └── layout.tsx     # Shared layout for group
```

### Data Fetching Patterns

```typescript
// Server Component (default - no 'use client')
export default async function Page() {
  // Parallel fetching (FAST)
  const [user, orders] = await Promise.all([
    getUser(),
    getOrders()
  ])

  return <Dashboard user={user} orders={orders} />
}
```

**Caching Options**:

- `fetch(url)` → Static (cached indefinitely)
- `fetch(url, { cache: 'no-store' })` → Dynamic (SSR every request)
- `fetch(url, { next: { revalidate: 60 } })` → ISR (revalidate every 60s)

### Composition Pattern (Best Practice)

```typescript
// app/products/page.tsx (Server Component)
export default async function ProductsPage() {
  const products = await getProducts() // Server data fetch

  return (
    <div>
      <Header /> {/* Server Component */}
      <ProductFilters products={products} /> {/* Client Component */}
      <ProductGrid products={products} /> {/* Server Component */}
    </div>
  )
}
```

**Pattern**: Server fetches data → Client handles interactivity → Keep Client Components as leaf nodes

### Common Anti-Patterns to Avoid

| Anti-Pattern                  | Problem                             | Solution                                   |
| ----------------------------- | ----------------------------------- | ------------------------------------------ |
| 'use client' at page root     | Entire page client-rendered, no SEO | Server wrapper, Client only where needed   |
| Sequential data fetching      | Waterfall (slow)                    | `Promise.all([...])` for parallel fetching |
| Fetching in Client Components | useEffect + fetch (slow, no SSR)    | Server Component async/await               |
| Missing loading states        | Blank page during loading           | Add loading.tsx or Suspense                |
| Missing error boundaries      | Unhandled errors crash app          | Add error.tsx with reset button            |

### Security Pattern (Protected Routes)

```typescript
import { getCurrentUserAction } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await getCurrentUserAction()

  if (!session.authenticated) {
    redirect('/login')
  }

  // Mask sensitive data before passing to client
  const safeUser = {
    ...session.user,
    apiKey: session.user.apiKey?.slice(0, 8) + '••••'
  }

  return <Dashboard user={safeUser} />
}
```

### Streaming with Suspense

```typescript
import { Suspense } from 'react'

export default function ProductPage({ params }) {
  return (
    <div>
      <ProductHeader id={params.id} /> {/* Fast */}

      <Suspense fallback={<ReviewsSkeleton />}>
        <ProductReviews id={params.id} /> {/* Slow, streams in */}
      </Suspense>
    </div>
  )
}
```

## START SIMPLE Decision Tree

Follow the principle of starting with the simplest Next.js pattern and only adding complexity when needed:

**Level 1: Simple Server Component** (Start Here)

- Single page.tsx file with Server Component (default)
- Async data fetch at page level
- No 'use client', no state management
- Direct rendering with basic structure

**When to escalate to Level 2**: Need interactivity, browser APIs, or client-side state

**Level 2: Server + Client Split**

- Server Component for page shell and data fetching
- Client Components as leaf nodes for interactivity
- Minimal 'use client' boundaries
- Props-based data passing

**When to escalate to Level 3**: Complex state, multiple data sources, or streaming requirements

**Level 3: Advanced Patterns**

- Streaming with Suspense boundaries
- Parallel data fetching with Promise.all()
- Route groups for shared layouts
- Middleware for auth/redirects
- Advanced caching strategies

**Golden Rule**: Start with Server Components by default. Only add 'use client' when you need interactivity (onClick, useState, useEffect). Most routes should stay at Level 1.

## Formatting (Automated)

This app uses Prettier + `prettier-plugin-tailwindcss` — run `npm run format` to auto-fix formatting and Tailwind class ordering. Don't hand-order classes in `className` / `clsx()` / `cn()` / `twMerge()`.

## Common Pitfalls

- **Unnecessary 'use client'**: Only add when component needs interactivity (onClick, useState, useEffect). Keep Server Components by default for better performance and SEO.
- **Sequential data fetching**: Use `Promise.all()` for parallel fetching to avoid waterfalls. See `examples/data-fetching-patterns.md` for patterns.
- **Missing error boundaries**: Always create error.tsx for routes that can fail. See `examples/error-loading-states.md` for implementation.
- **Improper caching**: Understand fetch cache options (force-cache, no-store, revalidate). See `reference/caching-strategies.md` for guidance.

## Related Skills

- **react-expert**: For React hooks, component patterns, state management
- **backend-expert**: For API route handlers (app/api/), server-side data access
- **typescript-expert**: For TypeScript type errors, Server/Client Component type safety
- **security-guardian**: For protected routes, authentication, data masking
- **performance-expert**: For Core Web Vitals optimization, bundle size analysis

For agent coordination patterns (parallel vs sequential invocation), see `/docs/knowledge/patterns/agent-coordination.md`.

## Skill Improvement Protocol

**When to update this skill**:

- Next.js version updates (e.g., Next.js 15.x → 16.x)
- New Next.js patterns emerge
- Validation script reports warnings/errors
- User feedback indicates confusion or incorrect guidance
- Anthropic releases new agent best practices

**How to evaluate effectiveness**:

1. Run representative test scenarios (see below)
2. Check if skill is invoked correctly by Claude (trigger pattern accuracy)
3. Verify zero overlapping triggers with other skills (validation script)
4. Measure token efficiency (SKILL.md ≤500 lines, reference files on-demand)
5. Confirm Context7 integration works (if applicable)

**Representative test scenarios**:

1. Create new page with Server Component data fetching
2. Implement Server Action with form handling
3. Build layout with nested routing
4. Add loading and error states
5. Optimize Client/Server Component split

**Iteration process**:

1. Identify issue (validation error, user confusion, outdated pattern)
2. Update SKILL.md or reference/ files
3. Run validation script (`scripts/validate-skills.sh`)
4. Test with representative scenarios
5. Update METRICS.md with changes
6. Commit with descriptive message

**Evaluation criteria**:

- Skill invoked correctly >90% of relevant tasks
- Zero ERROR-level validation failures
- ≤2 WARNING-level validation issues
- Context7 examples work without modification (if applicable)
- Reference files loaded only when needed (progressive disclosure working)

## Remember

- **Server by default** - Only add 'use client' when necessary
- **Client as leaf nodes** - Keep Client Components minimal
- **Parallel data fetching** - Use Promise.all()
- **Always provide loading states** - loading.tsx or Suspense
- **Error boundaries** - Add error.tsx for error-prone routes
- **Auth server-side** - Check before data access
- **Mask sensitive data** - Before passing to client

---

**Lines**: 206 (under 250-line target)
**Last Updated**: 2025-10-24
