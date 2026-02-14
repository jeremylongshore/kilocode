<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5838
title: "fix: prevent false unsaved changes dialogs in settings"
author: wombatepiclandingstudio
category: fix
tier: 2
lines: 49
files: 4
confidence: 4
verdict: COMMENT
fork_pr: null
-->

## Review Summary

| Aspect | Assessment |
|--------|------------|
| **Verdict** | COMMENT (awaiting contributor revision) |
| **Confidence** | 4/5 |
| **Status** | CHANGES_REQUESTED by @kevinvandijk |

## Current Status

Maintainer @kevinvandijk requested changes. Contributor acknowledged:
> "Sure! I was looking into it, forgot to move it back to draft, my bad"

**Do not merge until contributor addresses feedback.**

## Code Review (for when it's ready)

The approach is solid:
- Adds `isInternal` parameter to `setCachedStateField` to distinguish user vs programmatic updates
- Only sets `changeDetected = true` for user-initiated changes
- Unskips 5 previously-skipped tests that verify this behavior
- Type definition updated in `types.ts`

The fix correctly addresses the root cause described in the TODO comments that existed before this PR.

## When Ready

Once contributor addresses @kevinvandijk's feedback, this should be safe to merge. The approach is clean, tests are comprehensive, and changeset is included.

---
