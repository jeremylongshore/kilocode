<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5779
title: "feat(anthropic): support custom model typing and endpoint discovery for Anthropic-compatible providers"
author: ramhaidar
category: provider
tier: 5
lines: 954
files: 15
review_number: 57
-->

# Review Journal: kilocode #5779

> **PR**: [#5779](https://github.com/Kilo-Org/kilocode/pull/5779) |
> **Title**: feat(anthropic): support custom model typing and endpoint discovery for Anthropic-compatible providers |
> **Author**: @ramhaidar |
> **Category**: provider | **Tier**: 5 | **Size**: +759/-195, 15 files

---

## Summary

Comprehensive feature PR that adds custom Anthropic-compatible model support. Includes base URL normalization (stripping `/v1` to avoid SDK duplication), model discovery via `/v1/models` endpoint, custom model ID passthrough, and adaptive thinking settings for unknown models. The prompt cache logic was refactored from a model-list switch statement to feature-based conditionals. Thorough test coverage across 4 test files. CI has not run.

## First Impressions

The PR description is exemplary - detailed implementation notes, screenshots showing before/after UI, test instructions, and linked issues (#3544, #3545). The scope is large at 954 lines across 15 files, combining what could be 3-4 separate features. The author clearly understands the Anthropic provider architecture.

## What I Looked At

- `src/api/providers/anthropic.ts` (main) - current Anthropic handler with switch-based model routing
- Full diff of all 15 files
- `packages/types/src/provider-settings.ts` - new anthropicCustomAdaptiveThinking field
- `packages/types/src/vscode-extension-host.ts` - new message types
- `src/core/webview/webviewMessageHandler.ts` - new requestAnthropicModels handler
- Test files: `anthropic.spec.ts`, `webviewMessageHandler.spec.ts`, `ApiOptions.spec.tsx`, `ThinkingBudget.spec.tsx`, `useSelectedModel.spec.ts`
- PR comments (only changeset-bot)
- CI status (not run)

## Analysis

### Architecture: Four Features in One PR

1. **Base URL normalization**: `normalizeAnthropicBaseUrl()` and `stripAnthropicVersionPath()` handle the common user error of entering `https://endpoint.example.com/v1` as the base URL. The Anthropic SDK internally appends `/v1/messages`, which would result in `/v1/v1/messages`. The normalization strips the trailing `/v1`.

2. **Model discovery**: New `getAnthropicModels()` function calls the Anthropic-compatible `/v1/models` endpoint with either `x-api-key` or `Authorization: Bearer` authentication. Results are deduplicated and sent to the webview via a new `requestAnthropicModels` -> `anthropicModels` message flow.

3. **Custom model ID passthrough**: The `getModel()` method was refactored to preserve unknown model IDs instead of falling back to the default. Custom models get a cloned `ModelInfo` from the default model with `supportsReasoningBudget: true` and full verbosity options.

4. **Adaptive thinking for custom models**: A new `anthropicCustomAdaptiveThinking` provider setting allows users to opt into adaptive thinking for non-standard models. The UI auto-syncs with the master reasoning toggle: enabling adaptive auto-enables reasoning, disabling reasoning auto-disables adaptive.

### Prompt Cache Refactoring

The biggest structural change is in `createMessage()`. The original code used a `switch (modelId)` with 12 cases to determine which models support prompt caching. The new code uses `model.info.supportsPromptCache !== false`, which is a feature flag on the model info. This means:

- All known Anthropic models already have `supportsPromptCache` in their model info (or it defaults to `undefined`, which is treated as `true`)
- Custom models also get prompt caching by default since their cloned `ModelInfo` doesn't explicitly set `supportsPromptCache: false`

This is a better pattern because adding new Anthropic models no longer requires updating the switch statement. However, it means custom models for non-Anthropic endpoints that don't support prompt caching will still attempt it, which could cause errors if the endpoint rejects the `cache_control` parameter.

### Test Quality

The tests are well-structured and cover the key scenarios:
- URL normalization edge cases (with/without `/v1`)
- Model discovery with mocked axios (both API key and bearer token auth)
- Custom model ID preservation in `getModel()`
- Adaptive thinking capability toggle
- Webview message handler integration
- Settings UI checkbox behavior and auto-sync
- ThinkingBudget hiding the slider in adaptive mode

The test for `requestAnthropicModels` in `webviewMessageHandler.spec.ts` uses `as any` for the message type, which is pragmatic for testing but could mask type errors.

### Dependency Change

The PR replaces `import OpenAI from "openai"` with `import axios from "axios"` in the Anthropic provider. The OpenAI import was likely used for a model listing function that's being replaced. Axios is used for the direct HTTP call to `/v1/models`. This is a reasonable choice since the Anthropic SDK doesn't expose a model listing method.

## Verification

- **CI**: No checks have run on the branch. Cannot verify compilation, type-checking, or test suite compatibility.
- **Upstream**: REVIEW_REQUIRED, no reviews submitted.
- **Test evidence**: Cannot verify locally without the VS Code extension host.
- **Fixes**: References issues #3544 and #3545 for custom model support.

## Lessons Learned

1. **Feature-based conditionals are better than model-list switches.** The refactoring from `switch (modelId)` to `if (model.info.supportsPromptCache !== false)` is a pattern that should be applied to other providers.

2. **Model discovery should report errors to the user.** Silently returning an empty array on failure gives no feedback. Even a non-blocking notification would be more helpful.

3. **Large PRs combining multiple features increase review risk.** This PR could be split into: (a) URL normalization, (b) model discovery, (c) custom model passthrough, (d) adaptive thinking UI. Each would be easier to review, test, and revert independently.

4. **Custom model defaults should be documented.** Users need to know that custom models inherit the default model's pricing, context window, and capabilities, and that those values may not reflect their actual model.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
