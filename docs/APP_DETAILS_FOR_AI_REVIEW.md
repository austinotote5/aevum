# AEVUM App Details (For AI Product/Code Review)

## 1. Product Snapshot
- **Product Name:** AEVUM (health intelligence + clinical decision support app)
- **Primary Goal:** Convert biometric, adherence, and safety signals into daily protocols with auditability, compliance controls, and enterprise analytics.
- **Current Stage:** Working local product with premium feature gates, multi-layer backend services, compatibility safeguards, and scripted growth operations for activation/conversion/proof tracking.
- **Review Date:** 2026-03-26

## 2. Core Use Cases
- Individual user: daily readiness/risk insights + protocol actions.
- Clinician/coaching workflow: contraindications, safety enforcement, clinician notes, signoff.
- Enterprise/cohort view: risk and readiness distribution, intervention effectiveness, ROI estimates.
- Compliance workflow: consent registry, HIPAA attestation, BAA request lifecycle, deletion request lifecycle, audit bundle export.

## 3. Tech Stack
- **Frontend:** React (`react-scripts`), custom premium UI in `client/src/App.jsx`
- **Backend:** Node.js + Express (CommonJS)
- **Database:** PostgreSQL
- **Auth:** JWT (`HS256`, issuer/audience enforced)
- **Security Middleware:** `helmet`, `cors`, `express-rate-limit`, request validation

## 4. App Navigation (Frontend)
- Overview
- AI Coach
- Insights
- Nutrition
- Enterprise

## 5. Backend Route Surface
Mounted route groups in server:
- `/api/auth`
- `/api/biometrics`
- `/api/coach`
- `/api/protocols`
- `/api/contraindications`
- `/api/wearables`
- `/api/outcomes`
- `/api/platform`
- `/api/clinician`
- `/api/billing`
- `/api/compliance`
- `/api/ops`

Health endpoints:
- `GET /health`
- `GET /health/ready`

## 6. Major Feature Layers Implemented

### A) Clinical Decision Layer
- Daily risk/readiness scoring.
- Protocol generation by tier.
- Safety blocking/downgrade rules.
- Protocol completion tracking.

### B) Safety + Contraindication Layer
- Per-user contraindication profile.
- Action-level safety status (`blocked`, `downgraded`, `clear`).
- Clinician override requires justification note.
- Override state transitions are audit-logged.

### C) Versioning + Change Intelligence
- Immutable protocol snapshots.
- Version diffs and change metadata.

### D) Adherence Intelligence
- Adherence score and trend.
- Recovery debt and projected risk delta.
- Per-action adherence warning support.

### E) Wearable Sync Layer
- Provider connection model (`apple_health`, `oura`, `garmin`, `fitbit`).
- Biometric ingest + dedupe.
- Import telemetry + per-plan daily import quota.

### F) Outcomes Engine
- Horizon summaries (30/60/90 day baseline vs recent windows).
- Aggregate outcomes score and per-metric movement.

### G) Enterprise Platform Layer
- Cohort analytics.
- ROI model outputs.
- Intervention effectiveness ranking.
- Reliability metrics.
- Monetization summaries.

### H) Clinician Ops Layer
- Clinician note creation.
- Signoff workflow.
- Pending-signoff metrics.

### I) Monetization/Entitlement Layer
- Plan model (`free`, `premium`, `enterprise`).
- Route-level premium gating for advanced features.
- Plan switching endpoint returning refreshed JWT.

### J) Compliance Packaging Layer
- Consent center/profile.
- HIPAA safeguards attestation profile.
- BAA request lifecycle with legal review status transitions (`requested`, `in_review`, `executed`, `declined`) and required decline note.
- Data deletion requests.
- Audit bundle export endpoint.

### K) Deployment & Observability Layer
- Readiness health check endpoint.
- Ops status endpoint with runtime, DB, memory, and telemetry fields.
- Request ID propagation (`x-request-id`) across responses and logs.
- Process-level error hooks (`unhandled_rejection`, `uncaught_exception`) with structured logging.

