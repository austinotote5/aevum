# AEVUM Pilot Onboarding Runbook

## Purpose
Onboard a new pilot without friction and start collecting valid outcome data on day one.

## Pre-Launch Checklist
1. Confirm pilot owner and escalation contact.
2. Confirm target seat count and start/end dates.
3. Confirm plan tier (`premium` or `enterprise`).
4. Confirm compliance prerequisites:
- consent flow enabled,
- HIPAA attestation complete,
- BAA status documented where required.

## Technical Setup
1. Backend:
```powershell
cd C:\Users\Austin\OneDrive\aevum
npm start
```
2. Frontend:
```powershell
cd C:\Users\Austin\OneDrive\aevum\client
$env:REACT_APP_API_URL="http://localhost:4000"
npm start
```
3. Confirm:
- login/register works,
- Enterprise tab loads,
- `/health` and `/health/ready` return operational/ready.

## User Setup Steps
1. Register users and verify active accounts.
2. Set contraindication profile for each user.
3. Connect or import wearable data source.
4. Generate daily protocol and verify safety envelope status.
5. Ask each user to complete first 3 actions on day one.

## Data Quality Requirements
1. Minimum 5 biometric days/week/user.
2. Minimum 1 protocol generation/day/user.
3. Minimum 1 clinician note + signoff/week for flagged users.
4. No pending critical import failures > 48 hours.

## Weekly Pilot Operating Rhythm
1. Monday:
- review activation and adherence,
- identify high-risk users.
2. Wednesday:
- apply contraindication/safety updates,
- run clinician note pass.
3. Friday:
- export evidence snapshots,
- update pilot tracker and action log.

## Exit Criteria for Pilot Success
1. Activation >= 70%.
2. Adherence completion >= 60%.
3. Positive readiness trend and/or risk reduction trend.
4. Stakeholder satisfaction score >= 8/10.
5. Clear expansion or paid continuation recommendation.

