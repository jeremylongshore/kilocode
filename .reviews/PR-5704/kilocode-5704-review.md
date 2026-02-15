<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5704
title: "fix: Improve Kimi model search and add fallback models"
author: Patel230
category: fix
tier: 3
lines: 74
files: 4
confidence: 5
verdict: REQUEST_CHANGES
reviewed_at: 2026-02-15
linked_issue: null
fork_pr: https://github.com/jeremylongshore/kilocode/pull/15
-->

## Review Summary

| Aspect | Assessment |
|--------|------------|
| **Verdict** | REQUEST_CHANGES |
| **Confidence** | 5/5 |
| **Blocking Issues** | 1 |
| **Non-blocking Issues** | 3 |

> Multi-AI analysis: [Fork PR](https://github.com/jeremylongshore/kilocode/pull/15) reviewed by Gemini, Qodo

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PARTIAL | Missing i18n key will show raw key string in UI |
| Conventions | PASS | Follows existing ModelPicker and provider patterns |
| Changeset | PASS | Two changesets: `webview-ui` (patch) and `kilo-code` (patch) |
| Tests | MISSING | No tests for new search normalization or Kimi fallback logic |
| i18n | FAIL | `settings:modelPicker.matchingModels` key not defined in locale files |
| Types | PASS | TypeScript compiles clean (22/22 packages) |
| Security | PASS | No auth or data handling changes |
| Scope | PASS | Two related improvements in 2 UI files + 2 changesets |

## Findings

### 1. Missing i18n key `matchingModels` (blocking)

The PR introduces a new heading when search is active:

```typescript
searchValue.trim()
  ? t("settings:modelPicker.matchingModels")
  : t("settings:modelPicker.recommendedModels")
```

The key `settings:modelPicker.matchingModels` does not exist in `webview-ui/src/i18n/locales/en/settings.json`. The `modelPicker` section contains `recommendedModels` and `allModels` but not `matchingModels`. The UI will render the raw key string when a user types in the model search box.

**Fix**: Add `"matchingModels": "Matching models"` to the `modelPicker` section in `en/settings.json` and all other locale files.

### 2. `normalizeForSearch` re-created on every render (non-blocking)

```typescript
const normalizeForSearch = (str: string) => str.toLowerCase().replace(/[-_\s]/g, "")
```

This function is defined inside the component body, so it's recreated on every render. Since `filteredPreferredIds` and `filteredRestIds` use `useMemo` with `normalizeForSearch` in their closures, the function identity doesn't affect memoization correctness here — `useMemo` deps are `[preferredModelIds, searchValue]`, not the function itself. But moving `normalizeForSearch` outside the component (as a module-level utility) would be cleaner.

Gemini flagged this as high priority. It's a valid code quality suggestion but not a correctness bug.

### 3. Redundant endpoint checks (non-blocking)

```typescript
const isKimiEndpoint =
  apiConfiguration.openAiBaseUrl?.toLowerCase().includes("kimi") ||
  apiConfiguration.openAiBaseUrl?.toLowerCase().includes("moonshot") ||
  apiConfiguration.openAiBaseUrl?.toLowerCase().includes("api.moonshot.ai") ||
  apiConfiguration.openAiBaseUrl?.toLowerCase().includes("api.moonshot.cn")
```

The `api.moonshot.ai` and `api.moonshot.cn` checks are redundant — both are substrings of strings that already match `includes("moonshot")`. These two lines can be removed.

### 4. No tests for new behavior (non-blocking)

Both the search normalization logic in `ModelPicker.tsx` and the Kimi endpoint detection/fallback in `OpenAICompatible.tsx` lack test coverage. The existing `ModelPicker.spec.tsx` tests cover selection and custom IDs but not the new search matching behavior. Given the PR's scope (fix, not feature), this is a recommendation, not a blocker.

## Local Verification

We merged this PR on our fork and ran the full test suite.

### Regression (existing tests)

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | PASS | 22/22 packages |
| Lint | `pnpm lint` | PASS | 18/18 packages |
| Unit Tests | `pnpm test --continue` | PASS | 7,831 tests, 0 failures |

> Tested on fork branch [`review/PR-5704`](https://github.com/jeremylongshore/kilocode/tree/review/PR-5704)

## CI Status

| Check | Result |
|-------|--------|
| Upstream CI | PASS (11/11 — all checks green) |
| Fork CI | [PR #15](https://github.com/jeremylongshore/kilocode/pull/15) |
| Local verification | PASS (7,831 tests, 0 failures) |

## Code Analysis

### Search normalization (ModelPicker.tsx)

The core improvement — `normalizeForSearch` strips dashes, underscores, and spaces, then lowercases. This means:
- `"kimi k2.5"` matches `"kimi-k2.5"` (space → dash normalization)
- `"KimiK2"` matches `"kimi-k2-thinking"` (case + dash normalization)
- `"gpt 4o"` matches `"gpt-4o"` (general improvement)

The PR disables the built-in `Command` component's `shouldFilter={false}` and implements custom filtering via `useMemo`. This is the correct approach — the built-in filter doesn't support normalization.

### Kimi fallback (OpenAICompatible.tsx)

Detects Kimi/Moonshot endpoints by URL substring matching, then:
1. Merges `moonshotModels` as fallback (spread before `fetchedModels` so fetched models take precedence)
2. Sets `moonshotDefaultModelId` instead of `"gpt-4o"` as the default

The `key` prop on `ModelPicker` forces a re-render when the base URL changes or endpoint type changes, preventing stale model lists.

## Verdict

**REQUEST_CHANGES** — The search normalization and Kimi fallback logic are both correct and well-implemented. All existing tests pass. However, the missing `matchingModels` i18n key is a user-visible bug — the model picker heading will show a raw translation key when searching. Once the locale key is added, this is a clean approval.

---
