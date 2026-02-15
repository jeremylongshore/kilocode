<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5860
title: "Fix Azure/OpenAI endpoints and reject Azure AI Inference URLs"
author: Neonsy
category: feature
tier: 5
lines: 327
files: 5
review_number: 43
fork_pr: none
-->

# Review Journal: kilocode #5860

> **PR**: [#5860](https://github.com/Kilo-Org/kilocode/pull/5860) |
> **Title**: Fix Azure/OpenAI endpoints and reject Azure AI Inference URLs |
> **Author**: @Neonsy |
> **Category**: feature | **Tier**: 5 | **Size**: 327 lines, 5 files

---

## Summary

The OpenAI Responses provider was sending malformed requests when users supplied Azure-style URLs, especially deployment/chat-completions paths. This PR classifies Azure endpoints upfront, rejects unsupported Azure AI Inference endpoints (`.services.ai.azure.com`) with a clear error, normalizes fallback URLs for the Responses API, and fixes auth headers (using `api-key` for Azure instead of `Bearer`). The fix is confirmed working by a community member on a real Azure Foundry deployment. The URL normalization logic is aggressive and could break custom proxy endpoints, but the primary Azure use case is solid.

## First Impressions

"Fix Azure/OpenAI endpoints and reject Azure AI Inference URLs" -- the title signals this is an endpoint routing fix for the Responses provider. The PR body is well-structured with clear context, implementation details, and testing instructions. The note about Discord user confirmation is a strong signal. At 327 lines across 5 files, this is a moderate-sized change with good test coverage (153 lines of new tests).

## What I Looked At

- `src/api/providers/openai-responses.ts` -- The main provider file (108 additions, 29 deletions)
- `src/api/providers/__tests__/openai-responses.spec.ts` -- 7 new test cases (153 lines)
- `webview-ui/src/utils/validate.ts` -- New validation case for `openai-responses`
- `webview-ui/src/utils/__tests__/validate.spec.ts` -- 2 new validation tests
- `.changeset/azure-responses-v1-endpoints.md` -- Patch changeset
- `src/api/providers/openai.ts` -- Comparison: how the Chat Completions provider handles Azure AI Inference (still supports it)
- `packages/types/src/providers/openai.ts` -- `OPENAI_AZURE_AI_INFERENCE_PATH` constant definition
- Upstream CI (11/11 green)
- PR comments: Discord user @Anthonix24812 confirms fix works on gpt-5.2-codex with Microsoft Foundry

## Analysis

### The Problem

Users configuring the `openai-responses` provider with Azure endpoints hit multiple issues:

1. **Azure AI Inference endpoints** (`.services.ai.azure.com`) -- The Responses API is not available here. Previously, the provider tried to use these endpoints with a custom path override, which failed silently or with cryptic errors.

2. **Azure OpenAI deployment URLs** -- Users pasting `/openai/deployments/<name>/chat/completions?api-version=...` as the base URL got mangled paths in the fallback. The old code just appended `/v1/responses` to whatever was there.

3. **Auth headers** -- The fallback path always used `Authorization: Bearer`, which does not work for Azure OpenAI (which expects the `api-key` header).

### The Fix

The PR restructures the provider in four ways:

**1. Early endpoint classification** -- Two boolean instance fields (`isAzureAiInferenceEndpoint`, `isAzureOpenAiEndpoint`) are computed once in the constructor. This replaces repeated `_isAzureAiInference()` calls scattered through the code.

**2. Hard rejection of AI Inference** -- `assertSupportedResponsesEndpoint()` throws immediately if the endpoint is Azure AI Inference. Called in `createMessage()`, `makeResponsesApiRequest()`, and `completePrompt()` -- all three entry points.

**3. URL normalization for fallback** -- `normalizeResponsesBaseUrl()` strips query params, removes known suffixes (`/chat/completions`, `/completions`, `/responses`), and rewrites Azure paths to `/openai/v1`. This ensures the fallback fetch always targets `<base>/responses`.

**4. Auth-aware fallback** -- `getResponsesFallbackTarget()` returns both the URL and the correct headers. Azure gets `api-key`, non-Azure gets `Bearer`. Azure endpoints that are not on the `/openai/v1` path also get the `api-version` query parameter.

### Concern: Aggressive `/v1` appending

The normalization always ensures paths end with `/v1`. For standard OpenAI and Azure endpoints this is correct, but for custom proxies or non-standard OpenAI-compatible services, this could break routing. The catch-all `!pathname.endsWith("/v1")` branch will append `/v1` to any unrecognized path.

Example: `https://my-proxy.com/api/custom` becomes `https://my-proxy.com/api/custom/v1/responses` -- probably wrong if the proxy expects `/api/custom/responses`.

### Concern: Silent fallback to default URL

If `new URL(baseUrl)` throws (malformed URL), the catch block returns `https://api.openai.com/v1` or `https://api.openai.azure.com/openai/v1`. This means a typo in the base URL could send the request (and API key) to OpenAI's actual servers instead of failing loudly. An explicit error would be safer.

### What's Good

- The Azure AI Inference rejection is well-designed: clear error message, all code paths covered, actionable guidance.
- Tests are thorough: URL normalization, Azure auth, Azure AI Inference rejection, cognitiveservices variant, deployment URL rewriting, webview validation.
- Dead code cleanup: two unused imports removed.
- Consistent use of `// kilocode_change` markers.

## Verification

### Upstream CI
All 11 checks pass -- compile, test-extension (ubuntu + windows), test-webview (ubuntu + windows), test-cli, test-jetbrains, build-cli, check-translations, unit-test, Build Markdoc Site.

### Community Confirmation
@Anthonix24812 confirmed the fix works with a Microsoft Foundry deployment of gpt-5.2-codex (Model version 2026-01-14).

### What We Could Not Verify
- No local test run (tier 5, desk review only)
- Cannot test against actual Azure endpoints (requires Azure subscription and deployed model)
- Edge cases with custom proxy URLs not tested in the PR

## Diagrams

```
Azure Endpoint Classification and Request Flow (After PR)
=========================================================

User Base URL Input
       |
       v
  _isAzureAiInference(url)?
       |
       +-- YES (*.services.ai.azure.com)
       |      |
       |      v
       |   assertSupportedResponsesEndpoint()
       |      |
       |      v
       |   THROW: "Azure AI Inference endpoints not supported"
       |   → Suggest: https://<resource>.openai.azure.com/openai/v1
       |
       +-- NO
              |
              v
         isAzureOpenAiEndpoint?
              |
              +-- YES (*.azure.com or openAiUseAzure)
              |      |
              |      v
              |   AzureOpenAI SDK client
              |      |
              |      v
              |   SDK responses.create() ──[fail]──> fallback
              |                                         |
              |                                         v
              |                                  normalizeResponsesBaseUrl()
              |                                  → Strip /deployments/.../chat/completions
              |                                  → Rewrite to /openai/v1
              |                                         |
              |                                         v
              |                                  getResponsesFallbackTarget()
              |                                  → headers: { "api-key": key }
              |                                  → url: .../openai/v1/responses
              |                                  → (no api-version for /openai/v1 paths)
              |
              +-- NO (standard OpenAI / compatible)
                     |
                     v
                  OpenAI SDK client
                     |
                     v
                  SDK responses.create() ──[fail]──> fallback
                                                        |
                                                        v
                                                 normalizeResponsesBaseUrl()
                                                 → Ensure path ends with /v1
                                                        |
                                                        v
                                                 getResponsesFallbackTarget()
                                                 → headers: { "Authorization": "Bearer ..." }
                                                 → url: .../v1/responses
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

1. **Fail fast for unsupported configurations** -- Instead of trying to make Azure AI Inference work with path hacks, rejecting it upfront with a clear error is the better UX. Users get instant, actionable feedback instead of cryptic 404s.

2. **URL normalization is a minefield** -- Every normalization rule that rewrites paths risks breaking an edge case. The cascade of `if/else if` branches for Azure paths shows how many variants exist. A more conservative approach (rewrite only known patterns, preserve unknowns) would be safer.

3. **Auth varies by Azure endpoint type** -- Azure OpenAI uses `api-key` header, Azure AI Inference uses query params, standard OpenAI uses `Bearer`. Getting this wrong means 401s that are hard to debug. Centralizing auth logic (as `getResponsesFallbackTarget` does) is the right pattern.

4. **Community confirmation is invaluable** -- The Discord user testing on a real Foundry deployment provides confidence that the desk-reviewed PR actually works in production Azure environments. This is stronger signal than any local mock test.

5. **Provider divergence needs documentation** -- The `openai` provider still supports Azure AI Inference; `openai-responses` now rejects it. When two providers in the same family have different endpoint support, the error messages should cross-reference each other so users know their options.

---

<sub>Review #43 | Desk review (tier 5) | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
