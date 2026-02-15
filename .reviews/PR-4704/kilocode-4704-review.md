<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 4704
title: "feat(retry): add configurable delay and retry limits"
author: dannycreations
category: feature
tier: 5
lines: 442
files: 36
verdict: REQUEST_CHANGES
confidence: 4
reviewed_at: 2026-02-14
linked_issue: null
fork_pr: null
-->

# Review: kilocode #4704

> **feat(retry): add configurable delay and retry limits** by @dannycreations
> Static analysis review (no fork PR)

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | WARN | Removes exponential backoff entirely -- constant delay is a regression for sustained rate-limit events |
| Conventions | PASS | Uses `// kilocode_change` markers, follows project patterns |
| Changeset | PASS | Minor changeset included |
| Tests | WARN | Tests do not exercise Task class; they re-implement the retry predicate inline |
| i18n | PASS | 22 locale files updated with `retriesLabel` |
| Types | PASS | Zod schema, ExtensionState, and auto-approval types updated |
| Security | PASS | No security implications |
| Scope | WARN | Adds `alwaysApproveResubmit` toggle + delay slider + retry max -- maintainer flagged scope concern |

## Findings

### RED: Exponential backoff removed without adequate replacement

`src/core/task/Task.ts` -- The PR removes `MAX_EXPONENTIAL_BACKOFF_SECONDS` (600s) and the exponential formula:
```typescript
// BEFORE (current)
let exponentialDelay = Math.min(
    Math.ceil(baseDelay * Math.pow(2, retryAttempt)),
    MAX_EXPONENTIAL_BACKOFF_SECONDS,
)
```
and replaces it with a flat constant delay:
```typescript
// AFTER (PR)
let requestDelaySeconds = state?.requestDelaySeconds ?? 10
```

This means retry attempt 0, 1, 2, 3... all wait the same duration. When hitting sustained 429 rate limits, constant-delay retries are more aggressive than exponential backoff and will burn through the retry budget faster while hammering the provider. The original exponential backoff existed specifically for this reason.

The author acknowledged this in comments: "I just need the `constant` delay... default was `exponential`". The maintainer (@marius-kilocode) questioned the scope but the PR was simplified to constant-only. This is a behavioral regression for existing users who relied on exponential backoff to gracefully handle rate limiting.

**Recommendation**: Keep exponential backoff as default behavior. The user-configurable delay should set the *base* delay for the exponential formula, not replace it.

### YELLOW: Default delay changed from 5s to 10s silently

The PR changes `requestDelaySeconds` default from `5` to `10` in multiple locations:
- `ExtensionStateContext.tsx:285` -- `requestDelaySeconds: 5` becomes `requestDelaySeconds: 10`
- `ClineProvider.ts:2529` -- `requestDelaySeconds ?? 10`
- `backoffAndAnnounce` -- `state?.requestDelaySeconds ?? 10`

This doubles the base retry delay for all existing users who never changed this setting. With exponential backoff removed, the first retry now waits 10s constant instead of ~5s exponential base. This is a silent behavior change that should be documented or kept at the existing default.

### YELLOW: requestRetryMax=0 means unlimited -- confusing UX

`requestRetryMax` defaults to `0`, which means "unlimited retries" per the logic:
```typescript
(retryMax === 0 || retryAttempt < retryMax)
```

In the slider UI, `0` displays as the infinity symbol. This is counterintuitive -- most users expect `0` to mean "no retries". The slider range is 0-100 where 0 is the leftmost position showing unlimited. A user moving the slider to minimum expecting to disable retries would actually enable unlimited retries.

**Recommendation**: Use a separate boolean or sentinel value for "unlimited". Or flip the semantics so `0` = no retries and add a checkbox for "unlimited".

### YELLOW: Tests do not exercise actual Task behavior

`src/core/task/__tests__/auto-retry.spec.ts` -- The test file creates a `Task` instance but never calls the retry logic on it. Instead, it re-implements the retry predicate as a local function:
```typescript
const shouldRetry = (attempt: number) =>
    state.autoApprovalEnabled &&
    state.alwaysApproveResubmit &&
    (state.requestRetryMax === 0 || attempt < state.requestRetryMax)
```

