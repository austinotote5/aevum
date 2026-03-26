# AEVUM Clinical + Regulatory + Traction Playbook

## Objective
Build enterprise trust with three auditable proof lanes:
1. External clinical validation
2. Formal regulatory package readiness
3. Paid traction proof (outcomes, retention, expansion)

## What Is Implemented
- `clinical_validation_studies` registry in the database.
- `regulatory_artifacts` package tracker with seeded critical artifacts.
- `billing_plan_events` ledger for expansion/contraction analytics.
- Admin Evidence Console APIs:
  - `GET /api/platform/evidence`
  - `POST /api/platform/clinical-studies`
  - `PATCH /api/platform/clinical-studies/:studyId`
  - `POST /api/platform/regulatory-artifacts`
  - `PATCH /api/platform/regulatory-artifacts/:artifactId`
- Platform summary now returns:
  - `traction`
  - `clinicalValidation`
  - `regulatory`

## Clinical Validation Workflow
1. Register each study in `clinical_validation_studies`.
2. Keep status current: `planned`, `recruiting`, `active`, `completed`, `published`.
3. Track:
   - target vs enrolled cohort
   - primary endpoint
   - endpoint achievement
   - publication URL when available
4. Prioritize at least one externally partnered study with publishable endpoint criteria.

## Regulatory Package Workflow
1. Maintain artifact status in `regulatory_artifacts`: `draft`, `review`, `approved`.
2. Critical artifacts that must move first:
   - Claims Boundary Matrix
   - Intended Use Statement
   - Clinical Disclaimer Policy
   - Privacy Policy
   - Terms of Use
   - HIPAA Risk Assessment
3. Require owner + version for each artifact before `approved`.
4. Use readiness KPI:
   - `approvedArtifacts / totalArtifacts`
   - `criticalOpen`

## Paid Traction Workflow
1. Keep billing plan changes flowing through `billing_plan_events`.
2. Monitor:
   - paid members
   - 30-day retention
   - 90-day expansion MRR
   - 90-day contraction MRR
   - net expansion rate
3. Pair traction with outcomes:
   - sampled users with risk movement
   - average risk reduction percentage

## Investor-Grade Evidence Pack
For investor/enterprise diligence, export:
1. Latest compliance bundle
2. Platform summary snapshot including traction/clinical/regulatory sections
3. Study protocol summaries + endpoint definitions
4. Regulatory artifact versions with owner signoff metadata

## Certification Readiness Notes
- SOC 2 and HIPAA readiness are tracked via artifact completion and risk-assessment progress.
- Certifications still require independent audit partners; this system tracks readiness state, not certification issuance.
