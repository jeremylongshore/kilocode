<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5799
title: "Add Ask Sage as a new AI provider"
author: jdbohrman
category: provider
tier: 5
lines: 736
files: 20
verdict: COMMENT
confidence: 3
reviewed_at: 2026-02-15
-->

# Review: kilocode #5799

> **Add Ask Sage as a new AI provider** by @jdbohrman

[Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Handler follows established OpenAI-compatible patterns |
| Conventions | WARN | Replaces `corethink` entries instead of adding alongside; missing changeset |
| Changeset | FAIL | No changeset included (changeset-bot flagged) |
| Tests | PASS | 413 lines of tests covering init, streaming, tool calls, errors, prompt completion |
| i18n | PASS | No user-facing strings requiring translation |
| Types | PASS | Provider settings, schemas, and discriminated unions all wired up |
| Security | PASS | API key handled via existing patterns, no hardcoded secrets |
| Scope | WARN | Removes `corethink` provider entries rather than adding `asksage` alongside |

## Findings

### 1. Missing changeset (severity: red)

The changeset-bot flagged this PR. A changeset is required for provider additions since it touches `kilo-code`, `@roo-code/types`, `@kilocode/core-schemas`, and `@kilocode/cli`. The PR cannot be released without one.

### 2. Replaces corethink instead of adding alongside (severity: yellow)

In `cli/src/constants/providers/labels.ts`, `models.ts`, `settings.ts`, and `validation.ts`, the diff shows `corethink` entries being replaced by `asksage` entries rather than `asksage` being added as a new entry. This means merging this PR would remove corethink support:

```typescript
// labels.ts
-  corethink: "Corethink"
+  asksage: "Ask Sage",
```

If corethink was already merged upstream, this would be a breaking removal. If corethink hasn't landed yet, this is a rebase artifact that should be resolved.

### 3. Removes ZenMux default model ID mapping (severity: yellow)

In `packages/types/src/providers/index.ts`, the diff replaces the `zenmux` case with `asksage`:

```typescript
-  case "zenmux": // kilocode_change
-    return zenmuxDefaultModelId // kilocode_change
+  case "asksage":
+    return askSageDefaultModelId
```

ZenMux is a Kilo-specific provider that should retain its `getProviderDefaultModelId` mapping. This removal would break ZenMux model resolution.

### 4. Model fetcher uses axios while most fetchers use native fetch (severity: gray)

`src/api/providers/fetchers/asksage.ts` uses `axios` for the HTTP call while most other fetchers (openrouter, zenmux, requesty) use native `fetch`. This introduces an unnecessary dependency divergence. Not blocking, but worth noting for consistency.

### 5. Default model is gpt-4o-mini but CLI default is gpt-4o (severity: gray)

The types definition in `packages/types/src/providers/asksage.ts` sets `askSageDefaultModelId = "gpt-4o-mini"`, but `cli/src/constants/providers/settings.ts` sets the default to `"gpt-4o"`. These should be consistent.

### 6. convertToolsForOpenAI method not defined (severity: yellow)

The handler calls `this.convertToolsForOpenAI(metadata.tools)` at line ~810 of the handler, but no such method is defined in `AskSageHandler` or visible in `BaseProvider`. If `BaseProvider` does not provide this method, the code would throw a runtime error when native tools are used.

### 7. No CI checks reported (severity: gray)

No CI checks have run on this branch. This is likely because the branch originates from a fork without CI configured. The code should be validated against CI before merge.

## CI Status

| Check | Result |
|-------|--------|
| All checks | No checks reported on branch |

## Code Snippets

Handler constructor follows the standard pattern:

```typescript
// src/api/providers/asksage.ts
constructor(options: ApiHandlerOptions) {
    super()
    this.options = options
    this.baseURL = this.options.askSageBaseUrl || ASKSAGE_DEFAULT_BASE_URL
    const apiKey = this.options.askSageApiKey ?? "not-provided"
    this.client = new OpenAI({
        baseURL: this.baseURL,
        apiKey: apiKey,
        defaultHeaders: DEFAULT_HEADERS,
    })
}
```

Model fetching and schema registration are complete across all workspaces (types, core-schemas, CLI, webview).

## Verdict

**COMMENT** -- The provider implementation itself is solid and follows established patterns with good test coverage. However, three issues prevent a clean approval: (1) missing changeset, (2) the diff replaces `corethink` entries instead of adding alongside, suggesting a rebase problem, and (3) the ZenMux default model ID mapping is removed, which would break that Kilo-specific provider. The `convertToolsForOpenAI` method reference should also be verified. Once these are addressed, this is a straightforward approval.
