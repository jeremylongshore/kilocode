<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5752
title: "Fixes broken /slash-commands after continue or interrupted tool-use"
author: Madrawn
category: fix
tier: 5
lines: 294
files: 3
review_number: 40
fork_pr: null
-->

# Review Journal: kilocode #5752

> **PR**: [#5752](https://github.com/Kilo-Org/kilocode/pull/5752) |
> **Title**: Fixes broken /slash-commands after continue or interrupted tool-use |
> **Author**: @Madrawn |
> **Category**: fix | **Tier**: 5 | **Size**: 294 lines, 3 files

---

## Summary

Slash commands (`/newtask`, `/newrule`, workflow files) were silently ignored when issued inside `tool_result` blocks -- meaning any slash command typed after a tool response (feedback prompt, attempt_completion, cancelled tool) was lost. The fix introduces a `processTextContent` helper that applies both `parseMentions` and `parseKiloSlashCommands` consistently across all content block types. Clean, small, well-tested.

## First Impressions

The title immediately signals a real user-facing bug. "Broken /slash-commands after continue or interrupted tool-use" describes a scenario that happens frequently: user cancels a tool or responds to `ask_followup_question` with a slash command like `/newtask`, and nothing happens. The PR description clearly explains the root cause (asymmetric processing between `text` and `tool_result` blocks) and the fix approach (helper function + extending processing). Two commits: one for the fix, one for the changeset. Nice and clean.

## What I Looked At

- `src/core/mentions/processKiloUserContentMentions.ts` -- The main production file (both mainline and diff)
- `src/core/mentions/processUserContentMentions.ts` -- The non-Kilo equivalent, for comparison
- `src/core/slash-commands/kilo.ts` -- `parseKiloSlashCommands` implementation
- `src/core/mentions/index.ts` -- `parseMentions` signature and return type
- `src/core/mentions/__tests__/processUserContentMentions.spec.ts` -- Existing test patterns
- `src/core/mentions/__tests__/processKiloUserContentMentions.spec.ts` -- New test file (from diff)
- `src/shared/cline-rules.ts` -- `ClineRulesToggles` type definition
- `.changeset/free-toes-hammer.md` -- Changeset (from diff)

## Analysis

### The Bug

`processKiloUserContentMentions` processes user content blocks before sending them to the LLM. It handles three content paths:

1. **`text` blocks** -- First user message with `<task>` tags
2. **`tool_result` with string content** -- Simple tool responses
3. **`tool_result` with array content** -- Complex tool responses with multiple text blocks

The `text` block path correctly called both `parseMentions` (resolve @-mentions, file paths, URLs) AND `parseKiloSlashCommands` (transform `/newtask`, `/newrule`, workflow files). But the two `tool_result` paths only called `parseMentions` -- `parseKiloSlashCommands` was never invoked.

This means when a user typed `/newtask` in response to an `ask_followup_question` tool (which wraps the response in `<user_message>` tags inside a `tool_result` block), the slash command was never parsed. The text passed through `parseMentions` but the `/newtask` command was left as literal text in the message, accomplishing nothing.

### The Fix

The author introduces a `processTextContent` helper function (closure) that encapsulates the two-step pipeline:

```
text -> parseMentions() -> parseKiloSlashCommands() -> processedText
```

This helper is then used in all three code paths, replacing the duplicated `parseMentions` calls. The fix also correctly propagates the `needsRulesFileCheck` flag in the `tool_result` paths, which was previously impossible since `parseKiloSlashCommands` was never called there.

### Comparison with processUserContentMentions

The non-Kilo version (`processUserContentMentions.ts`) does NOT call `parseKiloSlashCommands` at all -- it only calls `parseMentions`. So the asymmetry in the original code was not inherited from the base function; it was introduced when the Kilo-specific version added slash command support but only wired it up for the `text` block path.

### Test Quality

The 4 tests cover:
1. String `tool_result` with `<user_message>` and slash command -- verifies `parseKiloSlashCommands` is called
2. Array `tool_result` with `<user_message>` and slash command -- verifies `parseKiloSlashCommands` is called
3. Slash command transformation -- verifies end-to-end transformation works
4. No mention tags -- verifies neither `parseMentions` nor `parseKiloSlashCommands` is called

The mocking pattern (vi.mock with `parseMentions` and `parseKiloSlashCommands`) matches the existing `processUserContentMentions.spec.ts` conventions. The tests correctly verify that the mocked functions are called with the expected arguments.

### What is NOT covered

- `needsRulesFileCheck` propagation (the flag is set but no test verifies `ensureLocalKilorulesDirExists` is called as a result)
- Multiple tool_result blocks in the same message
- Mixed `text` + `tool_result` blocks
- The `mode` field from `parseMentions` (not used in the Kilo version, so irrelevant)

These gaps are acceptable for a tier 5 bug fix with 4 targeted regression tests.

## Verification

### Upstream CI
No CI checks have run on this PR. The author's branch `fix/slash_command` on their fork has no reported status checks.

### Author's Claims
The PR description states:
- "37 mentions tests pass" -- plausible given existing test suite
- "3000+ src/core tests pass" -- plausible given project test count
- Not independently verified (no codespace run for this tier 5 review)

### What We Couldn't Verify
- Actual end-to-end behavior (requires VS Code extension context)
- CI status (no checks reported)

## Diagrams

```
Slash Command Processing Flow (Before vs After)
================================================

Content block types in user messages:

  text block               tool_result (string)       tool_result (array)
       |                         |                          |
       v                         v                          v
  BEFORE:                   BEFORE:                    BEFORE:
  parseMentions()           parseMentions()            parseMentions()
       |                         |                          |
  parseKiloSlashCommands()  [NOTHING]                  [NOTHING]
       |                         |                          |
  /newtask WORKS            /newtask IGNORED           /newtask IGNORED


  AFTER:                    AFTER:                     AFTER:
  processTextContent()      processTextContent()       processTextContent()
       |                         |                          |
  parseMentions()           parseMentions()            parseMentions()
       +                         +                          +
  parseKiloSlashCommands()  parseKiloSlashCommands()   parseKiloSlashCommands()
       |                         |                          |
  /newtask WORKS            /newtask WORKS             /newtask WORKS
```

## Bot Review Synthesis

| Bot | Status | Key Finding | Useful? |
|-----|--------|-------------|---------|
| CodeRabbit | Not collected | Batch review — no individual fork PR | N/A |
| Gemini | Not collected | Batch review — no individual fork PR | N/A |
| Greptile | Not collected | Batch review — no individual fork PR | N/A |
| CodeQL | Not collected | Batch review — no individual fork PR | N/A |
| Qodo | Not collected | Batch review — no individual fork PR | N/A |

## Lessons Learned

1. **Symmetric processing is a code smell when missing** -- When a function processes multiple block types, every processing step should be applied consistently across all types. The original code applied `parseMentions` to all three paths but `parseKiloSlashCommands` to only one. This asymmetry was the bug.

2. **Helper functions prevent this class of bug** -- By extracting the two-step pipeline into `processTextContent`, the author makes it impossible to forget one step when adding processing to a new block type. Future maintainers will naturally use the helper.

3. **Kilo-specific code drift from upstream** -- The `processKiloUserContentMentions` function is explicitly documented as "a duplicate of processUserContentMentions" that "should be merged in the future." This drift between the two versions is what allowed the asymmetry to go unnoticed. The upstream version never had slash commands, so the gap was invisible until someone tested slash commands in tool responses.

4. **Regression tests as bug documentation** -- The test file header comments document exactly what the bug was and why the tests exist. This is excellent practice for regression tests -- future developers who see these tests will understand the historical context.

---

<sub>Review #40 | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
