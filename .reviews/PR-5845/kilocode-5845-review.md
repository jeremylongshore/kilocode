<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5845
title: "Feat: Profile condense override with model-aware token caps"
author: Neonsy
category: feature
tier: 6
lines: 1628
files: 38
verdict: COMMENT
confidence: 0.85
reviewed_at: 2026-02-15
review_number: 74
-->

# Review: kilocode #5845

> **Feat: Profile condense override with model-aware token caps** by @Neonsy

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | pass | `resolveCondenseTrigger` correctly computes thresholds for all three modes; backward compatible with legacy `profileThresholds` |
| Conventions | pass | `kilocode_change` markers used consistently throughout shared code |
| Changeset | pass | Minor changeset for `kilo-code` with clear user-facing description |
| Tests | pass | 4 new context-management tests (disabled override, exact token threshold, percent mode, hard overflow), ClineProvider tests, ContextManagementSettings tests rewritten |
| i18n | info | New settings keys added to 22 locale files, but non-English locales use English fallback text for new keys |
| Types | pass | New `ProfileCondenseOverride` type, `profileCondenseOverrideSchema` with Zod, properly threaded through `ExtensionState` |
| Security | pass | No credential handling; token limits are local UI/computation |
| Scope | pass | 38 files but 22 are i18n settings.json; core changes are focused on context management and UI |

## Findings

### Yellow: Non-English locales use English fallback text

The new `condensingThreshold` keys (`profileOverrideLabel`, `currentProfileLabel`, `hardLimitLabel`, `mode.percent`, `mode.tokens`, etc.) are added to all 22 non-English locale files but use English text instead of translated strings. For example, Arabic `settings.json` contains:
```json
"profileOverrideLabel": "Override for this profile",
"currentProfileLabel": "Current profile: {{profile}}",
```
This should either use proper translations or be omitted so the i18n system falls back to the English source (which it does by default in i18next).

### Yellow: Duplicate `ProfileCondenseOverride` type definition

The `ProfileCondenseOverride` type is defined in two places:
1. `packages/types/src/global-settings.ts` -- Zod schema with `z.infer<>` export
2. `src/core/context-management/index.ts` -- Manual TypeScript type definition

These could diverge. The context-management module should import from `@roo-code/types` rather than redefining the shape.

### Yellow: Test file rewrite removes coverage for non-condense settings

`ContextManagementSettings.spec.tsx` was rewritten from 565 lines to 314 lines. The original tests covered max-read-file-line controls, slider boundary values, accessibility checks, conditional rendering, and integration with the translation system. The rewritten tests focus primarily on the new profile condense override feature and retain only minimal regression tests for diagnostics and max-read-file. Consider preserving the broader coverage.

### Gray: clampNumber defined in two places

The `clampNumber` utility is defined identically in both `src/core/context-management/index.ts` and `webview-ui/src/components/settings/ContextManagementSettings.tsx`. This is a small function, but duplicating utilities across the extension/webview boundary creates a maintenance risk.

### Gray: SettingsView.tsx imports model info for budget computation

`SettingsView.tsx` now imports `useSelectedModel`, `getModelMaxOutputTokens`, and `ANTHROPIC_DEFAULT_MAX_TOKENS` to compute `condenseEffectiveBudgetTokens`. This computation is specific to the condense feature but adds model-awareness to the general settings view. If the computation is wrong (e.g., wrong model selected during profile editing), the token budget will be inaccurate. The fallback to `ANTHROPIC_DEFAULT_MAX_TOKENS` is safe.

## CI Status

| Check | Result |
|-------|--------|
| Build Markdoc Site | pass |
| build-cli | pass |
| check-translations | pass |
| compile | pass |
| test-cli | pass |
| test-extension (ubuntu) | pass |
| test-extension (windows) | pass |
| test-jetbrains | pass |
| test-webview (ubuntu) | pass |
| test-webview (windows) | pass |
| unit-test | pass |

## Code Snippets

Core threshold resolution in `src/core/context-management/index.ts`:
```typescript
const resolveCondenseTrigger = ({
    contextWindow, maxTokens, autoCondenseContextPercent,
    profileThresholds, profileCondenseOverrides, currentProfileId,
}: ResolveCondenseTriggerOptions): CondenseTriggerResolution => {
    const reservedTokens = maxTokens || ANTHROPIC_DEFAULT_MAX_TOKENS
    const allowedTokens = contextWindow * (1 - TOKEN_BUFFER_PERCENTAGE) - reservedTokens
    const effectiveBudget = Math.max(0, Math.floor(allowedTokens))

    const profileOverride = profileCondenseOverrides[currentProfileId]
    if (profileOverride?.enabled) {
        if (profileOverride.mode === "tokens") {
            // Fixed token threshold, clamped to effective budget
            return { mode: "profile_tokens", thresholdTokens: clampNumber(...) }
        }
        // Percent of effective budget
        return { mode: "profile_percent", thresholdPercent, thresholdTokens }
    }
    // Legacy: global percent or profile-specific percent
    return { mode: "global_percent", thresholdPercent: effectiveThreshold }
}
```

UI settings component (`ContextManagementSettings.tsx`):
```typescript
const currentProfileOverride = normalizeOverride(profileCondenseOverrides[currentProfileId])

const updateCurrentProfileOverride = (updates: Partial<ProfileCondenseOverrideValue>) => {
    const nextOverrides = {
        ...profileCondenseOverrides,
        [currentProfileId]: normalizeOverride({ ...currentProfileOverride, ...updates }),
    }
    setCachedStateField("profileCondenseOverrides", nextOverrides)
}
```

## Verdict

**COMMENT** -- This is a well-executed feature that adds meaningful control over context condensing thresholds. The three-mode resolution (`global_percent`, `profile_percent`, `profile_tokens`) is cleanly implemented and backward compatible with the existing `profileThresholds` system. CI is fully green. The main concerns are the untranslated i18n strings in non-English locales, the duplicate `ProfileCondenseOverride` type definition, and reduced test coverage for non-condense settings after the spec rewrite.

---

Review conducted per [Kilo Code PR Review Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md).
