<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5849
title: "Make OpenAI-compatible API key optional for local codebase indexing"
author: Neonsy
category: feature
tier: 5
lines: 313
files: 10
verdict: APPROVE
confidence: 4
reviewed_at: 2026-02-14
linked_issue: none
fork_pr: none
-->

# Review: kilocode #5849

> **Make OpenAI-compatible API key optional for local codebase indexing** by @Neonsy

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | All layers (UI, config, factory, embedder) consistently make apiKey optional |
| Conventions | PASS | Uses `// kilocode_change` markers throughout |
| Changeset | PASS | Patch changeset included |
| Tests | PASS | 5 new tests + 3 updated tests covering key scenarios (empty key, key transitions, validation) |
| i18n | PASS | No new user-facing strings; existing i18n strings unchanged |
| Types | PASS | `apiKey` correctly changed to optional (`apiKey?: string`) in interface and config manager |
| Security | PASS | Auth headers omitted when no key provided; dummy key only used for SDK constructor compat |
| Scope | PASS | Focused on single concern across 10 files; no unrelated changes |

## Findings

### GRAY: SDK path leaks "EMPTY" as Bearer token

`openai-compatible.ts` -- When `isFullUrl` is false (base URL mode), the OpenAI SDK sends `Authorization: Bearer EMPTY` to the endpoint. This is harmless for local endpoints that ignore auth, but it could confuse endpoints that log auth failures without blocking. The direct fetch path correctly omits auth headers when the key is empty.

This is not blocking -- the target use case is local/self-hosted endpoints, and the SDK requires a non-empty string.

### GRAY: Exported `createValidationSchema` for testing

`CodeIndexPopover.tsx:104` -- The function was changed from a module-private `const` to an `export const` to enable the new validation spec file. This is a minor scope increase but is a reasonable tradeoff for testability. The function has no side effects and is safe to export.

### GRAY: `apiKey` parameter type widened but field type unchanged

`openai-compatible.ts:60` -- The constructor parameter is widened to `string | undefined`, but the instance field `private readonly apiKey: string` stays as `string` (line 39). This works because the constructor normalizes `undefined` to `""` via `(apiKey ?? "").trim()`. The types are consistent at runtime but the constructor signature suggests `undefined` is valid while the field suggests it is not. This is fine in practice.

## CI Status

| Check | Result |
|-------|--------|
| build-cli | PASS |
| compile | PASS |
| check-translations | PASS |
| test-cli | PASS |
| test-extension (ubuntu) | PASS |
| test-extension (windows) | PASS |
| test-jetbrains | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| unit-test | PASS |
| Build Markdoc Site | PASS |

All 11 upstream CI checks pass.

## Code Snippets

### Core change -- embedder accepts empty key:
```typescript
// openai-compatible.ts (after PR)
constructor(baseUrl: string, apiKey: string | undefined, modelId?: string, maxItemTokens?: number) {
    if (!baseUrl) {
        throw new Error(t("embeddings:validation.baseUrlRequired"))
    }
    // apiKey validation removed -- no longer throws on empty

    this.baseUrl = baseUrl
    this.apiKey = (apiKey ?? "").trim()
    const sdkApiKey = this.apiKey || OPENAI_COMPATIBLE_DUMMY_API_KEY  // "EMPTY"

    this.embeddingsClient = new OpenAI({
        baseURL: baseUrl,
        apiKey: sdkApiKey,
    })
}
```

### Direct fetch omits auth headers when no key:
```typescript
// openai-compatible.ts -- makeDirectEmbeddingRequest (after PR)
const headers: Record<string, string> = {
    "Content-Type": "application/json",
}
if (this.apiKey) {
    headers["api-key"] = this.apiKey
    headers.Authorization = `Bearer ${this.apiKey}`
}
```

### Config manager no longer requires apiKey for isConfigured:
```typescript
// config-manager.ts (after PR)
} else if (this.embedderProvider === "openai-compatible") {
    const baseUrl = this.openAiCompatibleOptions?.baseUrl
    const qdrantUrl = this.qdrantUrl
    const isConfigured = !!(baseUrl && qdrantUrl)  // apiKey removed from check
    return isConfigured
}
```

### UI validation relaxes apiKey:
```typescript
// CodeIndexPopover.tsx (after PR)
case "openai-compatible":
    return baseSchema.extend({
        codebaseIndexOpenAiCompatibleBaseUrl: z
            .string()
            .min(1, t("settings:codeIndex.validation.baseUrlRequired"))
            .url(t("settings:codeIndex.validation.invalidBaseUrl")),
        codebaseIndexOpenAiCompatibleApiKey: z.string().optional(),  // Was: .min(1, ...)
        // ...
    })
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**APPROVE** -- This is a clean, well-scoped change that solves a real user-reported friction point. The approach is correct: make the API key optional at every layer (UI validation, config management, service factory, embedder constructor) while preserving security behavior for keyed endpoints. The direct fetch path properly omits auth headers when no key is set. The SDK path uses a harmless dummy key ("EMPTY") only because the OpenAI SDK requires a non-empty string -- local endpoints will ignore it. Test coverage is thorough with 5 new tests and 3 updated tests covering the empty key, key-to-empty and empty-to-key transitions, and validation schema behavior. All 11 CI checks pass. The only nitpick is the "EMPTY" Bearer token on the SDK path, which is cosmetic for the intended use case.
