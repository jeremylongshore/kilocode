<!-- PR-JOURNAL-META
pr: 4772
title: "fix: enable dynamic model selection for OpenAI Compatible provider"
author: b3nw
date: 2026-02-14
duration: 35min
fork_pr: N/A (batch review)
-->

# PR #4772 Review Journal

## Review Approach

Tier 3 review. Cross-cutting PR touching types package, backend fetcher, webview hooks, and message handler. Reviewed by reading the full diff, then reading every touched file in `main` to understand the delta and catch conflicts.

## Key Decisions

### 1. Provider Category Reclassification

The PR moves `"openai"` from `customProviders` (where it returned `models: {}`) to `dynamicProviders` (where it fetches from the API). This is architecturally correct because:

- `CustomProvider` means "user types the model ID manually" -- fine for OpenAI's own API with known models, but bad for OpenAI-*compatible* providers where the model list is unknown
- `DynamicProvider` means "we fetch the model list from an API endpoint" -- exactly right for arbitrary OpenAI-compatible endpoints

The type cascade works: `TypicalProvider = Exclude<ProviderName, InternalProvider | CustomProvider | FauxProvider>`. Removing `"openai"` from `CustomProvider` makes it `TypicalProvider`, requiring a `modelIdKeysByProvider` entry. The PR adds `openai: "openAiModelId"` which maps to the existing `openAiModelId` settings field.

### 2. Fetcher Design Choices

The fetcher at `src/api/providers/fetchers/openai.ts` takes a different approach from existing fetchers:

- **No fallback models**: Unlike `chutes.ts` which starts with `chutesModels` as a base and overlays API results, this fetcher returns `{}` on failure. This is correct -- there are no "known" models for an arbitrary user-configured endpoint.
- **Extended field parsing**: The `ExtendedModelFields` interface documents common non-standard fields from various providers (OpenRouter, Together, etc.). Field priority ordering (e.g., `context_window` over `context_length` over `max_context_length`) is a pragmatic choice.
- **`displayName: model.id`**: This bypasses `prettyModelName()` for dynamically fetched models, using the raw API-provided ID. Smart -- avoids the formatting function mangling provider-specific IDs.

### 3. prettyModelName Fix Scope

The `prettyModelName()` fix (`split("/")[1]` -> `split("/").slice(1).join("/")`) is a genuine bug fix that's independent of the dynamic fetching feature. Model IDs with multiple path segments (e.g., from OpenRouter) were being truncated. The fix preserves the full path after the first slash and lets the `-` splitting logic handle the rest.

## Files Analyzed

| File | Lines | What I Checked |
|------|-------|----------------|
| `packages/types/src/provider-settings.ts` | ~815 | Provider arrays, type implications, modelIdKeysByProvider |
| `src/api/providers/fetchers/openai.ts` | 202 (new) | Full read, compared against chutes.ts and deepinfra.ts patterns |
| `src/api/providers/fetchers/modelCache.ts` | ~460 | Switch case integration, cache behavior |
| `src/core/webview/webviewMessageHandler.ts` | ~1000 | Router models initialization and fetch config |
| `src/shared/api.ts` | ~220 | RouterName type, dynamicProviderExtras |
| `webview-ui/src/utils/prettyModelName.ts` | 22 | Bug fix verification |
| `webview-ui/src/components/kilocode/hooks/useProviderModels.ts` | ~370 | Model retrieval for openai case |
| `webview-ui/src/components/ui/hooks/useRouterModels.ts` | 82 | Query key cache invalidation |
| `src/api/providers/constants.ts` | 11 | DEFAULT_HEADERS comparison |
| `src/api/providers/fetchers/__tests__/openai.spec.ts` | 562 (new) | Test coverage review |
| `webview-ui/src/utils/__tests__/prettyModelName.spec.ts` | 67 (new) | Test coverage review |

## Conflict Analysis

Conflicts stem from main having evolved after the PR branched:

1. **`dynamicProviders` array**: main added `"zenmux"`, PR adds `"openai"` -- straightforward merge
2. **`customProviders` array**: main has `["openai", "openai-responses"]`, PR changes to `[]` -- must resolve to `["openai-responses"]`
3. **`modelCache.ts` switch**: main added `"zenmux"` case, PR adds `"openai"` case -- straightforward merge
4. **`webviewMessageHandler.ts`**: main added `"zenmux"` entries, PR adds `"openai"` entries -- straightforward merge
5. **`src/shared/api.ts`**: main added `"zenmux"` to `dynamicProviderExtras`, PR adds `"openai"` -- straightforward merge
6. **`modelIdKeysByProvider`**: main added `zenmux: "zenmuxModelId"`, PR adds `openai: "openAiModelId"` -- straightforward merge
7. **Test files**: Various test updates may need rebasing

Most conflicts are simple additive merges. The only semantic conflict is #2 (customProviders).

## Related Work

- **PR #4860** (benzntech): Adds capability heuristics for OpenAI Compatible models (reasoning, images, computer use based on model ID patterns). Complementary to this PR. Both open.
- **Issue #3271**: "The list of models doesn't load in the panel below on the OpenAI Compatible provider" -- this PR directly addresses it.

## What I Did NOT Check

- Did not build/test in codespace (CI passes, tier 3)
- Did not verify the actual `/v1/models` response format against any specific provider
- Did not check if `openAiHeaders` can override `Authorization` or `Content-Type` (the spread order in the fetcher puts custom headers before `Authorization`, so custom headers could be overridden by the auth header, but `Content-Type` from custom headers would override the default -- this seems fine)

## Bot Review Synthesis

| Bot | Status | Key Finding | Useful? |
|-----|--------|-------------|---------|
| CodeRabbit | Not collected | Batch review — no individual fork PR | N/A |
| Gemini | Not collected | Batch review — no individual fork PR | N/A |
| Greptile | Not collected | Batch review — no individual fork PR | N/A |
| CodeQL | Not collected | Batch review — no individual fork PR | N/A |
| Qodo | Not collected | Batch review — no individual fork PR | N/A |

## Lessons

- When a provider moves between category arrays (`customProviders` -> `dynamicProviders`), check all type-level implications: `TypicalProvider`, `modelIdKeysByProvider`, `RouterName`, `dynamicProviderExtras`
- The PR's approach of setting `displayName` on dynamically fetched models to bypass `prettyModelName()` is a good pattern to note for future dynamic provider fetchers
- Long-lived branches in a fast-moving codebase accumulate conflicts quickly -- this PR touches 14 files and has been open since the customProviders/dynamicProviders split was actively changing
