<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5845
title: "Feat: Profile condense override with model-aware token caps"
author: Neonsy
category: feature
tier: 6
lines: 1628
files: 38
review_number: 74
-->

# Review Journal: kilocode #5845

> **PR**: [#5845](https://github.com/Kilo-Org/kilocode/pull/5845) |
> **Title**: Feat: Profile condense override with model-aware token caps |
> **Author**: @Neonsy |
> **Category**: feature | **Tier**: 6 | **Size**: 1628 lines, 38 files

---

## Summary

Redesigns the context condensing threshold system. Previously, each profile could only set a percentage-of-context-window threshold. Now profiles can optionally override with either a percent-of-effective-budget or a fixed token count. The UI shows the currently selected model's effective budget so users can set meaningful thresholds. All CI checks pass. Backward compatible with the legacy `profileThresholds` system.

## First Impressions

The PR title "Profile condense override with model-aware token caps" immediately signals a meaningful improvement. The existing system only supported percentage-based thresholds relative to the raw context window, which was confusing because different models have different reserved output tokens. Making the threshold model-aware is the right direction.

The author has thought through backward compatibility: the legacy `profileThresholds` record is still honored in the `global_percent` fallback path of `resolveCondenseTrigger`. The new `profileCondenseOverrides` record sits alongside it without replacing it.

## What I Looked At

- `src/core/context-management/index.ts` -- Core logic: `resolveCondenseTrigger()`, `clampNumber()`, updated `willManageContext()` and `manageContext()`
- `src/core/context-management/__tests__/context-management.spec.ts` -- 4 new tests for profile condense overrides
- `packages/types/src/global-settings.ts` -- New Zod schemas: `profileCondenseOverrideSchema`, `profileCondenseOverrideModeSchema`
- `packages/types/src/vscode-extension-host.ts` -- ExtensionState additions
- `webview-ui/src/components/settings/ContextManagementSettings.tsx` -- Redesigned UI with checkbox, mode selector, percent slider, token input
- `webview-ui/src/components/settings/SettingsView.tsx` -- Budget computation using `useSelectedModel`
- `webview-ui/src/components/settings/__tests__/ContextManagementSettings.spec.tsx` -- Rewritten test suite
- `src/core/webview/ClineProvider.ts` -- State plumbing for `profileCondenseOverrides`
- 22 locale `settings.json` files -- New i18n keys

## Analysis

**Three-mode resolution**: The `resolveCondenseTrigger` function returns a `CondenseTriggerResolution` object with one of three modes:
1. `global_percent` -- Legacy path. Uses the global `autoCondenseContextPercent` or per-profile override from the old `profileThresholds` map.
2. `profile_percent` -- New path. The profile specifies a percentage, but it is calculated against the `effectiveBudget` (context window minus buffer minus reserved output tokens), not the raw context window.
3. `profile_tokens` -- New path. The profile specifies a fixed token count, clamped to `[1, effectiveBudget]`.

This is well-designed because the effective budget accounts for the model's output token reservation, which varies significantly between models (e.g., Claude 3.5 Sonnet reserves 8,192 tokens while some models reserve 32,768).

**Token clamping**: When a user switches to a model with a smaller context window, existing token thresholds could exceed the new effective budget. The `useEffect` in `ContextManagementSettings.tsx` detects this and auto-clamps the token value, showing an inline notice. This prevents invalid configurations.

**UI simplification**: The old UI had a profile selector dropdown (choose which profile to configure) plus a single slider. The new UI removes the profile selector and instead shows an override checkbox for the *currently active* profile, with a mode selector (percent/tokens) and appropriate input control. This is more intuitive because users configure the profile they are actively using.

**Test rewrite tradeoff**: The test file was rewritten from scratch rather than extended. The new tests are focused and well-structured (using `renderWithState` wrapper for stateful tests), but they drop coverage for non-condense settings that the old suite tested. The old tests for max-read-file-line boundary values, slider accessibility, and conditional rendering are gone.

## Verification

- CI: All 11 checks pass (compile, test-extension ubuntu/windows, test-webview ubuntu/windows, test-cli, check-translations, build-cli, test-jetbrains, unit-test, Build Markdoc Site)
- Changeset: Present, correct package name `kilo-code`, type `minor`
- Upstream discussion: Maintainer (@bernaferrari) expressed approval ("I like it!!")
- Author responsive and clear about design rationale ("You cannot have a fixed size limit as global, cause models have different max values")

## Lessons Learned

1. When redesigning a settings UI, backward compatibility with stored settings is critical. The approach here (new field `profileCondenseOverrides` alongside legacy `profileThresholds`, with `resolveCondenseTrigger` handling both) is the right pattern.
2. Model-aware budget computation (`contextWindow * 0.9 - reservedOutputTokens`) is essential for meaningful token-based thresholds. Raw context window percentages are misleading when output reservations vary.
3. Test rewrites that narrow scope (from 565 to 314 lines) should be flagged: the new tests may be better for the new feature, but the regression coverage for adjacent settings features is lost.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
