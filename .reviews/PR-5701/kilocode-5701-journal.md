<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5701
title: "fix(api): add type field to messages in Responses API"
author: Patel230
category: fix
tier: 2
lines: +20/-6
files: 4
review_number: N/A
fork_pr: N/A (batch review)
-->

# Review Journal: kilocode #5701

> **PR**: [#5701](https://github.com/Kilo-Org/kilocode/pull/5701) |
> **Title**: fix(api): add type field to messages in Responses API |
> **Author**: @Patel230 |
> **Category**: fix | **Tier**: 2 | **Size**: +20/-6 lines, 4 files

---

## Summary

Adds `type: "message"` to all user and assistant message objects across three Responses API handlers (`openai-responses.ts`, `openai-codex.ts`, `openai-native.ts`). The field is allowed but optional in the OpenAI spec; strict providers like Kimi and GLM-4.7 require it. This is a safe, mechanical fix that improves provider compatibility without affecting existing behavior. APPROVE.

## What Changed

Seven identical additions of `type: "message"` spread across three handler files:

1. **`openai-responses.ts`** -- 3 locations: user message (line 247), assistant message (line 275), and the system prompt input (line 510)
2. **`openai-codex.ts`** -- 2 locations: user message (line 447), assistant message (line 476)
3. **`openai-native.ts`** -- 2 locations: user message (line 509), assistant message (line 541)

The fourth file is the changeset (`fix-responses-api-type-field.md`), which correctly targets `@kilocode/api` as a patch.

## Analysis

This is the cleanest kind of fix: adding a field that is explicitly allowed by the spec but treated as optional by some providers and required by others. The change is purely additive -- `{ role: "user", content }` becomes `{ type: "message", role: "user", content }`. No existing field is modified, no logic changes.

The consistency across all three handler files is important. If `openai-native.ts` were missed, users of strict providers through that code path would still get errors. All paths are covered.

No tests are included, which is acceptable given the mechanical nature of the change. The `type` field is a static literal, not computed, so there is no logic to test.

## Bot Review Synthesis

| Bot | Status | Key Finding | Useful? |
|-----|--------|-------------|---------|
| CodeRabbit | Not collected | Batch review | N/A |
| Gemini | Not collected | Batch review | N/A |
| Greptile | Not collected | Batch review | N/A |
| CodeQL | Not collected | Batch review | N/A |
| Qodo | Not collected | Batch review | N/A |

## Lessons Learned

- Consistent field additions across related handler files are low-risk mechanical fixes. When the same change is made identically in every handler, confidence is high.
- Some API providers enforce spec fields that others treat as optional. The safe approach is to always include spec-defined fields, even when the dominant provider (OpenAI) does not require them.

---

<sub>Batch review | Static analysis only | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
