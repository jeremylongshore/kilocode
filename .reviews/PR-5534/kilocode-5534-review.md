<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5534
title: "Per-workspace codebase indexing with manual control"
author: abdulrahimpds
co-authors: Neonsy
category: feature
tier: 3
lines: 889
files: 59
verdict: REQUEST_CHANGES
confidence: 4
reviewed_at: 2026-02-14
linked_issue: none
fork_pr: pending
-->

# Review: kilocode #5534

> **Per-workspace codebase indexing with manual control** by @abdulrahimpds (co-authored by @Neonsy)
> 59 files, +670/-219 lines | Feature PR with backend, frontend, and i18n changes

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | FAIL | Qdrant collection rename breaks existing users without migration -- see RED finding |
| Conventions | PASS | Uses `// kilocode_change` markers consistently |
| Changeset | PASS | Patch changeset included |
| Tests | WARN | Good new tests added, but removed cancel-indexing test with no replacement for that flow |
| i18n | FAIL | Missing `featureNotConfiguredWarning` key in all locale files -- see RED finding |
| Types | PASS | New message types properly declared in `ExtensionMessage` and `WebviewMessage` |
| Security | PASS | No security implications |
| Scope | WARN | Batch size max increase (200->900) and VS Code setting removal are scope creep beyond the stated goal |

## Findings

### RED: Qdrant collection name change breaks existing indexes without migration

`src/services/code-index/vector-store/qdrant-client.ts:80-86`

The collection naming scheme changes from `ws-{hash16}` to `{basename}-{hash16}`:

```typescript
// Before:
this.collectionName = `ws-${hash.substring(0, 16)}`

// After:
const basename = path.basename(workspacePath)
const sanitizedBasename = basename.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/^-+|-+$/g, "")
this.collectionName = `${sanitizedBasename}-${hash.substring(0, 16)}`
```

Every existing user with an indexed codebase will silently lose their index data. The old `ws-*` collection becomes orphaned in Qdrant (wasting disk), and a full re-index is forced. There is no migration logic, no fallback check, and no user notification.

**Recommendation:** Either (a) add migration logic that renames the old collection, or (b) keep backward compatibility by checking for the old name first, or (c) at minimum detect the old collection and inform the user that a re-index is needed.

### RED: Missing i18n key `featureNotConfiguredWarning`

`webview-ui/src/components/chat/CodeIndexPopover.tsx:692`

The component references `t("settings:codeIndex.featureNotConfiguredWarning")` but this key is not defined in any locale file (including `en/settings.json`). This will render a raw key string to users when indexing is active but not configured.

```tsx
{isWorkspaceIndexingActive && !isFeatureConfigured && (
    <div className="mt-4 p-3 ...">
        <p>{t("settings:codeIndex.featureNotConfiguredWarning")}</p>
    </div>
)}
```

This is a guaranteed UI bug. The key must be added to all 20 locale files.

### RED: `package.json` indentation corruption

`src/package.json:278`

When removing the `embeddingBatchSize` VS Code setting, the closing brace was eaten and `kilo-code.toolProtocol` lost one level of indentation:

```json
// Before (correct, 4 tabs):
				"kilo-code.toolProtocol": {

// After (broken, 3 tabs):
			"kilo-code.toolProtocol": {
					"type": "string",
```

This breaks the structural nesting within `contributes.configuration.properties`. While VS Code's JSON parser may tolerate it, it is structurally wrong and will cause issues with schema validation or future edits.

### YELLOW: `isFeatureEnabled` now ignores the global `codebaseIndexEnabled` setting

`src/services/code-index/config-manager.ts:597-599`

```typescript
public get isFeatureEnabled(): boolean {
    return this.indexingAllowed  // was: return this.codebaseIndexEnabled
}
```

The test confirms this is intentional:
```typescript
it("should return true when indexingAllowed is true even if codebaseIndexEnabled is false", ...)
```

This means the global "Enable Codebase Indexing" setting in VS Code settings is entirely bypassed. Users who have the global setting disabled can still have indexing active through the workspace-level toggle. The PR description says the global setting should work as "a global on/off switch," but the implementation contradicts this -- the global setting does nothing.

**Recommendation:** Either use `return this.codebaseIndexEnabled && this.indexingAllowed` to honor both settings, or formally deprecate/remove `codebaseIndexEnabled`.

### YELLOW: Cancel indexing button removed from UI

The diff removes `handleCancelIndexing` and the "Cancel Indexing" button entirely. Users who start indexing on a large repo have no way to stop it mid-process other than clicking "Deactivate Index," which changes the workspace state rather than just pausing the operation. The "Deactivate" action has different semantics than "Cancel" -- deactivate persists the disabled state, while cancel was a one-time stop.

The `cancelIndexing` message handler still exists in `webviewMessageHandler.ts` but is now unreachable from the UI.

### YELLOW: Embedding batch size max raised from 200 to 900 without rate-limit protection

`packages/types/src/codebase-index.ts:17`

```typescript
MAX_EMBEDDING_BATCH_SIZE: 900,  // was: 200
```

