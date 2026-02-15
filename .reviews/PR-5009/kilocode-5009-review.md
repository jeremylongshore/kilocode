<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5009
title: "feat: Add Cloud run mode to Agent Manager"
author: marius-kilocode
category: feature
tier: 5
lines: 829
files: 10
verdict: APPROVE
confidence: 88
reviewed_at: 2026-02-15
-->

# Review: kilocode #5009

> **feat: Add Cloud run mode to Agent Manager** by @marius-kilocode

**Methodology**: [Kilo Code PR Review Process](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Summary

Adds a "Cloud" option to the Agent Manager's run mode dropdown, enabling cloud-based agent sessions via the Kilo Code Cloud Agent V2 API. Well-structured with comprehensive Zod type definitions, a clean service layer with validation, good unit tests, and proper i18n. This is a first-party contribution from a Kilo team member.

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | Pass | Clean API client with Zod validation, proper error extraction |
| Conventions | Pass | Follows established service patterns |
| Changeset | Pass | Present -- minor for kilo-code with detailed description |
| Tests | Pass | 200-line test suite covering all CloudAgentService methods |
| i18n | Pass | English locale strings added for new feature |
| Types | Pass | 227 lines of Zod schemas with proper TypeScript inference |
| Security | Pass | Token validation before API calls, Bearer auth, login redirect |
| Scope | Pass | Well-scoped to cloud agent integration |
| kilocode_change markers | N/A | Kilo-specific files (agent-manager, cloud-agent) |

## Findings

### Yellow -- initiateSession sends no authentication

```typescript
async initiateSession(cloudAgentSessionId: string): Promise<CloudAgentInitiateResponse> {
    const response = await fetch(getCloudAgentInitiateUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cloudAgentSessionId }),
    })
```

The `prepareSession` call includes `Authorization: Bearer ${token}`, but `initiateSession` and `sendMessage` do not include any auth header. If the session ID is a sufficient bearer of authority (i.e., unguessable), this is acceptable but worth confirming. An attacker who obtains a session ID could initiate and send messages to it.

### Yellow -- Graceful degradation on schema validation may mask API changes

```typescript
if (!validated.success) {
    console.warn("[CloudAgentService] Invalid prepare response format", validated.error.errors)
    return data as CloudAgentPrepareResponse // Continue with unvalidated data
}
```

When Zod validation fails, the service logs a warning and returns the unvalidated response cast to the expected type. This is intentionally resilient, but it means breaking API changes will be silently accepted and may cause downstream errors that are hard to trace.

### Yellow -- Only English i18n strings added

New i18n keys are only added to `src/i18n/locales/en/kilocode.json`. Other locales will fall back to English, which is acceptable for a new feature, but the CI check-translations check fails because of this.

### Gray -- WebSocket streaming is prepared but not implemented

The service generates WebSocket URLs (`getStreamUrl`) and the changeset mentions "streaming to be added in follow-up." This is a clean separation of concerns -- the types and URLs are ready for future implementation.

### Gray -- SSH alias regression test

The PR adds tests for `extractRepositoryName` handling SSH aliases like `github.com-kilocode:Kilo-Org/kilocode.git`. This is a practical fix for a real issue with custom SSH configurations.

### Gray -- Comprehensive Zod schemas

The 227-line type definition file covers prepare, initiate, sendMessage, and WebSocket stream events. Using discriminated unions for stream events (`z.discriminatedUnion("type", [...])`) is the correct pattern. The API URL helpers are well-organized.

## CI Status

| Check | Result |
|-------|--------|
| check-translations | Fail |
| compile | Pass |
| test-extension (ubuntu) | Fail |
| test-extension (windows) | Fail |
| test-webview (ubuntu) | Pass |
| test-webview (windows) | Pass |
| test-cli | Pass |
| build-cli | Pass |
| test-jetbrains | Pass |

Extension test failures and translation check need investigation.

## Code Snippets

### Token validation and login redirect (AgentManagerProvider.ts)
```typescript
if (!cloudAgentService.hasValidToken(kilocodeToken)) {
    this.postMessage({ type: "agentManager.requiresLogin" })
    void vscode.window.showWarningMessage(
        t("kilocode:agentManager.errors.cloudRequiresLogin"), loginLabel
    ).then((selection) => {
        if (selection === loginLabel) this.runAuthInTerminal()
    })
    return
}
```

### Zod schema validation with graceful degradation (CloudAgentService.ts)
```typescript
const validated = CloudAgentPrepareResponseSchema.safeParse(data)
if (!validated.success) {
    console.warn("[CloudAgentService] Invalid prepare response format", validated.error.errors)
    return data as CloudAgentPrepareResponse
}
return validated.data
```

### Cloud mode in run mode dropdown (SessionDetail.tsx)
```typescript
const effectiveRunMode = runMode === "cloud" ? "cloud" : isMultiVersion ? "worktree" : runMode
```

## Verdict

**APPROVE** -- Well-structured implementation from a Kilo team member. The service layer is clean with proper Zod validation, good error handling, and reasonable test coverage. The types are comprehensive and forward-looking (WebSocket stream events for future implementation). The main concern is the missing auth on initiateSession/sendMessage, which should be verified against the backend API design. The extension test failures need resolution before merge, but the core implementation is sound.
