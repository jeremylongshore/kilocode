<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5641
title: "feat: parallel task execution with git worktrees in main panel"
author: Drilmo
category: feature
tier: 3
lines: 101
files: 1
review_number: 28
-->

# Review Journal: kilocode #5641

> **PR**: [#5641](https://github.com/Kilo-Org/kilocode/pull/5641) |
> **Title**: feat: parallel task execution with git worktrees in main panel |
> **Author**: @Drilmo |
> **Category**: feature | **Tier**: 3 | **Size**: 101 lines, 1 file

---

## Summary

Pure RFC document proposing parallel task execution in the main ClineProvider panel by reusing the Agent Manager's WorktreeManager. The design direction is sound and the referenced components exist. The document is thin on hard integration details. COMMENT -- no objection to merging as a discussion artifact.

## First Impressions

Title says "feat" but the single changed file is a markdown doc at `.github/docs/parallel-tasks-worktree-extension.md`. This is an RFC/design proposal, not a feature implementation. The PR body correctly labels it as "Draft" and "for discussion and design review."

101 lines of markdown, 1 file. Quick review, mostly about design evaluation rather than code correctness.

## What I Looked At

**The RFC document:**
- `.github/docs/parallel-tasks-worktree-extension.md` -- full read

**Verified references on main:**
- `src/core/kilocode/agent-manager/WorktreeManager.ts` -- exists, 16KB, comprehensive worktree operations
- `src/core/webview/ClineProvider.ts` -- exists, 155KB, confirmed `clineStack` has 21 references
- `src/core/kilocode/agent-manager/` directory -- 22 files, full parallel execution infrastructure
- `.github/` directory -- no existing `docs/` or `rfcs/` subdirectory

**Linked issue:**
- [#5640](https://github.com/Kilo-Org/kilocode/issues/5640) -- open feature request, well-written problem statement

## Analysis

### What the RFC Gets Right

1. **Problem statement is clear.** The main panel runs tasks sequentially; the Agent Manager already has parallel execution. Bringing that capability to the main panel is a reasonable feature request.

2. **WorktreeManager reuse is the correct approach.** The existing `WorktreeManager.ts` (16KB) handles worktree creation, cleanup, branch management. Extracting it to a shared location (Phase 1) is the obvious first step.

3. **Non-goals are well-scoped.** Not replacing Agent Manager, no automatic parallelization, no cross-task communication. These boundaries prevent scope creep.

4. **Open questions are honest.** Rather than handwaving, the RFC explicitly lists the unknowns: rate limiting, opt-in behavior, UI design, restart persistence.

### What's Missing

The RFC is a solid starting point but doesn't go deep enough for the hard problems:

**ClineProvider coupling.** ClineProvider.ts is 155KB with 21 `clineStack` references. Replacing `clineStack` with a `TaskManager` is not just swapping a data structure -- it involves:
- State synchronization between active and background tasks
- Webview message routing (which task does a user message go to?)
- History serialization/deserialization per task
- The entire approval/rejection flow (ask/response pairs are task-scoped)

**Checkpoint/undo semantics.** The checkpoint system is git-based. With multiple worktrees, each task has independent checkpoints. The RFC doesn't address what happens when Task 1 modifies a file that Task 2 also needs, or how undo works across the worktree boundary when branches are merged.

**File watcher and diagnostics scoping.** VS Code's built-in file watchers and diagnostic providers (linting, type checking) operate on the workspace root. Worktrees create separate directory trees. Does each task get its own watcher? How do diagnostics route to the correct task's context?

**Terminal session isolation.** Each task needs its own terminal or command execution context scoped to its worktree. The current `ExecuteCommand` tool uses the workspace's terminal.

### Directory Convention

`.github/docs/` is new. The repo has no existing RFC or docs convention under `.github/`. This is fine if the team wants to establish one, but it's worth a conscious decision rather than an ad-hoc creation.

### Title Accuracy

`feat:` conventionally indicates a shipped feature. `docs:` or `rfc:` would be more accurate for a design document. Minor but affects changeset expectations (the bot flagged no changeset, which is correct for docs but confusing with a `feat:` prefix).

## Verification

- **CI**: All 10 checks pass (no code changes, so this is expected).
- **Merge state**: UNKNOWN (no conflicts with docs-only change).
- **Component verification**: All three referenced components (WorktreeManager, ClineProvider, Agent Manager) exist as described in the RFC.

## Lessons Learned

1. **RFCs that reference existing code should be verified.** The RFC claims WorktreeManager can be reused and ClineProvider uses `clineStack`. Both are true. Trust-but-verify on architectural claims saves embarrassment later.

2. **File size is a complexity signal.** ClineProvider at 155KB is a god object. Any RFC proposing to fundamentally change its task model needs to reckon with that complexity directly, not abstract it behind a clean diagram.

3. **Quick reviews still need structure.** Even a 101-line markdown file benefits from checking: does the new directory follow conventions? Are the referenced components real? Is the title accurate? Skipping these for "trivial" PRs is how bad patterns get established.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md) | Reviewed with Claude Code</sub>
