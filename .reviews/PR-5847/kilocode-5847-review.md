<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5847
title: "Fix Kilo Quota | OpenRouter error handling and retry flow"
author: Neonsy
category: fix
tier: 5
lines: 335
files: 5
verdict: APPROVE
confidence: 4
reviewed_at: 2026-02-14
linked_issue: N/A
fork_pr: N/A
-->

# Review: kilocode #5847

> **Fix Kilo Quota | OpenRouter error handling and retry flow** by @Neonsy
> Review #44 -- code-level analysis of error normalization and AI SDK stream error surfacing

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Stream error parts correctly intercepted and routed through `handleProviderError` |
| Conventions | PASS | Uses `// kilocode_change` markers throughout, follows project patterns |
| Changeset | PASS | Patch changeset included (`slow-pillows-tap.md`) |
| Tests | PASS | 4 new test cases cover stream error parts, usage rejection, statusCode, responseBody, AWS metadata |
| i18n | N/A | No user-facing strings added |
| Types | PASS | No new type exports; internal helper types are well-scoped |
| Security | PASS | No secrets, no user input exposure |
| Scope | PASS | Focused on Moonshot/AI SDK error path + shared error normalization |
| Backward Compat | PASS | Existing `status` field extraction still works; new `statusCode`/`$metadata` paths are additive |

## Findings

### GREEN: Stream error interception is correct and well-placed

`openai-compatible.ts` -- The `part.type === "error"` check before all other stream part handlers ensures terminal errors are caught immediately rather than silently dropped. The error is re-thrown and caught by the outer `try/catch`, which routes through `handleProviderError`. This is the right pattern.

```typescript
if (part.type === "error") {
    const streamError =
        (part as { error?: unknown }).error ??
        new Error(String((part as { message?: unknown }).message ?? "Unknown stream error"))
    throw streamError
}
```

The fallback chain (`part.error` -> `part.message` -> `"Unknown stream error"`) is defensive and handles edge cases where the AI SDK might vary the error shape.

### GREEN: Error payload extraction is thorough

`error-handler.ts` -- The new `extractErrorPayload()` function handles all three container shapes the AI SDK and providers can use:
- `responseBody` (Moonshot/Kimi)
- `data` (some OpenAI-compatible providers)
- `cause` (nested error chains)

It also handles the case where `responseBody` is a JSON string vs. an object, with `safeJsonParse`. The message priority chain checks `nestedError.message` -> `root.message` -> `root.detail` -> `root.error_description` -> string `root.error`, which covers all common provider response formats.

### GREEN: Generic message replacement is smart

```typescript
if (msg.includes(NO_OUTPUT_GENERATED_MESSAGE) && nestedMessage) {
    msg = nestedMessage
}
```

The AI SDK emits `"No output generated. Check the stream for errors."` as a generic wrapper. This logic prefers the nested provider-specific message (e.g., "You've reached your usage limit") when the top-level message is generic. This is exactly what the user-reported bug needed -- the before/after screenshots in the PR comments confirm it.

### GREEN: Status resolution covers all provider shapes

`resolveErrorStatus()` checks `error.status` -> `error.statusCode` -> `error.$metadata.httpStatusCode`, covering:
- Standard OpenAI-compatible SDKs (`status`)
- AI SDK stream errors (`statusCode`)
- AWS Bedrock errors (`$metadata.httpStatusCode`)

This is additive -- existing `error.status` paths still work first.

### GREEN: Blast radius is contained

Only `MoonshotHandler` extends `OpenAICompatibleHandler`. The `handleProviderError` changes in `error-handler.ts` are used by `openai-error-handler.ts` (which delegates to it), `mistral.ts`, and `anthropic.ts`. The changes are backward-compatible: existing errors with `.status` still resolve correctly since `resolveErrorStatus()` checks `.status` first. Errors without `responseBody`/`data`/`cause` produce empty payloads from `extractErrorPayload()`, leaving behavior unchanged.

### GRAY: `errorDetails` type is `unknown`

The `errorDetails` field on the wrapped error is typed `unknown` (via `ExtractedErrorPayload`). This is fine for runtime since `Task.backoffAndAnnounce()` already treats it as `any`, but it means `errorDetails` could be any shape depending on the provider. Not a blocker -- the consuming code already uses duck typing with `.find()`.

### GRAY: Test naming vs PR title mismatch

The PR title says "Fix Kilo Quota | OpenRouter error handling" but the actual fix is for Moonshot/Kimi via the AI SDK OpenAI-compatible stream path. The PR body clarifies this, and the author noted it in the final note. Not actionable, just worth noting for traceability.

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
| Build Markdoc Site | PASS |

All 11 upstream CI checks pass.

## Code Snippets

### Stream error interception (openai-compatible.ts):
```typescript
try {
    for await (const part of result.fullStream) {
        // AI SDK error stream parts are terminal and should be surfaced as provider errors.
        if (part.type === "error") {
            const streamError =
                (part as { error?: unknown }).error ??
                new Error(String((part as { message?: unknown }).message ?? "Unknown stream error"))
            throw streamError
        }
        // ... existing tool-input and stream part handling ...
    }
    // ... flush pending tool inputs, yield usage ...
} catch (error) {
    throw handleProviderError(error, this.config.providerName, { messagePrefix: "streaming" })
}
```

### Error payload extraction (error-handler.ts):
```typescript
function extractErrorPayload(payload: unknown): ExtractedErrorPayload {
    // Handles: null, string (JSON-parseable or raw), nested objects
    // Returns: { message?, errorDetails?, status? }
}

function resolveErrorStatus(error: any, fallbackStatus?: number): number | undefined {
    // Priority: error.status -> error.statusCode -> error.$metadata.httpStatusCode -> fallback
}
```

### Downstream consumption (Task.ts backoffAndAnnounce):
```typescript
if (error?.status === 429) {
    const retryInfo = error?.errorDetails?.find(
        (d: any) => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
    )
    // Uses retryDelay for backoff
}
if (error.status) {
    headerText = `${error.status}\n${errorMessage}`
}
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**APPROVE** -- This PR fixes a real user-facing bug where Moonshot/Kimi quota errors were surfaced as unhelpful "No output generated. Check the stream for errors." messages. The fix correctly intercepts AI SDK `error` stream parts, normalizes error payloads from multiple provider shapes, and preserves HTTP status codes and structured details for the retry/backoff/UI pipeline. The implementation is backward-compatible with all existing callers, the blast radius is limited to `MoonshotHandler` (the only `OpenAICompatibleHandler` subclass), and the new test coverage validates the key error paths. Community confirmation from @smetanokr with before/after screenshots provides strong evidence the fix works as intended.
