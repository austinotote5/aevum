# AEVUM Ship Standard (Anti-Vibe Protocol)

## Purpose
Protect product quality, safety posture, and commercial trust by ensuring every shipped change is deliberate, measurable, and reversible.

## Core Rule
No feature moves to "done" unless it has:
1. Problem statement
2. Success metric
3. Test plan
4. Rollback plan

If any item is missing, the feature is not release-ready.

## Scope
Applies to:
- frontend changes,
- backend/API changes,
- schema/data changes,
- compliance/security claims,
- growth/analytics scripts.

## Change Types
1. `P0 Critical`: security, auth, data loss, production blockers
2. `P1 High`: core user flow or revenue-impacting
3. `P2 Standard`: feature enhancement or UX improvement
4. `P3 Low`: copy/layout/internal tooling

## Required Artifacts Per Change
Every change must include:
1. Feature brief using `docs/FEATURE_BRIEF_TEMPLATE.md`
2. Definition of done checklist completion (`docs/DEFINITION_OF_DONE_CHECKLIST.md`)
3. Evidence note (what was tested, what passed, what remains)
4. Release log entry using `docs/WEEKLY_RELEASE_REVIEW_TEMPLATE.md`

## Evidence-First Shipping
Claims allowed in demos/decks must map to real evidence:
- metric output files in `docs/reports/`,
- endpoint behavior verified,
- screenshots or logs where applicable.

Never claim:
- validated clinical outcome without external evidence,
- compliance certification not yet obtained,
- production reliability from local-only testing.

## Testing Minimums
1. `P0/P1`: run relevant tests + smoke checks + regression checks
2. `P2`: run impacted test/build checks + manual acceptance flow
3. `P3`: lint/build/manual sanity check

At minimum before merge/release:
- frontend build passes,
- critical scripts run successfully (if touched),
- no unresolved blocker errors in affected user flow.

## Rollback Readiness
Each change must define one rollback path:
1. Revert commit path, or
2. Feature flag off path, or
3. Data rollback + backup restore path (for schema/data changes)

No high-risk change ships without rollback notes.

## Zero-Surprise Rule
No silent breaking changes to:
- API contracts,
- critical environment variables,
- auth/session behavior,
- compliance export format.

If change is breaking, it must be explicitly labeled and migration steps documented.

## 14-Day Focus Mode (When Growth Is Priority)
During activation/retention pushes:
1. Freeze non-essential new features.
2. Prioritize:
- activation,
- retention,
- paid conversion,
- reliability.
3. Ship only changes that move one of these metrics or remove a proven blocker.
4. Record active freeze window in `docs/FOCUS_MODE_YYYY-MM-DD_TO_YYYY-MM-DD.md`.

## Ownership
- Product owner: defines problem and metric.
- Engineering owner: defines test and rollback.
- Release owner: confirms checklist completion and evidence quality.

No owner, no ship.
