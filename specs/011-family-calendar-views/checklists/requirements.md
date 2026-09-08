# Specification Quality Checklist: The Calendar's Other Views

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-08
**Feature**: [spec.md](../spec.md)

## Content Quality

- [X] No implementation details (languages, frameworks, APIs)
- [X] Focused on user value and business needs
- [X] Written for non-technical stakeholders
- [X] All mandatory sections completed

## Requirement Completeness

- [X] No [NEEDS CLARIFICATION] markers remain
- [X] Requirements are testable and unambiguous
- [X] Success criteria are measurable and technology-agnostic
- [X] All acceptance scenarios are defined
- [X] Edge cases are identified
- [X] Scope is clearly bounded
- [X] Dependencies and assumptions identified

## Feature Readiness

- [X] All functional requirements have clear acceptance criteria
- [X] User scenarios cover primary flows
- [X] Feature meets measurable outcomes defined in Success Criteria
- [X] No implementation details leak into specification

## Constitution §VIII — evidence discipline

- [X] Every asserted behaviour carries `[VERIFIED](article-id)`, `[INFERRED]` or `[UNKNOWN]`
- [X] Every `[UNKNOWN]` is a numbered `[OURS 2026-09-08 #n]` assumption
- [X] **Every article id resolves to a real dossier file** — checked, not remembered:
      `36625171368987`, `48026687853083`, `360033104791`, `44738510847259`, `36835449004315`,
      `40459070511515`, `36846381293979`
- [X] Cross-phase citations checked (FR-201, FR-256/257, FR-281, FR-284, FR-288 in `002`;
      FR-907, FR-910 in `009`)
- [X] Divergences tabled with reasons — five of them

## The audit, and what it caught

Five readers over the dossiers and the shipped code, each followed by an adversarial citation audit
against the file text. **The audit rejected 25 claims.** Two are worth naming because they are the
exact failure class Phase 8 shipped before this stage existed:

1. A claim citing articles `48026687853083` and `44738510847259` against
   `07-visual-design-system.md` — a file in which **neither id appears at all**.
2. A meals-in-Month claim that **merged a Zendesk id with third-party corroboration** as if both
   attested the same fact.

Neither is in this specification. Nor is a third: a "Month and Schedule are the only views with
documented multi-day rendering" claim whose cited line carries no citation of any kind.

## The findings that shaped this spec

1. **The master map is wrong, in a specific and correctable way.** It lists Day, Month and Schedule
   as "never photographed or documented". `07-visual-design-system.md` says only the first — **not
   present in any image**. Their behaviour, capacities, settings and gestures are documented across
   five articles. Pixels are missing; specification is not.
2. **Day view is not per-Profile columns.** The per-Profile columns documented at
   `02-tasks-and-rewards.md:60` and `:87` are the **Tasks tab's** day view, article
   `36846381293979`. Reading them onto the calendar would have produced a Day view the reference does
   not have. The capacity being counted in "events per screen" is what settles it.
3. **The cost is very unevenly spread**, and the spec's story order reflects it: the switcher is
   fully specified and cheap; Day view is nearly free because the shipped window primitive already
   accepts a one-day window and the layout already accepts one column; **Month is most of the phase**
   — nothing in the shipped grid transfers, since its hit-testing, its overflow, its spans and its
   paging arithmetic all assume a single row of day columns.

## Notes

Eight decisions are ours. The two the operator may want to weigh in on are Assumption 5 (a month cell
opens the **Day** view where the source says Week — the source sentence is app-side and the app has
no Day view) and Assumption 6 (**no drag in Month**, which is the phase's largest deliberate omission
and the reason it stays a phase rather than becoming two).
