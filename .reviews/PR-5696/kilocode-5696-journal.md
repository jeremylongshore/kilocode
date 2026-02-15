<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5696
title: "feat(slash-commands): type/source indicators, skill invocation & argument hints"
author: Drilmo
category: feature
tier: 5
lines: 273
files: 11
review_number: 53
-->

# Review Journal: kilocode #5696

> **PR**: [#5696](https://github.com/Kilo-Org/kilocode/pull/5696) |
> **Title**: feat(slash-commands): type/source indicators, skill invocation & argument hints |
> **Author**: @Drilmo |
> **Category**: feature | **Tier**: 5 | **Size**: +249/-24, 11 files

---

## Summary

Feature PR that enriches the slash command menu with visual metadata (type badges, source labels, type-colored highlights) and extends it to include skills with argument hint ghost text. Implementation is clean, backward-compatible, and follows established patterns. Missing test coverage for the new utility functions.

## First Impressions

Title signals a UI enhancement plus backend feature work. The PR description is thorough with screenshots showing type badges for each category (command, mode, workflow, skill) and the argument hint ghost text. The scope is well-contained to slash command infrastructure on both the webview and extension sides.

## What I Looked At

- `src/core/slash-commands/kilo.ts` (main) - current slash command parsing, no skill support
- `webview-ui/src/utils/slash-commands.ts` (main) - current SlashCommand interface, no type/source fields
- Full diff of all 11 files
- CI check results (all 11 passing)
- PR comments (only changeset-bot)
- No existing reviews from maintainers

## Analysis

### Architecture

The change touches three layers:
1. **Backend** (`kilo.ts`, `Task.ts`, `SkillsManager.ts`): Skills are resolved by name from `SkillsManager.getSkillsForMode()` and their content is injected as `<explicit_instructions>` blocks, exactly like workflows.
2. **IPC bridge** (`webviewMessageHandler.ts`, `ExtensionStateContext.tsx`): A new `skillsData` message type pipes skill metadata (name, description, source, argumentHint) from extension to webview.
3. **Webview** (`slash-commands.ts`, `SlashCommandMenu.tsx`, `ChatTextArea.tsx`, `kilocode.css`): UI rendering of badges, source labels, and ghost text.

The `SlashCommand` interface was extended with optional `type`, `source`, and `argumentHint` fields. All function signatures received a new `skills` parameter with a default empty array, preserving backward compatibility.

### Key Design Decision: Resolution Precedence

In `kilo.ts`, the resolution order is: built-in commands > workflows > skills. In the webview, the order is: `[baseCommands, modeCommands, workflowCommands, skillCommands]`. The first match wins in `findSlashCommand`. This is reasonable but undocumented.

### Argument Hint Ghost Text

The ghost text implementation is well-thought-out: it yields to FIM autocomplete when active (`!autocompleteText`) and disappears when the user types after the command (`!textAfterCommand`). The `escapeHtml` call protects against injection through SKILL.md frontmatter.

## Verification

- **CI**: All 11 checks pass (compile, test-extension ubuntu/windows, test-webview ubuntu/windows, test-cli, test-jetbrains, check-translations, build-cli, Build Markdoc Site, unit-test).
- **No local testing performed** - this is a UI-heavy feature requiring the VS Code extension host.
- **No new test files** were added. The existing 7831 tests all pass per the author.

## Lessons Learned

1. **Feature additions to slash commands touch many layers.** The slash command system spans backend parsing, IPC messaging, state context, and webview rendering. Each layer needs consistent parameter threading.

2. **Default parameter values are the right pattern for backward-compatible extensions.** Every new `skills` parameter defaults to `[]`, meaning no callsite had to change unless it wanted to pass skills.

3. **Name collision precedence in command systems should be documented.** When multiple registries (commands, workflows, skills) share a namespace, the resolution order matters and should be explicit.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
