<!-- PR-REVIEW-META
pr: 4772
title: "fix: enable dynamic model selection for OpenAI Compatible provider"
author: b3nw
verdict: COMMENT
confidence: 4
tier: 3
fork_pr: N/A (batch review)
linked_issue: N/A
-->

# PR #4772 Review: Dynamic Model Selection for OpenAI Compatible Provider

**Author**: b3nw
**Verdict**: COMMENT
**Confidence**: 4/5
**Tier**: 3 (Moderate complexity, cross-cutting changes across types/backend/webview)

---

## Summary

This PR enables dynamic model fetching for the OpenAI Compatible provider by hitting the `/v1/models` endpoint of user-configured base URLs. Previously, users had to manually type model IDs. It also fixes a bug in `prettyModelName()` where model IDs with multiple slashes (e.g., `chutes/moonshotai/Kimi-K2-Instruct`) were truncated.

Two components:
1. **Dynamic model fetching**: New fetcher at `src/api/providers/fetchers/openai.ts`, wired into the `modelCache.ts` switch, `webviewMessageHandler.ts` router models flow, and webview hooks.
2. **prettyModelName fix**: `mainId.split("/")[1]` changed to `mainId.split("/").slice(1).join("/")` to preserve the full model path.

---

## Merge Conflict (Blocking)

The PR has **CONFLICTING** merge state (`mergeable: "CONFLICTING"`). The root cause is clear:

- **PR assumes**: `customProviders = ["openai"]` and changes it to `customProviders = []`
- **Current main**: `customProviders = ["openai", "openai-responses"]`

The `"openai-responses"` provider was added to `customProviders` after the PR was branched. The author needs to rebase and change the target to `customProviders = ["openai-responses"]` instead of `[]`.

Additionally, main now has `"zenmux"` in the `dynamicProviders` array, a `zenmux` fetcher in `modelCache.ts`, and other providers that were added after the PR branched. These will all need resolution.

---

## Architecture Observations

### 1. Provider Category Change: Custom -> Dynamic

**`packages/types/src/provider-settings.ts`**

Moving `"openai"` from `customProviders` to `dynamicProviders` is the right approach. When `openai` was a `CustomProvider`, it returned an empty model list (`models: {}`). Making it a `DynamicProvider` means it can fetch models from the API.

However, this has a type-system consequence: `TypicalProvider = Exclude<ProviderName, InternalProvider | CustomProvider | FauxProvider>`. When `"openai"` moves out of `CustomProvider`, it becomes a `TypicalProvider`, so it now **must** have an entry in `modelIdKeysByProvider`. The PR correctly adds `openai: "openAiModelId"` to that map. This is sound.

### 2. Fetcher Implementation Quality

**`src/api/providers/fetchers/openai.ts`** (202 lines)

Strengths:
- Zod schema validation with `.passthrough()` to handle extended fields from different providers
- Comprehensive handling of non-standard fields (`context_window`, `context_length`, `max_context_length`, `max_input_tokens`, etc.)
- Pricing conversion from per-token to per-million-tokens
- Proper error classification (timeout, HTTP status, network, generic)
- Sets `displayName: model.id` to bypass `prettyModelName()` mangling

Observations:
- **Missing `DEFAULT_HEADERS`**: Other fetchers (chutes, deepinfra, etc.) include `DEFAULT_HEADERS` from `../constants` which sets `HTTP-Referer`, `X-Title`, `X-Kilocode-Version`, and `User-Agent`. This fetcher only sets `Content-Type`. While these headers are primarily for OpenRouter identification, the `User-Agent` is good practice. Not critical for correctness since these are user-configured endpoints, but inconsistent with the pattern.
- **Conservative defaults are reasonable**: `contextWindow: 32000` and `maxTokens: 8192` are sensible when the provider doesn't report these fields.
- **`supportsNativeTools` defaults to `true`**: Bold but reasonable -- most modern models do support tools.
- **`supportsTemperature: true` hardcoded**: No parsing of any temperature-related extended field. This is fine for a first pass.
- **`supportsReasoningEffort: false`, `supportsReasoningBudget: false` hardcoded**: PR #4860 addresses exactly this gap with heuristic detection. These two PRs are complementary as the commenter noted.

