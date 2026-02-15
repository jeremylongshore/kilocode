<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5009
title: "feat: Add Cloud run mode to Agent Manager"
author: marius-kilocode
category: feat
tier: 3
lines: 829
files: 10
verdict: REQUEST_CHANGES
confidence: 4
reviewed_at: 2026-02-14
linked_issue: none
fork_pr: none
-->

# Review: kilocode #5009

> **feat: Add Cloud run mode to Agent Manager** by @marius-kilocode
> Solo analysis -- Kilo-internal feature, no kilocode_change markers needed

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | FAIL | `runAuthInTerminal` is undefined -- runtime crash (see RED finding) |
| Conventions | PASS | Follows existing Agent Manager patterns, proper i18n keys |
| Changeset | PASS | Minor changeset for `kilo-code` |
| Tests | WARN | Good CloudAgentService tests, but git tests placed outside describe block |
| i18n | FAIL | CI `check-translations` fails -- new keys not translated in all locales |
| Types | PASS | Comprehensive Zod schemas, clean TS types |
| Security | WARN | `initiateSession` and `sendMessage` lack auth tokens |
| Scope | PASS | Focused cloud agent integration across 10 files |
| Merge | FAIL | Merge conflicts (`DIRTY` state), needs rebase |

## Findings

### RED: `runAuthInTerminal()` does not exist -- runtime crash

`AgentManagerProvider.ts` (diff line 334) -- When a user without a valid `kilocodeToken` selects Cloud mode and tries to start a session, the code calls `this.runAuthInTerminal()`:

```typescript
.then((selection) => {
    if (selection === loginLabel) {
        this.runAuthInTerminal()
    }
})
```

This method does not exist on the `AgentManagerProvider` class. It is not defined anywhere in the codebase or in the PR diff. This will throw a runtime `TypeError: this.runAuthInTerminal is not a function` when a user clicks the "Run kilocode auth" button in the warning dialog.

The PR is likely based on a version of main that had this method, but it has since been refactored or removed. The PR needs to be rebased and this method call replaced with whatever the current auth flow uses. Looking at the existing `handleStartSessionApiFailure` method, the auth error handling uses a different pattern -- it shows a warning message with action buttons but does not invoke a terminal auth method.

### RED: Webview never handles `cloudSessionStarted` -- form stuck in loading state forever

`SessionDetail.tsx` sets `setIsStarting(true)` before sending the cloud session message. On success, the provider sends `agentManager.cloudSessionStarted` back to the webview, but `useAgentManagerMessages.ts` has NO handler for this message type. The message is silently dropped.

Result: After a successful cloud session start, the "Start" button stays in a loading/disabled state permanently. The user must reload the extension to recover.

The PR needs to add a handler in `useAgentManagerMessages.ts` for both `agentManager.cloudSessionStarted` (to reset loading state and potentially navigate to the session) and `agentManager.requiresLogin` (to reset loading state).

### YELLOW: Cloud session ignores user-selected mode and model

`SessionDetail.tsx` sends the cloud session message with only `prompt`:

```typescript
vscode.postMessage({
    type: "agentManager.startCloudSession",
    prompt: trimmedPrompt,
})
```

But the regular `startSession` message includes `model`, `mode`, `images`, `yoloMode`, and other fields. The provider handler defaults to `"code"` mode and `"claude-sonnet-4-20250514"` model:

```typescript
const mode = (message.mode as ...) ?? "code"
const model = (message.model as string) ?? "claude-sonnet-4-20250514"
```

If the user selects "architect" mode or a different model in the Agent Manager UI, those selections are silently ignored. The webview should forward `effectiveModeSlug` and `effectiveModelId` in the cloud message.

### YELLOW: `initiateSession` and `sendMessage` lack authentication

`CloudAgentService.ts` -- `prepareSession()` correctly includes `Authorization: Bearer ${token}`, but `initiateSession()` and `sendMessage()` send requests with no auth header:

```typescript
async initiateSession(cloudAgentSessionId: string): Promise<CloudAgentInitiateResponse> {
    const response = await fetch(getCloudAgentInitiateUrl(), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        // No Authorization header
```

