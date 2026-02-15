<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5845
title: "Feat: Profile condense override with model-aware token caps"
author: Neonsy
category: feature
tier: 6
lines: 1628
files: 38
verdict: REQUEST_CHANGES
confidence: 82
reviewed_at: 2026-02-14
fork_pr: N/A (batch review)
linked_issue: N/A
-->

# Review: kilocode #5845

> **Feat: Profile condense override with model-aware token caps** by @Neonsy

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | YELLOW | Semantic divergence between global-percent and profile-percent calculations; token input accepts values above budget in UI before clamping |
| Conventions | PASS | kilocode_change markers present throughout; follows existing patterns |
| Changeset | PASS | Minor bump, accurate description |
| Tests | YELLOW | Good new tests, but significant regression: 463 lines of existing tests deleted and replaced with a fraction of the coverage |
| i18n | YELLOW | 22 non-English locales all use English-only strings for the 10 new keys |
| Types | PASS | Zod schema, TypeScript type, and inline type all stay in sync |
| Security | PASS | No secrets, no new endpoints, no user input mishandling |
| Scope | YELLOW | Removes profile selector dropdown and profileThresholds write path but retains legacy read fallback; migration path unclear |

## Findings

### RED-1: Global-percent vs profile-percent calculate thresholds against different bases

**File**: `src/core/context-management/index.ts` (willManageContext, lines ~365-372 in diff)

The global-percent path computes `contextPercent = (100 * prevContextTokens) / contextWindow` and compares against a raw percentage of the full context window. The profile-percent path computes `thresholdTokens = (percent / 100) * effectiveBudget` where effectiveBudget = `contextWindow * 0.9 - reservedTokens`. These are fundamentally different bases.

A user sets 80% for both global and profile-percent override. Global triggers when context fills 80% of the raw context window. Profile triggers when context fills 80% of the *effective budget* (which is ~60% of context window for a typical model). The profile-percent override at 80% therefore triggers far earlier than the global 80%.

This is either a deliberate design choice (and should be documented in the UI) or a semantic bug. The UI says "% of hard limit" for the mode label, which somewhat matches, but a user switching between global and profile override at the same percentage value will see drastically different behavior.

**Severity**: High -- users will be confused when profile 80% != global 80%.

### RED-2: 463 lines of `ContextManagementSettings.spec.tsx` tests deleted, replaced with ~212 lines

**File**: `webview-ui/src/components/settings/__tests__/ContextManagementSettings.spec.tsx`

The original test file had comprehensive coverage for:
- Diagnostic settings rendering and interaction
- Max read file line edge cases
- Slider boundary values
- Accessibility checks
- Translation key verification
- Conditional rendering
- Edge cases for maxDiagnosticMessages (zero, negative, decimals, very large numbers)

The replacement tests only cover the new override feature plus 4 lightweight regression tests. The deleted tests covered the *entire* ContextManagementSettings component, not just the condense section. Deleting them leaves significant coverage gaps for unrelated functionality (diagnostics, read file lines, workspace files, etc.).

**Severity**: High -- test regression is unacceptable for a feature PR.

### YELLOW-1: Duplicate `ProfileCondenseOverride` type definition

**File**: `src/core/context-management/index.ts` (line ~215 in new code) vs `packages/types/src/global-settings.ts` (exported from Zod schema)

The `ProfileCondenseOverride` type is defined independently in both locations:
- `packages/types/src/global-settings.ts`: `export type ProfileCondenseOverride = z.infer<typeof profileCondenseOverrideSchema>`
- `src/core/context-management/index.ts`: Hand-written interface with identical shape

And a third time in `ContextManagementSettings.tsx` as `ProfileCondenseOverrideValue`. Three copies of the same type. The types package export should be the single source of truth.

**Severity**: Medium -- type drift risk across three definitions.

### YELLOW-2: Token input accepts any integer, clamping happens in `normalizeOverride` after the fact

**File**: `webview-ui/src/components/settings/ContextManagementSettings.tsx`

The number input has `max={Math.max(1, hardLimitTokens)}` as an HTML attribute, but the `onChange` handler passes the raw parsed integer to `updateCurrentProfileOverride({ tokens: parsed })`, which then runs through `normalizeOverride` to clamp. This means the user can type "999999" in the input, the state briefly holds an out-of-range value, and then `normalizeOverride` clamps it. The displayed value may flicker or show the unclamped value before re-render.

The `useEffect` on lines ~737-752 handles model-change clamping, but there is no equivalent immediate clamp in the onChange handler for user-typed values exceeding the budget.

**Severity**: Medium -- cosmetic/UX issue.

### YELLOW-3: i18n keys added in English only across all 22 non-English locales

**File**: `webview-ui/src/i18n/locales/*/settings.json` (all 22 non-English locale files)

