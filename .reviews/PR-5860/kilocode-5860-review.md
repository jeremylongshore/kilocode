<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5860
title: "Fix Azure/OpenAI endpoints and reject Azure AI Inference URLs"
author: Neonsy
category: feature
tier: 5
lines: 327
files: 5
verdict: APPROVE
confidence: 4
reviewed_at: 2026-02-15
-->

# Review: kilocode #5860

> **Fix Azure/OpenAI endpoints and reject Azure AI Inference URLs** by @Neonsy

[Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Fixes Azure deployment URL normalization; rejects unsupported Azure AI Inference endpoints |
| Conventions | PASS | Uses `kilocode_change` markers, adds validation for openai-responses provider |
| Changeset | PASS | Patch changeset included |
| Tests | PASS | 153 new test lines covering URL normalization, Azure auth, endpoint rejection, validation |
| i18n | N/A | Error messages are technical/descriptive, not user-facing i18n |
| Types | PASS | No type changes needed |
| Security | PASS | URL validation prevents misrouting; auth header separation (api-key vs Bearer) is correct |
| Scope | PASS | Focused on openai-responses provider Azure endpoint handling |

## Findings

### 1. Azure AI Inference endpoint rejection is a good guard (severity: gray)

The PR adds an explicit check that rejects `*.services.ai.azure.com` endpoints with a clear error message:

```typescript
private assertSupportedResponsesEndpoint(): void {
    if (this.isAzureAiInferenceEndpoint) {
        throw new Error(
            "Azure AI Inference endpoints (*.services.ai.azure.com) are not supported by OpenAI Compatible (Responses)..."
        )
    }
}
```

This is called at three entry points: `createMessage`, `makeResponsesApiRequest`, and `completePrompt`. The error message includes guidance to use Azure OpenAI instead. This is better than silently failing with confusing 404s.

### 2. URL normalization handles many edge cases (severity: gray)

The `normalizeResponsesBaseUrl` method handles:
- Stripping `/chat/completions`, `/completions`, `/responses` suffixes
- Converting `/openai/deployments/<name>` to `/openai/v1`
- Azure endpoints without `/openai` path get `/openai/v1` appended
- Bare `/v1` on Azure becomes `/openai/v1`
- Non-Azure bare paths get `/v1` appended
- Query parameters and hashes are stripped

This is necessarily complex because Azure users provide URLs in many different formats. The test coverage validates the important cases.

### 3. api-version parameter correctly omitted for /openai/v1 paths (severity: gray)

```typescript
private shouldAppendAzureApiVersion(url: URL): boolean {
    const pathname = url.pathname.replace(/\/+$/, "")
    return !pathname.includes("/openai/v1")
}
```

Azure's `/openai/v1` path does not require an `api-version` query parameter. This is correct per Azure OpenAI documentation -- the v1 API endpoint is version-agnostic.

### 4. Removed Azure AI Inference client construction from constructor (severity: yellow)

The original constructor had three branches: Azure AI Inference, Azure OpenAI, and standard OpenAI. The PR removes the Azure AI Inference branch entirely and converts it to a runtime rejection. The `isAzureAiInferenceEndpoint` flag is now only used for the `assertSupportedResponsesEndpoint` guard.

This means the `OPENAI_AZURE_AI_INFERENCE_PATH` import is also removed. This is a behavioral change -- previously, Azure AI Inference endpoints would get a configured client that might partially work; now they fail immediately with a clear error. This is the correct approach since the Responses API is not supported on Azure AI Inference.

### 5. Fallback auth correctly separates Azure vs non-Azure (severity: gray)

```typescript
if (this.isAzureOpenAiEndpoint) {
    headers["api-key"] = apiKey
    // Conditionally add api-version
} else {
    headers.Authorization = `Bearer ${apiKey}`
}
```

Azure OpenAI uses `api-key` header, while standard OpenAI uses `Authorization: Bearer`. The previous code was sending `Authorization` for all endpoints in the fallback path, which would fail for Azure. Tests validate both paths.

### 6. webview validation added for openai-responses (severity: gray)

```typescript
case "openai-responses":
    if (!apiConfiguration.openAiBaseUrl || !apiConfiguration.openAiApiKey || !apiConfiguration.openAiModelId) {
        return i18next.t("settings:validation.openAi")
    }
    break
```

This is a good addition -- `openai-responses` was missing from the validation switch. All three fields (base URL, API key, model ID) are correctly required.

### 7. 404 error message improvement for Azure users (severity: gray)

The 404 error message now includes Azure-specific guidance:

```typescript
errorMessage = this.isAzureOpenAiEndpoint
    ? "...use a base URL like https://<resource>.openai.azure.com/openai/v1..."
    : "...The endpoint may not be available yet..."
if ((this.options.openAiBaseUrl || "").includes("/deployments/")) {
    errorMessage += " Do not use a /deployments/.../chat/completions URL as the base URL."
}
```

This directly addresses a common misconfiguration pattern.

## CI Status

| Check | Result |
|-------|--------|
| compile | PASS |
| test-extension (ubuntu) | PASS |
| test-extension (windows) | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| test-cli | PASS |
| test-jetbrains | PASS |
| build-cli | PASS |
| check-translations | PASS |

## Code Snippets

URL normalization for Azure deployment paths:

```typescript
if (/\/openai\/deployments\/[^/]+$/.test(pathname)) {
    pathname = "/openai/v1"
} else if (pathname === "" || pathname === "/") {
    pathname = "/openai/v1"
} else if (pathname === "/v1") {
    pathname = "/openai/v1"
} else if (pathname === "/openai") {
    pathname = "/openai/v1"
}
```

Test validates correct normalization for complex Azure URL:

```typescript
// Input: https://myresource.openai.azure.com/openai/deployments/my-deployment/chat/completions?api-version=2024-05-01-preview
// Output: https://myresource.openai.azure.com/openai/v1/responses (no api-version)
```

## Verdict

**APPROVE** -- This PR correctly fixes Azure URL handling in the OpenAI Responses provider. The URL normalization handles the many variations of Azure endpoint formats that users provide. The Azure AI Inference rejection fails fast with a clear message instead of silently sending requests to an unsupported endpoint. Auth header separation is correct. All CI checks pass and a Discord user confirmed the fix works with Microsoft Foundry deployments. The test coverage is targeted and validates the critical paths.
