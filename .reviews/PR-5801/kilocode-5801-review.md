<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5801
title: "feat(subagent): run background sub-agents for focused task and return results"
author: kels-ng
category: feature
tier: 6
lines: 2089
files: 71
verdict: COMMENT
confidence: 0.77
reviewed_at: 2026-02-15
review_number: 73
-->

# Review: kilocode #5801

> **feat(subagent): run background sub-agents for focused task and return results** by @kels-ng

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | pass | Clean separation of parent/child lifecycle, cancellation handled, settled guard prevents double-resolve |
| Conventions | info | Removed `kilocode_change` marker on `kilocodeExperimentIds` line without replacement |
| Changeset | fail | No changeset present -- changeset-bot confirms missing |
| Tests | pass | SubagentTool.spec.ts (190 lines), NativeToolCallParser tests, filter-tools-for-mode tests, reportSubagentProgress tests |
| i18n | pass | 24+ locale files updated with `subagents` namespace and `SUBAGENT` experiment strings |
| Types | pass | New types properly scoped: `SubagentType`, `SubagentRunner`, `RunSubagentInBackgroundParams`, payloads |
| Security | pass | Subagent inherits parent's API configuration and permission model, no credential escalation |
| Scope | info | 71 files but ~48 are i18n locale updates; core changes are ~600 lines across 12 files |

## Findings

### Red: Missing changeset

The changeset-bot confirms no changeset is present. This PR adds a new user-visible experiment (`subagent`) and a new tool. It requires a `minor` changeset for `"kilo-code"` at minimum.

### Yellow: No CI checks ran

No CI checks have been reported on the `subtak_cursor` branch. The code has not been validated by the project's build system.

### Yellow: No concurrent subagent limit

`runSubagentInBackground` in `ClineProvider.ts` creates a child `Task` with no limit on how many subagents a parent can spawn. If the model decides to launch multiple subagents in rapid succession (or recursively), there is no guard. The `SUBAGENT_EXCLUDE_TOOLS` set prevents nested subagent calls, but nothing prevents the parent from calling `subagent` multiple times before the first completes. Consider adding a concurrency limit or queueing mechanism.

### Yellow: Removed kilocode_change marker

In `packages/types/src/experiment.ts`, the `kilocodeExperimentIds` line had a `// kilocode_change` marker that was removed when `"subagent"` was added to the array. Since this is shared upstream code, the marker should be preserved to minimize merge conflicts.

### Yellow: Resource cleanup for background child tasks

The child `Task` created by `runSubagentInBackground` is constructed with `startTask: false` and then has `runBackgroundSubagentLoop` called. If the parent task is aborted (not just cancelled), the `finally` block in the promise clears `activeSubagentChild`, but the child task itself may still be running its agent loop. The `cancelTask` method in ClineProvider only handles the case where the user explicitly cancels, not where the parent task errors out or is externally aborted.

### Gray: ChatRow.tsx complexity

The `ChatRow.tsx` additions (~87 lines for `subagentRunning` and `subagentCompleted` cases) add rendering complexity to an already large component. The `parseSubagentCurrentTask` helper function is clean, but the inline JSX for the running/completed states could benefit from extraction into a dedicated `SubagentChatRow` component.

### Gray: Explore mode enforcement is in build-tools only

The explore mode restriction (read-only tools) is enforced in `build-tools.ts` via `applySubagentToolRestrictions`, which filters the tool list sent to the LLM. However, the LLM can still attempt to call filtered tools if it hallucinates tool names. The existing tool validation in `presentAssistantMessage` would catch this, but there is no explicit subagent-type guard at the tool execution layer.

## CI Status

| Check | Result |
|-------|--------|
| All checks | none reported |

## Code Snippets

SubagentTool core execution in `src/core/tools/SubagentTool.ts`:
```typescript
const runParams: RunSubagentInBackgroundParams = {
    parentTaskId: task.taskId,
    prompt,
    subagentType: subagent_type,
    onProgress: (currentTask) => task.reportSubagentProgress(currentTask),
}
const result = await provider.runSubagentInBackground(runParams)
```

Background subagent loop in `src/core/task/Task.ts`:
```typescript
public async runBackgroundSubagentLoop(initialPrompt: string): Promise<void> {
    this.clineMessages = []
    this.apiConversationHistory = []
    const typeInstructions = this.subagentType === "explore"
        ? "You are running as an **explore** subagent (read-only)..."
        : "You are running as a **general** subagent with full tool access..."
    const taskContent = `${typeInstructions}${initialPrompt}`
    await this.say("text", taskContent)
    this.isInitialized = true
    await this.initiateTaskLoop([{ type: "text", text: `<task>\n${taskContent}\n</task>` }])
}
```

Cancellation handling in `src/core/webview/ClineProvider.ts`:
```typescript
const subagentChild = task.activeSubagentChild
if (subagentChild) {
    task.activeSubagentChild = undefined
    subagentChild.backgroundCompletionResolve(SUBAGENT_CANCELLED_STRUCTURED_RESULT)
    subagentChild.abandoned = true
    subagentChild.cancelCurrentRequest()
    subagentChild.abortTask()
    return
}
```

## Verdict

**COMMENT** -- The feature is well-architected: clean separation between parent and child task lifecycles, proper cancellation with structured result codes, tool restriction enforcement for explore mode, and comprehensive i18n coverage. The `SubagentRunner` interface avoids tight coupling between the tool and the provider. The main gaps are the missing changeset, no CI validation, no concurrent subagent limit, and a removed `kilocode_change` marker. The author has expressed openness to discussion, and these are addressable without architectural changes.

---

Review conducted per [Kilo Code PR Review Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md).
