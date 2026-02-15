<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5750
title: "Fix: Kimi K2.5 tool calls in thinking mode (#5748)"
author: Githubguy132010
category: fix
tier: 3
lines: 166
files: 3
verdict: COMMENT
confidence: 4
reviewed_at: 2026-02-14
linked_issue: 5748
fork_pr: https://github.com/jeremylongshore/kilocode/pull/19
-->

# Review: kilocode #5750

> **Fix: Kimi K2.5 tool calls in thinking mode (#5748)** by @Githubguy132010
> Multi-AI analysis: Fork PR #19 — reviewed by CodeRabbit, Gemini, Qodo

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | WARN | Regex for nested JSON arguments could fail — see findings |
| Conventions | PASS | Uses `// kilocode_change` markers, follows project patterns |
| Changeset | PASS | Patch changeset included |
| Tests | WARN | No tests for new `KimiToolCallParser.ts` — parser logic needs coverage |
| i18n | N/A | No user-facing strings |
| Types | PASS | Proper TypeScript types, clean imports |
| Security | PASS | No security implications |
| Scope | PASS | Focused on Kimi K2.5 tool call extraction |

## Findings

### YELLOW: Regex may fail on nested JSON arguments

`KimiToolCallParser.ts:48` — The argument extraction regex uses:
```regex
\{[\s\S]*?\}
```

This lazy match on `}` will fail on nested JSON objects. For example:
```json
{"filePath": "/src/index.ts", "content": {"key": "value"}}
```
Would match only `{"filePath": "/src/index.ts", "content": {"key": "value"}` — cutting off at the first `}`.

The tool call argument end marker `<|tool_call_argument_end|>` could be used as the boundary instead:
```regex
<\|tool_call_begin\|>\s*(.+?)\s*<\|tool_call_argument_begin\|>\s*([\s\S]*?)\s*<\|tool_call_end\|>
```
This would capture everything between the markers regardless of JSON structure.

### YELLOW: No tests for the new parser

`KimiToolCallParser.ts` adds 116 lines of regex-based parsing logic with no test coverage. For a parser that handles model-specific output formats, tests would catch edge cases like:
- Nested JSON arguments
- Multiple tool calls in one section
- Malformed markers
- Empty arguments

### GRAY: Typo in function name

`KimiToolCallParser.ts:90` — `kimToolCallsToStreamChunks` is missing the 'i' in "Kimi". Should be `kimiToolCallsToStreamChunks`. Minor but worth cleaning up since it's a public export.

### GRAY: Duplicated logic in openrouter.ts

The Kimi detection + parsing + yielding logic is duplicated for `delta.reasoning` and `delta.reasoning_content`. Could be extracted into a helper function to reduce duplication.

### GRAY: Non-deterministic IDs

`KimiToolCallParser.ts:62` — `Date.now()` in tool call IDs makes them non-deterministic. Consider using a counter-only approach if reproducibility matters for testing or caching.

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

## Local Verification

We merged this PR on our fork and ran the full test suite.

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | PASS | 22/22 packages |
| Lint | `pnpm lint` | PASS | 18/18 packages |
| Unit Tests | `pnpm test` | PASS | 12,920 passed, 194 skipped, 0 new failures |

*Pre-existing failures (not from this PR): `@kilocode/agent-runtime` 3 applyEdit tests, `@kilocode/core-schemas` no test files.

> Tested on fork branch [`review/PR-5750`](https://github.com/jeremylongshore/kilocode/tree/review/PR-5750) | Evidence: `test-evidence-PR-5750.log` (6,375 lines)

## Code Snippets

### Core parser pattern:
```typescript
// KimiToolCallParser.ts — extracts tool calls from Kimi's special markers
const toolCallBlockRegex = /<\|tool_calls_section_begin\|>([\s\S]*?)<\|tool_calls_section_end\|>/g
const toolCallRegex = /<\|tool_call_begin\|>\s*(.+?)\s*<\|tool_call_argument_begin\|>\s*(\{[\s\S]*?\})\s*<\|tool_call_end\|>/g
```

### Integration in openrouter.ts:
```typescript
if (hasKimiToolCalls(delta.reasoning)) {
    const { cleanedText, toolCalls } = parseKimiToolCalls(delta.reasoning)
    if (cleanedText.length > 0) {
        yield { type: "reasoning", text: cleanedText }
    }
    const toolChunks = kimToolCallsToStreamChunks(toolCalls)
    for (const chunk of toolChunks) {
        yield chunk
    }
}
```

## Verdict

**COMMENT** — The approach is sound and addresses a real issue (confirmed by multiple users across providers). The parser correctly handles the Kimi-specific marker format and integrates cleanly with the existing streaming pipeline. However, two concerns prevent a clean APPROVE: (1) the JSON argument regex may break on nested objects, and (2) 116 lines of regex parsing with no test coverage is risky for a production parser. Recommend adding tests and fixing the regex boundary.
