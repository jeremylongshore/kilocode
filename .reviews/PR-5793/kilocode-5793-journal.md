<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5793
title: "feat: Add AWS Bedrock Inference Profile ARN resolution support"
author: marcelloceschia
category: feature
tier: 6
lines: 2041
files: 22
review_number: 23
fork_pr: pending
-->

# Review Journal: kilocode #5793

> **PR**: [#5793](https://github.com/Kilo-Org/kilocode/pull/5793) |
> **Title**: feat: Add AWS Bedrock Inference Profile ARN resolution support |
> **Author**: @marcelloceschia |
> **Category**: feature | **Tier**: 6 | **Size**: 2041 lines, 22 files

---

## Summary

Adds resolution of AWS Bedrock inference profile ARNs (both `application-inference-profile` and `inference-profile` types) to their underlying foundation models, enabling correct capability detection for prompt caching, extended context, and reasoning budgets. The core resolver is architecturally sound, but the UI integration has a critical field name mismatch that prevents the resolution feedback from ever appearing, plus a React render loop bug and unrelated file changes that need cleanup.

## First Impressions

The PR description is thorough, with before/after screenshots and clear test instructions. The 22-file diff is large but the title signals a focused feature. Initial concern: 2,041 lines for what is essentially "resolve ARN -> look up model ID -> use existing capabilities" felt heavy. Turns out ~370 lines are unrelated formatting, ~818 lines are lockfile, and ~435 lines are tests, leaving roughly 400 lines of actual feature code. That is reasonable.

The author (marcelloceschia) works at a company using Bedrock with inference profiles in production (their AWS SA is involved). This gives credibility to the use case. kevinvandijk already reviewed and requested changes on four items. I need to verify whether those were addressed.

## What I Looked At

**Core files (new):**
- `src/api/providers/bedrock-inference-profile-resolver.ts` -- 179 lines, the resolver class
- `src/api/providers/__tests__/bedrock-inference-profile-resolver.spec.ts` -- 209 lines
- `src/api/providers/__tests__/bedrock-application-inference-profile.spec.ts` -- 226 lines

**Modified files (feature):**
- `src/api/providers/bedrock.ts` -- +89/-4, async resolution integration
- `src/core/webview/webviewMessageHandler.ts` -- +43, message handler for UI resolution
- `packages/types/src/vscode-extension-host.ts` -- +4, new message types
- `webview-ui/src/components/settings/providers/BedrockCustomArn.tsx` -- +137/-3, UI resolution feedback
- `webview-ui/src/components/settings/providers/Bedrock.tsx` -- +22/-3, effectiveModelInfo plumbing
- `webview-ui/src/components/settings/ApiOptions.tsx` -- +27/-7, resolved model state management

**Modified files (unrelated):**
- `docs/plans/2026-01-20-apertis-provider-design.md` -- 161 lines of indent reformatting
- `apps/kilocode-docs/pages/code-with-ai/platforms/cli.md` -- spacing changes
- `jetbrains/scripts/check-dependencies.js` -- removed variable declaration (breaks script)
- `src/api/providers/chutes.ts`, `src/api/transform/ai-sdk.ts` -- formatting only
- Multiple others with trivial whitespace changes

**Existing review context:**
- kevinvandijk's four review comments (all addressed per author, verified one was done incorrectly)
- Changeset bot detected proper changeset
- Discussion about updating default Bedrock model (deferred to follow-up)

## Analysis

### The Core Architecture

The resolver follows a clean separation:

1. **Control plane**: `BedrockClient` calls `GetInferenceProfile` API to resolve an inference profile ARN to its underlying foundation model ARN.
2. **Model ID extraction**: Regex parses the foundation model ARN to extract the model ID (e.g., `anthropic.claude-haiku-4-5-20251001-v1:0`).
3. **Capability lookup**: The extracted model ID is looked up in `bedrockModels` (the existing model registry) to get `ModelInfo` with `supportsPromptCache`, `contextWindow`, `supportsReasoningBudget`, etc.

This avoids duplicating model capability definitions. If a model is in the registry, the resolver automatically picks up its full capability set. If not, the existing `guessModelInfoFromId` heuristic provides fallback detection.

### The Field Name Mismatch Bug

This is the most instructive finding. kevinvandijk's review asked the author to rename generic `modelId`/`modelArn` fields to `bedrockInferenceModelId`/`bedrockInferenceModelArn`. The author did this in the message handler (sender side) but not in the BedrockCustomArn component (receiver side). The receiver still checks `message.modelId`, which is always `undefined` on the `bedrockInferenceProfileResolved` message.

What makes this subtle is that the code does not crash. The `if (message.modelId)` check simply evaluates to `false`, the resolution completes silently, and the UI shows the "Click Resolve" prompt as if nothing happened. Without manual testing, this bug is invisible.

### The Render Loop

The `useEffect` for auto-resolution has `apiConfiguration` (object) in its dependency array alongside `apiConfiguration.awsCustomArn` (string). In React, a new object reference triggers the effect even when content has not changed. The effect calls `onResolvedModelInfo(null)` which updates parent state, which re-renders with a new `apiConfiguration` object, which fires the effect again. This is a textbook React infinite loop.

The fix is straightforward: remove the `apiConfiguration` object from the dependency array and rely on the individual property (`apiConfiguration.awsCustomArn`). The `handleResolveArn` callback also has `apiConfiguration` in its `useCallback` dependency, so it changes on every render too, compounding the problem.

### The Race Condition Pattern

The constructor calls `resolveInferenceProfileAsync()` without awaiting or storing the promise. This is a deliberate trade-off: the constructor cannot be async, and blocking construction would change the handler's initialization contract. However, the resolution involves an AWS API call that could take 100-500ms, while the first `createMessage()` call could arrive immediately.

The test for this acknowledges the problem:
```typescript
try {
    await generator.next()
} catch (e) {
    // We expect this to fail since we haven't fully mocked the stream
    // But the important part is that the resolution was called
}
```

This verifies resolution was *called* but not that it *completed* before the message was sent. In practice, the second and subsequent messages will have the resolved model (since the promise will have settled by then), so the impact is limited to the first message in a conversation. But prompt caching on the first message matters for cost.

### Credential Handling Duplication

The resolver replicates the credential initialization logic from `bedrock.ts` constructor (API key, profile, access key/secret). This is necessary because `BedrockClient` and `BedrockRuntimeClient` are separate AWS SDK classes that cannot share a client instance. However, the credential logic is now in two places. A shared `createBedrockCredentials(options)` factory would reduce duplication, though that is a refactoring suggestion, not a blocker.

## Verification

- No CI checks have run on this PR
- No codespace build or test run performed (no fork branch created yet)
- Manual code review only for this pass
- The field name mismatch and render loop were identified through code reading, not runtime testing

## Diagrams

### Resolution Flow

```
User enters inference profile ARN
         |
         v
BedrockCustomArn (UI)
  - validateBedrockArn()
  - Detects :application-inference-profile/ or :inference-profile/
  - Posts "resolveBedrockInferenceProfile" message
         |
         v
webviewMessageHandler.ts
  - Imports BedrockInferenceProfileResolver
  - Gets current ProviderSettings
  - Calls resolver.resolveInferenceProfile(arn)
         |
         v
BedrockInferenceProfileResolver
  - Creates BedrockClient (control plane)
  - Calls GetInferenceProfile API
  - Extracts model ID from response ARN
  - Returns { modelId, modelArn }
         |
         v
webviewMessageHandler.ts
  - Posts "bedrockInferenceProfileResolved" with bedrockInferenceModelId
         |
         v
BedrockCustomArn (UI) [BUG: reads message.modelId, should read message.bedrockInferenceModelId]
  - Shows resolved model info
  - Notifies parent via onResolvedModelInfo()
         |
         v
ApiOptions.tsx
  - Updates resolvedBedrockModelId state
  - Looks up model in bedrockModels registry
  - Passes effectiveModelInfo to Bedrock component
```

### Parallel path (runtime):
```
AwsBedrockHandler constructor
  - Detects inference profile ARN
  - Fires resolveInferenceProfileAsync() (no await)
  - Sets this.resolvedModelIdFromProfile when complete
  - Updates this.costModelConfig with resolved model capabilities
         |
         v
createMessage() [may arrive before resolution completes]
  - Uses resolvedModelIdFromProfile if available
  - Falls back to parsed ARN model ID if not
```

## Lessons Learned

1. **When a reviewer asks you to rename a field, grep for all usages.** The mismatch between sender and receiver is a classic rename-incomplete bug. Always search the codebase for all references before calling a rename "done."

2. **Never put parent-passed objects in useEffect dependency arrays.** Use individual properties (primitives) instead. Objects change reference identity on every render in React, creating exactly this kind of infinite loop.

3. **Fire-and-forget async in constructors needs a lazy-await pattern.** Store the promise and `await` it at the point of consumption rather than hoping the network call finishes before the consumer arrives.

4. **Unrelated formatting changes make reviews harder and hide real bugs.** The 370 lines of whitespace noise forced me to carefully filter signal from noise across 22 files. A separate formatting PR costs minutes; reviewing interleaved formatting costs hours.

5. **The try/catch anti-pattern in tests.** When a test wraps `generator.next()` in try/catch and ignores the error, it proves the code was called but not that it produced the right result. Tests should assert on the outcome, not just the invocation.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