This tests the *idea* of the logic, not the actual code path in `Task.ts`. The `backoffAndAnnounce` test also acknowledges it cannot await the result: "We can't easily await this because it has a loop with delay()". These tests provide false confidence -- they will pass even if the Task implementation diverges from the test's local predicate.

### YELLOW: Three settings for one feature increases maintenance surface

The PR introduces three new settings: `alwaysApproveResubmit`, `requestDelaySeconds` (already existed but now surfaced in UI), `requestRetryMax`. Maintainer @marius-kilocode specifically questioned this in review: "Im wondering if we really need to introduce 3 different options at this point... every line of code will be expensive to maintain."

The settings touch: global-settings schema, vscode-extension-host types, auto-approval types, ClineProvider state, webviewMessageHandler, ExtensionStateContext, SettingsView, AutoApproveSettings, AutoApproveToggle, and useAutoApprovalToggles. That is 10 files of plumbing for 3 settings.

### YELLOW: Inconsistent default display in slider

`AutoApproveSettings.tsx` -- The delay slider shows one default but uses another:
```tsx
value={[requestDelaySeconds ?? 10]}  // Slider position defaults to 10
// ...
<span className="w-12 text-right">{requestDelaySeconds ?? 5}s</span>  // Display defaults to 5
```

The slider value fallback is `10` but the display text fallback is `5`. A user seeing the settings for the first time with no stored value would see the slider at position 10 but the label showing "5s".

### GRAY: CLI not addressed

The maintainer asked about CLI support and the author confirmed: "im not using the cli im not test it". The new settings (`alwaysApproveResubmit`, `requestRetryMax`) have no CLI mapping. CLI users would get default behavior with no way to configure these settings.

### GRAY: Mixed indentation in JSX

`AutoApproveSettings.tsx` -- The new JSX block uses spaces while surrounding code uses tabs. Lines 327-383 show space indentation mixed with tab-indented code above and below. The `{/* kilocode_change start */}` comment is space-indented at column 8 while surrounding JSX uses tab indentation.

## CI Status

No upstream CI checks reported on the `qol-auto-retry` branch. The PR may need rebasing to trigger CI.

## Code Snippets

### Core retry guard (three locations in Task.ts):
```typescript
const retryMax = state?.requestRetryMax ?? 0
if (
    state?.autoApprovalEnabled &&
    state?.alwaysApproveResubmit && // kilocode_change
    (retryMax === 0 || (currentItem.retryAttempt ?? 0) < retryMax)
) {
    await this.backoffAndAnnounce(currentItem.retryAttempt ?? 0, error)
```

### Backoff change (exponential removed):
```typescript
// BEFORE
const baseDelay = state?.requestDelaySeconds || 5
let exponentialDelay = Math.min(
    Math.ceil(baseDelay * Math.pow(2, retryAttempt)),
    MAX_EXPONENTIAL_BACKOFF_SECONDS,
)

// AFTER
let requestDelaySeconds = state?.requestDelaySeconds ?? 10
```

### Slider UI:
```tsx
<Slider min={0} max={100} step={1}
    value={[requestRetryMax ?? 0]}
    onValueChange={([value]) => {
        setRequestRetryMax(value)
        vscode.postMessage({
            type: "updateSettings",
            updatedSettings: { requestRetryMax: value },
        })
    }}
/>
<span>{requestRetryMax === 0 || requestRetryMax === undefined ? "\u221E" : requestRetryMax}</span>
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**REQUEST_CHANGES** -- The feature concept is sound and addresses a real user need (configurable retry behavior). However, the implementation has a critical regression: removing exponential backoff entirely in favor of constant-delay retries will cause more aggressive API hammering during sustained rate-limit events. The tests do not exercise actual Task code paths. The `0 = unlimited` UX is confusing. The maintainer's scope concern (3 settings for 1 feature) is valid and unresolved. Recommend: (1) keep exponential backoff with user-configurable base delay, (2) fix the `0 = unlimited` semantics, (3) write tests that exercise the actual `Task` code, (4) fix the inconsistent default display.
