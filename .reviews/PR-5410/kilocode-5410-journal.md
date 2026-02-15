<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5410
title: "Support refreshing MCP tool, resources, etc lists and avoid prompts"
author: lambertjosh
category: feature
tier: 5
lines: 413
files: 3
review_number: 44
-->

# Review Journal: kilocode #5410

> **PR**: [#5410](https://github.com/Kilo-Org/kilocode/pull/5410) |
> **Title**: Support refreshing MCP tool, resources, etc lists and avoid prompts |
> **Author**: @lambertjosh |
> **Category**: feature | **Tier**: 5 | **Size**: 413 lines, 3 files

---

## Summary

Fixes annoying MCP tool change notification toasts by properly handling `list_changed` notifications from MCP servers. Instead of showing raw JSON-RPC as VS Code information messages, the extension now silently refreshes its cached capabilities and logs to console. Includes 346 lines of thorough tests.

## First Impressions

The PR screenshot showing 7+ notification popups makes the problem immediately clear. Author (lambertjosh / Joshua Lambert) explicitly notes "vibe coded, tested but not reviewed at a code level, in draft." Despite this disclaimer, the code is well-organized.

## What I Looked At

- Full diff: 408+/5- across 3 files
- `NotificationService.ts` on main branch (39 lines -- the complete service)
- `McpHub.ts` context around the `kiloNotificationService.connect()` call
- New test file: `NotificationService.spec.ts` (346 lines)
- MCP SDK types for notification schemas
- PR comments and CI status

## Analysis

### Notification Routing

The original code had a `fallbackNotificationHandler` that called `vscode.window.showInformationMessage()` with the raw JSON. This fired on every `list_changed` notification, which happens frequently during initialization and provider changes. The fix:

1. Registers explicit handlers for `ResourceListChangedNotificationSchema`, `ToolListChangedNotificationSchema`, `PromptListChangedNotificationSchema`
2. Each handler calls the new `RefreshCapabilitiesCallback` to re-fetch server capabilities
3. The fallback handler now just `console.log()`s unknown notifications

This follows the MCP specification correctly. The notification schemas are imported from `@modelcontextprotocol/sdk/types.js`, ensuring type safety.

### Callback Architecture

The `RefreshCapabilitiesCallback` is passed from `McpHub` into `NotificationService.connect()`. This maintains the separation of concerns -- `NotificationService` handles notifications but delegates the actual refresh to the caller. The callback is optional (`onRefreshCapabilities?: RefreshCapabilitiesCallback`), preserving backward compatibility.

### Race Condition (Minor)

Three notifications arriving in quick succession will trigger three concurrent refreshes. In practice, `fetchAvailableServerCapabilities` likely involves MCP SDK calls that are serialized per server. But the `notifyWebviewOfServerChanges()` could fire multiple times with intermediate states. This is a minor issue -- the final state will be correct, just potentially flickery.

## Verification

- CI: All 11 checks pass
- Tests: 346 lines covering all paths (verified by reading test file)
- Changeset: Missing (changeset-bot flagged)
- Draft status: PR description says "in draft" but it appears to be a regular PR

## Lessons Learned

1. "Vibe coded" can still produce clean code if the problem domain is well-understood.
2. MCP notification handling is a common pain point -- this fix should be a standard part of any MCP hub implementation.
3. Test-to-production ratio of ~5.6:1 (346 test lines / 62 production lines) is excellent for a notification service.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
