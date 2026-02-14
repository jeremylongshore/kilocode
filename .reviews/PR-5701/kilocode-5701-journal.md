<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5701
title: "fix(api): add type field to messages in Responses API"
author: Patel230
category: fix
tier: 2
lines: 26
files: 4
review_number: 12
fork_pr: null
-->

# Review Journal: kilocode #5701

> **PR**: [#5701](https://github.com/Kilo-Org/kilocode/pull/5701) |
> **Author**: @Patel230 | **Size**: 26 lines, 4 files | **Confidence**: 5/5

## Summary

Adds `type: "message"` to all Responses API message objects across three handler files. OpenAI's API allows this field but doesn't require it. Strict-mode providers (Kimi, GLM-4.7) reject messages without it. APPROVE — mechanical fix that's safe for all providers and includes a changeset.

## What Changed

Seven identical additions of `type: "message"` spread across three files:
- `openai-responses.ts` — 3 places (2 user/assistant messages + 1 system prompt)
- `openai-codex.ts` — 2 places (user + assistant)
- `openai-native.ts` — 2 places (user + assistant)

The fourth file is the changeset.

## Analysis

This is the cleanest kind of fix: adding a field that's allowed-but-optional in the spec, which strict providers require. No behavioral change for lenient providers (OpenAI, OpenRouter). Fixes Kimi and GLM-4.7 compatibility. The consistency across all three handler files means no provider is accidentally left out.

## Lessons Learned

- Consistent `type` field additions across handler files are low-risk mechanical fixes. When the same change is made identically in every handler, confidence is high.
- Some API providers enforce spec fields that others treat as optional. The safe approach is to always include spec-defined fields.

---

<sub>Review #12 of 75 | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews)</sub>
