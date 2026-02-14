<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5838
title: "fix: prevent false unsaved changes dialogs in settings"
author: wombatepiclandingstudio
category: fix
tier: 2
lines: 49
files: 4
review_number: 16
fork_pr: null
-->

# Review Journal: kilocode #5838

> **PR**: [#5838](https://github.com/Kilo-Org/kilocode/pull/5838) |
> **Author**: @wombatepiclandingstudio | **Size**: 49 lines, 4 files | **Confidence**: 4/5

## Summary

Prevents false "unsaved changes" dialogs by distinguishing user-initiated vs programmatic state updates. Adds an `isInternal` parameter to `setCachedStateField` so only user changes trigger the unsaved changes warning. COMMENT — approach is solid but CHANGES_REQUESTED by maintainer @kevinvandijk, waiting for contributor revision.

## What Changed

Four files modified:
1. **`SettingsView.tsx`** — Adds `isInternal` parameter to `setCachedStateField`, only sets `changeDetected = true` for non-internal updates
2. **`types.ts`** — Updates type definition to include the new parameter
3. **Tests** — Unskips 5 previously-skipped tests that verify this behavior
4. **Changeset** — Included

The root cause: programmatic state updates (e.g., loading defaults, switching tabs) were being treated the same as user edits, triggering the "you have unsaved changes" dialog when nothing was actually modified by the user.

## Analysis

The approach is clean — `isInternal: boolean` is a simple flag that correctly separates the two update paths. The 5 unskipped tests were already written and waiting for this fix, which suggests the maintainers anticipated this solution.

Contributor acknowledged @kevinvandijk's feedback and said they forgot to move the PR back to draft. This is a sign of a responsive contributor who will address the revision.

## Lessons Learned

- CHANGES_REQUESTED by a maintainer = wait for the contributor to revise. Don't approve over a maintainer's objection.
- Previously-skipped tests that match a PR's fix are a strong signal the approach is on the right track

---

<sub>Review #16 of 75 | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews)</sub>