If the backend requires authentication on these endpoints, the calls will fail with 401. If the session ID serves as implicit auth (bearer-less), this is a security concern since session IDs could be guessable or leaked in logs (the code logs `cloudAgentSessionId` to the output channel). Either way, this inconsistency deserves clarification.

### YELLOW: CI failures -- `check-translations` and `test-extension`

| CI Check | Status |
|----------|--------|
| compile | PASS |
| build-cli | PASS |
| test-cli | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| test-jetbrains | PASS |
| Build Docusaurus Site | PASS |
| check-translations | FAIL |
| test-extension (ubuntu) | FAIL |
| test-extension (windows) | FAIL |
| unit-test | SKIPPED |

The `check-translations` failure is expected: new i18n keys (`cloudRequiresLogin`, `cloudSessionFailed`, `noGitUrl`, `cloudSessionStarted`) are added to `en/kilocode.json` but not to other locale files. The webview-side `runModeCloud` key appears in all locales (already on main), so only the provider-side keys need translation.

### GRAY: Git tests placed outside `describe` block

`src/utils/__tests__/git.spec.ts` -- The two new test cases are added at the top level between the `describe("extractRepositoryName")` and `describe("getWorkspaceGitInfo")` blocks:

```typescript
}) // end of describe("extractRepositoryName")

it("should extract repository name from SSH URL with custom alias", () => {
    // ...
})
```

These should be inside the `describe("extractRepositoryName")` block for proper test organization. They will still run (vitest supports top-level `it`), but they will not appear under the correct group in test output.

### GRAY: `new CloudAgentService()` instantiated per call

`AgentManagerProvider.ts` creates a new `CloudAgentService()` instance on every `handleStartCloudSession` call. Since the service is stateless (no instance properties), this is functionally fine but wasteful. Consider making it a class member or using a module-level singleton.

## CI Status

| Check | Result |
|-------|--------|
| compile | PASS |
| build-cli | PASS |
| test-cli | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| test-jetbrains | PASS |
| Build Docusaurus Site | PASS |
| check-translations | FAIL |
| test-extension (ubuntu) | FAIL |
| test-extension (windows) | FAIL |
| unit-test | SKIPPED |
| storybook-playwright-snapshot | SKIPPED |

3 failures, 2 skipped, 7 pass.

## Local Verification

Not performed -- PR has merge conflicts (DIRTY state) preventing local merge. The `runAuthInTerminal` undefined reference would cause TypeScript compilation to fail regardless.

## Code Snippets

### Cloud session flow (provider side):
```typescript
// AgentManagerProvider.ts -- handleStartCloudSession
const cloudAgentService = new CloudAgentService()
if (!cloudAgentService.hasValidToken(kilocodeToken)) {
    this.postMessage({ type: "agentManager.requiresLogin" })
    // ... shows warning, calls this.runAuthInTerminal() <-- UNDEFINED
    return
}
// ... prepare -> initiate -> postMessage cloudSessionStarted
```

### Missing webview handler:
```typescript
// useAgentManagerMessages.ts -- these types are NOT handled:
// "agentManager.cloudSessionStarted"  --> silently dropped
// "agentManager.requiresLogin"        --> silently dropped
```

### Cloud message missing fields:
```typescript
// SessionDetail.tsx -- sends only prompt
vscode.postMessage({
    type: "agentManager.startCloudSession",
    prompt: trimmedPrompt,
    // Missing: model, mode, images, yoloMode
})
```

## Verdict

**REQUEST_CHANGES** -- The concept is sound and the architecture is well-structured (Zod schemas, separate service layer, proper types). However, there are two blocking issues: (1) `runAuthInTerminal()` is undefined and will crash at runtime when unauthenticated users try to use cloud mode, and (2) the webview never handles the `cloudSessionStarted` response, leaving the form permanently stuck in loading state after a successful cloud session start. Additionally, the PR has merge conflicts and CI failures that need resolution. After rebase and fixing the runtime issues, this would be a solid addition.
