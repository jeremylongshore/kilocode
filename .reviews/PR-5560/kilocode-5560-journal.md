<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5560
title: "feat: add Poe provider"
author: marciepeters
category: provider
tier: 5
lines: 1557
files: 32
review_number: 49
-->

# Review Journal: kilocode #5560

> **PR**: [#5560](https://github.com/Kilo-Org/kilocode/pull/5560) |
> **Title**: feat: add Poe provider |
> **Author**: @marciepeters |
> **Category**: provider | **Tier**: 5 | **Size**: 1557 lines, 32 files

---

## Summary

High-quality new provider PR from a Poe/Quora employee. APPROVE. Follows existing provider patterns exactly with excellent test coverage. The only concern is missing CI checks on the branch.

## First Impressions

Author identifies as a Poe employee, which gives confidence in the API integration quality. The PR description is thorough with screenshots, test instructions, and contact info. The 1557 lines are split roughly as: ~965 lines of tests, ~310 lines of provider/fetcher implementation, ~280 lines of boilerplate (types, CLI, webview, i18n).

## What I Looked At

- `src/api/providers/poe.ts` -- main handler extending RouterProvider
- `src/api/providers/fetchers/poe.ts` -- model fetcher using Poe's `/v1/models` endpoint
- `src/api/providers/__tests__/poe.spec.ts` -- 538-line handler test suite
- `src/api/providers/fetchers/__tests__/poe.spec.ts` -- 427-line fetcher test suite
- `packages/types/src/providers/poe.ts` -- type definitions and defaults
- `packages/types/src/provider-settings.ts` -- schema integration
- `packages/core-schemas/src/config/provider.ts` -- Zod schema for CLI
- `webview-ui/src/components/settings/providers/Poe.tsx` -- settings UI component
- `cli/src/constants/providers/` -- CLI integration (labels, models, settings, validation)
- All webview/handler wiring files

## Analysis

The implementation is notably clean for a new-provider PR. Key architectural decisions:

1. **Extends RouterProvider**: Reuses the OpenAI-compatible base class, which handles client creation, model caching, and tool conversion. This is the correct pattern.

2. **Reasoning parameter routing**: The `getReasoningParams` method intelligently routes `thinking_budget` to Claude models and `reasoning_effort` to OpenAI models based on model ID prefix. This handles Poe's multi-provider nature well.

3. **NATIVE_TOOL_DEFAULTS spread**: All models get native tool support as a baseline, overridable by cached model metadata. This is the right default for an OpenAI-compatible endpoint.

4. **Cache token handling**: The `processUsageMetrics` method correctly extracts `caching_tokens` and `cached_tokens` from Poe's usage response, mapping to Kilo's `cacheWriteTokens`/`cacheReadTokens`.

5. **Test quality**: The test suite covers:
   - Constructor initialization and default API key
   - Model fetching with NATIVE_TOOL_DEFAULTS merge
   - Streaming text, reasoning, and tool call content
   - Multiple concurrent tool calls
   - Usage metrics with cache tokens
   - Reasoning params for both Anthropic and OpenAI model families
   - completePrompt (non-streaming)
   - Error handling
   - Model fetcher: all model metadata fields, image support, reasoning capabilities, cache support, error handling, empty responses, missing fields

## Verification

CI: No checks reported on the `feature/poe-provider` branch. This is the only concern -- the PR should have CI run before merge.

Existing test infrastructure checks confirmed: the PR updates `ClineProvider.spec.ts` and `webviewMessageHandler.spec.ts` to include Poe in router model expectations.

## Lessons Learned

- Domain expert contributors (Poe employee) produce higher quality provider integrations
- The RouterProvider base class makes new provider PRs follow a predictable structure
- 965 lines of tests for 310 lines of implementation (~3:1 ratio) is the gold standard for provider PRs

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md) | Reviewed with Claude Code</sub>
