# AEVUM Deployment & Observability Playbook

## Objective
Provide a repeatable release process with real-time operational visibility.

## Health Endpoints
- `GET /health`
- `GET /health/ready`
- `GET /api/ops/status` (premium-gated)

## `ops` Response Includes
- Runtime status and uptime
- Process/system memory telemetry
- Environment validation status
- Database connectivity + latency
- Import failure rates and pending deletion requests
- Deployment readiness checklist flags

## Pre-Deploy Checklist
1. `/health` returns `operational`.
2. `/health/ready` returns `ready`.
3. `/api/ops/status` returns `status=operational` or acceptable `warning`.
4. DB backup snapshot is available.
5. Client build succeeds.
6. API contract smoke suite passes:
```powershell
cd C:\Users\Austin\OneDrive\aevum
npm run test:contracts
```

## Incident Triage
1. If status is `degraded`, inspect env/db fields first.
2. If import failure rate > 8%, investigate provider integration payload quality.
3. Resolve pending deletion queue if backlog grows beyond SLA target.

## Runbook Links
1. Incident response: `docs/RUNBOOK_INCIDENT_RESPONSE.md`
2. DB restore: `docs/RUNBOOK_DB_RESTORE.md`
3. Release rollback: `docs/RUNBOOK_RELEASE_ROLLBACK.md`
