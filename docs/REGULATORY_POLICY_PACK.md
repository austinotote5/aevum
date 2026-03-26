# AEVUM Regulatory Policy Pack (Working)

## Objective
Centralize the policy/legal artifacts needed for enterprise trust, SOC 2 readiness, and HIPAA diligence.

## Included Baseline Artifacts
1. Claims boundary matrix: `docs/CLINICAL_CLAIMS_BOUNDARY_MATRIX.md`
2. Safety escalation policy: `docs/SAFETY_ESCALATION_POLICY.md`
3. Incident response runbook: `docs/RUNBOOK_INCIDENT_RESPONSE.md`
4. DB restore runbook: `docs/RUNBOOK_DB_RESTORE.md`
5. Release rollback runbook: `docs/RUNBOOK_RELEASE_ROLLBACK.md`
6. Compliance evidence index: `docs/COMPLIANCE_EVIDENCE_INDEX.md`

## HIPAA/BAA Operational Controls (Current)
1. Consent and attestation records captured.
2. BAA request lifecycle tracked (`requested -> in_review -> executed/declined`).
3. Deletion requests tracked with status transitions.
4. Audit bundle export available for due diligence.

## SOC 2 Readiness Controls (In Progress)
1. Change management + CI quality gate
2. Incident response and postmortem workflow
3. Access/authentication controls and logging
4. Backup/restore process with verification checklist

## Claim Boundary Rule
All external messaging must remain within decision-support/wellness language unless external clinical validation and regulatory approvals are documented.

## Evidence Discipline
1. Every external claim maps to at least one reproducible artifact.
2. Real-data proof reports only.
3. Weekly review of artifact status and owners.
