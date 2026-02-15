<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5410
title: "Support refreshing MCP tool, resources, etc lists and avoid prompts"
author: lambertjosh
category: feature
tier: 5
lines: 413
files: 3
verdict: APPROVE
confidence: 4
reviewed_at: 2026-02-14
linked_issue: null
fork_pr: null
-->

# Review: kilocode #5410

> **Support refreshing MCP tool, resources, etc lists and avoid prompts** by @lambertjosh

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Properly handles MCP `list_changed` notifications per MCP spec |
| Conventions | PASS | Uses `// kilocode_change` markers, follows existing patterns |
| Changeset | WARN | Missing changeset (changeset-bot flagged) |
| Tests | PASS | 346 lines of new tests covering all notification types, error paths |
| i18n | N/A | No user-facing strings (notifications go to console, not UI) |
| Types | PASS | Exported `RefreshCapabilitiesCallback` type, optional parameter |
| Security | PASS | No security implications |
| Scope | PASS | Focused: handles list_changed + silences fallback spam |

## Findings

### GRAY: `source` not forwarded to `fetchAvailableServerCapabilities`

`McpHub.ts:1424-1427` (in the PR diff) — The refresh callback calls `fetchAvailableServerCapabilities(serverName)` without the `source` parameter, even though `source` is available in the closure from `connectToServer()`:

```typescript
this.kiloNotificationService.connect(name, connection.client, async (serverName) => {
    await this.fetchAvailableServerCapabilities(serverName, source)  // <-- PR omits `source`
    await this.notifyWebviewOfServerChanges()
})
```

When `source` is omitted, `findConnection` falls back to a project-first heuristic. This works correctly in all common cases. The only edge case is if a user has the exact same server name in both global and project scope — the refresh would always target the project one regardless of which server actually sent the notification. This is unlikely and low-impact, but passing `source` from the closure would be more precise.

### GRAY: Three near-identical notification handlers could be DRYed

`NotificationService.ts:55-84` — The `ResourceListChanged`, `ToolListChanged`, and `PromptListChanged` handlers are structurally identical, differing only in the schema and log message. A helper function could reduce ~30 lines of duplication:

```typescript
const registerRefreshHandler = (schema: any, label: string) => {
    client.setNotificationHandler(schema, async () => {
        console.log(`MCP ${name}: ${label} list changed, refreshing capabilities`)
        try {
            await onRefreshCapabilities?.(name)
        } catch (error) {
            console.error(`MCP ${name}: failed to refresh capabilities after ${label} list change:`, error)
        }
    })
}
registerRefreshHandler(ResourceListChangedNotificationSchema, "resources")
registerRefreshHandler(ToolListChangedNotificationSchema, "tools")
registerRefreshHandler(PromptListChangedNotificationSchema, "prompts")
```

This is a style nit, not a blocking issue.

### GRAY: Missing changeset

The changeset-bot flagged this PR. Since this changes user-facing behavior (suppressing notification spam, auto-refreshing capabilities), a patch changeset would be appropriate. This is a project convention issue, not a code quality issue.

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
| Build Docusaurus Site | PASS |

All 11 upstream CI checks pass.

## Code Snippets

### Core change: silencing the fallback notification handler
```typescript
// BEFORE: raw JSON-RPC shown as VS Code notification popup
client.fallbackNotificationHandler = async (notification) => {
    vscode.window.showInformationMessage(`MCP ${name}: ${JSON.stringify(notification)}`)
}

// AFTER: logged to console only
client.fallbackNotificationHandler = async (notification) => {
    console.log(`MCP ${name}: unhandled notification`, notification)
}
```

### Refresh callback wiring in McpHub
```typescript
this.kiloNotificationService.connect(name, connection.client, async (serverName) => {
    await this.fetchAvailableServerCapabilities(serverName, source)
    await this.notifyWebviewOfServerChanges()
})
```

### New notification handlers (one of three identical patterns)
```typescript
client.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
    console.log(`MCP ${name}: tools list changed, refreshing capabilities`)
    try {
        await onRefreshCapabilities?.(name)
    } catch (error) {
        console.error(`MCP ${name}: failed to refresh capabilities after tool list change:`, error)
    }
})
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**APPROVE** — This PR solves two real UX problems cleanly: (1) the annoying raw JSON-RPC notification popups on extension init and provider changes, and (2) stale MCP capability caches when servers dynamically add/remove tools, resources, or prompts. The implementation correctly uses the MCP SDK's official notification schemas (`ToolListChangedNotificationSchema`, `ResourceListChangedNotificationSchema`, `PromptListChangedNotificationSchema`), includes 346 lines of thorough test coverage, and all 11 CI checks pass. The two gray-level findings (missing `source` forwarding, DRY opportunity) are minor style/precision issues that don't affect correctness in practice. A changeset should be added before merge.
