<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5831
title: "Fix ZenMux model metadata and native tool message handling"
author: Neonsy
category: feature
tier: 5
lines: 387
files: 9
review_number: 59
-->

# Review Journal: kilocode #5831

> **PR**: [#5831](https://github.com/Kilo-Org/kilocode/pull/5831) |
> **Title**: Fix ZenMux model metadata and native tool message handling |
> **Author**: @Neonsy |
> **Category**: feature | **Tier**: 5 | **Size**: 387 lines, 9 files

---

## Summary

Fixes two related ZenMux provider bugs: (1) stale model cache with contextWindow=0 caused infinite condensing loops, and (2) native tool calling was broken because message transforms were being rebuilt instead of passed through. Well-tested fix with Discord user validation. Approve.

## First Impressions

Two changesets signal this is a combined fix. The PR description is thorough with clear problem statement, implementation details, and test instructions. The author (Neonsy) is a repeat contributor with good pattern awareness.

## What I Looked At

- `src/api/providers/zenmux.ts` -- handler changes (message pipeline refactor, tool protocol gating)
- `packages/types/src/providers/zenmux.ts` -- default model info additions
- `src/api/providers/fetchers/zenmux.ts` -- fetcher enhancements (context_length mapping, native tool metadata)
- `src/api/providers/fetchers/modelCache.ts` -- stale cache self-healing
- `src/api/providers/__tests__/zenmux-native-tools.spec.ts` -- new test file (175 lines)
- `src/api/providers/fetchers/__tests__/zenmux.spec.ts` -- new fetcher tests (70 lines)
- `src/api/providers/fetchers/__tests__/modelCache.spec.ts` -- cache validation tests (43 lines)
- Cross-referenced `resolveToolProtocol` signature to verify 3-arg form
- Cross-referenced `NATIVE_TOOL_DEFAULTS` from `@roo-code/types`

## Analysis

The root cause analysis is sound:

1. **Context window bug**: ZenMux fetcher was setting `contextWindow: 0` for models where the API response lacked a `context_length` field. This triggered the extension's context condensation logic repeatedly. Fix: map `context_length` from API response, fall back to the default (200K) when missing.

2. **Tool calling bug**: `createZenMuxStream` was rebuilding messages from raw Anthropic format, which lost DeepSeek R1 system-to-user transforms and other protocol-specific mutations. The stream then sent malformed messages, causing "tool not used" retry loops. Fix: pass the already-transformed `openAiMessages` to the stream method.

The tool protocol gating is done correctly:

```typescript
const tools = isNativeProtocol ? metadata?.tools : undefined
const toolChoice = isNativeProtocol ? metadata?.tool_choice : undefined
const parallelToolCalls = isNativeProtocol ? (metadata?.parallelToolCalls ?? false) : false
```

This ensures XML-mode tasks never send native tool parameters.

## Verification

- All 11 CI checks pass
- Discord user tested with GLM 5.0, Sonnet 4.5, and Minimax 2.5
- Flaky test failure reported by author is unrelated (known issue)

## Lessons Learned

- Provider message pipelines need to be careful about where transforms happen -- rebuilding from raw messages can lose important mutations
- Model cache self-healing is a good pattern for handling schema evolution (v5.7.0 cache entries with missing fields)
- The `kilocode_change` markers are used correctly and consistently throughout

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
