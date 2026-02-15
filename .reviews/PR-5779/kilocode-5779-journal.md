<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5779
title: "feat(anthropic): support custom model typing and endpoint discovery for Anthropic-compatible providers"
author: ramhaidar
category: provider
tier: 5
lines: 954
files: 15
review_number: 23
fork_pr: N/A (batch review)
-->

# Review Journal: kilocode #5779

> **PR**: [#5779](https://github.com/Kilo-Org/kilocode/pull/5779) |
> **Title**: feat(anthropic): support custom model typing and endpoint discovery for Anthropic-compatible providers |
> **Author**: @ramhaidar |
> **Category**: provider | **Tier**: 5 | **Size**: 954 lines, 15 files

---

## Summary

Solid provider-level feature PR that enables Anthropic-compatible custom endpoints and custom model IDs. The core refactor (replacing duplicated model-ID switch/case with `supportsPromptCache` branching) is the most impactful change -- it removes maintenance burden and makes the code extensible. The adaptive thinking toggle and model discovery are well-integrated. No blocking issues found; COMMENT verdict with suggestions on placeholder URL and cost display accuracy.

## First Impressions

Title and description are clear. The PR links two issues (#3544, #3545) and provides screenshots showing before/after UI. The scope is large (15 files, 759 additions, 195 deletions) but focused on one provider (`anthropic`). The PR description includes test commands and testing steps, which is above-average quality.

Eight commits for a PR this size suggests incremental development rather than a squash-and-push approach. The changeset is correctly marked as `patch`.

## What I Looked At

### Files read in full:
- `src/api/providers/anthropic.ts` -- The main provider file (existing baseline)
- `webview-ui/src/components/settings/ThinkingBudget.tsx` -- Adaptive thinking budget UI
- `webview-ui/src/components/settings/ModelPicker.tsx` -- Model picker component (for pattern comparison)
- `packages/types/src/providers/anthropic.ts` -- Static model definitions
- `packages/types/src/model.ts` -- Model info schema

### Files read partially:
- `src/core/webview/webviewMessageHandler.ts` -- Message handler around line 1190 for `requestOpenAiModels` pattern comparison
- `webview-ui/src/components/ui/hooks/useSelectedModel.ts` -- Default case around line 555
- `src/api/transform/model-params.ts` -- `getModelParams` signature

### Pattern comparisons:
- `src/api/providers/openai.ts` -- `getOpenAiModels` function for consistency check
- Cross-codebase `axios` usage -- confirmed as existing dependency (43 files)

### Full diff reviewed: All 15 changed files

## Analysis

### 1. The switch/case refactor is the hidden gem

The biggest win in this PR isn't the custom model feature -- it's the elimination of the duplicated `switch(modelId)` in `createMessage`. The original code listed every known Anthropic model ID twice:
- Once to decide whether to add prompt caching (message body path)
- Once to decide whether to add the `prompt-caching-2024-07-31` beta header

Every time a new Anthropic model was added to the types, both switch statements had to be updated. The PR replaces this with `const supportsPromptCache = model.info.supportsPromptCache !== false`, which is derived from the model info object. New models automatically get the correct behavior.

### 2. Custom model info inheritance is pragmatic but imperfect

The PR spreads `...defaultInfo` (from `claude-sonnet-4-5`) onto custom models. This means custom models inherit:
- `supportsPromptCache: true` -- reasonable, most Anthropic-compatible endpoints support this
- `supportsNativeTools: true` -- reasonable
- `inputPrice: 4.0`, `outputPrice: 16.0` -- **wrong** for custom models, will produce incorrect cost estimates
- `contextWindow: 200_000` -- may be wrong but harmless as a default
- `maxTokens: 64_000` -- may be too high or too low

The PR explicitly overrides `supportsReasoningBudget`, `supportsVerbosity`, and `supportsAdaptiveThinking`, which is correct. But the pricing inheritance could mislead users who track API costs through the extension.

### 3. Adaptive thinking toggle has proper bidirectional sync

The `useEffect` in `ApiOptions.tsx` that auto-disables `anthropicCustomAdaptiveThinking` when `enableReasoningEffort` is set to `false` is correct. The reverse direction (enabling reasoning when adaptive is checked) is handled in the `onChange` handler. This prevents an impossible state where adaptive thinking is enabled but reasoning is disabled.

### 4. Model discovery auth branching

```typescript
if (useAuthToken) {
    headers["Authorization"] = `Bearer ${apiKey}`
} else {
    headers["x-api-key"] = apiKey
}
```

This matches how the Anthropic SDK handles auth -- `apiKey` maps to `x-api-key` header, `authToken` maps to `Authorization: Bearer`. The `useAuthToken` toggle is already in the Anthropic settings UI, so this reuses the existing preference.

### 5. The `webviewMessageHandler` case differs from OpenAI

`requestOpenAiModels` has a guard:
```typescript
if (message?.values?.baseUrl && message?.values?.apiKey) {
```

`requestAnthropicModels` has no such guard. The `getAnthropicModels` function handles missing `apiKey` internally (returns `[]`), and the base URL defaults to `ANTHROPIC_DEFAULT_BASE_URL` if not provided. This means model discovery fires even for the official Anthropic API, which is different from the OpenAI flow but arguably useful -- it lets users discover available models on their API key.

## Verification

- **CI**: No checks reported on the `feat/custom-anthropic-models` branch. Cannot verify tests pass.
- **Merge status**: MERGEABLE (no conflicts)
- **Review decision**: REVIEW_REQUIRED (no other reviews yet)
- **Local testing**: NOT_RUN (review-only session)
- **Dependency check**: `axios` already in the dependency tree (43 files import it)
- **Type safety**: `anthropicCustomAdaptiveThinking` correctly added to the Zod schema in `provider-settings.ts`

## Diagrams

```
Message Flow: Anthropic Model Discovery

Webview                    Extension Host                  External API
  |                              |                              |
  |--requestAnthropicModels----->|                              |
  |  (baseUrl, apiKey,           |                              |
  |   useAuthToken)              |                              |
  |                              |--GET /v1/models------------->|
  |                              |  (x-api-key or Bearer)       |
  |                              |<--{data: [{id: ...}]}--------|
  |                              |                              |
  |<--anthropicModels------------|                              |
  |  (string[])                  |                              |
  |                              |                              |
  | [merges discovered + static  |                              |
  |  into ModelPicker options]   |                              |
```

```
Custom Model getModel() Flow

options.apiModelId = "MinMax-M2"
       |
       v
  in anthropicModels?  --yes--> Use static model info
       |no
       v
  Spread defaultInfo (claude-sonnet-4-5)
  Override: supportsReasoningBudget = true
            supportsVerbosity = ["low","medium","high","max"]
            supportsAdaptiveThinking = options.anthropicCustomAdaptiveThinking
       |
       v
  Return { id: "MinMax-M2", info: customInfo, ...params }
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

1. **Switch/case on model IDs is a maintenance anti-pattern.** When the same set of IDs appears in multiple switch statements, the code is fragile -- every new model requires updates in multiple places. Feature flags on the model info object (like `supportsPromptCache`) are more maintainable.

2. **Custom model info inheritance needs explicit scoping.** Spreading a default model's info onto unknown models is pragmatic, but pricing fields should either be nulled out or marked as estimated. Users tracking costs via the extension will get wrong numbers.

3. **URL normalization is a real-world necessity for provider integrations.** Users paste URLs from documentation that may or may not include `/v1`, trailing slashes, or other path segments. A robust normalization chain prevents subtle API failures.

4. **Silent error swallowing in model discovery is a recurring pattern.** Both `getOpenAiModels` and now `getAnthropicModels` silently return `[]` on any error. This is user-hostile but consistent. A future improvement should surface fetch errors in the UI.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
