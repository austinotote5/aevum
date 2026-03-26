# AEVUM Premium Growth Operations

## Objective
Drive activation from 40% to 70%+, improve paid conversion, and maintain weekly proof artifacts for investor and buyer conversations.

## Governance (Required)
Before shipping changes during growth cycles:
1. Follow `docs/SHIP_STANDARD.md`
2. Use `docs/FEATURE_BRIEF_TEMPLATE.md` for every non-trivial change
3. Complete `docs/DEFINITION_OF_DONE_CHECKLIST.md`
4. Record release notes in `docs/WEEKLY_RELEASE_REVIEW_TEMPLATE.md`

## Command Set
Run from project root:

1. Generate onboarding push targets:
```powershell
cd C:\Users\Austin\OneDrive\aevum
npm run onboarding:push
```

2. Convert one real user to paid (dry-run preview):
```powershell
cd C:\Users\Austin\OneDrive\aevum
npm run paid:convert -- --plan premium --email someone@company.com
```

Apply paid conversion (writes billing/user plan change + audit entry):
```powershell
cd C:\Users\Austin\OneDrive\aevum
npm run paid:convert -- --plan premium --email someone@company.com --apply true --reason "Pilot converted after week-2 outcomes review"
```

3. Run Friday growth cycle (proof + trend + deck summary):
```powershell
cd C:\Users\Austin\OneDrive\aevum
npm run growth:friday
```

4. Purge any demo/synthetic data (dry-run first):
```powershell
cd C:\Users\Austin\OneDrive\aevum
npm run data:purge-synthetic
npm run data:purge-synthetic -- --apply true
```

## Generated Artifacts
- Onboarding push queue:
  - `docs/reports/aevum-onboarding-push-YYYY-MM-DD.json`
- 28-day proof report:
  - `docs/reports/aevum-28day-proof-YYYY-MM-DD.json`
- Trend history:
  - `docs/reports/premium-growth-trend.csv`
- Deck-ready KPI summary:
  - `docs/reports/founder-deck-metrics-latest.md`

## Weekly Operating Rhythm (Friday)
1. Run `npm run onboarding:push`.
2. Execute onboarding actions for top 2 users in the candidate list.
3. Convert qualified user(s) with `npm run paid:convert -- --plan premium --email user@org.com` (dry-run first).
4. Run `npm run growth:friday`.
5. Paste latest metrics from `founder-deck-metrics-latest.md` into deck.

## Data Integrity Rules
1. `growth:friday` and `proof:28d` run in real-only biometric mode by default.
2. Synthetic/demo data should be purged using `npm run data:purge-synthetic` before external reporting.
3. Never present synthetic-driven metrics as customer proof in investor or enterprise materials.
4. Paid conversion requires explicit target user and an apply-mode reason (no auto-conversion shortcuts).

## KPI Targets
- Activation rate: >= 70%
- Conversion rate: >= 30% (early target; then increase)
- Adherence completion: >= 65%
- Net expansion MRR: positive trend week-over-week

## Current Baseline (2026-03-26)
- Active users (real-user filter): 1
- Paid users (real-user filter): 0
- Activation: 100%
- Conversion: 0%
- Adherence completion: 0%
- Readiness delta: +9.4%
- Risk reduction: 0%
- Net expansion MRR: 0
