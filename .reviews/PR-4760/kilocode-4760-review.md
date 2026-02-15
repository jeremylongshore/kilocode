<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 4760
title: "Feat: Workflow tool allows Kilo to run slash commands autonomously"
author: James-Cherished
category: feature
tier: 6
lines: 2665
files: 52
verdict: COMMENT
confidence: 4
reviewed_at: 2026-02-15
-->

# Review: kilocode #4760

> **Feat: Workflow tool allows Kilo to run slash commands autonomously** by @James-Cherished

[Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Summary

Implements AI-driven workflow discovery and execution, allowing the agent to find workflows from `.kilocode/workflows/` and execute them via a `run_slash_command` tool. The implementation is well-structured with good test coverage (45 tests across 4 suites), proper fork markers, and a thoughtful workflow discovery service with caching. However, the maintainers have closed this in favor of the ground-up rebuild.

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | Pass | Workflow discovery, execution, and UI rendering work as described |
| Conventions | Pass | kilocode_change markers present throughout, follows existing tool patterns |
| Changeset | Pass | Six changesets included covering each logical change |
| Tests | Pass | 45 tests across 4 suites: workflow service (10), tool (10), UI (22), ChatRow (3) |
| i18n | Pass | Translation keys updated across 20+ locales |
| Types | Pass | Experiment types updated, new workflow types defined |
| Security | Concern | Auto-execute mode bypasses approval with catch-and-ignore pattern |
| Scope | Pass | Focused on workflow execution with reasonable boundaries |

## Findings

### 1. (Yellow) Auto-execute bypasses approval with catch-and-ignore
**File:** `src/core/tools/RunSlashCommandTool.ts:82-85`
```typescript
// When auto-execute is enabled, send message to webview without waiting for approval
await task.ask("tool", toolMessage, false).catch(() => {})
```
When `AUTO_EXECUTE_WORKFLOW` is enabled, the tool bypasses the approval flow entirely. The `ask` is called only for UI display, and errors are silently swallowed. This means the agent can read and execute any workflow content without user confirmation. While gated by an experimental flag, the `.catch(() => {})` pattern hides real errors that should be logged.

### 2. (Yellow) Experiment consolidation silently enables workflow discovery
**File:** `packages/types/src/experiment.ts`
The PR renames `RUN_SLASH_COMMAND` to `AUTO_EXECUTE_WORKFLOW` and removes `WORKFLOW_DISCOVERY` as a separate experiment. Workflow discovery becomes always-on (no longer gated by a flag), and the experiment only controls whether execution requires approval. Users who had the old experiment disabled get workflow discovery silently enabled.

### 3. (Yellow) No content size limit on loaded workflows
**File:** `src/services/workflow/workflows.ts`
Workflow content is loaded by reading markdown files with `gray-matter` for frontmatter parsing. There is no size limit on the content loaded into the agent context. A maliciously large markdown file in `.kilocode/workflows/` could consume the full context window.

### 4. (Gray) Symlink resolution is well-implemented
**File:** `src/services/workflow/workflows.ts:37-70`
The symlink resolution has a `MAX_DEPTH = 5` guard against cyclic symlinks and properly resolves nested symlinks. Solid defensive coding.

### 5. (Gray) WorkflowDiscoveryService has clean caching
**File:** `src/core/workflow-discovery/WorkflowDiscoveryService.ts`
Per-workspace cache with TTL (5 minutes default), cache invalidation, and proper separation of cached data from enabled-status application. Avoids redundant filesystem scans.

### 6. (Gray) UI integration reuses SlashCommandItem component
**File:** `webview-ui/src/components/chat/SlashCommandItem.tsx`
Extended with workflow execution display mode including source badges and expandable details. 22 UI tests cover both modes thoroughly.

## CI Status

| Check | Result |
|-------|--------|
| CI | No checks reported on branch |

## Verdict

**COMMENT** -- Well-implemented feature with good test coverage, proper fork markers, and thoughtful architecture. The auto-execute bypass and experiment consolidation warrant attention but are behind experimental flags. The maintainers have closed this PR in favor of the ground-up rebuild with an offer of credits to the contributor. The implementation quality suggests the contributor understood the codebase well. For the rebuild, recommend carrying forward the workflow discovery service architecture and caching pattern, and adding content size limits on loaded workflows.
