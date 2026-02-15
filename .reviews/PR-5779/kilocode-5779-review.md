<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5779
title: "feat(anthropic): support custom model typing and endpoint discovery for Anthropic-compatible providers"
author: ramhaidar
category: provider
tier: 5
lines: 954
files: 15
verdict: COMMENT
confidence: 4
reviewed_at: 2026-02-15
-->

# Review: kilocode #5779

> **feat(anthropic): support custom model typing and endpoint discovery for Anthropic-compatible providers** by @ramhaidar

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Base URL normalization, model discovery, custom model handling all correct |
| Conventions | PASS | kilocode_change markers on all shared-code changes |
| Changeset | PASS | Patch changeset included |
| Tests | PASS | 8+ new tests across 4 test files covering provider, webview handler, settings UI, and model hook |
| i18n | PARTIAL | English strings added; other 23 languages need updates |
| Types | PASS | anthropicCustomAdaptiveThinking added to provider-settings schema; message types updated |
| Security | PASS | API key handling follows existing patterns; auth token support for custom endpoints |
| Scope | WARN | Large scope: combines 4 features (URL normalization, model discovery, custom model support, adaptive thinking) |

## Findings

### [yellow] Significant refactoring of the Anthropic createMessage switch statement
**File**: `src/api/providers/anthropic.ts:115-253`
The PR replaces the `switch (modelId)` with a `if (supportsPromptCache)` conditional. This is architecturally better (feature-based rather than model-list-based), but the scope of the refactoring is large and touches the core message creation path. The original code had a case statement listing every known model for prompt caching; the new code derives this from `model.info.supportsPromptCache !== false`. This means all custom models get prompt caching by default (since `supportsPromptCache` defaults to `undefined`, and `undefined !== false` is `true`). This is reasonable for Anthropic-compatible endpoints but should be explicitly documented.

### [yellow] `getAnthropicModels` swallows all errors
**File**: `src/api/providers/anthropic.ts:583-608`
```typescript
export async function getAnthropicModels(baseUrl?, apiKey?, useAuthToken?) {
    try { ... } catch { return [] }
}
```
The model discovery function silently returns an empty array on any error. This means network errors, auth failures, and invalid responses are all invisible to the user. The UI should provide some feedback when model discovery fails (e.g., "could not fetch models from endpoint").

### [yellow] Replaced OpenAI import with axios for model discovery
**File**: `src/api/providers/anthropic.ts:1,4`
The PR removes the `import OpenAI from "openai"` and adds `import axios from "axios"`. The Anthropic provider previously imported OpenAI (possibly unused or for model listing). The switch to axios for the `/v1/models` endpoint is reasonable, but it adds axios as a direct dependency to the provider file. Verify that axios is already a project dependency and not pulled transitively.

### [yellow] Custom model defaults inherit from anthropicDefaultModelId
**File**: `src/api/providers/anthropic.ts:396-407`, `webview-ui/src/components/ui/hooks/useSelectedModel.ts:568-578`
When a custom (unknown) model ID is used, the model info is cloned from the default model (currently `claude-sonnet-4-5`) with `supportsReasoningBudget: true`, `supportsVerbosity`, and `supportsAdaptiveThinking` based on the new setting. This means custom models inherit the pricing, context window, and capabilities of the default model. Users may not realize they're seeing default model pricing rather than their actual model's pricing.

### [green] Comprehensive test coverage
**File**: Multiple test files
New tests cover:
- Base URL normalization with `/v1` stripping (`anthropic.spec.ts`)
- Custom model passthrough in streaming calls (`anthropic.spec.ts`)
- Model discovery with mock axios (`anthropic.spec.ts`)
- Bearer token auth for model discovery (`anthropic.spec.ts`)
- Custom model preservation in `getModel()` (`anthropic.spec.ts`)
- Adaptive thinking capability toggle (`anthropic.spec.ts`)
- Webview message handler for `requestAnthropicModels` (`webviewMessageHandler.spec.ts`)
- Settings UI model picker, adaptive thinking checkbox, auto-sync (`ApiOptions.spec.tsx`)
- ThinkingBudget adaptive mode hint (`ThinkingBudget.spec.tsx`)
- useSelectedModel custom model capabilities (`useSelectedModel.spec.ts`)

### [green] Base URL normalization is well-implemented
**File**: `src/api/providers/anthropic.ts:547-581`
The `normalizeAnthropicBaseUrl` and `stripAnthropicVersionPath` functions handle edge cases: trailing slashes, `/v1` suffix stripping, URL validation via `URL.canParse`. The SDK base URL is stripped of `/v1` to avoid the duplicate path issue where the Anthropic SDK appends `/v1/messages` internally.

### [green] Adaptive thinking sync between UI controls
**File**: `webview-ui/src/components/settings/ApiOptions.tsx:378-395`
The `useEffect` that auto-disables `anthropicCustomAdaptiveThinking` when `enableReasoningEffort` is set to `false` prevents an inconsistent state. The reverse direction (enabling adaptive auto-enables reasoning) is handled in the checkbox onChange handler. This two-way sync is the correct UX pattern.

### [gray] CI has not run
No CI checks reported on the branch. Cannot verify type-checking or test suite against these changes.

## CI Status

| Check | Result |
|-------|--------|
| All checks | NOT RUN |

## Code Snippets

### Base URL normalization
```typescript
// Strips /v1 suffix so the Anthropic SDK doesn't double it
export function getAnthropicSdkBaseUrl(baseUrl?: string): string | undefined {
    const normalizedBaseUrl = normalizeAnthropicBaseUrl(baseUrl)
    if (!normalizedBaseUrl) return undefined
    return stripAnthropicVersionPath(normalizedBaseUrl)
}
```

### Model discovery endpoint
```typescript
export async function getAnthropicModels(baseUrl?, apiKey?, useAuthToken?) {
    const headers: Record<string, string> = { "anthropic-version": "2023-06-01" }
    if (useAuthToken) headers["Authorization"] = `Bearer ${apiKey}`
    else headers["x-api-key"] = apiKey

    const response = await axios.get(`${baseUrlWithoutVersion}/v1/models`, { headers })
    return [...new Set<string>(response.data?.data?.map((m: any) => m.id) || [])]
}
```

### Prompt cache refactoring
```typescript
// Before: switch on model IDs
switch (modelId) {
    case "claude-opus-4-6":
    case "claude-sonnet-4-5":
    // ... 10 more cases
}

// After: feature-based conditional
const supportsPromptCache = model.info.supportsPromptCache !== false
if (supportsPromptCache) { ... }
```

## Verdict

**COMMENT** - This is a well-engineered feature that addresses real user needs (Anthropic-compatible providers with custom model IDs). The test coverage is thorough and the URL normalization logic handles edge cases properly. The refactoring of the prompt cache switch statement from model-list-based to feature-based is a good architectural improvement.

Two items need attention: (1) the silent error swallowing in `getAnthropicModels` should at minimum log the error, and (2) CI needs to run before this can be approved. The scope is large (URL normalization + model discovery + custom model support + adaptive thinking), which increases review and merge risk. Consider whether the adaptive thinking UX changes could be split into a follow-up PR.

---

*Reviewed by: Jeremy Longshore*
*Review methodology: [Kilo Code Review Process](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)*
