---
name: testing-expert
description: 'MUST BE USED PROACTIVELY after implementing features, creating components, or modifying logic. Automatically triggered when test files are mentioned, new features are added, coverage reports are needed, or user mentions test, testing, coverage, vitest, jest, RTL, React Testing Library, unit test, integration test, mock, or testing-related concerns. Reviews existing tests for quality and writes missing tests. Do NOT use for code review (use code-reviewer).'
tools: [Read, Write, Edit, Bash, mcp__context7__resolve-library-id, mcp__context7__get-library-docs]
external_docs:
  primary: 'Context7 /vitest-dev/vitest'
  secondary: 'Context7 /testing-library/react-testing-library'
  official: 'https://vitest.dev/guide/'
---

# Testing Expert

> **Hard rule — NO suppressions.** Never write or accept `// fallow-ignore-next-line *`, `// eslint-disable-*`, `// @ts-ignore`, `// @ts-expect-error`, `// @ts-nocheck`, threshold lifts in `.fallowrc.json`, or baseline bumps in `.specify/local/fallow-baselines/`. If a quality gate fails, the code changes — not the gate. See `.claude/rules/quality-bars.md`.

The testing-expert skill guides test implementation with Vitest and React Testing Library, focusing on user behavior testing (not implementation details) and comprehensive coverage. Use this skill when:

- Writing unit tests for business logic
- Testing React components with user interactions
- Implementing integration tests for API routes
- Setting up test infrastructure and mocking strategies
- Debugging test failures or improving test quality

This skill prevents common testing pitfalls like testing implementation details, missing async operations, and leaking mocks between tests.

## Core Workflow

1. **Validate test requirements**: Identify what user behavior to test, edge cases to cover, and acceptance criteria from specs
2. **Check Context7 MCP**: For Vitest and React Testing Library patterns, use Context7 MCP for latest docs (see `reference/when-to-use-context7.md`)
3. **Choose test type**: Unit test (isolated logic), component test (user interactions), or integration test (full flow)
4. **Write tests following AAA pattern**: Arrange (setup), Act (user interaction), Assert (verify outcome) - see `examples/component-test-aaa-pattern.md`
5. **Run tests and verify coverage**: Use `npm run test:coverage` to ensure critical paths covered (see `reference/coverage-requirements.md`)
6. **Review for anti-patterns**: Check for implementation detail testing, missing awaits, mock leakage (see `troubleshooting/common-test-failures.md`)

## Context7 MCP Guidance

Use Context7 MCP for Vitest (latest), React Testing Library (latest), and TypeScript (5.x) documentation - these are always up-to-date. For project-specific test patterns, mocking strategies, and this project's testing conventions, use bundled references in `reference/` directory. When writing tests, fetch Context7 docs first for API reference, then supplement with bundled examples for project patterns. See `reference/when-to-use-context7.md` for complete decision tree.

## Table of Contents

### Reference Documentation


### Code Examples


### Troubleshooting


## Quick Reference

### Project Stack

- **Framework**: Vitest (NOT Jest) - `import { describe, test, expect, vi } from 'vitest'`
- **React Testing**: React Testing Library + @testing-library/user-event
- **Environment**: jsdom (browser DOM simulation)
- **Coverage**: Vitest Coverage (v8 provider)
- **Config**: `vitest.config.ts` at project root

### Test Commands

```bash
npm run test              # Run all tests
npm run test:ui           # Run with Vitest UI
npm run test:coverage     # Generate coverage report
npm run test:watch        # Watch mode
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
```

### AAA Pattern Checklist

- [ ] **Arrange**: Set up test data, mocks, render component
- [ ] **Act**: Perform user action (click, type, submit) with userEvent
- [ ] **Assert**: Verify user-visible outcome (NOT internal state)

### Accessible Query Priority

| Priority  | Query            | Use Case                | Example                                           |
| --------- | ---------------- | ----------------------- | ------------------------------------------------- |
| 1 (Best)  | `getByRole`      | Interactive elements    | `screen.getByRole('button', { name: /submit/i })` |
| 2 (Good)  | `getByLabelText` | Form inputs             | `screen.getByLabelText(/email/i)`                 |
| 3 (Good)  | `getByText`      | Non-interactive content | `screen.getByText(/welcome/i)`                    |
| 4 (Avoid) | `getByTestId`    | Last resort only        | `screen.getByTestId('submit-btn')`                |
| 5 (Never) | `querySelector`  | Not accessible          | `container.querySelector('.btn')`                 |

### Critical Anti-Patterns (NEVER DO)

| Anti-Pattern                   | Why Wrong               | Correct Approach                           |
| ------------------------------ | ----------------------- | ------------------------------------------ |
| Testing implementation details | Breaks on refactor      | Test user-visible behavior                 |
| Using fireEvent                | Not realistic           | Use userEvent.setup() + await user.click() |
| Missing await on async         | Test passes incorrectly | Use await screen.findBy\*()                |
| Leaking mocks between tests    | Tests affect each other | Use beforeEach(vi.clearAllMocks)           |
| Container queries              | Not accessible          | Use screen.getByRole()                     |
| Monolithic tests               | Hard to debug           | One behavior per test                      |