All 10 new translation keys are copy-pasted in English verbatim into every locale file: Arabic, Catalan, Czech, German, Spanish, French, Hindi, Indonesian, Italian, Japanese, Korean, Dutch, Polish, Portuguese-BR, Russian, Slovak, Thai, Turkish, Ukrainian, Vietnamese, Chinese-CN, Chinese-TW. Users of these locales will see untranslated English strings mixed with their native language UI.

**Severity**: Medium -- standard for initial PRs but should be flagged for translation follow-up.

### YELLOW-4: Legacy `profileThresholds` retained as read fallback but write path removed

**File**: `src/core/context-management/index.ts` (resolveCondenseTrigger, lines ~288-295 in new code)

The new code still reads from `profileThresholds` as a fallback when no `profileCondenseOverrides` entry exists. However, the UI no longer provides any way to write to `profileThresholds` -- the profile dropdown was removed from the settings UI. Existing users who had per-profile thresholds configured via the old UI will have their settings silently honored, but they cannot view, edit, or remove them through the UI. There is no migration to convert old `profileThresholds` entries to the new `profileCondenseOverrides` format.

**Severity**: Medium -- orphaned settings with no UI visibility.

### GRAY-1: `CONDENSE_TOKEN_BUFFER_PERCENTAGE` duplicated in SettingsView.tsx

**File**: `webview-ui/src/components/settings/SettingsView.tsx` (line ~105 in diff)

The `TOKEN_BUFFER_PERCENTAGE` constant (0.1) from `src/core/context-management/index.ts` is duplicated as `CONDENSE_TOKEN_BUFFER_PERCENTAGE` in the webview. If the core value ever changes, the webview calculation will diverge. Ideally this should be imported from the shared types package.

**Severity**: Low -- maintenance concern.

### GRAY-2: `resolveCondenseTrigger` called even when `autoCondenseContext` is false

**File**: `src/core/context-management/index.ts` (willManageContext)

When `autoCondenseContext` is disabled, the function still calls `resolveCondenseTrigger` to compute `trigger.allowedTokens`, even though only the `allowedTokens` value is needed. This is a minor inefficiency but harmless.

**Severity**: Low -- no functional impact.

## CI Status

| Check | Result |
|-------|--------|
| unit-test | PASS |
| compile | PASS |
| test-extension (ubuntu) | PASS |
| test-extension (windows) | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| test-cli | PASS |
| test-jetbrains | PASS |
| check-translations | PASS |
| build-cli | PASS |
| Build Markdoc Site | PASS |
| storybook-playwright-snapshot | SKIP |

## Code Snippets

### The semantic divergence (RED-1):

```typescript
// Global-percent path: percentage of FULL context window
if (trigger.mode === "global_percent") {
    const contextPercent = (100 * prevContextTokens) / contextWindow
    return contextPercent >= (trigger.thresholdPercent ?? autoCondenseContextPercent)
}

// Profile-percent path: percentage of EFFECTIVE BUDGET (contextWindow * 0.9 - reservedTokens)
const percentThreshold = clampNumber(Math.floor(profileOverride.percent), MIN_CONDENSE_THRESHOLD, MAX_CONDENSE_THRESHOLD)
const thresholdTokens = Math.max(1, Math.floor((percentThreshold / 100) * Math.max(1, effectiveBudget)))
// ...
return prevContextTokens >= (trigger.thresholdTokens ?? 1)
```

### Triple type definition (YELLOW-1):

```typescript
// packages/types/src/global-settings.ts
export type ProfileCondenseOverride = z.infer<typeof profileCondenseOverrideSchema>

// src/core/context-management/index.ts
export type ProfileCondenseOverride = {
    enabled: boolean; mode: "percent" | "tokens"; percent: number; tokens: number
}

// webview-ui/src/components/settings/ContextManagementSettings.tsx
type ProfileCondenseOverrideValue = {
    enabled: boolean; mode: "percent" | "tokens"; percent: number; tokens: number
}
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**REQUEST_CHANGES**

The core architecture is sound: centralizing threshold resolution in `resolveCondenseTrigger` and threading the new `profileCondenseOverrides` through the full stack (types -> provider -> task -> context management -> webview) is the right approach. The author correctly preserved the hard safety behavior where `prevContextTokens > allowedTokens` always forces context management regardless of override settings.

However, two issues need resolution before merge:

1. **Semantic divergence** (RED-1): The global-percent and profile-percent modes calculate thresholds against different bases (full context window vs effective budget). Either this needs to be made consistent, or the UI must clearly communicate that "80% profile override" means something fundamentally different from "80% global slider." The current UI label "% of hard limit" is technically correct but misleading when displayed alongside the global slider.

2. **Test regression** (RED-2): Deleting 463 lines of existing test coverage that tested diagnostic settings, read file controls, slider boundaries, and accessibility -- none of which relate to the condense override feature -- is not acceptable. The new tests should be *additive* to the existing suite, not a replacement. The old tests for non-condense functionality must be restored.

Secondary items (YELLOW-1 through YELLOW-4) are cleanup tasks that could be addressed in follow-up but ideally would be handled in this PR to avoid accumulating technical debt.
