<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 4303
title: "Add OCA provider"
author: supreethjavalli
category: provider
tier: 5
lines: 1507
files: 35
verdict: REQUEST_CHANGES
confidence: 4
reviewed_at: 2026-02-14
linked_issue: none
fork_pr: N/A (review-only)
-->

# Review: kilocode #4303

> **Add OCA provider** by @supreethjavalli

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | FAIL | Type error in `useSelectedModel.ts` (oca in both case and default satisfies); stale secret key in logout handler |
| Conventions | WARN | OCA-specific logic leaks into shared `ModelSelector.tsx`; inline `<style>` tags in React components |
| Changeset | FAIL | Missing changeset (confirmed by changeset-bot) |
| Tests | FAIL | Zero unit tests for OcaTokenManager, OcaHandler, getOCAModels, or OCAModelService |
| i18n | FAIL | All user-facing strings are hardcoded English (no `t()` calls) |
| Types | WARN | Heavy use of `as any` throughout (17+ instances); `banner` field added to ModelInfo with no docs |
| Security | PASS | PKCE flow, SecretStorage, DOMPurify for banner HTML |
| Scope | WARN | 35 files, 1484 additions with no tests |

## Findings

### RED: Type error in `useSelectedModel.ts` -- oca in both case and default

**File**: `webview-ui/src/components/ui/hooks/useSelectedModel.ts` (diff lines around 559-595)

The PR adds a `case "oca"` block AND adds `"oca"` to the default branch's `satisfies` union:

```typescript
case "oca": {
    const id = apiConfiguration.apiModelId ?? ""
    const info = id && routerModels?.oca ? routerModels.oca[id] : undefined
    return { id, info }
}
// ...
default: {
    provider satisfies "anthropic" | "fake-ai" | "human-relay" | "kilocode" | "oca"
```

If `"oca"` has an explicit `case`, it never reaches `default`. The `satisfies` union in default must NOT include `"oca"`. The existing pattern uses `satisfies` to ensure exhaustive handling of remaining providers; including a handled case there is a type-level mistake.

### RED: Stale secret key in logout handler

**File**: `src/core/webview/webviewMessageHandler.ts` (diff context near case `"oca/logout"`)

```typescript
case "oca/logout": {
    try {
        await OcaTokenManager.logout()
        try {
            await provider.context.secrets.delete("ocaTokenSet")  // wrong key
        } catch {}
```

`OcaTokenManager` uses `SECRET_STORAGE_KEY = "ocaTokenRecord"`, but the webview handler tries to delete `"ocaTokenSet"`. This is a leftover from a rename. The `OcaTokenManager.logout()` already deletes `"ocaTokenRecord"`, so this line is dead code targeting a nonexistent key. It won't cause a runtime crash (the try/catch swallows it), but it signals incomplete cleanup from a refactor.

### RED: Zero unit tests for 700+ lines of new provider code

No test files exist for:
- `OcaTokenManager.ts` (318 lines) -- token refresh, PKCE flow, port fallback, error formatting
- `oca-handler.ts` (208 lines) -- streaming, tool calls, error decoration
- `oca.ts` fetcher (127 lines) -- model parsing, price calculation, error handling
- `OCAModelService.ts` (65 lines) -- webview state persistence
- `Oca.tsx` (311 lines) -- auth state machine transitions

The existing codebase has dedicated test files for comparable providers under `src/api/providers/__tests__/` (e.g., `mistral.spec.ts`, `deepseek.spec.ts`, `anthropic.spec.ts`). A tier 5 provider PR handling OAuth tokens and API keys needs test coverage.

### RED: No changeset

Confirmed by changeset-bot. A new provider needs at minimum a `patch` bump across `kilo-code`, `@roo-code/vscode-webview`, `@kilocode/cli`, and `@roo-code/types`.

### RED: All user-facing strings hardcoded in English

**Files**: `Oca.tsx`, `OcaAcknowledgeModal.tsx`, `OcaTokenManager.ts`, `oca.ts` (fetcher)

Examples:
- `"Sign in to access Oracle internal models."` -- `Oca.tsx` line 247
- `"Login with Oracle SSO"` -- `Oca.tsx` line 248
- `"Acknowledgement Required"` -- `OcaAcknowledgeModal.tsx` line 44
- `"I acknowledge and agree"` -- `OcaAcknowledgeModal.tsx` line 63
- `"Please sign in with Oracle SSO at Settings > Providers > Oracle Code Assist."` -- `oca-handler.ts` line 35

Every other provider uses `useAppTranslation()` / `t()` for user-facing text. These all need i18n keys.

### YELLOW: OCA-specific logic bleeding into shared ModelSelector

**File**: `webview-ui/src/components/kilocode/chat/ModelSelector.tsx`

The PR adds 85+ lines of OCA-specific code into the shared `ModelSelector`:
- `useEffect` for OCA model auto-selection and persistence (diff lines 101-130)
- Banner acknowledgment modal and state (diff lines 35-41, 163-190)
- Provider-specific `onChange` guard (diff lines 140-157)

No other provider injects provider-specific behavior into this shared component. The OCA model persistence, banner acknowledgment, and auto-selection should be handled in the `Oca.tsx` settings component or a dedicated hook -- not by conditionally branching on `provider === "oca"` throughout the shared selector.

### YELLOW: Inline `<style>` tags in React components

