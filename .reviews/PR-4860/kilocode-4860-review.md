<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 4860
title: "feat: Add reasoning and capability controls for OpenAI Compatible models"
author: benzntech
category: feature
tier: 6
lines: 1220
files: 40
verdict: REQUEST_CHANGES
confidence: high
reviewed_at: 2026-02-14
fork_pr: N/A (batch review)
linked_issue: N/A
-->

# Review: kilocode #4860

> **feat: Add reasoning and capability controls for OpenAI Compatible models** by @benzntech

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | FAIL | Heuristic false-positive risk; duplicated thinking injection; tool gating semantic gap |
| Conventions | WARN | Inconsistent i18n approach (English strings in all locale files) |
| Changeset | PASS | Correctly tagged as `minor` |
| Tests | PASS | Updated test mocks to match new conditional-fetch behavior |
| i18n | FAIL | 21 locale files with untranslated English strings for 3 new keys |
| Types | PASS | `ExtensionMessage` and `WebviewMessage` extended correctly |
| Security | PASS | No secrets, no user input passed unsanitized |
| Scope | FAIL | PR bundles 6+ unrelated changes (CI deps, whitespace, JSON dedup, JetBrains autogen, MiniMax removal, cli formatting) |

## Findings

### RED-1: Heuristic model-ID matching will false-positive on common substrings

**File**: `src/core/webview/webviewMessageHandler.ts` (lines added in `requestOpenAiModelInfo` handler)

The substring checks `lowerModelId.includes("r1")`, `.includes("o1")`, `.includes("o3")`, `.includes("vl")` will incorrectly match many non-reasoning / non-vision models:

- `"r1"` matches `"gpt4-turbo1"`, `"mistral-fr1"`, `"solar1"`, any model with `r1` anywhere
- `"o1"` matches `"proto1"`, `"falcon-180b-go1"`, any model string containing `o1`
- `"o3"` matches `"llama-3.2-90b-vision-preview"` (contains `o3`... wait, no, but `"को3"` etc.)
- `"vl"` matches `"qwen2.5-coder-7b-instruct"` (no), but does match `"devlog-7b"`, `"novel-writer"`, anything with `vl` -- e.g. `"evol-instruct"` contains `vl`

These should use word-boundary matching or more specific patterns like `/\br1\b/` or prefix/suffix checks (`-r1`, `r1-`, etc.).

```typescript
// Current (overly broad):
if (lowerModelId.includes("r1") || lowerModelId.includes("o1") || lowerModelId.includes("o3")) {
    modelInfo.supportsReasoningBinary = true
}

// Suggested fix:
const reasoningPatterns = [/\bdeepseek-r1\b/, /\bo[134]-/, /\breasoner\b/, /\bthinking\b/]
if (reasoningPatterns.some(p => p.test(lowerModelId))) {
    modelInfo.supportsReasoningBinary = true
}
```

Similarly `"vl"` is too short -- models like `"evol-coder"` would false-positive on image support.

### RED-2: `thinking: { type: "enabled" }` injected without `thinking_budget` or proper protocol handling

**File**: `src/api/providers/openai.ts` (4 occurrences in streaming, non-streaming, o3-streaming, o3-non-streaming)

The PR injects `{ thinking: { type: "enabled" } }` when `enableReasoningEffort && supportsReasoningBinary`. Two problems:

1. **No budget control**: The `thinking` parameter in the OpenAI API (for models like DeepSeek-R1 hosted on OpenAI-compatible endpoints) requires specifying a `budget_tokens` field for some providers. Sending just `{ type: "enabled" }` may not be valid for all endpoints.

2. **Duplicated logic with `base-openai-compatible-provider.ts`**: Lines 105-107 of `base-openai-compatible-provider.ts` already handle exactly this case. The `OpenAiHandler` does NOT extend `BaseOpenAiCompatibleProvider` (it extends `BaseProvider` directly), so the duplication is technically necessary, but the PR doesn't acknowledge or comment on this design debt. The same logic is copy-pasted 4 times across the file.

