<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5660
title: "Use Mistral SDK in MistralHandler.streamFim"
author: wkordalski
category: refactor
tier: 3
lines: 69
files: 1
confidence: 5
verdict: REQUEST_CHANGES
reviewed_at: 2026-02-15
linked_issue: 5658
fork_pr: https://github.com/jeremylongshore/kilocode/pull/14
-->

## Review Summary

| Aspect | Assessment |
|--------|------------|
| **Verdict** | REQUEST_CHANGES |
| **Confidence** | 5/5 |
| **Blocking Issues** | 2 |
| **Non-blocking Issues** | 1 |

> Multi-AI analysis: [Fork PR](https://github.com/jeremylongshore/kilocode/pull/14) reviewed by Gemini, Qodo

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | SDK usage is correct — `this.client.fim.stream()` replaces manual fetch |
| Conventions | PASS | Follows existing pattern — other methods in `MistralHandler` already use `this.client` |
| Changeset | MISSING | No changeset included — needs one for `kilo-code` (patch) |
| Tests | FAIL | 4 test failures — existing tests mock the old `fetch()` approach, not the SDK |
| i18n | N/A | No user-facing strings |
| Types | PASS | TypeScript compiles clean (22/22 packages) |
| Security | PASS | API key handling unchanged — SDK manages auth internally |
| Scope | PASS | Single file, clean refactor |

## Findings

### 1. Existing tests broken by refactor (blocking)

The test file `api/providers/__tests__/mistral-fim.spec.ts` mocks `global.fetch` and `streamSse` — both of which this PR removes. The tests now fail because the code no longer calls `fetch()`.

**4 failures:**
- `yields chunks correctly` — mocks `fetch()` response, but code now uses `this.client.fim.stream()`
- `handles errors correctly` — expects `"FIM streaming failed: 400"` but gets `"TelemetryService not initialized"` (SDK error path is different)
- `uses correct endpoint for codestral models` — verifies `fetch()` was called with codestral URL, but `fetch()` is no longer called
- `uses custom codestral URL when provided` — same issue

**Fix needed**: Update `mistral-fim.spec.ts` to mock `this.client.fim.stream()` instead of `global.fetch`. The SDK's `Mistral` client constructor accepts options that can be mocked.

### 2. Missing changeset (blocking)

This changes the FIM streaming implementation for a provider. Needs a patch changeset for `kilo-code`.

### 3. Upstream CI has test-extension failures (non-blocking, observation)

Upstream CI shows 2 failures (`test-extension` on ubuntu + windows). These may be related to the test mocking issue or may be pre-existing flaky tests. Worth investigating after the test fixes.

## Local Verification

We merged this PR on our fork and ran the full test suite.

### Regression (existing tests)

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | PASS | 22/22 packages |
| Lint | `pnpm lint` | PASS | 18/18 packages |
| Unit Tests | `pnpm test --continue` | FAIL | 513 passed, 1 failed (`mistral-fim.spec.ts` — 4 test cases) |

**Why tests fail**: The PR replaces `fetch()` with `this.client.fim.stream()` but the test file still mocks `global.fetch` and imports `streamSse`. The mocks no longer intercept the code path. This is a test maintenance gap, not a code quality issue.

### Pre-existing failures (not from this PR)

| Package | Issue |
|---------|-------|
| `@kilocode/core-schemas` | No test files (pre-existing) |
| `@kilocode/agent-runtime` | `VSCode.applyEdit.spec.js` path issue (pre-existing) |

> Tested on fork branch [`review/PR-5660`](https://github.com/jeremylongshore/kilocode/tree/review/PR-5660)

## Code Analysis

### What the refactor does

Replaces a manual HTTP implementation with the Mistral SDK:

**Before** (manual):
```typescript
const endpoint = new URL("v1/fim/completions", baseUrl)
const headers = { ...DEFAULT_HEADERS, Authorization: `Bearer ${apiKey}` }
const response = await fetch(endpoint, { method: "POST", body: JSON.stringify({...}), headers })
for await (const data of streamSse(response)) { ... }
```

**After** (SDK):
```typescript
const response = await this.client.fim.stream({ model, prompt: prefix, suffix, ... })
for await (const ev of response) { ... }
```

The SDK handles:
- Endpoint selection (codestral vs api.mistral.ai) — via the client constructor, which already uses `mistralCodestralUrl`
- Auth headers — via the API key passed at client construction
- SSE parsing — built into the SDK's stream method
- Error handling — SDK throws typed errors

### Removed imports

Three imports removed, all replaced by SDK functionality:
- `handleProviderError` — replaced by `ApiProviderError` + telemetry
- `DEFAULT_HEADERS` — SDK manages headers
- `streamSse` — SDK handles streaming internally

### Content type handling

The PR adds proper handling for content that could be either a string or an array of content chunks:
```typescript
if (typeof content === "string") {
  yield content
} else if (content !== null && content !== undefined) {
  for (const chunk of content) {
    if (chunk.type === "text") { yield chunk.text }
  }
}
```

This is more robust than the original `if (content) { yield content }` which assumed string.

## CI Status

| Check | Result |
|-------|--------|
| Upstream CI | FAIL (2/11 — test-extension on ubuntu + windows) |
| Fork CI | [PR #14](https://github.com/jeremylongshore/kilocode/pull/14) |
| Local verification | FAIL (4 test cases in mistral-fim.spec.ts) |

## Verdict

**REQUEST_CHANGES** — The refactor itself is clean and correct. Using the SDK instead of manual HTTP is the right architectural direction — every other method in `MistralHandler` already uses `this.client`. But the existing tests need updating to mock the SDK instead of `fetch()`, and a changeset is required. Once the tests pass, this should be a straightforward approval.

---
