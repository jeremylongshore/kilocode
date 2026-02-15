<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5534
title: Per-workspace codebase indexing with manual control
author: abdulrahimpds
category: feature
tier: 5
lines: 889
files: 59
verdict: COMMENT
confidence: 3
reviewed_at: 2026-02-15
-->

# Review: kilocode #5534

> **Per-workspace codebase indexing with manual control** by @abdulrahimpds

[Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Summary

This PR changes the codebase indexing feature from a global auto-start toggle to a per-workspace manual-control model. Instead of auto-indexing every opened repo, users now explicitly activate indexing per workspace via an "Activate Index" / "Deactivate Index" button. Workspace permission is stored in VS Code `workspaceState` (keyed `indexingAllowed`). The UI has been substantially reworked with Neonsy's contributions stacked on top.

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | Yellow | Core logic sound, but some concerns about backward compat and the batch size jump |
| Conventions | Pass | kilocode_change markers present where needed |
| Changeset | Pass | `per-workspace-indexing-control.md` present, patch semver |
| Tests | Pass | Config manager tests updated, double-click scenario tested, manager test updated |
| i18n | Yellow | 5 new translation keys added to en, but not all locales have all keys (some have 6, some 8 changes) |
| Types | Pass | ExtensionMessage and WebviewMessage updated with new types |
| Security | Pass | No secrets exposed, workspace state is local |
| Scope | Yellow | Batch size change (200->900) and collection naming change are unrelated to workspace control |

## Findings

### 1. (Yellow) MAX_EMBEDDING_BATCH_SIZE increased 4.5x without explanation
**File:** `packages/types/src/codebase-index.ts:17`
The max batch size jumps from 200 to 900. This is unrelated to per-workspace indexing and could cause memory pressure on constrained systems. Should be a separate PR or at minimum documented in the changeset.

### 2. (Yellow) `isFeatureEnabled` no longer checks `codebaseIndexEnabled`
**File:** `src/services/code-index/config-manager.ts:600`
```typescript
public get isFeatureEnabled(): boolean {
    return this.indexingAllowed
}
```
The global `codebaseIndexEnabled` setting is now completely ignored. Users who had indexing enabled globally will find it silently disabled after upgrading -- they must re-activate per workspace. This is a breaking UX change with no migration path. The test at line 329 explicitly asserts `isFeatureEnabled` returns `true` even when `codebaseIndexEnabled` is `false`, confirming the decoupling is intentional. Consider at least logging a one-time notification or auto-migrating workspaces that had indexing active.

### 3. (Yellow) `src/package.json` indentation broken
**File:** `src/package.json:590`
The removal of `codeIndex.embeddingBatchSize` appears to have broken the indentation of the `kilo-code.toolProtocol` block (extra tab removed). While functional, this introduces whitespace inconsistency.

### 4. (Gray) Qdrant collection name format change is a silent migration
**File:** `src/services/code-index/vector-store/qdrant-client.ts:83-88`
Collection names change from `ws-{hash}` to `{basename}-{hash}`. Existing collections will be orphaned -- the code will create a new collection for the same workspace rather than reusing the old one. This wastes storage and confuses users who check Qdrant directly.

### 5. (Gray) Loading state has a 10-second hard timeout
**File:** `webview-ui/src/components/chat/CodeIndexPopover.tsx` (timeout effect)
The 10-second failsafe for the loading spinner is reasonable but aggressive. If Qdrant initialization takes longer (e.g., pulling a Docker image), the spinner will stop but indexing may still be starting in the background, creating a confusing disconnect.

### 6. (Yellow) Removal of `codeIndex.embeddingBatchSize` VS Code setting
**File:** `src/package.json:587-593`
The entire `kilo-code.codeIndex.embeddingBatchSize` VS Code configuration property was removed. Users who had customized this setting will silently lose their configuration. The `EmbeddingBatchSizeSlider.tsx` changes suggest it moved to the popover UI, but the migration path is undocumented.

## CI Status

| Check | Result |
|-------|--------|
| compile | Pass |
| test-extension (ubuntu) | Pass |
| test-extension (windows) | Pass |
| test-webview (ubuntu) | Pass |
| test-webview (windows) | Pass |
| test-cli | Pass |
| test-jetbrains | Pass |
| check-translations | Pass |
| build-cli | Pass |

## Code Snippets

**Core behavior change -- workspace-only gating:**
```typescript
// src/services/code-index/config-manager.ts
public get isFeatureEnabled(): boolean {
    return this.indexingAllowed  // Was: return this.codebaseIndexEnabled
}
```

**New workspace activation handler:**
```typescript
// src/core/webview/webviewMessageHandler.ts
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

**Qdrant collection naming (readable but breaking):**
```typescript
// src/services/code-index/vector-store/qdrant-client.ts
const sanitizedBasename = basename.toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/^-+|-+$/g, "")
this.collectionName = `${sanitizedBasename}-${hash.substring(0, 16)}`
```

## Verdict

**COMMENT** -- The feature concept is solid and addresses a real user need. The workspace-level gating with explicit activation is the right UX direction. However, there are several backward-compatibility concerns that should be addressed before merge:

1. The global `codebaseIndexEnabled` setting is silently abandoned with no migration.
2. Existing Qdrant collections will be orphaned due to the naming change.
3. The batch size increase and setting removal are scope creep that should be separate PRs.
4. Multiple contributors (Neonsy's stacked changes) make the diff harder to review atomically.

The PR has active community discussion with ongoing refinements. CI is green. I recommend addressing the migration concerns and splitting out unrelated changes before final approval.
