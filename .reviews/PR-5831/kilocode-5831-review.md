<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5831
title: "Fix ZenMux model metadata and native tool message handling"
author: Neonsy
category: feature
tier: 5
lines: 387
files: 9
verdict: APPROVE
confidence: 4
reviewed_at: 2026-02-15
-->

# Review: kilocode #5831

> **Fix ZenMux model metadata and native tool message handling** by @Neonsy

[Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Fixes real bug: stale cache with contextWindow=0 caused condensing loops; native tool passthrough was broken |
| Conventions | PASS | Uses `kilocode_change` markers correctly throughout |
| Changeset | PASS | Two changesets: context window fix + native tools reliability |
| Tests | PASS | 288 new test lines across 3 test files covering all fix paths |
| i18n | N/A | No user-facing strings |
| Types | PASS | Default model info updated with native tool fields |
| Security | PASS | No security surface changes |
| Scope | PASS | Tightly scoped to ZenMux provider and its cache layer |

## Findings

### 1. NATIVE_TOOL_DEFAULTS spread ordering in getModel (severity: gray)

```typescript
let info = { ...NATIVE_TOOL_DEFAULTS, ...(this.models[id] ?? zenmuxDefaultModelInfo) }
```

Since `NATIVE_TOOL_DEFAULTS` is spread first, any cached model that explicitly sets `supportsNativeTools: false` would correctly override the defaults. However, models from the cache that simply omit these fields would not get the defaults merged -- they would be `undefined`. This is actually the correct behavior since the spread of `zenmuxDefaultModelInfo` already includes the new fields. No issue, just noting the ordering is intentional.

### 2. createZenMuxStream signature change is well-handled (severity: gray)

The method signature changes from `(client, systemPrompt, messages, ...)` to `(client, openAiMessages, ...)`. The caller now passes pre-transformed OpenAI messages instead of raw Anthropic messages, which preserves DeepSeek R1 transforms and other message-level mutations. This is the core fix for the "tool not used" retry loops.

### 3. Stale cache self-healing is ZenMux-specific (severity: gray)

The `hasInvalidZenmuxContextWindow` check in `modelCache.ts` only applies to the `zenmux` provider. This is appropriate since the bug was specific to ZenMux v5.7.0 cache entries. The function correctly checks `(model.contextWindow ?? 0) <= 0` to catch both `0` and missing values.

### 4. Tool protocol lock respected via metadata.toolProtocol (severity: gray)

The PR passes `metadata?.toolProtocol` as the third argument to `resolveToolProtocol()`, which the Kilo fork added to respect task-locked protocols. This ensures resumed tasks keep their original tool protocol setting. Good attention to the fork's specific extension.

## CI Status

| Check | Result |
|-------|--------|
| compile | PASS |
| test-extension (ubuntu) | PASS |
| test-extension (windows) | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| test-cli | PASS |
| test-jetbrains | PASS |
| build-cli | PASS |
| check-translations | PASS |

## Code Snippets

Core fix -- using pre-transformed messages for stream creation:

```typescript
// Before: rebuilt messages from raw, losing transforms
const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...convertToOpenAiMessages(messages),
]

// After: uses already-transformed openAiMessages passed from caller
async createZenMuxStream(
    client: OpenAI,
    openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
    model: { id: string; info: ModelInfo },
    ...
)
```

Stale cache self-healing:

```typescript
function hasInvalidZenmuxContextWindow(models: ModelRecord): boolean {
    return Object.values(models).some((model) => (model.contextWindow ?? 0) <= 0)
}
```

## Verdict

**APPROVE** -- This is a well-structured fix for two related ZenMux reliability issues. The context window cache hardening prevents erroneous condensing loops from stale v5.7.0 cache entries. The message pipeline refactor preserves transforms (especially for DeepSeek R1) and correctly gates native tool parameters based on the task-locked protocol. All CI checks pass. The test coverage is targeted and regression-focused. Community user testing on Discord confirms the fix resolves the reported "tool not used" retry loops.
