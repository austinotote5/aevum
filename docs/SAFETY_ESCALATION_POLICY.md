# AEVUM Safety Escalation Policy

## Purpose
Define when protocol guidance must be escalated for human review and how overrides are controlled.

## Product Position
AEVUM is decision support for wellness/performance workflows. It is not a diagnostic or treatment substitute.

## Escalation Triggers
Escalate for clinician/human review when any condition is met:
1. Contraindication profile indicates high-risk state.
2. User reports symptoms or events requiring clinical judgment.
3. Multiple high-intensity actions are blocked repeatedly across days.
4. Data quality is insufficient or contradictory for safe recommendation confidence.

## Escalation Actions
1. Downgrade or block unsafe actions in protocol output.
2. Surface explicit warning in plan context.
3. Require clinician note/signoff before override-enabled actions.
4. Log audit event for each escalation and override transition.

## Clinician Override Workflow
1. Override must include justification note.
2. Override state transition must create immutable audit log event.
3. Override does not remove disclaimer obligations.
4. Override is reviewable in audit bundle exports.

## Non-Negotiables
1. No deterministic cure/treatment claims in UI/docs/sales.
2. No suppression of warnings for presentation/demo purposes.
3. No synthetic data in external evidence claims.
