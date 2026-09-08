# Specification Quality Checklist: The Home Screen

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
- [X] Success criteria are measurable
- [X] Success criteria are technology-agnostic
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
- [X] Every `[UNKNOWN]` is a numbered `[OURS 2026-09-08 #n]` assumption, never asserted as fact
- [X] **Every article id resolves to a real dossier file** — checked, not remembered:
      `49738702477723` (01, 07, 08), `49738858986907` (05), `36846381293979` (01, 02, 07, 08),
      `50564241301147` (02), `48026687853083` (01)
- [X] Cross-phase citations checked against the shipped specs (FR-028, FR-030, FR-018 in `001`;
      FR-288 in `002`; `counters.ts` in `003`; R902, R905 in `009`)
- [X] Divergences are tabled with reasons

## Where the evidence came from, and what it cost

The research was a five-reader pass over the dossiers and the shipped code, each reader followed by
an adversarial citation audit against the file text. **The audit rejected 23 claims** — two
mis-anchored article ids, one quote that appeared nowhere, and twenty over-tagged claims whose
wording outran the quote supporting them. None of the 23 is in this specification.

That stage exists because Phase 8 shipped three bad citations without it and had to correct them
after the fact.

## The findings that shaped this spec

1. **The landing screen is contested, and the contest is decidable.** The master map says the app
   opens on the Calendar tab "exactly like the device"; article `49738702477723` says the device
   lands on the Home Screen. **The master map carries no article id in any of its 611 lines**, so
   nothing sourced only from it can meet §VIII. The article wins — and this reverses Phase 1's
   FR-030, which is why it is Divergence 1 rather than a quiet change.
2. **"Home screen" means four different things in these dossiers.** The device's Home Screen, the
   phone app's launcher grid, the Skylight Buddy's screen, and the iOS "Add to Home Screen" install
   gesture. Three of the four are traps and are named in the spec so a later reader does not adopt
   one.
3. **The panes' contents are almost entirely `[UNKNOWN]`.** What is documented is that there are
   three, which is fixed, which two toggle, and that tasks can be completed from the screen.
   Everything about what a pane *renders* is ours — Assumptions 3, 4 and 5.

## Notes

Nine decisions are ours. The one with the most consequence is Assumption 1: the wall tablet will
open somewhere different after this phase ships, and the operator should know that before it does.
