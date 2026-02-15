<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5587
title: "Add 'Make Active Profile on All Modes' button to provider settings"
author: crazyrabbit0
category: provider
tier: 5
lines: 282
files: 71
verdict: APPROVE
confidence: 4
reviewed_at: 2026-02-14
linked_issue: none
fork_pr: none
-->

# Review: kilocode #5587

> **Add "Make Active Profile on All Modes" button to provider settings** by @crazyrabbit0
> Desk review -- 71 files (65 i18n, 6 core logic)

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Core logic is sound: iterates modes, sets config per mode, activates for current session |
| Conventions | PASS | Uses `// kilocode_change` markers, follows existing patterns for message handling |
| Changeset | PASS | Patch changeset included (`make-active-profile-all-modes.md`) |
| Tests | PASS | Unit test covers the happy path: verifies `setModeConfig` called per mode and `activateProviderProfile` called |
| i18n | PASS | All 22 locales updated for both `src/` and `webview-ui/` translation files (button label, tooltip, success message) |
| Types | PASS | `applyProfileToAllModes` added to `WebviewMessage` union type in correct position |
| Security | PASS | No security implications -- profile switching is user-initiated |
| Scope | PASS | Focused feature addition, clean separation from existing "Make Active Profile" button |

## File Breakdown

**Core logic files (6):**
- `packages/types/src/vscode-extension-host.ts` -- New message type in union
- `src/core/webview/ClineProvider.ts` -- New `applyProfileToAllModes()` method (+23 lines)
- `src/core/webview/webviewMessageHandler.ts` -- Message routing (+3 lines)
- `src/core/webview/__tests__/ClineProvider.spec.ts` -- Unit test (+38 lines)
- `webview-ui/src/components/settings/ApiConfigManager.tsx` -- Button UI (+17/-10 lines)
- `webview-ui/src/components/settings/SettingsView.tsx` -- Handler plumbing (+3 lines)

**i18n files (65):** 22 locales x ~3 files each (src kilocode.json, webview-ui kilocode.json, webview-ui settings.json). All follow the same pattern -- adding `profile_applied_to_all_modes`, `makeActiveProfileAllModes`, and `makeActiveAllModesTooltip` keys.

## Findings

### GREEN: Clean implementation of `applyProfileToAllModes`

`ClineProvider.ts` -- The new method follows the established patterns well:
```typescript
async applyProfileToAllModes(profileName?: string) {
    const { currentApiConfigName, listApiConfigMeta } = await this.getState()
    const nameToApply = profileName || currentApiConfigName
    // ...
    const modes = await this.getModes()
    for (const mode of modes) {
        await this.providerSettingsManager.setModeConfig(mode.slug, profile.id)
    }
    await this.activateProviderProfile({ name: nameToApply })
    vscode.window.showInformationMessage(t("kilocode:info.profile_applied_to_all_modes", { name: nameToApply }))
}
```

Key observations:
1. Uses `getModes()` which correctly includes both `DEFAULT_MODES` and custom modes
2. Falls back to `currentApiConfigName` if no explicit profile name provided
3. Validates profile exists and has an `id` before proceeding
4. Calls `activateProviderProfile` at the end to sync the current session's state
5. Shows an i18n-aware success notification

### GRAY: Silent failure on invalid profile

`ClineProvider.ts:1720-1727` -- If `nameToApply` is empty or the profile is not found in `listApiConfigMeta`, the method returns silently with no user feedback. This is defensive but could leave users wondering why nothing happened if the profile list is stale. The existing `activateProviderProfile` method throws on invalid profile names, so this is a more defensive pattern. Acceptable for a v1.

### GREEN: UI conditional logic is correct

`ApiConfigManager.tsx` -- The button rendering logic correctly separates the two concerns:
```tsx
{(isEditingDifferentProfile && onActivateConfig) ||
(currentApiConfigName && onActivateConfigAllModes) ? (
    <div className="flex flex-col gap-2 mt-2">
        {/* "Make Active Profile" shows only when editing a different profile */}
        {/* "Make Active Profile on All Modes" shows whenever a profile is selected */}
    </div>
) : null}
```

The "Make Active Profile on All Modes" button is visible even when the profile is already active for the current mode, which is the correct behavior -- you might want to apply it to all modes even if it is already active on the current one.

### GREEN: Message handler follows existing pattern

`webviewMessageHandler.ts` -- The new case is placed directly before `deleteApiConfiguration`, alongside the other profile-related handlers. Uses `message.text` consistently with how `loadApiConfiguration` passes the profile name.

### GRAY: No confirmation dialog for destructive-ish action

Applying a profile to all modes overrides each mode's individually configured profile. Unlike `deleteApiConfiguration` which shows a modal confirmation, this action proceeds immediately. For a feature explicitly requested by the user via a button click, a confirmation dialog may be unnecessary, but it is worth noting that this action cannot be undone in a single step.

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
| storybook-playwright-snapshot | SKIPPING |

All 11 active upstream CI checks pass.

## Code Snippets

### Core method:
```typescript
// ClineProvider.ts -- new method
async applyProfileToAllModes(profileName?: string) {
    const { currentApiConfigName, listApiConfigMeta } = await this.getState()
    const nameToApply = profileName || currentApiConfigName
    if (!nameToApply) { return }

    const profile = listApiConfigMeta?.find((p) => p.name === nameToApply)
    if (!profile || !profile.id) { return }

    const modes = await this.getModes()
    for (const mode of modes) {
        await this.providerSettingsManager.setModeConfig(mode.slug, profile.id)
    }
    await this.activateProviderProfile({ name: nameToApply })
    vscode.window.showInformationMessage(t("kilocode:info.profile_applied_to_all_modes", { name: nameToApply }))
}
```

### Message handler routing:
```typescript
// webviewMessageHandler.ts
case "applyProfileToAllModes":
    await provider.applyProfileToAllModes(message.text)
    break
```

### UI button:
```tsx
// ApiConfigManager.tsx
{currentApiConfigName && onActivateConfigAllModes && (
    <StandardTooltip content={t("settings:providers.makeActiveAllModesTooltip")}>
        <Button
            className="w-full"
            onClick={() => onActivateConfigAllModes(currentApiConfigName)}
            data-testid="activate-profile-all-modes-button">
            {t("settings:providers.makeActiveProfileAllModes")}
        </Button>
    </StandardTooltip>
)}
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**APPROVE** -- This is a clean, well-structured feature addition that addresses a genuine UX pain point. The implementation follows established patterns throughout the codebase: the message type is added to the WebviewMessage union, the handler delegates to a new method on ClineProvider, the method uses existing APIs (`getModes`, `setModeConfig`, `activateProviderProfile`), and the UI button follows the same tooltip+button pattern as the existing "Make Active Profile" button. All 22 locales are covered for both extension-side and webview-side translations. The unit test verifies the core behavior. The two gray findings (silent failure on invalid profile, no confirmation dialog) are minor and acceptable for this feature's scope.