### L) Clinical/Regulatory/Traction Layer
- Clinical validation study registry and status tracking.
- Regulatory artifact package tracker (claims/policy/legal readiness).
- Paid traction analytics (retention, expansion/contraction, net expansion).
- Admin Evidence Console to create/update studies and artifacts from Enterprise UI.

### M) Runtime Compatibility and UX Stability Layer
- API base URL normalization to prevent duplicate path issues (for example, `/api/api/...`).
- Multi-candidate API resolution and retry behavior for route-path compatibility.
- Plan-aware hydration: free plan does not spam premium-only endpoint errors.
- Enterprise panel error deduplication (single clean signal instead of repeated red noise).
- Graceful fallback data shaping for older backend route surfaces.

### N) Growth Operations Layer
- Automated 28-day proof export (`proof:28d`).
- Onboarding activation targeting report (`onboarding:push`).
- Programmatic paid conversion utility (`paid:convert`) with strict real-user targeting (`--email` or `--userId`) and required business reason in apply mode.
- Friday growth cycle (proof + trend CSV + deck-ready KPI summary) (`growth:friday`) in real-only biometric mode.
- Synthetic/demo purge utility (`data:purge-synthetic`) with dry-run default and explicit `--apply true`.
- Real-user KPI filtering excludes internal/test domains by default (`METRICS_EXCLUDED_EMAIL_DOMAINS`, default includes `aevum.dev`).
- Proof reports now include integrity metadata:
  - synthetic biometric count in window,
  - explicit real-only vs include-synthetic mode flag,
  - excluded email domains used for real-user filtering.

### O) Shipping Governance Layer
- Anti-vibe ship standard in `docs/SHIP_STANDARD.md`.
- Mandatory feature brief template in `docs/FEATURE_BRIEF_TEMPLATE.md`.
- Definition of Done checklist in `docs/DEFINITION_OF_DONE_CHECKLIST.md`.
- Weekly release review format in `docs/WEEKLY_RELEASE_REVIEW_TEMPLATE.md`.
- Active feature-freeze window file for current focus cycle (`docs/FOCUS_MODE_2026-03-26_TO_2026-04-09.md`).

### P) Reliability Maturity Layer
- API contract smoke suite for auth/platform/compliance/ops route contracts (`server/tests/api-contract.smoke.js`).
- Server syntax gate (`server/scripts/lintServer.js`).
- Root CI quality gate script (`npm run ci:check`).
- GitHub Actions pipeline (`.github/workflows/ci.yml`) for lint/contracts/tests/build.
- Runtime SLO telemetry in ops status (critical-route 24h error rate, availability, P95 latency).

### Q) Operational & Regulatory Policy Pack
- Incident response runbook (`docs/RUNBOOK_INCIDENT_RESPONSE.md`).
- DB restore runbook (`docs/RUNBOOK_DB_RESTORE.md`).
- Release rollback runbook (`docs/RUNBOOK_RELEASE_ROLLBACK.md`).
- Safety escalation policy (`docs/SAFETY_ESCALATION_POLICY.md`).
- Regulatory policy pack index (`docs/REGULATORY_POLICY_PACK.md`).

## 7. Database Entities (Primary)
From schema:
- `users`
- `biometric_entries`
- `daily_protocols`
- `protocol_completions`
- `protocol_versions`
- `user_contraindications`
- `coach_messages`
- `wearable_connections`
- `wearable_import_events`
- `wearable_import_usage`
- `clinician_notes`
- `user_consents`
- `hipaa_attestations`
- `baa_requests`
- `data_deletion_requests`
- `clinical_validation_studies`
- `regulatory_artifacts`
- `billing_plan_events`
- `organisations`
- `organisation_members`
- `audit_log`

## 8. Security and Reliability Controls
- Password hashing via bcrypt.
- JWT verification with algorithm/issuer/audience constraints.
- Global + route-specific rate limiting.
- Request body/query validation on endpoints.
- CORS origin checks.
- Helmet headers.
- Structured request/error logging.
- Correlation/request IDs in response and log metadata.
- Automatic GET retry logic in client API layer for transient transport/5xx failures.
- DB readiness endpoint (`/health/ready`).

