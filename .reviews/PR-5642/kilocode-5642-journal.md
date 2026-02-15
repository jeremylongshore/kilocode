<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5642
title: "feat: allow auto-selecting rules based on prompt and context"
author: shssoichiro
category: feature
tier: 6
lines: 1043
files: 67
review_number: 69
-->

# Review Journal: kilocode #5642

> **PR**: [#5642](https://github.com/Kilo-Org/kilocode/pull/5642) |
> **Title**: feat: allow auto-selecting rules based on prompt and context |
> **Author**: @shssoichiro |
> **Category**: feature | **Tier**: 6 | **Size**: 1043 lines, 67 files

---

## Summary

AI-driven rule auto-selection feature. An LLM analyzes the user's prompt and first ~200 chars of each available rule to decide which rules to include. Graceful fallback to all rules on error. Well-tested with proper i18n. Main concerns are per-message LLM overhead and brittle path-based global/local detection. COMMENT verdict.

## First Impressions

Title signals a genuinely useful feature -- users with many rules currently have to manually toggle them per task. The implementation uses the existing support prompt infrastructure, which is the right architectural choice. The PR description notes that most file changes are translations, which checks out (48/67 files are i18n).

## What I Looked At

- `src/core/auto-select/auto-select-rules.ts` -- Core LLM selection logic
- `src/core/auto-select/__tests__/auto-select-rules.spec.ts` -- Test coverage
- `src/core/webview/kilorules.ts` -- Rule metadata extraction with description truncation
- `src/core/prompts/sections/custom-instructions.ts` -- Integration with prompt system
- `src/core/prompts/system.ts` -- Parameter threading
- `src/core/task/Task.ts` -- Where auto-select is triggered
- `src/core/webview/ClineProvider.ts` -- State management
- `src/core/webview/webviewMessageHandler.ts` -- Message handling
- `src/shared/support-prompt.ts` -- Prompt template
- `src/shared/cline-rules.ts` -- New RuleMetadata type
- `packages/types/src/global-settings.ts` -- Schema additions
- `webview-ui/src/components/kilocode/rules/AutoSelectToggle.tsx` -- UI component

## Analysis

**Architecture**: The feature follows the existing pattern for auxiliary LLM operations (similar to commit message generation, YOLO gatekeeper). It uses `streamResponseFromHandler` with a support prompt template and `buildApiHandler` to create a standalone handler. The result is threaded through `autoSelectedRulePaths` to the system prompt generator.

**Rule description extraction**: `extractDescription()` reads the first 200 chars, extends to whitespace up to 250 chars. This is pragmatic but means rules starting with YAML frontmatter will have poor descriptions. The LLM prompt includes both name and description, so even poor descriptions won't break selection -- they just make it less accurate.

**Response parsing**: `parseAutoSelectResponse()` handles "none", comma-separated indices, and out-of-range values gracefully. The regex-based extraction (`/\d+/g`) is robust to various LLM response formats.

**UI integration**: The toggle disables manual rule toggles when auto-select is on, which is correct UX. The toggle component is accessible with keyboard support.

## Verification

- CI: All 11 checks pass (compile, test-extension Ubuntu/Windows, test-webview Ubuntu/Windows, test-cli, check-translations, build-cli, test-jetbrains, markdoc site)
- No existing reviews from upstream maintainers
- Changeset correctly classified as minor

## Lessons Learned

1. For features that add LLM calls to the critical path, always evaluate the latency and cost implications per-user-interaction, not just per-feature-toggle.
2. Rule description heuristics (first N chars) may benefit from explicit metadata fields as the rule ecosystem matures.
3. The support prompt system provides a clean pattern for adding auxiliary LLM features without modifying the main conversation flow.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
