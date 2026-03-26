# AEVUM Compliance Packaging Playbook

## Scope
- Consent registry and policy acceptance tracking.
- User-initiated data deletion workflow.
- HIPAA safeguards attestation workflow.
- BAA request and legal-review tracking.
- Exportable audit bundle for legal/clinical review.

## API Endpoints
- `GET /api/compliance/consent`
- `PUT /api/compliance/consent`
- `GET /api/compliance/hipaa-attestation`
- `PUT /api/compliance/hipaa-attestation`
- `GET /api/compliance/baa-requests?limit=10`
- `POST /api/compliance/baa-requests`
- `PATCH /api/compliance/baa-requests/:requestId/status`
- `GET /api/compliance/deletion-requests?limit=10`
- `POST /api/compliance/deletion-requests`
- `GET /api/compliance/audit-bundle`

## Operational Notes
- Compliance routes are premium-gated by plan entitlement.
- Audit bundle includes:
  - User profile snapshot
  - Consent state
  - HIPAA attestation state
  - BAA request history
  - Deletion request history
  - Biometric/protocol/clinician record counts
  - Recent audit events

## Retention + Deletion Workflow
1. User submits deletion request.
2. Request moves to `pending` state.
3. Operations team reviews legal/clinical retention obligations.
4. Request resolves to `completed` or `rejected` with notes.

## HIPAA + BAA Workflow
1. Workspace owner fills HIPAA attestation details and acknowledges safeguard controls.
2. If `BAA required` is enabled, submit a BAA request with legal contact details.
3. Legal review updates BAA request status in-app: `in_review`, `executed`, or `declined`.
4. `declined` requires legal note; each status transition is audit logged.
5. Audit bundle captures attestation, request artifacts, and final BAA outcome fields.

## Release Checklist
- Verify consent update and retrieval are successful.
- Verify HIPAA attestation save + reload preserves state.
- Verify BAA request duplicate prevention while status is `requested` or `in_review`.
- Verify legal review transitions:
  - `requested -> in_review -> executed`
  - `requested/in_review -> declined` (with required legal note)
- Verify deletion requests cannot be duplicated while pending.
- Verify audit bundle download from Enterprise panel.
