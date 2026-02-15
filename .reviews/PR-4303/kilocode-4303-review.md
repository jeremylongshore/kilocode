<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 4303
title: "Add OCA provider"
author: supreethjavalli
category: provider
tier: 5
lines: 1507
files: 35
verdict: COMMENT
confidence: 82
reviewed_at: 2026-02-15
-->

# Review: kilocode #4303

> **Add OCA provider** by @supreethjavalli

**Methodology**: [Kilo Code PR Review Process](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Summary

Adds Oracle Code Assist (OCA) as a new provider with OAuth/PKCE SSO authentication, model discovery, an acknowledgment modal for model disclosures, and integration across VS Code and JetBrains. Well-structured implementation that follows existing provider patterns. The OAuth flow using PKCE and VS Code SecretStorage is properly implemented.

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | Pass | Handler, token manager, model fetcher all follow established patterns |
| Conventions | Pass | Extends BaseProvider, uses OpenAI SDK consistently |
| Changeset | Red | Missing changeset |
| Tests | Yellow | No unit tests for OcaTokenManager, oca-handler, or fetcher |
| i18n | Yellow | No i18n strings added for the OCA provider UI |
| Types | Pass | Zod schema, provider settings, message types all properly extended |
| Security | Pass | PKCE OAuth flow, SecretStorage for tokens, DOMPurify for HTML |
| Scope | Pass | Well-contained to provider-specific files |
| kilocode_change markers | Yellow | Missing from several modified files in shared code |

## Findings

### Red -- Missing changeset

No changeset included. This is a `minor` feature (new provider) requiring a changeset for release notes.

### Red -- No unit tests

The PR adds 1,484 lines including `OcaTokenManager` (318 lines), `oca-handler.ts` (208 lines), and `fetchers/oca.ts` (127 lines) with zero test files. The existing test files only have trivial additions to provider lookup tables (`getModelsByProvider.spec.ts` adds `+1` for the new provider entry). The kiloconnect bot review notes "No Issues Found" but does not verify test coverage.

### Yellow -- Missing kilocode_change markers

Several files in shared code paths lack the required markers:

- `src/api/providers/fetchers/modelCache.ts` -- new import and case added without markers
- `src/api/providers/index.ts` -- new export without marker
- `src/api/index.ts` -- new import and case without marker
- `packages/types/src/provider-settings.ts` -- `"oca"` added to dynamicProviders without marker

### Yellow -- Missing i18n for provider UI

The `Oca.tsx` settings component (311 lines) and `OcaAcknowledgeModal.tsx` (73 lines) contain hardcoded English strings for the provider UI (e.g., "Login with Oracle SSO", "Sign Out", button labels). No i18n keys were created for the provider-specific settings UI, unlike other providers which use translation keys.

### Yellow -- Internal Oracle NPM mirror in pnpm-lock.yaml

A reviewer (@oujesky) caught that the pnpm-lock.yaml initially referenced Oracle's internal NPM mirror. The author claims to have fixed this, but the diff shows `openid-client@6.8.1` and `oauth4webapi@3.8.3` additions which appear clean. Should be verified that no internal registry references remain.

### Yellow -- `banner` field added to ModelInfo

A new `banner` field was added to the `modelInfoSchema` in `packages/types/src/model.ts`:
```typescript
banner: z.string().optional(),
```

This is a schema change that affects all providers, not just OCA. It should be documented or at minimum noted that it enables model-specific disclosure banners.

### Gray -- Hardcoded internal IDCS constants

`src/api/providers/oca/utils/constants.ts` contains hardcoded Oracle IDCS URLs, client IDs, and scopes. While appropriate for an Oracle-specific provider, these are not configurable. This is consistent with how other corporate providers handle their endpoints.

### Gray -- Error messages reference "OCA Kilo troubleshooting guide"

The error handling in `fetchers/oca.ts` references a "Refer OCA Kilo troubleshooting guide" that doesn't appear to exist yet. The WPAD/PAC proxy limitation message is very specific and helpful for Oracle corporate network users.

## CI Status

| Check | Result |
|-------|--------|
| check-translations | Pass |
| compile | Pass |
| test-extension (ubuntu) | Fail |
| test-extension (windows) | Fail |
| test-webview (ubuntu) | Pass |
| test-webview (windows) | Pass |
| test-cli | Pass |
| build-cli | Pass |
| test-jetbrains | Pass |

Extension tests fail on both platforms.

## Code Snippets

### OAuth PKCE flow (OcaTokenManager.ts)
```typescript
if (DEFAULT_INTERNAL_USE_PKCE) {
    code_verifier = randomPKCECodeVerifier()
    code_challenge = await calculatePKCECodeChallenge(code_verifier)
}
```

### Token refresh with buffer (OcaTokenManager.ts)
```typescript
private static isValid(t: TokenRecord) {
    const now = Math.floor(Date.now() / 1000)
    return !!t.expires_at && now < t.expires_at - RENEW_TOKEN_BUFFER_SEC // 180s buffer
}
```

### DOMPurify for acknowledgment HTML (OcaAcknowledgeModal.tsx)
```typescript
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(acknowledgeMessage) }} />
```

## Verdict

**COMMENT** -- The OAuth/PKCE implementation is solid and the provider follows established patterns well. The kiloconnect bot review confirms security analysis passes. However, the complete absence of unit tests for three substantial new files (OcaTokenManager, oca-handler, oca fetcher) is concerning for a provider handling authentication flows. Missing changeset and kilocode_change markers need attention. Extension test failures on both platforms need investigation. The code quality is good enough to merit eventual approval with these additions.
