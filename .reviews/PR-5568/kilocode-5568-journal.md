<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5568
title: "fix: override context window for MiniMax/Kimi free models"
author: romeoscript
category: fix
tier: 2
lines: 6
files: 1
review_number: 6
fork_pr: https://github.com/jeremylongshore/kilocode/pull/9
-->

# Review Journal: kilocode #5568

> **PR**: [#5568](https://github.com/Kilo-Org/kilocode/pull/5568) |
> **Title**: fix: override context window for MiniMax/Kimi free models |
> **Author**: @romeoscript |
> **Category**: fix | **Tier**: 2 | **Size**: 6 lines, 1 file | **Confidence**: 4/5
>
> **Multi-AI analysis**: [Fork PR #9](https://github.com/jeremylongshore/kilocode/pull/9) — CodeRabbit, Gemini, CodeQL, Qodo

---

## Summary

A targeted fix for issue #5566: MiniMax 2.1 and Kimi 2.5 free models report incorrect context windows via the OpenRouter API, causing aggressive truncation. The fix hardcodes 200k context for these models, following an established override pattern in `parseOpenRouterModel()`. Clean and correct, but needs a changeset and upstream CI hasn't run.

## First Impressions

First tier 2 (code fix) PR in the pipeline. At 6 lines in 1 file, this is minimal — but it touches provider infrastructure (`openrouter.ts`), which is a high-traffic code path. The `fix:` prefix and linked issue (#5566) set clear expectations.

## What I Looked At

1. **The diff** — 6 lines added to `src/api/providers/fetchers/openrouter.ts`
2. **Surrounding code** — Lines 300-320 of same file, showing 3 existing model-specific overrides
3. **Issue #5566** — User report: context window indicator shows ~32k instead of 200k for these models
4. **PR description** — Includes detailed reproduction steps and before/after verification
5. **Fork check-types** — 22/22 pass (1 cache miss for `kilo-code` package, the one that changed)

## Analysis

### The fix is correct

The OpenRouter API reports incorrect context windows for MiniMax 2.1:free and Kimi 2.5:free. The fix overrides `modelInfo.contextWindow` to 200,000 after the API data is parsed, ensuring the extension uses the correct value for truncation decisions.

```typescript
// kilocode_change start
if (id.includes("minimax-2.1:free") || id.includes("kimi-2.5:free")) {
    modelInfo.contextWindow = 200000
}
// kilocode_change end
```

### Pattern compliance

The `parseOpenRouterModel()` function already has 3 similar overrides:

| Model | Override | Type |
|-------|----------|------|
| `anthropic/claude-haiku-4.5` | `supportsReasoningBudget = true` | Capability |
| `openrouter/horizon-alpha` | `maxTokens = 32768` | Limit |
| `openrouter/horizon-beta` | `maxTokens = 32768` | Limit |
| **minimax-2.1:free** | **contextWindow = 200000** | **Limit** |
| **kimi-2.5:free** | **contextWindow = 200000** | **Limit** |

The PR follows the established pattern. The `kilocode_change` markers are used correctly per project conventions.

### Minor style note

Existing overrides use `id === "exact/match"` while this PR uses `id.includes("partial")`. The `includes()` approach handles different vendor prefixes (e.g., `openrouter/minimax-2.1:free` vs `minimax/minimax-2.1:free`) but is less precise. Both approaches are valid here.

## Verification

```
Upstream CI         NOT RUN    (no checks on branch)
Fork check-types    PASS       (22/22, 36.6s, 1 cache miss)
```

The upstream branch `hotfix/context-window-override` has no CI results — likely needs a rebase to trigger the CI workflow. Our Codespace verification confirms types are clean.

## Bot Review Synthesis

| Bot | Status | Key Finding | Useful? |
|-----|--------|-------------|---------|
| CodeRabbit | Not collected | Batch review — no individual fork PR | N/A |
| Gemini | Not collected | Batch review — no individual fork PR | N/A |
| Greptile | Not collected | Batch review — no individual fork PR | N/A |
| CodeQL | Not collected | Batch review — no individual fork PR | N/A |
| Qodo | Not collected | Batch review — no individual fork PR | N/A |

## Lessons Learned

**1. First code fix review — new checklist items matter.** For docs PRs, "changeset" and "tests" were N/A. For code fixes, both become relevant. The review checklist correctly surfaces these gaps.

**2. Missing upstream CI is a red flag.** When `gh pr checks` returns nothing, the branch may be stale or misconfigured. This is worth flagging in the review — maintainers may need to ask the contributor to rebase.

**3. Model-specific overrides are a scaling concern.** The pattern of hardcoding corrections for individual models in `parseOpenRouterModel()` works for 5 models but won't scale to 50. This is not a problem for this PR, but it's a pattern worth watching as more models are added.

---

<sub>Review #6 of 75 | Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
