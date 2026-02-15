<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5658
title: Try to use exact provider-model profile for autocompletion
author: wkordalski
category: bugfix
tier: 5
lines: 10
files: 1
review_number: 52
-->

# Review Journal: kilocode #5658

> **PR**: [#5658](https://github.com/Kilo-Org/kilocode/pull/5658) |
> **Title**: Try to use exact provider-model profile for autocompletion |
> **Author**: @wkordalski |
> **Category**: bugfix | **Tier**: 5 | **Size**: 10 lines, 1 file

---

## Summary

Minimal, correct bugfix for autocompletion profile selection. APPROVE. Adds exact provider+model matching before falling back to provider-only lookup. Fixes 401 errors when users have multiple profiles for the same provider.

## First Impressions

The smallest PR in this batch -- 10 lines in a single file. The PR description is excellent: clearly explains the bug scenario, the root cause, and the fix. The author (wkordalski / Wojciech Kordalski) reports they hit this bug personally with Mistral devstral + codestral profiles.

## What I Looked At

- `src/services/ghost/GhostModel.ts` -- the diff (only file changed)
- PR description for bug context
- CI checks (all passing)
- Changeset-bot report (no changeset)

The file `GhostModel.ts` is in the autocomplete/ghost service (Kilo-specific), so kilocode_change markers are not required.

## Analysis

The bug is straightforward:

1. User creates two Mistral profiles: one for devstral (regular chat), one for codestral (autocompletion)
2. The `AUTOCOMPLETE_PROVIDER_MODELS` list includes `["mistral", "codestral"]`
3. Old code: `profiles.find(x => x.apiProvider === "mistral")` -- picks the first Mistral profile (devstral)
4. The devstral profile has an API key for `api.mistral.ai`
5. But codestral autocompletion uses `codestral.mistral.ai` as the default endpoint
6. Result: 401 Unauthorized because the devstral API key doesn't work on the codestral endpoint

The fix adds a two-phase lookup:
1. First: `profiles.find(x => x.apiProvider === provider && x.modelId === model)` -- exact match
2. Fallback: `profiles.find(x => x.apiProvider === provider)` -- provider-only match

This is backward compatible: if a user has only one Mistral profile, the exact match fails and the fallback picks it up (same behavior as before). If they have an exact match, it's preferred.

The `const` to `let` change is necessary because the variable is reassigned in the fallback path.

## Verification

CI: All 11 checks passing. No test failures. The fix does not introduce any regression risk since the fallback path preserves the original behavior.

Cannot verify: The actual Mistral endpoint behavior (`codestral.mistral.ai` vs `api.mistral.ai`). However, the PR author reports this is a real scenario they encountered, and the fix logic is sound regardless of the specific endpoint.

## Lessons Learned

- Profile selection bugs surface when users have multiple profiles for the same provider
- Two-phase lookup (exact then fallback) is a common and reliable pattern for backward-compatible fixes
- Excellent PR descriptions with personal bug reports build confidence in the fix

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md) | Reviewed with Claude Code</sub>
