# AEVUM 28-Day Proof Playbook

## Objective
Generate repeatable evidence for retention, adherence, outcomes, and monetization signals every week.

## Command
From project root:
```powershell
cd C:\Users\Austin\OneDrive\aevum
npm run proof:28d
```

Full Friday premium cycle:
```powershell
cd C:\Users\Austin\OneDrive\aevum
npm run onboarding:push
npm run growth:friday
```

## Output
Generated file:
- `docs/reports/aevum-28day-proof-YYYY-MM-DD.json`
- Integrity metadata includes real-user filter domains (`excludedEmailDomains`).

## Metrics Included
1. Cohort:
- active users
- paid users
- activation rate
- conversion rate
2. Adherence:
- protocol count
- actionable actions
- completion rate
3. Outcomes:
- readiness baseline/current/delta
- HRV baseline/current/delta
- sleep baseline/current/delta
- risk baseline/current/reduction
4. Retention:
- eligible users
- retained users
- retention percentage
5. Monetization:
- expansion MRR
- contraction MRR
- net expansion MRR

## Recommended Weekly Workflow
1. Run report every Friday.
2. Save a copy in your pilot evidence folder.
3. Add top-line numbers to `docs/PILOT_TRACKER_TEMPLATE.csv`.
4. Compare week-over-week movement and annotate anomalies.

## Troubleshooting
1. If command fails with DB error:
- verify `server/.env` DB credentials,
- verify PostgreSQL service is running,
- verify backend can connect (`npm start` shows DB connected).
2. If output has zeros:
- confirm pilot users have biometric entries and protocol completions in the last 28 days.
3. If test/internal users are included unintentionally:
- set `METRICS_EXCLUDED_EMAIL_DOMAINS` in `server/.env` (comma-separated domains),
- rerun `npm run proof:28d`.
