<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5410
title: "Support refreshing MCP tool, resources, etc lists and avoid prompts"
author: lambertjosh
category: feature
tier: 5
lines: 413
files: 3
review_number: 47
fork_pr: N/A (batch review)
-->

# Review Journal: kilocode #5410

> **PR**: [#5410](https://github.com/Kilo-Org/kilocode/pull/5410) |
> **Title**: Support refreshing MCP tool, resources, etc lists and avoid prompts |
> **Author**: @lambertjosh |
> **Category**: feature | **Tier**: 5 | **Size**: 413 lines, 3 files

---

## Summary

This PR properly handles MCP server `list_changed` notifications (tools, resources, prompts) by auto-refreshing capabilities instead of ignoring them, and fixes the annoying fallback notification popups by routing unknown notifications to `console.log` instead of `vscode.window.showInformationMessage`. The implementation is clean, well-tested, and follows the MCP specification correctly. APPROVE with minor style suggestions.

## First Impressions

The PR title immediately signals two distinct improvements: (1) dynamic MCP capability refresh and (2) notification spam suppression. The author's description is honest — "vibe coded, tested but not reviewed at a code level, in draft." The screenshot of the offending notification popups (raw JSON-RPC messages shown to users) makes the problem viscerally clear. Three files touched, 346 of 413 lines are tests — good test-to-code ratio.

## What I Looked At

- `src/services/mcp/kilocode/NotificationService.ts` — The primary change (before: 39 lines, after: ~90 lines)
- `src/services/mcp/McpHub.ts` — Callback wiring in `connectToServer()` (5 lines changed)
- `src/services/mcp/kilocode/__tests__/NotificationService.spec.ts` — New test file (346 lines)
- `McpHub.ts` context: `fetchAvailableServerCapabilities()`, `findConnection()`, `notifyWebviewOfServerChanges()`, `connectToServer()` signature
- MCP SDK types: confirmed `ResourceListChangedNotificationSchema`, `ToolListChangedNotificationSchema`, `PromptListChangedNotificationSchema` exist in `@modelcontextprotocol/sdk@1.25.2`
- Upstream CI (11/11 green)

## Analysis

### The Problem (Two Issues)

**Issue 1: Notification spam.** The `fallbackNotificationHandler` was calling `vscode.window.showInformationMessage()` with raw JSON-RPC notification payloads. When MCP servers send `notifications/tools/list_changed`, `notifications/resources/list_changed`, etc., these hit the fallback and produce ugly popups like `MCP server-name: {"jsonrpc":"2.0","method":"notifications/tools/list_changed"}`. This happens on every extension init and provider change.

**Issue 2: Stale capabilities.** MCP servers can dynamically add/remove tools, resources, and prompts and notify clients via `list_changed` notifications (per the MCP spec). The existing code had no handlers for these, so if a server added a new tool after initial connection, Kilo Code would never see it until the server was manually restarted.

### The Fix

1. **Three new notification handlers** — `ResourceListChangedNotificationSchema`, `ToolListChangedNotificationSchema`, `PromptListChangedNotificationSchema` are now explicitly handled. Each calls the optional `onRefreshCapabilities` callback to re-fetch the server's capabilities.

2. **Callback wiring** — `McpHub.connectToServer()` passes a refresh callback that calls `fetchAvailableServerCapabilities(name)` followed by `notifyWebviewOfServerChanges()`. This is the same fetch+notify pattern used during initial connection.

3. **Fallback handler silenced** — Unknown notifications go to `console.log` instead of popup.

### Minor Concerns

**Missing `source` parameter:** The refresh callback calls `fetchAvailableServerCapabilities(serverName)` without the `source` parameter that's available in the `connectToServer` closure. The `findConnection()` fallback (project-first, then global) handles this correctly in practice, but it's slightly imprecise if a user has duplicate server names across scopes.

**DRY opportunity:** The three notification handlers are identical in structure. A helper function would reduce ~30 lines of duplication while maintaining the same behavior.

**Missing changeset:** No `.changeset/` file included. This is a user-facing behavior change that warrants a patch changeset.

### What's Done Well

- **Test coverage is excellent.** 346 lines covering all notification types, error paths, callback presence/absence, logging behavior, and fallback handler. The test setup with `notificationHandlers` map capture is a clean pattern.
- **Error handling is defensive.** Each handler wraps the callback in try/catch and logs errors without bubbling — a server notification failure won't crash the extension.
- **Optional callback pattern.** `onRefreshCapabilities?.(name)` means the `NotificationService` remains usable without the callback (e.g., in tests or alternative contexts).
- **MCP spec compliance.** Using the official SDK notification schemas rather than string-matching method names.

## Verification

### Upstream CI
All 11 checks pass — compile, build-cli, test-extension (ubuntu + windows), test-webview (ubuntu + windows), test-cli, test-jetbrains, unit-test, check-translations, Build Docusaurus Site.

### What We Verified
- SDK exports exist for all three notification schemas (confirmed in `@modelcontextprotocol/sdk@1.25.2`)
- `fetchAvailableServerCapabilities` and `notifyWebviewOfServerChanges` are the correct methods for refreshing and propagating capability changes
- The callback closure correctly captures `name` from `connectToServer` scope
- `findConnection` without `source` uses project-first fallback (safe default)

### What We Couldn't Verify
- No local test run (PR is from external contributor, would need cherry-pick)
- Actual MCP server notification behavior (requires running MCP server that dynamically changes its tool list)
- Whether `source` omission causes real-world issues (extremely unlikely edge case)

## Diagrams

```
MCP Notification Flow (Before vs After)
────────────────────────────────────────

BEFORE:
  MCP Server sends: notifications/tools/list_changed
       │
       ▼
  No matching handler → fallbackNotificationHandler
       │
       ▼
  vscode.window.showInformationMessage(JSON.stringify(...))
       │
       ▼
  User sees ugly popup ← Tool list NOT refreshed

AFTER:
  MCP Server sends: notifications/tools/list_changed
       │
       ▼
  ToolListChangedNotificationSchema handler
       │
       ├── console.log("tools list changed, refreshing capabilities")
       │
       ├── onRefreshCapabilities(serverName)
       │       ├── fetchAvailableServerCapabilities()  ← Re-fetch tools/resources
       │       └── notifyWebviewOfServerChanges()      ← Update UI
       │
       └── catch → console.error (silent failure)

  Unknown notification:
       │
       ▼
  fallbackNotificationHandler → console.log (no popup)
```

## Bot Review Synthesis

| Bot | Status | Key Finding | Useful? |
|-----|--------|-------------|---------|
| CodeRabbit | Not collected | Batch review — no individual fork PR | N/A |
| Gemini | Not collected | Batch review — no individual fork PR | N/A |
| Greptile | Not collected | Batch review — no individual fork PR | N/A |
| CodeQL | Not collected | Batch review — no individual fork PR | N/A |
| Qodo | Not collected | Batch review — no individual fork PR | N/A |

## Lessons Learned

1. **Fallback handlers need care** — A fallback that shows raw JSON-RPC to users via VS Code popups is a UX anti-pattern. Fallbacks should log silently and let explicit handlers drive user-visible behavior.
2. **MCP `list_changed` is part of the spec** — Dynamic tool/resource/prompt lists are a first-class MCP feature. Not handling these notifications means clients can't adapt to servers that change capabilities at runtime (e.g., plugin-based MCP servers, development tools that hot-reload).
3. **Test-to-code ratio matters** — 346 lines of tests for 62 lines of production code (5.6:1 ratio). The tests are structured well — capturing handler registrations via a map, then exercising each handler independently with clear assertions.
4. **"Vibe coded" can still be good** — The author's disclaimer about vibe coding undersells the quality. The implementation is clean, defensive, and well-tested. The draft status seems more about seeking review than about code quality concerns.

---

<sub>Review #47 | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