## 9. Build/Test Status (Local)
- Frontend production build: passing (latest compatibility/growth patches validated on 2026-03-26).
- Frontend test suite: passing (`App.test.js`).
- Backend API contract smoke suite: passing (`npm run test:contracts`).
- Full quality gate: passing (`npm run ci:check`).
- Growth scripts executed successfully:
  - `npm run onboarding:push`
  - `npm run paid:convert -- --plan premium --email user@org.com`
  - `npm run growth:friday`
  - `npm run data:purge-synthetic`

## 10. Current Known Constraints
- Primarily local/dev environment (production deployment pipeline not fully described here).
- ROI model is heuristic/data-model driven (not a validated clinical economics publication model yet).
- Some enterprise/cohort outputs depend on volume/quality of recorded protocol + biometric data.
- If an old backend process is running without newer enterprise routes, enterprise views may run in compatibility/fallback mode with reduced fidelity until backend is restarted on latest code.
- Current retention metric can show zero when no user has crossed the full 28-day eligibility boundary yet.
- Current codebase is configured for real-user and real-data workflows only.
- KPI/report metrics exclude configured internal/test domains by default.

## 11. Reviewer Prompt Suggestions (for another AI)
Use these prompts against this dossier:
1. "Rate this app from 1-10 on technical maturity, architecture quality, and product defensibility."
2. "Identify the top 5 gaps before this is investor-grade and enterprise-deployable."
3. "Estimate valuation range at pre-revenue stage and with 3 paid pilots."
4. "What security/compliance controls are still missing for serious healthcare buyers?"
5. "Which 90-day roadmap would maximize commercial value?"

## 12. Local Run Commands
Backend:
```powershell
cd C:\Users\Austin\OneDrive\aevum
npm start
```

Frontend:
```powershell
cd C:\Users\Austin\OneDrive\aevum\client
$env:REACT_APP_API_URL="http://localhost:4000"
npm start
```

Growth Operations:
```powershell
cd C:\Users\Austin\OneDrive\aevum
npm run onboarding:push
npm run paid:convert -- --plan premium --email someone@company.com
npm run growth:friday
npm run data:purge-synthetic
```

Quality Gate:
```powershell
cd C:\Users\Austin\OneDrive\aevum
npm run ci:check
```

Apply Mode (writes data):
```powershell
cd C:\Users\Austin\OneDrive\aevum
npm run paid:convert -- --plan premium --email someone@company.com --apply true --reason "Pilot converted after outcomes review"
npm run data:purge-synthetic -- --apply true
```

## 13. Latest KPI Snapshot (2026-03-26)
From `docs/reports/aevum-28day-proof-2026-03-26.json`:
- Report generated at: 2026-03-26T17:40:48.005Z
- Integrity mode: real-only biometric metrics
- Excluded email domains: `aevum.dev`, `example.com`, `test.local`, `localhost`
- Synthetic biometric entries in window: 0
- Active users: 1
- Paid users: 0
- Activation rate: 100%
- Conversion rate: 0%
- Adherence completion: 0%
- Readiness delta (28d): +9.4%
- Risk reduction (28d): 0%
- Net expansion MRR (28d): 0
- Retention (28d): 0% (no eligible users yet)

## 14. Maturity Sprint Update (2026-03-26)
The following technical maturity sprint items were completed:
1. 14-day feature freeze policy activated (`docs/FOCUS_MODE_2026-03-26_TO_2026-04-09.md`).
2. Reliability hardening shipped (request IDs, process-level error hooks, retry-safe GET client behavior).
3. Real-data discipline enforced (demo/synthetic flows removed; purge utility retained).
4. CI and quality gates operational (`npm run ci:check`, GitHub Actions workflow).
5. Clinical/legal boundary strengthened (override justification + override audit events + safety policy pack).
6. Enterprise stability hardening shipped (error deduplication and backend-unavailable normalization in Premium Layers UI).
7. Ops observability now includes SLO telemetry (24h critical-route 5xx rate and availability gates).

Latest verification evidence:
- `npm run lint:server` passed.
- `npm run test:contracts` passed.
- `npm run test:client` passed.
- `npm run build:client` passed.
- `npm run ci:check` passed.

---
This file intentionally excludes secrets/credentials and is safe to share for architecture/product review.
