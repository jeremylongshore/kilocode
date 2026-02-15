<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 3567
title: "Kilo canvas"
author: intuitiv
category: feature
tier: 6
lines: 26496
files: 112
verdict: REQUEST_CHANGES
confidence: 4
reviewed_at: 2026-02-15
-->

# Review: kilocode #3567

> **Kilo canvas** by @intuitiv

[Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Summary

Introduces a "Mobile Bridge" -- an HTTP server embedded in the VS Code extension that exposes Kilo Code's task API over the network, plus a companion React Native (Expo) mobile app called "Kilo Canvas." The concept is appealing but the implementation has critical security gaps, scope concerns, and several hygiene issues that must be resolved before merge. The maintainers have also announced a ground-up extension rebuild, which affects the long-term viability of deeply coupled features like this.

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | Concern | Bridge binds to 0.0.0.0 with no auth; server lifecycle has edge cases |
| Conventions | Fail | Missing kilocode_change markers in src/ files; .kilocodemodes format changed from JSON to YAML |
| Changeset | Fail | No changeset included |
| Tests | Fail | No tests for MobileBridge.ts; only ClineProvider spec tweaks for mock adjustments |
| i18n | N/A | No user-facing strings added to extension i18n |
| Types | Pass | Types added to global-settings.ts and vscode.ts are clean |
| Security | Fail | HTTP server on 0.0.0.0 with no authentication, CORS wildcard, no rate limiting |
| Scope | Concern | 25k+ lines, includes entire React Native app, .expo artifacts committed |

## Findings

### 1. (Red) HTTP server binds to 0.0.0.0 with zero authentication
**File:** `src/bridge/MobileBridge.ts:8`
```typescript
const HOST = "0.0.0.0"
```
The bridge listens on all network interfaces with no authentication mechanism whatsoever. Any device on the same network can create tasks, send follow-up messages, cancel tasks, list task history, switch modes, and trigger context condensation. Combined with `Access-Control-Allow-Origin: *`, this is a remote code execution vector (via `execute_command` tool). An auth token handshake is mandatory before this can ship.

### 2. (Red) No rate limiting on any endpoint
The HTTP server processes all incoming requests without throttling. A malicious actor (or a buggy client) could flood `/new-task` to spawn unlimited agent tasks, each consuming API credits and potentially executing code via tools.

### 3. (Red) .expo directory committed to repo
**Files:** `.expo/README.md`, `.expo/settings.json`
The `.expo` directory is machine-specific and should never be committed. The PR's own `.gitignore` addition ignores `.expo/` going forward, but the files themselves are still added to the tree.

### 4. (Yellow) .kilocodemodes reformatted from JSON to YAML -- unrelated to feature
**File:** `.kilocodemodes`
The entire file was rewritten from JSON to YAML format and a new `frontend-specialist` mode was added. This is an unrelated change that should be a separate PR. It also removes the established JSON format which other tooling may depend on.

### 5. (Yellow) No changeset present
The PR introduces a new feature with significant scope but lacks a `.changeset/*.md` file. Per project conventions, this is required for version bumping.

### 6. (Yellow) No kilocode_change markers in modified src/ files
Changes to `ClineProvider.ts`, `webviewMessageHandler.ts`, `registerCommands.ts`, and `extension.ts` lack the required `// kilocode_change` markers for fork management.

### 7. (Yellow) Large sample.json (14,157 lines) committed as an app asset
**File:** `apps/kilo-remote/assets/sample.json`
A 14K-line JSON fixture is committed as a mobile app asset. This inflates the repo significantly for what appears to be test/demo data.

### 8. (Yellow) Compiled APK committed to version control
**File:** `apps/kilo-remote/app-release.apk`
Binary artifacts should not be committed to source control. They should be managed through releases or a separate distribution mechanism.

### 9. (Gray) pnpm-lock.yaml delta is ~5500 lines
The lockfile delta (+4815/-735) is substantial, reflecting the addition of Expo/React Native dependencies. This is expected for a mobile app addition but significantly increases the monorepo's dependency surface.

### 10. (Gray) SSE stream resource cleanup edge cases
In `MobileBridge.ts`, if the client disconnects during the SSE stream while `sendStreamEnd` is already in a `setTimeout` callback (100ms delay on TaskCompleted), the `cleanup()` call from `req.on("close")` races with the timeout callback. The timeout could fire after cleanup removes the listeners but before the response is ended.

## CI Status

| Check | Result |
|-------|--------|
| CI | No checks reported on branch |

## Verdict

**REQUEST_CHANGES** -- The feature concept has merit, but the security posture is disqualifying. An unauthenticated HTTP server on 0.0.0.0 that can execute arbitrary commands via the agent is a critical vulnerability. Additionally: no tests for the bridge, no changeset, .expo artifacts committed, an APK binary in the repo, missing fork markers, and an unrelated .kilocodemodes format change. The maintainers have also signaled a pivot to a ground-up rebuild, which further reduces the case for merging a deeply-coupled feature into the current extension. Recommend: (1) add token-based auth, (2) bind to 127.0.0.1 by default with explicit opt-in for network access, (3) add rate limiting, (4) strip committed artifacts, (5) add tests, (6) add changeset and fork markers, (7) separate the .kilocodemodes change.
