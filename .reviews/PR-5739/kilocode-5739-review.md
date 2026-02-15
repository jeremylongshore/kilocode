<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5739
title: "Honor explicit 'disable' for reasoning effort"
author: rayss868
category: feature
tier: 3
lines: 33
files: 2
confidence: 5
verdict: APPROVE
reviewed_at: 2026-02-15
linked_issue: null
fork_pr: https://github.com/jeremylongshore/kilocode/pull/11
-->

## Review Summary

| Aspect | Assessment |
|--------|------------|
| **Verdict** | APPROVE |
| **Confidence** | 5/5 |
| **Blocking Issues** | 0 |
| **Non-blocking Issues** | 2 |

> Multi-AI analysis: [Fork PR](https://github.com/jeremylongshore/kilocode/pull/11) reviewed by CodeRabbit, Gemini, Greptile, CodeQL, Qodo

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | `isExplicitlyDisabled` logic correctly prevents both `thinking` and `reasoning_effort` from being sent |
| Conventions | PASS | Follows existing provider patterns |
| Changeset | MISSING | No changeset included — needs one for patch bump |
| Tests | MISSING | No unit tests for the new `isExplicitlyDisabled` logic |
| Types | PASS | TypeScript compiles clean (22/22 packages) |
| Security | PASS | No credential or injection concerns |
| Scope | NOTE | PR also adds `reasoning_effort` param support (not just "disable" fix) |

## Findings

### 1. Missing changeset (non-blocking)

The changeset bot flagged this. The PR modifies behavior in both `kilo-code` (extension) and `@roo-code/vscode-webview` — a `patch` changeset is needed for both.

### 2. No unit tests for `isExplicitlyDisabled` (non-blocking)

The core logic `const isExplicitlyDisabled = effort === "disable"` is straightforward, but there are no tests covering:
- `effort === "disable"` prevents `thinking` param
- `effort === "disable"` prevents `reasoning_effort` param
- Non-"disable" values still send both params
- Fallback chain: `this.options.reasoningEffort || info.reasoningEffort`

### 3. Scope note (informational)

The PR title says "Honor explicit 'disable'" but it also adds `reasoning_effort` parameter support that was previously missing (only `thinking` was being sent). Both the `createMessage()` and `streamCompletion()` methods get this same enhancement. This is a positive addition but worth noting for the changelog.

## Local Verification

We merged this PR on our fork and ran the full test suite, plus wrote targeted tests to prove the fix works.

### Regression (existing tests)

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | PASS | 22/22 packages |
| Lint | `pnpm lint` | PASS | 18/18 packages |
| Unit Tests | `pnpm test --continue` | PASS | 7,831 tests, 0 failures |

### Behavioral (new targeted tests)

We wrote 3 tests to verify the specific fix works:

| Test Case | Expected | Result |
|-----------|----------|--------|
| `reasoningEffort: "disable"` | No `thinking` or `reasoning_effort` in API params | PASS |
| `reasoningEffort: "medium"` | Both `thinking: {type: "enabled"}` and `reasoning_effort: "medium"` sent | PASS |
| `enableReasoningEffort: false` | No reasoning params at all | PASS |

Test file: [`reasoning-effort-disable.spec.ts`](https://github.com/jeremylongshore/kilocode/blob/review/PR-5739/src/api/providers/__tests__/reasoning-effort-disable.spec.ts)

> Tested on fork branch [`review/PR-5739`](https://github.com/jeremylongshore/kilocode/tree/review/PR-5739)

## Code Analysis

### Backend (`base-openai-compatible-provider.ts`)

**Before**: When `enableReasoningEffort && supportsReasoningBinary`, always sent `thinking: { type: "enabled" }`. The "disable" option had no effect, and `reasoning_effort` was never sent.

**After**: When `enableReasoningEffort`:
1. Resolves effort from user setting or model default
2. If `effort === "disable"` — sends neither `thinking` nor `reasoning_effort`
3. If not disabled — sends `thinking` (if `supportsReasoningBinary`) and `reasoning_effort` (if `supportsReasoningEffort`)

The same fix is applied to both `createMessage()` (line 105) and `streamCompletion()` (line 247).

### UI (`OpenAICompatible.tsx`)

Adds `setApiConfigurationField("reasoningEffort", value)` to sync the reasoning effort value to the parent state handler, preventing state desync between the model info and API configuration.

## CI Status

| Check | Result |
|-------|--------|
| Upstream CI | No checks ran (branch needs rebase) |
| Fork CI | [PR #11](https://github.com/jeremylongshore/kilocode/pull/11) |
| Local verification | PASS (all tests) |

## Verdict

**APPROVE** — Logic is correct, fixes a real bug where "disable" had no effect. The `isExplicitlyDisabled` pattern is clean and handles both `thinking` and `reasoning_effort` parameters. Missing changeset and tests are non-blocking — contributor should add before merge.

---
