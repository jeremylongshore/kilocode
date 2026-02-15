<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 4772
title: "fix: enable dynamic model selection for OpenAI Compatible provider"
author: b3nw
category: provider
tier: 5
lines: 908
files: 14
verdict: COMMENT
confidence: 85
reviewed_at: 2026-02-15
-->

# Review: kilocode #4772

> **fix: enable dynamic model selection for OpenAI Compatible provider** by @b3nw

**Methodology**: [Kilo Code PR Review Process](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Summary

Enables dynamic model fetching for the OpenAI Compatible provider via the standard `/v1/models` endpoint, moving "openai" from `customProviders` to `dynamicProviders`. Also fixes model name truncation for IDs with multiple slashes (e.g., `chutes/moonshotai/Kimi-K2-Instruct`). Excellent test coverage with 562-line test suite. Closes #3271.

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | Pass | Fetcher, caching, and display name logic are sound |
| Conventions | Pass | Follows existing fetcher patterns (like openrouter.ts) |
| Changeset | Red | Missing changeset |
| Tests | Pass | 562-line test suite with comprehensive edge cases |
| i18n | N/A | No UI string changes |
| Types | Pass | Provider settings properly updated |
| Security | Pass | API key passed as Bearer token, optional for local setups |
| Scope | Pass | Well-scoped to fetcher + model name fix |
| kilocode_change markers | Pass | All new/modified code properly marked |

## Findings

### Red -- Missing changeset

No changeset included. This fixes #3271 and changes the OpenAI Compatible provider from custom to dynamic, which is a user-facing behavior change requiring at minimum a `patch` changeset.

### Yellow -- Moving "openai" from customProviders to dynamicProviders is a breaking change

```typescript
// BEFORE
export const customProviders = ["openai"] as const
// AFTER
export const customProviders = [] as const
```

This changes the behavior for all OpenAI Compatible users: previously they typed model IDs manually; now the extension fetches models from their endpoint. If a user's endpoint doesn't support `/v1/models`, model selection may break. The fetcher handles errors gracefully (throws with clear messages), but the behavioral change should be clearly documented.

### Yellow -- Hardcoded fallback values for unknown model capabilities

```typescript
const defaultModelInfo: ModelInfo = {
    maxTokens: 8192,
    contextWindow: 32000,
    supportsImages: false,
    supportsPromptCache: false,
    supportsComputerUse: false,
    supportsReasoningEffort: false,
    supportsReasoningBudget: false,
    supportsTemperature: true,
    supportsNativeTools: true,
    defaultToolProtocol: "native",
}
```

The `/v1/models` standard endpoint returns minimal info (id, object, created, owned_by). The fetcher provides sensible defaults but assumes `supportsNativeTools: true` and `supportsTemperature: true` for all models, which may not be accurate for all OpenAI-compatible endpoints (e.g., older Ollama versions).

### Gray -- prettyModelName fix is correct and well-tested

```typescript
// BEFORE
mainId.split("/")[1]
// AFTER
mainId.split("/").slice(1).join("/")
```

This correctly handles model IDs like `chutes/moonshotai/Kimi-K2-Instruct` where the previous code would truncate to just `moonshotai`. The 67-line test file covers multiple slash patterns.

### Gray -- Extended model info parsing

The fetcher parses non-standard fields from the `/v1/models` response (`context_window`, `context_length`, `max_output_tokens`, `supports_vision`, pricing fields) that some OpenAI-compatible providers include. This is a practical enhancement that gracefully degrades when fields are absent.

## CI Status

| Check | Result |
|-------|--------|
| check-translations | Pass |
| compile | Pass |
| test-extension (ubuntu) | Pass |
| test-extension (windows) | Pass |
| test-webview (ubuntu) | Pass |
| test-webview (windows) | Pass |
| test-cli | Pass |
| build-cli | Pass |
| test-jetbrains | Pass |

All CI checks pass.

## Code Snippets

### Model fetcher with extended info parsing (openai.ts)
```typescript
export async function getOpenAiModels(options: GetOpenAiModelsOptions): Promise<ModelRecord> {
    const { baseUrl, apiKey, headers: customHeaders } = options
    if (!baseUrl) return {}

    const normalizedBase = baseUrl.replace(/\/+$/, "")
    const url = `${normalizedBase}/models`
    // ...
    for (const model of data.data) {
        if (!model.id || typeof model.id !== "string") continue
        models[model.id] = { ...defaultModelInfo, ...extendedInfo, displayName: model.id }
    }
}
```

### prettyModelName fix (prettyModelName.ts)
```typescript
// Before: mainId.split("/")[1] -- truncated at first slash
// After: mainId.split("/").slice(1).join("/") -- preserves full name
```

## Verdict

**COMMENT** -- High-quality implementation with excellent test coverage (562 lines for the fetcher, 67 for prettyModelName). The kilocode_change markers are properly applied. All CI checks pass. The main concern is the missing changeset and the behavioral change of moving "openai" from customProviders to dynamicProviders, which affects all OpenAI Compatible users. The hardcoded `supportsNativeTools: true` default may cause issues with some endpoints. However, the maintainer has indicated this feature is being deprioritized for the rebuild, so this is unlikely to merge in its current form despite being well-implemented.
