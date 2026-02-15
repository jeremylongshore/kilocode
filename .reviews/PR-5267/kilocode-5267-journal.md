<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5267
title: "fix: preserve extra_content for Gemini 3 thought_signature support"
author: maywzh
category: fix
tier: 3
lines: 154
files: 7
review_number: 35
fork_pr: N/A (batch review)
-->

# Review Journal: kilocode #5267

> **PR**: [#5267](https://github.com/Kilo-Org/kilocode/pull/5267) |
> **Title**: fix: preserve extra_content for Gemini 3 thought_signature support |
> **Author**: @maywzh |
> **Category**: fix | **Tier**: 3 | **Size**: 154 lines, 7 files | **Confidence**: 4/5

---

## Summary

Threads `extra_content` (Gemini 3's `thought_signature`) through the entire tool call streaming pipeline — from API response through parsing, format conversion, and back into subsequent requests. Sound architecture, but `as any` casts and no tests prevent APPROVE. COMMENT.

## First Impressions

Gemini 3 includes `extra_content` with `thought_signature` in tool call responses. Without preserving this through multi-turn conversations, the model may lose coherence. This is a metadata passthrough problem — the data should survive without being parsed or modified.

## What I Looked At

- All 7 changed files, tracing the `extra_content` flow end-to-end
- `shared/tools.ts` — interface definitions for `ToolUse` and `McpToolUse`
- `stream.ts` — streaming chunk interfaces
- `NativeToolCallParser.ts` — streaming lifecycle management
- `Task.ts` — tool call event handling in the main agent loop
- `openai.ts` and `openai-format.ts` — extraction and format conversion
- Existing patterns for similar passthrough fields (e.g., `reasoning_details`)

## Analysis

The data flow is:

1. **Extraction** (`openai.ts`): `(toolCall as any).extra_content` pulled from OpenAI-format chunks
2. **Streaming** (`NativeToolCallParser.ts`): Tracked per-tool-call in `rawChunkTracker` and `streamingToolCalls` maps
3. **Parsing** (`NativeToolCallParser.ts`): Carried through to final `ToolUse`/`McpToolUse` objects
4. **Format conversion** (`openai-format.ts`): Re-injected when converting internal format back to OpenAI format for API calls
5. **Task loop** (`Task.ts`): Preserved during partial → final tool use transitions

This covers all the necessary touch points. The optional typing (`extra_content?: Record<string, unknown>`) ensures backward compatibility.

**Concern**: The `as any` casts at extraction and re-injection points are a code smell. The PR adds `extra_content` to the internal types but then uses `as any` to access them, suggesting the types aren't flowing through the import chain correctly.

**Missing**: No test coverage. The streaming pipeline is critical infrastructure — a single regression here could break tool calls for all providers.

## Verification

| What | Result |
|------|--------|
| Mergeable | CONFLICTING — needs rebase |
| Changeset | Present (patch) |
| Tests | None added |
| Local test | Skipped (CONFLICTING, can't cherry-pick cleanly) |

## Bot Review Synthesis

| Bot | Status | Key Finding | Useful? |
|-----|--------|-------------|---------|
| CodeRabbit | Not collected | Batch review — no individual fork PR | N/A |
| Gemini | Not collected | Batch review — no individual fork PR | N/A |
| Greptile | Not collected | Batch review — no individual fork PR | N/A |
| CodeQL | Not collected | Batch review — no individual fork PR | N/A |
| Qodo | Not collected | Batch review — no individual fork PR | N/A |

## Lessons Learned

- `as any` casts to extend third-party types should be centralized — scattered casts are fragile and invisible to type checking
- Opaque metadata passthrough (like `extra_content`) touches many layers — follow the data flow end-to-end before reviewing
- CONFLICTING PRs touching high-churn files (Task.ts, openai.ts) will need rebasing — factor that into verdict timing

---

<sub>Review #35 of 75 | Reviewed with Claude Code</sub>
