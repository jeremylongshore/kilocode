<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5831
title: "Fix ZenMux model metadata and native tool message handling"
author: Neonsy
category: fix
tier: 5
lines: 387
files: 9
review_number: 45
fork_pr: none
-->

# Review Journal: kilocode #5831

> **PR**: [#5831](https://github.com/Kilo-Org/kilocode/pull/5831) |
> **Title**: Fix ZenMux model metadata and native tool message handling |
> **Author**: @Neonsy |
> **Category**: fix | **Tier**: 5 | **Size**: 387 lines, 9 files

---

## Summary

ZenMux provider had two compounding bugs: (1) `contextWindow` was persisted as 0 in the model cache, causing the extension to think every prompt exceeded the context window and triggering repeated context-condensing loops; (2) native tool metadata (`supportsNativeTools`, `defaultToolProtocol`) was missing from model info, causing tool calls to silently fail and triggering "tool not used" retry loops. This PR fixes both with fetcher hardening, cache self-healing, and a refactored message pipeline that preserves model-specific transforms.

## First Impressions

The PR description is exceptionally detailed -- two commits described separately, clear "how to test" section, Discord link to the original reporter, and a note that the implementation was AI-assisted. At 387 lines across 9 files with 288 lines of tests, the ratio is healthy. The author (@Neonsy) is a returning contributor who clearly understands the ZenMux provider internals.

## What I Looked At

- `packages/types/src/providers/zenmux.ts` -- Default model info additions
- `src/api/providers/zenmux.ts` -- Main handler changes (message pipeline, tool gating)
- `src/api/providers/fetchers/zenmux.ts` -- Fetcher hardening (context_length, display_name, modalities)
- `src/api/providers/fetchers/modelCache.ts` -- Stale cache self-healing
- `src/api/providers/__tests__/zenmux-native-tools.spec.ts` -- New test file (175 lines)
- `src/api/providers/fetchers/__tests__/zenmux.spec.ts` -- New fetcher tests (70 lines)
- `src/api/providers/fetchers/__tests__/modelCache.spec.ts` -- Extended cache tests (43 lines)
- `src/utils/resolveToolProtocol.ts` -- Existing function, already supports `lockedProtocol`
- `packages/types/src/tool.ts` -- `NATIVE_TOOL_DEFAULTS` constant
- Upstream CI (11/11 green)

## Analysis

### Bug 1: contextWindow = 0

The ZenMux API returns `context_length` in its model payload, but the old fetcher never mapped it. Every model was stored with `contextWindow: 0`. Downstream, the extension's context management logic would see a 0-token window and immediately trigger context condensing, even on the first message. This created a degraded experience where every conversation started with unnecessary condensing.

**Fix approach**: Three layers of defense:
1. **Fetcher**: Map `context_length` from the API response; fall back to `zenmuxDefaultModelInfo.contextWindow` (200k) if missing
2. **Memory cache**: Check for `contextWindow <= 0` before returning cached models
3. **Disk cache**: Same check after Zod validation of disk-persisted cache

The multi-layer approach handles: fresh fetches (layer 1), hot restarts where memory cache is populated from a stale fetch (layer 2), and cold starts loading from disk (layer 3).

### Bug 2: Missing native tool metadata

ZenMux models were missing `supportsNativeTools` and `defaultToolProtocol` in their `ModelInfo`. The extension's tool protocol resolution would fall back to native (since XML is deprecated), but the actual tool parameters were never being passed through to the OpenAI API call. This caused:
1. Models that support native tools received no tool definitions
2. The agent would ask the model to use tools, the model would try, but no tool schema was present
3. The model's response wouldn't contain tool calls
4. The extension would detect "tool not used" and retry -- creating an infinite loop

**Fix approach**: Four changes:
1. Add `supportsNativeTools: true` and `defaultToolProtocol: "native"` to `zenmuxDefaultModelInfo`
2. Set these fields in the fetcher for every model
3. Spread `NATIVE_TOOL_DEFAULTS` in `getModel()` to self-heal stale cache entries
4. Pass `metadata?.toolProtocol` to `resolveToolProtocol()` to respect task-locked protocols
5. Gate tool parameters on `isNativeProtocol` to avoid sending tools during XML protocol tasks

### Stream creation refactor

The most subtle change: `createZenMuxStream` was accepting raw `(systemPrompt, Anthropic.Messages.MessageParam[])` and internally converting to OpenAI format. But `createMessage()` was *already* doing this conversion (including special handling for DeepSeek R1's user-role-only format and Gemini's reasoning_details injection). The stream creator was then re-converting from scratch, discarding all the model-specific transforms.

The fix changes the signature to accept pre-transformed `OpenAI.Chat.ChatCompletionMessageParam[]`, so the DeepSeek R1 format, Gemini cache breakpoints, and fake reasoning_details blocks are all preserved.

### Test quality

The tests are well-structured:
- **Cache tests**: Verify stale entries with `contextWindow: 0` are rejected, valid entries are accepted
- **Fetcher tests**: Verify `context_length` mapping, fallback behavior, native tool defaults
- **Native tool tests**: Verify tool gating for native vs XML protocols, DeepSeek R1 message passthrough, metadata merge for stale cache entries

The tests mock at the right level -- `createZenMuxStream` spy to verify what gets passed through, `fetchModel` mock for model info, `vi.stubGlobal("fetch")` for API responses.

## Diagrams

```
ZenMux Tool Call Flow (Before vs After)
----------------------------------------

BEFORE:
  getModel() -> { supportsNativeTools: undefined }
       |
       v
  resolveToolProtocol(options, model.info)  <- no lockedProtocol
       |
       v
  isNativeProtocol = true  (XML deprecated)
       |
       v
  createZenMuxStream(client, systemPrompt, rawMessages, ..., metadata?.tools)
       |                          |
       |    +---------------------+
       |    v
       |  Re-converts messages (DISCARDS R1/Gemini transforms)
       |
       v
  OpenAI API call  <- tools present but toolChoice never set
       |
       v
  Model response without tool calls
       |
       v
  "Tool not used" -> RETRY LOOP

AFTER:
  getModel() -> { ...NATIVE_TOOL_DEFAULTS, ...cachedInfo }
       |
       v
  resolveToolProtocol(options, model.info, metadata?.toolProtocol)
       |
       v
  isNativeProtocol = true/false  (respects task lock)
       |
       +-- tools = isNativeProtocol ? metadata?.tools : undefined
       +-- toolChoice = isNativeProtocol ? metadata?.tool_choice : undefined
       +-- parallelToolCalls = isNativeProtocol ? ... : false
       |
       v
  createZenMuxStream(client, openAiMessages, ..., tools, toolChoice, parallelToolCalls)
       |                          |
       |    +---------------------+
       |    v
       |  Uses PRE-TRANSFORMED messages (R1/Gemini intact)
       |
       v
  OpenAI API call  <- tools + tool_choice + parallel_tool_calls
       |
       v
  Model response WITH tool calls
       |
       v
  Tools EXECUTE correctly
```

## Bot Review Synthesis

| Bot | Status | Key Finding | Useful? |
|-----|--------|-------------|---------|
| CodeRabbit | Not collected | Batch review — no individual fork PR | N/A |
| Gemini | Not collected | Batch review — no individual fork PR | N/A |
| Greptile | Not collected | Batch review — no individual fork PR | N/A |
| CodeQL | Not collected | Batch review — no individual fork PR | N/A |
| Qodo | Not collected | Batch review — no individual fork PR | N/A |

## Lessons Learned

1. **Model metadata must be fully populated at fetch time** -- When a provider returns partial metadata (no `context_length`), the fetcher must apply defaults immediately rather than hoping downstream code handles zeros. A `contextWindow: 0` cascaded into context-condensing loops that looked like a totally unrelated bug.

2. **Never re-convert messages in nested call sites** -- The `createZenMuxStream` was independently converting messages that `createMessage` had already transformed. This is the classic "transform once, use everywhere" principle. When the transform includes model-specific logic (R1 format, Gemini reasoning), reconverting loses those customizations.

3. **Cache self-healing is a pragmatic migration strategy** -- Rather than requiring users to manually clear caches after an upgrade, the code detects invalid entries and transparently re-fetches. Three layers (fetcher, memory cache, disk cache) ensure no stale data survives regardless of how the cache was populated.

4. **Gate tool parameters on protocol, not just model capability** -- A model can support native tools but the current *task* might be locked to XML protocol (resumed from before the XML deprecation). Tool parameters must be gated on the resolved protocol, not just the model's capability flags.

---

<sub>Review #45 | Upstream CI: 11/11 green | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
