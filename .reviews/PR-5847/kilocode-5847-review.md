<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5847
title: "Fix Kilo Quota | OpenRouter error handling and retry flow"
author: Neonsy
category: feature
tier: 5
lines: 335
files: 5
verdict: APPROVE
confidence: 4
reviewed_at: 2026-02-15
-->

# Review: kilocode #5847

> **Fix Kilo Quota | OpenRouter error handling and retry flow** by @Neonsy

[Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Fixes real user-reported error where quota exhaustion showed generic "No output generated" |
| Conventions | PASS | Uses `kilocode_change` markers, follows error handler patterns |
| Changeset | PASS | Patch changeset included |
| Tests | PASS | 107 new test lines across moonshot + error-handler specs |
| i18n | N/A | Error messages are provider-originated, not user-facing i18n keys |
| Types | PASS | No type changes needed |
| Security | PASS | No security surface changes |
| Scope | PASS | Focused on stream error escalation and error payload normalization |

## Findings

### 1. Title is misleading -- this fixes Moonshot/AI SDK stream errors, not OpenRouter/Kilo Quota (severity: gray)

The PR title says "Fix Kilo Quota | OpenRouter error handling" but the PR description and actual changes fix Moonshot stream error handling via the AI SDK path. The author notes this explicitly: "This PR focuses on the Moonshot/AI-SDK stream error path and shared error normalization hardening, not the older OpenRouter/Kilo quota branch." The title likely reflects the original branch intent before scope refinement.

### 2. Stream error escalation is the right fix (severity: gray)

The core problem: AI SDK's `fullStream` can emit `part.type === "error"` events that were silently dropped because the stream processing loop had no handler for them. Then `await result.usage` would reject with a generic "No output generated" message. The fix throws immediately on error stream parts, surfacing the real provider error:

```typescript
if (part.type === "error") {
    const streamError =
        (part as { error?: unknown }).error ??
        new Error(String((part as { message?: unknown }).message ?? "Unknown stream error"))
    throw streamError
}
```

This is correct -- error stream parts are terminal and should halt processing.

### 3. Error handler hardening is thorough (severity: gray)

The `handleProviderError` function now:
- Extracts status from `statusCode`, `status`, and AWS `$metadata.httpStatusCode`
- Digs into `responseBody`, `data`, and `cause` for nested error payloads
- Replaces generic "No output generated" messages with actual provider messages when available
- Preserves structured `errorDetails` for retry/backoff logic

The `extractErrorPayload` utility handles both string and object payloads with safe JSON parsing. The `getFirstNonEmptyString` helper prioritizes nested error messages over root-level ones.

### 4. Try/catch wrapping preserves tool stream behavior (severity: gray)

The entire stream processing loop and `await result.usage` are wrapped in a single try/catch that calls `handleProviderError`. Importantly, the tool-input accumulation/flush logic remains unchanged within the try block. This is a clean refactor that adds error handling without modifying the happy path.

### 5. The NO_OUTPUT_GENERATED_MESSAGE constant could be fragile (severity: gray)

The error handler checks if the message includes the exact string "No output generated. Check the stream for errors." to decide whether to prefer nested provider messages. If the AI SDK changes this message, the fallback would stop working. However, the consequence of this check failing is only that users would see the generic message -- the same behavior as before this PR. So this is a progressive enhancement, not a regression risk.

## CI Status

| Check | Result |
|-------|--------|
| compile | PASS |
| test-extension (ubuntu) | PASS |
| test-extension (windows) | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| test-cli | PASS |
| test-jetbrains | PASS |
| build-cli | PASS |
| check-translations | PASS |

## Code Snippets

Error payload extraction priority chain:

```typescript
const nestedMessage = responsePayload.message ?? nestedPayload.message
let msg = metadataRaw || nestedMessage || error.message || ""

// AI SDK can emit generic "No output generated" while nested payload has the real failure.
if (msg.includes(NO_OUTPUT_GENERATED_MESSAGE) && nestedMessage) {
    msg = nestedMessage
}
```

Before/after user experience (from Discord user @smetanokr):

```
// Before: "No output generated. Check the stream for errors."
// After:  "403 - moonshot streaming error: You've reached your usage limit..."
```

## Verdict

**APPROVE** -- This is a well-targeted fix for a real user-reported issue. The stream error escalation correctly handles AI SDK error parts that were being silently dropped. The error handler hardening is thorough and preserves backwards compatibility. All CI checks pass. A Discord user confirmed the fix produces actionable error messages instead of generic ones. The misleading title is cosmetic and does not affect the code quality.
