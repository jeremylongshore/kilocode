<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5860
title: "Fix Azure/OpenAI endpoints and reject Azure AI Inference URLs"
author: Neonsy
category: feature
tier: 5
lines: 327
files: 5
verdict: COMMENT
confidence: 4
reviewed_at: 2026-02-14
linked_issue: none
fork_pr: none
-->

# Review: kilocode #5860

> **Fix Azure/OpenAI endpoints and reject Azure AI Inference URLs** by @Neonsy
> Confirmed working by Discord user @Anthonix24812 on gpt-5.2-codex (Foundry deployment)

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | WARN | URL normalization has an aggressive `/v1` append that may break non-standard endpoints |
| Conventions | PASS | Uses `// kilocode_change` markers consistently |
| Changeset | PASS | Patch changeset included |
| Tests | PASS | 153 new lines of test coverage across 7 new test cases |
| i18n | PASS | Reuses existing `settings:validation.openAi` key |
| Types | PASS | Clean TypeScript, proper `satisfies ApiHandlerOptions` in tests |
| Security | WARN | URL normalization could silently redirect requests to wrong service -- see findings |
| Scope | PASS | Focused on Azure endpoint classification and Responses API routing |

## Findings

### YELLOW: URL normalization unconditionally appends `/v1` to non-Azure paths

`openai-responses.ts` -- `normalizeResponsesBaseUrl()` in the non-Azure branch:

```typescript
} else {
    if (pathname === "" || pathname === "/") {
        pathname = "/v1"
    } else if (!pathname.endsWith("/v1")) {
        pathname = `${pathname}/v1`
    }
}
```

If a user provides a non-Azure base URL that already includes a custom path (e.g., `https://my-proxy.com/custom/api`), this will produce `https://my-proxy.com/custom/api/v1/responses`. Many OpenAI-compatible proxies and custom endpoints do not expect `/v1` in their path. The previous behavior (`baseUrl + "/v1/responses"`) had a similar issue, but this normalization is now more explicit and harder to work around.

The same pattern in the Azure branch aggressively rewrites paths:
```typescript
} else if (!pathname.endsWith("/v1")) {
    pathname = `${pathname}/v1`
}
```

If a user provides something like `https://myresource.openai.azure.com/openai/v2-preview`, this would become `.../openai/v2-preview/v1/responses` -- unlikely to be correct.

Recommendation: Consider only appending `/v1` when the path is empty, `/`, or matches known patterns. For unrecognized paths, preserve them as-is and just append `/responses`.

### YELLOW: Silent catch in `normalizeResponsesBaseUrl` returns default URL

```typescript
} catch {
    return defaultBaseUrl
}
```

If a user provides a malformed URL, it silently falls back to `https://api.openai.com/v1` (or the Azure default `https://api.openai.azure.com/openai/v1`). This could cause requests to go to the wrong API endpoint, potentially leaking the user's API key to a service they did not intend. A thrown error with a clear message would be safer here.

### YELLOW: `shouldAppendAzureApiVersion` uses substring matching

```typescript
private shouldAppendAzureApiVersion(url: URL): boolean {
    const pathname = url.pathname.replace(/\/+$/, "")
    return !pathname.includes("/openai/v1")
}
```

This uses `includes` rather than a segment-boundary match. A URL like `/some/openai/v1-preview/path` would match and suppress the `api-version` parameter incorrectly. While unlikely in practice, matching on segment boundaries (e.g., regex `/\/openai\/v1(\/|$)/`) would be more precise.

### GREEN: Azure AI Inference rejection is clean and well-placed

The `assertSupportedResponsesEndpoint()` guard is called in three places:
1. `createMessage()` -- entry point for streaming
2. `makeResponsesApiRequest()` -- fallback SSE path
3. `completePrompt()` -- single completion

This covers all code paths. The error message is actionable, telling users exactly what URL format to use instead.

### GREEN: Dead import cleanup

The PR removes two unused imports: `OPENAI_AZURE_AI_INFERENCE_PATH` (was only used for the now-rejected AI Inference path) and `handleOpenAIError` (was already unused before this PR). Clean.

