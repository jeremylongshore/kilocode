<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5560
title: "feat: add Poe provider"
author: marciepeters
category: provider
tier: 5
lines: 1557
files: 32
verdict: APPROVE
confidence: 4
reviewed_at: 2026-02-15
-->

# Review: kilocode #5560

> **feat: add Poe provider** by @marciepeters

[Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Summary

Adds Poe (by Quora) as a first-class provider with OpenAI-compatible API handling, dynamic model fetching, and full test coverage. The implementation follows existing provider patterns closely and is one of the more thorough new-provider PRs seen in this codebase.

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | Pass | Handler delegates to OpenAI-compatible SDK, model fetching parses Poe's API correctly |
| Conventions | Pass | kilocode_change markers present, follows RouterProvider pattern |
| Changeset | Pass | `add-poe-provider.md` present, `minor` semver (appropriate for new provider) |
| Tests | Pass | 538-line handler test + 427-line fetcher test, comprehensive coverage |
| i18n | Pass | English settings keys added (`poeApiKey`, `getPoeApiKey`) |
| Types | Pass | `poe.ts` types, provider-settings schema, model ID keys all wired up |
| Security | Pass | API key stored in VS Code secret store, no hardcoded credentials |
| Scope | Pass | Clean addition, no unrelated changes |

## Findings

### 1. (Gray) No CI checks reported
The PR branch `feature/poe-provider` has no CI checks reported. This may indicate the checks haven't run yet or the branch is stale. Should verify CI passes before merging.

### 2. (Gray) Default model is `gpt-4o` -- not a Poe-native model
**File:** `packages/types/src/providers/poe.ts:6`
```typescript
export const poeDefaultModelId = "gpt-4o"
```
The default model is GPT-4o, which is sensible since Poe is an aggregator. However, the default model info hardcodes GPT-4o pricing. If Poe's GPT-4o pricing differs from OpenAI's, the fallback costs would be inaccurate. This is a minor concern since dynamic model fetching will override these values.

### 3. (Gray) NATIVE_TOOL_DEFAULTS spread as base in getModel
**File:** `src/api/providers/poe.ts:74`
```typescript
const info: ModelInfo = { ...NATIVE_TOOL_DEFAULTS, ...cachedInfo }
```
This ensures all models get `supportsNativeTools: true` and `defaultToolProtocol: "native"` as a baseline, which is correct for an OpenAI-compatible endpoint. The test validates this behavior explicitly.

### 4. (Gray) Reasoning parameter routing by model ID prefix
**File:** `src/api/providers/poe.ts:89-105`
The `getReasoningParams` method uses `startsWith("claude-")` and `startsWith("gpt-")` to determine parameter format (`thinking_budget` vs `reasoning_effort`). This is a practical heuristic that covers the main model families. Models from other providers (Gemini, etc.) get no reasoning params, which is the safe default.

### 5. (Yellow) Missing `refetchRouterModels` call in webview registration
**File:** `src/core/webview/webviewMessageHandler.ts:979-982`
The Poe entry in the router models fetch list correctly passes `apiKey` but no `baseUrl` option. This is fine since `POE_BASE_URL` is hardcoded as `https://api.poe.com/v1/`. However, other providers like OpenRouter pass base URL options. If Poe ever supports custom endpoints, this would need updating. Minor.

### 6. (Gray) Model fetcher uses `axios` directly
**File:** `src/api/providers/fetchers/poe.ts`
The fetcher uses `axios.get` directly rather than the OpenAI SDK's model listing. This is consistent with how other fetchers work (e.g., OpenRouter) and allows Poe-specific response parsing.

## CI Status

| Check | Result |
|-------|--------|
| All checks | No checks reported on branch |

## Code Snippets

**Provider handler -- extends RouterProvider pattern:**
```typescript
// src/api/providers/poe.ts
export class PoeHandler extends RouterProvider implements SingleCompletionHandler {
    constructor(options: ApiHandlerOptions) {
        super({
            options,
            name: "poe",
            baseURL: POE_BASE_URL,
            apiKey: options.poeApiKey || "not-provided",
            modelId: options.poeModelId,
            defaultModelId: poeDefaultModelId,
            defaultModelInfo: poeDefaultModelInfo,
        })
    }
}
```

**Model fetcher -- parses Poe's `/v1/models` endpoint:**
```typescript
// src/api/providers/fetchers/poe.ts
const supportsReasoningBudget = reasoning?.budget ? true : false
const supportsReasoningEffort = reasoning?.supports_reasoning_effort ?? false
const requiredReasoningBudget = reasoning?.required ?? false
```

**Custom headers with Kilo Code identification:**
```typescript
defaultHeaders: {
    "HTTP-Referer": "https://kilocode.ai",
    "X-Title": "Kilo Code",
    "X-KiloCode-Version": Package.version,
    "User-Agent": `Kilo-Code/${Package.version}`,
}
```

## Verdict

**APPROVE** -- This is a clean, well-tested new provider implementation. The author (Marcie Peters from Quora/Poe) brings domain expertise -- the Poe API integration is thorough with proper model metadata parsing, reasoning parameter routing, cache token handling, and tool call streaming. The test suite (965 lines total) covers edge cases including concurrent tool calls, missing content, and unsupported reasoning efforts. The only concern is the missing CI run, which should be verified before merge.
