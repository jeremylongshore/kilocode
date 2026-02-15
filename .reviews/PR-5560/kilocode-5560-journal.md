<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5560
title: "feat: add Poe provider"
author: marciepeters
category: provider
tier: 5
lines: 1557
files: 32
review_number: 23
fork_pr: N/A (batch review)
-->

# Review Journal: kilocode #5560

> **PR**: [#5560](https://github.com/Kilo-Org/kilocode/pull/5560) |
> **Title**: feat: add Poe provider |
> **Author**: @marciepeters |
> **Category**: provider | **Tier**: 5 | **Size**: 1557 lines, 32 files

---

## Summary

Solid provider integration PR from a Poe (Quora) employee. Adds Poe as a first-class provider using the `RouterProvider` pattern with a dedicated model fetcher, webview UI, CLI wiring, comprehensive tests, and documentation. One substantive suggestion around reasoning param detection; otherwise ready to merge after conflict resolution.

## First Impressions

The title and description are clear: a new provider addition for Poe's OpenAI-compatible API. The author works at Poe and is motivated by significant Kilo Code usage through their platform (visible on poe.com/leaderboard). The PR description includes screenshots, testing instructions, and contact info -- well above average for a community contribution.

At 1557 additions across 32 files with zero deletions, this is a purely additive change. The high file count is expected for a provider integration that touches types, schemas, CLI, webview, handler, fetcher, tests, and docs layers.

## What I Looked At

### Files read for context (existing codebase):
- `src/api/providers/router-provider.ts` -- base class PoeHandler extends
- `src/api/providers/openrouter.ts` -- reference implementation for complex provider
- `src/api/providers/chutes.ts` -- reference for simpler RouterProvider child
- `src/api/providers/nano-gpt.ts` -- reference for BaseProvider child with custom getModel
- `src/shared/api.ts` -- `RouterName`, `dynamicProviderExtras`, `GetModelsOptions` types
- `src/shared/cost.ts` -- `parseApiPrice`, `calculateApiCostOpenAI` utilities
- `src/shared/package.ts` -- `Package.version` used in headers
- `packages/types/src/provider-settings.ts` -- `dynamicProviders`, `providerNames`, `TypicalProvider`, `ModelIdKey`

### All 32 PR files analyzed via diff:
- `.changeset/add-poe-provider.md`
- `apps/kilocode-docs/docs/providers/poe.md`
- `cli/src/config/mapper.ts`, `labels.ts`, `models.ts`, `settings.ts`, `validation.ts`
- `packages/core-schemas/src/config/provider.ts`
- `packages/types/src/provider-settings.ts`, `providers/index.ts`, `providers/poe.ts`
- `src/api/index.ts`, `providers/index.ts`, `providers/poe.ts`, `providers/fetchers/poe.ts`, `providers/fetchers/modelCache.ts`
- `src/api/providers/__tests__/poe.spec.ts`, `fetchers/__tests__/poe.spec.ts`
- `src/core/webview/__tests__/ClineProvider.spec.ts`, `__tests__/webviewMessageHandler.spec.ts`, `webviewMessageHandler.ts`
- `src/shared/api.ts`
- `webview-ui/src/components/kilocode/hooks/__tests__/getModelsByProvider.spec.ts`, `hooks/useProviderModels.ts`
- `webview-ui/src/components/settings/ApiOptions.tsx`, `ModelPicker.tsx`, `constants.ts`, `providers/Poe.tsx`, `providers/index.ts`
- `webview-ui/src/components/ui/hooks/useSelectedModel.ts`
- `webview-ui/src/i18n/locales/en/settings.json`
- `webview-ui/src/utils/__tests__/validate.spec.ts`

## Analysis

### Provider Architecture

PoeHandler extends `RouterProvider`, which is correct for an OpenAI-compatible dynamic provider. The inheritance chain:

```
BaseProvider
  -> RouterProvider (client, models, fetchModel, getModel, convertToolsForOpenAI)
    -> PoeHandler (custom getModel with getModelParams, reasoning params, processUsageMetrics)
```

Key design choices:
1. **Overrides `getModel()`** to call `getModelParams()` -- needed because the base `RouterProvider.getModel()` does not call it, but PoeHandler needs `maxTokens`, `temperature`, `reasoningBudget`, and `reasoningEffort` from the model params system.
2. **Custom `getReasoningParams()`** to handle the Anthropic (`thinking_budget`) vs OpenAI (`reasoning_effort`) reasoning API differences. This is the only substantive concern -- it uses model ID prefix matching instead of the capability flags the fetcher already provides.
3. **Custom `processUsageMetrics()`** to handle Poe-specific cache token reporting (`prompt_tokens_details.caching_tokens` vs the more common `cached_tokens`).

### Fetcher Quality

The `getPoeModels()` fetcher in `src/api/providers/fetchers/poe.ts` is clean:
- Hits `api.poe.com/v1/models` with Bearer auth
- Filters non-text-output models (excludes image generators)
- Parses reasoning capabilities (`supportsReasoningBudget`, `supportsReasoningEffort`, `requiredReasoningBudget`)
- Handles both primary and alternative cache pricing field names
- Uses `parseApiPrice()` for consistent price normalization (converts per-token to per-million-token)
- Error handling returns empty object with console.error, matching other fetchers

### Test Coverage

Impressively thorough for a community contribution:

| Test file | Lines | Covers |
|-----------|-------|--------|
| `src/api/providers/__tests__/poe.spec.ts` | 538 | Constructor, getModel, createMessage (text/reasoning/tools/concurrent tools/errors/cache metrics), getReasoningParams (Anthropic/OpenAI/unsupported), completePrompt |
| `src/api/providers/fetchers/__tests__/poe.spec.ts` | 427 | Basic fetch, no-API-key, image support detection, reasoning capabilities, required reasoning, cache pricing, non-text filtering, API errors, empty data, missing context_window, computer use, alternative cache field names |
| Updated integration tests | ~50 | ClineProvider router models, webviewMessageHandler routing |

Test-to-implementation ratio: 965:314 (3:1). The tests use proper mocking (`vitest.mock`) and cover edge cases I wouldn't have thought to test (alternative cache pricing field names, missing context_window).

### Type System Integration

The PR correctly adds `"poe"` to:
- `dynamicProviders` array in `packages/types/src/provider-settings.ts` (makes it a `DynamicProvider` -> `RouterName` -> `ProviderName`)
- `poeSchema` with discriminated union in `providerSettingsSchemaDiscriminated`
- `poeProviderSchema` in `packages/core-schemas/src/config/provider.ts`
- `modelIdKeysByProvider` record with `poeModelId`
- `MODELS_BY_PROVIDER` with empty initial model list (populated dynamically)
- `dynamicProviderExtras` in `src/shared/api.ts` with `{ apiKey?: string }`

### Webview UI

The `Poe.tsx` component follows the exact same pattern as other provider components:
- API key text field (type="password")
- Secret storage notice
- "Get API Key" button linking to `poe.com/api_key`
- Refresh models button with flush
- ModelPicker with `poeModelId` key

## Verification

### What was verified:
- All integration points accounted for (types, schemas, CLI, webview, handler, fetcher, docs, changeset)
- Base URL confirmed correct: `https://api.poe.com/v1/` per official Poe documentation
- `parseApiPrice` multiplier: Poe fetcher passes raw per-token prices like `"0.0000025"`, and `parseApiPrice` multiplies by 1,000,000 to get per-million-token prices (2.5), matching the expected format in `ModelInfo`
- Default model info pricing (`inputPrice: 2.25, outputPrice: 9.0`) is a reasonable fallback for GPT-4o
- Error handling delegates to `handleOpenAIError`, consistent with other providers

### What could not be verified:
- Actual Poe API responses (no API key; auth-gated)
- CI status (merge conflicts prevent CI from running)
- Live streaming behavior
- Poe-specific cache token field names (`caching_tokens` vs `cached_tokens`) -- trusted based on tests

## Diagrams

```
Provider Integration Points (all covered):

packages/types/          packages/core-schemas/    cli/
  provider-settings.ts     provider.ts               mapper.ts
  providers/poe.ts         (poeProviderSchema)       labels.ts
  providers/index.ts                                 models.ts
       |                        |                    settings.ts
       v                        v                    validation.ts
  ProviderName             Zod validation               |
  DynamicProvider                                       v
  ModelIdKey                                        CLI support
       |
       v
src/api/                  src/core/webview/        webview-ui/
  index.ts (factory)        handler.ts               Poe.tsx
  providers/poe.ts          (requestRouterModels)    ApiOptions.tsx
  providers/index.ts                                 ModelPicker.tsx
  fetchers/poe.ts                                    useProviderModels.ts
  fetchers/modelCache.ts                             useSelectedModel.ts
       |                                             constants.ts
       v                                             settings.json
  PoeHandler                                             |
  getPoeModels                                           v
       |                                            Settings UI
       v
  api.poe.com/v1/
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

1. **Provider PRs have a predictable 32-file pattern.** Every new OpenAI-compatible dynamic provider touches the same ~30 integration points. This could be partially automated with a generator script.

2. **Community contributors from provider companies produce high-quality PRs.** The author (Poe employee) has direct incentive to get the integration right and tested thoroughly. The 3:1 test-to-implementation ratio exceeds most internal contributions.

3. **Reasoning param detection should use capability flags, not model name heuristics.** The fetcher already provides `supportsReasoningBudget` and `supportsReasoningEffort` per model. Using these instead of `modelId.startsWith("claude-")` prevents future breakage when model naming conventions change.

4. **`RouterProvider` base class handles most boilerplate.** PoeHandler only needs to customize `getModel()` (for `getModelParams`), `getReasoningParams()`, and `processUsageMetrics()`. The client setup, model caching, and tool conversion are inherited.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
