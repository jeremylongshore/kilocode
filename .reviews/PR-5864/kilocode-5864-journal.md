<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5864
title: "fix: organization selector overlapping with Recent text in chat pane"
author: Githubguy132010
category: fix
tier: 2
lines: 35
files: 2
review_number: 14
fork_pr: null
-->

# Review Journal: kilocode #5864

> **PR**: [#5864](https://github.com/Kilo-Org/kilocode/pull/5864) |
> **Author**: @Githubguy132010 | **Size**: 35 lines, 2 files | **Confidence**: 4/5

## Summary

Fixes the organization selector overlapping with "Recent Tasks" text by replacing `absolute` positioning with flexbox layout. Before/after screenshots in the PR confirm the fix. APPROVE with changeset.

## What Changed

The OrganizationSelector was positioned with `absolute top-2 right-3`, which placed it on top of the "Recent Tasks" text rather than flowing alongside it. The fix wraps both elements in a flex row with `justify-between`, so they share horizontal space naturally.

Key structural change:
```diff
- <div className="absolute top-2 right-3">
-   <OrganizationSelector />
- </div>
+ <OrganizationSelector className="w-40 shrink-0 ml-auto" />
```

## Analysis

The fixed width `w-40` (160px) is hardcoded. If the org selector content ever grows beyond this, it would truncate. Acceptable for the current UI since org names are typically short, but worth watching if the feature evolves.

The conditional rendering logic (`taskHistoryFullLength !== 0` for "Recent Tasks", `!showTelemetryBanner` for org selector) is preserved correctly.

## Lessons Learned

- UI fixes with before/after screenshots are self-documenting — the evidence is in the PR itself
- `absolute` positioning for elements that need to flow with siblings is a common layout bug; flexbox is almost always the right fix

---

<sub>Review #14 of 75 | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews)</sub>
