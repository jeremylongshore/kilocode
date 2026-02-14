<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5466
title: "feat: display generated session names in task history UI"
author: app/kiloconnect
category: feature
tier: 2
lines: 75
files: 5
confidence: 5
verdict: APPROVE
fork_pr: null
-->

## Review Summary

| Aspect | Assessment |
|--------|------------|
| **Verdict** | APPROVE |
| **Confidence** | 5/5 |
| **Blocking Issues** | 0 |

## Checklist

- [x] Changeset included
- [x] Maintainer approved (@kevinvandijk)
- [x] Tests included (3 new tests: title present, title absent, empty title fallback)
- [x] Schema updated (optional `title` field)
- [x] Backward compatible (falls back to `task` when no title)

## Analysis

Clean feature implementation across 5 files:

1. **Schema** (`history.ts`): Adds optional `title` field — backward compatible
2. **Session manager** (`session-manager-utils.ts`): Persists generated title to task history when session title is generated
3. **UI** (`TaskItem.tsx`): Displays `title || task` — clean fallback
4. **Tests** (`TaskItem.spec.tsx`): 3 new tests covering title, no title, empty title cases
5. **Changeset**: Included

The `item.title || item.task` fallback is correct — empty string (`""`) is falsy, so it properly falls back to `task`.

## Recommendation

**APPROVE** — Well-structured feature with tests and maintainer sign-off. Merge.

---
