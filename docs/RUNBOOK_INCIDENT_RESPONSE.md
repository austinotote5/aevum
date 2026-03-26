# AEVUM Incident Response Runbook

## Scope
Use for production-impacting reliability, security, or data incidents.

## Severity Levels
1. `SEV-1`: Full outage, data integrity risk, or security event
2. `SEV-2`: Major feature degradation with no safe workaround
3. `SEV-3`: Partial degradation with workaround

## Immediate Actions (First 15 Minutes)
1. Declare incident channel and assign incident commander.
2. Capture timestamp, affected routes/components, and first user impact report.
3. Run health checks:
   - `GET /health`
   - `GET /health/ready`
   - `GET /api/ops/status` (authenticated premium token)
4. Freeze deployments until triage complete.

## Technical Triage
1. Check structured logs for `request_failed`, `unhandled_rejection`, `uncaught_exception`.
2. Use `requestId` from response/log to trace failing request end-to-end.
3. Validate:
   - DB connectivity and latency
   - auth token verification path
   - premium route gate behavior
4. Determine containment action:
   - rollback release,
   - disable offending feature path,
   - enforce safe-mode response.

## Communications
1. Internal status update every 30 minutes until mitigated.
2. External user notice for SEV-1/SEV-2 with clear workaround or ETA.
3. Compliance notice workflow if incident touches PHI/PII.

## Recovery
1. Confirm stability with 30-minute error-rate watch.
2. Re-run API contract tests and client build checks.
3. Document root cause and preventive action.

## Postmortem (Within 48 Hours)
1. Timeline
2. Root cause
3. Impact
4. Corrective actions
5. Owner + due date for each action
