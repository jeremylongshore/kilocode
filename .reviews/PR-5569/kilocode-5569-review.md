<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5569
title: "fix: retry Amazon Bedrock network connection lost errors"
author: romeoscript
category: fix
tier: 2
lines: 22
files: 1
confidence: 4
verdict: REQUEST_CHANGES
fork_pr: N/A (batch review)
linked_issue: N/A
-->

## Review Summary

| Aspect | Assessment |
|--------|------------|
| **Verdict** | REQUEST_CHANGES |
| **Confidence** | 4/5 |
| **Blocking Issues** | 3 |

## Blockers

### 1. Maintainer says retrying won't help

@lambertjosh commented:

> "A small amount of queries are consistently timing out on both Bedrock and Anthropic. We are investigating, unfortunately retrying is unlikely to help"

This fundamentally questions the approach. If the errors are persistent timeouts (not transient network blips), retry logic just delays the failure.

### 2. Wrong file

The retry is added to `openrouter.ts`, but the title says "Amazon Bedrock." Bedrock has its own handler (`bedrock.ts`). This adds retry logic to OpenRouter for Bedrock errors routed through OpenRouter — which is a valid but narrow fix. The title is misleading.

### 3. Missing changeset

No changeset included.

## Code Review

The retry logic itself is well-structured:
- Max 3 attempts with exponential backoff (2s, 4s)
- Only retries specific "Amazon Bedrock error" + "Network connection lost" pattern
- Narrow error matching (won't retry unrelated errors)
- Proper re-throw after exhausting attempts

```typescript
const isBedrockNetworkError =
  msg.includes("Amazon Bedrock error") && msg.includes("Network connection lost")

if (isBedrockNetworkError && attempts < 3) {
  await new Promise((resolve) => setTimeout(resolve, attempts * 2000))
  continue
}
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Recommendation

Hold pending maintainer investigation. The code quality is fine, but the approach may be ineffective for the actual problem.

---
