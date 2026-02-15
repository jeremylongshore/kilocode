<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5634
title: "fix: context condensing prompt not saving properly"
author: Patel230
category: fix
tier: 2
lines: +31/-2
files: 2
review_number: N/A
fork_pr: N/A (batch review)
-->

# Review Journal: kilocode #5634

> **PR**: [#5634](https://github.com/Kilo-Org/kilocode/pull/5634) |
> **Title**: fix: context condensing prompt not saving properly |
> **Author**: @Patel230 |
> **Category**: fix | **Tier**: 2 | **Size**: +31/-2 lines, 2 files

---

## Summary

Fixes textarea flickering when editing the condensing prompt by introducing a local state pattern. Before: typing triggered a round-trip through extension state, causing cursor reset and text flickering. After: local state handles immediate input, syncs to extension state on blur. APPROVE.

## What Changed

Two files:

1. **`PromptsSettings.tsx`** -- Adds `localCondensingPrompt` state variable and three integration points:
   - **Initialization**: `useEffect` sets local state from extension state when switching to the CONDENSE tab
   - **Typing**: `onChange` updates local state immediately for the CONDENSE type (in addition to the existing `updateSupportPrompt` call)
   - **Blur**: `onBlur` clears local state and syncs the final value to extension state
   - **Read**: `getSupportPromptValue()` prioritizes `localCondensingPrompt` over `customCondensingPrompt` over default

2. **`fix-condensing-prompt.md`** -- Changeset (patch for `kilo-code`).

## Analysis

The root cause: the CONDENSE prompt textarea was a controlled input whose value came from extension state. Each keystroke triggered:
1. User types character
2. `onChange` calls `updateSupportPrompt()` which sends the value to the extension host
3. Extension host processes and stores the value
4. Extension host sends updated state back to the webview
5. React re-renders with the new value from extension state

Steps 2-4 introduce latency. During that latency, the textarea's value may revert to the previous state, causing visible flickering and cursor jumps.

The local state pattern breaks this cycle: the textarea's value comes from `localCondensingPrompt` (immediate, no round-trip) while `updateSupportPrompt()` still runs in the background to sync with the extension host. On blur, local state is cleared and the final value is committed.

This is the same root cause family as PR #5826 (VS Code web components resetting values), though the mechanism differs: here the issue is extension host latency rather than web component internal state. Both are solved by keeping the textarea's immediate value in local React state.

The `useEffect` dependency on `[activeSupportOption, customCondensingPrompt]` is correct -- it reinitializes when either the tab changes or the extension state changes (e.g., from a reset-to-defaults action).

The `onBlur` handler's `setLocalCondensingPrompt(undefined)` is important: it returns the textarea to reading from extension state, ensuring consistency when the user stops editing. Without this, stale local state could persist.

## Bot Review Synthesis

| Bot | Status | Key Finding | Useful? |
|-----|--------|-------------|---------|
| CodeRabbit | Not collected | Batch review | N/A |
| Gemini | Not collected | Batch review | N/A |
| Greptile | Not collected | Batch review | N/A |
| CodeQL | Not collected | Batch review | N/A |
| Qodo | Not collected | Batch review | N/A |

## Lessons Learned

- Local state prevents controlled input flickering when the source of truth has round-trip latency (e.g., VS Code extension host). The pattern is: local state for immediate updates, sync to external state on blur.
- VS Code web components and extension host latency are two different causes of the same symptom (input flickering). Both are solved by keeping immediate textarea value in local React state.
- The `undefined` reset on blur is a critical detail -- without it, local state goes stale and masks updates from the extension host.

---

<sub>Batch review | Static analysis only | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
