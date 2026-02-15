<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5801
title: "feat(subagent): run background sub-agents for focused task and return results"
author: kels-ng
category: feature
tier: 6
lines: 2089
files: 71
review_number: 23
fork_pr: N/A (batch review)
-->

# Review Journal: kilocode #5801

> **PR**: [#5801](https://github.com/Kilo-Org/kilocode/pull/5801) |
> **Title**: feat(subagent): run background sub-agents for focused task and return results |
> **Author**: @kels-ng |
> **Category**: feature | **Tier**: 6 | **Size**: 2089 lines, 71 files

---

## Summary

Experiment-gated `subagent` tool that spawns a background child task to perform focused sub-work without polluting the parent's context window. Well-architected with clean separation of concerns across 5 layers (types, tool definition, tool handler, orchestration, UI). REQUEST_CHANGES for resource cleanup gaps in error paths, missing changeset, and an overly generic ClineSay type name. Most of the 2,089 lines are i18n translations (42 locale files); the actual logic is roughly 500 lines of new code.

## First Impressions

Title signals a significant architectural addition -- background sub-agents are a paradigm shift for the task model. At 2,089 lines across 71 files, this initially looks massive, but the file list reveals 42 of the 71 files are i18n locale JSON files with identical structures. The actual code changes are concentrated in about 15 files. The PR description is well-written with clear "How to Test" instructions and screenshots. Author proactively notes the PR is big but mostly locales. No existing reviews or comments to incorporate -- this is a fresh review.

## What I Looked At

**Core architecture files (read in full):**
- `src/core/tools/SubagentTool.ts` -- New tool handler (128 lines)
- `src/core/tools/AttemptCompletionTool.ts` -- Existing file with 8-line interception for subagent completion
- `src/core/task/Task.ts` -- ~76 lines added (constructor options, progress reporting, background loop, build-tools integration)
- `src/core/task/build-tools.ts` -- ~46 lines added (subagent tool restrictions)
- `src/core/webview/ClineProvider.ts` -- ~113 lines added (cancel handling, `runSubagentInBackground` orchestration)
- `src/shared/subagent.ts` -- New shared constants/types file (71 lines)
- `src/shared/tools.ts` -- Tool registration, groups, always-available list
- `src/core/prompts/tools/native-tools/subagent.ts` -- OpenAI function schema (36 lines)

**Test files (read in full):**
- `src/core/tools/__tests__/SubagentTool.spec.ts` (190 lines)
- `src/core/task/__tests__/flushPendingToolResultsToHistory.spec.ts` (130 lines added)
- `src/core/assistant-message/__tests__/NativeToolCallParser.spec.ts` (50 lines added)
- `src/core/prompts/tools/__tests__/filter-tools-for-mode.spec.ts` (64 lines added)

**Type definitions:**
- `packages/types/src/experiment.ts`, `message.ts`, `tool.ts`, `vscode-extension-host.ts`

**UI:**
- `webview-ui/src/components/chat/ChatRow.tsx` (131 lines added)
- `webview-ui/src/i18n/locales/en/chat.json` and `settings.json` (representative locale)

**Codebase context files (for comparison):**
- `src/core/tools/BaseTool.ts` -- Base class that SubagentTool extends
- Existing `clineStack` mechanism in ClineProvider
- Existing `cancelTask()` flow

## Analysis

### Architecture: Promise-Bridge Pattern

The core innovation is a promise-bridge pattern between parent and child tasks. The parent invokes `SubagentTool.execute()`, which calls `ClineProvider.runSubagentInBackground()`. This creates a child `Task` with `startTask: false`, sets `backgroundCompletionResolve` on the child, then calls `child.runBackgroundSubagentLoop()`. The child runs its own agentic loop with restricted tools. When the child calls `attempt_completion`, `AttemptCompletionTool` checks for `backgroundCompletionResolve` and resolves the parent's promise instead of showing the normal completion UI. The parent receives the result as its tool result and continues.

Key design decisions:
1. **Child does NOT join `clineStack`** -- This is correct. The stack controls which task is "current" for UI purposes. Subagents should be invisible to the user.
2. **`needUpdateHistory = false` for subagents** -- Subagents are transient and should not appear in task history. Good call.
3. **`activeSubagentChild` on parent Task** -- Single-slot reference enables cancel routing. Only one subagent at a time per parent, which is the right constraint.
4. **`SubagentRunner` interface** -- Decouples SubagentTool from ClineProvider, enabling testability. The `isSubagentRunner` type guard is a nice touch.

### Tool Restriction: Explore vs General

The `applySubagentToolRestrictions()` function in `build-tools.ts` applies two layers:
- **Explore mode**: Only `TOOL_GROUPS.read.tools` + `attempt_completion` are allowed. This is: `read_file`, `fetch_instructions`, `search_files`, `list_files`, `codebase_search`, `attempt_completion`. Correct and minimal.
- **All subagents**: `subagent` itself is excluded (prevents recursion), plus interactive/UI tools: `ask_followup_question`, `new_task`, `switch_mode`, `update_todo_list`, `report_bug`, `condense`, `new_rule`.

I initially flagged `new_task` as missing from exclusions but on careful re-read it IS included. Self-corrected in the review.

### Cancel Flow

When the user clicks cancel while a subagent is running:
1. `cancelTask()` checks `task.activeSubagentChild`
2. If present, resolves the child's `backgroundCompletionResolve` with `SUBAGENT_CANCELLED_STRUCTURED_RESULT`
3. Sets child `abandoned = true`, calls `cancelCurrentRequest()` and `abortTask()`
4. Returns immediately -- the parent task receives the cancellation result and continues

The concern is that "returns immediately" means the parent resumes while the child may still have in-flight terminal commands. For read-only "explore" subagents this is fine (no side effects). For "general" subagents that may have spawned terminal processes, there is a theoretical race window.

### Resource Cleanup Gap

The critical finding is in `runSubagentInBackground()`. The child Task allocates resources in its constructor and during `runBackgroundSubagentLoop()`. If the loop throws (API error, network timeout, etc.), the `.then()` or `.catch()` handlers reject the promise, but the `.finally()` block only clears `parent.activeSubagentChild`. The child Task is never `abortTask()`'d, meaning its internal resources (API handler, terminal references, event listeners) may leak.

### ClineSay "tool" Type

The new `"tool"` ClineSay type is used with JSON payloads in the `text` field:
```json
{"tool": "subagentRunning", "description": "...", "currentTask": "..."}
{"tool": "subagentCompleted", "description": "...", "result": "..."}
```

This is a generic discriminated-union-over-JSON pattern. The `ChatRow.tsx` component parses `sayTool` from the message and switches on the `tool` field. The problem is `"tool"` as a ClineSay type is so broad it could apply to anything. Future tools might want their own progress messages and would either reuse this generic type (leading to a growing switch statement) or add their own (making `"tool"` confusing). A more specific name avoids this.

## Verification

- **Local build/test**: Not run (codespace not started for this review)
- **CI**: Changeset bot flagged missing changeset
- **Existing reviews**: None -- this is the first review
- **Author context**: kels-ng is a new contributor (first PR to this repo based on the fork URL pattern)

## Diagrams

```
Parent Task                          SubagentTool                    ClineProvider                      Child Task
    |                                    |                               |                                |
    |--- tool_use: subagent ------------>|                               |                                |
    |                                    |--- runSubagentInBackground -->|                                |
    |                                    |                               |--- new Task(startTask:false) ->|
    |                                    |                               |--- set backgroundCompletionResolve
    |                                    |                               |--- runBackgroundSubagentLoop -->|
    |                                    |                               |                                |
    |                                    |                               |          [agentic loop runs]    |
    |                                    |                               |          read_file, search...   |
    |                                    |                               |                                |
    |                                    |                               |<-- attempt_completion ----------|
    |                                    |                               |    backgroundCompletionResolve(result)
    |                                    |                               |    abortTask()                  |
    |                                    |<-- resolve(result) -----------|                                |
    |<--- pushToolResult(result) --------|                               |                                |
    |                                    |                               |                                |
    | [parent continues with result]     |                               |                                |
```

## Bot Review Synthesis

| Bot | Status | Key Finding | Useful? |
|-----|--------|-------------|---------|
| CodeRabbit | Not collected | Batch review — no individual fork PR | N/A |
| Gemini | Not collected | Batch review — no individual fork PR | N/A |
| Greptile | Not collected | Batch review — no individual fork PR | N/A |
| CodeQL | Not collected | Batch review — no individual fork PR | N/A |
| Qodo | Not collected | Batch review — no individual fork PR | N/A |

## Lessons Learned

1. **i18n inflates line counts**: 42 of 71 files are locale translations. Always check the file list before estimating review effort from raw line counts. The actual logic is ~500 lines.

2. **Promise-bridge pattern for background tasks**: Creating a child task with a resolve callback injected into its completion handler is an elegant way to run background work without disrupting the parent's context. The `settled` flag pattern for three-way race prevention (completion, normal exit, error) is worth noting as a reusable pattern.

3. **Self-correction matters**: I initially flagged `new_task` as missing from `SUBAGENT_EXCLUDE_TOOLS`, which would have been a critical recursion vulnerability. On careful re-read of the diff, it IS included. Always re-verify findings against the actual diff before committing to a severity rating.

4. **ClineSay namespace management**: Adding generic type names to discriminated unions creates future maintenance burden. Prefer specific names even if they are longer.

5. **Task lifecycle management is the hardest part**: The `Task` class in this codebase is enormous (~4600 lines) with complex lifecycle management. Any feature that creates Task instances outside the normal `clineStack` flow needs extra care around resource cleanup, as the normal disposal paths assume stack-based lifecycle management.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
