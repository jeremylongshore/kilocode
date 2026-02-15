<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5696
title: "feat(slash-commands): type/source indicators, skill invocation & argument hints"
author: Drilmo
category: feature
tier: 5
lines: 354
files: 25
review_number: 46
fork_pr: none
-->

# Review Journal: kilocode #5696

> **PR**: [#5696](https://github.com/Kilo-Org/kilocode/pull/5696) |
> **Title**: feat(slash-commands): type/source indicators, skill invocation & argument hints |
> **Author**: @Drilmo |
> **Category**: feature | **Tier**: 5 | **Size**: 354 lines, 25 files

---

## Summary

Enhances the "/" slash command dropdown with type badges (command/mode/workflow/skill), source labels (project/global/org), color-coded input highlights per type, skill invocation from the dropdown, and argument hint ghost text for skills. The feature touches the full stack: backend parsing (`kilo.ts`, `SkillsManager.ts`), shared types (`skills.ts`), webview state (`ExtensionStateContext.tsx`), UI components (`SlashCommandMenu.tsx`, `ChatTextArea.tsx`), styles (`kilocode.css`), and utilities (`slash-commands.ts`).

## First Impressions

25 files for a UI-centric feature is high, but the diff reveals that 12+ files are unrelated formatting changes (trailing commas, line wraps from a formatter). The actual feature code is concentrated in about 10 files and is well-scoped. The author (Drilmo) is a project maintainer and the code quality is consistently high.

The merge conflict state is a concern. The PR was opened on February 6, 2026 and has not been merged yet. The formatting changes likely contribute to the conflicts since they touch files across the codebase.

## What I Looked At

- `webview-ui/src/utils/slash-commands.ts` -- Core logic: new types (`SlashCommandType`, `SlashCommandSource`, `SkillInfo`), `findSlashCommand()`, skills parameter threading
- `src/core/slash-commands/kilo.ts` -- Backend skill invocation (priority chain: built-in > workflow > skill)
- `src/services/skills/SkillsManager.ts` -- `argumentHint` parsing from SKILL.md frontmatter
- `src/shared/skills.ts` -- `SkillMetadata` interface extension
- `webview-ui/src/components/chat/SlashCommandMenu.tsx` -- Type badge + source label rendering
- `webview-ui/src/components/chat/ChatTextArea.tsx` -- Type-colored highlights + argument hint ghost text
- `webview-ui/src/context/ExtensionStateContext.tsx` -- `skillsData` message handler + skills context
- `webview-ui/src/kilocode.css` -- Type-specific CSS classes
- `src/core/task/Task.ts` -- Skills injection into `parseKiloSlashCommands`
- Existing tests in `slash-commands.spec.ts` -- Confirmed no new test coverage
- `InstalledSkillsView.tsx` -- Found duplicate `skillsData` handler
- Upstream CI (11/11 green)

## Analysis

### Architecture

The feature follows a clean data flow:

```
SkillsManager (discover + parse argumentHint)
    |
    v
postSkillsDataToWebview() -> "skillsData" message
    |
    v
ExtensionStateContext (skills state)
    |
    v
ChatTextArea + SlashCommandMenu (consume via useExtensionState)
    |
    v
slash-commands.ts utilities (type/source/argumentHint on SlashCommand)
```

The backend invocation path adds skills as a fourth tier in the existing priority chain:

```
parseKiloSlashCommands:
  1. Built-in commands (newtask, newrule, etc.) -> commandReplacements lookup
  2. Workflows (local then global) -> enabledWorkflowToggles search
  3. Skills (mode-filtered) -> skills.find() [NEW]
  4. Fallback -> return original text
```

This ordering prevents skills from shadowing built-in commands or workflows. Good design.

### Argument Hint Implementation

The argument hint follows the [Agent Skills specification](https://agentskills.io/specification) `argument-hint` frontmatter field. The implementation is carefully layered:

1. `SkillsManager.loadSkillMetadata` -- Extracts `argument-hint` from gray-matter parsed frontmatter, validates it is a string, trims whitespace
2. `SkillMetadata.argumentHint` -- Optional field on the shared interface
3. `SkillInfo.argumentHint` -- Mirrored on the webview-side interface
4. `SlashCommand.argumentHint` -- Carried through to the command objects
5. `ChatTextArea` -- Rendered as `<span class="slash-command-argument-hint">` after the highlighted command, with `escapeHtml()` for safety
6. Deference to FIM: `!autocompleteText` check prevents collision with FIM ghost text

### Type-Colored Highlights

Four types get distinct colors:
- **command** (blue): `rgba(58, 150, 221, 0.2)` -- matches VS Code's default link color
- **mode** (purple): `rgba(160, 100, 230, 0.2)` -- visually distinct from blue
- **workflow** (green): `rgba(80, 180, 100, 0.2)` -- matches "rules" semantic color
- **skill** (amber): `rgba(220, 160, 50, 0.2)` -- warm, distinct from others

The same color values are used in both the dropdown badges (`SlashCommandMenu.tsx`) and the input highlights (`kilocode.css`), ensuring visual consistency.

### The `validateSlashCommand` vs `findSlashCommand` Split

The PR replaces the `validateSlashCommand` call in `ChatTextArea.tsx` with `findSlashCommand`. The key difference:

- `validateSlashCommand` returns `"full" | "partial" | null` -- used in `KiloTaskHeader.tsx` for validation
- `findSlashCommand` returns `SlashCommand | null` -- provides the full command object including `type` and `argumentHint`

Both functions are kept exported. `validateSlashCommand` is still used by `KiloTaskHeader.tsx`, so removing it would be a breaking change. The PR correctly preserves backward compatibility.

### Concern: Formatting Noise

The 12+ formatting-only files are:
- `cli/src/constants/providers/labels.ts` -- trailing comma
- `cli/src/constants/providers/settings.ts` -- trailing comma
- `cli/src/constants/providers/validation.ts` -- trailing comma
- `packages/types/src/global-settings.ts` -- import line wrap
- `packages/types/src/providers/fireworks.ts` -- indentation fix (spaces to tabs)
- `src/services/autocomplete/AutocompleteServiceManager.ts` -- string wrap
- `src/services/autocomplete/classic-auto-complete/HoleFiller.ts` -- parameter wrap
- `src/test-llm-autocompletion/mock-context-provider.ts` -- expression wrap
- `webview-ui/src/components/chat/hooks/useChatAutocompleteText.ts` -- expression wrap
- `webview-ui/src/components/kilocode/hooks/useProviderModels.ts` -- comment alignment
- `webview-ui/src/components/kilocode/settings/AutocompleteServiceSettings.tsx` -- span wraps
- `webview-ui/src/components/settings/ApiOptions.tsx` -- filter expression reformat
- `webview-ui/src/components/ui/hooks/useSelectedModel.ts` -- ternary wrap

These inflate the diff from approximately 150 meaningful lines to 354, and touch 25 files instead of approximately 10.

## Verification

### Upstream CI
All 11 checks pass -- compile, test-extension, test-cli, test-webview, etc.

### Local Testing
Not performed -- merge conflicts prevent clean checkout. Review is diff-only.

### What We Could Not Verify
- Visual rendering of type badges, source labels, and argument hints
- Skill invocation end-to-end (selecting a skill from dropdown, verifying SKILL.md injection)
- Argument hint disappearing when user starts typing
- FIM autocomplete taking priority over argument hints

## Bot Review Synthesis

| Bot | Verdict | Key Finding | Useful? |
|-----|---------|-------------|---------|
| changeset-bot | INFO | Changeset detected (minor) | Yes |
| Upstream reviews | NONE | No reviews posted yet | N/A |

## Diagrams

```
Slash Command Data Flow
------------------------------------------------------------------------

Extension Host                           Webview
-------------------                      -------
SkillsManager
  +- discoverSkills()
  |   +- parse argumentHint from frontmatter
  +- getSkillsForMode(mode)
       |
       v
postSkillsDataToWebview()
  type: "skillsData"  ----------------> ExtensionStateContext
  skills: [...]                            setSkills(...)
                                              |
                                              v
                                         useExtensionState()
                                              |
                     +------------------------+
                     v                        v
              SlashCommandMenu          ChatTextArea
              +- type badges            +- type-colored highlights
              +- source labels          +- argument hint ghost text
              +- skill items            +- findSlashCommand()

Task.ts (on submit)
  +- getSkillsForMode()
  +- parseKiloSlashCommands(text, local, global, skills)
       +- 1st: built-in? -> commandReplacements
       +- 2nd: workflow? -> read file -> explicit_instructions
       +- 3rd: skill?    -> read file -> explicit_instructions
```

## Lessons Learned

1. **Feature PRs should not bundle formatter output** -- Unrelated formatting changes across 12+ files increase merge conflict surface and make review harder. When a formatter touches files outside the feature scope, those changes should be in a separate commit or PR.

2. **Duplicate message handlers are a code smell** -- The `skillsData` message is now handled in both `ExtensionStateContext.tsx` (global) and `InstalledSkillsView.tsx` (local). This creates two independent state copies. Identifying the canonical source early prevents drift.

3. **Priority chains need explicit documentation** -- The built-in > workflow > skill precedence in `parseKiloSlashCommands` is implicit from code ordering. A comment documenting this priority would help future maintainers understand why skills are checked last.

4. **Argument hint is a well-scoped spec adoption** -- Implementing a single field from the Agent Skills specification (`argument-hint`) and integrating it through the full stack is a good example of incremental spec adoption. The deference to FIM autocomplete shows careful attention to interaction design.

5. **Merge conflicts on long-lived branches are predictable** -- This PR was opened Feb 6 and remains unmerged Feb 14. In a fast-moving codebase, 8 days is enough for conflicts, especially when the PR touches widely-shared utility files.

---

<sub>Review #46 | Diff-only analysis (merge conflicts prevent local verification) | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
