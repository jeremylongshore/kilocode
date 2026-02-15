<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 3567
title: "Kilo canvas"
author: intuitiv
category: feature
tier: 6
lines: 26496
files: 112
review_number: 63
-->

# Review Journal: kilocode #3567

> **PR**: [#3567](https://github.com/Kilo-Org/kilocode/pull/3567) |
> **Title**: Kilo canvas |
> **Author**: @intuitiv |
> **Category**: feature | **Tier**: 6 | **Size**: 26496 lines, 112 files

---

## Summary

A "Mobile Bridge" HTTP server in the VS Code extension plus a full Expo React Native mobile app. Interesting concept but critical security gaps (unauthenticated server on 0.0.0.0) and significant hygiene issues make this unmergeable in its current form. The maintainers have also signaled a pivot to a ground-up rebuild.

## First Impressions

The PR title "Kilo canvas" undersells the scope. This is actually two features: (1) an HTTP bridge server embedded in the extension, and (2) a companion mobile app. The 25K+ lines and 112 files immediately signaled a scope review would be important. The author's description is thorough and honest about the tradeoffs (direct dependency on internals). Comments show the community is interested but the maintainers have announced the rebuild pivot.

## What I Looked At

- `src/bridge/MobileBridge.ts` -- the core HTTP server implementation (486 lines)
- `src/core/webview/ClineProvider.ts` -- integration points for the bridge
- `src/extension.ts` and `src/activate/registerCommands.ts` -- activation hooks
- `.gitignore` changes and committed .expo artifacts
- `.kilocodemodes` format change (JSON to YAML)
- `apps/kilo-remote/` directory structure and key files
- `packages/types/src/global-settings.ts` -- type additions
- PR comments: author acknowledges need for auth, community member suggests web client instead of native app, maintainer redirects to rebuild

## Analysis

### Security Architecture

The bridge creates a raw `http.createServer()` with no authentication layer. The `HOST = "0.0.0.0"` binding means any device on the network can reach it. The CORS policy is `*`. The API surface includes:
- `POST /new-task` -- create agent tasks (which can execute commands)
- `POST /send-followup` -- inject messages into running tasks
- `POST /cancel-task` -- abort tasks
- `GET /tasks` -- enumerate all task history
- `POST /modes` -- switch agent modes
- `POST /tasks/:id/condense` -- trigger context condensation

This is effectively an unauthenticated remote code execution endpoint. The author acknowledges in comments that they use Tailscale for tunneling, but the code ships with no built-in protection.

### Resource Management

The SSE streaming implementation is functional but has a subtle race condition. On `TaskCompleted`, cleanup runs and then `sendStreamEnd` is called via `setTimeout(..., 100)`. If the client disconnects during that 100ms window, `req.on("close")` calls cleanup again (double cleanup is harmless due to `off` being idempotent) and then calls `sendStreamEnd`. But the timeout's `sendStreamEnd` will also fire, potentially writing to an already-ended response. The `!res.writableEnded` guard catches most cases but there is a TOCTOU window.

### Scope and Artifacts

The PR includes the .expo directory (which it also gitignores -- contradictory), a compiled APK binary, a 14K-line sample.json fixture, and a full set of React Native deployment scripts. The pnpm-lock delta is 5500 lines. The .kilocodemodes file was also reformatted from JSON to YAML with an unrelated mode addition.

## Verification

- **CI**: No checks reported on the branch. The PR has been open since November 2025 and appears to be significantly behind main.
- **Merge status**: CONFLICTING
- **No formal reviews** from maintainers
- **Maintainer comment** (kevinvandijk) redirects to the ground-up rebuild

## Lessons Learned

1. **Security-first for network-exposed features**: Any feature that opens a network socket in a developer tool must ship with auth, rate limiting, and localhost-only binding by default. The convenience of 0.0.0.0 for demo purposes creates an unacceptable attack surface.

2. **Scope management**: A 25K-line PR that includes a mobile app, deployment scripts, compiled binaries, and unrelated format changes is very difficult to review effectively. Breaking this into (a) bridge server with auth, (b) mobile app as a separate repo or PR, and (c) the .kilocodemodes change would have been much more reviewable.

3. **Project timing matters**: The maintainers' pivot to a ground-up rebuild effectively deprecates large architectural additions to the current extension. Contributors should check the project roadmap before investing in deep integrations.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
