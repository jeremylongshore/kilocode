<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5560
title: "feat: add Poe provider"
author: marciepeters
category: provider
tier: 5
lines: 1557
files: 32
verdict: COMMENT
confidence: 4
reviewed_at: 2026-02-14
fork_pr: N/A (batch review)
linked_issue: N/A
-->

# Review: kilocode #5560

> **feat: add Poe provider** by @marciepeters

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Handler, fetcher, and wiring are functionally correct |
| Conventions | PASS | Follows RouterProvider pattern, kilocode_change markers present |
| Changeset | PASS | `.changeset/add-poe-provider.md` with `minor` bump |
| Tests | PASS | 965 lines of tests across 6 files; handler, fetcher, integration |
| i18n | PASS | `poeApiKey` and `getPoeApiKey` added to `en/settings.json` |
| Types | PASS | Zod schemas in both `core-schemas` and `types`; `poeModelId` in `ModelIdKey` |
| Security | PASS | API key stored via VSCode secret storage, masked in UI |
| Scope | PASS | Purely additive, 32 new/modified files, zero deletions |

## Findings

### Yellow: Model-prefix-coupled reasoning params

**`src/api/providers/poe.ts:117-139`**

The `getReasoningParams` method uses string-prefix matching (`modelId.startsWith("claude-")`, `modelId.startsWith("gpt-")`) to determine whether to emit `thinking_budget` or `reasoning_effort`. This heuristic will break for models with non-standard prefixes (e.g., Gemini models served through Poe, or future model naming changes).

The fetcher already returns `supportsReasoningBudget` and `supportsReasoningEffort` flags per model. These should be used instead of prefix matching, consistent with how `getModelParams` works elsewhere in the codebase.

```typescript
// Current (fragile):
const isAnthropicModel = modelId.startsWith("claude-")
const isOpenAiModel = modelId.startsWith("gpt-")

// Suggested (robust):
// Use info.supportsReasoningBudget / info.supportsReasoningEffort from fetcher
```

### Gray: Redundant `fetchModel()` override

**`src/api/providers/poe.ts:90-93`**

```typescript
public override async fetchModel() {
    this.models = await getModels({ provider: this.name, apiKey: this.client.apiKey })
    return this.getModel()
}
```

The base `RouterProvider.fetchModel()` does the same but also passes `baseUrl: this.client.baseURL`, which is harmless for the Poe fetcher. This override can be removed.

### Gray: Changeset filename is manually named

**`.changeset/add-poe-provider.md`**

Changesets typically use auto-generated random names (e.g., `wise-spoons-tan.md`). The human-readable name works but is unconventional. Not blocking.

### Gray: Missing `baseUrl` pass-through in fetcher call

**`src/api/providers/fetchers/modelCache.ts:175-180`**

```typescript
case "poe":
    models = await getPoeModels(options.apiKey)
    break
```

Other fetcher calls pass `options.baseUrl` when available. Since Poe has a fixed API endpoint this is correct, but documenting the intent (no user-configurable base URL) would help future maintainers.

## CI Status

| Check | Result |
|-------|--------|
| Merge conflicts | CONFLICTING -- needs rebase against main |
| Review decision | REVIEW_REQUIRED |
| Checks | Not evaluated (conflicts prevent CI completion) |

## Code Snippets

### Handler constructor (good pattern usage)

```typescript
// src/api/providers/poe.ts:78-87
constructor(options: ApiHandlerOptions) {
    super({
        options,
        name: "poe",
        baseURL: POE_BASE_URL,
        apiKey: options.poeApiKey || "not-provided",
        modelId: options.poeModelId,
        defaultModelId: poeDefaultModelId,
        defaultModelInfo: poeDefaultModelInfo,
    })
}
```

### Fetcher model parsing (thorough)

```typescript
// src/api/providers/fetchers/poe.ts:31-62
const supportsReasoningBudget = reasoning?.budget ? true : false
const supportsReasoningEffort = reasoning?.supports_reasoning_effort ?? false
const requiredReasoningBudget = reasoning?.required ?? false

const hasCacheReads = rawModel.pricing?.input_cache_read || rawModel.pricing?.cache_read
const supportsPromptCache = !!hasCacheReads
```

Handles both primary and alternative cache pricing field names (`input_cache_read` vs `cache_read`, `input_cache_write` vs `cache_creation`).

### Webview component (clean)

```typescript
// webview-ui/src/components/settings/providers/Poe.tsx:82-92
<ModelPicker
    apiConfiguration={apiConfiguration}
    setApiConfigurationField={setApiConfigurationField}
    defaultModelId={poeDefaultModelId}
    models={routerModels?.poe ?? {}}
    modelIdKey="poeModelId"
    serviceName="Poe"
    serviceUrl="https://poe.com"
    organizationAllowList={organizationAllowList}
    errorMessage={modelValidationError}
/>
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**COMMENT** -- This is a well-executed provider integration from a Poe employee who clearly studied the existing codebase patterns. The 32-file change is purely additive with zero deletions, comprehensive tests (965 lines), and complete coverage of all integration points (types, schemas, CLI, webview, handler, fetcher, docs, changeset).

The only substantive suggestion is replacing model-prefix-based reasoning param selection with the capability flags already returned by the fetcher. The merge conflicts will need resolution before this can land.

No blocking issues found. Approve after conflict resolution and optional reasoning-param improvement.
