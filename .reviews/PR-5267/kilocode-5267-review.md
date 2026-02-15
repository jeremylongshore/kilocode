<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5267
title: "fix: preserve extra_content for Gemini 3 thought_signature support"
author: maywzh
category: fix
tier: 3
lines: 154
files: 7
verdict: REQUEST_CHANGES
confidence: 0.85
reviewed_at: 2026-02-15
-->

# Review: kilocode #5267

> **fix: preserve extra_content for Gemini 3 thought_signature support** by @maywzh

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | yellow | OpenRouter provider not updated despite being the stated use case |
| Conventions | yellow | Heavy use of `as any` casts; no `kilocode_change` markers |
| Changeset | pass | Patch changeset present |
| Tests | fail | No tests added for any of the new code paths |
| i18n | n/a | No UI strings |
| Types | yellow | `Record<string, unknown>` is fine but `as any` casts undermine safety |
| Security | pass | Passthrough of opaque metadata; no user input injection risk |
| Scope | pass | Focused on extra_content plumbing across 7 files |

## Findings

1. **red** `src/api/providers/openrouter.ts` (missing from diff)
   PR description claims OpenRouter changes, but the diff does not touch `openrouter.ts`. Lines 602-610 of the current OpenRouter provider emit `tool_call_partial` without `extra_content`. Since the stated use case is "Gemini 3 via OpenRouter," this is the primary path that needs the fix, and it is missing.

2. **red** No test coverage
   Seven files changed across the streaming pipeline, NativeToolCallParser, and Task.ts, with zero tests added. The existing `NativeToolCallParser.spec.ts` has comprehensive tests for other tool call features. At minimum: a test for `processRawChunk` preserving `extra_content`, a test for `startStreamingToolCall` with `extra_content`, and a test for `finalizeStreamingToolCall` round-tripping `extra_content`.

3. **yellow** `src/core/task/Task.ts` lines 3760, 3795 -- `as any` type escape
   The `toolUseBlock` variables are declared as `any` to attach `extra_content`. A cleaner approach would be to extend the existing type inline or use a proper intersection type, keeping the type checker engaged.

4. **yellow** `src/api/providers/openai.ts` line 526 -- `(toolCall as any).extra_content`
   Casting to `any` to access a provider-specific field. A type guard or type extension on the OpenAI chunk type would be safer and document the contract.

5. **yellow** `src/api/transform/openai-format.ts` line 476 -- `(toolMessage as any)`
   Same pattern. The Anthropic `ToolUseBlockParam` type doesn't have `extra_content`, so this cast is understandable but should have a comment explaining why the upstream type doesn't cover it.

6. **yellow** Missing `kilocode_change` markers
   Changes to `src/shared/tools.ts`, `src/api/transform/stream.ts`, `src/core/assistant-message/NativeToolCallParser.ts`, `src/core/task/Task.ts`, `src/api/providers/openai.ts`, and `src/api/transform/openai-format.ts` all need `kilocode_change` markers per fork conventions.

7. **gray** Merge conflicts
   PR merge state is `CONFLICTING`. Several of the touched files (particularly `NativeToolCallParser.ts`, `Task.ts`, `openai-format.ts`) have had significant upstream changes since the PR was opened on Jan 21. Rebase required before merge is possible.

## CI Status

| Check | Result |
|-------|--------|
| CI runs | No checks reported (branch not rebased) |
| Mergeable | CONFLICTING |

## Code Snippets

OpenRouter provider -- the gap (current main, lines 602-610):
```typescript
if ("tool_calls" in delta && Array.isArray(delta.tool_calls)) {
    for (const toolCall of delta.tool_calls) {
        yield {
            type: "tool_call_partial",
            index: toolCall.index,
            id: toolCall.id,
            name: toolCall.function?.name,
            arguments: toolCall.function?.arguments,
            // extra_content NOT passed through here
        }
    }
}
```

NativeToolCallParser -- the `extra_content` plumbing (from the diff):
```typescript
public static startStreamingToolCall(id: string, name: string, extra_content?: Record<string, unknown>): void {
    this.streamingToolCalls.set(id, {
        id,
        name,
        argumentsAccumulator: "",
        extra_content,
    })
}
```

## Verdict

**REQUEST_CHANGES**

The implementation concept is sound -- `extra_content` needs to survive the full streaming lifecycle to be sent back in subsequent API requests. The interfaces are well-documented with JSDoc comments. However, three issues block approval:

1. The OpenRouter provider (the primary use case) is not actually updated in the diff, despite being listed in the PR description.
2. Zero test coverage for new code paths across 7 files, in an area with existing test infrastructure.
3. Merge conflicts require rebase.

The `as any` casts and missing `kilocode_change` markers are secondary but should be addressed.

---

<sub>Methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)</sub>
