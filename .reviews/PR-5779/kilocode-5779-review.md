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
confidence: 0.80
reviewed_at: 2026-02-14
fork_pr: N/A (batch review)
linked_issue: N/A
-->

# Review: kilocode #5779

> **feat(anthropic): support custom model typing and endpoint discovery for Anthropic-compatible providers** by @ramhaidar

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Custom model passthrough, URL normalization, adaptive thinking sync all correct |
| Conventions | PASS | Follows `// kilocode_change` markers, pattern matches OpenAI Compatible flow |
| Changeset | PASS | `.changeset/fifty-carpets-wave.md` -- patch for `kilo-code` |
| Tests | PASS | 337 new test lines across 5 files: anthropic.spec.ts, webviewMessageHandler.spec.ts, ApiOptions.spec.tsx, ThinkingBudget.spec.tsx, useSelectedModel.spec.ts |
| i18n | PASS | 3 new keys: `customAnthropicAdaptiveThinking`, `customAnthropicAdaptiveThinkingDescription`, `adaptiveThinkingBudgetHint` |
| Types | PASS | `anthropicCustomAdaptiveThinking` added to provider-settings schema, message types updated |
| Security | PASS | API keys handled via headers only, no logging of secrets |
| Scope | WARN | Combined feature (model discovery + custom model passthrough + adaptive thinking + createMessage refactor) is large for one PR |

## Findings

### GREEN -- URL normalization chain is thorough

`src/api/providers/anthropic.ts:507-575`

`normalizeAnthropicBaseUrl` -> `stripAnthropicVersionPath` -> `getAnthropicSdkBaseUrl` handles the real-world problem: users paste `https://provider.example.com/v1` and the Anthropic SDK appends its own `/v1`, producing double paths. The chain handles trailing slashes, invalid URLs, and edge cases. Test coverage for `getAnthropicSdkBaseUrl` confirms both `/v1` stripping and passthrough cases.

### GREEN -- Clean switch/case refactor to supportsPromptCache branching

`src/api/providers/anthropic.ts:115-500`

The original code had two duplicated `switch(modelId)` blocks -- one for message construction and one for beta headers -- enumerating every known Anthropic model ID. The PR replaces both with:

```typescript
const supportsPromptCache = model.info.supportsPromptCache !== false
if (supportsPromptCache) {
    // prompt caching path with ephemeral markers
} else {
    // plain path
}
```

Since all static Anthropic models have `supportsPromptCache: true` and custom models inherit it via `...defaultInfo`, this is functionally equivalent. The deduplication also removes the need to maintain the model ID list in two places.

### GREEN -- Model discovery follows existing pattern

The `requestAnthropicModels` -> `getAnthropicModels` -> `anthropicModels` message flow mirrors the established `requestOpenAiModels` -> `getOpenAiModels` -> `openAiModels` pattern. Auth header branching (`x-api-key` vs `Authorization: Bearer`) is appropriate for Anthropic-compatible endpoints.

### GREEN -- Comprehensive test coverage

- `anthropic.spec.ts`: URL normalization, model discovery with both auth modes, custom model passthrough, adaptive thinking capability
- `webviewMessageHandler.spec.ts`: End-to-end message handler for `requestAnthropicModels`
- `ApiOptions.spec.tsx`: Custom model picker interaction, adaptive thinking checkbox visibility/toggle, model discovery request
- `ThinkingBudget.spec.tsx`: Adaptive thinking hides max thinking slider and shows hint
- `useSelectedModel.spec.ts`: Custom model gets reasoning/verbosity defaults

### YELLOW -- Silent error swallowing in getAnthropicModels

`src/api/providers/anthropic.ts:583-608`

```typescript
export async function getAnthropicModels(baseUrl?: string, apiKey?: string, useAuthToken?: boolean) {
    try {
        // ...fetch models...
    } catch {
        return []
    }
}
```

Network errors, 401 auth failures, 429 rate limits, and malformed responses all silently return `[]`. The user gets no feedback about *why* model discovery produced no results. The `getOpenAiModels` in `openai.ts` has the same pattern, so this is consistent -- but both should probably log a warning. Not blocking since the user can still type custom model IDs manually.

### YELLOW -- Prompt caching beta header now sent for ALL custom models

`src/api/providers/anthropic.ts` (diff line ~464):

```typescript
const betaHeaders = Array.from(new Set([...betas, "prompt-caching-2024-07-31"]))
return { headers: { "anthropic-beta": betaHeaders.join(",") } }
```

