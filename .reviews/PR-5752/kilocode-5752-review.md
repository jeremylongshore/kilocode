<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5752
title: "Fixes broken /slash-commands after continue or interrupted tool-use"
author: Madrawn
category: bugfix
tier: 5
lines: 294
files: 3
verdict: APPROVE
confidence: 5
reviewed_at: 2026-02-15
-->

# Review: kilocode #5752

> **Fixes broken /slash-commands after continue or interrupted tool-use** by @Madrawn

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Extends slash command processing to tool_result blocks |
| Conventions | PASS | kilocode_change markers appropriate; ClineRulesToggles import added |
| Changeset | PASS | Patch changeset included |
| Tests | PASS | 4 new regression tests covering all tool_result variants |
| i18n | N/A | Backend-only fix |
| Types | PASS | ClineRulesToggles imported for processTextContent helper |
| Security | PASS | No new attack surface |
| Scope | PASS | Pure bug fix, no behavior changes for existing code paths |

## Findings

### [green] Clean refactoring via processTextContent helper
**File**: `src/core/mentions/processKiloUserContentMentions.ts:45-70`
The helper function `processTextContent` eliminates code duplication by combining `parseMentions` and `parseKiloSlashCommands` into a single pipeline. This is applied to all three paths: text blocks (existing), tool_result with string content (new), and tool_result with array content (new). The `needsRulesFileCheck` flag is correctly propagated in all paths.

### [green] Comprehensive regression tests
**File**: `src/core/mentions/__tests__/processKiloUserContentMentions.spec.ts`
Four test cases cover:
1. tool_result with string content containing slash command
2. tool_result with array content containing slash command
3. Slash command transformation verification
4. No-op when no mention tags present

Each test properly mocks `parseMentions` and `parseKiloSlashCommands` and verifies the call chain.

### [gray] Test comment describes bug as present-tense
**File**: `src/core/mentions/__tests__/processKiloUserContentMentions.spec.ts:1-8`
The file header comments say "This test will FAIL with the current implementation because..." which was true during development but is misleading after the fix ships. Minor nit.

## CI Status

| Check | Result |
|-------|--------|
| compile | PASS |
| test-extension (ubuntu) | PASS |
| test-extension (windows) | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| test-cli | PASS |
| test-jetbrains | PASS |
| check-translations | PASS |
| build-cli | PASS |
| Build Markdoc Site | PASS |
| unit-test | PASS |

## Code Snippets

### Before: tool_result string content only ran parseMentions
```typescript
// Old code - missing parseKiloSlashCommands
if (typeof block.content === "string") {
    if (shouldProcessMentions(block.content)) {
        const parsedResult = await parseMentions(block.content, ...)
        return { ...block, content: parsedResult.text }
    }
}
```

### After: unified processTextContent helper
```typescript
// New helper combines both steps
const processTextContent = async (text, localWorkflowToggles, globalWorkflowToggles) => {
    const parsedText = await parseMentions(text, ...)
    const { processedText, needsRulesFileCheck } = await parseKiloSlashCommands(
        parsedText.text, localWorkflowToggles, globalWorkflowToggles
    )
    return { processedText, needsRulesFileCheck }
}

// Applied uniformly to string content
if (typeof block.content === "string") {
    if (shouldProcessMentions(block.content)) {
        const { processedText, needsRulesFileCheck: needsCheck } = await processTextContent(
            block.content, localWorkflowToggles, globalWorkflowToggles
        )
        if (needsCheck) needsRulesFileCheck = true
        return { ...block, content: processedText }
    }
}
```

## Verdict

**APPROVE** - This is a well-executed bug fix. The root cause is clearly identified (slash commands in `tool_result` blocks were never processed through `parseKiloSlashCommands`), the fix is minimal and correct (a shared helper applied to all code paths), and regression tests cover the key scenarios. The refactoring reduces code duplication while fixing the bug. Already approved by @kevinvandijk upstream. CI is fully green.

---

*Reviewed by: Jeremy Longshore*
*Review methodology: [Kilo Code Review Process](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)*
