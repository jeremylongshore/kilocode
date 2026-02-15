<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5513
title: "Add Agentica as a provider to Kilo Code."
author: ccocks
category: provider
tier: 5
lines: 6274
files: 46
verdict: REQUEST_CHANGES
confidence: 0.95
reviewed_at: 2026-02-14
fork_pr: N/A (batch review)
linked_issue: N/A
-->

# Review: kilocode #5513

> **Add Agentica as a provider to Kilo Code.** by @ccocks

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | FAIL | Handler uses wrong model ID field; model data triplicated with inconsistent values |
| Conventions | FAIL | Replaces re-export shims with 1000+ line inline copies of upstream types; breaks architecture |
| Changeset | FAIL | Missing changeset for 3 packages (types, vscode-webview, kilo-code) |
| Tests | WARN | Only 1 component test (61 lines) + 2 trivial spec additions for ~6300 line PR |
| i18n | WARN | PlansView, UpgradeModal, UsageStats, SavingsBadge all use hardcoded English strings |
| Types | FAIL | `isFree` field added to model defs but never declared in ModelInfo schema; `any` types scattered |
| Security | FAIL | Password stored in provider settings (global state) alongside "secure" storage; dual-path confusion |
| Scope | FAIL | Includes unrelated upstream refactors (ClineProviderState, default changes, HTML indentation, template literals) |

## Findings

### RED - Blocking

1. **`ExtensionMessage.ts` / `WebviewMessage.ts` replaced with inline copies (1,620 lines added)**
   `src/shared/ExtensionMessage.ts` was a 3-line re-export shim:
   ```typescript
   export type { ExtensionMessage, ClineSayTool, IndexingStatus } from "@roo-code/types"
   ```
   This PR replaces it with a 1,055-line inline copy of the full type definitions, duplicating everything from `@roo-code/types`. Same for `WebviewMessage.ts` (16 lines -> 565 lines). This breaks the monorepo architecture where types live in `packages/types/` and are re-exported. Every future upstream change to these types will create merge conflicts and divergence.

2. **Accidentally committed diff artifacts (3 files, 1,272 lines of noise)**
   - `cline_full_diff.txt` (1,065 lines) - internal development diff
   - `diff.txt` (207 lines) - another internal diff
   - `github_diff.txt` (0 lines, empty file)

   These are development artifacts that should never be committed.

3. **`.gitignore` weakened - comments out `bin/` and `*.vsix`**
   ```diff
   -bin/
   +# bin/
   -*.vsix
   +# *.vsix
   ```
   This allows build artifacts and packaged extensions to be committed to the repo.

4. **Model data defined THREE times with inconsistent values**
   - `packages/types/src/providers/agentica.ts` (static model defs with `isFree`, prices)
   - `src/api/providers/fetchers/agentica.ts` (FALLBACK_MODELS with different `maxTokens` values)
   - `src/api/providers/agentica.ts` (defaultModelInfo with yet another set of values)

   Example inconsistency for `deca-coder-flash`:
   - types: `maxTokens: 64_000, contextWindow: 200_000`
   - fetcher fallback: `maxTokens: 32768, contextWindow: 128000`
   - handler: `maxTokens: 32768, contextWindow: 128000`

   Claude 4.5 Opus pricing inconsistency:
   - types: `inputPrice: 5.00, outputPrice: 25.00`
   - fetcher fallback: `inputPrice: 15, outputPrice: 75`

5. **Handler `getModel()` uses `apiModelId` instead of `agenticaModelId`**
   ```typescript
   // src/api/providers/agentica.ts
   override getModel() {
       const id = this.options.apiModelId ?? agenticaDefaultModelId
   ```
   The provider schema registers `agenticaModelId` as the model ID key, but the handler reads `apiModelId`. This means model selection from the UI won't reach the handler correctly.

6. **Password stored in plaintext in global state AND in "secure" storage**
   `agenticaPassword` is a field in `providerSettingsSchema` (persisted in VS Code global state), and simultaneously stored via `SecurePasswordStorage`. The webview component loads from secure storage and writes to `setApiConfigurationField("agenticaPassword", ...)`, which goes to global state. This is security theater -- the password is in plaintext in global state regardless.

7. **Unrelated behavior changes to existing code**
   - Changes `alwaysAllowExecute/Browser/Mcp/ModeSwitch/Subtasks` defaults from `true` to `false` in `getStateToPostToWebview` (line ~2546-2552 of ClineProvider diff)
   - Changes `maxReadFileLine` default from `-1` to `500`
   - Changes default provider fallback from existing to `"agentica"` then back to `"kilocode"` (evidence of incomplete cleanup)
   - Removes `alwaysApproveResubmit` and `requestDelaySeconds` from one location, adds them elsewhere
   - Reformats HTML template indentation (spaces to tabs)
   - Reformats multiple template literal error messages (removes line breaks)

