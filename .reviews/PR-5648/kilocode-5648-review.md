<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5648
title: "Feature: add new provider AIHubmix"
author: DDU1222
category: provider
tier: 5
lines: 503
files: 46
verdict: REQUEST_CHANGES
confidence: 4
reviewed_at: 2026-02-14
linked_issue: none
fork_pr: none
-->

# Review: kilocode #5648

> **Feature: add new provider AIHubmix** by @DDU1222
> Local-only analysis (no fork PR, no upstream CI)

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | WARN | Delegation pattern is novel but fragile -- see findings |
| Conventions | WARN | Does not use `RouterProvider` base class like other gateway providers |
| Changeset | FAIL | No changeset included |
| Tests | FAIL | No unit tests for handler or fetcher |
| i18n | PASS | All 22 locale files updated with 2 keys each |
| Types | PASS | Schema, modelIdKeys, discriminated union all wired correctly |
| Security | PASS | API key stored in VSCode secret storage, password field |
| Scope | PASS | Focused on adding one new provider |

## Findings

### RED: Does not extend RouterProvider -- breaks established pattern

All other AI gateway providers (Glama, Unbound, OpenRouter, Requesty) extend `RouterProvider` or at minimum implement `getModel()` with their own model cache lookup. The `AihubmixHandler` instead extends only `BaseProvider` and delegates *everything* to child handler instances (Anthropic, OpenAI, Gemini, OpenAI Responses).

This delegation pattern means:
1. `getModel()` returns whatever the *delegate* thinks the model is -- using the delegate's model lookup, not AIhubmix's. For example, when routing `claude-opus-4-5` to `AnthropicHandler`, it will use Anthropic's static model list, not the dynamically-fetched AIhubmix model info (context window, pricing, features may differ on the gateway).
2. The model fetcher (`fetchers/aihubmix.ts`) fetches models from the AIhubmix API and populates the model cache, but the handler never reads from this cache. The fetched data is only used in the UI model picker, not for runtime decisions.
3. Token counting, tool protocol resolution, and model parameters all depend on the delegate's behavior, which assumes direct provider access, not a gateway.

**Recommendation**: Extend `RouterProvider` like Glama and Unbound do. Use a single OpenAI-compatible client pointing at `aihubmix.com/v1` and handle model-specific quirks (Anthropic max_tokens, Gemini caching) in `createMessage()`, similar to the OpenRouter approach.

### RED: Model routing based on string prefix is fragile

`aihubmix.ts:289-302` -- The `routeModel()` method routes based on `modelId.toLowerCase()`:

```typescript
if (id.startsWith("claude")) {
    return "anthropic"
}
if (id.startsWith("gemini") && !id.endsWith("-nothink") && !id.endsWith("-search")) {
    return "gemini"
}
if (id === "gpt-5-pro" || id === "gpt-5-codex") {
    return "openai-responses"
}
return "openai"
```

Problems:
- **New models break silently**: Any future model ID not starting with "claude" or "gemini" falls through to OpenAI, even if it needs special handling (e.g., Mistral, DeepSeek, Qwen models have provider-specific features).
- **The suffix checks are oddly specific**: `-nothink` and `-search` suffixes are AIhubmix-specific model ID conventions that may change. No documentation explains why these Gemini variants should be routed to OpenAI instead.
- **Hardcoded model IDs**: `gpt-5-pro` and `gpt-5-codex` are hardcoded. When `gpt-5-turbo` or any other Responses API model is added, this breaks.

### YELLOW: `aihubmixModelInfo` defined in schema but never used

The Zod schema defines `aihubmixModelInfo: modelInfoSchema.optional()` but nothing reads it. The handler's `getModel()` delegates to child handlers, and `useSelectedModel.ts` does not use it as a fallback:

```typescript
case "aihubmix": {
    const id = getValidatedModelId(apiConfiguration.aihubmixModelId, routerModels.aihubmix, defaultModelId)
    const info = routerModels.aihubmix?.[id]
    return { id, info }
}
```

