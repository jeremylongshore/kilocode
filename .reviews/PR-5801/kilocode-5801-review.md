<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5801
title: "feat(subagent): run background sub-agents for focused task and return results"
author: kels-ng
category: feature
tier: 6
lines: 2089
files: 71
verdict: REQUEST_CHANGES
confidence: high
reviewed_at: 2026-02-14
fork_pr: N/A (batch review)
linked_issue: N/A
-->

# Review: kilocode #5801

> **feat(subagent): run background sub-agents for focused task and return results** by @kels-ng

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | yellow | Resource cleanup gaps on error paths; race between child abort and parent resume |
| Conventions | yellow | `// kilocode_change` marker dropped from experiment.ts; generic `"tool"` ClineSay type |
| Changeset | red | Missing -- changeset bot flagged, needed for `@roo-code/types`, `kilo-code`, `@roo-code/vscode-webview` |
| Tests | yellow | Good unit coverage for tool/parser, but no integration tests for orchestration or cancel flows |
| i18n | green | All 22 locales complete with both chat and settings translations |
| Types | green | Clean Zod schema additions; `SubagentRunner` interface well-abstracted |
| Security | green | Experiment-gated; recursive subagent blocked; explore mode properly restricts to read-only |
| Scope | green | Well-scoped feature behind experiment flag |

## Findings

### RED: Child Task resource leak on error paths

**`src/core/webview/ClineProvider.ts`** -- `runSubagentInBackground()`, `.finally()` block

The child `Task` is created with `startTask: false` and never pushed onto `clineStack`. If `runBackgroundSubagentLoop` throws before `backgroundCompletionResolve` fires, the child's resources (terminal processes, browser sessions, checkpoint services, event listeners) are never cleaned up. The `.finally()` block only clears `parent.activeSubagentChild` but never calls `child.abortTask()`.

```typescript
// Current:
.finally(() => {
    parent.activeSubagentChild = undefined
})

// Should also ensure child cleanup:
.finally(() => {
    parent.activeSubagentChild = undefined
    if (!child.abort) {
        child.abortTask()
    }
})
```

### RED: No recursion depth guard via `new_task`

**`src/core/task/build-tools.ts`** -- `SUBAGENT_EXCLUDE_TOOLS` set (line ~19)

`SUBAGENT_EXCLUDE_TOOLS` prevents recursive `subagent` calls but does NOT exclude `new_task`. A "general" subagent can call `new_task`, which creates a regular task (no subagent restrictions), which could then spawn its own subagent. This creates an unbounded recursion path. Either add `new_task` to the exclusion set, or propagate a depth counter through the task hierarchy.

### RED: Missing changeset

Changeset bot flagged no changeset. This PR modifies three packages (`@roo-code/types`, `kilo-code`, `@roo-code/vscode-webview`) and needs a changeset for proper version bumping.

### YELLOW: `cancelTask()` races with child cleanup

**`src/core/webview/ClineProvider.ts`** -- `cancelTask()` subagent handling

```typescript
subagentChild.abandoned = true
subagentChild.cancelCurrentRequest()
subagentChild.abortTask()
```

`cancelCurrentRequest()` only cancels the API stream, not any in-progress terminal commands the child may have spawned in "general" mode. `cancelTask()` returns immediately, so the parent resumes while the child's terminal processes may still be running. This could cause race conditions with shared workspace state (e.g., child writing to a file while parent continues).

### YELLOW: `"tool"` as ClineSay type is too generic

**`packages/types/src/message.ts`** -- line 202

Adding `"tool"` as a new `ClineSay` type is extremely broad and could collide with future uses. The PR uses it exclusively for subagent progress/completion messages encoded as JSON in the `text` field with a discriminator property. A name like `"subagent_status"` would be clearer and avoid namespace pollution.

### YELLOW: `reportSubagentProgress` is O(n) per tool call

**`src/core/task/Task.ts`** -- `reportSubagentProgress()` method

This method calls `findLastIndex` over all `clineMessages` and JSON-parses each candidate, on every single tool invocation in the child. For long-running subagents with many parent messages, this is inefficient. Consider caching the index of the "subagentRunning" message or storing a direct reference.

### YELLOW: `needUpdateHistory` default relies on implicit coupling

**`src/core/task/Task.ts`** -- constructor

