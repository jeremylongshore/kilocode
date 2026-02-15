<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5799
title: "Add Ask Sage as a new AI provider"
author: jdbohrman
category: feature
tier: 3
lines: 736
files: 20
verdict: REQUEST_CHANGES
confidence: 4
reviewed_at: 2026-02-14
linked_issue: none
fork_pr: pending
-->

# Review: kilocode #5799

> **Add Ask Sage as a new AI provider** by @jdbohrman
> New provider integration: AskSage (FedRAMP-authorized government AI platform)

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | FAIL | Replaces existing providers instead of adding alongside them |
| Conventions | WARN | Missing `// kilocode_change` markers, no settings UI component |
| Changeset | FAIL | No changeset included |
| Tests | PASS | 413 lines of handler tests covering streaming, tool calls, errors |
| i18n | FAIL | No i18n strings for provider label, API key placeholder, etc. |
| Types | PASS | Proper Zod schemas in core-schemas and types packages |
| Security | PASS | API key handled via standard pattern |
| Scope | FAIL | Replaces corethink + zenmux entries instead of adding new entries |

## Findings

### RED: PR replaces existing providers instead of adding alongside them

The most critical issue: this PR *replaces* existing provider entries rather than *adding* new ones. In multiple files the `corethink` entry is removed and replaced with `asksage`, and in other files `zenmux` entries are replaced:

**CLI files replacing corethink:**
- `cli/src/constants/providers/labels.ts:56` -- removes `corethink: "Corethink"`, adds `asksage: "Ask Sage"`
- `cli/src/constants/providers/models.ts:168,223` -- removes `corethink: null`, adds `asksage: null`
- `cli/src/constants/providers/settings.ts:1112` -- removes `corethink: "corethink"`, adds `asksage: "gpt-4o"`
- `cli/src/constants/providers/validation.ts:55` -- removes `corethink: [...]`, adds `asksage: [...]`

**Core files replacing zenmux:**
- `packages/types/src/providers/index.ts:97-99` -- replaces `zenmux` case with `asksage` in `getProviderDefaultModelId()`
- `webview-ui/src/components/ui/hooks/useSelectedModel.ts:582-586` -- replaces `zenmux` case with `asksage`
- `webview-ui/src/components/kilocode/hooks/__tests__/getModelsByProvider.spec.ts:45` -- replaces `zenmux` test entry
- `src/api/providers/fetchers/modelCache.ts:89-93` -- replaces `zenmux` case with `asksage` in `fetchModelsFromProvider()`

These are Record and switch/case entries that need **all** providers present. Removing `corethink` and `zenmux` would break those providers for existing users. The PR should add `asksage` entries *alongside* the existing ones.

This is also the root cause of the merge conflicts -- `main` still has `corethink` and `zenmux` references, and the PR's branch removes them.

### RED: Missing provider settings UI component

The PR adds no `AskSage.tsx` component in `webview-ui/src/components/settings/providers/`. Without this, users have no way to:
- Enter their AskSage API key
- Configure a custom base URL
- See the AskSage option in the provider settings panel

Compare with `ZenMux.tsx` (124 lines) which provides API key input, custom base URL toggle, and model picker. Every other provider with API key + base URL fields has a corresponding settings component. Neither `ApiOptions.tsx` nor `constants.ts` in the settings directory are modified to wire up AskSage.

### RED: No changeset

The changeset bot flagged this PR has no changeset. A new provider integration needs a changeset file for proper versioning across the affected packages (`kilo-code`, `@roo-code/vscode-webview`, `@kilocode/cli`, `@kilocode/core-schemas`, `@roo-code/types`).

### YELLOW: Default model `gpt-4o` vs `gpt-4o-mini` inconsistency

The `packages/types/src/providers/asksage.ts` file defines `askSageDefaultModelId = "gpt-4o-mini"`, but `cli/src/constants/providers/settings.ts` sets `asksage: "gpt-4o"` as the default. These should match to avoid confusion between the CLI and extension behavior.

### YELLOW: Model fetcher assumes `supportsImages: true` for all models

`src/api/providers/fetchers/asksage.ts:29` hardcodes `supportsImages: true` for every model returned by the API. AskSage routes to 150+ models -- not all support images (e.g., code-specific models, older text-only models). This should ideally be read from the API response or defaulted to `false`.

### YELLOW: Streaming support not confirmed in AskSage docs

The handler uses streaming (`stream: true` with `stream_options: { include_usage: true }`), but the AskSage OpenAI-compatibility documentation does not mention streaming or SSE support. If the `/v1/chat/completions` endpoint does not support streaming, the handler will fail at runtime. This should be verified.

### GRAY: Missing `// kilocode_change` markers

Kilo Code convention requires `// kilocode_change` markers on lines that differ from the upstream Roo Code codebase. The new provider files and integration points should include these markers to help with future upstream merges.

### GRAY: Default model info pricing may not reflect AskSage pricing

The default model info hardcodes `inputPrice: 0.15` and `outputPrice: 0.6` which match OpenAI's GPT-4o-mini pricing. AskSage may charge different rates through their unified API. The fetcher correctly reads prices from the API response, but the fallback defaults could mislead cost calculations when the API is unreachable.

## CI Status

| Check | Result |
|-------|--------|
| Merge status | CONFLICTING |
| CI checks | NOT_RUN (no status checks due to conflicts) |

The PR cannot be merged in its current state due to merge conflicts.

## Code Snippets

### Handler structure (follows Requesty pattern well):
```typescript
// src/api/providers/asksage.ts
export class AskSageHandler extends BaseProvider implements SingleCompletionHandler {
    protected options: ApiHandlerOptions
    protected models: ModelRecord = {}
    private client: OpenAI
    private baseURL: string
    private readonly providerName = "AskSage"
    // ...
}
```

### Model fetcher (hardcoded image support):
```typescript
// src/api/providers/fetchers/asksage.ts
const modelInfo: ModelInfo = {
    maxTokens: rawModel.max_output_tokens || 4096,
    contextWindow: rawModel.context_window || 128_000,
    supportsPromptCache: false,
    supportsImages: true,  // hardcoded -- not all models support images
    supportsNativeTools: true,
    defaultToolProtocol: "native",
    inputPrice: rawModel.input_price || 0,
    outputPrice: rawModel.output_price || 0,
    description: rawModel.description,
}
```

### Replacements causing conflicts:
```diff
// cli/src/constants/providers/labels.ts
- corethink: "Corethink"
+ asksage: "Ask Sage",

// packages/types/src/providers/index.ts
- case "zenmux": // kilocode_change
-     return zenmuxDefaultModelId // kilocode_change
+ case "asksage":
+     return askSageDefaultModelId
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**REQUEST_CHANGES** -- The handler implementation itself is solid and closely follows the established Requesty pattern with proper base class usage, OpenAI SDK integration, streaming support, native tool calls, and error handling. The test suite is comprehensive at 413 lines covering initialization, streaming, tool calls (native and non-native protocols), and prompt completion.

However, the PR has several blocking issues:

1. **Replaces existing providers** (corethink, zenmux) instead of adding alongside them -- this would break those providers for existing users and is the root cause of merge conflicts
2. **No settings UI component** -- users cannot configure AskSage without a settings panel
3. **No changeset** for version bumping
4. **Default model inconsistency** between types package (`gpt-4o-mini`) and CLI settings (`gpt-4o`)

To fix: rebase on `main`, add `asksage` entries without removing `corethink`/`zenmux`, create an `AskSage.tsx` settings component modeled on `ZenMux.tsx` or `Requesty`, add a changeset, add i18n strings, and ensure default model IDs are consistent across packages.
