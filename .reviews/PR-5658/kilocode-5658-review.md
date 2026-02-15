<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5658
title: "Try to use exact provider-model profile for autocompletion if such exists"
author: wkordalski
category: provider
tier: 5
lines: 10
files: 1
verdict: APPROVE
confidence: 5
reviewed_at: 2026-02-14
linked_issue: null
fork_pr: null
-->

# Review: kilocode #5658

> **Try to use exact provider-model profile for autocompletion if such exists** by @wkordalski

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Adds exact match before fallback; preserves original behavior when no exact match |
| Conventions | PASS | Clean, minimal change; follows existing patterns |
| Changeset | WARN | Missing changeset (bot flagged); patch-level change warranted |
| Tests | WARN | No new tests for the exact-match path; existing tests only exercise fallback |
| i18n | N/A | No user-facing strings |
| Types | PASS | No type changes; `modelId` already on `ProviderSettingsEntry` |
| Security | PASS | No security implications |
| Scope | PASS | Single focused fix, 10 lines |

## Findings

### GREEN: Correct two-phase profile lookup

The change introduces a sensible lookup refinement. Before this PR, the autocomplete profile selection loop picked the first profile matching the provider name (e.g., any `mistral` profile). This caused a real bug: if a user had both a Mistral/devstral profile and a Mistral/codestral profile, the loop could select the devstral profile's API key but then use the `codestral.mistral.ai` endpoint (the default autocomplete endpoint for Mistral), resulting in a 401.

The fix adds an exact `provider + modelId` match first, falling back to the original provider-only match:

```typescript
// Phase 1: exact provider + model match
let selectedProfile = profiles.find(
    (x) => x.apiProvider === provider && x.modelId === model && !(x.profileType === "autocomplete"),
)
if (!selectedProfile) {
    // Phase 2: fallback to any profile with matching provider (original behavior)
    selectedProfile = profiles.find(
        (x) => x.apiProvider === provider && !(x.profileType === "autocomplete"),
    )
}
```

This preserves backward compatibility: users with a single Mistral profile still match on the fallback. Users with multiple Mistral profiles get the correct one matched to the autocomplete model.

### GRAY: modelId comparison depends on cleanModelId stripping

The `modelId` on profile entries comes from `ProviderSettingsManager.listConfig()`, which runs the raw model ID through `cleanModelId()`. That function strips everything before the last `/` -- so `"mistralai/codestral-latest"` becomes `"codestral-latest"`, which matches the AUTOCOMPLETE_PROVIDER_MODELS value `"codestral-latest"` for Mistral. For Mistral's native provider, the `apiModelId` is typically `"codestral-latest"` without any prefix, so the match works directly. This is correct but worth noting for future maintainers.

### GRAY: Optional chaining removal (x?.apiProvider to x.apiProvider)

The old code used `x?.apiProvider` with optional chaining. The new code uses `x.apiProvider`. This is safe because `listConfig()` returns concrete objects (never `null`/`undefined` entries), but it's a subtle behavior change in the same diff. Not a problem in practice.

### GRAY: Missing changeset

The changeset bot flagged this. A patch-level changeset would be appropriate since this fixes a user-facing bug. Not a blocker for the review itself.

### GRAY: No test for exact-match path

Existing tests in `GhostModel.spec.ts` don't set `modelId` on mock profiles, so they only exercise the fallback path. A test with two profiles of the same provider but different `modelId` values would directly validate the fix. However, for a 10-line tier-5 change that fixes a clear bug, this is not a blocker.

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

All 11 upstream CI checks pass.

## Merge Conflict

The PR currently shows `CONFLICTING` merge state. This is expected since the `ghost/` service directory has been actively modified on main since this PR was branched (2026-02-04). The conflict is likely trivial given this PR touches only 10 lines in the profile selection loop. Author will need to rebase.

## Code Snippets

### The complete change (GhostModel.ts lines 63-75):
```typescript
for (const [provider, model] of AUTOCOMPLETE_PROVIDER_MODELS) {
    let selectedProfile = profiles.find(
        (x) => x.apiProvider === provider && x.modelId === model && !(x.profileType === "autocomplete"),
    )
    if (!selectedProfile) {
        // If failed to find exact provider-model pair, try to use any profile with looked-up provider
        selectedProfile = profiles.find(
            (x) => x.apiProvider === provider && !(x.profileType === "autocomplete"),
        )
    }
    if (!selectedProfile) continue
    const profile = await providerSettingsManager.getProfile({ id: selectedProfile.id })
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**APPROVE** -- This is a clean, minimal, and correct fix for a real user-facing bug. The two-phase lookup (exact match then fallback) is the right pattern. The logic is easy to follow and preserves backward compatibility. The merge conflict and missing changeset are minor housekeeping issues for the author. All CI passes. No risk of regression.
