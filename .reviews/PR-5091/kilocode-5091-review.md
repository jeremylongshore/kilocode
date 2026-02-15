<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5091
title: "feat(mode): implement Ralph mode for infinite task loops"
author: dannycreations
category: feature
tier: 5
lines: 768
files: 39
verdict: REQUEST_CHANGES
confidence: 85
reviewed_at: 2026-02-15
-->

# Review: kilocode #5091

> **feat(mode): implement Ralph mode for infinite task loops** by @dannycreations

**Methodology**: [Kilo Code PR Review Process](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Summary

Implements "Ralph mode" -- an infinite task loop feature where completed tasks automatically restart with the same prompt. When enabled, `AttemptCompletionTool` triggers a new task instead of showing the completion result to the user. Includes loop limit, completion delimiter for stop conditions, and a toggle in the chat UI. Significant safety concerns around resource consumption and runaway loops.

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | Yellow | Core logic works but has race conditions in restart flow |
| Conventions | Pass | Follows existing global settings patterns |
| Changeset | Pass | Present -- minor for kilo-code |
| Tests | Yellow | 219-line test file; tests use mock task objects |
| i18n | Pass | All 22 locales updated |
| Types | Pass | GlobalSettings and task metadata properly extended |
| Security | Red | No cost/token limit, no timeout on total loops |
| Scope | Yellow | Modifies Task.ts, AttemptCompletionTool.ts, presentAssistantMessage.ts |
| kilocode_change markers | Pass | Properly marked throughout |

## Findings

### Red -- No cost or token limit safeguard

Ralph mode can loop indefinitely with `ralphLoopLimit: 0` (unlimited). There is no maximum cost threshold, no total token budget, and no wall-clock timeout. A user who enables Ralph with unlimited loops on a paid API could run up unbounded costs without any automatic circuit breaker.

```typescript
if (loopLimit <= 0 || currentLoopCount + 1 < loopLimit) {
    // Loops forever when loopLimit is 0
    setTimeout(async () => {
        await provider.createTask(firstPrompt, images, undefined, {
            ralphLoopCount: currentLoopCount + 1,
        })
    }, 1000)
}
```

### Red -- Race condition in restart flow

The `handleRalphRestart` method calls `this.abortTask()` synchronously after scheduling the restart via `setTimeout(..., 1000)`:

```typescript
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

await this.abortTask() // Runs immediately, before the setTimeout callback
return true
```

If `abortTask()` cleans up the provider state before the setTimeout fires, the `createTask` call may fail or create an inconsistent state. The 1-second delay mitigates this somewhat, but it is not guaranteed.

### Yellow -- Delimiter check searches serialized JSON

The stop condition checks the completion `result` and the last 5 assistant messages for the delimiter:

```typescript
const assistantMessages = this.apiConversationHistory.filter((m) => m.role === "assistant").slice(-5)
for (const m of assistantMessages) {
    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content)
    if (content.indexOf(delimiter) !== -1) return false
}
```

`JSON.stringify` on content blocks may produce false positives if the delimiter string appears as part of a serialized JSON structure. The default delimiter `<ralph>COMPLETED</ralph>` is distinctive enough to avoid this, but custom delimiters could hit this issue.

### Yellow -- Mistake limit override silently restarts failing tasks

The PR wraps the existing `mistake_limit_reached` ask pattern in a new method:

```typescript
const result = await this.handleMistakeLimitReached()
if (!result) {
    return true // Ralph restarted the task
}
```

If Ralph mode is enabled and the mistake limit is reached, the task restarts instead of asking the user. This silently swallows errors and restarts the failing task, potentially creating an infinite loop of failures (fail, restart, fail, restart...) until the loop limit is reached.

### Yellow -- No persistent UX indicator during Ralph loops

When a task completes and Ralph restarts it, the user sees a brief error message before the new task begins. There is no persistent UI indicator showing current loop iteration, total cost across loops, or an option to pause Ralph mode from the chat.

### Gray -- Author's design philosophy

From the PR comments: "ralph should be treaten like yolo mode that is with user concern." The feature intentionally defers safety to the user. The maintainer asked about completion conditions, and the author added the delimiter system in response.

### Gray -- Maintainer has deprioritized

Kevin commented that features are being limited during the rebuild. This PR is unlikely to merge in its current form.

## CI Status

| Check | Result |
|-------|--------|
| CI | No checks reported on branch |

## Code Snippets

### Ralph restart logic (Task.ts)
```typescript
public async handleRalphRestart(result?: string): Promise<boolean> {
    const provider = this.providerRef.deref()
    const state = await provider?.getState()
    if (provider && state?.alwaysAllowRalph && state?.ralphEnabled) {
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

### AttemptCompletionTool integration
```typescript
const restarted = await task.handleRalphRestart(result)
if (restarted) {
    return // Skip showing completion to user
}
```

## Verdict

**REQUEST_CHANGES** -- The feature concept addresses a real need (Manus-like autonomous looping), but the implementation has safety gaps. The lack of any cost/token circuit breaker for unlimited loops is the primary concern. The race condition between setTimeout and abortTask needs resolution via proper async sequencing. The mistake limit override silently restarts failing tasks, which could create infinite failure loops. Minimum requirements: (1) add a mandatory cost or token ceiling, (2) resolve the abort/restart race condition, (3) do not silently restart on mistake limit -- at minimum track error counts across restarts and stop after repeated failures.
