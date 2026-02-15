<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5490
title: "Fix Silent JSON Parse Errors in combineApiRequests"
author: zwbproducts
category: bugfix
tier: 5
lines: 815
files: 9
verdict: REQUEST_CHANGES
confidence: 4
reviewed_at: 2026-02-15
-->

# Review: kilocode #5490

> **Fix Silent JSON Parse Errors in combineApiRequests** by @zwbproducts

[Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | WARN | Core fix is correct; ancillary changes are risky |
| Conventions | FAIL | Committed junk files; broke combineApiRequests export |
| Changeset | PASS | Two changesets included |
| Tests | PASS | 3 relevant tests added for combineApiRequests |
| i18n | N/A | No user-facing strings |
| Types | PASS | Types correct |
| Security | PASS | No security concerns |
| Scope | FAIL | Massive scope creep: 9 files including ClineProvider, safeWriteJson, BUGFIX.md, PR_FORK.md, PR_UPSTREAM.md |

## Findings

### RED - Broke combineApiRequests export

The diff removes the `export { combineApiRequests }` line from `src/shared/combineApiRequests.ts`, leaving only the import statement with no re-export. This will break every consumer of this module:

```typescript
// Before (working):
import { consolidateApiRequests as combineApiRequests } from "@roo-code/core/browser"
export { combineApiRequests }

// After (broken):
import { consolidateApiRequests as combineApiRequests } from "@roo-code/core/browser"
// No export! Consumers will get "combineApiRequests is not exported" errors
```

### RED - Junk files committed to repository

Three documentation files that do not belong in the repository were committed:
- `BUGFIX.md` (153 lines) -- Bug report document
- `PR_FORK.md` (146 lines) -- PR description for the author's fork
- `PR_UPSTREAM.md` (130 lines) -- PR description for upstream

These add 429 lines of non-code content to the root of the repository.

### RED - Unrelated changes to ClineProvider.ts

A retry mechanism was added to `getTaskWithId` in `ClineProvider.ts` (16 lines added) that has nothing to do with the stated fix of "silent JSON parse errors in combineApiRequests." This is a separate change with its own changeset (`fix-file-operations-retry.md`) and introduces a 3-second retry loop with 1-second delays:

```typescript
// ClineProvider.ts - unrelated retry mechanism
for (let i = 0; i < maxRetries; i++) {
    fileExists = await fileExistsAtPath(apiConversationHistoryFilePath)
    if (fileExists) break
    this.log(`[getTaskWithId] File not found, retrying in ${retryDelay}ms`)
    await new Promise(resolve => setTimeout(resolve, retryDelay))
}
```

This should be a separate PR.

### RED - Complete rewrite of safeWriteJson.ts

The `safeWriteJson.ts` file has been substantially rewritten (152 additions / 123 deletions) to add a retry mechanism around the entire write operation. This is a critical file that handles atomic JSON writes with locking, backup, and rollback. The rewrite:

1. Wraps the entire lock-acquire -> write -> backup -> rename -> cleanup flow in a retry loop
2. Adds a `JSON.stringify(data)` pre-check before writing (redundant -- `_streamDataToFile` already serializes)
3. Changes the lock acquisition from a separate step to inside the retry loop
4. Has a separate outer try-catch for lock errors within the retry loop

This is a high-risk change to production-critical code with no tests and no demonstrated need beyond the PR author's anecdotal "race condition" claim. The existing `safeWriteJson` already has its own retry mechanism via `lockfile.lock({ retries: { retries: 5 } })`.

### YELLOW - Missing kilocode_change markers

Changes to `ClineProvider.ts` and `combineApiRequests.ts` are in shared `src/` code and require `kilocode_change` markers. The ClineProvider change has markers but the combineApiRequests.ts change does not.

### GRAY - The actual fix is 2 lines

Stripping away all the scope creep, the stated fix is adding `console.warn()` to two catch blocks in `combineApiRequests`. But the actual `combineApiRequests.ts` file on main is just a re-export from `@roo-code/core/browser`. The fix would need to be applied in the `@roo-code/core` package, not here. The PR removes the export line but does not add any warning logging to the actual implementation.

## CI Status

| Check | Result |
|-------|--------|
| CI | No checks reported on branch |

## Code Snippets

Broken export:
```typescript
// src/shared/combineApiRequests.ts - export removed
import { consolidateApiRequests as combineApiRequests } from "@roo-code/core/browser"
// Missing: export { combineApiRequests }
```

Test additions (these are good):
```typescript
// src/shared/__tests__/combineApiRequests.spec.ts
describe("Error logging", () => {
    it("should log warning when api_req_started has malformed JSON", () => { ... })
    it("should log warning when api_req_finished has malformed JSON", () => { ... })
    it("should include timestamp in warning when parsing fails", () => { ... })
})
```

## Verdict

**REQUEST_CHANGES** -- This PR has significant problems that prevent merging:

1. **Breaking change**: The removed `export` in `combineApiRequests.ts` will break all consumers
2. **Junk files**: BUGFIX.md, PR_FORK.md, PR_UPSTREAM.md do not belong in the repository
3. **Scope creep**: ClineProvider retry, safeWriteJson rewrite, and the core fix are three separate concerns bundled into one PR
4. **High-risk refactor**: The safeWriteJson rewrite modifies production-critical atomic write logic with no tests
5. **No CI**: No CI checks have run on this branch

The core idea (logging parse errors instead of silently swallowing them) is valid, but it needs to be applied to the correct file (`@roo-code/core`), and all unrelated changes should be removed or split into separate PRs.
