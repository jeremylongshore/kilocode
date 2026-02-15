<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 4303
title: "Add OCA provider"
author: supreethjavalli
category: provider
tier: 5
lines: 1507
files: 35
review_number: 23
fork_pr: N/A (review-only)
-->

# Review Journal: kilocode #4303

> **PR**: [#4303](https://github.com/Kilo-Org/kilocode/pull/4303) |
> **Title**: Add OCA provider |
> **Author**: @supreethjavalli |
> **Category**: provider | **Tier**: 5 | **Size**: 1507 lines, 35 files

---

## Summary

New provider integration for Oracle Code Assist. Implements PKCE OAuth SSO login, token management via VS Code SecretStorage, model discovery from an OCA-specific `/v1/model/info` endpoint, and an acknowledgment modal for models with disclosure banners. The security implementation is well-considered, but the PR has critical gaps: no unit tests, no i18n, a type error in the model selector, CI failures, and OCA-specific logic leaking into shared components.

## First Impressions

"Add OCA provider" is the kind of PR title that means a lot of work. 35 files, 1484 additions. The PR description is clear about the auth flow and provides screenshots for both VSCode and IntelliJ. The comment history shows two previous rounds of feedback: @kevinvandijk asked for merge conflict resolution (done), and @oujesky caught the pnpm-lock.yaml pointing to Oracle's internal NPM mirror (fixed). The @kiloconnect bot gave a "Merge" recommendation at 95% confidence, which I disagree with -- the bot focused on security (correctly finding no issues there) but missed the type error, test gap, and i18n absence.

## What I Looked At

### Files in the diff (35 total):

**Extension backend (new files)**:
- `src/api/providers/oca-handler.ts` -- Main handler using OpenAI SDK (208 lines)
- `src/api/providers/oca/OcaTokenManager.ts` -- OAuth token management (318 lines)
- `src/api/providers/oca/utils/constants.ts` -- Hardcoded Oracle URLs and client ID
- `src/api/providers/oca/utils/getOcaClientInfo.ts` -- IDE metadata for headers
- `src/api/providers/fetchers/oca.ts` -- Model fetcher (127 lines)

**Extension backend (modified)**:
- `src/api/index.ts` -- Registers OcaHandler in buildApiHandler switch
- `src/api/providers/index.ts` -- Exports OcaHandler
- `src/api/providers/fetchers/modelCache.ts` -- Adds OCA to fetchModelsFromProvider
- `src/core/webview/webviewMessageHandler.ts` -- Adds oca/login, oca/logout, oca/status cases
- `src/shared/api.ts` -- Adds OCA to dynamic provider extras
- `src/shared/checkExistApiConfig.ts` -- Adds "oca" to no-config-needed list

**Types package (modified)**:
- `packages/types/src/model.ts` -- Adds `banner` field to ModelInfo schema
- `packages/types/src/provider-settings.ts` -- Adds "oca" to dynamicProviders, creates ocaSchema, wires discriminated union
- `packages/types/src/vscode-extension-host.ts` -- Adds OCA message types

**CLI package (modified)**:
- `cli/src/constants/providers/{labels,models,settings,validation}.ts` -- Registers OCA in all provider maps

**Webview (new files)**:
- `webview-ui/src/components/settings/providers/Oca.tsx` -- Settings page component (311 lines)
- `webview-ui/src/components/kilocode/common/OcaAcknowledgeModal.tsx` -- Banner disclosure modal
- `webview-ui/src/services/OCAModelService.ts` -- Webview state for model selection
- `webview-ui/src/services/ocaMessages.ts` -- Message type constants and type guards
- `webview-ui/src/services/ocaOutgoing.ts` -- Helpers to post messages to extension

**Webview (modified)**:
- `webview-ui/src/components/kilocode/chat/ModelSelector.tsx` -- 85+ lines of OCA-specific logic
- `webview-ui/src/components/settings/ApiOptions.tsx` -- Wires OCA provider component
- `webview-ui/src/components/ui/hooks/useSelectedModel.ts` -- Adds case "oca" (with type error)
- `webview-ui/src/components/kilocode/hooks/useProviderModels.ts` -- Adds OCA model resolution
- `webview-ui/src/utils/validate.ts` -- Skips model ID validation for OCA

**Existing patterns compared**:
- `src/api/providers/__tests__/mistral.spec.ts` -- Reference for how other providers are tested
- `src/api/providers/__tests__/deepseek.spec.ts` -- Another handler test reference
- `webview-ui/src/components/settings/providers/Roo.tsx` -- Existing provider with similar auth flow pattern

### Existing comments/reviews read:
- changeset-bot: No changeset found
- @kevinvandijk: Asked for merge conflict resolution
- @supreethjavalli: Confirmed conflicts resolved
- @oujesky: Caught internal Oracle NPM mirror in pnpm-lock.yaml
- @supreethjavalli: Regenerated lock file outside corporate network
- @kiloconnect: 95% confidence "Merge" recommendation

## Analysis

### Architecture

The OCA integration follows the standard provider pattern well at the handler level. The `OcaHandler` extends `BaseProvider`, implements `SingleCompletionHandler`, and delegates to the OpenAI SDK just like `openai.ts`, `requesty.ts`, and other OpenAI-compatible providers. The streaming implementation handles text, tool calls, reasoning content, and usage reporting correctly.

What sets OCA apart from other providers is the OAuth SSO flow. Most providers use API keys stored in settings. OCA uses:

1. OIDC discovery against an Oracle IDCS endpoint
2. PKCE auth code flow with a local HTTP callback server
3. Token persistence in VS Code SecretStorage
4. Automatic token refresh using refresh_token grant
5. Port fallback (tries 8669, 8668, 8667) for the local callback

This is architecturally sound and mirrors how enterprise SSO integrations typically work. The `OcaTokenManager` is a well-structured singleton with clear separation of concerns.

### The Type Error

The `useSelectedModel.ts` change adds both a `case "oca"` block and includes `"oca"` in the default's `satisfies` type union. In TypeScript, when a value has an explicit `case` in a switch, it will never reach `default`. The `satisfies` check in the default branch is used to verify exhaustive handling -- including `"oca"` there defeats the exhaustiveness check because TypeScript knows `"oca"` is already handled. This needs to be removed from the `satisfies` union.

### The Stale Key

The logout handler in `webviewMessageHandler.ts` calls both `OcaTokenManager.logout()` (which deletes `"ocaTokenRecord"`) and `provider.context.secrets.delete("ocaTokenSet")` (a different key). The `"ocaTokenSet"` key doesn't appear anywhere else in the codebase, suggesting it was an earlier name for the secret storage key that was renamed to `"ocaTokenRecord"` without updating this reference. Not a security issue (tokens are still properly cleaned up by `OcaTokenManager.logout()`), but it's confusing dead code.

### The Test Gap

This is the biggest concern. The PR adds:
- 318 lines of token management code with retry logic, PKCE cryptography, and HTTP server lifecycle
- 208 lines of streaming handler code with tool call state management
- 127 lines of model fetcher code with price parsing and error classification
- 311 lines of React component code with an auth state machine

None of this has tests. The existing codebase has test files for comparable functionality (see `src/api/providers/__tests__/`). At minimum:
- `OcaTokenManager`: `isValid()`, `tryRefresh()`, `formatOcaError()` are all testable pure functions
- `getOCAModels()`: Model parsing, price calculation, error classification are testable with HTTP mocking
- `OcaHandler.getModel()`: Cache lookup and fallback logic is testable

### The ModelSelector Pollution

The `ModelSelector.tsx` changes concern me most from a maintenance perspective. This is a shared component used by all providers. The PR adds:
- A `useEffect` that runs only for `provider === "oca"` to auto-select models
- An acknowledgment modal triggered only for OCA models with banners
- Model persistence calls to `OCAModelService` in `onChange`

This creates a precedent where every provider could add its own conditional logic to the shared selector. The banner acknowledgment feature, if it's intended to be generic (via the `banner` field on ModelInfo), should be implemented generically. If it's OCA-specific, it should live in the OCA settings component.

### Security Assessment

The security implementation is the strongest part of this PR:
- PKCE with S256 challenge method prevents auth code interception
- VS Code SecretStorage provides OS-level encryption for tokens
- DOMPurify sanitizes server-returned HTML before rendering with `dangerouslySetInnerHTML`
- 180-second token renewal buffer prevents expired token usage in flight
- Exponential backoff with jitter on OIDC discovery prevents thundering herd
- Error messages include `opc-request-id` for Oracle support debugging

### Hardcoded Internal URLs

The constants file contains what appear to be Oracle-internal endpoints:
- IDCS URL with instance-specific GUID
- Base URL with `code-internal` in the hostname
- A specific client ID

For an open-source extension, these should either be configurable through extension settings or clearly documented as Oracle's public endpoints. The `OCA_API_BASE` env var provides an escape hatch for the base URL but not for the IDCS URL or client ID.

## Verification

### Upstream CI
- 7/12 checks pass
- `test-extension` fails on both ubuntu and windows (extension unit test step)
- `unit-test` job was skipped
- The failures are in the "Run extension unit tests" step, suggesting the OCA changes break existing extension tests

### Local Testing
Not performed. The PR has merge conflicts and CI failures that would need resolution first. The OAuth flow requires an Oracle SSO account, so functional testing of the auth path would require Oracle credentials.

## Bot Review Synthesis

| Bot | Verdict | Key Finding | Useful? |
|-----|---------|-------------|---------|
| changeset-bot | WARN | No changeset | Yes |
| kiloconnect | APPROVE (95%) | "No issues found" | Partially -- good security review, missed type error and test gap |

The kiloconnect bot's security analysis was accurate (PKCE, SecretStorage, DOMPurify all correctly identified). However, its 95% merge confidence is too high given the CI failures, type error, and complete absence of tests.

## Lessons Learned

1. **Bot security reviews are valuable but insufficient** -- @kiloconnect correctly identified all the security patterns but missed structural issues (type errors, missing tests, convention violations). Security bots should be complemented with pattern compliance checks for tier 5 PRs.

2. **Provider PRs need a checklist gate** -- A tier 5 provider PR adding 1500+ lines should have a mandatory checklist: tests, changeset, i18n, no provider-specific logic in shared components. This could be automated as a PR template or CI check.

3. **OAuth providers are architecturally different** -- Most providers are stateless (API key in, response out). OAuth providers like OCA introduce state (token lifecycle, login sessions) that creates new failure modes and testing requirements. The review bar should be higher for stateful providers.

4. **`satisfies` in switch defaults catches exactly this kind of bug** -- The TypeScript `satisfies` pattern in the default branch is a powerful exhaustiveness check. When a reviewer sees a provider added to both a case branch and the satisfies union, it's an immediate red flag that the author didn't fully understand the pattern.

---

<sub>Review #23 | Tier 5 provider PR, no fork mirror (review-only) | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
