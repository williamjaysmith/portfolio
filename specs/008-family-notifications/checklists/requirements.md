# Specification Quality Checklist: Family Notifications

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Evidence integrity

An extra bar for this project, because the research is source-tagged and the constitution forbids
promoting an inference to a fact.

- [x] Every `[V](id)` in the spec names an article the dossiers actually cite
- [x] Every `[V]` claim says what the source says, not more
- [x] Every `[UNKNOWN]` is recorded as unknown and answered by a numbered Assumption
- [x] Every departure from the reference appears in the divergence table

## Notes

**Validation, first pass (2026-09-06).** All fourteen article identifiers cited in the spec were
checked against `docs/research/skylight/` rather than trusted from the research summary. All fourteen
resolve. Five defects were found and fixed before this checklist was marked:

1. *Evidence integrity* failed on **FR-820**. The draft claimed that no star or reward notification
   "exists in the reference `[V]`". The dossier says something weaker and more careful: no such
   notification is documented, and whether redeeming a reward notifies a parent is explicitly
   `[UNKNOWN]` — "plausible given the activity framing" is as far as it goes. That is an inference
   promoted to a fact, which the project's research rules forbid. FR-820 now states the absence of
   documentation, and Assumption 14 carries the decision to stay silent.
2. *Evidence integrity* failed on **FR-803**, which cited the App Settings article (45664471763995)
   for the two Calendar toggles. Those toggles are documented in the Settings article
   (45795554249371) and the Reminders Settings article (36836043247131). Both now cited.
3. *Evidence integrity* failed on **FR-810**. The three-way scope prompt for a reminder edit is
   verified, but the dossier marks it a WebSearch synthesis rather than a screenshot. The requirement
   now says so, and leans on Phase 2's shipped wording for the exact words.
4. *No implementation details* failed on **Assumption 1**, which named a browser mechanism when
   arguing the scope split. Rewritten as the outcome; the mechanism belongs in the plan.
5. The Task Due Reminders release date was wrong by a month — the changelog gives 2026-07-30.

**Five decisions were self-answered rather than raised as clarifications**, under the operator's
standing delegation, and each is recorded in the spec's Clarifications section against the evidence it
rests on: who a reminder is addressed to, what a single event's reminder can be, how the lead time is
offered, whether the display makes a sound, and whether a late chore nags. Two of the five resolve a
documented contradiction rather than a gap — the lead-time control has two incompatible renderings in
the sources, and the dossier declines to reconcile them, so the master map's existing decision was
followed rather than re-litigated.

**Two risks to carry into planning.**

- *The scope split is the spec's biggest claim.* Splitting the locked plan's `family-notifications`
  into a notifications phase and a later home/search/offline phase is Assumption 1, and it is the one
  decision that changes what ships. It follows the Phase 5/6 precedent and each half stands alone, but
  the plan should state the split in its own terms rather than inheriting it silently.
- *Nothing in the dossiers documents offline behaviour at all* — the reference is in fact criticised
  for requiring constant connectivity. The deferred phase therefore has no reference to match and will
  be ours entirely. Worth knowing now, while its scope is still being drawn.
