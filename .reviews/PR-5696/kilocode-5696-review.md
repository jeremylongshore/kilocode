<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5696
title: "feat(slash-commands): type/source indicators, skill invocation & argument hints"
author: Drilmo
category: feature
tier: 5
lines: 354
files: 25
verdict: COMMENT
confidence: 4
reviewed_at: 2026-02-14
linked_issue: none
fork_pr: none
-->

# Review: kilocode #5696

> **feat(slash-commands): type/source indicators, skill invocation & argument hints** by @Drilmo
> Diff-only analysis (merge conflicts, no fork PR)

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Logic is sound; priority chain (built-in > workflow > skill) is correct |
| Conventions | PASS | Uses `// kilocode_change` markers, follows existing patterns |
| Changeset | PASS | Minor changeset included |
| Tests | WARN | No new tests for `findSlashCommand` or skill integration in slash-commands |
| i18n | N/A | Badge labels ("command", "mode", "workflow", "skill") are not localized, but acceptable for type indicators |
| Types | PASS | Clean TypeScript -- `SlashCommandType`, `SlashCommandSource`, `SkillInfo` well-defined |
| Security | PASS | `escapeHtml()` applied to argument hint before innerHTML injection |
| Scope | WARN | Includes unrelated formatting changes across 10+ files (trailing commas, line wraps) |
| Mergeable | FAIL | CONFLICTING -- merge conflicts must be resolved |

## Findings

### YELLOW: Unrelated formatting changes inflate the diff

At least 12 of the 25 files contain only cosmetic changes: trailing comma additions (`labels.ts`, `settings.ts`, `validation.ts`), import line wraps (`global-settings.ts`, `HoleFiller.ts`, `AutocompleteServiceManager.ts`), indentation fixes (`fireworks.ts`, `useProviderModels.ts`), and expression reformatting (`ApiOptions.tsx`, `useSelectedModel.ts`, `AutocompleteServiceSettings.tsx`, `useChatAutocompleteText.ts`).

These are likely from a formatter/linter run. While each is individually harmless, bundling them with a feature PR makes review harder and increases merge conflict surface. The merge conflicts may be partly caused by these unrelated changes.

**Recommendation**: Split formatting changes into a separate PR, or at minimum document in the PR body that they are formatter-driven.

### YELLOW: Duplicate `skillsData` message handling

The PR adds a `skillsData` handler in `ExtensionStateContext.tsx` (lines 488-491), but `InstalledSkillsView.tsx` already has its own local handler for the same message type (line 38). Both call `setSkills(message.skills ?? [])` on different state variables.

This works but creates two independent copies of the same data. If the global context handler is the intended pattern going forward, `InstalledSkillsView.tsx` should be refactored to consume from `useExtensionState()` instead of maintaining its own listener.

### YELLOW: No tests for new `findSlashCommand` function

The PR adds `findSlashCommand()` and modifies `validateSlashCommand()` to accept a `skills` parameter, but no tests are added. The existing `slash-commands.spec.ts` tests `validateSlashCommand` but does not cover the new skill-related behavior or `findSlashCommand`. Given this function drives the type-colored highlights and argument hints, test coverage would catch regressions.

### GRAY: `getSourceLabel` called twice per render

In `SlashCommandMenu.tsx`, `getSourceLabel(command.source)` is called once in the conditional check and again inside the JSX to get the label text:

```tsx
{getSourceLabel(command.source) && (
    <span ...>{getSourceLabel(command.source)}</span>
)}
```

This is a minor inefficiency. A local variable would be cleaner:

```tsx
const sourceLabel = getSourceLabel(command.source)
{sourceLabel && (
    <span ...>{sourceLabel}</span>
)}
```

### GRAY: Inline type definition in ExtensionStateContext

The skills state type is defined inline in both the interface and `useState`:

```tsx
skills: Array<{ name: string; description: string; path: string; source: "global" | "project"; mode?: string }>
```

This duplicates the shape already defined in `SkillInfo` (slash-commands.ts) and `SkillMetadata` (shared/skills.ts). Importing one of these would reduce duplication and prevent drift. Note that the inline type omits `argumentHint` from the context interface despite it being present in the useState and needed for argument hints.

### GRAY: Skill invocation reads full SKILL.md including frontmatter

In `kilo.ts:83`, the skill file is read with `fs.readFile(matchingSkill.path, "utf8")` and the raw content (including YAML frontmatter) is injected as `<explicit_instructions>`. The workflow path does the same. However, the `SkillsManager.getSkillContent()` method strips frontmatter using `gray-matter` and returns only the body. Consider using `getSkillContent()` for cleaner injection, though this is consistent with how workflows work.

## CI Status

| Check | Result |
|-------|--------|
| build-cli | PASS |
| compile | PASS |
| check-translations | PASS |
| test-cli | PASS |
| test-extension (ubuntu) | PASS |
| test-extension (windows) | PASS |
| test-jetbrains | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| unit-test | PASS |
| Build Markdoc Site | PASS |

All 11 upstream CI checks pass. Merge state: CONFLICTING.

## Local Verification

Not performed -- merge conflicts prevent clean checkout. Review is diff-only.

## Code Snippets

### Skill invocation in `kilo.ts`:
```typescript
// Check for matching skill
const matchingSkill = skills.find((skill) => skill.name === commandName)
if (matchingSkill) {
    try {
        const skillContent = (await fs.readFile(matchingSkill.path, "utf8")).trim()
        const processedText =
            `<explicit_instructions type="${matchingSkill.name}">\n${skillContent}\n</explicit_instructions>\n` +
            textWithoutSlashCommand
        return { processedText, needsRulesFileCheck: false }
    } catch (error) {
        console.error(`Error reading skill file ${matchingSkill.path}: ${error}`)
    }
}
```

### Type badge rendering in `SlashCommandMenu.tsx`:
```tsx
{command.type && (
    <span
        className="text-[0.7em] px-1.5 py-0.5 rounded-sm leading-none"
        style={{
            backgroundColor: getTypeBadgeColors(command.type).bg,
            color: getTypeBadgeColors(command.type).text,
        }}>
        {command.type}
    </span>
)}
```

### Argument hint ghost text in `ChatTextArea.tsx`:
```typescript
const textAfterCommand = processedText.substring(endIndex).trim()
if (matchedCommand.argumentHint && !textAfterCommand && !autocompleteText) {
    highlighted += ` <span class="slash-command-argument-hint">${escapeHtml(matchedCommand.argumentHint)}</span>`
}
```

## Verdict

**COMMENT** -- This is a well-designed feature that adds genuine UX value: type badges make the slash command dropdown more navigable, source labels reduce ambiguity, and argument hints provide discoverability for skills. The code follows existing patterns (workflow injection via `<explicit_instructions>`, `escapeHtml` for security), and the priority chain (built-in > workflow > skill) is implemented correctly.

However, two issues prevent a clean APPROVE: (1) merge conflicts must be resolved before this can land, and (2) the unrelated formatting changes across 12+ files inflate the diff and likely contribute to the conflicts. The duplicate `skillsData` handler and missing tests for `findSlashCommand` are worth addressing but not blockers. Recommend resolving conflicts, splitting formatting into a separate commit, and adding basic test coverage for the new function.
