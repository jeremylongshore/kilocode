<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5569
title: "fix: retry Amazon Bedrock network connection lost errors"
author: romeoscript
category: fix
tier: 2
lines: 22
files: 1
review_number: 11
fork_pr: null
-->

# Review Journal: kilocode #5569

> **PR**: [#5569](https://github.com/Kilo-Org/kilocode/pull/5569) |
> **Author**: @romeoscript | **Size**: 22 lines, 1 file | **Confidence**: 4/5

## Summary

Adds retry logic with exponential backoff for Amazon Bedrock "Network connection lost" errors in the OpenRouter handler. The code is well-structured, but a maintainer commented that retrying won't help because the errors are persistent timeouts, not transient blips. REQUEST_CHANGES — hold for maintainer investigation.

## What Changed

The PR adds a retry loop (max 3 attempts, 2s/4s backoff) to `openrouter.ts` that catches a specific error pattern: `"Amazon Bedrock error"` + `"Network connection lost"`. The retry logic is narrow (won't catch unrelated errors) and clean.

## Why REQUEST_CHANGES

@lambertjosh's comment was direct:

> "A small amount of queries are consistently timing out on both Bedrock and Anthropic. We are investigating, unfortunately retrying is unlikely to help"

This changes the PR from "fix" to "workaround for the wrong problem." If the errors are persistent, retry just delays the inevitable failure by 6 seconds.

Also noted: the title says "Amazon Bedrock" but the file is `openrouter.ts` — this handles Bedrock errors routed through OpenRouter, not Bedrock directly. The title is technically misleading.

## Key Lesson

Reading existing comments prevented us from approving a PR whose fundamental approach was questioned by a maintainer. Without reading @lambertjosh's comment, this PR looks correct and well-implemented. With it, the approach is ineffective for the actual problem.

---

<sub>Review #11 of 75 | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews)</sub>