3. **Cast to `any`**: `as any` bypasses type safety entirely. Consider extending the OpenAI types or using a more specific type assertion.

```typescript
// Duplicated 4 times in openai.ts:
...((this.options.enableReasoningEffort && modelInfo.supportsReasoningBinary
    ? { thinking: { type: "enabled" } }
    : {}) as any),
```

### RED-3: `supportsNativeTools !== false` gating changes default behavior for existing users

**File**: `src/api/providers/openai.ts` (4 locations)

The existing code unconditionally sends tools when `metadata?.tools` is present. The PR gates this on `modelInfo.supportsNativeTools !== false`. Since `openAiModelInfoSaneDefaults` already sets `supportsNativeTools: true`, and `NATIVE_TOOL_DEFAULTS` also sets it to `true`, this gate should be safe for the default case.

However, the auto-fill mechanism can now overwrite `openAiCustomModelInfo` with data from OpenRouter or static maps that may have `supportsNativeTools: undefined` or `false`. If a user auto-fills a model that returns `supportsNativeTools: undefined`, the `!== false` check still passes (since `undefined !== false`), so this is technically safe. But if OpenRouter returns `supportsNativeTools: false` for a model the user was previously using successfully with tools, auto-fill would break their workflow silently.

The checkbox in the UI is the mitigation, but the auto-fill-on-model-change (`useEffect` that fires on `openAiModelId` change) means this can happen without the user clicking "Auto-fill" -- just by changing the model ID.

### YELLOW-1: Auto-fill fires on every model ID keystroke change

**File**: `webview-ui/src/components/settings/providers/OpenAICompatible.tsx`

```typescript
useEffect(() => {
    if (apiConfiguration?.openAiModelId) {
        vscode.postMessage({
            type: "requestOpenAiModelInfo",
            values: { openAiModelId: apiConfiguration.openAiModelId },
        })
    }
}, [apiConfiguration?.openAiModelId])
```

This fires a backend request (including an OpenRouter API call with cache flush potential) on every model ID change. If the user is typing `"deepseek-r1-distill-qwen-32b"`, this fires ~32 times. The model listing has a 500ms debounce (`useEffect` above it), but the model info auto-fill has NO debounce.

This is both a performance issue and a correctness issue -- intermediate partial model IDs like `"deep"` will trigger heuristic matching and potentially overwrite the user's carefully configured model info.

### YELLOW-2: Merge of static and OpenRouter data uses `??` which never overrides existing values

**File**: `src/core/webview/webviewMessageHandler.ts`

```typescript
modelInfo = {
    ...modelInfo,
    supportsComputerUse: staticModelInfo.supportsComputerUse ?? modelInfo.supportsComputerUse,
    supportsImages: staticModelInfo.supportsImages ?? modelInfo.supportsImages,
    // ...
}
```

The `??` operator means static map values only apply if the static value is non-nullish. But the intent is "static map is curated and authoritative for capability flags". If OpenRouter incorrectly says a model supports computer use (`true`) but the static map correctly says it doesn't (`false`), the static value would override. However, if the static map has `undefined` for a field and OpenRouter has `false`, the merge keeps `false` from OpenRouter. This is the correct behavior, just worth noting the asymmetry.

### YELLOW-3: `getOpenAiModelInfo()` fuzzy matching is bidirectional and can match wrong models

**File**: `src/api/providers/openai.ts`

```typescript
if (normalizedKey.includes(normalizedSearchId) || normalizedSearchId.includes(keyBase)) {
```

The second condition `normalizedSearchId.includes(keyBase)` means searching for `"gpt-4o-mini-special-edition"` would match `"gpt-4o-mini"` (correct) but also `"gpt-4o"` and `"gpt-4"` -- whichever appears first in the model map iteration. The `models` array iterates OpenAI first, so `"gpt-4"` from `openAiNativeModels` would match before Anthropic/Gemini models. Since it returns on first match, the ordering matters and could return wrong model info.

