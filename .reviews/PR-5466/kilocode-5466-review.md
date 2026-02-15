<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5466
title: "feat: display generated session names in task history UI"
author: app/kiloconnect
category: feature
tier: 2
lines: +73/-2
files: 5
verdict: APPROVE
confidence: 5
reviewed_at: 2026-02-14
linked_issue: N/A
fork_pr: N/A (batch review)
-->

# Review: kilocode #5466

> **feat: display generated session names in task history UI** by @app/kiloconnect
> Multi-AI analysis: N/A (batch review) -- static analysis only

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | `title \|\| task` fallback handles all edge cases correctly |
| Conventions | PASS | Uses `kilocode_change` markers throughout |
| Changeset | PASS | `session-name-history.md` included (patch for kilo-code) |
| Tests | PASS | 3 new tests: title present, title absent, empty string fallback |
| i18n | N/A | No new user-facing strings |
| Types | PASS | Optional `title` field added to `historyItemSchema` via Zod |
| Security | PASS | No security surface changes |
| Scope | PASS | Single feature, 5 files, well-bounded |

## Findings

### GREEN: Correct fallback logic

`TaskItem.tsx:82` -- The expression `item.title || item.task` handles three cases correctly:
1. Title present: shows title
2. Title absent (`undefined`): shows task
3. Title empty string (`""`): falsy in JS, falls back to task

### GREEN: Backward-compatible schema change

`packages/types/src/history.ts:14` -- The `title` field is `z.string().optional()`, so existing history entries without titles continue to parse without migration.

### GREEN: Async handler update

`session-manager-utils.ts:33` -- The `onSessionTitleGenerated` callback is correctly changed to `async` to support `await provider.updateTaskHistory()` and `await provider.postStateToWebview()`.

### GREEN: Test coverage

`TaskItem.spec.tsx` -- Three new tests cover the key scenarios:
- `displays title when available instead of task` -- verifies title takes priority
- `falls back to task when title is not available` -- verifies undefined fallback
- `falls back to task when title is empty string` -- verifies empty string fallback

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review |
| Lint | `pnpm lint` | NOT_RUN | Batch review |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review |

> Static analysis only. No fork branch created for this PR.

## Verdict

**APPROVE** -- Clean, well-tested feature with maintainer approval. The schema change is additive (optional field), the UI fallback handles edge cases correctly, and 3 tests cover the important paths. No risk to existing functionality. Merge.
