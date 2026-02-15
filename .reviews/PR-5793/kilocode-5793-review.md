<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5793
title: "feat: Add AWS Bedrock Inference Profile ARN resolution support"
author: marcelloceschia
category: feature
tier: 6
lines: 1780
files: 13
verdict: COMMENT
confidence: 0.78
reviewed_at: 2026-02-15
review_number: 72
-->

# Review: kilocode #5793

> **feat: Add AWS Bedrock Inference Profile ARN resolution support** by @marcelloceschia

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | pass | ARN resolution logic is sound, handles both application and standard inference profiles |
| Conventions | pass | `kilocode_change` markers on new files and modifications |
| Changeset | warn | Changeset bumps `@roo-code/types` as patch -- cascades to 12 packages |
| Tests | warn | 435 lines of new tests, but CI test-extension failing on both platforms |
| i18n | n/a | No new user-facing strings |
| Types | pass | New webview message types properly defined |
| Security | info | AWS credential handling follows existing patterns |
| Scope | pass | Focused on Bedrock inference profile ARN resolution |

## Findings

### Red: CI test-extension failing on both Ubuntu and Windows

`test-extension` fails on both ubuntu-latest and windows-latest. Maintainer @kevinvandijk has already flagged this in review comments. The PR has CHANGES_REQUESTED review decision. Must be resolved before merge.

### Yellow: Async resolution race condition

`resolveInferenceProfileAsync()` is called from the constructor and runs in the background. `getModel()` and `getModelRequestParams()` check `this.resolvedModelIdFromProfile` without ensuring async resolution completed. First API call may miss capabilities like prompt caching. Consider awaiting resolution before first `createMessage()`, or adding a ready state.

### Yellow: `clientConfig: any` type annotation

In `bedrock-inference-profile-resolver.ts`, Bedrock client config is typed as `any`, bypassing type checking. Use `BedrockClientConfig` from the SDK.

### Yellow: New dependency adds bundle size

`@aws-sdk/client-bedrock` adds 818 lines to pnpm-lock.yaml for a single `GetInferenceProfile` API call. Consider a lighter approach.

### Gray: In-memory cache without eviction

`BedrockInferenceProfileResolver` uses a `Map` cache with no TTL or max size.

### Gray: Unrelated change in jetbrains/scripts/check-dependencies.js

Removes `let majorVersion = null` -- unrelated to Bedrock inference profiles.

## CI Status

| Check | Result |
|-------|--------|
| compile | pass |
| test-extension (ubuntu) | **fail** |
| test-extension (windows) | **fail** |
| test-webview (ubuntu) | pass |
| test-webview (windows) | pass |
| test-cli | pass |
| check-translations | pass |
| build-cli | pass |

## Verdict

**COMMENT** -- Sound architecture for a real Bedrock gap. Resolver with caching, async background resolution, UI feedback. Good test coverage (435 lines). CI failures must be fixed first. Async race condition in capability detection should be addressed.

---

Review conducted per [Kilo Code PR Review Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md).
