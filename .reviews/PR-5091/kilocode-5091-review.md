<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5091
title: "feat(mode): implement Ralph mode for infinite task loops"
author: dannycreations
category: feat
tier: 4
lines: 768
files: 39
verdict: REQUEST_CHANGES
confidence: 5
reviewed_at: 2026-02-14
linked_issue: none
fork_pr: pending
-->

# Review: kilocode #5091

> **feat(mode): implement Ralph mode for infinite task loops** by @dannycreations
> Review #52

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | FAIL | Race condition in restart, no cost guard, incomplete test mocking |
| Conventions | WARN | `// kilocode_change` markers present; mixed indentation in JSX (tabs vs spaces) |
| Changeset | PASS | Minor changeset included |
| Tests | FAIL | Tests use correct API but mock objects lack methods the PR adds (`handleRalphRestart`, `abortTask`) |
| i18n | PASS | All 20 locales have Ralph strings |
| Types | PASS | Zod schema, ExtensionState, WebviewMessage types all extended correctly |
| Security | FAIL | `loopLimit: 0` means unlimited loops with no cost ceiling -- runaway spend risk |
| Scope | WARN | Feature is self-described as incomplete by the author (see comments) |

## Findings

### RED: No cost or token ceiling -- unlimited loops can drain API budget

The `handleRalphRestart` method allows `loopLimit: 0` to mean "infinite loops." The default in EVALS_SETTINGS is `5`, but the UI slider goes to `0` (labeled with an infinity symbol). Combined with YOLO mode, a user could enable Ralph with unlimited loops and no approval gates, potentially spending hundreds of dollars before noticing.

There is no:
- Maximum cost check before restart
- Token budget per Ralph session
- Warning dialog when enabling unlimited loops
- Rate limiting between restarts (only a 1-second setTimeout)

This is the most critical gap. An autonomous loop feature without a cost ceiling is a liability.

**Recommendation**: Add a `ralphMaxCost` setting (or reuse `allowedMaxCost`) and check cumulative cost before each restart. At minimum, show a confirmation dialog when `loopLimit` is set to 0.

### RED: Race condition between abortTask and setTimeout restart

```typescript
// Task.ts handleRalphRestart():
setTimeout(async () => {
    try {
        await provider.createTask(firstPrompt, images, undefined, {
            ralphLoopCount: currentLoopCount + 1,
        })
        await provider.postMessageToWebview({ type: "invoke", invoke: "newChat" })
    } catch (error) {
        console.error("[Task] Failed to restart task in Ralph mode:", error)
    }
}, 1000)

await this.abortTask()
return true
```

The `abortTask()` is called immediately, but the new task creation happens 1 second later in a detached setTimeout. This creates multiple issues:

1. **Provider may be disposed** -- If the user closes the panel within 1 second, `provider.createTask` will throw on a disposed object.
2. **No cancellation handle** -- There is no way to cancel the pending restart if the user manually starts a new task during the 1-second window.
3. **Error swallowing** -- The catch block logs to console but the user gets no feedback that the restart failed.
4. **Ordering** -- `abortTask()` runs synchronously relative to the setTimeout callback, but the provider's internal state during abort may conflict with `createTask` being called immediately after.

**Recommendation**: Instead of setTimeout, use a proper lifecycle hook. Either (a) have `abortTask` accept a "next action" callback that runs after cleanup completes, or (b) emit an event that the provider listens for to trigger the restart.

### RED: Tests would fail at runtime

The test file `AttemptCompletionToolRalph.spec.ts` calls `attemptCompletionTool.handle(mockTask, block, mockCallbacks)`. The test mock has several issues:

1. **Missing `handleRalphRestart` on mockTask** -- The PR adds `task.handleRalphRestart(result)` in `AttemptCompletionTool.execute()`, but the mock object does not define this method. The call would throw `TypeError: task.handleRalphRestart is not a function`.

2. **No `abortTask` on mock** -- Even if `handleRalphRestart` were present, it internally calls `this.abortTask()`, which the mock lacks.

3. **`alwaysAllowRalph` not set in state** -- The first test sets `mockProvider.getState.mockResolvedValue({ ralphEnabled: true })` but does not set `alwaysAllowRalph: true`. The `handleRalphRestart` guard requires BOTH `state?.alwaysAllowRalph && state?.ralphEnabled` to be truthy.

