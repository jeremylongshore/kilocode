<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5370
title: "fix: preserve original line_ranges format in API history for anthropic-provider"
author: eliasyin
category: fix
tier: 3
lines: 59
files: 4
confidence: 4
verdict: COMMENT
reviewed_at: 2026-02-15
linked_issue: null
fork_pr: https://github.com/jeremylongshore/kilocode/pull/13
-->

## Review Summary

| Aspect | Assessment |
|--------|------------|
| **Verdict** | COMMENT |
| **Confidence** | 4/5 |
| **Blocking Issues** | 1 (needs rebase) |
| **Non-blocking Issues** | 2 |

> Multi-AI analysis: [Fork PR](https://github.com/jeremylongshore/kilocode/pull/13) reviewed by CodeRabbit, Gemini, Qodo

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | `rawInput` preserves original API format without breaking existing behavior |
| Conventions | PASS | Follows existing patterns — `originalName` field uses same preservation strategy |
| Changeset | MISSING | No changeset included — needs one for `kilo-code` (patch) |
| Tests | PASS | Author included test verifying `rawInput` preserves `line_ranges` tuple format |
| i18n | N/A | No user-facing strings |
| Types | NEEDS REBASE | `NotificationService.ts:13` type error — pre-existing on this branch, upstream main compiles clean |
| Security | PASS | No credential exposure, no new attack surface |
| Scope | PASS | Well-scoped — 4 files, each with a clear role |

## Findings

### 1. Needs rebase against current main (blocking)

The branch was created from an older commit. `pnpm check-types` fails with:

```
services/mcp/kilocode/NotificationService.ts(13,39): error TS2339:
Property 'message' does not exist on type '{ level: ... }'
```

This error does NOT exist on current upstream main (22/22 packages pass). The PR needs a rebase to pick up the fix.

**Impact**: No upstream CI ran (`no checks reported on the 'fix/preserve-line-ranges-in-history' branch`). Without CI, maintainers can't verify the PR passes. Rebasing will trigger CI automatically.

### 2. Missing changeset (non-blocking)

No changeset included. This modifies `Task.ts` behavior (how tool inputs are saved to conversation history), which affects the `kilo-code` package. A patch changeset is needed.

### 3. Fallback chain order matters (non-blocking, observation)

The new fallback in `Task.ts:3559`:
```typescript
const input = toolUse.rawInput || toolUse.nativeArgs || toolUse.params
```

`rawInput` is only populated for native tool calls (via `NativeToolCallParser.parseToolCall`). XML-parsed tool calls won't have it, falling through to `nativeArgs` or `params`. This is correct — but worth confirming that non-native tool calls don't regress. The existing test suite (7524 tests) passes, which covers this.

## Local Verification

We merged this PR on our fork and ran the full test suite.

### Regression (existing tests)

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | FAIL | 19/20 pass — `NotificationService.ts` error (pre-existing on this branch, not from PR changes; upstream main passes 22/22) |
| Lint | `pnpm lint` | PASS | 16/16 packages |
| Unit Tests | `pnpm test --continue` | PASS | 7,524 tests, 0 failures |

**Why check-types fails but we're not blocking on it**: The type error is in `services/mcp/kilocode/NotificationService.ts`, which this PR does not touch. Current upstream main compiles clean (22/22). The PR just needs a rebase to pick up the fix. This is standard for stale branches in active monorepos.

### Behavioral (author's test)

| Test Case | Expected | Result |
|-----------|----------|--------|
| `rawInput` preserves `line_ranges: [[1920, 1990]]` | Original tuple format retained | PASS |
| `nativeArgs` converts to `lineRanges: [{start, end}]` | Converted object format for runtime | PASS |

> Tested on fork branch [`review/PR-5370`](https://github.com/jeremylongshore/kilocode/tree/review/PR-5370)

## CI Status

| Check | Result |
|-------|--------|
| Upstream CI | NO CHECKS (branch too stale, needs rebase to trigger) |
| Fork CI | [PR #13](https://github.com/jeremylongshore/kilocode/pull/13) |
| Local verification | PASS (lint + tests), FAIL (check-types, pre-existing) |

## Code Analysis

### Architecture

The fix adds a `rawInput` field to preserve the original API parameter format before internal transformations:

1. `tools.ts` — Adds `rawInput?: Record<string, unknown>` to `ToolUse` interface
2. `NativeToolCallParser.ts` — Populates `rawInput` with pre-transformation `args`
3. `Task.ts` — Prefers `rawInput` when saving tool calls to conversation history

The key insight: the Anthropic API sends `line_ranges: [[1, 50]]` (snake_case, tuples). Internal processing converts to `lineRanges: [{start: 1, end: 50}]` (camelCase, objects). Without `rawInput`, the converted format gets saved back to conversation history, causing format inconsistency on subsequent API calls.

### Design Assessment

- Clean separation: `rawInput` stores originals, `nativeArgs` stores transformed, `params` stores legacy
- Backward compatible: only populated for native tool calls, no impact on XML-parsed tools
- Test coverage: author included a targeted test proving the preservation works

## Verdict

**COMMENT** — The fix is well-designed and solves a real format inconsistency issue. The code passes all tests and follows existing patterns. However, the branch needs a rebase against current main to resolve the pre-existing type error and trigger upstream CI. A changeset is also needed. Once rebased, this should be a straightforward approval.

---