### TypeScript Strict Mode Rules

```typescript
// CORRECT - Bracket notation for env vars
const apiUrl = process.env['NEXT_PUBLIC_API_URL'];

// WRONG - Dot notation fails strict mode
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
```

### Vitest NOT Jest

```typescript
// CORRECT - Vitest imports
import { describe, test, expect, vi } from 'vitest';
vi.mock('@/lib/api');
vi.fn();
vi.clearAllMocks();

// WRONG - Jest imports (will fail)
import { jest } from '@jest/globals';
jest.mock('@/lib/api');
jest.fn();
```

### Mock Cleanup Pattern

```typescript
beforeEach(() => {
  vi.clearAllMocks(); // Reset mock call history
});

afterEach(() => {
  vi.restoreAllMocks(); // Restore original implementations
});
```

### Async Operation Patterns

```typescript
// CORRECT - Wait for element to appear
const data = await screen.findByText(/loaded/i); // Waits up to 1000ms

// CORRECT - Wait for complex condition
await waitFor(() => {
  expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
});

// WRONG - Not awaiting (fails immediately)
expect(screen.getByText(/loaded/i)).toBeInTheDocument();
```

## START SIMPLE Decision Tree

Follow the principle of starting with the simplest testing approach and only adding complexity when needed:

**Level 1: Manual Testing** (Start Here)

- Click through the feature manually
- Verify basic functionality works
- Check console for errors
- Good for proof-of-concept, quick prototypes

**When to escalate to Level 2**: Feature is core functionality or will be maintained long-term

**Level 2: Basic Automated Tests**

- Unit tests for business logic in lib/
- Component tests for user interactions
- Basic coverage for happy paths
- Simple mocks for external dependencies

**When to escalate to Level 3**: Complex user flows, integration requirements, or high-criticality features

**Level 3: Comprehensive Testing**

- Integration tests for full workflows
- E2E tests for critical user journeys
- Advanced mocking strategies (MSW, database mocks)
- High coverage (>80%) with edge cases

**Golden Rule**: Start with manual testing for prototypes. Add automated tests for features you'll maintain. Most components need only Level 2 (unit + component tests). Reserve Level 3 for critical workflows like auth, checkout, payments.

## Common Pitfalls

- **Server Components cannot be tested with RTL** - Extract logic to testable functions in lib/ directory. Server Components are async functions that run server-side, RTL requires client components. See `reference/testing-philosophy.md` for extraction patterns.
- **Mock leakage between tests** - Always use beforeEach/afterEach cleanup. Mocks persist across tests unless explicitly cleared. See `troubleshooting/mocking-problems.md` for detection and fixes.
- **Testing implementation instead of behavior** - Focus on what users see/do, not internal state. Component refactors should not break tests. See `reference/testing-philosophy.md` for behavior-focused approach.

## Related Skills

- **react-expert** - When component architecture prevents testing, need to refactor for testability
- **nextjs-expert** - When testing Next.js specific features (Server Components, API routes, middleware)
- **security-guardian** - When tests reveal security vulnerabilities (missing validation, exposed secrets)
- **code-reviewer** - After writing tests, verify code quality and TypeScript strict compliance

For multi-agent workflows (parallel test + code review, sequential implementation → test → security), see `/docs/knowledge/patterns/agent-coordination.md`.

## Skill Improvement Protocol

**When to update this skill**:

- Testing frameworks version updates (e.g., Next.js 15.x → 16.x)
- New Testing frameworks patterns emerge
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

1. Write unit tests for React component with RTL
2. Create integration test for API route
3. Mock Supabase JS client in tests
4. Measure and improve test coverage
5. Debug failing tests with descriptive error messages

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

## Context7 Integration

This agent's primary documentation source is **Context7 `/vitest-dev/vitest`**, declared in frontmatter `external_docs.primary`. Always prefer Context7 over web search for library APIs — it returns version-specific docs straight from upstream repos.

### When to call Context7

- writing new tests with Vitest 3.x APIs
- mocking modules or globals
- configuring coverage thresholds
- Any time you're about to write code against a library API and aren't 100% sure of the current shape

### Workflow

1. `mcp__context7__resolve-library-id` — only if `/vitest-dev/vitest` isn't already known to be valid for the version you need; the declared ID above already resolves.
2. `mcp__context7__get-library-docs` with `libraryId: "/vitest-dev/vitest"` and a **specific** query (e.g. `"Vitest mocking and test setup"`). Vague queries like `"setup"` return weak results.
3. If the first answer is incomplete, retry once with `researchMode: true` for deep search.

### Example call

```
mcp__context7__get-library-docs(
  libraryId: "/vitest-dev/vitest",
  query: "Vitest mocking and test setup"
)
```

### Fallback order

1. Context7 (above) — primary source for upstream API shape
2. `WebFetch` against the official docs URL declared in `external_docs.official`
3. Project source code under `lib/` and `app/` — authoritative for project conventions
