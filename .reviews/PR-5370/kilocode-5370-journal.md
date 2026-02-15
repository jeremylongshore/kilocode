<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5370
title: "fix: preserve original line_ranges format in API history for anthropic-provider"
author: eliasyin
category: fix
tier: 3
lines: 59
files: 4
review_number: 20
fork_pr: https://github.com/jeremylongshore/kilocode/pull/13
-->

# Review Journal: kilocode #5370

> **PR**: [#5370](https://github.com/Kilo-Org/kilocode/pull/5370) |
> **Author**: @eliasyin | **Size**: 59 lines, 4 files | **Confidence**: 4/5

## Summary

Preserves original API parameter format (`line_ranges: [[1, 50]]`) in conversation history instead of the internally transformed format (`lineRanges: [{start: 1, end: 50}]`). The fix adds a `rawInput` field to `ToolUse` that captures the pre-transformation arguments. COMMENT — needs rebase and changeset, but the code itself is clean.

## What Changed

The Anthropic API returns tool parameters in snake_case with tuple arrays. Kilo Code's `NativeToolCallParser` transforms these into camelCase with object arrays for internal use. The problem: when saving tool calls back to conversation history for the next API turn, the transformed format was being used instead of the original. This PR adds a `rawInput` field that stores the original format before transformation.

Four files, each with a clear responsibility:
1. **`tools.ts`** — Adds `rawInput?: Record<string, unknown>` to the `ToolUse` interface
2. **`NativeToolCallParser.ts`** — Saves raw `args` to `rawInput` during parsing
3. **`Task.ts`** — Uses `rawInput` (then `nativeArgs`, then `params`) when building history
4. **`NativeToolCallParser.spec.ts`** — Test proving the preservation works

## Verification

### Regression (did we break anything?)

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | FAIL | 19/20 — `NotificationService.ts` error is pre-existing on this branch, not from PR. Upstream main passes 22/22. |
| Lint | `pnpm lint` | PASS | 16/16 packages |
| Unit Tests | `pnpm test --continue` | PASS | 7,524 tests, 0 failures |

### Behavioral (does the fix work?)

| Test | Assertion | Result |
|------|-----------|--------|
| rawInput preserves tuples | `line_ranges: [[1920, 1990]]` stored as-is | PASS |
| nativeArgs still transforms | `lineRanges: [{start: 1920, end: 1990}]` for runtime | PASS |

## Lessons Learned

- Stale branches in active monorepos can have type errors that aren't related to the PR's changes. Always verify the error is in a file the PR touches before attributing it to the PR.
- The `NativeToolCallParser` → `Task` pipeline has three distinct representations of tool arguments: `rawInput` (API-original), `nativeArgs` (transformed), and `params` (legacy XML-parsed). The fallback chain `rawInput || nativeArgs || params` is the correct order.
- No upstream CI means the branch needs a rebase. GitHub Actions only trigger when the branch is up-to-date enough to create a merge commit.

---

<sub>Review #20 of 75 | [Multi-AI analysis](https://github.com/jeremylongshore/kilocode/pull/13) | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews)</sub>
