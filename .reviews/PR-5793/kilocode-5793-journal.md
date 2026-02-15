<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5793
title: "feat: Add AWS Bedrock Inference Profile ARN resolution support"
author: marcelloceschia
category: feature
tier: 6
lines: 1780
files: 13
review_number: 72
-->

# Review Journal: kilocode #5793

> **PR**: [#5793](https://github.com/Kilo-Org/kilocode/pull/5793) |
> **Title**: feat: Add AWS Bedrock Inference Profile ARN resolution support |
> **Author**: @marcelloceschia |
> **Category**: feature | **Tier**: 6 | **Size**: 1780 lines, 13 files

---

## Summary

Adds inference profile ARN resolution for AWS Bedrock, enabling capability detection (prompt caching, extended context, reasoning) for application-inference-profile and inference-profile ARNs. Good architecture with resolver class, caching, and UI feedback. CI is failing and maintainer has requested changes. Async race condition needs attention.

## First Impressions

The problem is clearly articulated: inference profile ARNs were treated as unknown models, disabling features like prompt caching. The solution of resolving the ARN to get the underlying model is the correct approach. The author has engaged constructively with maintainer feedback.

## What I Looked At

- `src/api/providers/bedrock-inference-profile-resolver.ts` -- New resolver class (179 lines)
- `src/api/providers/bedrock.ts` -- Integration into Bedrock handler (+89 lines)
- `src/api/providers/__tests__/bedrock-application-inference-profile.spec.ts` -- Test (226 lines)
- `src/api/providers/__tests__/bedrock-inference-profile-resolver.spec.ts` -- Test (209 lines)
- `webview-ui/src/components/settings/providers/BedrockCustomArn.tsx` -- UI feedback (137 lines)
- `src/core/webview/webviewMessageHandler.ts` -- Message handler for resolution requests
- `pnpm-lock.yaml` -- Dependency additions (818 lines added)

## Analysis

**Resolver architecture**: Clean separation of concerns. `BedrockInferenceProfileResolver` handles AWS API calls and caching. The Bedrock handler uses dynamic import (`await import()`) for lazy loading. ARN detection uses string includes checks for `:application-inference-profile/` and `:inference-profile/`.

**Race condition**: The resolver is fire-and-forget from the constructor. The handler stores `resolvedModelIdFromProfile` which is null until resolution completes. Multiple code paths check this value. If the user's first message arrives before resolution, they get degraded capabilities silently.

**Credential handling**: The resolver mirrors the existing pattern from `bedrock.ts` for credential configuration (API key, profile-based, direct credentials). This is consistent but means credential logic is duplicated in two places.

## Verification

- CI: test-extension failing on both platforms (maintainer aware)
- Upstream review: CHANGES_REQUESTED by @kevinvandijk (test failures)
- Author responsive to feedback

## Lessons Learned

1. Async initialization patterns (fire-and-forget from constructor) create subtle race conditions that are hard to test.
2. Adding new AWS SDK clients (`@aws-sdk/client-bedrock` alongside existing `@aws-sdk/client-bedrock-runtime`) has a non-trivial dependency footprint even when only one API call is needed.
3. ARN parsing and model capability mapping are tightly coupled -- changes to model definitions upstream can break inference profile resolution.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
