<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5646
title: "feat(claude-code): Replace OAuth with CLI subprocess integration"
author: Drilmo
category: feature
tier: 6
lines: 4382
files: 23
review_number: 70
-->

# Review Journal: kilocode #5646

> **PR**: [#5646](https://github.com/Kilo-Org/kilocode/pull/5646) |
> **Title**: feat(claude-code): Replace OAuth with CLI subprocess integration |
> **Author**: @Drilmo |
> **Category**: feature | **Tier**: 6 | **Size**: 4382 lines, 23 files

---

## Summary

Migrates Claude Code provider from OAuth-based streaming to CLI subprocess approach after Anthropic restricted OAuth credentials to CLI-only use. Removes 3,763 lines of OAuth/streaming infrastructure and replaces with 270-line CLI runner. Addresses 3 linked issues. Main concern: all existing tests deleted with no replacements for the new code paths.

## First Impressions

The PR title clearly signals a forced migration due to an upstream API change. The description includes the actual error message from Anthropic and references Cline's implementation as precedent. The net deletion of 3,144 lines is a strong signal that this is cleaning up dead code. The 23 changed files are manageable for a tier 6 review.

## What I Looked At

- `src/api/providers/claude-code.ts` -- Rewritten handler using CLI subprocess
- `src/integrations/claude-code/run.ts` -- New CLI subprocess runner
- `src/integrations/claude-code/types.ts` -- New types for CLI integration
- `packages/types/src/providers/claude-code.ts` -- Model definitions overhaul
- `src/utils/resolveToolProtocol.ts` -- XML protocol forced for claude-code
- Deleted files: oauth.ts, streaming-client.ts, rate-limit dashboard
- Test files: 4 spec files deleted (1,586 lines of tests removed)

## Analysis

**Why CLI subprocess**: Anthropic changed their auth policy so OAuth credentials only work through the official CLI. The error message is explicit: "This credential is only authorized for use with Claude Code and cannot be used for other API requests." The subprocess approach is the only remaining path.

**Tool protocol forcing**: The PR forces XML tool protocol for the claude-code provider because the CLI uses `--disallowedTools` which blocks native `tool_use` blocks. This is correctly handled in `resolveToolProtocol.ts`.

**Model definition changes**: The old implementation had 3 models with full capability declarations (images, caching, reasoning, native tools). The new implementation has 16 model ID variants all pointing to a stripped-down base. The capability regression (no images, no caching, no reasoning effort) needs to be validated -- is this an intentional limitation of the CLI approach or an oversight?

**Cost display change**: The PR switches from `totalCost: 0` (subscription-based, no per-token cost) to displaying the actual `total_cost_usd` from the CLI output. This is actually an improvement for users who want to track their usage.

## Verification

- CI: All checks pass on both Ubuntu and Windows
- No upstream reviews yet
- The manual test plan items in the PR description are still unchecked (manual testing with CLI, cost display verification, tool calls with XML format)

## Lessons Learned

1. When upstream providers change their auth model, the extension may need to pivot quickly. Having a clean provider abstraction helps isolate the blast radius.
2. Deleting tests without replacements is a recurring pattern in urgent provider migrations. Test debt should be tracked explicitly.
3. CLI subprocess approaches trade API flexibility for auth simplicity -- capabilities like image support and prompt caching may be harder to expose.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
