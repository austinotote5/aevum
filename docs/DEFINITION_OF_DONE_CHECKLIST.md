# Definition of Done Checklist

Use this checklist before marking any change as shipped.

## A) Feature Intent
- [ ] Problem statement documented
- [ ] Success metric documented with baseline and target
- [ ] Scope boundaries documented (in/out)
- [ ] Owner assigned

## B) Engineering Quality
- [ ] Code is understandable and maintainable
- [ ] No critical TODO/FIXME left in changed area
- [ ] Backward compatibility checked (or breaking change documented)
- [ ] Sensitive data/secrets are not exposed

## C) Testing
- [ ] Relevant automated checks executed and passing
- [ ] Manual acceptance flow completed
- [ ] Error states and edge cases verified
- [ ] Regression risk reviewed for adjacent flows

## D) Reliability and Safety
- [ ] Runtime/log behavior checked for the changed flow
- [ ] Failure path produces clear user/system behavior
- [ ] Rollback plan validated and documented
- [ ] Schema/migration impact reviewed (forward + rollback path documented)
- [ ] For health/compliance-related changes, claims boundaries respected

## E) Product and Commercial Readiness
- [ ] User-visible change documented
- [ ] Metric instrumentation/report path confirmed
- [ ] No unsupported claims introduced in UI/docs/deck
- [ ] If growth-facing, effect on activation/retention/conversion is measurable

## F) Release Evidence
- [ ] Feature brief completed (`docs/FEATURE_BRIEF_TEMPLATE.md`)
- [ ] Release summary recorded (`docs/WEEKLY_RELEASE_REVIEW_TEMPLATE.md`)
- [ ] Evidence artifacts linked (logs/reports/screenshots)
- [ ] Final signoff completed

## Signoff
- Engineering owner:
- Product owner:
- Release owner:
- Date:
