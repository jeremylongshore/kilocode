<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5658
title: "Try to use exact provider-model profile for autocompletion if such exists"
author: wkordalski
category: provider
tier: 5
lines: 10
files: 1
review_number: 36
fork_pr: null
-->

# Review Journal: kilocode #5658

> **PR**: [#5658](https://github.com/Kilo-Org/kilocode/pull/5658) |
> **Title**: Try to use exact provider-model profile for autocompletion if such exists |
> **Author**: @wkordalski |
> **Category**: provider | **Tier**: 5 | **Size**: 10 lines, 1 file

---

## Summary

When a user has multiple profiles for the same provider (e.g., Mistral/devstral and Mistral/codestral), the autocomplete system could pick the wrong profile's API key, causing a 401 at the codestral endpoint. This 10-line fix adds an exact provider+model match before falling back to any-provider match. Clean, correct, backward-compatible. APPROVE.

## First Impressions

Tier 5 (smallest), single file, 10 lines. The title is descriptive and the PR body explains the bug clearly with a concrete reproduction scenario. The author identified a real credential-routing problem: Mistral uses different API endpoints for different models (`api.mistral.ai` vs `codestral.mistral.ai`), and the old code didn't distinguish which profile to grab when multiple Mistral profiles existed.

## What I Looked At

- `src/services/ghost/GhostModel.ts` -- the changed file (via PR branch `pr-5658`)
- `src/services/ghost/__tests__/GhostModel.spec.ts` -- existing test suite (700+ lines)
- `packages/types/src/kilocode/kilocode.ts` -- `AUTOCOMPLETE_PROVIDER_MODELS` definition
- `src/core/config/ProviderSettingsManager.ts` -- `listConfig()` and `cleanModelId()` logic
- `packages/types/src/provider-settings.ts` -- `getModelId()` and `modelIdKeysByProvider`
- PR metadata, CI checks (11/11 pass), merge state (CONFLICTING)

## Analysis

### The Bug

`GhostModel.reload()` iterates through `AUTOCOMPLETE_PROVIDER_MODELS` (a map of provider -> default autocomplete model). For Mistral, the autocomplete model is `codestral-latest`. The old code selected the first profile with `apiProvider === "mistral"`, regardless of which model that profile was configured for.

When the user has a devstral profile listed before their codestral profile, the loop grabs the devstral profile's API key. Then line 82 overrides the model to `codestral-latest` via `modelIdKeysByProvider`. The API handler builds a request to `codestral.mistral.ai` (the default Mistral autocomplete endpoint) but uses the devstral API key. Mistral's endpoints are key-scoped, so: 401.

### The Fix

Two-phase lookup:
1. **Exact match**: `x.apiProvider === provider && x.modelId === model` -- find the profile that's actually configured for the autocomplete model
2. **Fallback**: `x.apiProvider === provider` -- original behavior, for users with a single profile

The `const` to `let` change is necessary for the two-phase pattern. The fallback ensures no regression for users with a single Mistral profile (the common case).

### cleanModelId interaction

I traced the `modelId` field through the entire pipeline:
- `ProviderSettingsManager.listConfig()` calls `getModelId(apiConfig)` which reads the provider-specific model key (e.g., `apiModelId` for Mistral)
- The result is passed through `cleanModelId()` which strips prefixes before `/`
- For native Mistral profiles, `apiModelId` is `"codestral-latest"` -- matches `AUTOCOMPLETE_PROVIDER_MODELS["mistral"]` directly
- For OpenRouter, `openRouterModelId` might be `"mistralai/codestral-2508"` which gets cleaned to `"codestral-2508"` -- matches `AUTOCOMPLETE_PROVIDER_MODELS["openrouter"]` value of `"mistralai/codestral-2508"` ... wait, no. After cleaning, `"mistralai/codestral-2508"` becomes `"codestral-2508"`, but the map value is `"mistralai/codestral-2508"`. This wouldn't match.

Actually, this is fine. The OpenRouter case: `AUTOCOMPLETE_PROVIDER_MODELS` has `["openrouter", "mistralai/codestral-2508"]`. The `cleanModelId` for an OpenRouter profile with model `"mistralai/codestral-2508"` would return `"codestral-2508"`. These would NOT match on the exact path. But that's acceptable -- it falls back to provider-only matching, which is the old behavior. The exact match is a best-effort optimization that helps when the cleaned model ID matches the map value (which it does for native Mistral, the bug case described in the PR).

### Existing test coverage

The `GhostModel.spec.ts` file has extensive tests (700+ lines) but none of the mock profiles include `modelId`. This means the new exact-match code path returns `undefined` for all existing tests, causing them to fall through to the fallback (original behavior). All existing tests continue to pass, which confirms backward compatibility. The new path is untested but trivially correct.

## Verification

### Upstream CI
All 11 checks pass (compile, build-cli, test-cli, test-extension x2, test-webview x2, test-jetbrains, unit-test, check-translations, Build Markdoc Site).

### Merge State
`CONFLICTING` -- the ghost service has received other changes since 2026-02-04. The conflict is likely trivial to resolve given this PR's small scope. Author needs to rebase.

### What We Couldn't Verify
- Actual Mistral devstral + codestral multi-profile setup (requires two API keys)
- The exact cleanModelId matching behavior with real profile data

## Bot Review Synthesis

| Bot | Status | Key Finding | Useful? |
|-----|--------|-------------|---------|
| CodeRabbit | Not collected | Batch review — no individual fork PR | N/A |
| Gemini | Not collected | Batch review — no individual fork PR | N/A |
| Greptile | Not collected | Batch review — no individual fork PR | N/A |
| CodeQL | Not collected | Batch review — no individual fork PR | N/A |
| Qodo | Not collected | Batch review — no individual fork PR | N/A |

## Lessons Learned

1. **Credential routing bugs are subtle** -- The API key belongs to one endpoint, the model default points to another endpoint. When the profile selection doesn't account for which model the profile is configured for, credentials get misrouted. This is a class of bug that could affect other providers with endpoint-scoped keys.

2. **Two-phase lookup is the right pattern for tightening matches** -- Rather than changing the match criteria directly (which could break users who don't have an exact-match profile), add the stricter match first with a fallback to the original behavior. This preserves backward compatibility while fixing the specific case.

3. **cleanModelId can cause comparison mismatches** -- The `cleanModelId` function strips prefixes, which means the `modelId` on profile entries may not match the values in `AUTOCOMPLETE_PROVIDER_MODELS` for providers that use prefixed model IDs (like OpenRouter). The exact-match optimization only helps when the cleaned ID happens to equal the map value. This is a potential future maintenance concern.

---

<sub>Review #36 | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
