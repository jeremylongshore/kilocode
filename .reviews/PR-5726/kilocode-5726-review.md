<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5726
title: "Better search UX"
author: bernaferrari
category: feature
tier: 3
lines: 177
files: 4
verdict: APPROVE
confidence: 4
reviewed_at: 2026-02-14
linked_issue: none
fork_pr: https://github.com/jeremylongshore/kilocode/pull/20
-->

# Review: kilocode #5726

> **Better search UX** by @bernaferrari
> Multi-AI analysis: [Fork PR #20](https://github.com/jeremylongshore/kilocode/pull/20) — reviewed by Gemini, Qodo

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Position tracking integrated correctly into fuzzy matcher |
| Conventions | PASS | Uses `// kilocode_change` markers, follows webview patterns |
| Changeset | PASS | Patch changeset included |
| Tests | WARN | No tests for new `HighlightedText` component |
| i18n | N/A | No user-facing strings |
| Types | PASS | Clean TypeScript, proper interface extension |
| Security | PASS | No security implications |
| Scope | PASS | Focused on search highlighting in model selector |

## Findings

### GRAY: `disableSearch` guard removed from `filteredOptions`

`select-dropdown.tsx:139` — The previous code had an early return:
```typescript
if (disableSearch || !searchValue) return options
```
This was removed along with `disableSearch` from the useMemo dependency array. The new code always runs through `fzfInstance.find(searchValue)`, which returns all items for empty queries. Functionally equivalent in normal use (search is empty when disabled), but the guard was a clearer signal of intent.

### GRAY: No tests for HighlightedText

`highlighted-text.tsx` is a 60-line React component with character-level grouping logic. It's a pure rendering component (low risk), but the grouping algorithm has edge cases worth covering:
- Empty positions set
- Consecutive vs non-consecutive matches
- All characters matched
- Single character text

### GRAY: Set cloning in recursive backtracking

`word-boundary-fzf.ts:133` — `new Set(currentPositions)` is called at each recursion level for branching. For typical model names (short strings, few word boundaries), this is negligible. Could become expensive with very long option labels and pathological queries, but that's unlikely in this context.

## CI Status

| Check | Result |
|-------|--------|
| build-cli | PASS |
| compile | PASS |
| check-translations | PASS |
| test-cli | PASS |
| test-extension (ubuntu) | PASS |
| test-extension (windows) | PASS |
| test-jetbrains | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| unit-test | PASS |
| Build Markdoc Site | PASS |

All 11 upstream CI checks pass.

## Local Verification

We merged this PR on our fork and ran the full test suite.

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | PASS | 22/22 packages |
| Lint | `pnpm lint` | PASS | 18/18 packages |
| Unit Tests | `pnpm test` | PASS | 3,540 passed, 46 skipped, pre-existing failures only |

*Pre-existing failures (not from this PR): `@kilocode/agent-runtime` 4 applyEdit tests.

> Tested on fork branch [`review/PR-5726`](https://github.com/jeremylongshore/kilocode/tree/review/PR-5726) | Evidence: `test-evidence-PR-5726.log` (5,231 lines)

## Code Snippets

### New HighlightedText component:
```typescript
// highlighted-text.tsx — groups consecutive matched/unmatched characters into chunks
export const HighlightedText = memo(({ text, matchingPositions, className }) => {
  if (!matchingPositions || matchingPositions.size === 0) {
    return <span className={className}>{text}</span>
  }
  // Groups consecutive characters into spans for efficient rendering
  // Matched chars: <span className="font-bold text-vscode-textLink-foreground">
  // Unmatched chars: plain <span>
})
```

### Position tracking in fuzzy matcher:
```typescript
// word-boundary-fzf.ts — matchAcronym now returns positions
private matchAcronym(tokens, query): Set<number> | null {
  const tryMatch = (wordIdx, queryIdx, currentPositions): Set<number> | null => {
    if (queryIdx === query.length) return currentPositions  // consumed entire query
    // Track absolute position: token.index + matchedInWord
    nextPositions.add(token.index + matchedInWord)
  }
  return tryMatch(0, 0, new Set())
}
```

### Integration in select-dropdown:
```typescript
// select-dropdown.tsx — passes positions from fzf to HighlightedText
const matchingResults = fzfInstance.find(searchValue)
const matchMap = new Map(matchingResults.map((r) => [r.item.original.value, r.positions]))
// Clone option to add matchingPositions without mutating original
acc.push({ ...option, matchingPositions: positions })
```

## Verdict

**APPROVE** — Clean UX enhancement that adds character-level highlighting to fuzzy search in the model selector. The approach is architecturally sound: positions are tracked during the matching algorithm (not reconstructed post-hoc), passed through the option pipeline without mutation, and rendered in a performant memo'd component that groups consecutive characters. All concerns are GRAY — minor code quality observations, nothing blocking.
