<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5452
title: "fix: reasoning effort sync and support for OpenAI Compatible provider"
author: rayss868
category: provider
tier: 5
lines: 32
files: 2
review_number: 37
fork_pr: N/A (batch review)
-->

# Review Journal: kilocode #5452

> **PR**: [#5452](https://github.com/Kilo-Org/kilocode/pull/5452) |
> **Title**: fix: reasoning effort sync and support for OpenAI Compatible provider |
> **Author**: @rayss868 |
> **Category**: provider | **Tier**: 5 | **Size**: 32 lines, 2 files

---

## Summary

Fixes reasoning effort being silently ignored for OpenAI Compatible provider. The approach works at a surface level -- effort values reach the API payload -- but the implementation bypasses the established reasoning transform pipeline (`getOpenAiReasoning()` / `shouldUseReasoningEffort()`) and introduces a dual-write pattern in the UI that other providers do not use. The "disable" sentinel also does not suppress binary thinking when both features are supported.

## First Impressions

"Reasoning effort sync and support for OpenAI Compatible provider" -- immediately signals a gap in the OpenAI Compatible provider compared to native OpenAI. The PR description is well-structured with clear before/after behavior and test steps. At 32 lines across 2 files, this is a surgical fix. The author appears to understand the user-facing problem well.

## What I Looked At

- `src/api/providers/base-openai-compatible-provider.ts` -- The base class that SambaNova, Featherless, Groq, Fireworks, Baseten, IOIntelligence, Corethink, Roo, ZAi, and Synthetic all extend
- `webview-ui/src/components/settings/providers/OpenAICompatible.tsx` -- The settings UI for OpenAI Compatible
- `src/api/transform/reasoning.ts` -- The centralized reasoning parameter helpers (`getOpenAiReasoning`, `getOpenRouterReasoning`, etc.)
- `src/shared/api.ts` -- `shouldUseReasoningEffort()` validation logic
- `src/api/providers/openai.ts` -- How the native OpenAI provider handles `reasoning_effort`
- `packages/types/src/providers/openai.ts` -- `openAiModelInfoSaneDefaults` (no reasoning fields by default)
- kiloconnect review comments (2 issues flagged: binary thinking not gated on "disable", ThinkingBudget wrapper ignoring non-reasoningEffort fields)
- Upstream CI (11/11 green)

## Analysis

### The Bug

When using the OpenAI Compatible provider with a custom model that supports reasoning (e.g., O1 via OpenRouter, or a local O1-compatible server), the user could enable "Set Reasoning Level" and select an effort level in the UI. But the setting was never sent to the API. The UI stored it in `openAiCustomModelInfo.reasoningEffort`, but the backend only checked `info.supportsReasoningBinary` -- there was no code path to read `supportsReasoningEffort` or emit `reasoning_effort` in the payload.

### The Fix Approach

**Backend (base-openai-compatible-provider.ts)**:

The existing code was:
```typescript
if (this.options.enableReasoningEffort && info.supportsReasoningBinary) {
    ;(params as any).thinking = { type: "enabled" }
}
```

The PR widens the outer guard to just `enableReasoningEffort` and adds a second branch:
```typescript
if (this.options.enableReasoningEffort) {
    if (info.supportsReasoningBinary) {
        ;(params as any).thinking = { type: "enabled" }
    }
    if (info.supportsReasoningEffort) {
        const effort = this.options.reasoningEffort || info.reasoningEffort
        if (effort && effort !== "disable") {
            ;(params as any).reasoning_effort = effort
        }
    }
}
```

This is duplicated identically in both `createStream()` (line ~105) and `completePrompt()` (line ~236).

**UI (OpenAICompatible.tsx)**:

Three changes:
1. When toggling off the reasoning checkbox, clear `reasoningEffort` at the root level (line 248)
2. When reading the effort for ThinkingBudget display, prefer root-level `reasoningEffort` over nested (line 256-258)
3. When setting a new effort value, write to both `openAiCustomModelInfo.reasoningEffort` AND root-level `reasoningEffort` (line 270)

### Concern 1: Bypasses the reasoning transform pipeline

The codebase has a well-structured pattern for reasoning parameters:
- `src/api/transform/reasoning.ts` defines `getOpenAiReasoning()`, `getOpenRouterReasoning()`, `getRooReasoning()`, etc.
- Each calls `shouldUseReasoningEffort()` from `src/shared/api.ts` for validation
- `shouldUseReasoningEffort()` handles edge cases: `enableReasoningEffort === false`, array vs boolean `supportsReasoningEffort`, "disable"/"none" sentinels, model default fallback

The PR's inline implementation skips all of this. It only checks `this.options.enableReasoningEffort` (boolean) and `info.supportsReasoningEffort` (truthy), missing the array validation path where `supportsReasoningEffort` can be `["low", "medium", "high"]` to restrict allowed values.

The native OpenAI provider takes a different approach -- it reads `modelInfo.reasoningEffort` directly because the model definitions already encode the correct default. But that works because native OpenAI models are pre-defined with correct values. For OpenAI Compatible with custom models, the user defines capabilities, making the validation layer more important.

### Concern 2: Binary thinking not gated on "disable"

If a custom model declares both `supportsReasoningBinary: true` and `supportsReasoningEffort: true`, and the user sets effort to "disable", the PR still sends `thinking: { type: "enabled" }`. The "disable" check only gates `reasoning_effort`, not `thinking`. This could cause unexpected behavior -- the model gets told to think but with no effort guidance.

### Concern 3: Dual-write in UI

Storing `reasoningEffort` in two locations (`apiConfiguration.reasoningEffort` and `apiConfiguration.openAiCustomModelInfo.reasoningEffort`) is fragile. The precedence logic `apiConfiguration.reasoningEffort || apiConfiguration.openAiCustomModelInfo?.reasoningEffort` means:
- If root-level is falsy (undefined, null, empty string), it falls through to the nested value
- If root-level is truthy, the nested value is ignored even if more recent

This can diverge if settings are imported, migrated, or modified by a different code path. The native OpenAI provider does not have this pattern -- it reads directly from `modelInfo.reasoningEffort`.

## Verification

### Upstream CI
All 11 checks pass -- compile, test-extension (both platforms), test-cli, test-webview, test-jetbrains, unit-test, build-cli, check-translations, Build Markdoc Site. Vercel deployments require authorization (not failures).

### What We Could Not Verify
- Actual API request payloads to an OpenAI-compatible endpoint (requires endpoint access)
- Behavior when `supportsReasoningEffort` is an array of allowed values
- Interaction between binary thinking and effort-based reasoning on models that support both
- State synchronization between root-level and nested `reasoningEffort` after settings import/migration

## Diagrams

```
Reasoning Effort Data Flow (Before vs After)
─────────────────────────────────────────────

BEFORE:
  UI: Set effort = "high"
       │
       ▼
  openAiCustomModelInfo.reasoningEffort = "high"
       │
       ▼
  base-openai-compatible-provider.ts:
    enableReasoningEffort && supportsReasoningBinary?
    → supportsReasoningBinary is false (custom model)
    → NOTHING SENT

AFTER (this PR):
  UI: Set effort = "high"
       │
       ├──► openAiCustomModelInfo.reasoningEffort = "high"  (nested)
       └──► apiConfiguration.reasoningEffort = "high"       (root) ← NEW
                │
                ▼
  base-openai-compatible-provider.ts:
    enableReasoningEffort?
    ├── supportsReasoningBinary? → thinking: { type: "enabled" }
    └── supportsReasoningEffort? → reasoning_effort = "high"  ← NEW

IDEAL (using existing pipeline):
  UI: Set effort = "high"
       │
       ▼
  apiConfiguration.reasoningEffort = "high"
       │
       ▼
  getOpenAiReasoning({ model, reasoningEffort, settings })
    → shouldUseReasoningEffort() validates capabilities
    → returns { reasoning_effort: "high" }
```

## Bot Review Synthesis

| Bot | Status | Key Finding | Useful? |
|-----|--------|-------------|---------|
| CodeRabbit | Not collected | Batch review — no individual fork PR | N/A |
| Gemini | Not collected | Batch review — no individual fork PR | N/A |
| Greptile | Not collected | Batch review — no individual fork PR | N/A |
| CodeQL | Not collected | Batch review — no individual fork PR | N/A |
| Qodo | Not collected | Batch review — no individual fork PR | N/A |

## Lessons Learned

1. **Check for existing abstractions before adding inline logic.** The codebase had `getOpenAiReasoning()` and `shouldUseReasoningEffort()` specifically for this purpose. The PR author may not have been aware of them, which is understandable in a codebase this size, but a reviewer should always check `src/api/transform/reasoning.ts` for any reasoning-related changes.

2. **Dual-write patterns are a code smell.** When the same value needs to be in two places, the right fix is usually to normalize to one location and update all readers, not to write to both locations and hope they stay in sync.

3. **kiloconnect found a real bug.** The "disable" not suppressing binary thinking is a genuine logic error that would affect users. Automated review tools earn their keep on exactly these conditional logic gaps.

4. **Small PRs still need pipeline awareness.** At 32 lines, this PR is tiny, but it touches a pattern used by 10+ provider subclasses and a centralized reasoning pipeline. The blast radius of getting reasoning wrong is wide -- every provider inheriting from `BaseOpenAiCompatibleProvider` is affected.

---

<sub>Review #37 | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