### GREEN: Webview validation now covers `openai-responses`

The `validate.ts` change adds a missing validation case for `openai-responses` that requires all three fields (`openAiBaseUrl`, `openAiApiKey`, `openAiModelId`). This mirrors the existing `openai` provider validation and prevents incomplete configurations from being saved.

### GREEN: Azure-specific auth in fallback path

The fallback path now correctly uses `api-key` header for Azure endpoints and `Authorization: Bearer` for non-Azure. Previously, the fallback always used `Authorization: Bearer`, which does not work for Azure OpenAI.

### GRAY: Inconsistency with `openai.ts` provider

The `openai.ts` provider (Chat Completions API) still supports Azure AI Inference endpoints via `OPENAI_AZURE_AI_INFERENCE_PATH`. The `openai-responses.ts` provider now rejects them. While intentional (the Responses API is not available on AI Inference endpoints), the divergence could confuse users who switch between providers. A note in the error message suggesting the `openai` (Chat Completions) provider would help.

### GRAY: Unused import in test file

The diff adds `import OpenAI, { AzureOpenAI } from "openai"` to the test file, but neither `OpenAI` nor `AzureOpenAI` is used directly in any test assertion. The mock at the top of the file handles the openai module. Harmless but unnecessary.

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

### Azure endpoint classification (constructor):
```typescript
this.isAzureAiInferenceEndpoint = this._isAzureAiInference(this.options.openAiBaseUrl)
this.isAzureOpenAiEndpoint =
    urlHost === "azure.com" || urlHost.endsWith(".azure.com") || !!options.openAiUseAzure
```

### Fallback URL + auth construction:
```typescript
private getResponsesFallbackTarget(apiKey: string): { url: string; headers: Record<string, string> } {
    const normalizedBaseUrl = this.normalizeResponsesBaseUrl(this.options.openAiBaseUrl)
    const url = new URL(`${normalizedBaseUrl.replace(/\/+$/, "")}/responses`)
    const headers: Record<string, string> = { ...(this.options.openAiHeaders || {}) }

    if (this.isAzureOpenAiEndpoint) {
        headers["api-key"] = apiKey
        if (this.shouldAppendAzureApiVersion(url) && !url.searchParams.has("api-version")) {
            url.searchParams.set("api-version", this.options.azureApiVersion || azureOpenAiDefaultApiVersion)
        }
    } else {
        headers.Authorization = `Bearer ${apiKey}`
    }
    return { url: url.toString(), headers }
}
```

### URL normalization (Azure path rewriting):
```typescript
if (this.isAzureOpenAiEndpoint) {
    if (/\/openai\/deployments\/[^/]+$/.test(pathname)) {
        pathname = "/openai/v1"
    } else if (pathname === "" || pathname === "/") {
        pathname = "/openai/v1"
    } else if (pathname === "/v1") {
        pathname = "/openai/v1"
    } else if (pathname === "/openai") {
        pathname = "/openai/v1"
    } else if (pathname.endsWith("/openai")) {
        pathname = `${pathname}/v1`
    } else if (!pathname.endsWith("/v1")) {
        pathname = `${pathname}/v1`
    }
}
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**COMMENT** -- This PR solves a real user-facing problem confirmed by a Discord community member testing on Azure Foundry with gpt-5.2-codex. The approach is sound: classify endpoints early, reject unsupported ones with clear guidance, and normalize URLs for the Responses API fallback path. The test coverage is excellent with 7 new test cases covering URL normalization, Azure auth, Azure AI Inference rejection, and webview validation.

Three concerns prevent a clean APPROVE: (1) the URL normalization aggressively appends `/v1` to all paths, which could break custom proxy endpoints or future API versions; (2) the silent fallback to default URLs on malformed input could leak API keys to the wrong service; and (3) the `shouldAppendAzureApiVersion` check uses substring matching instead of segment-boundary matching. None of these are blockers for the primary Azure use case, but they represent edge-case risks worth addressing before merge.
