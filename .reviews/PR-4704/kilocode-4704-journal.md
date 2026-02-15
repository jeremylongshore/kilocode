<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 4704
title: "feat(retry): add configurable delay and retry limits"
author: dannycreations
category: feature
tier: 5
lines: 442
files: 36
review_number: 48
fork_pr: null
-->

# Review Journal: kilocode #4704

> **PR**: [#4704](https://github.com/Kilo-Org/kilocode/pull/4704) |
> **Title**: feat(retry): add configurable delay and retry limits |
> **Author**: @dannycreations |
> **Category**: feature | **Tier**: 5 | **Size**: 442 lines, 36 files

---

## Summary

This PR adds user-facing controls for retry behavior when API requests fail: a toggle to enable/disable auto-resubmit, a configurable delay slider (1-60 seconds), and a max retries slider (0-100, where 0 means unlimited). In doing so, it removes the existing exponential backoff strategy and replaces it with constant-delay retries. The feature is conceptually useful but the backoff regression, confusing UX semantics, and non-functional tests prevent approval.

## First Impressions

36 files for a retry configuration feature immediately signals scope concerns. Skimming the file list: 22 are i18n locale files (mechanical), leaving 14 substantive files. The diff is well-organized with `// kilocode_change` markers throughout. The maintainer review history shows @marius-kilocode pushed back on scope (3 strategies), and the author simplified to constant-only. That simplification went too far -- it removed exponential backoff rather than keeping it as the default.

## What I Looked At

- `src/core/task/Task.ts` -- Three retry guard sites + `backoffAndAnnounce` method (core logic)
- `src/core/task/__tests__/auto-retry.spec.ts` -- New test file (125 lines)
- `packages/types/src/global-settings.ts` -- Schema additions
- `packages/types/src/vscode-extension-host.ts` -- ExtensionState type
- `src/core/auto-approval/index.ts` -- AutoApprovalState type
- `src/core/webview/ClineProvider.ts` -- State plumbing (8 additions)
- `src/core/webview/webviewMessageHandler.ts` -- Settings handler
- `webview-ui/src/components/settings/AutoApproveSettings.tsx` -- Slider UI
- `webview-ui/src/components/settings/AutoApproveToggle.tsx` -- Toggle config
- `webview-ui/src/context/ExtensionStateContext.tsx` -- React state management
- `webview-ui/src/i18n/locales/en/settings.json` -- English locale (spot-checked 3 others)
- Upstream review comments from @marius-kilocode and @dannycreations

## Analysis

### The Feature Need

Users want control over retry behavior. The existing system uses exponential backoff with a hardcoded base delay of 5 seconds and a 10-minute cap. Users cannot adjust the delay, cap the number of retries, or disable auto-retry independently of the auto-approval master toggle. This PR addresses all three gaps.

### What Changed in Retry Logic

The PR modifies three retry sites in `Task.ts`:

1. **Mid-stream failure** (line ~3598): Stream fails partway through. Previously checked `autoApprovalEnabled` only. Now also checks `alwaysApproveResubmit` and `requestRetryMax`.

2. **Empty assistant response** (line ~3926): Model returns no assistant messages. Same guard additions.

3. **First-chunk failure** (line ~4785): API fails before streaming starts. Same guard additions.

All three sites add the same predicate:
```typescript
state?.autoApprovalEnabled &&
state?.alwaysApproveResubmit &&
(retryMax === 0 || retryAttempt < retryMax)
```

### The Backoff Regression

The `backoffAndAnnounce` method currently computes delay as:
```
delay = min(baseDelay * 2^retryAttempt, 600)
```

With base=5: attempt 0=5s, 1=10s, 2=20s, 3=40s, 4=80s, etc., capping at 600s. This is standard exponential backoff that prevents hammering a rate-limited API.

The PR replaces this with:
```
delay = requestDelaySeconds (constant, default 10)
```

Every retry waits the same 10 seconds. On a sustained 429 rate limit, this means the extension sends a request every 10s indefinitely (or up to `requestRetryMax`). With exponential backoff, retries naturally space out to minutes, giving the provider time to recover.

The 429 handling still exists (parsing `RetryInfo` from error details), but that only applies when the provider includes explicit retry-after headers. Many 429 responses do not include this.

### The UX Issues

**0 = unlimited is backwards.** A slider at position 0 meaning "unlimited" violates the principle of least surprise. Users dragging the slider left to reduce retries would hit "unlimited" at the minimum. The infinity symbol helps but the mental model is wrong.

**Inconsistent defaults.** The slider position defaults to 10 (`requestDelaySeconds ?? 10`) but the display label defaults to 5 (`requestDelaySeconds ?? 5`). This is a simple bug but confusing for first-time users.

**Three settings for one feature.** The maintainer's concern is valid. `alwaysApproveResubmit` could be inferred from `requestRetryMax > 0` (or a dedicated "enabled" state). Alternatively, the delay slider already existed implicitly (`requestDelaySeconds`). The new toggle adds a third orthogonal axis of control.

### The Test Quality

The test file creates a Task instance but never calls any retry method on it. Instead it defines a local `shouldRetry` function that mirrors the retry predicate. This is a unit test of the test's own logic, not of the production code. If someone changes the predicate in `Task.ts`, these tests would still pass. The `backoffAndAnnounce` test acknowledges the limitation with a comment.

## Verification

### Upstream CI
No CI checks reported on the `qol-auto-retry` branch. The PR likely needs rebasing against `main` to trigger the CI pipeline.

### Local Testing
Not performed (no fork branch for this PR). Analysis is static.

### What We Could Not Verify
- Whether the constant delay causes provider rate-limit issues in practice
- Whether the slider UI renders correctly with both default values
- CLI behavior with new settings

## Bot Review Synthesis

| Bot | Verdict | Key Finding | Useful? |
|-----|---------|-------------|---------|
| changeset-bot | INFO | Changeset detected (minor) | Yes |
| @marius-kilocode | COMMENT | Questioned 3 strategies, asked about CLI, translations | Yes -- author addressed |
| @kevinvandijk | COMMENT | Will resolve merge conflicts | Informational |

## Diagrams

```
Retry Behavior: Before vs After
----

BEFORE (exponential backoff, current main):
  Attempt 0:  wait  5s  -> retry
  Attempt 1:  wait 10s  -> retry
  Attempt 2:  wait 20s  -> retry
  Attempt 3:  wait 40s  -> retry
  Attempt 4:  wait 80s  -> retry
  ...
  Cap: 600s (10 min)
  No retry limit (infinite by default)

AFTER (this PR, constant delay):
  Attempt 0:  wait 10s  -> retry
  Attempt 1:  wait 10s  -> retry
  Attempt 2:  wait 10s  -> retry
  ...
  No cap (always 10s)
  Retry limit: 0 = unlimited (default), 1-100 = capped

RISK: Sustained 429 -> constant 10s retries hammer provider
      vs exponential 5s->10s->20s->40s... graceful backoff
```

```
Settings Architecture (new):
----
  [Auto-Approval Master Toggle]
       |
       +-- [alwaysApproveResubmit] <-- NEW toggle
       |        |
       |        +-- [requestDelaySeconds] <-- Slider 1-60s (existed, now in UI)
       |        |
       |        +-- [requestRetryMax] <-- Slider 0-100 (NEW, 0=unlimited)
       |
       +-- [other auto-approve toggles...]
       |
       +-- ...
```

## Lessons Learned

1. **Removing exponential backoff is a regression, not a simplification.** When a maintainer says "reduce scope", the response should be to remove the strategy selector UI while keeping exponential as the default behavior -- not to replace exponential with constant.

2. **Tests that re-implement production logic are tautological.** If you cannot easily test the actual code path, that is a signal the code needs better testability (e.g., extracting the retry predicate into a pure function), not that you should test a copy of the logic.

3. **0 = unlimited is a UX anti-pattern for numeric controls.** Sentinel values in slider ranges confuse users. Prefer a checkbox ("unlimited") with a conditional numeric input.

4. **Default value changes require migration awareness.** Changing `requestDelaySeconds` from 5 to 10 affects every existing installation. If intentional, document it in the changeset. If not, keep the original default.

---

<sub>Review #48 | Static analysis (no fork PR) | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
