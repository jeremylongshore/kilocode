<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5847
title: "Fix Kilo Quota | OpenRouter error handling and retry flow"
author: Neonsy
category: feature
tier: 5
lines: 335
files: 5
review_number: 60
-->

# Review Journal: kilocode #5847

> **PR**: [#5847](https://github.com/Kilo-Org/kilocode/pull/5847) |
> **Title**: Fix Kilo Quota | OpenRouter error handling and retry flow |
> **Author**: @Neonsy |
> **Category**: feature | **Tier**: 5 | **Size**: 335 lines, 5 files

---

## Summary

Fixes silent error dropping in AI SDK stream processing that caused Moonshot quota errors to show as generic "No output generated" messages. Hardens the shared error handler to extract nested provider error payloads. Real user confirmed the fix via before/after screenshots. Approve.

## First Impressions

Title is misleading (mentions OpenRouter/Kilo Quota) but the actual changes fix Moonshot stream errors and harden the shared error handler. The PR description is honest about the scope shift. The author explicitly notes this is not the OpenRouter quota fix.

## What I Looked At

- `src/api/providers/openai-compatible.ts` -- stream processing loop refactor with error handling
- `src/api/providers/utils/error-handler.ts` -- substantial hardening (new helper functions, nested payload extraction)
- `src/api/providers/__tests__/moonshot.spec.ts` -- regression tests for stream error parts and usage rejection
- `src/api/providers/utils/__tests__/error-handler.spec.ts` -- tests for status preservation and payload extraction
- Cross-referenced existing `handleProviderError` function on main
- Reviewed Discord user screenshots confirming the fix

## Analysis

The root cause chain:
1. Moonshot uses `OpenAICompatibleHandler` which uses AI SDK's `streamText`
2. When the provider returns a quota error, AI SDK emits a `part.type === "error"` event in `fullStream`
3. The stream processing loop had no handler for error parts -- they were dropped
4. `await result.usage` then rejects with generic "No output generated. Check the stream for errors."
5. `Task` does not handle `chunk.type === "error"` in its stream switch either

The fix addresses both layers:
- **Stream level**: Throws immediately on error parts, surfacing the real error
- **Error handler level**: Digs into `responseBody`, `data`, `cause` to extract nested provider messages and status codes

The error handler additions are substantial (80 new lines of helper code) but well-structured:
- `extractErrorPayload()` normalizes both string and object payloads
- `resolveErrorStatus()` checks `status`, `statusCode`, and `$metadata.httpStatusCode`
- `getFirstNonEmptyString()` is a clean priority-chain helper

## Verification

- All CI checks pass
- Discord user @smetanokr provided before/after screenshots showing:
  - Before: "No output generated. Check the stream for errors."
  - After: "403 - moonshot streaming error: You've reached your usage limit for this billing cycle..."
- Error handler tests cover statusCode preservation, responseBody extraction, and AWS metadata fallback

## Lessons Learned

- AI SDK error stream parts (`part.type === "error"`) are terminal events that must be handled explicitly -- they are not informational
- Error normalization needs to dig multiple levels deep since different SDKs nest error details differently
- The `NO_OUTPUT_GENERATED_MESSAGE` check is a practical workaround for AI SDK's generic error messages

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
