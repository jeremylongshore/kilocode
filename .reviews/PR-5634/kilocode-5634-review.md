<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5634
title: "fix: context condensing prompt not saving properly"
author: Patel230
category: fix
tier: 2
lines: 33
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
| **Suggestions** | 1 (minor) |

## Checklist

- [x] Changeset included
- [x] Addresses input flickering during typing
- [x] Clean local state pattern

## Analysis

The fix uses a standard React pattern for controlled inputs that sync with external state:

1. `localCondensingPrompt` — immediate local state during editing
2. `onBlur` — syncs local state back to extension state
3. `useEffect` — initializes local state when switching to CONDENSE tab

This prevents the "flickering" problem where typing triggers a round-trip to extension state, which updates the textarea, resetting cursor position.

The pattern is applied only to the CONDENSE prompt type (not ENHANCE), which suggests the issue is specific to how condensing prompt state is managed upstream.

## Suggestion

The `onBlur` handler duplicates the value extraction logic from `onChange`. Consider extracting to a shared helper:

```typescript
const extractValue = (e: any) =>
  (e as unknown as CustomEvent)?.detail?.target?.value ??
  ((e as any).target as HTMLTextAreaElement).value
```

Minor — not blocking.

## Recommendation

**APPROVE** — Correct fix for a common React controlled input issue. Merge.

---
