<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5490
title: "Fix Silent JSON Parse Errors in combineApiRequests"
author: zwbproducts
category: fix
tier: 2
lines: 815
files: 9
verdict: REQUEST_CHANGES
confidence: 5
reviewed_at: 2026-02-14
linked_issue: none
fork_pr: none
-->

# Review: kilocode #5490

> **Fix Silent JSON Parse Errors in combineApiRequests** by @zwbproducts
> Review #54

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | FAIL | Core fix never applied -- `combineApiRequests.ts` export removed instead of modified |
| Conventions | FAIL | Adds 3 root-level markdown docs (BUGFIX.md, PR_FORK.md, PR_UPSTREAM.md) -- project does not use these |
| Changeset | WARN | Two changesets for one PR; one is for unrelated "file operations retry" |
| Tests | FAIL | New tests spy on `console.warn` but the real implementation was never changed to call `console.warn` |
| i18n | N/A | No user-facing strings |
| Types | WARN | `actualTempNewFilePath` cast with `as string` is unnecessary |
| Security | PASS | No security implications |
| Scope | FAIL | PR claims to fix combineApiRequests but also rewrites safeWriteJson and adds retry logic to ClineProvider -- 3 unrelated changes in 1 PR |

## Findings

### RED: The stated fix was never applied to the actual implementation

The PR title says "Fix Silent JSON Parse Errors in combineApiRequests." The real implementation lives in `packages/core/src/message-utils/consolidateApiRequests.ts` (lines 69-83), which still has the silent catch blocks:

```typescript
try {
    if (startMessage.text) {
        startData = JSON.parse(startMessage.text)
    }
} catch {
    // Ignore JSON parse errors
}
```

The diff for `src/shared/combineApiRequests.ts` only **removes the re-export line** (`export { combineApiRequests }`), which would break any consumer importing from `@shared/combineApiRequests`. The file becomes a dead import with no export. No `console.warn` was added anywhere in the actual parsing logic.

### RED: Three new root-level documentation files do not belong

The PR adds `BUGFIX.md` (153 lines), `PR_FORK.md` (146 lines), and `PR_UPSTREAM.md` (130 lines) to the repository root. The Kilo Code project does not use root-level bug report or PR template markdown files. These are personal workflow documents that should not be committed.

### RED: Tests will fail -- they assert behavior that was never implemented

The 3 new tests in `combineApiRequests.spec.ts` spy on `console.warn` and assert that warnings are logged when JSON parsing fails:

```typescript
expect(warnSpy).toHaveBeenCalledWith(
    expect.stringContaining("[combineApiRequests] Failed to parse api_req_started JSON"),
    expect.any(String),
)
```

Since the actual implementation (`consolidateApiRequests` in `@roo-code/core/browser`) was never modified to add `console.warn` calls, these tests will fail. The tests are testing code that does not exist.

### RED: Unrelated rewrite of safeWriteJson.ts

The PR completely rewrites `src/utils/safeWriteJson.ts` (152 deletions, 152 additions) to add a retry loop around the entire write-lock-backup workflow. This is:

1. **Unrelated** to JSON parse error logging in `combineApiRequests`
2. **Architecturally problematic** -- the function already has lock retries (5 retries via `proper-lockfile`). Adding a second retry loop around the lock+write+backup creates nested retry behavior: up to 5 lock retries x 3 write retries = 15 total attempts with `setTimeout` delays
3. **Introduces a pre-serialization check** (`JSON.stringify(data)`) that doubles memory usage for large objects and adds latency for the common success path
4. **Adds an unnecessary `as string` cast** on line where `actualTempNewFilePath` is already known to be a string

### RED: Unrelated retry loop in ClineProvider.ts

The PR adds a retry-with-delay mechanism to `getTaskWithId` in `ClineProvider.ts`:

```typescript
for (let i = 0; i < maxRetries; i++) {
    fileExists = await fileExistsAtPath(apiConversationHistoryFilePath)
    if (fileExists) break
    this.log(`[getTaskWithId] File not found, retrying in ${retryDelay}ms...`)
    await new Promise(resolve => setTimeout(resolve, retryDelay))
}
```

This adds up to 3 seconds of blocking delay (3 retries x 1000ms) in a function that already has explicit handling for missing files. The existing code path shows an error message to the user when the file is not found, which is the correct behavior. Adding silent retries masks the root cause (noted in the existing comment: "FIXME: this seems to happen sometimes when the json file doesnt save to disk for some reason").

### YELLOW: Two changesets for one PR

The PR includes two changeset files:
- `fix-silent-json-parse-errors.md` -- for the stated fix
- `fix-file-operations-retry.md` -- for the unrelated safeWriteJson/ClineProvider retry logic

Multiple changesets in a single PR is unusual. The retry-related changes should be a separate PR.

### YELLOW: Removed export breaks the module

The diff for `src/shared/combineApiRequests.ts` removes line 3 (`export { combineApiRequests }`), leaving a file that imports but never exports. Any code importing `combineApiRequests` from this module path would get an undefined import.

## CI Status

No CI checks reported on this branch. The PR targets the author's own fork (`zwbproducts/kilocode:main`) rather than `Kilo-Org/kilocode:main`, so upstream CI did not run.

## Code Snippets

### What the diff actually does to combineApiRequests.ts:
```typescript
// BEFORE (working re-export):
import { consolidateApiRequests as combineApiRequests } from "@roo-code/core/browser"

export { combineApiRequests }

// AFTER (broken -- no export):
import { consolidateApiRequests as combineApiRequests } from "@roo-code/core/browser"

```

### Where the fix should have been applied:
```typescript
// packages/core/src/message-utils/consolidateApiRequests.ts:69-83
// These catch blocks are UNCHANGED by this PR:
try {
    if (startMessage.text) {
        startData = JSON.parse(startMessage.text)
    }
} catch {
    // Ignore JSON parse errors  <-- Still silent
}

try {
    if (message.text) {
        finishData = JSON.parse(message.text)
    }
} catch {
    // Ignore JSON parse errors  <-- Still silent
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

**REQUEST_CHANGES** -- This PR has fundamental correctness issues that prevent it from being merged:

1. The core fix (adding `console.warn` to JSON parse catch blocks) was never applied to the actual implementation file (`packages/core/src/message-utils/consolidateApiRequests.ts`). The modification to `src/shared/combineApiRequests.ts` only removes the re-export, which would break the module.

2. The new tests assert behavior (`console.warn` calls) that does not exist in the codebase. They will fail.

3. The PR bundles three unrelated changes (combineApiRequests logging, safeWriteJson retry rewrite, ClineProvider retry loop) that should each be their own PR.

4. Three root-level documentation files (BUGFIX.md, PR_FORK.md, PR_UPSTREAM.md) do not belong in the repository.

The underlying idea -- logging warnings instead of silently swallowing JSON parse errors -- is reasonable and would be a 5-line change in `consolidateApiRequests.ts`. But this PR does not actually make that change.
