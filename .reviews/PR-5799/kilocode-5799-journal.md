<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5799
title: "Add Ask Sage as a new AI provider"
author: jdbohrman
category: feature
tier: 3
lines: 736
files: 20
review_number: 51
fork_pr: pending
-->

# Review Journal: kilocode #5799

> **PR**: [#5799](https://github.com/Kilo-Org/kilocode/pull/5799) |
> **Title**: Add Ask Sage as a new AI provider |
> **Author**: @jdbohrman |
> **Category**: feature | **Tier**: 3 | **Size**: 736 lines, 20 files

---

## Summary

A new provider integration for AskSage, a FedRAMP-authorized government AI platform providing OpenAI-compatible API access to 150+ models. The handler implementation is clean and well-tested (413 lines), closely following the Requesty provider pattern. However, the PR replaces existing provider entries (corethink, zenmux) instead of adding new ones, ships without a settings UI component, has no changeset, and has merge conflicts. REQUEST_CHANGES.

## First Impressions

"Add Ask Sage as a new AI provider" -- straightforward new provider PR. AskSage is a legitimate platform used by 15,000+ government teams across 27 US agencies with FedRAMP High and DoD IL5/IL6 authorization. This would be a meaningful addition for government/defense sector users who need an authorized AI platform. The PR description is detailed and mentions comprehensive test coverage.

At 736 lines across 20 files, this is a standard-sized provider integration. The CONFLICTING merge state is an immediate red flag.

## What I Looked At

**New files (core implementation):**
- `src/api/providers/asksage.ts` -- 197 lines, handler class
- `src/api/providers/fetchers/asksage.ts` -- 43 lines, model fetcher
- `packages/types/src/providers/asksage.ts` -- 18 lines, default model info
- `src/api/providers/__tests__/asksage.spec.ts` -- 413 lines, test suite

**Integration points (modified files):**
- `packages/types/src/provider-settings.ts` -- dynamicProviders, schemas, model ID keys
- `packages/core-schemas/src/config/provider.ts` -- Zod schema for provider config
- `src/api/index.ts` -- handler factory
- `src/api/providers/index.ts` -- export
- `src/api/providers/fetchers/modelCache.ts` -- model cache switch
- `src/shared/api.ts` -- dynamicProviderExtras (only in diff, not on main)
- `src/core/webview/webviewMessageHandler.ts` -- webview provider map
- `cli/src/config/mapper.ts` -- CLI config mapper
- `cli/src/constants/providers/*` -- CLI provider constants

**Existing providers compared:**
- `src/api/providers/requesty.ts` -- primary pattern reference (234 lines)
- `src/api/providers/unbound.ts` -- alternative pattern using RouterProvider
- `src/api/providers/base-provider.ts` -- base class with `convertToolsForOpenAI()`
- `src/api/providers/constants.ts` -- DEFAULT_HEADERS
- `webview-ui/src/components/settings/providers/ZenMux.tsx` -- settings UI reference

**External documentation:**
- AskSage API docs: `https://docs.asksage.ai/docs/api-documentation/OpenAI-Compatibility-Guide.html`
- Base URL confirmed: `https://api.asksage.ai/server/v1`
- Endpoints: `/v1/chat/completions`, `/v1/models`
- Authentication: Bearer token

## Analysis

### Handler Implementation (Good)

The `AskSageHandler` class closely mirrors `RequestyHandler`:
- Extends `BaseProvider`, implements `SingleCompletionHandler`
- Uses OpenAI SDK with correct base URL and `DEFAULT_HEADERS`
- Streaming with `stream_options: { include_usage: true }`
- Native tool call support via `resolveToolProtocol()` and `convertToolsForOpenAI()`
- Reasoning content handling (`delta.reasoning_content`)
- Error handling via `handleOpenAIError()`
- Model params via `getModelParams()` with `applyRouterToolPreferences()`

The implementation demonstrates good familiarity with the codebase patterns.

### The Replacement Problem (Critical)

The PR was likely branched from a point where `corethink` and `zenmux` existed in the `ProviderName` enum and the author replaced those entries with `asksage`. This is fundamentally wrong because:

1. These are exhaustive Record/switch types -- every provider must have an entry
2. `corethink` and `zenmux` are existing providers with active users
3. The `providerNames` array is `as const` -- removing an entry from it would remove it from the `ProviderName` type union entirely

The correct approach is to add `"asksage"` to the arrays/records alongside the existing entries.

### Missing Settings UI

Every provider that requires user configuration (API key, base URL) needs a settings component in `webview-ui/src/components/settings/providers/`. Without it:
- The provider won't appear in the settings dropdown
- Users can't enter their API key
- The custom base URL option is inaccessible
- The model picker won't render

The `ZenMux.tsx` component (124 lines) is the closest analog and could serve as a template.

### Test Coverage (Strong)

The test suite is comprehensive and well-structured:
- Constructor initialization with default and custom base URL
- `fetchModel()` with and without options
- `createMessage()` streaming with text and usage chunks
- API error handling
- Native tool support: tools in request, no tools with XML protocol
- Tool call partial streaming chunks
- `completePrompt()` success and error cases

All tests mock the OpenAI client properly and verify the correct parameters are passed.

### Schema Definitions (Good)

Zod schemas in both `core-schemas` and `types` packages are properly defined:
```typescript
export const askSageProviderSchema = baseProviderSchema.extend({
    provider: z.literal("asksage"),
    askSageModelId: z.string().optional(),
    askSageBaseUrl: z.string().optional(),
    askSageApiKey: z.string().optional(),
})
```

### Model Fetcher (Adequate but could be better)

The fetcher at `src/api/providers/fetchers/asksage.ts` correctly:
- Constructs the models URL from the base URL
- Strips trailing slashes
- Uses Bearer token authentication
- Maps API response to `ModelInfo` format

But it hardcodes `supportsImages: true` and `supportsNativeTools: true` for all models, which may not be accurate across AskSage's 150+ model catalog.

## Verification

### Merge Status
CONFLICTING -- cannot merge or run CI.

### What We Could Verify
- Handler follows established patterns (compared with Requesty line by line)
- Type definitions are structurally correct
- Test suite covers key paths
- AskSage API documentation confirms OpenAI-compatible endpoints at `https://api.asksage.ai/server/v1`

### What We Could Not Verify
- Streaming support (not documented in AskSage's OpenAI compatibility guide)
- Actual API response format for `/v1/models` endpoint
- Runtime behavior (no CI due to conflicts)
- Build compilation (no CI due to conflicts)

## Diagrams

```
Provider Integration Architecture
==================================

                    ProviderSettings (user config)
                           |
                           v
                    buildApiHandler() -----> AskSageHandler
                                                |
                    +---------+---------+-------+-------+
                    |         |         |               |
                    v         v         v               v
              constructor  fetchModel  createMessage  completePrompt
                 |            |           |               |
                 v            v           v               v
           OpenAI SDK    modelCache   streaming      non-streaming
           (baseURL,     (getModels)  (text, usage,  (single response)
            apiKey,                    tool_calls,
            headers)                   reasoning)

Missing pieces (marked with X):
  [X] Settings UI component (AskSage.tsx)
  [X] ApiOptions.tsx integration
  [X] i18n strings
  [X] Changeset
```

## Bot Review Synthesis

| Bot | Status | Key Finding | Useful? |
|-----|--------|-------------|---------|
| CodeRabbit | Not collected | Batch review — no individual fork PR | N/A |
| Gemini | Not collected | Batch review — no individual fork PR | N/A |
| Greptile | Not collected | Batch review — no individual fork PR | N/A |
| CodeQL | Not collected | Batch review — no individual fork PR | N/A |
| Qodo | Not collected | Batch review — no individual fork PR | N/A |

## Lessons Learned

1. **New providers must ADD, not REPLACE** -- When adding a provider to exhaustive Records and switch/case statements, entries must be additive. Replacing existing provider entries breaks those providers and causes merge conflicts. This is a common mistake when authors branch from a point where the provider list is complete and think they can swap one for another.

2. **Settings UI is not optional** -- A provider without a settings component is unusable in the VS Code extension. The handler, types, and schemas are necessary but not sufficient. Users need UI to configure API keys, base URLs, and select models.

3. **AskSage fills a real niche** -- Government/defense users need FedRAMP-authorized AI platforms. AskSage's OpenAI-compatible API makes integration straightforward, and the provider pattern in this codebase handles it well. This is a worthwhile addition once the structural issues are fixed.

4. **Default model consistency matters** -- When a provider has defaults defined in multiple places (`packages/types/src/providers/`, `cli/src/constants/providers/settings.ts`), they must agree. `gpt-4o-mini` vs `gpt-4o` discrepancy would cause different behavior between extension and CLI.

---

<sub>Review #51 | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