4. **No test for `handleMistakeLimitReached`** -- This new method wraps the mistake-limit flow for all users but has zero test coverage.

### YELLOW: `handleMistakeLimitReached` changes existing behavior for all users

The PR replaces direct `await this.ask("mistake_limit_reached", ...)` calls in two places:
- `presentAssistantMessage.ts` (tool repetition handler)
- `Task.ts` (consecutive mistake handler)

Both now call `handleMistakeLimitReached()`, which can return `undefined` (causing early return) if Ralph restarts the task. This changes the control flow for ALL users, not just Ralph users. If `handleRalphRestart` has a bug that causes it to return `true` unexpectedly, non-Ralph users would see their mistake-limit interactions silently dropped.

### YELLOW: Feature is self-described as incomplete

From the PR comments:
> "yeah still working on it" -- author, in response to maintainer @marius-kilocode asking about completion conditions
> "ralph should be treaten like yolo mode that is with user concern" -- author

The author acknowledges the feature lacks completion conditions and intentionally avoids safeguards. For a feature enabling unlimited autonomous execution loops, this is concerning.

### YELLOW: Mixed indentation in JSX files

`AutoApproveSettings.tsx` and `SettingsView.tsx` have Ralph sections indented with spaces while the surrounding code uses tabs. This will trigger linting failures.

### GRAY: Czech locale introduces a typo

`webview-ui/src/i18n/locales/cs/settings.json` changes an existing correct Czech word to what appears to be Polish:
```diff
-"timeoutLabel": "Doba cekani pred automatickym vyberem prvni odpovedi"
+"timeoutLabel": "Doba cekani przed automatickym vyberem prvni odpovedi"
```

### GRAY: Feature name "Ralph" is not self-documenting

The UI label is just "Ralph" with an infinity icon. The description helps ("autonomous agent loop ability"), but the name provides no semantic signal to users unfamiliar with the convention.

## CI Status

| Check | Result |
|-------|--------|
| All CI | NOT REPORTED | No checks on `feat-ralph-mode` branch |

## Code Snippets

### Core restart logic (Task.ts):
```typescript
public async handleRalphRestart(result?: string): Promise<boolean> {
    const provider = this.providerRef.deref()
    const state = await provider?.getState()
    if (provider && state?.alwaysAllowRalph && state?.ralphEnabled) {
        const delimiter = state.ralphCompletionDelimiter

        // Check delimiter in result and last 5 assistant messages
        if (result !== undefined && delimiter && delimiter.trim() !== "") {
            if (result.indexOf(delimiter) !== -1) return false
            // ... scan last 5 assistant messages for delimiter
        }

        const loopLimit = state.ralphLoopLimit ?? 5
        const currentLoopCount = this.metadata.ralphLoopCount ?? 0

        if (loopLimit <= 0 || currentLoopCount + 1 < loopLimit) {
            setTimeout(async () => {
                await provider.createTask(firstPrompt, images, undefined, {
                    ralphLoopCount: currentLoopCount + 1,
                })
            }, 1000)
            await this.abortTask()
            return true
        }
    }
    return false
}
```

### AttemptCompletionTool integration:
```typescript
// AttemptCompletionTool.ts execute():
const restarted = await task.handleRalphRestart(result)
if (restarted) {
    return  // Skip normal completion flow
}
```

### Settings schema additions:
```typescript
alwaysAllowRalph: z.boolean().optional(),
ralphEnabled: z.boolean().optional(),
ralphLoopLimit: z.number().int().min(0).optional(),
ralphCompletionDelimiter: z.string().optional(),
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**REQUEST_CHANGES** -- This PR introduces an autonomous loop feature ("Ralph mode") that automatically restarts tasks upon completion. While the concept addresses a real user need for agentic workflows, the implementation has critical safety and correctness issues:

1. **No cost ceiling** for unlimited loops -- users can burn through API budgets with no guard
2. **Race condition** between task abort and setTimeout-based restart
3. **Tests would fail** due to missing mock methods and incorrect state setup
4. **Behavior change for all users** in mistake-limit handling, without test coverage
5. **Author acknowledges the feature is incomplete**

The feature needs: (a) a cost/token budget guard, (b) proper lifecycle management for restarts instead of setTimeout, (c) working tests that actually exercise the Ralph code paths, and (d) completion by the author before review.