### YELLOW-4: Untranslated i18n strings in 21 locale files

All non-English locale files have English strings for `supportsReasoning`, `supportsNativeTools`, `supportsComputerUse`, and `autoFill`. The existing `computerUse` key already has a label/description in English in the EN file, and the PR adds a *new* key with a different structure under `customModel.supportsComputerUse` vs the existing `customModel.computerUse`. This creates a confusing duplication where two i18n keys refer to the same concept.

### GRAY-1: Scope creep -- PR bundles 6+ unrelated changes

The PR touches:
- CI workflow files (`libkrb5-dev` dependency)
- JetBrains `check-dependencies.js` (gradle.properties auto-generation)
- CLI auth formatting (indentation changes)
- CLI test formatting
- Docs whitespace changes
- Removal of `minimaxApiKey`/`getMiniMaxApiKey`/`minimaxBaseUrl` from EN settings.json
- Duplicate `"xhigh"` key fixes across 10+ locale files
- `docs/context-window-autofill.md` (design doc committed to repo)

These should be separate PRs. The MiniMax key removal in particular could break i18n lookups if any code references those keys.

### GRAY-2: Design doc committed to repo root

`docs/context-window-autofill.md` is a development planning document. This should live in the PR description or a wiki, not in the repository source tree.

### GRAY-3: `requestOpenAiModels` API key guard removed

**File**: `src/core/webview/webviewMessageHandler.ts`

```typescript
// Before: if (message?.values?.baseUrl && message?.values?.apiKey)
// After:  if (message?.values?.baseUrl)
```

This allows model listing without an API key. While some OpenAI-compatible endpoints don't require auth for `/models`, this could cause confusing error messages when the server does require auth.

## CI Status

| Check | Result |
|-------|--------|
| Build Docusaurus Site | PASS |
| build-cli | PASS |
| check-translations | PASS |
| compile | PASS |
| test-cli | PASS |
| test-extension (ubuntu) | PASS |
| test-extension (windows) | PASS |
| test-jetbrains | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |

## Code Snippets

### Thinking injection (4x copy-paste in openai.ts)
```typescript
...((this.options.enableReasoningEffort && modelInfo.supportsReasoningBinary
    ? { thinking: { type: "enabled" } }
    : {}) as any),
```

### Auto-fill without debounce
```typescript
useEffect(() => {
    if (apiConfiguration?.openAiModelId) {
        vscode.postMessage({
            type: "requestOpenAiModelInfo",
            values: { openAiModelId: apiConfiguration.openAiModelId },
        })
    }
}, [apiConfiguration?.openAiModelId])
```

### Heuristic false-positive patterns
```typescript
if (lowerModelId.includes("r1") || lowerModelId.includes("o1") || lowerModelId.includes("o3")) {
    modelInfo.supportsReasoningBinary = true
}
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

The feature concept is sound -- letting users configure reasoning, tool support, and computer use for OpenAI-compatible models fills a real gap. However, the implementation has several issues that need addressing before merge:

1. **Heuristic false-positives** (RED-1): Substring matching on `"r1"`, `"o1"`, `"o3"`, `"vl"` will incorrectly flag many unrelated models. Use word-boundary patterns.
2. **No debounce on auto-fill** (YELLOW-1): Every keystroke in the model ID field triggers an OpenRouter API call and heuristic matching, potentially overwriting user config mid-typing.
3. **Scope creep** (GRAY-1): 6+ unrelated changes (CI deps, formatting, MiniMax removal, locale dedup) should be separate PRs.
4. **4x code duplication** (RED-2): The `thinking` injection is copy-pasted across 4 request construction blocks in `openai.ts`. Extract to a helper method.
5. **Auto-fill on model change can silently break tools** (RED-3): Changing model ID triggers auto-fill which may set `supportsNativeTools` to `false`, breaking an existing working configuration.