### 3. prettyModelName Fix

**`webview-ui/src/utils/prettyModelName.ts`**

The fix is correct. Before: `mainId.split("/")[1]` would turn `chutes/moonshotai/Kimi-K2-Instruct` into just `moonshotai`. After: `mainId.split("/").slice(1).join("/")` preserves `moonshotai/Kimi-K2-Instruct`.

The formatting then splits on `-` and capitalizes each word, which produces reasonable output. The test suite at `webview-ui/src/utils/__tests__/prettyModelName.spec.ts` covers the key cases well.

### 4. Router Models Integration

**`src/core/webview/webviewMessageHandler.ts`**

The PR adds `openai: {}` to the initial `routerModels` object and adds a fetch entry passing `apiConfiguration.openAiApiKey`, `apiConfiguration.openAiBaseUrl`, and `apiConfiguration.openAiHeaders`. This follows the established pattern.

**`webview-ui/src/components/kilocode/hooks/useProviderModels.ts`**

Changes `models: {}` to `models: routerModels.openai || {}` in the `"openai"` case, removing the `TODO(catrielmuller)` comment. Clean.

**`webview-ui/src/components/ui/hooks/useRouterModels.ts`**

Adds `openAiApiKey`, `openAiBaseUrl`, `openAiHeaders` to `RouterModelsQueryKey` so the React Query cache invalidates when these settings change. Correct.

### 5. Test Coverage

- **`src/api/providers/fetchers/__tests__/openai.spec.ts`** (562 lines): Thorough. Tests no baseUrl, trailing slashes, custom headers, empty data, invalid format, timeout, HTTP errors, network errors, generic errors, extended model info (context_window, context_length, pricing, vision, tools), field priority ordering. Good coverage.
- **`webview-ui/src/utils/__tests__/prettyModelName.spec.ts`** (67 lines): Covers empty input, no slashes, single slash, multiple slashes, colons/tags, real-world model IDs. Good.
- **Test updates for ClineProvider.spec.ts and webviewMessageHandler.spec.ts**: Properly updated to include the new `openai` provider in mock expectations and error cases.

---

## Specific Concerns

### 1. No `baseUrl` Guard in webviewMessageHandler (Low)

In `webviewMessageHandler.ts`, the `openai` fetch entry passes `baseUrl: apiConfiguration.openAiBaseUrl`. If the user has set an API key but not a base URL, the fetcher returns `{}` and logs a warning. This is fine -- it's consistent with the user needing to configure their endpoint. But it means the fetch will fire (and warn) even for users who haven't configured OpenAI Compatible at all but have some stale `openAiApiKey` in settings. Other providers like `deepinfra` have a default base URL to avoid this.

Consider adding a guard: only include the openai fetch entry if `apiConfiguration.openAiBaseUrl` is truthy, similar to how some providers are conditional.

### 2. Missing `initializeModelCacheRefresh` Entry (Informational)

The `initializeModelCacheRefresh()` function in `modelCache.ts` does background refreshes for public providers on startup. `openai` is not added here, which is correct -- it requires user-specific `baseUrl` and `apiKey`. Just noting this is intentional.

### 3. Conflict with openai-responses (Blocking)

As noted above, the PR drops `"openai-responses"` from `customProviders` by setting the array to `[]`. This would break the `openai-responses` provider added in kilocode's fork. The rebase must preserve `["openai-responses"]`.

---

## CI Status

All checks pass:
- compile: SUCCESS
- unit-test: SUCCESS
- test-extension (ubuntu/windows): SUCCESS
- test-webview (ubuntu/windows): SUCCESS
- test-jetbrains: SUCCESS
- test-cli: SUCCESS
- build-cli: SUCCESS

---

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict: COMMENT

The implementation is solid and well-tested. The architecture is sound -- moving `openai` from `customProviders` to `dynamicProviders` is the right approach. The fetcher handles the diversity of OpenAI-compatible API responses well.

**Cannot approve due to**:
1. **Merge conflicts** that need rebasing, specifically around `customProviders` and `dynamicProviders` arrays where `"openai-responses"` and `"zenmux"` were added after branching.
2. Minor inconsistency with `DEFAULT_HEADERS` pattern.

After rebase and conflict resolution, this would be a clean APPROVE.
