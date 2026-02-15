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
confidence: 5
reviewed_at: 2026-02-15
-->

# Review: kilocode #5513

> **Add Agentica as a provider to Kilo Code.** by @ccocks

[Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | FAIL | Build fails; massive unrelated changes break the codebase |
| Conventions | FAIL | .gitignore broken; diff files committed; types inlined instead of imported |
| Changeset | FAIL | Missing changeset |
| Tests | WARN | Minimal test coverage (1 spec, 1 test case) for 6000+ lines |
| i18n | FAIL | No i18n for any new UI strings |
| Types | FAIL | ExtensionMessage.ts and WebviewMessage.ts completely rewritten with inline definitions |
| Security | WARN | GitHub OAuth client ID hardcoded; password storage implementation has concerns |
| Scope | FAIL | 46 files, 6000+ lines for a provider addition; includes unrelated ClineProvider refactoring |

## Findings

### RED - Build is broken (CI fails)

All CI checks fail except `check-translations`, `test-cli`, and the docs build. The compile step fails, meaning the PR introduces compilation errors:
- `compile: FAIL`
- `test-extension: FAIL` (both ubuntu and windows)
- `test-webview: FAIL` (both ubuntu and windows)
- `test-jetbrains: FAIL`

Maintainer @kevinvandijk requested changes: "the build is failing because it is missing files."

### RED - .gitignore changes un-ignore `bin/` and `*.vsix`

The PR comments out gitignore entries for build artifacts:

```gitignore
# Before:
bin/
*.vsix

# After:
# bin/
# *.vsix
```

This will cause build artifacts (potentially large binary files) to be tracked by git. This is almost certainly unintentional.

### RED - Junk diff files committed

Three large diff files are committed to the repository root:
- `cline_full_diff.txt` (1065 lines)
- `diff.txt` (207 lines)
- `github_diff.txt` (empty)

These are debugging artifacts from the development process and do not belong in the repository.

### RED - ExtensionMessage.ts completely rewritten (1055+ lines)

The file `src/shared/ExtensionMessage.ts` was a 3-line re-export shim:

```typescript
// kilocode_change - new file
// Legacy re-export shim for extension/webview message types.
export type { ExtensionMessage, ClineSayTool, IndexingStatus } from "@roo-code/types"
```

The PR replaces this with a 1055-line inline type definition that duplicates types from `@roo-code/types`. This:
- Breaks the type consolidation architecture
- Creates maintenance burden of keeping two copies in sync
- Suggests the PR was developed against an older version of the codebase

### RED - WebviewMessage.ts similarly rewritten (565+ lines)

Same issue -- `WebviewMessage.ts` is expanded from its shim form to 565 lines of inline type definitions, duplicating `@roo-code/types`.

### RED - ClineProvider.ts has 218 additions / 46 deletions

Massive unrelated changes to `ClineProvider.ts` including:
- Changing the `latestAnnouncementId` (a live-impacting change)
- Replacing `delay` import with inline `setTimeout`
- Adding `aggregateTaskCostsRecursive` import
- Restructuring profile loading in `getTaskWithId`
- Adding `VirtualQuotaFallbackHandler` import
- Adding `validateAndFixToolResultIds` import
- Changing `ClineProviderState` type definition

These are not related to adding a new provider and would conflict with other in-flight PRs.

### RED - No changeset

Missing entirely. A PR adding a new provider (46 files, 6000+ lines) needs a changeset.

### YELLOW - GitHub OAuth Client ID hardcoded

`GithubDeviceAuthService.ts` hardcodes a GitHub OAuth Client ID:

```typescript
private static readonly DEFAULT_CLIENT_ID = "Ov23lioKGgXQS2BOFDWO"
```

While OAuth client IDs are not secrets (they're public by design), hardcoding a third-party service's client ID in the codebase ties Kilo Code to Agentica's specific GitHub OAuth app. If Agentica changes their OAuth app, all Kilo Code installations break until the code is updated.

### YELLOW - Password storage duplication

Two new password storage implementations:
- `src/utils/securePasswordStorage.ts` (143 lines) - VS Code secrets API wrapper
- `webview-ui/src/utils/passwordStorage.ts` (213 lines) - Webview-side implementation

Kilo Code already has a mechanism for storing API keys via `globalState` and the secrets API. Adding a parallel storage system creates confusion about where credentials are stored.

### YELLOW - Provider implementation is clean

Despite all the issues, the core provider files are well-structured:
- `src/api/providers/agentica.ts` (40 lines) -- Clean extension of `OpenAiHandler`
- `src/api/providers/fetchers/agentica.ts` (277 lines) -- Proper Zod schema validation, fallback models
- `packages/types/src/providers/agentica.ts` (227 lines) -- Model definitions

The `AgenticaHandler` extends `OpenAiHandler` correctly, which is the right pattern for an OpenAI-compatible provider.

### GRAY - Extensive UI additions

The PR adds several Agentica-specific UI components:
- `SavingsBadge.tsx` - Cost savings display
- `UsageQuotaBanner.tsx` - Quota warnings
- `ServerOverloadWarning.tsx` - Overload notifications
- `PlanCard.tsx` / `PlansView.tsx` - Subscription plans
- `UpgradeModal.tsx` - Upgrade prompts
- `UsageStats.tsx` - Usage statistics

These are legitimate for a provider with a free tier and usage limits, but add significant maintenance surface area.

## CI Status

| Check | Result |
|-------|--------|
| compile | FAIL |
| test-extension (ubuntu) | FAIL |
| test-extension (windows) | FAIL |
| test-jetbrains | FAIL |
| test-webview (ubuntu) | FAIL |
| test-webview (windows) | FAIL |
| test-cli | PASS |
| build-cli | FAIL |
| check-translations | PASS |
| Build Markdoc Site | PASS |

Most CI checks fail.

## Code Snippets

Provider handler (clean):
```typescript
// src/api/providers/agentica.ts
export class AgenticaHandler extends OpenAiHandler {
    constructor(options: ApiHandlerOptions) {
        super({
            ...options,
            openAiApiKey: options.agenticaApiKey ?? "not-provided",
            openAiModelId: options.apiModelId ?? agenticaDefaultModelId,
            openAiBaseUrl: "https://api.genlabs.dev/agentica/v1",
            openAiStreamingEnabled: true,
            includeMaxTokens: true,
        })
    }
}
```

.gitignore breakage:
```gitignore
# Builds
# bin/          <-- was: bin/
bin-unpacked/
# *.vsix        <-- was: *.vsix
```

## Verdict

**REQUEST_CHANGES** -- This PR has fundamental issues that prevent merging:

1. **Build is broken** -- CI fails across the board
2. **Type architecture violation** -- ExtensionMessage.ts and WebviewMessage.ts re-exports replaced with 1600+ lines of inline type duplications
3. **Junk files** -- cline_full_diff.txt, diff.txt, github_diff.txt committed to repo
4. **.gitignore broken** -- bin/ and *.vsix un-ignored
5. **Scope explosion** -- ClineProvider.ts has 264 lines of unrelated changes
6. **Missing changeset**
7. **Merge conflicts** (CONFLICTING status)

The core provider implementation (agentica.ts, fetchers/agentica.ts, types) is well-done and follows existing patterns. The recommendation is to:
1. Remove all junk files and .gitignore changes
2. Revert ExtensionMessage.ts and WebviewMessage.ts to re-export shims
3. Remove all unrelated ClineProvider changes
4. Rebase on current main to resolve conflicts
5. Add a changeset
6. Ensure CI passes

Maintainer already requested changes for build failures. This PR needs substantial cleanup before it can be re-reviewed.
