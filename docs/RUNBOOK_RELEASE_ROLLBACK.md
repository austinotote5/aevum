# AEVUM Release Rollback Runbook

## Trigger Conditions
1. Critical regression in auth, enterprise routes, compliance workflows, or data integrity.
2. Elevated 5xx/failed-request rates after release.
3. User-impacting route contract break (`404/401/403` mismatch for expected flow).

## Rollback Strategy Order
1. **Fast path:** redeploy previous known-good artifact.
2. **Code path:** revert offending commit(s) and redeploy.
3. **Data path:** restore database snapshot if release mutated critical data incorrectly.

## Execution Steps
1. Announce rollback start and freeze new merges.
2. Identify target release SHA/tag.
3. Roll back backend first, then frontend if needed.
4. Run post-rollback checks:
   - `/health`
   - `/health/ready`
   - key API contract smoke tests
   - login + enterprise refresh in UI.

## Go/No-Go Validation
1. Error rate returned to baseline.
2. No repeated route-unavailable errors.
3. Compliance and clinician workflows operational.

## Documentation
1. Record rollback reason and exact commit/tag restored.
2. Open follow-up defect ticket with root-cause owner.
3. Update weekly release review with incident + rollback details.
