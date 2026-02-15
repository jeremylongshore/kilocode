<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5642
title: "feat: allow auto-selecting rules based on prompt and context"
author: shssoichiro
category: feature
tier: 6
lines: 1043
files: 67
verdict: REQUEST_CHANGES
confidence: high
reviewed_at: 2026-02-14
fork_pr: N/A (batch review)
linked_issue: N/A
-->

# Review: kilocode #5642

> **feat: allow auto-selecting rules based on prompt and context** by @shssoichiro

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | FAIL | C1: file-based prompt path doesn't receive autoSelectedRulePaths; C3: fragile global path detection |
| Conventions | PASS | Follows existing kilocode_change pattern, support-prompt integration is idiomatic |
| Changeset | PASS | Minor bump, correct scope |
| Tests | PASS | Good coverage of core logic; missing edge cases around partial message lifecycle |
| i18n | PASS | All 22 locales updated with reasonable translations |
| Types | PASS | Schema additions in global-settings, extension state, webview messages all correct |
| Security | PASS | No credential exposure; rule content truncated to 250 chars before sending to LLM |
| Scope | WARN | Unrelated grammar fixes in ru/uk translation files should be separate |

## Findings

### Critical

**C1: `autoSelectedRulePaths` not threaded through file-based system prompt path** (red)
`src/core/prompts/system.ts` lines ~230-247

The `SYSTEM_PROMPT` function has two code paths. The standard path calls `generatePrompt()` which receives and passes `autoSelectedRulePaths` to `addCustomInstructions()`. However, the file-based custom system prompt path (triggered when a user has a `.kilo/system-prompt-*.md` file) calls `addCustomInstructions()` directly without passing `autoSelectedRulePaths`. Users with file-based custom prompts will get all rules regardless of auto-selection.

```typescript
// File-based path (line ~237) - MISSING autoSelectedRulePaths
const customInstructions = await addCustomInstructions(
    baseInstructionsForFile,
    globalCustomInstructions || "",
    cwd,
    mode,
    {
        language: language ?? formatLanguage(vscode.env.language),
        rooIgnoreInstructions,
        settings,
        // autoSelectedRulePaths is NOT passed here
    },
)
```

**C3: Global path detection uses `includes()` instead of `startsWith()`** (red)
`src/core/prompts/sections/custom-instructions.ts` ~line 486 (in PR diff)

```typescript
const isGlobal = rulePath.includes(path.join(os.homedir(), ".kilocode"))
```

`String.includes()` can false-positive on workspace paths that contain `.kilocode` as a substring. Should use:
```typescript
const isGlobal = path.resolve(rulePath).startsWith(path.join(os.homedir(), ".kilocode"))
```

### Moderate

**M1: Partial message orphaned on error** (yellow)
`src/core/task/Task.ts` ~line 2070 (in PR diff)

The code sends a partial message (`partial=true`) for "Auto-selecting rules..." then calls `autoSelectRules()`. If that function throws, the outer `catch` silently swallows the error without completing the partial message. The user sees a perpetual loading spinner for that message row.

Fix: add a `say()` call in the catch block to complete the partial message with a fallback like "Auto-select skipped".

**M2: Response parser extracts all numbers from arbitrary text** (yellow)
`src/core/auto-select/auto-select-rules.ts` ~line 437 (in PR diff)

```typescript
const matches = normalized.match(/\d+/g)
```

If the LLM wraps its response in explanation ("I selected rules 0, 2 because there are 10 rules"), it would incorrectly try to include index 10 (filtered by range) but would also include any other stray numbers that happen to be valid indices. Consider validating that the full response matches `^\s*(\d+\s*,?\s*)+\s*$` before falling back to greedy extraction, or only parse the first line.

**M3: Visual toggle override is undocumented** (yellow)
`webview-ui/src/components/kilocode/rules/RulesToggleList.tsx`

```tsx
enabled={enabled && !disabled}
```

This makes all toggles appear "off" when auto-select is active, even though underlying state is preserved. The UX intent is correct (communicate that toggles are irrelevant when auto-select is on), but needs a code comment explaining the intentional state override.

### Minor

**m1:** Unrelated grammar corrections in `ru/kilocode.json` and `uk/kilocode.json` (`"серию шагов"` -> `"серія кроків"`, etc.) should be in a separate commit.

**m2:** Task messages ("Auto-selecting rules...", "Auto-selected N rules: ...") are hardcoded English strings in `Task.ts` instead of going through i18n.

**m3:** Cost display threshold `>= 0.01` ($1 cent) is too high for rule selection with cheap models -- cost will almost always be below this, making the cost info effectively invisible. Consider `>= 0.001` or removing the threshold.

**m4:** Extra blank line introduced in `Task.ts` at the `_deletedApiCost` property declaration.

## CI Status

| Check | Result |
|-------|--------|
| Build | Not verified locally |
| Tests | PR has new spec file with adequate coverage |

## Code Snippets

### Core auto-select flow (auto-select-rules.ts)

```typescript
export async function autoSelectRules(
    userPrompt: string,
    availableRules: RuleMetadata[],
    cline: Task,
): Promise<AutoSelectResult> {
    // ... config resolution ...
    const ruleList = buildRuleList(availableRules)
    const systemPrompt = supportPrompt.create("AUTO_SELECT_RULES", { ruleList, userPrompt }, customSupportPrompts)
    const handler = buildApiHandler(profile)
    const { text, usage } = await streamResponseFromHandler(handler, `User's task:\n${userPrompt}`, systemPrompt)
    const selectedIndices = parseAutoSelectResponse(text, availableRules.length)
    // ... cost calculation, return ...
}
```

### Integration in Task.startTask() (Task.ts)

```typescript
const state = await this.providerRef.deref()?.getState()
if (state?.autoSelectRules && task) {
    const availableRules = await getRulesWithMetadata(this.cwd)
    if (availableRules.length > 0) {
        await this.say("text", "Auto-selecting rules...", undefined, true, ...)
        const result = await autoSelectRules(task, availableRules, this)
        this.autoSelectedRulePaths = result.selectedRulePaths
        await this.say("text", resultMessage, undefined, false, ...)
    }
}
```

### System prompt threading (system.ts)

```typescript
// Standard path - autoSelectedRulePaths IS passed
return generatePrompt(
    // ... 18 params ...
    autoSelectedRulePaths, // PR adds this
)

// File-based path - autoSelectedRulePaths IS NOT passed (BUG)
const customInstructions = await addCustomInstructions(
    baseInstructionsForFile, globalCustomInstructions || "", cwd, mode,
    { language, rooIgnoreInstructions, settings },
    // Missing: autoSelectedRulePaths
)
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**REQUEST_CHANGES**

The feature concept is well-designed: graceful degradation, support-prompt integration, separate API config for cost optimization, and good test coverage. However, two correctness issues need fixing:

1. **C1** -- The file-based system prompt path silently bypasses auto-selection. This is a real bug that affects users with custom system prompt files.
2. **C3** -- `String.includes()` for global path detection is fragile and can misclassify rules.

Both fixes are straightforward (add the parameter to the file-based path, switch to `startsWith` on resolved paths). Once addressed, this PR is ready to merge.
