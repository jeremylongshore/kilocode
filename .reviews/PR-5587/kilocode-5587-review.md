<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5587
title: Add "Make Active Profile on All Modes" button
author: crazyrabbit0
category: feature
tier: 5
lines: 282
files: 71
verdict: APPROVE
confidence: 4
reviewed_at: 2026-02-15
-->

# Review: kilocode #5587

> **Add "Make Active Profile on All Modes" button** by @crazyrabbit0

[Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Summary

Adds a "Make Active Profile on All Modes" button to provider settings, allowing users to apply a single API configuration profile across all operational modes (Code, Architect, Ask, etc.) with one click. Clean implementation with proper i18n, tests, and message handler wiring.

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | Pass | Iterates all modes via `getModes()`, sets profile ID per mode, then activates |
| Conventions | Pass | kilocode_change markers present, follows existing profile management patterns |
| Changeset | Pass | `make-active-profile-all-modes.md`, patch semver |
| Tests | Pass | Unit test covers mode iteration, activation, and notification |
| i18n | Pass | All 24 languages updated in both `src/i18n` and `webview-ui/src/i18n` |
| Types | Pass | `applyProfileToAllModes` added to WebviewMessage union |
| Security | Pass | No credentials exposed, operates on existing profile references |
| Scope | Pass | Focused feature, no unrelated changes |

## Findings

### 1. (Gray) Button always visible even when profile is already active on all modes
**File:** `webview-ui/src/components/settings/ApiConfigManager.tsx:334-345`
The "Make Active Profile on All Modes" button appears whenever `currentApiConfigName && onActivateConfigAllModes`. It does not check if the profile is already active on all modes. This means users can click it redundantly. This is acceptable behavior -- the operation is idempotent and showing a success notification for a no-op is harmless. However, a future enhancement could gray it out when already applied.

### 2. (Gray) No confirmation dialog before applying to all modes
Unlike the delete profile action, applying to all modes has no confirmation step. Given that it's a destructive operation (overwriting per-mode profile selections), a confirmation dialog would be a UX improvement. However, the notification message provides immediate feedback, and the operation is easily reversible by setting individual mode profiles.

### 3. (Gray) The method calls `activateProviderProfile` after setting mode configs
**File:** `src/core/webview/ClineProvider.ts:1732`
```typescript
await this.activateProviderProfile({ name: nameToApply })
```
This ensures the current session immediately reflects the change, rather than requiring a mode switch. This is good design -- the author explicitly mentions this in the PR description as a fix for a UI lag issue.

### 4. (Gray) Layout change to existing buttons
**File:** `webview-ui/src/components/settings/ApiConfigManager.tsx:323-353`
The existing "Make Active Profile" button was restructured from standalone to a flex column layout alongside the new "all modes" button. Both now have `className="w-full"` instead of the previous default width. This is a subtle layout change that could affect existing UI tests or screenshots. The change is sensible for visual consistency.

## CI Status

| Check | Result |
|-------|--------|
| compile | Pass |
| test-extension (ubuntu) | Pass |
| test-extension (windows) | Pass |
| test-webview (ubuntu) | Pass |
| test-webview (windows) | Pass |
| test-cli | Pass |
| test-jetbrains | Pass |
| check-translations | Pass |
| build-cli | Pass |

## Code Snippets

**Core logic -- iterate modes and set profile:**
```typescript
// src/core/webview/ClineProvider.ts
async applyProfileToAllModes(profileName?: string) {
    const { currentApiConfigName, listApiConfigMeta } = await this.getState()
    const nameToApply = profileName || currentApiConfigName

    const profile = listApiConfigMeta?.find((p) => p.name === nameToApply)
    if (!profile || !profile.id) return

    const modes = await this.getModes()
    for (const mode of modes) {
        await this.providerSettingsManager.setModeConfig(mode.slug, profile.id)
    }

    await this.activateProviderProfile({ name: nameToApply })
    vscode.window.showInformationMessage(
        t("kilocode:info.profile_applied_to_all_modes", { name: nameToApply })
    )
}
```

**Message handler wiring:**
```typescript
// src/core/webview/webviewMessageHandler.ts
case "applyProfileToAllModes":
    await provider.applyProfileToAllModes(message.text)
    break
```

**UI button with tooltip:**
```tsx
// webview-ui/src/components/settings/ApiConfigManager.tsx
<StandardTooltip content={t("settings:providers.makeActiveAllModesTooltip")}>
    <Button
        className="w-full"
        onClick={() => onActivateConfigAllModes(currentApiConfigName)}
        data-testid="activate-profile-all-modes-button">
        {t("settings:providers.makeActiveProfileAllModes")}
    </Button>
</StandardTooltip>
```

## Verdict

**APPROVE** -- This is a clean, focused feature that addresses a genuine UX pain point. The implementation is straightforward: iterate all modes, set the profile, activate it, show a notification. The code follows existing patterns (profile management, message handler, i18n). The 71 files are mostly i18n translations (48 files) -- the core logic is in just 5 files. CI is fully green. Minor improvements (confirmation dialog, "already applied" detection) could come in follow-up PRs.
