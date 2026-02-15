<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5750
title: "Fix: Kimi K2.5 tool calls in thinking mode (#5748)"
author: Githubguy132010
category: fix
tier: 3
lines: 166
files: 3
review_number: 24
fork_pr: https://github.com/jeremylongshore/kilocode/pull/19
-->

# Review Journal: kilocode #5750

> **PR**: [#5750](https://github.com/Kilo-Org/kilocode/pull/5750) |
> **Title**: Fix: Kimi K2.5 tool calls in thinking mode (#5748) |
> **Author**: @Githubguy132010 |
> **Category**: fix | **Tier**: 3 | **Size**: 166 lines, 3 files

---

## Summary

Kimi K2.5 embeds tool calls inside reasoning/thinking text using special markers (`<|tool_calls_section_begin|>`, etc.). This PR adds a dedicated parser to detect, extract, and convert these into proper API stream chunks. The approach is correct but the JSON argument regex could fail on nested objects, and there are no tests for the new 116-line parser.

## First Impressions

"Kimi K2.5 tool calls in thinking mode" — immediately signals this is a model-specific compatibility fix. The linked issue #5748 confirms multiple users are hitting this across different providers (OpenRouter, Chutes.ai, NanoGPT). The fix adds a new parser file rather than patching existing logic, which is clean separation.

## What I Looked At

- `src/core/assistant-message/KimiToolCallParser.ts` — New parser (116 lines)
- `src/api/providers/openrouter.ts` — Integration into the streaming pipeline
- `.changeset/four-cycles-turn.md` — Patch changeset
- Upstream comments from @chrarnoldus, @Githubguy132010, @jnkb confirming the bug across providers
- Upstream CI (11/11 green)
- kiloconnect review (not available for this PR)

## Analysis

### The Bug

Kimi K2.5 produces tool calls embedded in `delta.reasoning` or `delta.reasoning_content` with special markers:
```
<|tool_calls_section_begin|>
<|tool_call_begin|> functions.edit:31
<|tool_call_argument_begin|> {"filePath": "..."}
<|tool_call_end|>
<|tool_calls_section_end|>
```

These never get parsed into tool calls because the existing streaming pipeline treats them as plain reasoning text. Users see the tool call markers in the thinking output but the tools never execute.

### The Fix

1. **`hasKimiToolCalls(text)`** — Quick detection: checks for three marker strings
2. **`parseKimiToolCalls(text)`** — Regex extraction: pulls tool calls from sections, cleans markers from text
3. **`kimToolCallsToStreamChunks(toolCalls)`** — Converts to `tool_call_partial` stream chunks
4. **`openrouter.ts`** — Checks for Kimi markers before normal reasoning handling

### Concern: Regex boundary for JSON arguments

The inner regex uses `\{[\s\S]*?\}` to match JSON arguments. This lazy match stops at the first `}` — which breaks on nested objects like `{"path": "/x", "options": {"verbose": true}}`.

The tool call markers provide natural boundaries (`<|tool_call_argument_begin|>` to `<|tool_call_end|>`). Using marker-to-marker matching instead of JSON pattern matching would be more robust:
```regex
<\|tool_call_argument_begin\|>\s*([\s\S]*?)\s*<\|tool_call_end\|>
```

### Concern: No test coverage

116 lines of regex-based parsing with no tests. The patterns are straightforward for simple cases but edge cases (nested JSON, multiple tool calls, malformed markers) need coverage.

## Verification

### Upstream CI
All 11 checks pass — compile, test-extension, test-cli, test-webview, etc.

### Local Testing
Merged on fork branch `review/PR-5750`, ran full suite — no new failures.

### What We Couldn't Verify
- Actual Kimi K2.5 tool call output (requires API access and credits)
- Behavior with nested JSON arguments (no test cases)

## Bot Review Synthesis

| Bot | Verdict | Key Finding | Useful? |
|-----|---------|-------------|---------|
| kiloconnect (upstream) | N/A | No review available | N/A |
| changeset-bot | INFO | Changeset detected | Yes |
| Community | SUPPORT | Multiple users confirm bug across providers | Yes |

## Diagrams

```
Kimi K2.5 Streaming Pipeline (Before vs After)
────────────────────────────────────────────────

BEFORE:
  delta.reasoning: "<|tool_calls_section_begin|>..."
       │
       ▼
  yield { type: "reasoning", text: "..." }  ← Raw markers shown to user
       │
       ▼
  Tool calls LOST — never executed

AFTER:
  delta.reasoning: "<|tool_calls_section_begin|>..."
       │
       ▼
  hasKimiToolCalls() → true
       │
       ▼
  parseKimiToolCalls()
       ├── cleanedText → yield { type: "reasoning" }
       └── toolCalls   → kimToolCallsToStreamChunks()
                              │
                              ▼
                         yield { type: "tool_call_partial" }
                              │
                              ▼
                         Tool calls EXECUTE
```

## Lessons Learned

1. **Model-specific parsers are inevitable** — Different providers embed structured data in different formats. The parser-per-model pattern is a pragmatic approach when you can't control the model output format.
2. **Use marker boundaries, not content patterns** — When special markers delimit content, match marker-to-marker rather than trying to parse the content structure. The markers are reliable; the content (JSON) can have arbitrary nesting.
3. **Community confirmation is strong signal** — Three users confirming the same bug across different providers (OpenRouter, Chutes.ai, NanoGPT) validates both the problem and the fix approach.
4. **Tests for parsers are non-negotiable** — Regex-based parsers are fragile. Without tests, the first edge case in production becomes a regression.

---

<sub>Review #24 | Multi-AI analysis: Fork PR #19 | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code + 5 AI reviewers</sub>
