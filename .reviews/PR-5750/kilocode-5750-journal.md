<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5750
title: "Fix: Kimi K2.5 tool calls in thinking mode (#5748)"
author: Githubguy132010
category: fix
tier: 3
lines: 166
files: 3
review_number: 30
fork_pr: null
-->

# Review Journal: kilocode #5750

> **PR**: [#5750](https://github.com/Kilo-Org/kilocode/pull/5750) |
> **Author**: @Githubguy132010 | **Size**: 166 lines, 3 files | **Confidence**: 4/5

## Summary

Attempts to detect and extract Kimi K2.5 tool calls embedded in reasoning text. The parser uses regex against individual stream deltas, but SSE streaming fragments text across chunks, so the markers will never all appear in a single delta. The approach needs to be redesigned around a stateful accumulator. REQUEST_CHANGES.

## First Impressions

The linked issue (#5748) is well-described with a concrete trace showing tool call markers appearing as thinking text. The problem is real. The fix creates a new parser module and integrates it into the OpenRouter handler. Three files changed, 162+/4-.

## What I Looked At

- `src/core/assistant-message/KimiToolCallParser.ts` (new, 116 lines)
- `src/api/providers/openrouter.ts` (integration, 41+ lines)
- `src/core/assistant-message/NativeToolCallParser.ts` (reference for accumulator pattern)
- `src/api/transform/stream.ts` (ApiStreamChunk types)
- Issue #5748 (the problem report with example trace)
- The streaming loop structure in openrouter.ts

## Analysis

### The streaming fragmentation problem

The OpenRouter handler uses `for await (const chunk of stream)` to iterate over SSE chunks. Each `delta.reasoning` is a small text fragment. The PR adds this check:

```typescript
if (hasKimiToolCalls(delta.reasoning)) {
```

`hasKimiToolCalls` requires THREE markers in the SAME string. In SSE streaming, these markers arrive across separate chunks:

- Chunk N: `"...Let me fix these: <|tool_calls_section_begin|>"`
- Chunk N+1: `" <|tool_call_begin|>"`
- Chunk N+2: `" functions.edit:31"`
- Chunk N+3: `" <|tool_call_argument_begin|>"`
- Chunk N+4: `" {\"filePath\": \"..."`
- ...more chunks...
- Chunk N+M: `"<|tool_calls_section_end|>"`

The `hasKimiToolCalls` check will return false for every individual chunk, so the tool calls will never be detected. They'll pass through the normal reasoning path and display as text -- exactly the bug this PR tries to fix.

### What the fix should do

The codebase already has a pattern for this: `NativeToolCallParser` maintains static state (`streamingToolCalls`, `rawChunkTracker`) to accumulate partial data across chunks. The Kimi parser should similarly:

1. Accumulate reasoning text into a buffer
2. Watch for the `<|tool_calls_section_begin|>` marker
3. Once detected, stop yielding reasoning text and start buffering
4. When `<|tool_calls_section_end|>` arrives, parse the complete buffered section
5. Emit tool_call_partial chunks from the complete buffer

### The nested JSON regex problem

The argument-matching regex uses `\{[\s\S]*?\}` (non-greedy). For arguments like `{"filePath": "test.ts", "content": {"key": "value"}}`, this would match `{"filePath": "test.ts", "content": {"key": "value"}` (stopping at the first `}` after the minimum match). A balanced-brace parser would be more robust.

### Typo: `kimToolCallsToStreamChunks`

Missing the `i` in "Kimi". Both the export and import have the same typo, so it compiles, but it's inconsistent with `parseKimiToolCalls` and `hasKimiToolCalls`.

### `Date.now()` in IDs

Tool call IDs use `kimicall_${++toolCallCounter}_${Date.now()}`. This makes the function non-deterministic, which complicates unit testing. A counter or content-based hash would be better.

## Verification

- All CI checks pass (the parser compiles and no existing tests exercise the new code path)
- No tests for the new parser module
- The CI pass is not meaningful evidence of correctness here -- the code compiles but won't work at runtime due to the streaming issue

## Lessons Learned

When reviewing streaming-related fixes, always trace the data flow at the chunk level. The key question is: "Does this code see individual fragments or complete blocks?" Static regex parsing against streaming fragments is a common antipattern. The codebase's `NativeToolCallParser` with its accumulator pattern is the right reference implementation.

---

<sub>Review #30 of 75 | [Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md) | Reviewed with Claude Code</sub>
