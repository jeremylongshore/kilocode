<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5452
title: "fix: reasoning effort sync and support for OpenAI Compatible provider"
author: rayss868
category: provider
tier: 5
lines: 32
files: 2
verdict: COMMENT
confidence: 4
reviewed_at: 2026-02-15
-->

# Review: kilocode #5452

> **fix: reasoning effort sync and support for OpenAI Compatible provider** by @rayss868

[Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

**STATUS: CLOSED** -- Maintainer (@kevinvandijk) closed as functional duplicate of #5739.

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Logic is sound; properly syncs reasoning_effort to root config |
| Conventions | WARN | Missing kilocode_change markers in both files |
| Changeset | FAIL | Missing changeset |
| Tests | FAIL | No tests for reasoning effort parameter propagation |
| i18n | N/A | No user-facing strings |
| Types | PASS | Uses existing ReasoningEffort type correctly |
| Security | PASS | No security concerns |
| Scope | PASS | Minimal change, 2 files |

## Findings

### GRAY - PR is closed as duplicate

Maintainer kevinvandijk closed this PR on the basis that it is a functional duplicate of PR #5739. The code changes are legitimate and address a real bug where `reasoning_effort` was not correctly propagated when using the OpenAI Compatible provider, but the fix is being handled elsewhere.

### GRAY - The code changes are correct

The PR addresses two issues:

1. **Backend** (`base-openai-compatible-provider.ts`): When `enableReasoningEffort` is true, the code now checks `supportsReasoningEffort` separately from `supportsReasoningBinary`, and adds `reasoning_effort` to the API params. Previously, only the binary `thinking` parameter was supported.

2. **Frontend** (`OpenAICompatible.tsx`): When the reasoning level is toggled, `reasoningEffort` is now saved at the root config level (via `setApiConfigurationField("reasoningEffort", ...)`) in addition to within the model's custom info. This ensures the backend receives the value.

### GRAY - Code duplication between streaming and non-streaming paths

The same reasoning effort logic is duplicated in both `createMessage` (streaming) and `completePrompt` (non-streaming) methods. This is consistent with the existing pattern in the codebase (the `supportsReasoningBinary` check was already duplicated), but worth noting as technical debt.

```typescript
// Same block appears twice in the diff (lines ~105 and ~245):
if (this.options.enableReasoningEffort) {
    if (info.supportsReasoningBinary) {
        ;(params as any).thinking = { type: "enabled" }
    }
    if (info.supportsReasoningEffort) {
        const effort = this.options.reasoningEffort || info.reasoningEffort
        if (effort && effort !== "disable") {
            ;(params as any).reasoning_effort = effort
        }
    }
}
```

### GRAY - Merge conflict status

PR is marked as `CONFLICTING`, which is another reason it was closed in favor of the cleaner #5739.

## CI Status

| Check | Result |
|-------|--------|
| CI | Not run (PR has merge conflicts) |

## Verdict

**COMMENT** -- The code changes are technically correct and address a real user-facing bug. However, the PR was closed by a maintainer as a duplicate of #5739, so no further action is needed on this PR. The reasoning effort sync fix is valid and should be tracked in the #5739 review instead.