**File**: `webview-ui/src/components/settings/providers/Oca.tsx`, line 237 (diff)

```tsx
<style>{`.oca-model-picker .text-vscode-descriptionForeground{display:none}...`}</style>
```

**File**: `webview-ui/src/components/kilocode/common/OcaAcknowledgeModal.tsx`, line 51 (diff)

```tsx
<style>{`.oca-ack-banner, .oca-ack-banner * { color: #000 !important; }`}</style>
```

The codebase uses Tailwind utility classes. Inline `<style>` tags create specificity issues and are inconsistent with the existing pattern.

### YELLOW: Hardcoded Oracle internal URLs

**File**: `src/api/providers/oca/utils/constants.ts`

```typescript
export const DEFAULT_INTERNAL_IDCS_CLIENT_ID = "a8331954c0cf48ba99b5dd223a14c6ea"
export const DEFAULT_INTERNAL_IDCS_URL = "https://idcs-9dc693e80d9b469480d7afe00e743931.identity.oraclecloud.com"
export const DEFAULT_OCA_BASE_URL =
    "https://code-internal.aiservice.us-chicago-1.oci.oraclecloud.com/20250206/app/litellm"
```

The URL contains `code-internal` and the IDCS URL has an instance-specific GUID. These appear to be internal/staging Oracle endpoints. For an open-source release, should these be configurable via extension settings rather than constants? The `OCA_API_BASE` env var override exists for the base URL, but the IDCS URL and client ID have no override mechanism.

### YELLOW: `banner` field added to shared ModelInfo schema

**File**: `packages/types/src/model.ts`, line 73 (diff)

```typescript
banner: z.string().optional(),
```

This adds a new field to the shared `ModelInfo` type that can contain arbitrary HTML. No documentation explains what this field is, what format it expects, or which providers use it. Any provider returning a `banner` field would trigger the acknowledgment modal, which is OCA-specific UX. This coupling should be documented or the banner/acknowledgment logic should be fully OCA-scoped.

### GRAY: Merge conflicts

PR is in `CONFLICTING` state. The author previously resolved conflicts (per comment thread with @kevinvandijk), but they've recurred from upstream changes since the last push.

### GRAY: Typo in error message

**File**: `src/api/providers/oca/OcaTokenManager.ts`, `formatOcaError` function

```
"...follow OCA troubleshooting gudlines and try again."
```

Should be "guidelines".

### GRAY: pnpm-lock.yaml previously pointed to Oracle internal NPM mirror

Per @oujesky's comment, the lock file was regenerated outside the corporate network. The current diff shows public registry references, so this appears resolved.

## CI Status

| Check | Result |
|-------|--------|
| build-cli | PASS |
| compile | PASS |
| check-translations | PASS |
| test-cli | PASS |
| test-extension (ubuntu) | FAIL |
| test-extension (windows) | FAIL |
| test-jetbrains | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| unit-test | SKIPPED |
| Build Markdoc Site | PASS |

Extension test failures on both platforms. The `unit-test` job was skipped, likely gated on extension tests.

## Code Snippets

### Token refresh with 180-second buffer (`OcaTokenManager.ts`):
```typescript
const RENEW_TOKEN_BUFFER_SEC = 180

private static isValid(t: TokenRecord) {
    const now = Math.floor(Date.now() / 1000)
    return !!t.expires_at && now < t.expires_at - RENEW_TOKEN_BUFFER_SEC
}
```

### OIDC discovery with exponential backoff (`OcaTokenManager.ts`):
```typescript
private static async discoveryWithRetry(discoveryUrl: URL, {
    retries = 3, baseDelayMs = 500, maxDelayMs = 2000,
} = {}): Promise<OidcDiscoveryConfig> {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await discovery(discoveryUrl, DEFAULT_INTERNAL_IDCS_CLIENT_ID)
        } catch (err) {
            const backoff = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt))
            const jitter = 0.5 + Math.random()
            await this.sleep(Math.round(backoff * jitter))
        }
    }
}
```

### Handler uses OpenAI SDK pattern consistently (`oca-handler.ts`):
```typescript
export class OcaHandler extends BaseProvider implements SingleCompletionHandler {
    // Follows same pattern as openai.ts, requesty.ts, etc.
    private async getClient(): Promise<OpenAI> {
        return this.getClientWithBase(this.baseURL)
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

**REQUEST_CHANGES** -- The OCA provider has solid security foundations (PKCE OAuth, SecretStorage for tokens, DOMPurify for server-returned HTML, exponential backoff on OIDC discovery). The handler correctly follows the existing OpenAI SDK pattern.

However, the PR is not ready for merge due to:

1. **Type error** in `useSelectedModel.ts` (oca appears in both a case branch and the default satisfies union)
2. **Stale secret key** (`"ocaTokenSet"` vs `"ocaTokenRecord"`) in the logout handler
3. **Zero unit tests** for 700+ lines of auth/handler/fetcher/service code
4. **Missing changeset**
5. **No i18n** for any user-facing strings
6. **CI failures** on extension tests (both platforms)
7. **Merge conflicts** that need resolution
8. **Shared component pollution** -- OCA-specific code should not live in `ModelSelector.tsx`

The security review is the one bright spot. The PKCE flow, SecretStorage usage, and DOMPurify sanitization are all correct and demonstrate understanding of the security requirements.