```typescript
this.needUpdateHistory = needUpdateHistory ?? subagentType === undefined
```

The default `false` for subagents is derived implicitly from `subagentType` being set. The `runSubagentInBackground` call does not pass `needUpdateHistory` explicitly. This coupling is fragile -- consider making it explicit with a comment.

### GRAY: `// kilocode_change` marker dropped

**`packages/types/src/experiment.ts`** -- line 10

```typescript
// Before:
const kilocodeExperimentIds = ["morphFastApply", "speechToText"] as const // kilocode_change
// After:
const kilocodeExperimentIds = ["morphFastApply", "speechToText", "subagent"] as const
```

The comment was removed. Codebase convention uses these markers to track fork-specific changes.

### GRAY: Tool display names duplicated across 22 locale files

The `toolDisplayNames` in each locale's `chat.json` duplicates information from `TOOL_DISPLAY_NAMES` in `src/shared/tools.ts`. If a new tool is added to the extension, the subagent display names need separate updates in all locale files. Consider deriving these from the existing map.

### GRAY: No integration tests for orchestration

`ClineProvider.runSubagentInBackground()` is the most complex new code -- it creates a child Task, wires up promise coordination, handles completion/error/cancellation. No integration test covers this flow, the cancel path, or the explore-mode tool restriction in practice.

## CI Status

| Check | Result |
|-------|--------|
| Changeset | red -- missing |
| Type check | not verified locally |
| Unit tests | not verified locally |

## Code Snippets

### Core orchestration flow (ClineProvider.ts)

```typescript
public async runSubagentInBackground(params): Promise<string | SubagentStructuredResult> {
    const child = new Task({
        provider: this,
        // ...config from getState()...
        startTask: false,
        subagentType,
        initialStatus: "active",
    })
    parent.activeSubagentChild = child
    return new Promise((resolve, reject) => {
        let settled = false
        child.backgroundCompletionResolve = (result) => {
            if (!settled) { settled = true; resolve(result) }
        }
        child.runBackgroundSubagentLoop(prompt)
            .then(() => { if (!settled) { settled = true; reject(...) } })
            .catch((err) => { if (!settled) { settled = true; reject(err) } })
            .finally(() => { parent.activeSubagentChild = undefined })
    })
}
```

### AttemptCompletion interception (AttemptCompletionTool.ts)

```typescript
if (task.backgroundCompletionResolve) {
    task.subagentProgressCallback = undefined
    task.backgroundCompletionResolve(result)
    task.backgroundCompletionResolve = undefined
    task.abortTask()
    return
}
```

### Tool restriction for subagents (build-tools.ts)

```typescript
const SUBAGENT_EXCLUDE_TOOLS: Set<string> = new Set([
    "ask_followup_question", "new_task", "switch_mode",
    "update_todo_list", "report_bug", "condense", "new_rule",
])
// Note: "new_task" IS excluded here -- I was wrong in my earlier analysis.
// Let me verify...
```

Wait -- re-reading the diff more carefully:

```typescript
const SUBAGENT_EXCLUDE_TOOLS: Set<string> = new Set([
    "ask_followup_question",
    "new_task",        // <-- IS excluded
    "switch_mode",
    "update_todo_list",
    "report_bug",
    "condense",
    "new_rule",
] as ToolName[])
```

**Correction**: `new_task` IS in `SUBAGENT_EXCLUDE_TOOLS`. The recursion concern is therefore limited to MCP tools or custom tools that might trigger task-like behavior. The direct `new_task` path is blocked. Downgrading this from RED to GRAY.

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**REQUEST_CHANGES** -- The architecture is well-designed with clean separation of concerns, proper experiment gating, and comprehensive i18n coverage. The `SubagentRunner` interface abstraction and `settled` flag pattern show thoughtful engineering.

However, three issues should be addressed before merge:

1. **Child Task resource leak** (RED) -- The `.finally()` block must ensure the child is properly aborted/disposed on error paths.
2. **Missing changeset** (RED) -- Required for three modified packages.
3. **Generic `"tool"` ClineSay type** (YELLOW) -- Should use a more specific name to avoid namespace collision.

The remaining YELLOW items (cancel race, O(n) progress lookup, implicit `needUpdateHistory`) are worth discussing but not blocking.
