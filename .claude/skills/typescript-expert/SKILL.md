---
name: 'typescript-expert'
description: 'Use PROACTIVELY for advanced type engineering, strict mode enforcement beyond code-reviewer, type-level programming, branded types, conditional types, mapped types, template literal types, discriminated unions, advanced type narrowing, utility type creation, generic constraints, or when user mentions TypeScript advanced patterns, type safety, type inference, type guards, variance, or complex type transformations. Do NOT use for basic TypeScript (use code-reviewer) or React types (use react-expert).'

tools: [Read, Write, Edit, mcp__context7__resolve-library-id, mcp__context7__get-library-docs]
external_docs:
  primary: 'Context7 /microsoft/typescript'
  official: 'https://www.typescriptlang.org/docs'
  version: '5.x'
---

# TypeScript Expert

> **Hard rule — NO suppressions.** Never write or accept `// fallow-ignore-next-line *`, `// eslint-disable-*`, `// @ts-ignore`, `// @ts-expect-error`, `// @ts-nocheck`, threshold lifts in `.fallowrc.json`, or baseline bumps in `.specify/local/fallow-baselines/`. If a quality gate fails, the code changes — not the gate. See `.claude/rules/quality-bars.md`.

## Overview

The typescript-expert skill guides advanced TypeScript usage with strict mode enforcement, type-level programming, and compile-time safety patterns. Use this skill when:

- Implementing type-safe APIs with branded types and discriminated unions
- Resolving strict mode violations and type narrowing challenges
- Engineering advanced types (conditional, mapped, template literal)
- Eliminating `any` and unsafe type assertions from codebase

This skill prevents runtime errors through compile-time type safety, ensuring TypeScript's type system catches bugs before deployment.

## Core Workflow

1. **Validate requirements**: Identify type safety goals (branded IDs, state machines, API contracts, validation schemas)
2. **Check Context7 MCP**: For TypeScript 5.x patterns, use Context7 MCP for latest documentation (see `reference/when-to-use-context7.md`)
3. **Apply strict mode rules**: Enforce zero-any tolerance, bracket notation for env vars, prefer type inference with `satisfies` (see `reference/strict-mode-config.md`)
4. **Engineer types**: Use branded types for domain IDs, discriminated unions for states, template literals for string patterns (see `examples/`)
5. **Validate externally**: Always use Zod for runtime validation of external data (API responses, user input, JSON parsing)
6. **Test type safety**: Verify types catch errors at compile time, test edge cases with type narrowing
7. **Review patterns**: Run code-reviewer to detect type assertion abuse, any creep, missing discriminated unions

## Context7 Integration

Use Context7 MCP to fetch always-current TypeScript 5.x documentation for advanced types, generics, and type-level programming.

### When to Use Context7

- TypeScript 5.x language features and syntax
- Advanced type patterns (conditional, mapped, template literal types)
- Utility types (Partial, Pick, Omit, etc.)
- Type inference rules and compiler behavior
- Generic constraints and variance

### When to Use Bundled References

- this project's strict mode configuration
- Project-specific branded type patterns
- Common type error solutions for this codebase

### Working Example: Fetching TypeScript Documentation

**Step 1 - Resolve Library ID**:

```typescript
// Resolve TypeScript library in Context7
mcp__context7__resolve - library - id('typescript');
// Returns: [{"id": "/microsoft/typescript", "version": "5.x", "trustScore": 10}]
```

**Step 2 - Get Documentation**:

```typescript
// Fetch template literal types documentation
mcp__context7__get -
  library -
  docs('/microsoft/typescript/v5.x', (topic = 'template-literal-types'));
// Returns: Latest TypeScript template literal types documentation
```

**Step 3 - Apply Documentation**:
Use returned documentation to implement type-safe route patterns or event name types using current TypeScript 5.x APIs.

### Fallback Strategy

If Context7 MCP is unavailable:

1. Check bundled references in `reference/` directory
2. Use official docs: https://www.typescriptlang.org/docs
3. Consult project-specific examples in `examples/` directory

## Table of Contents

### Reference Documentation


### Code Examples


### Troubleshooting


## Quick Reference

### Project-Specific Rules

| Rule                                        | Bad Example                                    | Good Example                                                        |
| ------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| **Zero `any` Tolerance**                    | `const data: any = response.json()`            | `const data: unknown = response.json(); if (isValid(data)) { ... }` |
| **Bracket Notation for Env Vars**           | `process.env.API_KEY`                          | `process.env['API_KEY']`                                            |
| **Prefer `satisfies` over Type Annotation** | `const config: Record<string, string> = {...}` | `const config = {...} satisfies Record<string, string>`             |

### Type Pattern Selection

