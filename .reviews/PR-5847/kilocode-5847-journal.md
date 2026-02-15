<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5847
title: "Fix Kilo Quota | OpenRouter error handling and retry flow"
author: Neonsy
category: fix
tier: 5
lines: 335
files: 5
review_number: 44
fork_pr: N/A
-->

# Review Journal: kilocode #5847

> **PR**: [#5847](https://github.com/Kilo-Org/kilocode/pull/5847) |
> **Title**: Fix Kilo Quota | OpenRouter error handling and retry flow |
> **Author**: @Neonsy |
> **Category**: fix | **Tier**: 5 | **Size**: 335 lines, 5 files

---

## Summary

Moonshot/Kimi users hitting quota limits were seeing a generic "No output generated. Check the stream for errors." message instead of the actual provider error (e.g., "You've reached your usage limit"). The root cause: AI SDK `error` stream parts from `fullStream` were not handled in `OpenAICompatibleHandler`, and `await result.usage` would throw a generic wrapper error that obscured the real provider message. This PR fixes both paths and hardens the shared `handleProviderError` utility to extract meaningful messages from nested error payloads.

## First Impressions

The PR title mentions "Kilo Quota | OpenRouter" but the body immediately clarifies this is about Moonshot/Kimi via the AI SDK OpenAI-compatible stream path. The mismatch is likely because the PR evolved from an earlier direction. The body is exceptionally well-written -- it explains the failure chain step by step, identifies exactly where each fix goes, and provides clear test instructions. This is the kind of PR description that makes reviewing efficient.

## What I Looked At

- `src/api/providers/openai-compatible.ts` -- The `createMessage` streaming loop and new try/catch wrapper
- `src/api/providers/utils/error-handler.ts` -- The `handleProviderError` function and four new helper functions
- `src/api/providers/__tests__/moonshot.spec.ts` -- Two new test cases for stream error and usage rejection
- `src/api/providers/utils/__tests__/error-handler.spec.ts` -- Three new test cases for statusCode, responseBody, and AWS metadata
- `src/api/providers/utils/openai-error-handler.ts` -- Backward-compatibility wrapper (delegates to `handleProviderError`)
- `src/core/task/Task.ts` -- The `backoffAndAnnounce()` method that consumes `error.status` and `error.errorDetails`
- Inheritance tree: only `MoonshotHandler` extends `OpenAICompatibleHandler`
- Upstream CI: 11/11 green
- Community comment from @smetanokr with before/after screenshots

## Analysis

### The Failure Chain (Before)

```
1. Provider returns 403 with quota message in response body
2. AI SDK fullStream emits: { type: "error", error: { statusCode: 403, responseBody: {...} } }
3. OpenAICompatibleHandler's for-await loop has no case for type "error"
4. Error part is silently dropped (not yielded, not thrown)
5. await result.usage throws: "No output generated. Check the stream for errors."
6. This generic error propagates to Task, which shows it in the UI
7. User sees: "No output generated. Check the stream for errors." -- useless
```

### The Fix (After)

```
1. Same provider response
2. Same AI SDK stream part
3. NEW: type "error" check throws immediately, re-throwing the original error object
4. Outer try/catch routes through handleProviderError()
5. handleProviderError() now:
   a. Extracts status from statusCode (not just status)
   b. Parses responseBody to find nested provider message
   c. Replaces generic "No output generated" with real message
   d. Preserves errorDetails for retry logic
6. Task.backoffAndAnnounce() receives: { status: 403, message: "...: You've reached your limit...", errorDetails: [...] }
7. User sees: "403\nmoonshot streaming error: You've reached your usage limit..."
```

### Why This Works

The key insight is that `handleProviderError` needed two improvements:

1. **Status resolution**: The AI SDK uses `statusCode` (not `status`) on its error objects. Adding `resolveErrorStatus()` with a priority chain means the HTTP status code is preserved regardless of which SDK convention the error follows.

2. **Message extraction**: Provider errors nest the real message inside `responseBody.error.message`. The new `extractErrorPayload()` function digs into these structures and returns the actual message. The "No output generated" replacement logic then swaps the generic AI SDK message for the real one.

### Backward Compatibility

I traced every caller of `handleProviderError`:
- `openai-error-handler.ts` delegates directly -- gets the improvements for free
- `mistral.ts` and `anthropic.ts` call it directly -- their errors already have `.status` which resolves first in the priority chain
- `Task.backoffAndAnnounce()` consumes `.status` and `.errorDetails` -- both fields are populated the same way (or better, since statusCode is now also resolved)

No behavioral change for errors that already had `.status` set correctly. The new paths (`.statusCode`, `.$metadata.httpStatusCode`, `responseBody` extraction) only activate when the old paths produce nothing.

### Test Coverage

The four new tests hit the key scenarios:
1. Stream `error` part with `statusCode` + `responseBody` -> normalized error with status and details
2. Usage rejection with generic message + nested provider context -> real message surfaced
3. `statusCode` field preserved as `status` on wrapped error
4. AWS `$metadata.httpStatusCode` fallback

These directly test the failure modes described in the bug report.

## Verification

### Upstream CI
All 11 checks pass including compile, all test suites (extension, CLI, webview, JetBrains), and markdoc build.

### Community Confirmation
@smetanokr provided before/after screenshots showing:
- **Before**: "No output generated. Check the stream for errors."
- **After**: "403\nmoonshot streaming error: You've reached your usage limit for this billing cycle."

### What We Could Not Verify
- Other OpenAI-compatible providers that might emit `error` stream parts (only Moonshot confirmed)
- Edge cases where `responseBody` is a non-JSON string (handled by `safeJsonParse` returning the raw string)

## Diagrams

```
Error Flow: Before vs After
===========================

BEFORE:
  AI SDK fullStream --> { type: "error", error: {...} }
                              |
                              v
                         [NO HANDLER]  --> silently dropped
                              |
                              v
                         await result.usage
                              |
                              v
                         throws: "No output generated..."
                              |
                              v
                         Task.backoffAndAnnounce()
                              |
                              v
                         User sees generic error

AFTER:
  AI SDK fullStream --> { type: "error", error: {...} }
                              |
                              v
                         throw error  --> caught by try/catch
                              |
                              v
                         handleProviderError()
                          |-- resolveErrorStatus() --> 403
                          |-- extractErrorPayload() --> "You've reached your limit..."
                          +-- replace generic msg --> real provider message
                              |
                              v
                         Task.backoffAndAnnounce()
                          |-- status: 403 --> status-aware UI
                          +-- message: actionable error text
                              |
                              v
                         User sees: quota exceeded with upgrade link
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

1. **AI SDK error stream parts are not optional** -- The `fullStream` async iterable can emit `{ type: "error" }` parts that represent terminal provider failures. Not handling them means silently losing the real error, with `await result.usage` later throwing a generic wrapper. Every consumer of `fullStream` should check for error parts.

2. **SDK field name conventions vary** -- The AI SDK uses `statusCode` while OpenAI and Anthropic use `status`. Error handlers that only check one field will miss errors from the other. A priority chain (`status` -> `statusCode` -> `$metadata.httpStatusCode`) is the defensive approach.

3. **Generic wrapper messages need unwrapping** -- "No output generated. Check the stream for errors." is an AI SDK generic that wraps the real error. The real message lives in `responseBody.error.message` or `cause.message`. Error handlers should check for known generic messages and prefer nested alternatives when available.

4. **Community screenshots are gold for error-handling PRs** -- @smetanokr's before/after screenshots provided concrete evidence that the fix works for the reported scenario, removing any ambiguity about whether the error path was actually exercised.

---

<sub>Review #44 | Code analysis only (no fork branch) | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
