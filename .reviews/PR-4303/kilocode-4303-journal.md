<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 4303
title: "Add OCA provider"
author: supreethjavalli
category: provider
tier: 5
lines: 1507
files: 35
review_number: 37
-->

# Review Journal: kilocode #4303

> **PR**: [#4303](https://github.com/Kilo-Org/kilocode/pull/4303) |
> **Title**: Add OCA provider |
> **Author**: @supreethjavalli |
> **Category**: provider | **Tier**: 5 | **Size**: 1507 lines, 35 files

---

## Summary

Well-implemented Oracle Code Assist provider with PKCE OAuth flow and VS Code SecretStorage. Good security practices (DOMPurify, exponential backoff with jitter for discovery). Main gaps are missing tests and changeset. COMMENT.

## First Impressions

Corporate provider contribution from Oracle. The OAuth/PKCE approach is more sophisticated than most provider additions which just need an API key. The model discovery endpoint is non-standard (uses `/v1/model/info` instead of `/v1/models`), suggesting Oracle's own API surface.

## What I Looked At

- `src/api/providers/oca-handler.ts` (208 lines) -- extends BaseProvider, uses OpenAI SDK
- `src/api/providers/oca/OcaTokenManager.ts` (318 lines) -- PKCE flow, SecretStorage, refresh logic
- `src/api/providers/fetchers/oca.ts` (127 lines) -- model discovery with custom OCA endpoint
- `webview-ui/src/components/settings/providers/Oca.tsx` (311 lines) -- settings UI with login/logout
- `webview-ui/src/components/kilocode/common/OcaAcknowledgeModal.tsx` -- disclosure modal with DOMPurify
- `src/core/webview/webviewMessageHandler.ts` -- 66 lines of new OCA message handlers
- pnpm-lock.yaml changes for openid-client dependency

## Analysis

### Security is the strongest aspect

- PKCE code challenge (S256) for OAuth
- VS Code SecretStorage for token persistence
- DOMPurify.sanitize before dangerouslySetInnerHTML
- Token refresh with 180-second buffer before expiry
- Exponential backoff with jitter for OIDC discovery
- Port fallback (8669, 8668, 8667) for local callback server

### Testing gap is the main weakness

OcaTokenManager is 318 lines of authentication logic with zero tests. Token refresh, PKCE flow, discovery retry logic, port fallback -- all untested. The fetcher also has no tests for its error handling paths.

### Clean provider pattern adherence

The oca-handler follows the OpenAI SDK pattern used by other providers. The message handling in webviewMessageHandler adds proper OCA-specific message types through the established extension message system.

## Verification

- CI: Extension tests fail on ubuntu and windows
- Merge status: UNKNOWN
- Maintainer Kevin asked for conflict resolution (done); no formal review yet
- kiloconnect bot: "Merge" recommendation with 95% confidence
- Community reviewer @oujesky caught the internal NPM mirror issue (fixed)

## Lessons Learned

- Corporate OAuth providers (PKCE flow) are significantly more complex than API key providers -- the token manager alone is 318 lines
- DOMPurify for `dangerouslySetInnerHTML` is the correct pattern -- OCA's acknowledgment banners contain HTML from the server
- The model discovery endpoint pattern varies significantly between providers (OCA uses `/v1/model/info` with litellm_params structure)

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
