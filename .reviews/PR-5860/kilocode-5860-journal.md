<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5860
title: "Fix Azure/OpenAI endpoints and reject Azure AI Inference URLs"
author: Neonsy
category: feature
tier: 5
lines: 327
files: 5
review_number: 62
-->

# Review Journal: kilocode #5860

> **PR**: [#5860](https://github.com/Kilo-Org/kilocode/pull/5860) |
> **Title**: Fix Azure/OpenAI endpoints and reject Azure AI Inference URLs |
> **Author**: @Neonsy |
> **Category**: feature | **Tier**: 5 | **Size**: 327 lines, 5 files

---

## Summary

Fixes Azure URL normalization in the OpenAI Responses provider and rejects unsupported Azure AI Inference endpoints. Handles the many URL format variations users provide for Azure deployments. Community user confirmed fix works with Microsoft Foundry. Approve.

## First Impressions

Azure endpoint handling is notoriously complex due to the multiple URL formats (deployment paths, cognitive services, v1 paths, etc.). The PR description clearly explains the endpoint classification and normalization approach. The test coverage at 153 lines covers the critical URL transformations.

## What I Looked At

- `src/api/providers/openai-responses.ts` -- core handler changes (108 additions, 29 deletions)
- `src/api/providers/__tests__/openai-responses.spec.ts` -- new tests (153 lines)
- `webview-ui/src/utils/validate.ts` -- validation addition for openai-responses
- `webview-ui/src/utils/__tests__/validate.spec.ts` -- validation tests
- Cross-referenced the existing constructor on main (Azure AI Inference branch, Azure OpenAI branch, standard branch)
- Verified `OPENAI_AZURE_AI_INFERENCE_PATH` usage before/after

## Analysis

The PR makes three categories of changes:

**1. Endpoint classification and rejection**

Two boolean flags are set in the constructor:
- `isAzureAiInferenceEndpoint`: `*.services.ai.azure.com` -- rejected at runtime
- `isAzureOpenAiEndpoint`: any `*.azure.com` host or explicit `openAiUseAzure` flag

The Azure AI Inference path was previously handled by creating a client with a specific path override. The PR removes this in favor of an immediate rejection since the Responses API is not supported on these endpoints. This is the correct approach -- failing fast with a clear message is better than partially working.

**2. URL normalization**

The `normalizeResponsesBaseUrl` method is the most complex addition. It handles:
- Stripping endpoint suffixes (`/chat/completions`, `/completions`, `/responses`)
- Converting deployment paths (`/openai/deployments/<name>`) to `/openai/v1`
- Ensuring Azure endpoints always have `/openai/v1`
- Ensuring non-Azure endpoints always have `/v1`
- Stripping query parameters (especially `api-version` which should only be added when needed)

The `shouldAppendAzureApiVersion` check correctly exempts `/openai/v1` paths.

**3. Auth header separation**

The fallback fetch path now correctly uses `api-key` header for Azure and `Authorization: Bearer` for non-Azure. Previously, all fallback requests used Bearer auth, which would fail for Azure deployments.

## Verification

- All CI checks pass
- Discord user @Anthonix24812 confirmed fix works with Microsoft Foundry deployment of gpt-5.2-codex
- Tests cover: URL normalization, Azure auth headers, AI Inference rejection, deployment URL rewriting, cognitive services endpoints, webview validation

## Lessons Learned

- Azure endpoint URLs come in many flavors -- deployment paths, v1 paths, cognitive services, AI Inference -- and each requires different handling
- Failing fast for unsupported endpoint types is better than attempting partial compatibility
- Auth header separation (api-key vs Bearer) is a common source of Azure integration issues
- The Responses API being unavailable on Azure AI Inference is a platform limitation that should be documented clearly

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
