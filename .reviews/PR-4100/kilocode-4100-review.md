<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 4100
title: "[VIBE CODED] Feat: Intelligent provider"
author: ivanarifin
category: provider
tier: 3
lines: 1904
files: 50
verdict: REQUEST_CHANGES
confidence: high
reviewed_at: 2026-02-14
fork_pr: N/A (batch review)
linked_issue: N/A
-->

# Review: kilocode #4100

> **[VIBE CODED] Feat: Intelligent provider** by @ivanarifin

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | FAIL | Schema collision breaks virtual-quota-fallback; constructor.name check breaks under minification |
| Conventions | WARN | Stray `gemini-cli` entry; removed `kilocode_change` comment markers |
| Changeset | FAIL | Missing changeset |
| Tests | FAIL | All tests are sham -- they assert mock return values, not real logic |
| i18n | PASS | All 22 locales covered |
| Types | FAIL | `profiles` field collision in flattened `providerSettingsSchema` |
| Security | PASS | No credential exposure; classification prompt is read-only |
| Scope | WARN | Unnecessary changes to ChatTextArea input clearing and webviewMessageHandler signature |

## Findings

### RED-1: `profiles` field collision in flattened `providerSettingsSchema`

**`packages/types/src/provider-settings.ts`** -- the flattened schema spread

Both `virtualQuotaFallbackSchema` and the new `intelligentSchema` define a `profiles` field with incompatible Zod array element types. In the flattened `providerSettingsSchema` (line ~653), both are spread:

```typescript
...virtualQuotaFallbackSchema.shape,   // profiles: z.array(virtualQuotaFallbackProfileDataSchema)
...intelligentSchema.shape,            // profiles: z.array(intelligentProfileSchema) -- OVERWRITES
```

The last spread wins. The intelligent schema's `profiles` silently replaces the virtual-quota-fallback `profiles` definition, breaking validation for that existing provider. The discriminated union (`providerSettingsSchemaDiscriminated`) at line ~607 handles this correctly because each branch is keyed by `apiProvider`, but the flattened schema is used by other consumers.

**Fix:** Rename the intelligent provider's field to `intelligentProfiles` to avoid the collision, or restructure the flattened schema.

### RED-2: Tests are sham -- zero lines of `IntelligentHandler` exercised

**`src/api/providers/__tests__/intelligent-provider.spec.ts`**

The test file imports `IntelligentHandler` but **never instantiates it**. Instead, `handler` at line 278 is a hand-built plain object with `vi.fn()` mocks:

```typescript
handler = {
    assessDifficulty: vi.fn().mockImplementation((prompt: string) => {
        // keyword-based mock, NOT the real IntelligentHandler.assessDifficulty
    }),
    extractUserPrompt: vi.fn().mockImplementation(...),
    // ...
}
```

Every assertion like:
```typescript
handler.assessDifficulty.mockResolvedValue("easy")
const difficulty = await handler.assessDifficulty(prompt)
expect(difficulty).toBe("easy")
```
is a tautology -- it tests that a mock returns what it was told to return. The "stickiness" test (line 556) and "prevent aggressive downgrading" test (line 569) set `handler.activeDifficulty` manually and mock the return, testing nothing real. The `extractUserPrompt` method tested at line 388 does not even exist on `IntelligentHandler`.

### RED-3: Constructor-name-based type check breaks under minification

**`src/core/task/Task.ts`** -- around the `handlerChanged` listener setup

```typescript
if (this.api.constructor.name === "IntelligentHandler" && typeof (this.api as any).on === "function") {
```

`constructor.name` is mangled by production bundlers (esbuild, webpack, terser). The existing `VirtualQuotaFallbackHandler` check at the same location correctly uses `instanceof`. The claimed circular dependency preventing `import { IntelligentHandler }` is unsubstantiated; if real, the fix should be a shared interface or type guard, not string comparison.

### RED-4: Stray `gemini-cli` provider entry with no backing implementation

**`webview-ui/src/components/settings/constants.ts`** -- line ~68

```typescript
{ value: "gemini-cli", label: "Gemini CLI", proxy: false },
```

This adds a provider to the settings dropdown that has no handler, no schema, no types. Selecting it would produce undefined behavior. This is a development leftover.

### YELLOW-1: ChatTextArea redundant input clearing

**`webview-ui/src/components/chat/ChatTextArea.tsx`** -- Enter key handler (~line 830) and send button (~line 1810)

