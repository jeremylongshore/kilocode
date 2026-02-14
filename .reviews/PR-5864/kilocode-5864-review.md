<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5864
title: "fix: organization selector overlapping with Recent text in chat pane"
author: Githubguy132010
category: fix
tier: 2
lines: 35
files: 2
confidence: 4
verdict: APPROVE
fork_pr: null
-->

## Review Summary

| Aspect | Assessment |
|--------|------------|
| **Verdict** | APPROVE |
| **Confidence** | 4/5 |
| **Blocking Issues** | 0 |

## Checklist

- [x] Changeset included
- [x] Before/after screenshots provided
- [x] Fixes #5863

## Analysis

The fix replaces `absolute` positioning with proper flexbox layout:

**Before**: OrganizationSelector used `absolute top-2 right-3`, which didn't flow with the "Recent Tasks" text — they overlapped.

**After**: Both elements share a flex row container with `justify-between`. The org selector gets `w-40 shrink-0 ml-auto` to maintain size and push right.

Key structural change:
```diff
- <div className="absolute top-2 right-3">
-   <OrganizationSelector />
- </div>
+ <OrganizationSelector className="w-40 shrink-0 ml-auto" />
```

The conditional rendering logic is preserved — "Recent Tasks" only shows when `taskHistoryFullLength !== 0`, org selector only shows when `!showTelemetryBanner`.

## Note

Fixed width `w-40` (10rem/160px) is hardcoded. If the org selector content grows beyond this, it could truncate. Acceptable for current UI, but worth monitoring.

## Recommendation

**APPROVE** — Clean CSS fix with proper before/after evidence. Merge.

---
