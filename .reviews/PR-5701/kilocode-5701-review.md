<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5701
title: "fix(api): add type field to messages in Responses API"
author: Patel230
category: fix
tier: 2
lines: 26
files: 4
confidence: 5
verdict: APPROVE
fork_pr: null
-->

## Review Summary

| Aspect | Assessment |
|--------|------------|
| **Verdict** | APPROVE |
| **Confidence** | 5/5 |
| **Blocking Issues** | 0 |

## Checklist

- [x] Changeset included
- [x] Consistent change across all 3 handler files
- [x] Only adds `type: "message"` — no behavioral change for lenient providers
- [x] Fixes Kimi/GLM-4.7 compatibility

## Analysis

The fix is mechanical and correct. OpenAI's Responses API allows `type: "message"` on message objects but doesn't require it. Strict providers (Kimi, GLM-4.7) do require it. Adding it everywhere is the right approach — safe for lenient providers, fixes strict ones.

Changes across 3 files:
- `openai-responses.ts` — 3 places (2 user/assistant messages + 1 prompt)
- `openai-codex.ts` — 2 places (user + assistant)
- `openai-native.ts` — 2 places (user + assistant)

All additions are identical: `type: "message"` added to message objects.

## Recommendation

**APPROVE** — Safe, consistent fix with changeset. Merge.

---
