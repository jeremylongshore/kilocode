<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5568
title: "fix: override context window for MiniMax/Kimi free models"
author: romeoscript
category: fix
tier: 2
lines: 6
files: 1
verdict: COMMENT
confidence: 4
reviewed_at: 2026-02-14
linked_issue: 5566
fork_pr: https://github.com/jeremylongshore/kilocode/pull/9
-->

# Review: kilocode #5568

> **fix: override context window for MiniMax/Kimi free models** by @romeoscript
> Multi-AI analysis: [Fork PR #9](https://github.com/jeremylongshore/kilocode/pull/9) — reviewed by CodeRabbit, Gemini, CodeQL, Qodo

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Override follows established pattern in same function |
| Conventions | PASS | Uses `kilocode_change` markers correctly |
| Changeset | MISSING | Behavioral change to extension needs a changeset |
| Tests | MISSING | No test coverage for the override |
| i18n | N/A | No UI strings |
| Types | PASS | check-types passes (22/22 on Codespace) |
| Security | N/A | No security implications |
| Scope | PASS | Single file, single concern |

## Findings

### 🟡 Missing changeset

This PR modifies extension behavior (context window size affects truncation for MiniMax/Kimi users). A changeset should be added for the version bump.

### 🟡 No CI checks ran on upstream

The upstream PR branch `hotfix/context-window-override` has no CI check results. The branch may need a rebase to trigger CI. Types pass on our Codespace (22/22).

### ⚪ `id.includes()` vs exact match

The existing overrides in this function use exact match (`id === "openrouter/horizon-alpha"`), but this PR uses `id.includes("minimax-2.1:free")`. The `includes()` approach is more flexible (handles different vendor prefixes) but less precise. Either approach works — just noting the inconsistency.

### ⚪ No test verifying the override

The existing model-specific overrides (horizon-alpha, horizon-beta, claude-haiku-4.5) also lack individual tests, so this is consistent with the codebase. But for a PR fixing a user-reported bug (#5566), a test would strengthen confidence.

## CI Status

| Check | Result |
|-------|--------|
| Upstream CI | NOT RUN (no checks on branch) |
| Fork check-types | PASS (22/22, 1 cache miss for kilo-code) |

## Code Snippets

```typescript
// src/api/providers/fetchers/openrouter.ts — existing pattern
if (id === "openrouter/horizon-beta") {
    modelInfo.maxTokens = 32768
}

// PR addition — follows same pattern
// kilocode_change start
if (id.includes("minimax-2.1:free") || id.includes("kimi-2.5:free")) {
    modelInfo.contextWindow = 200000
}
// kilocode_change end
```

## Verdict

**COMMENT** - Clean 6-line fix following the established model-override pattern in `parseOpenRouterModel()`. The `kilocode_change` markers are correct. Two items need attention: (1) a changeset should be added since this changes extension behavior, and (2) upstream CI hasn't run — the branch may need a rebase to trigger checks. The fix itself is correct for the reported issue (#5566).
