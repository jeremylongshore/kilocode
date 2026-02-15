<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5696
title: "feat(slash-commands): type/source indicators, skill invocation & argument hints"
author: Drilmo
category: feature
tier: 5
lines: 273
files: 11
verdict: COMMENT
confidence: 4
reviewed_at: 2026-02-15
-->

# Review: kilocode #5696

> **feat(slash-commands): type/source indicators, skill invocation & argument hints** by @Drilmo

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Command resolution follows correct precedence order |
| Conventions | PASS | kilocode_change markers present on all shared-code changes |
| Changeset | PASS | Minor changeset included (new feature) |
| Tests | WARN | No new tests added for webview or backend slash command logic |
| i18n | N/A | No new user-facing strings requiring translation |
| Types | PASS | SlashCommandType, SlashCommandSource, SkillInfo cleanly defined |
| Security | WARN | escapeHtml used for argument hints in innerHTML context - verify completeness |
| Scope | PASS | Well-scoped feature; additive with default parameters |

## Findings

### [yellow] No new tests for findSlashCommand or skill matching
**File**: `webview-ui/src/utils/slash-commands.ts`, `src/core/slash-commands/kilo.ts`
The PR adds `findSlashCommand()`, modifies `getSupportedSlashCommands()` to include skills, and adds skill matching in `parseKiloSlashCommands()`. None of these have corresponding test coverage. The author reports 7831 tests pass, but all are pre-existing.

### [yellow] Skill/workflow name collision silently resolved by ordering
**File**: `src/core/slash-commands/kilo.ts:77-93`
If a skill shares a name with an enabled workflow, the workflow wins because it's checked first. On the webview side, `getSupportedSlashCommands()` concatenates `[...baseCommands, ...modeCommands, ...workflowCommands, ...skillCommands]`, and `findSlashCommand` returns the first match. This precedence should be documented or produce a warning.

### [gray] Hardcoded RGBA color values
**File**: `webview-ui/src/components/chat/SlashCommandMenu.tsx:14-20`, `webview-ui/src/kilocode.css`
Type badge colors and CSS highlights use hardcoded RGBA values rather than VS Code theme variables. May look inconsistent in certain themes. Acceptable for an initial implementation.

### [gray] Skills fetched per-message in Task loop
**File**: `src/core/task/Task.ts:4050-4052`
`getSkillsForMode(currentMode)` is called on every user message. The method likely filters an in-memory array so cost is minimal, but caching per-mode per-task would be more efficient.

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

### Skill invocation follows workflow pattern
```typescript
// src/core/slash-commands/kilo.ts
const matchingSkill = skills.find((skill) => skill.name === commandName)
if (matchingSkill) {
    const skillContent = (await fs.readFile(matchingSkill.path, "utf8")).trim()
    const processedText =
        `<explicit_instructions type="${matchingSkill.name}">\n${skillContent}\n</explicit_instructions>\n` +
        textWithoutSlashCommand
    return { processedText, needsRulesFileCheck: false }
}
```

### Type badge rendering
```typescript
// webview-ui/src/components/chat/SlashCommandMenu.tsx
const typeBadgeColors: Record<string, { bg: string; text: string }> = {
    command: { bg: "rgba(58, 150, 221, 0.15)", text: "rgba(58, 150, 221, 0.9)" },
    mode:    { bg: "rgba(160, 100, 230, 0.15)", text: "rgba(160, 100, 230, 0.9)" },
    workflow:{ bg: "rgba(80, 180, 100, 0.15)",  text: "rgba(80, 180, 100, 0.9)" },
    skill:   { bg: "rgba(220, 160, 50, 0.15)",  text: "rgba(220, 160, 50, 0.9)" },
}
```

## Verdict

**COMMENT** - Well-structured feature addition that follows established patterns (workflow injection, kilocode_change markers, default parameter values). The implementation is additive and backward compatible. Two items warrant attention before merge: (1) adding test coverage for the new `findSlashCommand` function and skill matching logic, and (2) documenting or surfacing the name collision precedence between skills and workflows. CI is fully green.

---

*Reviewed by: Jeremy Longshore*
*Review methodology: [Kilo Code Review Process](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)*
