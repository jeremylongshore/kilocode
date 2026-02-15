<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5793
title: "feat: Add AWS Bedrock Inference Profile ARN resolution support"
author: marcelloceschia
category: feature
tier: 6
lines: 2041
files: 22
verdict: REQUEST_CHANGES
confidence: 4
reviewed_at: 2026-02-14
linked_issue: none
fork_pr: pending
-->

# Review: kilocode #5793

> **feat: Add AWS Bedrock Inference Profile ARN resolution support** by @marcelloceschia

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | FAIL | Critical field name mismatch between sender and receiver breaks the UI |
| Conventions | WARN | ~370 lines of unrelated formatting/whitespace changes inflate the diff |
| Changeset | PASS | `.changeset/funky-snails-teach.md` present |
| Tests | WARN | Resolver tests are solid; integration tests use try/catch anti-pattern |
| i18n | FAIL | UI strings in BedrockCustomArn are hardcoded English |
| Types | WARN | Unused import, `clientConfig: any` defeats type safety |
| Security | PASS | Credentials handled consistently with existing bedrock.ts pattern |
| Scope | FAIL | Formatting noise across 7+ unrelated files, JetBrains script breakage |

## Findings

### RED: Field name mismatch -- UI resolution is broken

**Files**: `src/core/webview/webviewMessageHandler.ts:1323`, `webview-ui/src/components/settings/providers/BedrockCustomArn.tsx:55`

The webview message handler sends:
```typescript
provider.postMessageToWebview({
    type: "bedrockInferenceProfileResolved",
    bedrockInferenceModelId: result.modelId,   // field: bedrockInferenceModelId
    bedrockInferenceModelArn: result.modelArn,
})
```

The BedrockCustomArn component reads:
```typescript
if (message.modelId) {                          // field: modelId -- never matches
    setResolvedModelId(message.modelId)
```

`message.modelId` is always `undefined`. The resolved model never populates in the UI. This happened because kevinvandijk asked for the field names to be changed from generic `modelId`/`modelArn` to `bedrockInferenceModelId`/`bedrockInferenceModelArn`, and the handler was updated but the receiver was not. The fix is to update the component to read `message.bedrockInferenceModelId` and `message.bedrockInferenceModelArn`.

### RED: `let majorVersion = null` removed -- breaks check-dependencies.js

**File**: `jetbrains/scripts/check-dependencies.js:106`

The PR removes `let majorVersion = null` but the variable is still assigned on lines 110, 112 (`majorVersion = newFormatMatch[1]`) and read on lines 119, 121, 128, 131, 134. Without the declaration, in strict mode this is a ReferenceError. In non-strict mode it silently creates a global variable. Either way, this is a regression in a file unrelated to the PR's purpose.

kevinvandijk flagged this and the author agreed to revert, but the latest commit still includes the change.

### RED: useEffect dependency array causes infinite render loop

**File**: `webview-ui/src/components/settings/providers/BedrockCustomArn.tsx:99`

```typescript
useEffect(() => {
    setResolvedModelId(null)        // clears state
    setResolutionError(null)
    if (onResolvedModelInfo) {
        onResolvedModelInfo(null)   // triggers parent re-render
    }
    if (/* valid inference profile ARN */) {
        handleResolveArn()
    }
}, [apiConfiguration.awsCustomArn, validation.isValid,
    onResolvedModelInfo, handleResolveArn, apiConfiguration])
//                                        ^^^^^^^^^^^^^^^^^
//     object reference changes every render
```

`apiConfiguration` is an object whose reference changes on every parent render. This effect fires, calls `onResolvedModelInfo(null)`, which updates parent state (`setResolvedBedrockModelId(null)`), causing the parent to re-render with a new `apiConfiguration` reference, firing this effect again. Infinite loop.

Fix: Remove `apiConfiguration` from the dependency array (the individual fields already provide the needed reactivity). Also consider debouncing `handleResolveArn` since ARNs are typed character-by-character.

### YELLOW: Race condition -- async resolution may miss first request

**File**: `src/api/providers/bedrock.ts:258`

The constructor fires `resolveInferenceProfileAsync()` as fire-and-forget (no `await`, no promise stored). If `createMessage()` is called before resolution completes, `resolvedModelIdFromProfile` is `null` and the first request uses fallback model capabilities (no prompt caching, wrong context window). The test works around this:

```typescript
try {
    await generator.next()
} catch (e) {
    // We expect this to fail since we haven't fully mocked the stream
    // But the important part is that the resolution was called
}
```

This masks whether resolution actually completed before the API call was made.

Consider storing the resolution promise and awaiting it lazily in `createMessage`:
```typescript
private resolutionPromise: Promise<void> | null = null
// in constructor:
this.resolutionPromise = this.resolveInferenceProfileAsync(arn)
// in createMessage:
if (this.resolutionPromise) await this.resolutionPromise
```

### YELLOW: Excessive logger.info calls -- production log noise

