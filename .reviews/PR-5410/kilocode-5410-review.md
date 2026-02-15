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
reviewed_at: 2026-02-15
-->

# Review: kilocode #5410

> **Support refreshing MCP tool, resources, etc lists and avoid prompts** by @lambertjosh

[Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Correctly handles all three MCP list_changed notifications per spec |
| Conventions | PASS | kilocode_change markers present in McpHub.ts |
| Changeset | FAIL | Missing changeset (changeset-bot flagged) |
| Tests | PASS | 346 lines of comprehensive tests covering all notification types |
| i18n | N/A | No user-facing strings |
| Types | PASS | Proper TypeScript types, exported callback type |
| Security | PASS | No security concerns |
| Scope | PASS | Focused: 3 files, single purpose |

## Findings

### YELLOW - Missing changeset

Changeset-bot flagged this PR. A `patch` changeset for `kilo-code` should be added describing the MCP notification handling improvement.

### YELLOW - Potential race condition in rapid notifications

If an MCP server sends `tools/list_changed`, `resources/list_changed`, and `prompts/list_changed` in quick succession, three concurrent calls to `fetchAvailableServerCapabilities` + `notifyWebviewOfServerChanges` will execute. The handlers do not debounce or serialize. If `fetchAvailableServerCapabilities` is not reentrant, this could cause inconsistent state.

```typescript
// Each handler independently calls the callback:
client.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
    await onRefreshCapabilities?.(name)  // Could overlap with resource/prompt handlers
})
```

Consider debouncing the refresh callback or queuing notifications to batch refresh all capabilities once.

### GRAY - Fallback handler silently logs instead of notifying

The previous behavior was `vscode.window.showInformationMessage(...)` for unhandled notifications, which was noisy (the original problem). The new behavior is `console.log(...)`. This is the correct fix -- unhandled MCP notifications should not create VS Code toasts. The change correctly addresses the issue shown in the PR screenshot.

### GRAY - Removed `kilocode_change` comment in NotificationService

Line 15 in the original `NotificationService.ts` had a `// kilocode_change` comment on the `data` fallback line. In the PR diff, this comment is removed. Since this is in the `src/services/mcp/kilocode/` directory (a kilocode-specific path), the marker is not strictly required, so this is acceptable.

### GRAY - Error handling pattern is consistent

Each notification handler catches and logs errors from the refresh callback, preventing a single failed refresh from breaking the notification handler chain. This is the correct pattern:

```typescript
try {
    await onRefreshCapabilities?.(name)
} catch (error) {
    console.error(`MCP ${name}: failed to refresh capabilities after tool list change:`, error)
}
```

### GRAY - Test coverage is thorough

346 lines of tests covering:
- All 4 notification handler registrations
- Fallback handler assignment
- All logging levels (info, warning, alert, error, critical, emergency)
- Logger prefix behavior
- Refresh callback invocation for all 3 list_changed types
- Error handling when callback fails
- No-callback behavior (optional parameter)
- No user notification for list changes
- Fallback handler logging without toasts

## CI Status

| Check | Result |
|-------|--------|
| compile | PASS |
| test-extension (ubuntu) | PASS |
| test-extension (windows) | PASS |
| test-jetbrains | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| test-cli | PASS |
| build-cli | PASS |
| check-translations | PASS |
| Build Docusaurus Site | PASS |

All CI checks pass.

## Code Snippets

McpHub callback wiring:
```typescript
// src/services/mcp/McpHub.ts
this.kiloNotificationService.connect(name, connection.client, async (serverName) => {
    await this.fetchAvailableServerCapabilities(serverName, source)
    await this.notifyWebviewOfServerChanges()
})
```

NotificationService type:
```typescript
// src/services/mcp/kilocode/NotificationService.ts
export type RefreshCapabilitiesCallback = (serverName: string) => Promise<void>
```

## Verdict

**APPROVE** -- This is a clean, well-tested fix for an annoying user experience problem (raw JSON-RPC notifications appearing as VS Code toasts). The implementation correctly follows the MCP specification for `tools/list_changed`, `resources/list_changed`, and `prompts/list_changed` notifications. The test coverage is exemplary at 346 lines for 62 lines of production code.

Minor items to address before merge:
1. Add a changeset (`patch` for `kilo-code`)
2. Consider debouncing rapid successive notifications (nice-to-have, not blocking)

The author acknowledges this was "vibe coded" in the description, but the result is well-structured and the test suite is comprehensive enough to validate the behavior.
