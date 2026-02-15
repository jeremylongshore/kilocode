<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 4631
title: "fix: Adjust handling of thinking blocks in message filtering"
author: pandemicsyn
category: fix
tier: 3
lines: 87
files: 4
verdict: APPROVE
confidence: 5
reviewed_at: 2026-02-14
linked_issue: none
fork_pr: https://github.com/jeremylongshore/kilocode/pull/18
-->

# Review: kilocode #4631

> **fix: Adjust handling of thinking blocks in message filtering** by @pandemicsyn
> Multi-AI analysis: [Fork PR #18](https://github.com/jeremylongshore/kilocode/pull/18) — reviewed by CodeRabbit, Gemini, Qodo

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Fixes real API error by conditionally stripping thinking blocks |
| Conventions | PASS | Uses `// kilocode_change` markers per project convention |
| Changeset | WARN | No changeset — bot flagged this. Should have a patch changeset |
| Tests | PASS | 2 new test cases covering enabled/disabled thinking scenarios |
| i18n | N/A | No user-facing strings |
| Types | PASS | Optional parameter maintains backward compatibility |
| Security | PASS | No security implications — filtering content blocks only |
| Scope | PASS | Focused fix, no scope creep |

## Findings

### GREEN: Clean, correct implementation

**The bug**: When thinking is disabled (`undefined`) but previous assistant messages in conversation history contain `thinking` or `redacted_thinking` blocks, the Anthropic API rejects the request with:
> "When thinking is disabled, an 'assistant' message cannot contain 'thinking'"

This happens when a user switches from a thinking-enabled model to one without thinking mid-conversation, or when thinking is toggled off.

**The fix**: `filterNonAnthropicBlocks()` now accepts an optional `thinking` parameter. When `thinking === undefined` (disabled), it clones the allowlist set and removes `thinking` and `redacted_thinking` from it before filtering.

Key design decisions that are correct:
1. **Set cloning** (`new Set(VALID_ANTHROPIC_BLOCK_TYPES)`) — avoids mutating the shared module-level constant
2. **Optional parameter** — backward compatible, callers that don't pass `thinking` get the new behavior (strip thinking blocks)
3. **Empty message removal** — existing logic already handles messages that become empty after filtering, so this "just works"

### YELLOW: Missing changeset

The changeset bot flagged this. For a bug fix this should be a `patch` changeset. Not a blocker but should be addressed before merge.

## CI Status

| Check | Result |
|-------|--------|
| build | PASS |
| Biome | PASS |
| check-types | PASS |
| Completions Test | PASS |
| lint | PASS |
| pr-description | PASS |
| Qodo Merge | PASS |
| test | PASS |
| Storybook | PASS |
| Localization | PASS |
| e2e_smoke | PASS |

All 11 upstream CI checks pass.

## Local Verification

We merged this PR on our fork and ran the full test suite.

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | PASS* | 19/20 packages (pre-existing CLI error) |
| Lint | `pnpm lint` | PASS | 14/14 packages |
| Unit Tests | `pnpm test` | PASS | 1,544 passed across 5 packages, 0 new failures |

*Pre-existing failures (not caused by this PR):
- `@kilocode/cli` check-types: TS2739/TS2322 in MarkdownText.tsx and ExtensionMessageRow.tsx
- `@kilocode/cli` test: 1 failure in telemetry.test.ts ("should initialize with config")
- `@roo-code/vscode-webview` build: TS2339 in NotificationService.ts (blocks webview + kilo-code tests)

> Tested on fork branch [`review/PR-4631`](https://github.com/jeremylongshore/kilocode/tree/review/PR-4631) | Evidence: `test-evidence-PR-4631.log` (2,214 lines)

## Code Snippets

### Core change: `anthropic-filter.ts`

```typescript
export function filterNonAnthropicBlocks(
  messages: Anthropic.Messages.MessageParam[],
  thinking?: Anthropic.Messages.ThinkingConfigParam,
): Anthropic.Messages.MessageParam[] {
  // Build the set of allowed block types based on whether thinking is enabled
  const allowedTypes = new Set(VALID_ANTHROPIC_BLOCK_TYPES)

  // When thinking is undefined (disabled), remove thinking blocks from the allowlist
  if (thinking === undefined) {
    allowedTypes.delete("thinking")
    allowedTypes.delete("redacted_thinking")
  }
  // ...existing filter logic using allowedTypes instead of VALID_ANTHROPIC_BLOCK_TYPES
}
```

### Both callers updated identically:

```typescript
// anthropic.ts and anthropic-vertex.ts
const sanitizedMessages = filterNonAnthropicBlocks(messages, thinking)
```

## Verdict

**APPROVE** — This is a clean, well-tested fix for a real user-facing error. The implementation correctly uses an allowlist clone to conditionally strip thinking blocks when thinking is disabled, maintaining backward compatibility through an optional parameter. Both Anthropic provider callers are properly updated. The only minor issue is the missing changeset, which should be added before merge.
