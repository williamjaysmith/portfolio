# Specification Quality Checklist: The Calendar's Preview Bar

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-07
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
- [X] Success criteria are technology-agnostic (no implementation details)
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
- [X] Every `[UNKNOWN]` is a numbered `[OURS 2026-09-07 #n]` assumption, never asserted as fact
- [X] Article ids verified against `docs/research/skylight/` rather than remembered
- [X] Cross-phase citations checked against the shipped specs (FR-228, FR-266, FR-268, FR-288 in
      `002-family-week-calendar`; FR-015/FR-033 in `001-family-foundation`; FR-386 in `003-family-tasks`)
- [X] Divergences from the reference are tabled with reasons, not silently omitted

## Post-implementation (2026-09-07)

Re-checked after all five user stories shipped. Four claims in these documents did not survive
contact with the code and were corrected where they were written, not only where they were wrong:

- [X] **The bar needs its own read.** The plan said it did not. `useCountdownEvents` is
      household-keyed and unwindowed (research R901).
- [X] **A countdown withholds the "This event" scope.** The contracts said the opposite
      (contracts §2).
- [X] **US1-5 claimed a member may not change the countdown switch.** Untrue — the punch-in is the
      gate for every event field.
- [X] **R912 said three hours of clock-pinning was "enough to cross a midnight".** It is not, except
      by luck of the run time. SC-902 now states what is actually proved and by what.

## Notes

Five decisions are ours, not the reference's: the chip's wording, the progress format, what a
countdown does on its own day, whether the rotation can be paused, and what a countdown on a repeat
counts towards. Each is Assumption 3, 4, 5, 6 and 2 respectively.

Nine decisions are ours in total; Assumptions 8 and 9 were added by the citation audit below.

The consequential negative — **no source describes a search across tabs** — is Assumption 1 and
FR-919. It corrects the master map's §1 inventory, which read as though one existed. The spec states
it as an absence of evidence, not a documented absence, because that is what it is.

**The citation audit changed three claims.** Every cited article id was checked against the dossier
text rather than remembered, and three did not survive:

1. A draft asserted the device has no content search anywhere. The dossiers contradict it — the Tasks
   Search `[V](44738601403931)` and the Recipe keyword box `[V](44338446585115)` are both device
   searches, and this project has already shipped both. Narrowed to what the sources support.
2. FR-915 quoted "search for Calendar events" and cited `44738510847259`. That phrasing is in no
   dossier and that article is about the Calendar tab generally. The real evidence is `45755784991131`
   naming "Search" as one of six toolbar controls, plus a product screenshot.
3. The three Show Countdowns values were cited to `40459070511515, 48784194278683` jointly. Only the
   first carries the values; the second recommends "Always" as a display tip. Split accordingly.
