<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5267
title: "fix: preserve extra_content for Gemini 3 thought_signature support"
author: maywzh
category: fix
tier: 3
lines: 154
files: 7
verdict: COMMENT
confidence: 4
reviewed_at: 2026-02-14
linked_issue: none
fork_pr: N/A (batch review)
lesson: as-any casts to extend third-party types should be centralized — scattered (toolCall as any).extra_content is fragile and invisible to type checking
-->

# Review: kilocode #5267

> **fix: preserve extra_content for Gemini 3 thought_signature support** by @maywzh

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | extra_content threaded through all 7 touch points correctly |
| Conventions | WARN | Multiple `as any` casts bypass type safety — see findings |
| Changeset | PASS | Patch changeset included |
| Tests | FAIL | No tests for any of the 7 changed files |
| i18n | N/A | No user-facing strings |
| Types | WARN | `extra_content?: Record<string, unknown>` is correct but `as any` usage undermines it |
| Security | PASS | extra_content is opaque passthrough — not parsed, not executed |
| Scope | PASS | Focused on preserving provider metadata through the tool call pipeline |

## Findings

### YELLOW: Multiple `as any` casts

The PR uses `as any` in several places to access `extra_content`:

- `openai.ts:527` — `(toolCall as any).extra_content`
- `openai-format.ts:483` — `const toolMessageWithExtra = toolMessage as any`
- `Task.ts:3124` — `const existingToolUse = this.assistantMessageContent[toolUseIndex] as any`

Since `extra_content` is already added to the TypeScript interfaces (`ApiStreamToolCallChunk`, `ApiStreamToolCallStartChunk`, `ApiStreamToolCallPartialChunk`, `ToolUse`, `McpToolUse`), the `as any` casts in `openai-format.ts` and `Task.ts` suggest the types aren't flowing through properly. The `ToolUse` and `McpToolUse` interfaces in `shared/tools.ts` do have `extra_content` added — verify these are being imported where the casts appear.

The `openai.ts` cast is understandable since `toolCall` comes from the OpenAI SDK type which doesn't include `extra_content`, but a proper type extension would be safer.

### YELLOW: No tests

136 lines of additions across 7 files in the critical streaming pipeline with zero test coverage. Key untested scenarios:
- `extra_content` preservation through tool call start → delta → complete lifecycle
- `extra_content` carried through format conversion (OpenAI format → internal)
- `extra_content` survival across partial → final tool use transitions in Task.ts
- Missing `extra_content` (undefined) doesn't break existing flows

### YELLOW: CONFLICTING merge status

The PR has merge conflicts. The contributor will need to rebase against `main` before this can be merged. Given it touches `Task.ts` and `openai.ts` (high-churn files), conflicts are expected.

### GRAY: `Record<string, unknown>` is correct typing

The choice of `Record<string, unknown>` for `extra_content` is appropriate — it's opaque provider-specific metadata that should be passed through without parsing. This aligns with how similar fields (like `reasoning_details`) are handled elsewhere in the codebase.

### GRAY: Only OpenAI/OpenRouter providers updated

The PR adds `extra_content` extraction only in `openai.ts` (shared by OpenRouter). The Gemini native provider (`gemini.ts`) is not touched. If Gemini 3 returns `thought_signature` through the native Gemini API (not just via OpenRouter), that path may need similar treatment.

## CI Status

| Check | Result |
|-------|--------|
| Mergeable | CONFLICTING |
| changeset-bot | Changeset detected (patch) |
| Upstream CI | No recent run visible |

## Code Snippets

### Interface addition (shared/tools.ts):
```typescript
export interface ToolUse<TName = ToolName> {
    // ... existing fields
    extra_content?: Record<string, unknown>  // NEW
}
```

### Streaming lifecycle (NativeToolCallParser.ts):
```typescript
// Start: capture extra_content from first chunk
public static startStreamingToolCall(id: string, name: string, extra_content?: Record<string, unknown>): void {
    this.streamingToolCalls.set(id, { id, name, argumentsAccumulator: "", extra_content })
}

// Complete: pass through to final ToolUse
result.extra_content = toolCall.extra_content
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**COMMENT** — The approach is architecturally sound: threading opaque provider metadata through the entire tool call lifecycle is the right pattern. The implementation correctly adds `extra_content` to all relevant interfaces and preserves it through streaming, parsing, and format conversion. However, three concerns prevent APPROVE: (1) multiple `as any` casts that should be replaced with proper type extensions, (2) zero test coverage for a change that touches the critical streaming pipeline, and (3) CONFLICTING merge status requiring a rebase. The change itself is backward compatible (all fields are optional) and low-risk, but the code hygiene issues should be addressed.
