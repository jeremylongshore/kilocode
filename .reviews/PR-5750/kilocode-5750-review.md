<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5750
title: "Fix: Kimi K2.5 tool calls in thinking mode (#5748)"
author: Githubguy132010
category: fix
tier: 3
lines: 166
files: 3
confidence: 4
verdict: REQUEST_CHANGES
reviewed_at: 2026-02-15
-->

## Review Summary

| Aspect | Assessment |
|--------|------------|
| **Verdict** | REQUEST_CHANGES |
| **Confidence** | 4/5 |
| **Blocking Issues** | 2 |
| **Minor Issues** | 2 |

## What Changed

Adds a `KimiToolCallParser` module that uses regex to detect and extract tool calls from Kimi K2.5's thinking text (markers like `<|tool_calls_section_begin|>`, `<|tool_call_begin|>`, etc.). Integrates into the OpenRouter handler's streaming loop to intercept reasoning deltas containing these markers.

Fixes #5748 where Kimi K2.5 embeds tool calls inside reasoning/thinking blocks and Kilo Code displays them as text instead of executing them.

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | FAIL | Streaming fragmentation problem (see below) |
| Conventions | PASS | `kilocode_change` markers present, TypeScript types clean |
| Changeset | PASS | `four-cycles-turn.md`, `patch` level |
| Tests | FAIL | No test file for KimiToolCallParser |
| i18n | N/A | No UI strings |
| Types | PASS | Uses existing `ApiStreamChunk` type |
| Security | N/A | |
| Scope | PASS | Focused on one provider quirk |

## Blockers

### 1. Streaming fragmentation will prevent detection (red)

**File**: `src/api/providers/openrouter.ts` (line ~593 in diff)

The `hasKimiToolCalls()` check runs against each individual `delta.reasoning` chunk in the streaming loop. In SSE streaming, each delta contains a small text fragment (typically a few tokens). The function requires ALL THREE markers to be present in a single delta:

```typescript
export function hasKimiToolCalls(text: string): boolean {
    return (
        text.includes("<|tool_calls_section_begin|>") &&
        text.includes("<|tool_call_begin|>") &&
        text.includes("<|tool_call_argument_begin|>")
    )
}
```

In practice, `<|tool_calls_section_begin|>` will arrive in one chunk, then `<|tool_call_begin|>` in a later chunk, then arguments across many chunks. The condition will never be true during streaming. The regex in `parseKimiToolCalls` has the same problem -- it expects the full `<|tool_calls_section_begin|>...<|tool_calls_section_end|>` block in a single string.

**Fix needed**: The parser must be stateful, accumulating reasoning text across chunks and detecting markers progressively. See `NativeToolCallParser` for the accumulator pattern already used in the codebase.

### 2. No tests (red)

**File**: `src/core/assistant-message/KimiToolCallParser.ts`

No test file exists for the parser. Given the regex complexity (nested patterns, orphaned marker cleanup, multi-tool-call sections), unit tests are essential. The parser handles structured data extraction and should be tested with:
- Single tool call in section
- Multiple tool calls in one section
- Malformed/partial markers
- Arguments containing special regex characters (e.g., JSON with nested braces)
- The `{[\s\S]*?}` pattern for arguments is non-greedy and will fail on nested JSON objects (e.g., `{"key": {"nested": true}}` would match `{"key": {"nested": true}` and stop)

## Minor Issues

### 3. Typo in function name (yellow)

**File**: `src/core/assistant-message/KimiToolCallParser.ts`, line 93

```typescript
export function kimToolCallsToStreamChunks(toolCalls: ToolCallData[]): ApiStreamChunk[]
//              ^^^ missing 'i' - should be kimiToolCallsToStreamChunks
```

The import in `openrouter.ts` also uses the typo, so it compiles, but this will be confusing for anyone reading the code.

### 4. `Date.now()` in tool call IDs (yellow)

**File**: `src/core/assistant-message/KimiToolCallParser.ts`, line 60

```typescript
const id = `kimicall_${++toolCallCounter}_${Date.now()}`
```

Using `Date.now()` in IDs makes them non-deterministic, complicating both testing and debugging. A counter alone would suffice, or use a hash of the tool call content.

## CI Status

| Check | Result |
|-------|--------|
| compile | PASS |
| test-extension (ubuntu) | PASS |
| test-extension (windows) | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| test-cli | PASS |
| build-cli | PASS |
| check-translations | PASS |
| test-jetbrains | PASS |

## Verdict

REQUEST_CHANGES. The core approach of checking individual streaming deltas for complete tool call sections will not work in practice because SSE streaming fragments the text across many chunks. The parser needs to accumulate text across deltas before attempting extraction, following the accumulator pattern already established by `NativeToolCallParser`. Additionally, the parser has no tests and the argument-matching regex will fail on nested JSON.

---