The PR adds `setInputValue("")` and `setSelectedImages([])` before calling `onSend()` in both handlers. However, `onSend` is `() => handleSendMessage(inputValue, selectedImages)` (ChatView.tsx:1897), and `handleSendMessage` already calls `handleChatReset()` which does both clears (ChatView.tsx:677-679). This creates confusing ownership: ChatTextArea should not manage its parent's state clearing.

While React's batched state updates prevent the clear from taking effect before `onSend()` reads the closure, this relies on a scheduler implementation detail and is fragile.

### YELLOW-2: No error recovery in classification

**`src/api/providers/intelligent.ts`** -- `assessDifficultyWithAI` method (~line 1024)

```typescript
} catch (error) {
    console.error("AI classification failed:", error)
    throw error  // kills the entire message
}
```

If the classifier profile has an expired API key, hits a rate limit, or has a network error, the entire user message fails. This should fall back to a default difficulty (medium) with a user warning rather than crashing the message flow.

### YELLOW-3: Classification latency for every new message

**`src/api/providers/intelligent.ts`** -- `createMessage` method

Every new user message triggers a full LLM API round-trip for classification before the real response begins. For trivial messages like "hi" or "thanks", this adds 2-5 seconds of latency. The PR description and tests mention "stickiness for short follow-ups" and "prevent aggressive downgrading," but neither behavior exists in the actual `IntelligentHandler` implementation -- those are only in the mocked tests.

### YELLOW-4: Unnecessary `webviewMessageHandler.ts` signature change

**`src/core/webview/webviewMessageHandler.ts`** -- line 605

```diff
-await provider.createTask(resolved.text, resolved.images)
+await provider.createTask(resolved.text, resolved.images, undefined, {})
```

The `createTask` signature already has defaults (`parentTask?: Task, options: CreateTaskOptions = {}`), so passing explicit `undefined` and `{}` is redundant and couples the caller to internal parameter ordering.

### GRAY-1: Removed `// kilocode_change` comment markers

**`packages/types/src/provider-settings.ts`** -- lines ~108-109

The PR strips `// kilocode_change` attribution comments from two existing lines (`glama` and `nano-gpt`). These markers track fork-specific additions and shouldn't be removed.

## CI Status

| Check | Result |
|-------|--------|
| Merge state | CONFLICTING -- cannot merge into main |
| Changeset | Missing |
| Existing reviews | 1 APPROVED (Ari4ka -- no review body) |

## Code Snippets

### The schema collision (critical path)

```typescript
// packages/types/src/provider-settings.ts -- flattened schema
export const providerSettingsSchema = z.object({
    // ...
    ...virtualQuotaFallbackSchema.shape,  // defines profiles: z.array(virtualQuotaFallbackProfileDataSchema)
    ...intelligentSchema.shape,           // defines profiles: z.array(intelligentProfileSchema) -- OVERWRITES!
    // ...
})
```

### The sham test pattern

```typescript
// src/api/providers/__tests__/intelligent-provider.spec.ts
handler.assessDifficulty.mockResolvedValue("easy")        // tell mock to return "easy"
const difficulty = await handler.assessDifficulty(prompt)  // call the mock
expect(difficulty).toBe("easy")                            // surprised pikachu
```

### The fragile type check

```typescript
// src/core/task/Task.ts
// existing VirtualQuotaFallbackHandler check (correct):
if (this.api instanceof VirtualQuotaFallbackHandler) {

// new IntelligentHandler check (fragile):
if (this.api.constructor.name === "IntelligentHandler" && ...)
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

The "Intelligent Provider" concept is genuinely useful -- auto-routing by difficulty to save cost on easy tasks while using stronger models for hard ones. The UI components are well-built and the i18n coverage is complete.

However, four blocking issues prevent merge:

1. **Schema collision** in the flattened provider settings breaks the existing virtual-quota-fallback provider
2. **Sham tests** that exercise zero lines of real code provide false confidence
3. **`constructor.name` check** breaks under production bundling
4. **Stray `gemini-cli` entry** adds a broken provider to the UI

Additionally, the PR has merge conflicts with main and is missing a changeset.

The author should:
- Rename the `profiles` field to `intelligentProfiles` (or similar) to avoid collision
- Write tests that instantiate `IntelligentHandler` and test actual behavior
- Replace the `constructor.name` check with `instanceof` or a shared interface
- Remove the `gemini-cli` entry from settings constants
- Remove redundant `ChatTextArea` input-clearing and the unnecessary `webviewMessageHandler.ts` change
- Add error recovery (default to medium) when classification fails
