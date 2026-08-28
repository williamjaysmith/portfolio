---
name: 'react-expert'
description: 'Use PROACTIVELY when creating or modifying React components, implementing hooks, managing component state, or reviewing React patterns. MUST BE USED for any .tsx/.jsx files in app/components/** or an app-local components/ folder, or when user mentions React, hooks, state, props, useEffect, useMemo, useCallback, ref forwarding, context, or component composition. Do NOT use for app/**/*.tsx files (those are owned by nextjs-expert — page/layout/route boundaries). Do NOT use for advanced TypeScript types (use typescript-expert), or Tailwind className styling (use tailwind-expert).'

tools: [Read, Write, Edit, mcp__context7__resolve-library-id, mcp__context7__get-library-docs]

external_docs:
  primary: 'Context7 /facebook/react'
  official: 'https://react.dev'
  version: '19.1.0'
---

# React Expert Skill

> **Hard rule — NO suppressions.** Never write or accept `// fallow-ignore-next-line *`, `// eslint-disable-*`, `// @ts-ignore`, `// @ts-expect-error`, `// @ts-nocheck`, threshold lifts in `.fallowrc.json`, or baseline bumps in `.specify/local/fallow-baselines/`. If a quality gate fails, the code changes — not the gate. See `.claude/rules/quality-bars.md`.

## Overview

The react-expert skill guides React 19 component development, hooks patterns, state management, and performance optimization in Next.js App Router context. Use this skill when:

- Building React components (Server or Client Components)
- Implementing React 19 hooks (useState, useEffect, use, useActionState, useOptimistic)
- Managing component state and side effects
- Optimizing component performance (memoization, re-render prevention)
- Debugging React-specific issues (stale closures, missing dependencies, infinite loops)

This skill prevents common React pitfalls like derived state in useEffect, direct state mutation, missing dependencies, and premature optimization.

## Core Workflow

1. **Determine component type**: Server Component (default) or Client Component (interactive with hooks) - see `reference/server-vs-client-components.md`
2. **Check Context7 MCP**: For React 19 hooks, patterns, and API reference, use Context7 MCP for latest docs (see `reference/when-to-use-context7.md`)
3. **Design component structure**: Single responsibility, composable components with clear props interface (see `examples/component-composition.md`)
4. **Implement state management**: Minimal state, compute during render, immutable updates (see `reference/state-management-patterns.md`)
5. **Add hooks correctly**: Top-level only, complete dependencies, proper cleanup (see `reference/hooks-rules.md`)
6. **Optimize if needed**: Profile first, then apply memoization where data proves necessary (see `reference/performance-optimization.md`)
7. **Test components**: Unit tests for logic, integration tests for behavior - invoke testing-expert for implementation

**Apply Feedback Loop Pattern**: After implementation, verify with `npx tsc --noEmit`, `npm test`, `npm run lint`. Max 3 verification cycles. See CLAUDE.md for details.

## Context7 Integration

Use Context7 MCP to fetch always-current React 19.1.0 documentation for hooks, Server Components, and new features.

### When to Use Context7

- React 19.1.0 hooks API reference (useState, useEffect, use, useActionState, useOptimistic)
- Server Components and Client Components patterns
- React 19 new features (ref as prop, Context without Provider)
- Official React performance optimization guidance

### When to Use Bundled References

- project-specific component patterns
- React + Next.js App Router integration
- Project-specific state management strategies

### Working Example: Fetching React Documentation

**Step 1 - Resolve Library ID**:

```typescript
// Resolve React library in Context7
mcp__context7__resolve - library - id('react');
// Returns: [{"id": "/facebook/react", "version": "19.1.0", "trustScore": 10}]
```

**Step 2 - Get Documentation**:

```typescript
// Fetch useActionState hook documentation
mcp__context7__get - library - docs('/facebook/react/v19.1.0', (topic = 'useActionState'));
// Returns: Latest React 19 useActionState documentation
```

**Step 3 - Apply Documentation**:
Use returned documentation to implement form handling with useActionState and Server Actions using current React 19.1.0 APIs.

### Fallback Strategy

If Context7 MCP is unavailable:

1. Check bundled references in `reference/` directory
2. Use official docs: https://react.dev
3. Consult project-specific examples in `examples/` directory

## Table of Contents

### Reference Documentation


### Code Examples


### Troubleshooting


## Quick Reference

### Component Architecture

| Pattern          | When to Use                                     | Directive                      |
| ---------------- | ----------------------------------------------- | ------------------------------ |
| Server Component | Static content, data fetching, no interactivity | (none, default)                |
| Client Component | Hooks, events, browser APIs, state              | `'use client'`                 |
| Hybrid           | Server Component wraps Client Components        | Server parent, Client children |

### Core Principles

**MUST**:

- Server Components by default in Next.js App Router
- Hooks at top level only (no conditions, loops, nested functions)
- Immutable state updates (never mutate arrays/objects directly)
- Complete dependencies in useEffect (include all referenced values)
- Unique, stable keys in lists (use IDs, not array indexes)

**SHOULD**:

- Compute derived state during render (avoid useEffect for calculations)
- Minimal state (no redundant or derived state)
- Single responsibility components (composable, reusable)
- Profile before optimizing (measure actual performance impact)

**MUST NOT**:

- Mutate state directly (`items.push(x)` then `setItems(items)`)
- Use index as key when list can change
- Put hooks in conditions, loops, or nested functions
- Optimize without measuring (premature optimization)

### Common Hooks Patterns

