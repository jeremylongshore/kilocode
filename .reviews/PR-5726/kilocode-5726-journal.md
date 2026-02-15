<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5726
title: "Better search UX"
author: bernaferrari
category: feature
tier: 3
lines: 177
files: 4
review_number: 26
fork_pr: https://github.com/jeremylongshore/kilocode/pull/20
-->

# Review Journal: kilocode #5726

> **PR**: [#5726](https://github.com/Kilo-Org/kilocode/pull/5726) |
> **Title**: Better search UX |
> **Author**: @bernaferrari |
> **Category**: feature | **Tier**: 3 | **Size**: 177 lines, 4 files

---

## Summary

Adds character-level highlighting to the fuzzy search in the model selector dropdown. When you type a query, matching characters are bolded with a link-color accent. The implementation tracks match positions inside the fuzzy matching algorithm rather than reconstructing them after the fact — the right approach for accuracy.

## First Impressions

"Better search UX" is subjective, and the author says as much in the PR description: "This is totally subjective (as with 90% of my contributions) and you are welcome to reject." But the before/after screenshots speak for themselves — highlighted matching characters are a standard UX pattern in fuzzy finders (VS Code's command palette, fzf terminals, Spotlight). This brings the model selector in line with user expectations.

@bernaferrari is a repeat contributor to kilocode. The PR is well-scoped: exactly the files needed, nothing extra.

## What I Looked At

- `webview-ui/src/components/ui/highlighted-text.tsx` — New component (60 lines)
- `webview-ui/src/components/ui/select-dropdown.tsx` — Integration of highlighting
- `webview-ui/src/lib/word-boundary-fzf.ts` — Position tracking added to fuzzy matcher
- `.changeset/search-highlight.md` — Patch changeset
- Upstream CI (11/11 green)
- Community feedback: @Githubguy132010 "+1, I'd merge this if I could"

## Analysis

### Architecture: Three-Layer Change

The PR touches three layers, each with a clear responsibility:

1. **Algorithm layer** (`word-boundary-fzf.ts`): `matchAcronym()` now returns `Set<number> | null` instead of `boolean`. The Set contains absolute character positions in the original text that were matched. A new `tokenize()` method pre-splits text into `{word, index}` tuples so matched characters can be mapped back to their original positions.

2. **Data layer** (`select-dropdown.tsx`): The `filteredOptions` memo was refactored from `.filter()` to `.reduce()`. A `Map<value, positions>` is built from fzf results, and matching options get their positions attached via `{ ...option, matchingPositions: positions }` (spread, no mutation).

3. **Render layer** (`highlighted-text.tsx`): A memo'd component that groups consecutive matched/unmatched characters into chunks to minimize DOM nodes. Matched characters render with `font-bold text-vscode-textLink-foreground`.

### Design Decision: Positions Inside the Algorithm

The key insight is tracking positions during matching, not after. Post-hoc reconstruction (running the query against each result to find where characters matched) is error-prone because the fuzzy algorithm uses backtracking — a character might match at position 3 or position 7 depending on the backtracking path. By recording positions inside `tryMatch()`, the positions exactly reflect the algorithm's actual matching decisions.

### The Tokenizer

The new `tokenize()` method converts text into `{word, index}[]` tuples:
```
"Claude Sonnet 4" → [{word:"Claude", index:0}, {word:"Sonnet", index:7}, {word:"4", index:14}]
```

This is needed because `matchAcronym` works at the word level but needs to report character positions in the full string. `token.index + matchedInWord` gives the absolute position.

The implementation uses `text.indexOf(word, currentIndex)` to find each word's position. This is correct for the normal case (split produces substrings in order), though edge cases with repeated identical words could theoretically misalign. In practice, model names like "Claude Sonnet 4" don't have this issue.

### Performance Characteristics

- `HighlightedText` is `memo()`'d — re-renders only when props change
- Character grouping reduces DOM nodes (consecutive matches become one `<span>`)
- Set cloning in recursive backtracking: `new Set(currentPositions)` per recursion level. Model names are short (typically <50 characters, <10 word boundaries), so the branching factor is minimal
- `reduce()` + `Map` in filteredOptions is O(n) — same complexity as the previous `.filter()` approach

## Verification

### Upstream CI
All 11 checks pass — compile, test-extension, test-cli, test-webview, etc.

### Local Testing
Merged on fork branch `review/PR-5726`, ran full suite — no new failures.

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | PASS | 22/22 packages |
| Lint | `pnpm lint` | PASS | 18/18 packages |
| Unit Tests | `pnpm test` | PASS | 3,540 passed, 46 skipped, 0 new failures |

*Pre-existing failures (not from this PR): `@kilocode/agent-runtime` 4 applyEdit tests.

### What We Couldn't Verify
- Visual rendering of highlights (requires VSCode extension host)
- Edge cases with very long model names or complex word boundaries

## Diagrams

```
Fuzzy Search Highlighting Pipeline
──────────────────────────────────────────

  User types: "clso"
       │
       ▼
  Fzf.find("clso")
       │
       ▼
  tokenize("Claude Sonnet 4")
       │   → [{word:"Claude", index:0},
       │      {word:"Sonnet", index:7},
       │      {word:"4",      index:14}]
       ▼
  matchAcronym(tokens, "clso")
       │   "cl" matches "Claude" → positions {0, 1}
       │   "so" matches "Sonnet" → positions {7, 8}
       │   → return Set{0, 1, 7, 8}
       ▼
  FzfResult { item, positions: {0, 1, 7, 8} }
       │
       ▼
  filteredOptions → matchMap.get(value) → option.matchingPositions
       │
       ▼
  <HighlightedText text="Claude Sonnet 4" matchingPositions={0,1,7,8}>
       │
       ▼
  Render: [Cl]aude [So]nnet 4
          ^^^^       ^^^^
          bold+blue  bold+blue
```

## Bot Review Synthesis

| Bot | Verdict | Key Finding | Useful? |
|-----|---------|-------------|---------|
| gemini | COMMENT | Well-structured, suggested HighlightedText refactoring | Yes |
| coderabbit | RATE_LIMITED | Rate limited, no review generated | No |
| qodo | COMMENT | Code review generated | Yes |
| changeset-bot | INFO | Changeset detected | Yes |
| Community | +1 | @Githubguy132010: "I'd merge this if I could" | Yes |

## Lessons Learned

1. **Track positions during matching, not after** — When an algorithm uses backtracking (as this fuzzy matcher does), the only reliable way to know which characters matched is to record them during the matching process. Post-hoc reconstruction can give different results.
2. **Group consecutive characters for rendering** — Rather than one `<span>` per character, grouping consecutive matched/unmatched runs reduces DOM node count. This is a standard optimization for syntax highlighters and search results.
3. **Clone-on-write for pipeline data** — The `{ ...option, matchingPositions }` spread pattern avoids mutating the original options array. Clean data flow from algorithm → data → render without side effects.
4. **"Totally subjective" PRs can still be objectively good** — The author's humility about subjectivity shouldn't obscure that character-level search highlighting is a well-established UX pattern used in VS Code, fzf, Sublime Text, and every modern fuzzy finder.

---

<sub>Review #26 | [Multi-AI analysis](https://github.com/jeremylongshore/kilocode/pull/20) | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code + 5 AI reviewers</sub>