If `routerModels.aihubmix` is empty (API fetch fails), `info` is `undefined` -- no fallback to `aihubmixModelInfo` or `aihubmixDefaultModelInfo`.

### YELLOW: No changeset

The changeset bot flagged this. This PR adds a new provider visible to users, which requires at minimum a patch changeset for `kilo-code`, `@roo-code/types`, and `@roo-code/vscode-webview`.

### YELLOW: `supportsNativeTools: true` hardcoded for all models

`fetchers/aihubmix.ts:69` -- Every model from the API is marked as supporting native tools. Not all models support function calling (e.g., some completion-only or embedding models may appear in the list). The fetcher should check the model's capabilities from the API response rather than assuming.

### YELLOW: No tests

No unit tests for:
- `AihubmixHandler` (delegation routing, model caching, error handling)
- `getAihubmixModels` fetcher (API response parsing, edge cases, error paths)
- The `routeModel()` logic (prefix matching, suffix exclusions)

Other providers like OpenRouter and Requesty have test suites. A provider with this level of routing complexity especially needs coverage.

### GRAY: Default model `claude-opus-4-5` may not be accessible to all users

The default model is set to `claude-opus-4-5`, which is one of the most expensive models available. Other gateway providers (Glama, OpenRouter) default to more accessible models. Consider defaulting to a mid-tier model that most AIhubmix users would have access to.

### GRAY: PR description is empty

The PR body contains only the template with no filled-in sections -- no context, implementation notes, screenshots, or test instructions. This makes it harder to understand the author's intent and any design decisions.

## CI Status

| Check | Result |
|-------|--------|
| Upstream CI | N/A -- No CI checks reported on branch |

The PR shows "no checks reported on the 'feature-aihubmix' branch." This suggests CI has not run, possibly because the PR is from a fork without CI configured, or it has not been triggered.

## Merge Status

**CONFLICTING** -- The PR has merge conflicts with the base branch. Must be rebased before merge.

## Code Snippets

### Core delegation pattern (novel approach, not used elsewhere):
```typescript
// src/api/providers/aihubmix.ts
private getDelegateHandler(): ApiHandler {
    const modelId = this.options.aihubmixModelId || AIHUBMIX_DEFAULT_MODEL
    const route = this.routeModel(modelId)
    switch (route) {
        case "anthropic":
            this.delegateHandler = new AnthropicHandler({
                ...this.options,
                apiKey: this.options.aihubmixApiKey,
                anthropicBaseUrl: baseUrl,
                apiModelId: this.options.aihubmixModelId,
            })
            break
        case "gemini":
            this.delegateHandler = new GeminiHandler({...})
            break
        case "openai-responses":
            this.delegateHandler = new OpenAiCompatibleResponsesHandler({...})
            break
        case "openai":
        default:
            this.delegateHandler = new OpenAiHandler({...})
            break
    }
    this.lastModelId = modelId
    return this.delegateHandler
}
```

### Model fetcher (well-structured):
```typescript
// src/api/providers/fetchers/aihubmix.ts
const response = await axios.get(`${baseUrl}/api/v1/models?type=llm&sort_by=coding`)
// Parses features, modalities, pricing, thinking support
// Uses preferredIndex to preserve API sort order
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**REQUEST_CHANGES** -- The delegation pattern (instantiating AnthropicHandler/GeminiHandler/OpenAiHandler internally based on model ID prefix) is architecturally different from every other gateway provider in the codebase. While creative, it introduces fragile string-based routing, makes `getModel()` return data from the wrong provider's model list, and disconnects the fetched model metadata from runtime behavior. The PR also lacks a changeset, has no tests, has merge conflicts, and has no CI runs.

Recommended path forward:
1. Extend `RouterProvider` like Glama and Unbound do, using a single OpenAI-compatible endpoint
2. Add a changeset
3. Add unit tests for handler and fetcher
4. Rebase to resolve conflicts
5. Fill in the PR description