**Files**: `src/api/providers/bedrock.ts:1050-1100`, `src/api/providers/bedrock-inference-profile-resolver.ts`

Eight `logger.info` calls for a single resolution cycle. The most concerning is in `getModelById`:
```typescript
logger.info("Using resolved model ID from inference profile", {
    ctx: "bedrock",
    originalModelId: modelId,
    resolvedModelId: effectiveModelId,
})
```
This fires on every `getModelById` call, which happens multiple times per request. These should be `logger.debug`.

### YELLOW: Unused import and `any`-typed config

**File**: `src/api/providers/bedrock-inference-profile-resolver.ts:3,34`

```typescript
import type { BedrockRuntimeClientConfig } from "@aws-sdk/client-bedrock-runtime"  // never used
// ...
const clientConfig: any = {  // should be BedrockClientConfig from @aws-sdk/client-bedrock
```

### YELLOW: AWS SDK version skew inflates lockfile by 1,881 lines

**File**: `pnpm-lock.yaml`

`@aws-sdk/client-bedrock` resolves to `3.986.0` while `@aws-sdk/client-bedrock-runtime` stays at `3.922.0`. This pulls duplicate transitive dependencies at different major-minor versions (`@aws-sdk/core` at 3.922.0 and 3.973.7, plus credential providers at both version sets). Either pin both to the same version or update `@aws-sdk/client-bedrock-runtime` to match.

### YELLOW: ~370 lines of unrelated formatting changes

**Files**: `docs/plans/2026-01-20-apertis-provider-design.md` (161 lines of indent changes), `apps/kilocode-docs/pages/code-with-ai/platforms/cli.md`, `apps/kilocode-docs/pages/customize/index.md`, `webview-ui/src/utils/costFormatting.ts`, `webview-ui/src/components/kilocode/hooks/useProviderModels.ts`, `src/api/providers/chutes.ts`, `src/api/transform/ai-sdk.ts`

Tab/space conversions, import reordering, trailing whitespace removal. These should be a separate formatting PR.

### YELLOW: Hardcoded English strings bypass i18n

**File**: `webview-ui/src/components/settings/providers/BedrockCustomArn.tsx:128-187`

New UI strings are all hardcoded English: "Inference Profile Resolution", "Resolving...", "Resolve", "Underlying Model:", "This model's capabilities...", etc. The component already imports `useAppTranslation()`. These need i18n keys added to the locale files.

### YELLOW: CHANGELOG.md manually edited

**File**: `CHANGELOG.md`

The PR adds a `## 5.8.0` section. This repo auto-generates CHANGELOG.md from changesets during release. Manual edits cause merge conflicts. kevinvandijk already flagged this.

### YELLOW: `@kilocode/core-schemas` dependency added without cause

**File**: `src/package.json:676`

`@kilocode/core-schemas` is added as a dependency but nothing in this PR imports from it. Appears to be an artifact from a rebase.

### GREEN: Resolver architecture is sound

The `BedrockInferenceProfileResolver` cleanly separates control-plane operations (`BedrockClient` for `GetInferenceProfile`) from data-plane operations (`BedrockRuntimeClient` for inference). Credential handling mirrors the existing bedrock.ts pattern. The static `shouldResolveArn()` method provides a clean detection gate. In-memory caching prevents redundant API calls.

### GREEN: Resolver test coverage

209 lines in `bedrock-inference-profile-resolver.spec.ts` covering: both ARN types, caching, error handling, edge cases (empty models array), cache clearing. Proper mock isolation.

### GREEN: getModelById integration approach

Resolving the inference profile to a known model ID and looking it up in the existing `bedrockModels` registry means all capability detection flows through the existing system without duplication. The `skipResolvedOverride` parameter prevents infinite recursion when `resolveInferenceProfileAsync` calls `getModelById` internally.

## CI Status

No CI checks have run on this PR's branch.

## Existing Review Context

kevinvandijk (maintainer) requested changes on four items:
1. JetBrains build script changes (unrelated) -- author agreed to revert, not yet done
2. CHANGELOG.md manual edit -- author says resolved, still present
3. Generic message field names -- author renamed fields in handler but not in receiver (creating the mismatch bug)
4. Type issue in `packages/types/src/providers/bedrock.ts:532` -- author says fixed

## Verdict

**REQUEST_CHANGES** -- The core resolver is well-designed and solves a real problem (inference profile ARNs losing model capabilities like prompt caching). Three blocking issues: (1) the field name mismatch between `webviewMessageHandler.ts` and `BedrockCustomArn.tsx` means the UI feature is non-functional, (2) the `useEffect` dependency array including `apiConfiguration` as an object reference will cause infinite re-renders, and (3) the JetBrains `check-dependencies.js` change removes a variable declaration that is still referenced. Beyond those, the unrelated formatting noise (~370 lines), missing i18n, race condition in async resolution, and log verbosity need attention. Fix the three red items, separate the formatting changes, and this becomes a strong contribution.