```typescript
// useState - Lazy initialization
const [data, setData] = useState(() => expensiveComputation())

// useState - Functional updates (when new state depends on old)
setCount(count => count + 1)  // ✅ Safe with concurrent updates
setCount(count + 1)            // ❌ May use stale value

// useEffect - Side effects with cleanup
useEffect(() => {
  const timer = setInterval(() => setTime(Date.now()), 1000)
  return () => clearInterval(timer)  // Cleanup
}, [])

// useMemo - Expensive computation
const sorted = useMemo(() => items.sort(...), [items])

// useCallback - Stable function reference
const handleClick = useCallback(() => onAction(id), [id, onAction])

// useContext - Avoid prop drilling
const theme = useContext(ThemeContext)
```

### React 19 Features

```typescript
// ref as Prop (no forwardRef needed)
function Input({ ref, ...props }: { ref: Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />
}

// Context without Provider wrapper
<ThemeContext value="dark">
  <App />
</ThemeContext>

// use() hook - Unwrap promises in Client Components
'use client'
function DataDisplay({ dataPromise }) {
  const data = use(dataPromise)  // Suspends until resolved
  return <div>{data.value}</div>
}

// useActionState - Form handling with Server Actions
const [state, formAction, isPending] = useActionState(
  addProductAction,
  { error: null }
)

// useOptimistic - Instant UI updates
const [optimisticTodos, addOptimisticTodo] = useOptimistic(
  todos,
  (state, newTodo) => [...state, newTodo]
)
```

### Anti-Patterns to Avoid

| Anti-Pattern                  | Why Bad                  | Solution                          |
| ----------------------------- | ------------------------ | --------------------------------- |
| `useEffect` for derived state | Extra render, complexity | Compute during render             |
| Missing effect dependencies   | Stale closures, bugs     | Include all referenced values     |
| Direct state mutation         | No re-render, bugs       | Immutable updates with spread     |
| Index as key                  | Wrong components update  | Use unique, stable IDs            |
| Premature optimization        | Complexity, maintenance  | Profile first, optimize hot paths |

## START SIMPLE Decision Tree

Follow the principle of starting with the simplest solution and only adding complexity when needed:

**Level 1: Simple Component** (Start Here)

- Single functional component in one file
- Basic props with TypeScript interface
- Server Component by default (no hooks needed)
- Direct rendering without abstraction

**When to escalate to Level 2**: Need interactivity (clicks, forms), browser APIs, or React hooks

**Level 2: Client Component with State**

- Add `'use client'` directive
- Use useState, useEffect for simple state/effects
- Keep state local to component
- Basic event handlers

**When to escalate to Level 3**: Complex state logic, performance issues, or shared state needs

**Level 3: Advanced Patterns**

- useReducer for complex state machines
- useMemo/useCallback for expensive computations
- Context for shared state
- Custom hooks for reusable logic

**Golden Rule**: Most components should stay at Level 1 (Server Components). Only add client-side complexity when you need interactivity.

### Decision Tree

```
Creating a component?
├─ Interactive (hooks, events, browser APIs)?
│   ├─ YES → 'use client' + React hooks
│   └─ NO → Server Component (default)
│
Managing state?
├─ Computed from props/state? → No useState, compute during render
├─ Local UI state? → useState in component
├─ Shared across components? → Lift state up or Context API
└─ Server data? → Server Component fetch + pass as props
│
Using useEffect?
├─ Side effects (APIs, subscriptions, timers)? → ✅ Correct use
├─ Derived state (filtering, sorting, calculations)? → ❌ Compute during render
└─ Synchronizing with external system? → ✅ Correct use
│
Need optimization?
├─ Expensive computation? → useMemo (profile first)
├─ Prevent child re-render? → React.memo (measure impact)
├─ Stable callback for memoized child? → useCallback
└─ Simple/cheap operation? → Skip optimization
```

## Formatting (Automated)

This app uses Prettier + `prettier-plugin-tailwindcss` — run `npm run format` to auto-fix indentation, quotes, and Tailwind class ordering in `className` / `clsx()` / `cn()` / `twMerge()`. **Don't hand-order Tailwind classes**; the plugin sorts by Tailwind's official spec on save/commit.

## Common Pitfalls

- **useEffect for derived state**: Compute during render instead of storing in state (see `troubleshooting/state-not-updating.md`)
- **Missing effect dependencies**: Leads to stale closures and bugs (see `troubleshooting/stale-closures.md`)
- **Direct state mutation**: Arrays/objects mutated directly don't trigger re-renders (see `reference/state-management-patterns.md`)
- **Premature optimization**: Profile first - most components don't need memoization (see `reference/performance-optimization.md`)
- **Index as key**: Breaks when list changes (see `reference/hooks-rules.md` for key guidelines)

## Related Skills

- **nextjs-expert**: Server vs Client Component architecture, App Router patterns, data fetching strategies
- **typescript-expert**: Advanced component props typing, generic components, type-safe hooks
- **tailwind-expert**: Component styling, responsive design, accessibility styling
- **testing-expert**: Component testing patterns, mocking hooks, testing async behavior
- **performance-expert**: Deep performance analysis, bundle optimization, Core Web Vitals

For multi-skill coordination patterns, see `/docs/knowledge/patterns/agent-coordination.md`.

---

**Remember**:

- Server Components by default, 'use client' only when needed
- Hooks at top level, immutable updates, complete dependencies
- Compute during render, useEffect for side effects only
- Profile before optimizing, optimize hot paths only
- React 19 simplifies refs (no forwardRef) and Context (no Provider wrapper)

## Skill Improvement Protocol

**When to update this skill**:

- React version updates (e.g., Next.js 15.x → 16.x)
- New React patterns emerge
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

1. Create complex component with hooks (useState, useEffect, useActionState)
2. Implement custom hook for shared logic
3. Optimize component re-renders with memoization
4. Build form component with validation
5. Handle async state with React 19 patterns

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
