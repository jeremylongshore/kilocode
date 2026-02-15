<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5831
title: "Fix ZenMux model metadata and native tool message handling"
author: Neonsy
category: fix
tier: 5
lines: 387
files: 9
verdict: APPROVE
confidence: 4
reviewed_at: 2026-02-14
linked_issue: none (Discord report)
fork_pr: none
-->

# Review: kilocode #5831

> **Fix ZenMux model metadata and native tool message handling** by @Neonsy
> Upstream CI: 11/11 green

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Fixes two real bugs: contextWindow=0 causing condensing loops, missing native tool metadata causing retry loops |
| Conventions | PASS | Uses `// kilocode_change` markers throughout, follows project patterns |
| Changeset | PASS | Two patch changesets included (context-window + native-tools) |
| Tests | PASS | 288 lines of new tests across 3 spec files covering cache rejection, fetcher mapping, tool gating, DeepSeek R1 passthrough |
| i18n | N/A | No user-facing strings |
| Types | PASS | Proper TypeScript types, imports from `@roo-code/types` |
| Security | PASS | No security implications |
| Scope | PASS | Focused on ZenMux provider reliability |

## Findings

### GREEN: Context window self-healing is well-designed

The `hasInvalidZenmuxContextWindow()` function in `modelCache.ts` checks both memory cache and disk cache paths. When a stale cache entry has `contextWindow <= 0`, the cache is rejected and a fresh fetch is triggered. This self-heals the v5.7.0 bug where `contextWindow: 0` was persisted.

```typescript
function hasInvalidZenmuxContextWindow(models: ModelRecord): boolean {
    return Object.values(models).some((model) => (model.contextWindow ?? 0) <= 0)
}
```

### GREEN: Stream creation refactored to use pre-transformed messages

The `createZenMuxStream` signature changed from `(client, systemPrompt, messages, ...)` to `(client, openAiMessages, ...)`. This prevents a double-conversion bug: `createMessage()` was already calling `convertToOpenAiMessages()` and `convertToR1Format()`, but `createZenMuxStream()` was independently converting again from raw Anthropic messages. The refactored version passes the already-transformed `openAiMessages` directly, preserving DeepSeek R1 format transforms and system prompt handling.

### GREEN: Native tool gating respects task-locked protocol

The PR gates tool parameters on `isNativeProtocol`:

```typescript
const tools = isNativeProtocol ? metadata?.tools : undefined
const toolChoice = isNativeProtocol ? metadata?.tool_choice : undefined
const parallelToolCalls = isNativeProtocol ? (metadata?.parallelToolCalls ?? false) : false
```

This correctly omits tools when the task protocol is XML (e.g., for resumed tasks that started under XML), preventing the "tool not used" retry loops.

### GREEN: resolveToolProtocol now receives lockedProtocol

The call site changes from `resolveToolProtocol(this.options, model.info)` to `resolveToolProtocol(this.options, model.info, metadata?.toolProtocol)`. The `resolveToolProtocol` function already accepts a `lockedProtocol` third parameter but ZenMux was never passing it. This brings ZenMux in line with other providers.

### YELLOW: Aggressive cache invalidation on any single model with contextWindow=0

`hasInvalidZenmuxContextWindow` rejects the entire cache if *any* model has `contextWindow <= 0`. If ZenMux legitimately serves a model without `context_length` in its API response, the fallback in `getZenmuxModels()` applies `zenmuxDefaultModelInfo.contextWindow` (200,000). However, if a model somehow bypasses the fetcher and enters the cache with `contextWindow: 0` through a different code path, the entire cache gets rejected on every read, forcing a fresh API call each time. This is a minor concern because:
1. The fetcher now always sets a positive `contextWindow`
2. The self-healing is temporary (only needed until stale v5.7.0 caches age out)

### GRAY: Removed `parseApiPrice` import but prices stay at 0

The diff removes the unused `parseApiPrice` import from `fetchers/zenmux.ts`. The fetcher sets `inputPrice: 0` and `outputPrice: 0` for all models. This is fine since ZenMux cost tracking uses a different mechanism (`cost` and `cost_details` in usage chunks), but it means model picker UI will show $0 for all ZenMux models.

### GRAY: `openRouterBaseUrl` reuse for ZenMux base URL

The fetcher uses `options?.openRouterBaseUrl` as the base URL override. This works because `modelCache.ts` passes `openRouterBaseUrl: options.baseUrl || "https://zenmux.ai/api/v1"` in the ZenMux case, but reusing an OpenRouter-named field for a different provider is a minor naming inconsistency. Existing pattern across the codebase, not introduced by this PR.

## CI Status

| Check | Result |
|-------|--------|
| build-cli | PASS |
| compile | PASS |
| check-translations | PASS |
| test-cli | PASS |
| test-extension (ubuntu) | PASS |
| test-extension (windows) | PASS |
| test-jetbrains | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| unit-test | PASS |
| Build Markdoc Site | PASS |

All 11 upstream CI checks pass.

## Code Snippets

### Default model info with native tool support:
```typescript
// packages/types/src/providers/zenmux.ts
export const zenmuxDefaultModelInfo: ModelInfo = {
    maxTokens: 8192,
    contextWindow: 200_000,
    supportsImages: true,
    supportsPromptCache: true,
    supportsNativeTools: true,      // NEW
    defaultToolProtocol: "native",  // NEW
    inputPrice: 15.0,
    outputPrice: 75.0,
    ...
}
```

### Runtime self-healing merge:
```typescript
// src/api/providers/zenmux.ts — getModel()
let info = { ...NATIVE_TOOL_DEFAULTS, ...(this.models[id] ?? zenmuxDefaultModelInfo) }
```

### Stale cache detection:
```typescript
// src/api/providers/fetchers/modelCache.ts
function hasInvalidZenmuxContextWindow(models: ModelRecord): boolean {
    return Object.values(models).some((model) => (model.contextWindow ?? 0) <= 0)
}
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**APPROVE** -- This is a well-structured fix for two real bugs in the ZenMux provider. The context window fix prevents erroneous context-condensing loops by ensuring `contextWindow` is always populated (both in the fetcher and via cache self-healing). The native tool fix eliminates "tool not used" retry loops by properly gating tool parameters and passing pre-transformed messages to stream creation. The test coverage is thorough (288 lines across 3 new/extended spec files), the approach is conservative (spread defaults rather than deep modifications), and all 11 CI checks pass. The only minor concern is the aggressive whole-cache invalidation on any model with `contextWindow <= 0`, but this is an acceptable trade-off for self-healing stale caches from a previous version.
