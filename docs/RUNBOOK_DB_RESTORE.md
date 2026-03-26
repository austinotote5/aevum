# AEVUM Database Restore Runbook

## Purpose
Recover PostgreSQL data safely after corruption, accidental deletion, or failed migration.

## Preconditions
1. Verified backup snapshot exists and timestamp is known.
2. Restore owner assigned.
3. Incident commander approved restore window.

## Stop-the-Bleed
1. Pause writes by stopping backend or switching to maintenance mode.
2. Confirm no migration jobs or scripts are running.

## Restore Procedure (Local/Stage Pattern)
1. Restore backup to isolated database first (never directly to live DB).
2. Run data sanity checks on isolated restore:
   - user count,
   - recent biometric counts,
   - protocol counts,
   - compliance records (`hipaa_attestations`, `baa_requests`, `audit_log`).
3. Validate API smoke:
   - `/health`
   - `/health/ready`
   - auth + premium route contracts.
4. Promote restored DB only after sanity checks pass.

## Verification Checklist
1. App login works.
2. No schema drift errors on startup.
3. Critical dashboards load without route/runtime failures.
4. Compliance audit bundle exports successfully.

## Roll-Forward Rules
1. Re-apply only reviewed migrations.
2. Re-run contract tests and `npm run ci:check`.
3. Record exact backup snapshot and restore completion timestamp.

## Recovery Log
- Restore date/time:
- Backup identifier:
- Validation owner:
- Final approval:
