<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5642
title: "feat: allow auto-selecting rules based on prompt and context"
author: shssoichiro
category: feature
tier: 6
lines: 1043
files: 67
verdict: COMMENT
confidence: 0.80
reviewed_at: 2026-02-15
review_number: 69
-->

# Review: kilocode #5642

> **feat: allow auto-selecting rules based on prompt and context** by @shssoichiro

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | pass | Graceful fallback to all rules on error. Response parsing handles edge cases. |
| Conventions | pass | `kilocode_change` markers used throughout shared code |
| Changeset | pass | Minor changeset for `kilo-code` |
| Tests | pass | Good coverage: return types, empty rules, response parsing, error handling, cost calculation |
| i18n | pass | 24 language files updated with new keys |
| Types | pass | New `RuleMetadata` interface, `AutoSelectResult` properly typed |
| Security | info | LLM sees first 200 chars of each rule -- no credential risk unless rules contain secrets |
| Scope | info | 67 files but 48 are i18n, core changes are focused |

## Findings

### Yellow: LLM call on every task start

`src/core/task/Task.ts` runs `autoSelectRules()` in `startTask()`, meaning every user message triggers an LLM call before the main task begins. For users with many rules, this adds latency and cost to every interaction. Consider caching selections for similar prompts or adding a debounce.

### Yellow: Rule description uses raw file content prefix

`src/core/webview/kilorules.ts#extractDescription` uses the first 200 characters of rule file content as the description. Many rule files begin with YAML frontmatter, headers, or comments that are not descriptive of the rule's purpose. Supporting an explicit description field in rule metadata would produce better LLM selections.

### Yellow: Global vs. local detection via string path matching

`src/core/prompts/sections/custom-instructions.ts` determines if a rule is global with:
```typescript
const isGlobal = rulePath.includes(path.join(os.homedir(), ".kilocode"))
```
This is brittle -- it fails if the home directory itself contains ".kilocode" elsewhere in the path.

### Yellow: Hardcoded emoji strings in chat messages

`src/core/task/Task.ts` uses hardcoded strings with emojis for user-facing messages instead of i18n translation keys. These should use the localization system for consistency.

### Gray: File I/O on every request

`getRulesWithMetadata()` reads all rule files from disk on every task start. Consider caching within a session since rule files rarely change mid-interaction.

### Gray: No guarantee partial message resolves on error

The loading/completion pattern uses `partial=true` then `partial=false`, but if an exception occurs between the two calls, the catch block continues without resolving the partial message. The user might see a stuck loading indicator.

## CI Status

| Check | Result |
|-------|--------|
| compile | pass |
| test-extension (ubuntu) | pass |
| test-extension (windows) | pass |
| test-webview (ubuntu) | pass |
| test-webview (windows) | pass |
| test-cli | pass |
| check-translations | pass |
| build-cli | pass |

## Code Snippets

Core auto-selection logic in `src/core/auto-select/auto-select-rules.ts`:
```typescript
export async function autoSelectRules(
    userPrompt: string,
    availableRules: RuleMetadata[],
    cline: Task,
): Promise<AutoSelectResult> {
    // Falls back to all rules on any error -- safe default
    // Uses configurable support prompt system
    // Parses comma-separated indices from LLM response
}
```

Prompt template in `src/shared/support-prompt.ts`:
```
AVAILABLE RULES:
${ruleList}

INSTRUCTIONS:
1. Analyze the user's task/prompt below
2. Determine which rules are relevant
3. Respond with ONLY a comma-separated list of rule indices
4. If no rules are relevant, respond with "none"
```

## Verdict

**COMMENT** -- The feature is well-structured and addresses a real UX need for users with many rules. The graceful fallback behavior and test coverage are solid. The main concerns are the per-message LLM overhead, brittle path-based global/local detection, and hardcoded UI strings. These are addressable without architectural changes.

---

Review conducted per [Kilo Code PR Review Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md).
