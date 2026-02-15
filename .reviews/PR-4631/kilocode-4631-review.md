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
confidence: 92
reviewed_at: 2026-02-15
-->

# Review: kilocode #4631

> **fix: Adjust handling of thinking blocks in message filtering** by @pandemicsyn

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | pass | Correctly strips thinking blocks when thinking is disabled |
| Conventions | pass | Proper `kilocode_change` markers on all modified shared code |
| Changeset | warn | Missing changeset (bot flagged it); should add a `patch` changeset |
| Tests | pass | Two new test cases covering enabled and disabled thinking paths |
| i18n | n/a | No UI strings |
| Types | pass | Uses Anthropic SDK's `ThinkingConfigParam` type correctly |
| Security | n/a | No security surface changes |
| Scope | pass | Minimal, focused fix touching only the necessary files |

## Findings

**gray** `src/api/transform/anthropic-filter.ts:29-35` -- The condition `thinking === undefined` only handles the case where thinking is not set. If someone passes `{ type: "disabled" }` (a valid `ThinkingConfigParam` value), thinking blocks would be preserved and sent to the API. In practice, `getAnthropicReasoning()` returns `undefined` when thinking should be off (never `{ type: "disabled" }`), so this is not a real bug today. But the comment could be more precise: "When thinking is undefined" rather than "When thinking is disabled."

**gray** `src/integrations/claude-code/streaming-client.ts:47` -- There is a separate local `filterNonAnthropicBlocks` in the Claude Code streaming client that duplicates logic from `anthropic-filter.ts`. It is not affected by this PR (the streaming client conditionally includes the `thinking` body parameter on line 396-398, so it sidesteps the issue). But the duplication is technical debt worth noting.

**yellow** `.changeset/` -- Missing changeset. This is a user-facing bug fix (prevents a confusing API error loop) and should have a `patch` changeset for `kilo-code`.

## CI Status

| Check | Result |
|-------|--------|
| Build Docusaurus Site | pass |
| build-cli | pass |
| check-translations | pass |
| compile | pass |
| test-cli | pass |
| test-extension (ubuntu) | pass |
| test-extension (windows) | pass |
| test-jetbrains | pass |
| test-webview (ubuntu) | pass |
| test-webview (windows) | pass |
| unit-test | pass |

## Code Snippets

Core change in `anthropic-filter.ts` -- dynamically builds the allowlist based on the `thinking` parameter:

```typescript
export function filterNonAnthropicBlocks(
    messages: Anthropic.Messages.MessageParam[],
    thinking?: Anthropic.Messages.ThinkingConfigParam,
): Anthropic.Messages.MessageParam[] {
    const allowedTypes = new Set(VALID_ANTHROPIC_BLOCK_TYPES)

    if (thinking === undefined) {
        allowedTypes.delete("thinking")
        allowedTypes.delete("redacted_thinking")
    }
    // ... rest of filter logic unchanged
}
```

Both callers updated to pass the `thinking` parameter:

```typescript
// anthropic.ts
const sanitizedMessages = filterNonAnthropicBlocks(messages, thinking)

// anthropic-vertex.ts
const sanitizedMessages = filterNonAnthropicBlocks(messages, thinking)
```

## Verdict

**APPROVE** -- This is a clean, well-scoped fix for a real user-facing error ("When thinking is disabled, an 'assistant' message cannot contain 'thinking'"). The approach of conditionally trimming the allowlist based on the `thinking` parameter is sound. The optional parameter preserves backward compatibility. Tests cover both branches. All CI passes.

The only actionable item is the missing changeset, which a maintainer can add trivially.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)</sub>
