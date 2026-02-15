<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5726
title: "Better search UX"
author: bernaferrari
category: feature
tier: 3
lines: 177
files: 4
confidence: 4
verdict: APPROVE
reviewed_at: 2026-02-15
-->

## Review Summary

| Aspect | Assessment |
|--------|------------|
| **Verdict** | APPROVE |
| **Confidence** | 4/5 |
| **Blocking Issues** | 0 |
| **Minor Issues** | 2 |

## What Changed

Adds character-level highlighting to the model search dropdown. When typing a search query, the matching characters in each result are bolded and colored (`text-vscode-textLink-foreground`). This involves three changes:

1. **New `HighlightedText` component** (`webview-ui/src/components/ui/highlighted-text.tsx`) - Takes text and a `Set<number>` of matching positions, renders highlighted spans.
2. **`word-boundary-fzf.ts` refactored** to return `positions: Set<number>` alongside each match result, tracking which character indices matched.
3. **`select-dropdown.tsx` updated** to thread positions through from `fzf.find()` to `HighlightedText`.

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Position tracking logic is sound; tokenize + recursive tryMatch correctly propagate indices |
| Conventions | PASS | Tailwind classes, proper `kilocode_change` markers, `memo` on new component |
| Changeset | PASS | `search-highlight.md` present, `patch` level appropriate |
| Tests | NOTE | Existing tests still pass. No new tests for position tracking, but existing coverage of match logic is thorough |
| i18n | N/A | No user-facing strings added |
| Types | PASS | `matchingPositions?: Set<number>` added cleanly to `DropdownOption` interface |
| Security | N/A | UI-only change |
| Scope | PASS | Focused, self-contained |

## Minor Observations

### 1. `disableSearch` guard removed from `filteredOptions` memo (gray)

**File**: `select-dropdown.tsx`, filteredOptions useMemo

The PR removes the `if (disableSearch || !searchValue) return options` guard and also removes `disableSearch` from the dependency array. When `disableSearch` is true, `fzfInstance.find("")` returns all items with empty position sets, which is functionally equivalent. The behavior is preserved, but the path is slightly less obvious. Not a bug.

### 2. No tests for position accuracy (gray)

The existing `word-boundary-fzf.spec.ts` tests do not assert on `positions` in the returned results. The tests still pass because the return shape changed from `{ item }` to `{ item, positions }` and existing assertions only check `item`. Adding a few position-accuracy tests would strengthen confidence, but this is not blocking.

## CI Status

| Check | Result |
|-------|--------|
| compile | PASS |
| test-extension (ubuntu) | PASS |
| test-extension (windows) | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| test-cli | PASS |
| build-cli | PASS |
| check-translations | PASS |
| test-jetbrains | PASS |

## Code Snippets

The core position-tracking change in `matchAcronym`:

```typescript
// Before: returns boolean
private matchAcronym(text: string, query: string): boolean

// After: returns Set<number> | null (positions of matching chars)
private matchAcronym(tokens: { word: string; index: number }[], query: string): Set<number> | null
```

The `tokenize` method maps each word to its original character index in the source string, enabling accurate position reporting:

```typescript
private tokenize(text: string): { word: string; index: number }[] {
    const tokens: { word: string; index: number }[] = []
    let currentIndex = 0
    const words = text.split(WORD_BOUNDARY_REGEX).filter((w) => w.length > 0)
    for (const word of words) {
        const index = text.indexOf(word, currentIndex)
        if (index !== -1) {
            tokens.push({ word, index })
            currentIndex = index + word.length
        }
    }
    return tokens
}
```

## Verdict

APPROVE. Clean implementation of a useful UX improvement. The author (bernaferrari) has a track record of UI polish contributions. The character-level position tracking is well-integrated into the existing Fzf class without breaking the API contract. All CI passes. The two observations are informational, not blocking.

---