The warning added to `EmbeddingBatchSizeSlider.tsx` (shows above 200) is helpful, but 900 is 4.5x the old max and likely exceeds the rate limits of most cloud embedding providers. Additionally, this PR removes the VS Code setting registration for `embeddingBatchSize` from `package.json`, so users who configured it via VS Code settings will silently lose their custom value.

### YELLOW: `startIndexing` handler now unconditionally sets `indexingAllowed = true`

`src/core/webview/webviewMessageHandler.ts:3584-3590`

```typescript
case "startIndexing": {
    // ...
    await provider.context.workspaceState.update("indexingAllowed", true)
    await manager.initialize(provider.contextProxy)
```

The `startIndexing` handler now always sets `indexingAllowed = true` before checking if the feature is configured. Any code path that triggers `startIndexing` will permanently enable workspace-level indexing as a side effect. The new `activateWorkspaceIndexing` handler duplicates this exact logic, creating two paths that do the same thing.

### GRAY: Test relies on coincidental naming

`src/services/code-index/vector-store/__tests__/qdrant-client.spec.ts:55`

```typescript
const mockWorkspacePath = "/test/workspace"
const expectedCollectionName = `workspace-${mockHashedPath.substring(0, 16)}`
```

The test passes because `path.basename("/test/workspace")` is `"workspace"`, coincidentally matching the new prefix. A test with a path like `/home/user/My Project!` would better validate the sanitization logic (`my-project-` -> `my-project`).

### GRAY: Inconsistent `hasIndexData` computation across three handlers

The `requestWorkspaceIndexingStatus`, `activateWorkspaceIndexing`, and `deactivateWorkspaceIndexing` handlers each compute `hasIndexData` differently:

- `requestWorkspaceIndexingStatus`: `systemStatus === "Indexed" || (totalItems > 0 && processedItems > 0)`
- `activateWorkspaceIndexing`: `systemStatus === "Indexed" || systemStatus === "Indexing" || totalItems > 0`
- `deactivateWorkspaceIndexing`: `systemStatus === "Indexed" || totalItems > 0`

This inconsistency could cause the Clear button to flicker between enabled/disabled states. Extract this into a shared helper function.

### GRAY: Redundant unmount cleanup useEffect

`webview-ui/src/components/chat/CodeIndexPopover.tsx` (lines 562-567):

```tsx
useEffect(() => {
    return () => { setIsStartingIndexing(false) }
}, [])
```

React 18+ already handles state cleanup on unmount. This useEffect adds complexity without benefit.

## CI Status

| Check | Result |
|-------|--------|
| build-cli | PASS |
| compile | PASS |
| check-translations | PASS |
| test-cli | PASS |
| test-extension (ubuntu) | PASS |
| test-extension (windows) | PASS |
| test-jetbrains | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| unit-test | PASS |
| Build Markdoc Site | PASS |

All 11 upstream CI checks pass. The `check-translations` pass despite the missing `featureNotConfiguredWarning` key suggests the checker only validates existing keys, not references from source code.

## Architecture Summary

The PR introduces a workspace-level permission model (`indexingAllowed` in VS Code's `workspaceState`) that gates codebase indexing per-repository:

1. User clicks "Activate Index" in the popover
2. Frontend sends `activateWorkspaceIndexing` message
3. Backend sets `workspaceState.indexingAllowed = true`, initializes the manager, auto-starts indexing
4. "Deactivate Index" reverses this, stopping indexing but preserving data
5. "Clear Index Data" removes data AND resets `indexingAllowed = false`

The UI replaces the global checkbox with Activate/Deactivate buttons and moves the Save button to a fixed footer position.

## Code Snippets

### Core config change -- workspace-level gating:
```typescript
// config-manager.ts -- isFeatureEnabled now checks workspace state only
public get isFeatureEnabled(): boolean {
    return this.indexingAllowed  // reads from workspaceState.get("indexingAllowed")
}
```

### New Qdrant collection naming:
```typescript
// qdrant-client.ts -- human-readable collection names
const basename = path.basename(workspacePath)
const sanitizedBasename = basename.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/^-+|-+$/g, "")
this.collectionName = `${sanitizedBasename}-${hash.substring(0, 16)}`
```

### New activate/deactivate handler pattern:
```typescript
// webviewMessageHandler.ts
case "activateWorkspaceIndexing": {
    await provider.context.workspaceState.update("indexingAllowed", true)
    await manager.initialize(provider.contextProxy)
    if (manager.isFeatureConfigured) {
        const currentState = manager.state
        if (currentState === "Standby" || currentState === "Error") {
            manager.startIndexing()
        }
    }
    // ...
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

**REQUEST_CHANGES** -- The feature concept is sound and addresses a real user friction point (auto-indexing every opened workspace). The UI redesign by @Neonsy is clean and well-structured. However, three issues must be resolved before merge:

1. **Qdrant collection name change** silently breaks every existing user's index with no migration or notification
2. **Missing `featureNotConfiguredWarning` i18n key** will display raw key text to users
3. **`package.json` indentation corruption** introduces structural JSON errors

The YELLOW findings (global setting bypass, cancel button removal, batch size increase) are design decisions that should be discussed with maintainers but are not strict blockers if intentional.
