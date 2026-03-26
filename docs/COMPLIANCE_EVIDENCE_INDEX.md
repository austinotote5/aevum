# AEVUM Compliance Evidence Index

## Purpose
Single source of truth for legal/compliance artifacts required during pilot diligence and enterprise procurement.

## Critical Artifacts
| Artifact | Owner | Source | Status Target | Evidence Location |
|---|---|---|---|---|
| Claims Boundary Matrix | Medical Affairs + Legal | `docs/CLINICAL_CLAIMS_BOUNDARY_MATRIX.md` | Approved | `regulatory_artifacts.claims_boundary_matrix` |
| Intended Use Statement | Clinical Governance | App + docs | Approved | `regulatory_artifacts.intended_use_statement` |
| Clinical Disclaimer Policy | Legal | App + docs | Approved | `regulatory_artifacts.clinical_disclaimer_policy` |
| Privacy Policy | Privacy Office | App legal panel | Approved | `regulatory_artifacts.privacy_policy` |
| Terms of Use | Legal | App legal panel | Approved | `regulatory_artifacts.terms_of_use` |
| HIPAA Risk Assessment | Security | Security review doc | Review/Approved | `regulatory_artifacts.hipaa_risk_assessment` |
| Incident Response Playbook | Security | Internal SOP | Approved | `regulatory_artifacts.incident_response_playbook` |
| SOC 2 Control Matrix | Security | GRC doc | Review | `regulatory_artifacts.soc2_control_matrix` |
| Safety Escalation Policy | Clinical + Safety | `docs/SAFETY_ESCALATION_POLICY.md` | Approved | `regulatory_artifacts.safety_escalation_policy` |
| Rollback Runbook | Engineering | `docs/RUNBOOK_RELEASE_ROLLBACK.md` | Approved | `regulatory_artifacts.rollback_runbook` |
| DB Restore Runbook | Engineering + SRE | `docs/RUNBOOK_DB_RESTORE.md` | Approved | `regulatory_artifacts.db_restore_runbook` |

## Operational Evidence
1. Consent state records (`user_consents`).
2. HIPAA attestation record (`hipaa_attestations`).
3. BAA workflow history (`baa_requests`).
4. Deletion request lifecycle (`data_deletion_requests`).
5. Audit events (`audit_log`).
6. Clinician note and signoff logs (`clinician_notes`).
7. Ops SLO telemetry (`/api/ops/status` -> `deploymentReadiness.slo24h` + `telemetry.http`).

## Export Bundle Checklist
1. Compliance bundle JSON export from Enterprise panel.
2. 28-day proof report from:
```powershell
cd C:\Users\Austin\OneDrive\aevum
npm run proof:28d
```
3. Latest platform summary screenshot or JSON.
4. Latest evidence console summaries (clinical + regulatory).

## Review Cadence
1. Weekly: artifact status updates.
2. Bi-weekly: legal review of externally used claims text.
3. Monthly: compliance readiness score review and owner accountability.
