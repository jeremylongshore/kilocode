<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5701
title: "fix(api): add type field to messages in Responses API"
author: Patel230
category: fix
tier: 2
lines: +20/-6
files: 4
verdict: APPROVE
confidence: 5
reviewed_at: 2026-02-14
linked_issue: N/A
fork_pr: N/A (batch review)
-->

# Review: kilocode #5701

> **fix(api): add type field to messages in Responses API** by @Patel230
> Multi-AI analysis: N/A (batch review) -- static analysis only

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Adds spec-allowed `type: "message"` field consistently across all handlers |
| Conventions | PASS | Follows existing code patterns |
| Changeset | PASS | `fix-responses-api-type-field.md` included (patch for @kilocode/api) |
| Tests | N/A | Mechanical field addition; no behavioral change for existing providers |
| i18n | N/A | No user-facing strings |
| Types | PASS | `type` field matches OpenAI Responses API spec |
| Security | PASS | No security surface changes |
| Scope | PASS | Same change across 3 handler files, focused fix |

## Findings

### GREEN: Consistent change across all three handlers

The same `type: "message"` addition is applied identically in:
- `openai-responses.ts` -- 3 locations (lines 247, 275, 510): user message, assistant message, and system prompt
- `openai-codex.ts` -- 2 locations (lines 447, 476): user message, assistant message
- `openai-native.ts` -- 2 locations (lines 509, 541): user message, assistant message

Total: 7 identical additions. No handler is missed.

### GREEN: Safe for lenient providers

OpenAI's Responses API allows `type: "message"` on message objects but does not require it. Adding it is a no-op for lenient providers (OpenAI, OpenRouter) and fixes strict providers (Kimi, GLM-4.7) that reject messages without the field.

### GREEN: Changeset correctly scoped

The changeset targets `@kilocode/api` (patch), which is the correct package for API provider changes.

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review |
| Lint | `pnpm lint` | NOT_RUN | Batch review |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review |

> Static analysis only. No fork branch created for this PR.

## Verdict

**APPROVE** -- Mechanical, consistent fix that adds `type: "message"` to all Responses API message objects. Safe for existing providers, fixes compatibility with strict providers (Kimi, GLM-4.7). No tests needed for a field addition that has no behavioral impact on lenient providers. Changeset included. Merge.
