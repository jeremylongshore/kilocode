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
confidence: 3
reviewed_at: 2026-02-14
linked_issue: none
fork_pr: N/A (batch review)
-->

# Review: kilocode #5452

> **fix: reasoning effort sync and support for OpenAI Compatible provider** by @rayss868

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | WARN | Bypasses existing reasoning transform pipeline, dual-writes reasoning state -- see findings |
| Conventions | WARN | Does not use `getOpenAiReasoning()` or `shouldUseReasoningEffort()` helpers used everywhere else |
| Changeset | FAIL | No changeset included (changeset-bot flagged this) |
| Tests | FAIL | No new tests for the backend logic changes |
| i18n | N/A | No user-facing strings added |
| Types | WARN | Uses `(params as any)` cast, consistent with existing code but not ideal |
| Security | PASS | No security implications |
| Scope | PASS | Focused on OpenAI Compatible reasoning effort |

## Findings

### YELLOW: Backend bypasses the established reasoning transform pipeline

`base-openai-compatible-provider.ts:107-115` -- The PR adds inline reasoning_effort logic directly in the provider:

```typescript
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

The codebase already has a centralized `getOpenAiReasoning()` function in `src/api/transform/reasoning.ts` that handles this exact logic with proper validation via `shouldUseReasoningEffort()`. The native OpenAI provider (`openai.ts`) uses `modelInfo.reasoningEffort` directly on the params. The OpenRouter provider uses `getOpenRouterReasoning()`. The Roo provider uses `getRooReasoning()`.

This PR adds a third ad-hoc approach that does not go through the shared validation pipeline. For example, `shouldUseReasoningEffort()` in `shared/api.ts` has nuanced logic:
- Checks `enableReasoningEffort === false` as an explicit off switch
- Validates against `supportsReasoningEffort` capability arrays
- Handles "disable" and "none" sentinels
- Falls back to model defaults

The inline implementation misses some of these checks (e.g., it does not validate against the `supportsReasoningEffort` capability array when it's an array of allowed values rather than a boolean).

### YELLOW: `reasoningEffort: "disable"` does not suppress binary `thinking`

kiloconnect flagged this correctly. In the PR's code, when `enableReasoningEffort` is true:

```typescript
if (this.options.enableReasoningEffort) {
    if (info.supportsReasoningBinary) {
        ;(params as any).thinking = { type: "enabled" }  // Always enabled
    }
    if (info.supportsReasoningEffort) {
        const effort = this.options.reasoningEffort || info.reasoningEffort
        if (effort && effort !== "disable") {
            ;(params as any).reasoning_effort = effort
        }
    }
}
```

If a model supports both binary thinking AND reasoning effort, and the user sets effort to "disable", binary thinking still gets enabled. The `thinking` parameter should be gated on the resolved effort not being "disable".

### YELLOW: UI dual-writes reasoning state to two locations

`OpenAICompatible.tsx:248,267,256-258` -- The PR adds `setApiConfigurationField("reasoningEffort", ...)` alongside the existing `openAiCustomModelInfo.reasoningEffort` write. This means reasoning effort is stored in two places:

1. `apiConfiguration.reasoningEffort` (root-level)
2. `apiConfiguration.openAiCustomModelInfo.reasoningEffort` (nested in model info)

The read priority is:
```typescript
reasoningEffort:
    apiConfiguration.reasoningEffort ||
    apiConfiguration.openAiCustomModelInfo?.reasoningEffort,
```

This works for the immediate fix but creates a state synchronization concern. If one location is updated but not the other (e.g., by a different code path, a settings import, or a migration), they can diverge silently. The existing native OpenAI provider does not have this dual-write pattern.

### GRAY: No changeset

The changeset-bot flagged that no changeset is included. For a bug fix affecting user-visible behavior (reasoning effort now works for OpenAI Compatible), a patch changeset is appropriate.

### GRAY: No tests

The backend changes add conditional logic in two methods (`createStream` and `completePrompt`). The existing test file `base-openai-compatible-provider.spec.ts` has infrastructure for testing these methods. Adding a test case for "reasoning_effort is included when supportsReasoningEffort is true" would be straightforward.

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

All 11 upstream CI checks pass. (Vercel deploy checks are authorization-gated, not failures.)

## Code Snippets

### Backend change (duplicated in both `createStream` and `completePrompt`):
```typescript
// PR's approach - inline in base-openai-compatible-provider.ts
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

### Existing centralized approach (src/api/transform/reasoning.ts):
```typescript
// What other providers use
export const getOpenAiReasoning = ({
    model, reasoningEffort, settings,
}: GetModelReasoningOptions): OpenAiReasoningParams | undefined => {
    if (!shouldUseReasoningEffort({ model, settings })) return undefined
    if (reasoningEffort === "disable" || !reasoningEffort) return undefined
    return {
        reasoning_effort: reasoningEffort as OpenAI.Chat.ChatCompletionCreateParams["reasoning_effort"],
    }
}
```

### UI change:
```tsx
// Dual-write: saves to both root and nested locations
setApiConfigurationField("openAiCustomModelInfo", {
    ...openAiCustomModelInfo,
    reasoningEffort: value as ReasoningEffort,
})
setApiConfigurationField("reasoningEffort", value as ReasoningEffort) // NEW
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**COMMENT** -- The PR fixes a real user-facing bug: reasoning effort settings were silently ignored for the OpenAI Compatible provider. The intent is correct and the CI passes. However, the implementation bypasses the established `getOpenAiReasoning()` / `shouldUseReasoningEffort()` pipeline that every other provider uses, creating a maintenance divergence. The "disable" effort value does not suppress binary thinking, and the UI dual-write pattern introduces state synchronization risk. Recommend refactoring the backend to use the existing `getOpenAiReasoning()` helper and adding a test case. A changeset is also needed.