| Use Case                         | Pattern                | Example                                                                   |
| -------------------------------- | ---------------------- | ------------------------------------------------------------------------- |
| Domain IDs (prevent mixing)      | Branded Types          | `type UserId = Brand<string, 'UserId'>`                                   |
| State machines                   | Discriminated Unions   | `type State = \| { status: 'loading' } \| { status: 'success'; data: T }` |
| String patterns (routes, events) | Template Literal Types | `type Route = \`/products/${string}\``                                    |
| Type transformations             | Conditional Types      | `type Awaited<T> = T extends Promise<infer U> ? U : T`                    |
| External data validation         | Zod + Type Inference   | `const schema = z.object({...}); type T = z.infer<typeof schema>`         |

### Strict Mode Checklist

- [ ] `strict: true` enabled in tsconfig.json
- [ ] `noUncheckedIndexedAccess: true` (prevents unsafe index access)
- [ ] `noImplicitAny: true` (no implicit any types)
- [ ] All env var access uses bracket notation: `process.env['VAR_NAME']`
- [ ] No `any` types in codebase (use `unknown` + narrowing)
- [ ] No `as` type assertions without runtime validation
- [ ] No excessive `!` non-null assertions (use optional chaining instead)

### Anti-Patterns to Avoid

| Anti-Pattern                  | Why Bad                                               | Solution                                                                          |
| ----------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| Type Assertion Abuse          | `JSON.parse(data) as User`                            | Use Zod: `UserSchema.parse(JSON.parse(data))`                                     |
| Excessive Non-Null Assertions | `user!.profile!.name!`                                | Use optional chaining: `user?.profile?.name ?? 'Unknown'`                         |
| Any Creep                     | `function fetch(): any { ... }`                       | Use generics: `function fetch<T>(): Promise<T>`                                   |
| Unsafe Index Access           | `config[key]` returns `string` (runtime: `undefined`) | Enable `noUncheckedIndexedAccess`                                                 |
| Missing Discriminated Unions  | `{ loading: boolean; error?: Error; data?: T }`       | Use discriminant: `\| { status: 'loading' } \| { status: 'error'; error: Error }` |

## START SIMPLE Decision Tree

Follow the principle of starting with the simplest TypeScript pattern and only adding type complexity when needed:

**Level 1: Basic Types** (Start Here)

- Inline type annotations (`: string`, `: number`)
- Basic interfaces for props and data
- Avoid generics, mapped types, conditional types
- Direct, explicit typing

**When to escalate to Level 2**: Code duplication in types, need for reusable patterns

**Level 2: Type Reuse**

- Extract shared interfaces and types
- Basic generics (`Array<T>`, `Promise<T>`)
- Union types and discriminated unions
- Type guards for narrowing

**When to escalate to Level 3**: Complex type transformations, advanced type safety requirements

**Level 3: Advanced Type Engineering**

- Mapped types and template literals
- Conditional types and type-level programming
- Branded types for ID safety
- Complex generic constraints

**Golden Rule**: Most code should stay at Level 1-2. Only use advanced type patterns when they solve a specific, recurring type safety problem. Premature type abstraction adds complexity without benefit.

## Common Pitfalls

- **Type assertions without validation**: Using `as` or `<Type>` without runtime checks bypasses TypeScript's safety. Always validate external data with Zod schemas before type assertions. See `examples/type-safe-api-client.md`
- **Ignoring `undefined` with `!`**: Non-null assertions tell TypeScript "trust me, this exists" but crash at runtime if wrong. Use optional chaining or early returns instead. See `troubleshooting/strict-mode-errors.md`
- **Generic names lose type info**: `const config: Record<string, string>` loses literal types. Use `satisfies` to preserve inference while validating structure. See `reference/advanced-type-patterns.md`

## Related Skills

- **code-reviewer**: Invoke for detecting basic TypeScript errors, simple strict mode violations, and `any` usage before commits
- **react-expert**: Coordinate for React-specific type patterns (component props, hooks, state typing, event handlers)
- **nextjs-expert**: Coordinate for Next.js type patterns (page props, API route handlers, server/client component typing)
- **security-guardian**: Coordinate when type definitions involve sensitive data (credentials, tokens, PII) to ensure proper typing

For multi-agent coordination patterns (sequential vs parallel), see `/docs/knowledge/patterns/agent-coordination.md`.

## Skill Improvement Protocol

**When to update this skill**:

- TypeScript version updates (e.g., Next.js 15.x → 16.x)
- New TypeScript patterns emerge
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

1. Implement advanced type engineering (conditional types, mapped types)
2. Create branded types for runtime safety
3. Fix strict mode violations
4. Build discriminated unions for state management
5. Design generic constraints for reusable types

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
