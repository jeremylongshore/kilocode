<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5704
title: "fix: Improve Kimi model search and add fallback models"
author: Patel230
category: fix
tier: 3
lines: 74
files: 4
review_number: 22
fork_pr: https://github.com/jeremylongshore/kilocode/pull/15
-->

# Review Journal: kilocode #5704

> **PR**: [#5704](https://github.com/Kilo-Org/kilocode/pull/5704) |
> **Author**: @Patel230 | **Size**: 74 lines, 4 files | **Confidence**: 5/5

## Summary

Two related UX improvements: case-insensitive model search with dash/space normalization in `ModelPicker`, and Kimi/Moonshot fallback models in `OpenAICompatible` provider. Both work correctly and all 7,831 tests pass. REQUEST_CHANGES because the PR references an i18n key (`matchingModels`) that doesn't exist in any locale file — the model picker heading will show a raw key string when a user searches.

## What Changed

Four files, 64 additions, 10 deletions. Two distinct improvements:

**Search normalization** (`ModelPicker.tsx`): Adds `normalizeForSearch()` that strips dashes, underscores, spaces and lowercases. Custom filtering via `useMemo` replaces the built-in `Command` filter (`shouldFilter={false}`). Changes heading from "Recommended models" to "Matching models" when search is active — but the i18n key for "Matching models" was never added to locale files.

**Kimi fallback** (`OpenAICompatible.tsx`): Detects Kimi/Moonshot endpoints by URL substring. Merges `moonshotModels` as fallback (fetched models take precedence via spread order). Sets `moonshotDefaultModelId` instead of `"gpt-4o"`. Adds a `key` prop to force `ModelPicker` re-render when endpoint type changes.

Two changesets included — one for `webview-ui` (search), one for `kilo-code` (Kimi fallback).

## Analysis

The search normalization is the kind of small UX fix that has outsized impact. Model IDs in the AI provider ecosystem use every delimiter convention — `gpt-4o`, `claude_3_opus`, `kimi k2.5`. Normalizing all three (`-`, `_`, space) to nothing before comparison means users don't have to guess the exact format. The implementation is correct: `useMemo` with `[preferredModelIds, searchValue]` deps ensures filtering only recalculates when inputs change.

The Kimi fallback addresses a real pain point: if the API fetch fails (network issues, auth problems), users see zero models. By merging `moonshotModels` as a base, Kimi endpoint users always have something to select. The spread order `{ ...moonshotModels, ...fetchedModels }` is correct — fetched models override fallbacks when available.

Gemini flagged `normalizeForSearch` being defined inside the component as a performance issue. Technically it's recreated on every render, but since it's not in the `useMemo` dependency arrays, this doesn't affect memoization correctness. It's a code cleanliness point, not a bug.

The i18n bug is the one real issue. The PR adds `t("settings:modelPicker.matchingModels")` but never defines the key. The `en/settings.json` `modelPicker` section has `recommendedModels` and `allModels` but not `matchingModels`. This will show a raw key string like `settings:modelPicker.matchingModels` in the heading when a user types in the search box.

## Verification

### Regression (existing tests)

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | PASS | 22/22 packages |
| Lint | `pnpm lint` | PASS | 18/18 packages |
| Unit Tests | `pnpm test --continue` | PASS | 7,831 tests, 0 failures |

### Pre-existing failures (not from this PR)

| Package | Issue |
|---------|-------|
| `@kilocode/core-schemas` | No test files (pre-existing) |
| `@kilocode/agent-runtime` | `VSCode.applyEdit.spec.js` path issue (pre-existing) |

## Bot Review Synthesis

| Bot | Verdict | Key Finding | Useful? |
|-----|---------|-------------|---------|
| Gemini | COMMENTED | `normalizeForSearch` re-created on every render; redundant moonshot URL checks | Valid suggestions, not blockers |
| Qodo | COMMENTED | 2 bugs (missing i18n key, missing tests), 2 rule violations | Caught the i18n bug — useful |
| CodeRabbit | RATE LIMITED | Did not review | N/A |

Qodo caught the missing i18n key — the most impactful finding. Gemini's endpoint redundancy flag is correct but cosmetic. Both bots flagged missing tests, which is fair for a tier 3 PR but not unusual for UI fixes in this codebase.

## Lessons Learned

- When adding conditional UI text (different heading based on state), the i18n key must exist in locale files. This is easy to miss when the fallback branch already has a key.
- Qodo's "Bug" category is worth reading even on small PRs — it caught a user-visible issue that manual review might skip.
- `Command` component's built-in filtering can be overridden with `shouldFilter={false}` and custom `useMemo` filtering — this is the correct pattern for non-standard matching.

---

<sub>Review #22 of 75 | [Multi-AI analysis](https://github.com/jeremylongshore/kilocode/pull/15) | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews)</sub>
