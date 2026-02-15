<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5642
title: "feat: allow auto-selecting rules based on prompt and context"
author: shssoichiro
category: feature
tier: 6
lines: 1043
files: 67
review_number: 23
fork_pr: N/A (batch review)
-->

# Review Journal: kilocode #5642

> **PR**: [#5642](https://github.com/Kilo-Org/kilocode/pull/5642) |
> **Title**: feat: allow auto-selecting rules based on prompt and context |
> **Author**: @shssoichiro |
> **Category**: feature | **Tier**: 6 | **Size**: 1043 lines, 67 files

---

## Summary

REQUEST_CHANGES. The feature is well-designed with solid error handling and correct integration patterns, but has two correctness bugs: (1) the file-based system prompt path silently bypasses auto-selected rules, and (2) global path detection uses `includes()` instead of `startsWith()`, which can misclassify rules. Both are straightforward fixes.

## First Impressions

Title signals a rule-selection feature. The 67-file, 1043-line diff initially looks large, but the author correctly noted that most files are i18n translations. Deducting the 54 locale files (~700 lines), the actual logic delta is ~330 lines across 13 files. The core idea is using an LLM to classify which custom rules are relevant to a user's task, which is a reasonable application of cheap model inference for UX improvement. Closes issue #3430.

## What I Looked At

### Files Read (logic-bearing)
- `src/core/auto-select/auto-select-rules.ts` -- new, core selection logic
- `src/core/auto-select/__tests__/auto-select-rules.spec.ts` -- new, test file
- `src/core/prompts/sections/custom-instructions.ts` -- modified, rule override logic
- `src/core/prompts/system.ts` -- modified, parameter threading
- `src/core/task/Task.ts` -- modified, lifecycle integration
- `src/core/webview/ClineProvider.ts` -- modified, state plumbing
- `src/core/webview/kilorules.ts` -- modified, metadata extraction
- `src/core/webview/webviewMessageHandler.ts` -- modified, message handler
- `src/shared/cline-rules.ts` -- modified, RuleMetadata type
- `src/shared/support-prompt.ts` -- modified, AUTO_SELECT_RULES template
- `packages/types/src/global-settings.ts` -- modified, schema additions
- `packages/types/src/vscode-extension-host.ts` -- modified, type additions
- `webview-ui/src/components/kilocode/rules/AutoSelectToggle.tsx` -- new, toggle component
- `webview-ui/src/components/kilocode/rules/KiloRulesWorkflowsView.tsx` -- modified
- `webview-ui/src/components/kilocode/rules/RuleRow.tsx` -- modified, disabled state
- `webview-ui/src/components/kilocode/rules/RulesToggleList.tsx` -- modified
- `webview-ui/src/components/kilocode/rules/RulesWorkflowsSection.tsx` -- modified
- `webview-ui/src/components/settings/AutoSelectRulesPromptSettings.tsx` -- new
- `webview-ui/src/components/settings/PromptsSettings.tsx` -- modified
- `webview-ui/src/context/ExtensionStateContext.tsx` -- modified
- `src/utils/single-completion-handler.ts` -- read for context (not modified)

### Codebase context gathered
- Traced the full data flow: toggle setting -> Task.startTask() -> autoSelectRules() -> LLM call -> parseAutoSelectResponse() -> store paths on Task instance -> getSystemPrompt() -> SYSTEM_PROMPT() -> generatePrompt() -> addCustomInstructions() -> loadEnabledRules()
- Confirmed SYSTEM_PROMPT has two paths (file-based and standard)
- Reviewed existing support prompt patterns (COMMIT_MESSAGE, CONDENSE, etc.) for consistency
- Checked the `streamResponseFromHandler` utility used for the LLM call

## Analysis

### Data Flow Architecture

The feature adds a new step to the task lifecycle:

1. User toggles "Auto-select rules" in Rules dialog -> stored as `autoSelectRules` boolean in global settings
2. On `Task.startTask()`, if enabled:
   a. `getRulesWithMetadata(cwd)` reads all rule files, extracts first ~200 chars as description
   b. `autoSelectRules(task, availableRules, this)` builds a prompt with rule metadata, calls an LLM
   c. LLM returns comma-separated indices of relevant rules
   d. `parseAutoSelectResponse()` extracts indices, maps to rule paths
   e. Paths stored as `this.autoSelectedRulePaths` on the Task instance
3. On every `getSystemPrompt()` call, `autoSelectedRulePaths` is threaded through to `addCustomInstructions()`
4. In `addCustomInstructions()`, if `autoSelectedRulePaths` is set, it overrides the manual toggle states by constructing synthetic toggle maps where only auto-selected paths are enabled

### Finding: File-based prompt path gap (C1)

The `SYSTEM_PROMPT` function (the exported entry point) checks for file-based custom system prompts first. If found, it calls `addCustomInstructions()` directly:

```typescript
// system.ts ~line 237
const customInstructions = await addCustomInstructions(
    baseInstructionsForFile, globalCustomInstructions || "", cwd, mode,
    { language, rooIgnoreInstructions, settings },
)
```

The standard path calls `generatePrompt()` which receives `autoSelectedRulePaths` and passes it:

```typescript
// system.ts ~line 169 (inside generatePrompt)
autoSelectedRulePaths: autoSelectedRulePaths,
```

The file-based path never receives `autoSelectedRulePaths`. This means users with `.kilo/system-prompt-*.md` files will have auto-selection silently ignored.

### Finding: Fragile path classification (C3)

The override logic in `custom-instructions.ts` determines if a rule path is global by:

```typescript
const isGlobal = rulePath.includes(path.join(os.homedir(), ".kilocode"))
```

This uses `String.includes()` which is a substring check. If a workspace were located at a path containing `.kilocode` as a directory component (e.g., `/home/user/projects/old-.kilocode-migration/`), workspace rules would be misclassified as global. The fix is straightforward:

```typescript
const isGlobal = path.resolve(rulePath).startsWith(path.join(os.homedir(), ".kilocode") + path.sep)
```

### Finding: Partial message lifecycle (M1)

The auto-select block sends a partial message (loading indicator), then awaits the LLM call, then completes the partial with the result. If the LLM call throws, the catch block logs the error but never completes the partial message, leaving a stuck spinner in the chat. The fix is a single `say()` call in the catch block.

### Design decisions worth noting

- **One-shot selection at task start.** Auto-selection runs once per task against the first user message. It does not re-run on condensation or conversation evolution. This is pragmatic for v1 and avoids per-message LLM cost, but means the rule set is static for the task's lifetime.

- **All-rules fallback on error.** Every error path returns all rules rather than none. This is the safe default -- it's better to include irrelevant rules than to silently drop needed ones.

- **No interaction with workflows.** Auto-select only affects rules, not workflows. Correct scoping for initial release.

## Verification

- Read-only review; no local build or test execution performed.
- Test file (`auto-select-rules.spec.ts`) has 9 test cases covering: return type shape, empty rules shortcut, comma-separated parsing, "none" handling, out-of-range filtering, error fallback, cost from usage, cost from model pricing.
- Missing test coverage: partial message completion on error, file-based system prompt path, stale selection across condensation.

## Diagrams

```
Task.startTask()
    |
    v
[autoSelectRules enabled?] --no--> [normal flow]
    |yes
    v
getRulesWithMetadata(cwd) -- reads rule files, extracts descriptions
    |
    v
say("Auto-selecting rules...", partial=true)
    |
    v
autoSelectRules(task, rules, this)
    |-- builds prompt with rule list + user task
    |-- calls LLM via streamResponseFromHandler
    |-- parses response indices
    |
    v
this.autoSelectedRulePaths = result.selectedRulePaths
    |
    v
say(resultMessage, partial=false)
    |
    v
[normal task flow continues]
    |
    v  (on every getSystemPrompt() call)
SYSTEM_PROMPT()
    |-- [file-based path] --> addCustomInstructions() [BUG: missing autoSelectedRulePaths]
    |-- [standard path] --> generatePrompt() --> addCustomInstructions(autoSelectedRulePaths)
         |
         v
    [if autoSelectedRulePaths set]
         |-- build synthetic toggle maps from paths
         |-- loadEnabledRules() with synthetic toggles
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

1. **Trace all code paths when adding parameters.** The `SYSTEM_PROMPT` function has a branch for file-based custom prompts that takes a completely different code path. When adding a new parameter that affects system prompt generation, both paths must be updated. This is easy to miss when the branch is early-return style.

2. **`String.includes()` is not safe for path classification.** Path containment checks should always use `startsWith()` on resolved/normalized paths with trailing separators to avoid substring false positives.

3. **Partial messages need symmetric completion.** Any async operation between a `partial=true` and `partial=false` message creates a potential for stuck UI state. Both success and error paths must complete the partial.

4. **i18n file count inflates PR size.** 54 of 67 files (81%) are locale translations. When triaging PR size, deducting i18n boilerplate gives a more accurate picture of the actual review surface.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
