<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 4704
title: "feat(retry): add configurable delay and retry limits"
author: dannycreations
category: feature
tier: 5
lines: 442
files: 36
verdict: COMMENT
confidence: 80
reviewed_at: 2026-02-15
-->

# Review: kilocode #4704

> **feat(retry): add configurable delay and retry limits** by @dannycreations

**Methodology**: [Kilo Code PR Review Process](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Summary

Adds user-configurable retry delay and max retry count to the auto-approval settings, replacing the previous hardcoded exponential backoff strategy. Adds an `alwaysApproveResubmit` toggle. The feature provides meaningful user control over retry behavior. Changeset included. i18n covers all locales.

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | Yellow | Removes exponential backoff -- constant delay may cause API rate limit issues |
| Conventions | Pass | Follows existing settings patterns |
| Changeset | Pass | Present -- minor for kilo-code |
| Tests | Yellow | Tests are logic-only, don't exercise actual Task retry paths |
| i18n | Pass | All 22 locales updated |
| Types | Pass | GlobalSettings schema properly extended with Zod |
| Security | Pass | No security implications |
| Scope | Pass | Well-scoped to retry logic and settings UI |
| kilocode_change markers | Pass | Properly marked |

## Findings

### Yellow -- Exponential backoff removed, replaced with constant delay

The previous implementation used exponential backoff with a 10-minute cap:
```typescript
// BEFORE
let exponentialDelay = Math.min(
    Math.ceil(baseDelay * Math.pow(2, retryAttempt)),
    MAX_EXPONENTIAL_BACKOFF_SECONDS
)
```

The new implementation uses a constant delay:
```typescript
// AFTER
let requestDelaySeconds = state?.requestDelaySeconds ?? 10
```

This means retry attempt #1 and retry attempt #10 will use the same delay. For providers with rate limits, this could cause repeated failures since there is no backoff. The user can set the delay higher, but constant delay is a regression from the exponential strategy for handling rate-limited APIs.

### Yellow -- `requestRetryMax: 0` means unlimited retries

When `requestRetryMax` is 0 (the default), the condition `retryMax === 0 || attempt < retryMax` always evaluates to true, enabling unlimited retries. This should be more clearly documented in the UI since "0" as "unlimited" is unintuitive. Users may set 0 expecting "no retries."

### Yellow -- Test file tests extracted logic, not actual retry flow

The test file `auto-retry.spec.ts` extracts the retry condition into a local function and tests that:
```typescript
const shouldRetry = (attempt: number) =>
    state.autoApprovalEnabled &&
    state.alwaysApproveResubmit &&
    (state.requestRetryMax === 0 || attempt < state.requestRetryMax)
```

While this verifies the logic is correct, it doesn't test the actual `Task` class retry behavior. The first test creates a `Task` but doesn't actually exercise the retry path. This is better than nothing but leaves the integration untested.

### Yellow -- Default `alwaysApproveResubmit: true` is a behavior change

The new setting defaults to `true`, which preserves backward compatibility with the existing always-retry-when-auto-approved behavior. However, the setting is listed under auto-approval toggles, and users who upgrade will now see an additional toggle they didn't configure. The default is correct for backward compat, but the EVALS_SETTINGS also set it to `true`, which is appropriate.

### Gray -- Slider UI for delay and retry count

The UI adds slider controls for `requestDelaySeconds` and `requestRetryMax`. The screenshots show reasonable defaults (delay slider, retry count). The slider approach is clean and consistent with other settings.

### Gray -- No CLI updates

The PR description notes "im also not touch any cli things and it should be fallback to default." The CLI will use the default values from GlobalSettings which is acceptable.

## CI Status

| Check | Result |
|-------|--------|
| CI | No checks reported on branch |

No CI results available -- the branch has no reported checks, which means CI either wasn't triggered or the branch is stale.

## Code Snippets

### Retry logic with new settings (Task.ts)
```typescript
const retryMax = stateForBackoff?.requestRetryMax ?? 0
if (
    stateForBackoff?.autoApprovalEnabled &&
    stateForBackoff?.alwaysApproveResubmit &&
    (retryMax === 0 || (currentItem.retryAttempt ?? 0) < retryMax)
) {
    await this.backoffAndAnnounce(currentItem.retryAttempt ?? 0, error)
```

### Constant delay replacement (Task.ts)
```typescript
let requestDelaySeconds = state?.requestDelaySeconds ?? 10
// ... rate limit override logic still applies ...
const finalDelay = Math.max(requestDelaySeconds, rateLimitDelay)
```

## Verdict

**COMMENT** -- The feature provides useful user control over retry behavior and is cleanly implemented with proper changeset, i18n, and kilocode_change markers. The main concern is the removal of exponential backoff in favor of constant delay, which may cause issues with rate-limited APIs. Consider keeping exponential backoff as the default strategy while allowing users to configure the base delay and max retries. The "0 = unlimited" semantic for requestRetryMax should be documented in the UI tooltip. Tests verify the logic but not the integration.
