<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 4631
title: "fix: Adjust handling of thinking blocks in message filtering"
author: pandemicsyn
category: fix
tier: 3
lines: 87
files: 4
review_number: 25
-->

# Review Journal: kilocode #4631

> **PR**: [#4631](https://github.com/Kilo-Org/kilocode/pull/4631) |
> **Title**: fix: Adjust handling of thinking blocks in message filtering |
> **Author**: @pandemicsyn |
> **Category**: fix | **Tier**: 3 | **Size**: 87 lines, 4 files

---

## Summary

Solid bug fix that prevents Anthropic API errors when thinking blocks from a previous turn persist in message history after the model switches to one that doesn't support thinking. The approach of conditionally building the allowlist is clean and backward-compatible. Approve.

## First Impressions

The title signals a filtering issue around Anthropic's thinking blocks. The error message in the PR description ("When thinking is disabled, an 'assistant' message cannot contain 'thinking'") is well-known in the Anthropic ecosystem -- it occurs when conversation history contains thinking blocks from a previous thinking-enabled request but the current request doesn't have thinking enabled. This is a real UX pain point because it creates a loop of errors.

## What I Looked At

1. **`src/api/transform/anthropic-filter.ts`** -- the core filter function being modified
2. **`src/api/transform/__tests__/anthropic-filter.spec.ts`** -- existing and new tests
3. **`src/api/providers/anthropic.ts`** -- Anthropic provider caller, destructures `reasoning: thinking` from `getModel()`
4. **`src/api/providers/anthropic-vertex.ts`** -- Vertex provider caller
5. **`src/api/transform/reasoning.ts`** -- `getAnthropicReasoning()` to confirm it returns `undefined` when thinking is off
6. **`src/api/transform/model-params.ts`** -- `getModelParams()` to trace how `reasoning` flows
7. **`src/integrations/claude-code/streaming-client.ts`** -- duplicate `filterNonAnthropicBlocks` (separate code path, not affected)
8. **`src/api/providers/base-provider.ts`** -- base class `getModel()` signature
9. All other callers of `filterNonAnthropicBlocks` via grep (only the two Anthropic providers + streaming client duplicate)

## Analysis

### The Bug

When a user switches models mid-conversation (e.g., from Claude Opus 4.5 with thinking to Claude Haiku without it), the message history contains `thinking` and `redacted_thinking` blocks from earlier turns. The existing `filterNonAnthropicBlocks` always preserved these because they're in the `VALID_ANTHROPIC_BLOCK_TYPES` allowlist. When the API receives them without `thinking` enabled in the request, it returns an error that cascades into a retry loop.

### The Fix

The function now takes an optional `thinking` parameter (the same `ThinkingConfigParam` from Anthropic's SDK). When `undefined`, it removes `thinking` and `redacted_thinking` from the dynamic allowlist before filtering. When set (any value), it preserves them.

This is the right level of abstraction -- the filter doesn't need to know about `{ type: "enabled" }` vs `{ type: "adaptive" }` etc. It only needs to know "is thinking active at all?"

### Edge Case: `{ type: "disabled" }`

The `ThinkingConfigParam` type can technically include `{ type: "disabled" }`. If someone passed that, the condition `thinking === undefined` would not trigger, and thinking blocks would be preserved. However, I traced the call chain: `getAnthropicReasoning()` returns `undefined` when thinking should be off, never an explicit disabled object. So this is safe in practice.

### Backward Compatibility

The new `thinking` parameter is optional. Existing calls without it default to `undefined`, meaning thinking blocks get stripped. This is a behavioral change for any code that calls `filterNonAnthropicBlocks()` without the parameter and expects thinking blocks preserved. I checked all callers -- only the two Anthropic providers use the shared function, and both are updated in the PR. The streaming client has its own local copy.

### Test Quality

Two new test cases:
1. Thinking enabled -- thinking blocks preserved (1 assertion)
2. Thinking undefined -- thinking + redacted_thinking blocks stripped, empty messages removed (3 assertions covering both block types and the empty-message edge case)

The tests are thorough. The `as any` casts for thinking blocks are necessary since the SDK types don't expose thinking blocks as user-constructable types (they're API response types).

## Verification

- All 11 CI checks pass (compile, test-extension on ubuntu/windows, test-webview, test-cli, test-jetbrains, build-cli, check-translations, unit-test, docusaurus)
- No reviews from maintainers yet; review status REVIEW_REQUIRED
- kiloconnect bot approved with 95% confidence
- Missing changeset flagged by changeset-bot

## Lessons Learned

- **Allowlist mutation pattern**: Creating a dynamic copy of the allowlist (`new Set(VALID_ANTHROPIC_BLOCK_TYPES)`) then deleting entries is cleaner than adding a conditional check inside the filter callback. It keeps the filter logic pure.
- **Conversation history bugs**: Model switching mid-conversation is a rich source of bugs because message history carries artifacts from the previous model's capabilities. Any filter operating on message history should consider whether the current model supports the block types being passed through.
- **Duplicate code paths**: The streaming client having its own copy of `filterNonAnthropicBlocks` means this class of bug needs to be fixed in two places. The streaming client happens to avoid the issue by architecture (conditionally including `thinking` in the request body), but the duplication is latent risk.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md) | Reviewed with Claude Code</sub>
