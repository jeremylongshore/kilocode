<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5267
title: "fix: preserve extra_content for Gemini 3 thought_signature support"
author: maywzh
category: fix
tier: 3
lines: 154
files: 7
review_number: 27
-->

# Review Journal: kilocode #5267

> **PR**: [#5267](https://github.com/Kilo-Org/kilocode/pull/5267) |
> **Title**: fix: preserve extra_content for Gemini 3 thought_signature support |
> **Author**: @maywzh |
> **Category**: fix | **Tier**: 3 | **Size**: 154 lines, 7 files

---

## Summary

PR adds `extra_content` field plumbing across the tool call pipeline to preserve Gemini 3's `thought_signature` metadata during multi-turn conversations. The concept is correct and the interfaces are properly optional/backward-compatible. However, the OpenRouter provider (the stated primary use case) is missing from the actual diff, no tests are included, and the PR has merge conflicts. REQUEST_CHANGES.

## First Impressions

Title and description clearly explain the problem: Gemini 3 models send `extra_content` with `thought_signature` in tool call responses, and this metadata was being lost. The fix needs to thread this data through the streaming pipeline, parser, Task handler, and back into the message format converter. Seven files across three layers is the expected blast radius for this kind of passthrough change.

The PR was opened Jan 21, 2026 -- nearly a month old. Given the high rate of churn in files like `NativeToolCallParser.ts` and `Task.ts`, staleness was a concern going in.

## What I Looked At

**Files in the diff (7):**
- `.changeset/gemini-extra-content.md` -- patch changeset
- `src/api/providers/openai.ts` -- `processToolCalls` generator
- `src/api/transform/openai-format.ts` -- `convertToOpenAiMessages`
- `src/api/transform/stream.ts` -- streaming interface types
- `src/core/assistant-message/NativeToolCallParser.ts` -- raw chunk tracking + streaming state
- `src/core/task/Task.ts` -- tool call event handling in the agent loop
- `src/shared/tools.ts` -- `ToolUse` and `McpToolUse` interfaces

**Baseline files on main:**
- `src/api/providers/openrouter.ts` -- to verify the gap (lines 602-610)
- `src/core/assistant-message/__tests__/NativeToolCallParser.spec.ts` -- to assess test coverage expectations

**Also checked:**
- PR mergeable state (CONFLICTING)
- CI status (no checks reported -- branch not rebased)
- Issue context (no linked issue)

## Analysis

### The Good

The approach of adding an optional `extra_content?: Record<string, unknown>` field is the right design. It's:
- Backward-compatible (optional everywhere)
- Provider-agnostic (doesn't encode Gemini-specific semantics in the type)
- Well-documented with JSDoc comments explaining what it's for

The plumbing through the streaming lifecycle is comprehensive within the files it touches:
1. Provider yields `extra_content` in `tool_call_partial` chunks
2. `NativeToolCallParser.processRawChunk` captures it in `rawChunkTracker`
3. `NativeToolCallParser.startStreamingToolCall` stores it
4. `NativeToolCallParser.finalizeStreamingToolCall` includes it in the final tool call
5. `NativeToolCallParser.parseToolCall` attaches it to `ToolUse`/`McpToolUse`
6. `Task.ts` preserves it through partial -> final tool use transitions
7. `openai-format.ts` includes it when converting back to OpenAI message format

### The Gap: OpenRouter

The PR description explicitly lists `src/api/providers/openrouter.ts` as a changed file with the note "Extract and preserve `extra_content`." But it's not in the diff.

Looking at the current OpenRouter provider on main (lines 602-610), the `tool_call_partial` yield does NOT include `extra_content`. Since the PR's stated test scenario is "Manual testing with Gemini 3 models via OpenRouter," this is a critical omission. The entire downstream plumbing is useless if the originating provider doesn't emit the field.

The OpenAI provider IS updated, which covers direct OpenAI-compatible API usage, but OpenRouter is a separate class (`OpenRouterHandler extends BaseProvider`, not `extends OpenAiHandler`) with its own streaming implementation.

### Type Safety

The PR uses `as any` casts in several places:
- `(toolCall as any).extra_content` in `openai.ts` -- the OpenAI SDK types don't include `extra_content`
- `toolMessage as any` in `openai-format.ts` -- Anthropic's `ToolUseBlockParam` type doesn't include it
- `const toolUseBlock: any` in `Task.ts` -- to build blocks with `extra_content`

These are understandable since the upstream SDK types don't include provider-specific extensions. A dedicated interface extending the SDK types would be cleaner and more maintainable.

### Missing Tests

The existing `NativeToolCallParser.spec.ts` has thorough test coverage for tool call parsing. This PR adds significant new behavior to the parser without any corresponding tests. Key test cases that should exist:
- `processRawChunk` should preserve `extra_content` across chunks
- `startStreamingToolCall` with `extra_content` -> `finalizeStreamingToolCall` round-trips it
- `parseToolCall` includes `extra_content` on the result when present
- `parseDynamicMcpTool` includes `extra_content` on McpToolUse

### Missing kilocode_change Markers

Per fork conventions, all changes in shared upstream code need markers. None of the changes in this PR include them.

## Verification

- **CI**: No checks reported -- the branch has not been rebased against current main.
- **Merge state**: CONFLICTING. The PR cannot be merged as-is.
- **Local testing**: Not attempted (no code to test without rebase).
- **Manual testing**: Author claims manual testing with Gemini 3 via OpenRouter, but the OpenRouter provider isn't actually updated in the diff.

## Lessons Learned

1. **Always diff-check the file list against the description.** The PR body listed 7 files including `openrouter.ts`, but only 7 different files were in the diff (changeset replaced openrouter). Catching the description/diff mismatch revealed the most critical issue.

2. **Provider inheritance matters.** OpenRouter does NOT extend OpenAI's handler in this codebase -- they have independent streaming implementations. A fix to `openai.ts` does NOT automatically propagate to `openrouter.ts`. Always verify the class hierarchy.

3. **Stale PRs (25+ days) in fast-moving areas almost always have merge conflicts.** NativeToolCallParser and Task.ts are high-churn files. Flagging merge state early saves review time.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md) | Reviewed with Claude Code</sub>