Previously, `prompt-caching-2024-07-31` was only added for known Anthropic models. Now it's added for every model where `supportsPromptCache !== false` -- which includes all custom models since they inherit `supportsPromptCache: true` from the default model info spread. If an Anthropic-compatible provider doesn't support this beta header, it might reject requests. Most providers ignore unknown beta headers, but this is a behavior change to flag.

### YELLOW -- Placeholder URL change may confuse official Anthropic API users

`webview-ui/src/components/settings/providers/Anthropic.tsx`

```diff
-placeholder="https://api.anthropic.com"
+placeholder="https://anthropic-compatible.example.com/v1"
```

The original placeholder guided users to the official API. The new one uses a fictional `example.com` domain which signals custom endpoint support but removes the helpful default. Consider `https://api.anthropic.com` as default with a note about custom endpoints in the description text instead.

### YELLOW -- useEvent("message") adds a parallel message listener

`webview-ui/src/components/settings/ApiOptions.tsx:332-342`

```typescript
const onMessage = useCallback((event: MessageEvent) => {
    const message: ExtensionMessage = event.data
    if (message.type === "anthropicModels") {
        setDiscoveredAnthropicModels(message.anthropicModels ?? [])
    }
}, [])
useEvent("message", onMessage)
```

This adds a second `message` event listener scoped to `anthropicModels` messages. Other providers handle model discovery through the parent component's state management rather than direct event listeners in `ApiOptions`. The scoping prevents interference, but it introduces an architectural inconsistency. Not blocking.

### YELLOW -- Custom model inherits ALL defaults from claude-sonnet-4-5

`src/api/providers/anthropic.ts:391-407` and `useSelectedModel.ts:567-577`

Custom models get `...defaultInfo` spread which includes `supportsPromptCache: true`, `supportsNativeTools: true`, `inputPrice`, `outputPrice`, `contextWindow: 200_000`, etc. Most of these are reasonable defaults, but price information from claude-sonnet-4-5 will be wrong for custom models, potentially misleading cost estimates. The pricing display should ideally show "Unknown" for custom models.

### GRAY -- Removed unused OpenAI import

`src/api/providers/anthropic.ts:4`: `import OpenAI from "openai"` was never used in this file beyond the import. Correctly removed and replaced with `import axios from "axios"` which is needed for `getAnthropicModels`.

## CI Status

| Check | Result |
|-------|--------|
| Branch CI | NOT_AVAILABLE -- no checks reported on `feat/custom-anthropic-models` |
| Merge status | MERGEABLE |
| Review decision | REVIEW_REQUIRED |

## Code Snippets

**Custom model info fallback** (`src/api/providers/anthropic.ts:391-407`):
```typescript
const configuredModelId = this.options.apiModelId?.trim()
const id = configuredModelId || anthropicDefaultModelId
const isKnownModelId = id in anthropicModels
const defaultInfo: ModelInfo = anthropicModels[anthropicDefaultModelId]
let info: ModelInfo = isKnownModelId
    ? anthropicModels[id as AnthropicModelId]
    : {
        ...defaultInfo,
        supportsReasoningBudget: true,
        supportsVerbosity: defaultInfo.supportsVerbosity || ["low", "medium", "high", "max"],
        supportsAdaptiveThinking: this.options.anthropicCustomAdaptiveThinking === true,
    }
```

**Adaptive thinking sync** (`webview-ui/src/components/settings/ApiOptions.tsx:378-395`):
```typescript
useEffect(() => {
    if (
        isCustomAnthropicModel &&
        apiConfiguration.enableReasoningEffort === false &&
        apiConfiguration.anthropicCustomAdaptiveThinking
    ) {
        setApiConfigurationField("anthropicCustomAdaptiveThinking", false, false)
    }
}, [isCustomAnthropicModel, apiConfiguration.enableReasoningEffort,
    apiConfiguration.anthropicCustomAdaptiveThinking, setApiConfigurationField])
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**COMMENT** -- Well-structured feature PR with good test coverage (337 new test lines across 5 files), consistent patterns, and a clean refactoring of the model-ID switch/case logic.

Non-blocking concerns:
1. Silent error swallowing in model discovery (consistent with existing pattern)
2. Prompt caching beta header sent to all custom models (potential compatibility)
3. Placeholder URL change reduces discoverability for official API users
4. Custom models inherit pricing info from default model (misleading cost estimates)

No functional bugs found. Recommend merging after the placeholder URL is reconsidered. The prompt caching behavior change for custom models should be validated with real Anthropic-compatible providers.

**Confidence: 0.80** -- Could not verify CI (no checks reported). Prompt-caching and adaptive-thinking behavior changes need real-world validation with non-Anthropic endpoints.
