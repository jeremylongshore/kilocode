<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5799
title: "Add Ask Sage as a new AI provider"
author: jdbohrman
category: provider
tier: 5
lines: 736
files: 20
review_number: 58
-->

# Review Journal: kilocode #5799

> **PR**: [#5799](https://github.com/Kilo-Org/kilocode/pull/5799) |
> **Title**: Add Ask Sage as a new AI provider |
> **Author**: @jdbohrman |
> **Category**: provider | **Tier**: 5 | **Size**: 736 lines, 20 files

---

## Summary

New provider addition for AskSage -- an OpenAI-compatible AI router. The implementation is solid and follows established patterns, but the PR has rebase issues (replaces corethink and removes ZenMux mapping), is missing a changeset, and has no CI checks. Verdict: COMMENT with fixable issues.

## First Impressions

New provider PRs are formulaic -- handler, fetcher, type/schema registration, tests. At 720 additions across 20 files, this touches all the expected integration points. The 413-line test file signals quality effort. Concern: the author appears to be a first-time contributor based on the PR structure.

## What I Looked At

- `src/api/providers/asksage.ts` -- handler implementation (197 lines)
- `src/api/providers/fetchers/asksage.ts` -- model fetcher (43 lines)
- `packages/types/src/providers/asksage.ts` -- default model info
- `src/api/providers/__tests__/asksage.spec.ts` -- test suite (413 lines)
- All CLI registration files (mapper, labels, models, settings, validation)
- `packages/core-schemas/src/config/provider.ts` -- Zod schema
- `packages/types/src/provider-settings.ts` -- discriminated union
- `webview-ui/src/components/ui/hooks/useSelectedModel.ts` -- model selection
- Cross-referenced with OpenRouter and Requesty handler patterns on main

## Analysis

The handler inherits from `BaseProvider`, creates an OpenAI client targeting `https://api.asksage.ai/server/v1`, and implements the standard `createMessage` / `completePrompt` interface. Model fetching goes through the shared `getModels` cache infrastructure. Native tool support is gated by `resolveToolProtocol`.

Key issues found:

1. **Rebase collision**: The diff replaces `corethink` entries in CLI constants rather than adding `asksage` alongside. This suggests the author branched before corethink was removed/renamed, or there's an unresolved rebase conflict.

2. **ZenMux mapping removed**: `getProviderDefaultModelId()` loses the `zenmux` case, which would break ZenMux model resolution -- a Kilo-specific provider.

3. **Missing changeset**: The changeset-bot correctly flagged this. Touches 5+ packages.

4. **Axios vs fetch**: The fetcher uses `axios` while all other fetchers use native `fetch`. Minor inconsistency.

5. **Default model mismatch**: Types say `gpt-4o-mini`, CLI default says `gpt-4o`.

## Verification

- No CI checks ran on the branch (fork without CI configured)
- Tests are well-structured and cover the expected paths
- Cannot verify runtime behavior without AskSage API key

## Lessons Learned

- New provider PRs from external contributors often have rebase issues with rapidly-changing provider lists
- The CLI constants files (`labels.ts`, `models.ts`, etc.) use `Record<ProviderName, ...>` which forces every new provider to touch the same lines, creating merge conflicts

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