### YELLOW - Should Fix

8. **`AgenticaClient.callMinimaxM2()` is dead code with hardcoded model**
   The webview client has a `callMinimaxM2` method that calls a specific model endpoint (`/minimax-m2/chat`). This is never called anywhere and hardcodes a specific model, which defeats the purpose of a multi-model provider.

9. **`isFree` property used in model defs but never declared in `ModelInfo` schema**
   The `agenticaModels` object uses `isFree: true` on multiple models, but the `modelInfoSchema` in `packages/types/src/model.ts` only adds `creditsMultiplier` and `requiresPaidPlan`. `isFree` is not in the schema and will be stripped by zod validation.

10. **No error handling for email/password auth flow**
    `AgenticaClient` sends `email|password` as a Bearer token. If the Agentica API returns an auth error, the only feedback is a generic "Failed to fetch subscription status" message. No validation that credentials are correct before storing them.

11. **Subscription/Plans UI coupled to Agentica**
    `PlansView`, `PlanCard`, `UpgradeModal`, `UsageStats` are all Agentica-specific components. `ServerOverloadWarning` has an upgrade button that navigates to Agentica plans. These create a tight coupling to a specific third-party service within the extension's settings UI.

12. **`SavingsBadge` has division-by-zero-adjacent bug**
    ```typescript
    ({((saved / (saved + 0.01)) * 100).toFixed(1)}% savings)
    ```
    When `saved` is very small (e.g., 0.001), this gives misleading percentages. The comparison baseline (GPT-5.1) is hardcoded.

13. **Duplicate `agenticaDeviceAuthService` property on ClineProvider**
    The class has both `private agenticaDeviceAuthService?: GithubDeviceAuthService` (line ~182) and a second `private agenticaGithubDeviceAuthService?: GithubDeviceAuthService` (line ~1897). The first is unused; the methods use the second.

### GRAY - Nits

14. Mixed indentation in `constants.ts` (tabs -> 2-space in same block).
15. Commented-out code blocks in `Agentica.tsx` (divider, description paragraph).
16. `PlansView` creates a new `AgenticaClient` on every render (not memoized).
17. `UsageQuotaBanner` upgrade link goes to `https://upgrade.example.com` (placeholder).

## CI Status

| Check | Result |
|-------|--------|
| Merge conflicts | CONFLICTING (per GitHub API) |
| Changeset bot | No changeset found |
| Reviews | 0 reviews submitted |

## Code Snippets

### Handler model ID mismatch (Finding #5)
```typescript
// src/api/providers/agentica.ts - reads apiModelId
override getModel() {
    const id = this.options.apiModelId ?? agenticaDefaultModelId  // WRONG
    // Should be: this.options.agenticaModelId
}

// packages/types/src/provider-settings.ts - registers agenticaModelId
export const modelIdKeysByProvider = {
    agentica: "agenticaModelId",  // This is what the UI writes to
}
```

### Type shim replacement (Finding #1)
```typescript
// BEFORE (3 lines):
export type { ExtensionMessage, ClineSayTool, IndexingStatus } from "@roo-code/types"

// AFTER (1,055 lines):
import { GitCommit } from "../utils/git"
import { McpServer } from "./mcp"
// ... 1000+ lines of inline type definitions
```

### Inconsistent model data (Finding #4)
```typescript
// packages/types/src/providers/agentica.ts
"deca-coder-flash": { maxTokens: 64_000, contextWindow: 200_000 }

// src/api/providers/fetchers/agentica.ts (FALLBACK)
"deca-coder-flash": { maxTokens: 32768, contextWindow: 128000 }
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**REQUEST_CHANGES** -- This PR has fundamental architectural problems that need resolution before merge:

1. The ExtensionMessage/WebviewMessage inline expansion breaks the monorepo type architecture and will cause perpetual merge conflicts with upstream.
2. Development artifacts (diff files), .gitignore weakening, and numerous unrelated behavior changes indicate the PR needs significant cleanup.
3. The model data is triplicated with inconsistent values, and the handler reads the wrong model ID field, meaning model selection is broken.
4. The password dual-storage pattern (global state + "secure" storage) is a security concern.
5. The PR is in CONFLICTING state and has no changeset.

The core provider integration pattern (handler extending OpenAiHandler, type registration, fetcher, UI component) follows existing conventions well. But the execution needs a focused cleanup pass to remove unrelated changes, consolidate model data, fix the model ID bug, and restore the type re-export shims.
