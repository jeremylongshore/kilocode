<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 4100
title: "[VIBE CODED] Feat: Intelligent provider"
author: ivanarifin
category: provider
tier: 5
lines: 1904
files: 50
verdict: REQUEST_CHANGES
confidence: 85
reviewed_at: 2026-02-15
-->

# Review: kilocode #4100

> **[VIBE CODED] Feat: Intelligent provider** by @ivanarifin

**Methodology**: [Kilo Code PR Review Process](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Summary

Large feature adding an "Intelligent Provider" that routes tasks to different AI provider profiles (easy/medium/hard) based on AI-driven difficulty classification of user prompts. The PR touches 50 files across the full stack: provider backend, types, CLI, webview UI, settings, and i18n for all 22 locales. Author explicitly tags this as "VIBE CODED."

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | Yellow | Tests mock everything -- never test real handler logic |
| Conventions | Yellow | Mostly follows provider patterns; some deviations |
| Changeset | Red | Missing changeset |
| Tests | Yellow | 390-line test file but mocks override all behavior |
| i18n | Pass | All 22 locales updated |
| Types | Pass | Zod schemas added properly |
| Security | Pass | No API keys stored directly; delegated to profile handlers |
| Scope | Yellow | Touches Task.ts, ChatTextArea.tsx in ways that affect all providers |
| kilocode_change markers | Yellow | Present on new files; some removed from existing lines |

## Findings

### Red -- Missing changeset

The changeset bot flagged this and no changeset was ever added. This is a `minor` feature addition that requires one.

### Red -- Tests do not test real implementation (intelligent-provider.spec.ts)

The test file creates a plain mock object with `vi.fn()` for every method and then asserts against those mocks. For example:

```typescript
handler.assessDifficulty.mockResolvedValue("easy")
const difficulty = await handler.assessDifficulty(prompt)
expect(difficulty).toBe("easy")
```

This is a tautology -- it tests that vitest mocks work, not that `IntelligentHandler.assessDifficulty()` actually classifies prompts correctly. The real `IntelligentHandler` class is imported but never instantiated in any test.

### Red -- Constructor name duck-typing in Task.ts

```typescript
if (this.api.constructor.name === "IntelligentHandler" && typeof (this.api as any).on === "function") {
```

Checking `constructor.name` is fragile -- minification will break it. The existing `VirtualQuotaFallbackHandler` uses `instanceof`. The comment says "circular dependency" prevents importing, but this should use the same EventEmitter check or a shared interface.

### Yellow -- AI classification adds latency and cost to every new user message

Every new user message triggers a full LLM API call to classify difficulty before the actual task begins. This is an extra round-trip with token cost, but there is no user-visible indication that classification is happening, no timeout, and no way to skip it. The classification prompt alone is ~600 tokens.

### Yellow -- `parseDifficultyResponse` has no validation

```typescript
private parseDifficultyResponse(response: string): "easy" | "medium" | "hard" {
    const jsonMatch = response.match(/\{[^}]+\}/)
    if (!jsonMatch) throw new Error(`Invalid AI response: ${response}`)
    const parsed = JSON.parse(jsonMatch[0])
    return parsed.difficulty.toLowerCase()
}
```

If the AI returns `{"difficulty":"extreme"}` or any value other than the three expected, the function returns it without validation. Should validate against the expected enum values and default to "medium".

### Yellow -- ChatTextArea.tsx changes affect all providers

The send button click handler was rewritten to add `setInputValue("")` and `setSelectedImages([])` before `onSend()`, and similar changes in the Enter key handler. This modifies the behavior for all providers, not just the intelligent provider, and may have side effects (e.g., clearing input before the message is actually sent).

### Yellow -- Removed `kilocode_change` markers from existing code

Lines in `provider-settings.ts` had their `// kilocode_change` comments removed:
```diff
-	glama: "glamaModelId", // kilocode_change
-	"nano-gpt": "nanoGptModelId", // kilocode_change
+	glama: "glamaModelId",
+	"nano-gpt": "nanoGptModelId",
```

These markers are required for fork management and should not be removed.

### Yellow -- `createTask` signature changed

The call to `provider.createTask()` in `webviewMessageHandler.ts` adds two extra arguments `(undefined, {})` which changes the call signature. The test expectations were updated too, but this is a cross-cutting change.

### Gray -- Maintainer has deprioritized this PR

Kevin (maintainer) commented that large features are being temporarily limited while a ground-up rebuild is underway. This PR is unlikely to be merged in its current form.

## CI Status

| Check | Result |
|-------|--------|
| check-translations | Fail |
| compile | Pass |
| test-extension (ubuntu) | Pass |
| test-extension (windows) | Pass |
| test-webview (ubuntu) | Pass |
| test-webview (windows) | Pass |
| test-cli | Pass |
| build-cli | Pass |
| test-jetbrains | Pass |

## Code Snippets

### Difficulty classifier prompt (intelligent.ts)
```typescript
private readonly CLASSIFIER_PROMPT = `You are an expert Task Complexity Classifier...
**Output:** JSON only: {"difficulty": "easy|medium|hard"}
```

### Fragile constructor name check (Task.ts)
```typescript
if (this.api.constructor.name === "IntelligentHandler" && typeof (this.api as any).on === "function") {
    ;(this.api as any).on("handlerChanged", () => {
        this.emit("modelChanged")
    })
}
```

## Verdict

**REQUEST_CHANGES** -- The concept of difficulty-based provider routing is sound, but the implementation has significant issues: tests are tautological (testing mocks, not real code), the constructor name check is fragile, input validation on the AI response is missing, cross-cutting changes to ChatTextArea and the createTask signature affect all providers, kilocode_change markers were removed from existing code, and no changeset is included. Additionally, the maintainer has indicated this PR is unlikely to be merged in the current extension lifecycle. If the feature is pursued in the rebuild, the AI classification logic needs proper testing with real handler instantiation, and the Task.ts integration should use a shared interface rather than string-based type checking.
