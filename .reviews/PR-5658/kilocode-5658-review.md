<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5658
title: Try to use exact provider-model profile for autocompletion
author: wkordalski
category: bugfix
tier: 5
lines: 10
files: 1
verdict: APPROVE
confidence: 4
reviewed_at: 2026-02-15
-->

# Review: kilocode #5658

> **Try to use exact provider-model profile for autocompletion** by @wkordalski

[Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Summary

Fixes a real bug where autocompletion selects the wrong Mistral profile. When a user has both a devstral profile and a codestral profile for Mistral, the old code picked the first Mistral profile it found (devstral), then tried to use that profile's API key against the codestral endpoint, causing 401 Unauthorized errors. The fix adds a provider+model exact match lookup before falling back to provider-only matching.

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | Pass | Exact match first, then fallback -- sound logic |
| Conventions | Pass | Clean diff, no markers needed (autocomplete directory is Kilo-specific) |
| Changeset | Yellow | No changeset -- should have one (patch) since this fixes user-facing behavior |
| Tests | Yellow | No tests added -- the GhostModel profile selection logic should be tested |
| i18n | N/A | No UI changes |
| Types | Pass | No type changes needed |
| Security | Pass | Fixes a credential mismatch bug |
| Scope | Pass | Minimal, focused 8-line fix |

## Findings

### 1. (Green) The fix correctly solves the described problem
**File:** `src/services/ghost/GhostModel.ts:64-71`

**Before:**
```typescript
const selectedProfile = profiles.find(
    (x) => x?.apiProvider === provider && !(x.profileType === "autocomplete"),
)
```

**After:**
```typescript
let selectedProfile = profiles.find(
    (x) => x.apiProvider === provider && x.modelId === model && !(x.profileType === "autocomplete"),
)
if (!selectedProfile) {
    selectedProfile = profiles.find(
        (x) => x.apiProvider === provider && !(x.profileType === "autocomplete"),
    )
}
```

The old code matched on `apiProvider` only, so with two Mistral profiles (devstral and codestral), it would pick whichever came first in the profiles list. The new code first tries to match on both `apiProvider` and `modelId`, falling back to provider-only if no exact match exists. This ensures the codestral profile (with its correct API key for `codestral.mistral.ai`) is selected for codestral autocompletion.

### 2. (Gray) Minor: `x?.apiProvider` null guard removed
The original code had `x?.apiProvider` with optional chaining, while the fix uses `x.apiProvider` without it. This is fine -- the profiles array should not contain null/undefined entries, and the `profileType` check also uses `x.profileType` without optional chaining.

### 3. (Yellow) Missing changeset
The changeset-bot flags this as having no changeset. Since this fixes a user-facing bug (autocompletion broken with certain Mistral profile configurations), it should have a patch changeset.

### 4. (Yellow) No test coverage for profile selection logic
The profile selection loop in `GhostModel.ts` is a critical path for autocompletion. A test should verify:
- Exact provider+model match is preferred over provider-only match
- Provider-only fallback works when no exact match exists
- Profiles with `profileType === "autocomplete"` are still excluded

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

**The complete fix (8 lines added, 2 removed):**
```typescript
// src/services/ghost/GhostModel.ts
for (const [provider, model] of AUTOCOMPLETE_PROVIDER_MODELS) {
    // First try exact provider+model match
    let selectedProfile = profiles.find(
        (x) => x.apiProvider === provider && x.modelId === model && !(x.profileType === "autocomplete"),
    )
    if (!selectedProfile) {
        // Fall back to any profile with the matching provider
        selectedProfile = profiles.find(
            (x) => x.apiProvider === provider && !(x.profileType === "autocomplete"),
        )
    }
    if (!selectedProfile) continue
    // ... rest of profile setup
}
```

## Verdict

**APPROVE** -- This is a clean, minimal fix for a real bug. The author provides excellent context in the PR description explaining the exact scenario (two Mistral profiles, wrong one selected, 401 error). The logic change is straightforward: try exact match first, fall back to provider-only. CI is fully green. The missing changeset and tests are minor concerns that could be addressed in a follow-up, but the fix itself is correct and non-risky.
