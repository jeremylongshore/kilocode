<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5648
title: "Feature: add new provider AIHubmix"
author: DDU1222
category: provider
tier: 5
lines: 503
files: 46
verdict: REQUEST_CHANGES
confidence: 4
reviewed_at: 2026-02-15
-->

# Review: kilocode #5648

> **Feature: add new provider AIHubmix** by @DDU1222

[Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Summary

Adds AIHubmix as a new provider using a delegation pattern (routes to Anthropic, OpenAI, Gemini, or OpenAI Responses handlers based on model ID prefix). The implementation has an interesting architectural approach but has merge conflicts, failing CI, no changeset, no tests, and an empty PR description.

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | Yellow | Delegation pattern works but model routing heuristics are fragile |
| Conventions | Pass | kilocode_change markers present |
| Changeset | Fail | No changeset file included |
| Tests | Fail | No test files added for handler or fetcher |
| i18n | Pass | All 24 locale files updated with `aihubmixApiKey` and `getAihubmixApiKey` |
| Types | Pass | Schema, model ID keys, and provider settings wired correctly |
| Security | Pass | API key via VS Code secret store |
| Scope | Pass | Clean provider addition |

## Findings

### 1. (Red) Merge conflicts -- PR is CONFLICTING
The PR has merge conflicts against main. The maintainer (kevinvandijk) has already flagged this with a CHANGES_REQUESTED review asking the author to fix conflicts and failing tests.

### 2. (Red) Missing changeset
The changeset-bot reports no changeset. A new provider warrants at least a `minor` semver bump changeset.

### 3. (Red) No tests
No test files were added for:
- `src/api/providers/aihubmix.ts` (handler)
- `src/api/providers/fetchers/aihubmix.ts` (model fetcher)

This is below the project's quality bar -- compare to PR #5560 (Poe) which has 965 lines of tests. At minimum, the delegation routing logic and fetcher parsing should be tested.

### 4. (Red) CI failures
Two test suites fail on both platforms:
- `test-extension` (ubuntu + windows): FAIL
- `test-webview` (ubuntu + windows): FAIL

These are likely due to missing provider entries in existing test expectations (e.g., `getModelsByProvider.spec.ts` which checks all providers).

### 5. (Yellow) Empty PR description
The PR template is unfilled -- no context, implementation notes, screenshots, or test instructions. This makes review harder and suggests the PR was submitted hastily.

### 6. (Yellow) Model routing by prefix is fragile
**File:** `src/api/providers/aihubmix.ts:47-59`
```typescript
private routeModel(modelId: string): ModelRoute {
    const id = modelId.toLowerCase()
    if (id.startsWith("claude")) return "anthropic"
    if (id.startsWith("gemini") && !id.endsWith("-nothink") && !id.endsWith("-search")) return "gemini"
    if (id === "gpt-5-pro" || id === "gpt-5-codex") return "openai-responses"
    return "openai"
}
```
This heuristic:
- Hardcodes specific model IDs (`gpt-5-pro`, `gpt-5-codex`) which will break as models change
- Does not handle Deepseek, Llama, Mistral, or other model families that may need different handling
- The `-nothink` and `-search` suffix exclusions for Gemini are AIHubmix-specific quirks that are undocumented

### 7. (Yellow) Delegation pattern creates options pollution
**File:** `src/api/providers/aihubmix.ts:80-90`
```typescript
this.delegateHandler = new AnthropicHandler({
    ...this.options,
    apiKey: this.options.aihubmixApiKey,
    anthropicBaseUrl: baseUrl,
    apiModelId: this.options.aihubmixModelId,
})
```
Spreading `...this.options` means the delegate handler receives all AIHubmix-specific fields (`aihubmixApiKey`, `aihubmixBaseUrl`, `aihubmixModelId`) plus the mapped fields. This won't cause errors but is messy -- the delegate handler may log confusing debug information showing both sets of credentials.

### 8. (Gray) Fetcher's `console.log` in production code
**File:** `src/api/providers/fetchers/aihubmix.ts:89`
```typescript
console.log(`Fetched ${Object.keys(models).length} AIhubmix models`)
```
Other fetchers use `console.error` only for failures. A `console.log` for success is noisy in production.

### 9. (Gray) Default model is `claude-opus-4-5` -- premium model
**File:** `packages/types/src/providers/aihubmix.ts:7`
Setting the default to Claude Opus 4.5 means users will default to a very expensive model. Other providers typically default to more cost-effective options.

## CI Status

| Check | Result |
|-------|--------|
| compile | Pass |
| test-extension (ubuntu) | Fail |
| test-extension (windows) | Fail |
| test-webview (ubuntu) | Fail |
| test-webview (windows) | Fail |
| test-cli | Pass |
| test-jetbrains | Pass |
| check-translations | Pass |
| build-cli | Pass |

## Code Snippets

**Delegation pattern -- routes to existing handlers:**
```typescript
// src/api/providers/aihubmix.ts
export class AihubmixHandler extends BaseProvider implements SingleCompletionHandler {
    private getDelegateHandler(): ApiHandler {
        const modelId = this.options.aihubmixModelId || AIHUBMIX_DEFAULT_MODEL
        const route = this.routeModel(modelId)
        switch (route) {
            case "anthropic":
                this.delegateHandler = new AnthropicHandler({...})
            case "gemini":
                this.delegateHandler = new GeminiHandler({...})
            case "openai-responses":
                this.delegateHandler = new OpenAiCompatibleResponsesHandler({...})
            case "openai":
            default:
                this.delegateHandler = new OpenAiHandler({...})
        }
    }
}
```

**Model fetcher -- custom API format:**
```typescript
// src/api/providers/fetchers/aihubmix.ts
const response = await axios.get(`${baseUrl}/api/v1/models?type=llm&sort_by=coding`)
// Uses preferredIndex to preserve API sort order
models[rawModel.model_id] = { ...modelInfo, preferredIndex }
```

## Verdict

**REQUEST_CHANGES** -- The delegation pattern is architecturally interesting but the PR has multiple blocking issues:

1. **Merge conflicts** -- must be resolved before review is meaningful
2. **CI failures** -- test-extension and test-webview fail on both platforms
3. **No changeset** -- required for a new provider
4. **No tests** -- the delegation routing and fetcher parsing need test coverage
5. **Empty PR description** -- no context for reviewers

The maintainer has already requested changes. Once these are addressed, the core approach (delegating to existing handlers based on model family) is valid, though the model routing heuristics should be documented and tested.
