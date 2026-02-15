<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5801
title: "feat(subagent): run background sub-agents for focused task and return results"
author: kels-ng
category: feature
tier: 6
lines: 2089
files: 71
review_number: 73
-->

# Review Journal: kilocode #5801

> **PR**: [#5801](https://github.com/Kilo-Org/kilocode/pull/5801) |
> **Title**: feat(subagent): run background sub-agents for focused task and return results |
> **Author**: @kels-ng |
> **Category**: feature | **Tier**: 6 | **Size**: 2089 lines, 71 files

---

## Summary

Adds a new `subagent` tool that lets the AI spawn background child tasks for research or subtasks. Two modes: "explore" (read-only) and "general" (full tools). The parent task stays current while the child runs, and the child's completion result is returned as the tool result. Gated behind an experiment flag. Well-tested but missing changeset and CI.

## First Impressions

The PR is large by file count (71) but the bulk is i18n translations -- 48+ locale files with `subagents` namespace strings. The actual feature code is concentrated in about 12 files totaling ~600 lines. The architecture follows existing patterns: new tool class extending `BaseTool`, experiment flag gating, tool filtering in `build-tools.ts`, and UI rendering in `ChatRow.tsx`.

## What I Looked At

- `src/core/tools/SubagentTool.ts` -- New tool class (128 lines), parameter validation, calls `provider.runSubagentInBackground()`
- `src/shared/subagent.ts` -- Shared constants, types, and interfaces (71 lines). Clean single-file module.
- `src/core/task/Task.ts` -- `runBackgroundSubagentLoop()`, `reportSubagentProgress()`, `backgroundCompletionResolve`, `needUpdateHistory` flag
- `src/core/webview/ClineProvider.ts` -- `runSubagentInBackground()` (92 lines), cancellation handling in `cancelTask()`
- `src/core/task/build-tools.ts` -- `applySubagentToolRestrictions()` for explore/general mode filtering
- `src/core/prompts/tools/native-tools/subagent.ts` -- Tool definition with `strict: true` and enum-constrained parameters
- `webview-ui/src/components/chat/ChatRow.tsx` -- UI rendering for running/completed states
- `src/core/tools/__tests__/SubagentTool.spec.ts` -- 190 lines covering success, cancellation, missing params, provider errors

## Analysis

**Architecture**: The design mirrors the existing `new_task` tool but with a key difference -- subagents run in the background without switching the user's view. The `backgroundCompletionResolve` pattern (a promise resolve stored on the Task instance) is the mechanism that bridges the child's `attempt_completion` back to the parent's tool result. The `settled` guard in `runSubagentInBackground` prevents double-resolution, which is important since both the `.then()` and `backgroundCompletionResolve` could fire.

**Tool restriction**: The `applySubagentToolRestrictions` function in `build-tools.ts` enforces two layers: (1) explore mode limits to read-only tools + `attempt_completion`, and (2) all subagents exclude interactive tools like `ask_followup_question`, `new_task`, `switch_mode`, and recursion prevention (no nested `subagent`). This is enforced at the tool-list level, meaning the LLM never sees the restricted tools in its available set.

**Cancellation**: When the user cancels during a subagent, `ClineProvider.cancelTask()` now checks for `activeSubagentChild` first. If present, it cancels only the child (via `backgroundCompletionResolve` with `SUBAGENT_CANCELLED_STRUCTURED_RESULT`), leaving the parent running. The parent receives a "Subagent was cancelled by the user" message and can continue. This is the right UX.

**Progress reporting**: The child task's progress is relayed to the parent's UI via `subagentProgressCallback`, which updates the last `subagentRunning` message in the parent's `clineMessages` array. The `parseSubagentCurrentTask` function in ChatRow.tsx parses tool descriptions like `[read_file for 15 files]` into structured display.

**History suppression**: `needUpdateHistory` defaults to `false` when `subagentType` is set, preventing subagent runs from polluting the user's task history. This is a good UX decision.

## Verification

- CI: No checks reported on the `subtak_cursor` branch
- Changeset: Missing (confirmed by changeset-bot)
- Author: Responsive, open to discussion ("We can start from this point")
- Tests: Comprehensive coverage for SubagentTool, NativeToolCallParser, filter-tools-for-mode, and reportSubagentProgress

## Lessons Learned

1. Background task patterns (promise resolve stored on instance, settled guard) are an effective way to bridge async child completions back to synchronous tool results, but require careful cleanup on all exit paths.
2. Tool restriction by filtering the tool list is more robust than runtime guards -- the LLM cannot call what it cannot see.
3. Experiment flags are the right gating mechanism for features that change the agent's capability surface area. The `SUBAGENT` experiment is disabled by default.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
