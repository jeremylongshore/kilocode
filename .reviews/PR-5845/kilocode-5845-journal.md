<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5845
title: "Feat: Profile condense override with model-aware token caps"
author: Neonsy
category: feature
tier: 6
lines: 1628
files: 38
review_number: 23
fork_pr: N/A (batch review)
-->

# Review Journal: kilocode #5845

> **PR**: [#5845](https://github.com/Kilo-Org/kilocode/pull/5845) |
> **Title**: Feat: Profile condense override with model-aware token caps |
> **Author**: @Neonsy |
> **Category**: feature | **Tier**: 6 | **Size**: 1628 lines, 38 files

---

## Summary

A well-structured feature that adds per-profile condense threshold overrides with two modes: percent-of-effective-budget and fixed-token-count. The architecture is correct at the high level (centralized resolver, full-stack threading), but has a semantic divergence between how global-percent and profile-percent thresholds are calculated (different bases), and the test rewrite deletes 463 lines of pre-existing coverage for unrelated component features. REQUEST_CHANGES on those two grounds.

## First Impressions

The title signals a non-trivial settings/context-management feature. 1,628 lines across 38 files is large, but 22 of those files are i18n locale copies of the same 10 new translation keys (220 lines of copy-paste). The real diff is concentrated in ~16 files, ~800 effective lines. The PR description is detailed with clear test instructions. Author discloses implementation was "fully done by AI" which calibrates expectations for edge cases.

The comment thread is thin: bernaferrari likes it, abdulrahimpds will review, Neonsy explains the design rationale for why fixed token limits cannot be global (models have different max values). This is a sound design rationale.

## What I Looked At

1. **Type layer**: `packages/types/src/global-settings.ts` -- Zod schema for the new `profileCondenseOverrideSchema`, added to `globalSettingsSchema`
2. **Extension state**: `packages/types/src/vscode-extension-host.ts` -- `ExtensionState` type updated with `profileCondenseOverrides`
3. **Core context management**: `src/core/context-management/index.ts` -- The `resolveCondenseTrigger` function, modified `willManageContext` and `manageContext`
4. **Task integration**: `src/core/task/Task.ts` -- Threading through `handleContextWindowExceededError` and the automatic trigger path
5. **Provider serialization**: `src/core/webview/ClineProvider.ts` -- Reading/writing `profileCondenseOverrides` to/from global state
6. **Settings UI**: `webview-ui/src/components/settings/ContextManagementSettings.tsx` and `SettingsView.tsx` -- The redesigned UI components
7. **Tests**: All four test files (context-management.spec.ts, ClineProvider.spec.ts, ContextManagementSettings.spec.tsx, change-detection/unsaved-changes specs)
8. **Extension state context**: `ExtensionStateContext.tsx` -- Default values and setter
9. **Existing codebase**: `useSelectedModel.ts`, `getModelMaxOutputTokens` in `src/shared/api.ts`, `condense/index.ts` for MIN/MAX thresholds

## Analysis

### Architecture Assessment

The PR introduces a clean layered design:

```
GlobalSettings (Zod schema)
    -> ExtensionState (type + context provider)
        -> ClineProvider (persistence + serialization)
            -> SettingsView (budget computation, model awareness)
                -> ContextManagementSettings (UI controls)
            -> Task (runtime: willManageContext + manageContext)
                -> resolveCondenseTrigger (centralized threshold logic)
```

The `resolveCondenseTrigger` function is the architectural centerpiece. It resolves three modes:
- `global_percent`: Legacy behavior, percentage of full context window
- `profile_percent`: New, percentage of effective budget (contextWindow * 0.9 - reservedTokens)
- `profile_tokens`: New, absolute token threshold clamped to effective budget

This centralization is the right call -- both `willManageContext` (UI indicator) and `manageContext` (actual trigger) now share the same resolution logic. Previously, both functions had duplicated threshold logic that could drift.

### The Semantic Divergence Problem

The global slider works against `contextWindow` directly:
```typescript
const contextPercent = (100 * prevContextTokens) / contextWindow
return contextPercent >= effectiveThreshold
```

The profile-percent mode works against `effectiveBudget`:
```typescript
const effectiveBudget = contextWindow * 0.9 - reservedTokens
const thresholdTokens = (percent / 100) * effectiveBudget
return prevContextTokens >= thresholdTokens
```

For a model with 200K context and 8K max output:
- `effectiveBudget = 200000 * 0.9 - 8000 = 172000`
- Global 80%: triggers at `0.8 * 200000 = 160000` tokens
- Profile 80%: triggers at `0.8 * 172000 = 137600` tokens

That is a 22,400 token difference (14%) for the same percentage value. The UI labels this "% of hard limit" which is accurate for the profile mode, but a user seeing two 80% sliders side-by-side will expect them to mean the same thing.

### Test Coverage Regression

The old `ContextManagementSettings.spec.tsx` had 565 lines covering:
- Diagnostic settings rendering
- Include diagnostic messages toggle
- Max diagnostic messages slider (boundary values, edge cases: zero, negative, decimal, very large)
- Max read file line controls
- Open tabs / workspace files sliders
- Accessibility (labels, descriptions, test IDs)
- Translation key verification
- Conditional rendering
- Auto condense threshold slider and profile selector

The new file has 314 lines covering:
- Override checkbox enable/disable
- Percent mode update
- Token mode with clamping
- Auto-clamp on model cap reduction
- No legacy profile selector
- Global percent slider independence
- 3 lightweight regressions (diagnostic toggle, diagnostic unlimited, max-read-file)

Missing coverage after the rewrite:
- Slider boundary values for open tabs, workspace files, git status
- Max diagnostic messages edge cases (zero, negative, decimal, very large)
- Accessibility labels/descriptions
- Translation key presence verification
- Conditional rendering for non-condense sections
- Max read file line `-1` checkbox state
- Undefined optional props handling

### Legacy Migration Gap

The old `profileThresholds` system allowed per-profile percentage overrides via a dropdown. The new code:
1. Reads `profileThresholds` as fallback in `resolveCondenseTrigger` (good for backward compat)
2. Removes the UI dropdown that wrote to `profileThresholds`
3. Does not migrate existing `profileThresholds` entries to `profileCondenseOverrides`
4. Does not provide UI visibility into orphaned `profileThresholds` entries

A user who had custom per-profile thresholds configured will find their settings still active at runtime but invisible in the UI. They cannot disable or modify them through the settings panel.

### Effective Budget Computation in SettingsView

The SettingsView computes `condenseEffectiveBudgetTokens` by importing `useSelectedModel` and `getModelMaxOutputTokens` to derive the reserved tokens, then subtracting from the context window. This duplicates the core `resolveCondenseTrigger` logic but necessarily so since the webview cannot import from `src/core/`. The buffer percentage is hardcoded as `CONDENSE_TOKEN_BUFFER_PERCENTAGE = 0.1` matching `TOKEN_BUFFER_PERCENTAGE` in the core module.

This is a reasonable tradeoff given the webview/extension boundary, but the duplicated constant is a maintenance risk.

## Verification

### CI Status

All 12 CI checks pass. The `storybook-playwright-snapshot` is marked "skipping" which appears to be a normal conditional skip (not caused by this PR).

### What I Could Not Verify

- Manual testing of the UI flow (model switching, clamp notice appearance, profile name display)
- Backward compatibility with existing `profileThresholds` data from real user settings
- Token computation accuracy against actual model context windows
- The `useSelectedModel` hook returning correct `contextWindow` values for all 40+ provider types

## Diagrams

```
resolveCondenseTrigger resolution flow:

    profileCondenseOverrides[currentProfileId]?.enabled?
    ├── YES: override.mode?
    │   ├── "tokens" -> clamp(override.tokens, 1, effectiveBudget) -> profile_tokens
    │   └── "percent" -> clamp(override.percent, 5, 100) * effectiveBudget -> profile_percent
    └── NO: legacy profileThresholds[currentProfileId]?
        ├── -1 -> use global autoCondenseContextPercent -> global_percent
        ├── valid range -> use profileThreshold -> global_percent
        └── undefined -> use global autoCondenseContextPercent -> global_percent

    Then in willManageContext:
    ├── prevContextTokens > allowedTokens? -> always true (hard overflow)
    ├── mode === global_percent? -> (prevContextTokens / contextWindow * 100) >= thresholdPercent?
    └── mode === profile_*? -> prevContextTokens >= thresholdTokens?
```

## Bot Review Synthesis

| Bot | Status | Key Finding | Useful? |
|-----|--------|-------------|---------|
| CodeRabbit | Not collected | Batch review — no individual fork PR | N/A |
| Gemini | Not collected | Batch review — no individual fork PR | N/A |
| Greptile | Not collected | Batch review — no individual fork PR | N/A |
| CodeQL | Not collected | Batch review — no individual fork PR | N/A |
| Qodo | Not collected | Batch review — no individual fork PR | N/A |

## Lessons Learned

1. **AI-authored PRs need extra scrutiny on test deletions.** The author disclosed AI implementation. The AI rewrote the entire test file from scratch rather than adding to it, discarding coverage for diagnostics, read file lines, sliders, and accessibility that had nothing to do with the feature. This is a pattern to watch for.

2. **Percentage thresholds need a clear documented base.** When two UI controls both show percentages but calculate against different denominators (context window vs effective budget), the UX is confusing even if technically correct. The design should either use the same base or make the distinction unmistakably clear.

3. **Legacy setting orphaning.** When a new setting supersedes an old one, the migration path matters. Retaining read-only fallback is good for backward compat, but removing the UI write/view path without providing migration or at minimum a "legacy settings detected" notice creates invisible state.

4. **i18n locale approach is standard but worth tracking.** All 22 locales getting English-only strings is the norm for initial feature PRs, but creating a tracking issue for translation follow-up is good practice.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
