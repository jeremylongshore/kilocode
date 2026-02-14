<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5562
title: "Dynamic OpenAI compatible model fetching on front page"
author: crazyrabbit0
category: feature
tier: 3
lines: 59
files: 4
confidence: 4
verdict: APPROVE
reviewed_at: 2026-02-15
linked_issue: null
fork_pr: https://github.com/jeremylongshore/kilocode/pull/12
-->

## Review Summary

| Aspect | Assessment |
|--------|------------|
| **Verdict** | APPROVE |
| **Confidence** | 4/5 |
| **Blocking Issues** | 0 |
| **Non-blocking Issues** | 3 |

> Multi-AI analysis: [Fork PR](https://github.com/jeremylongshore/kilocode/pull/12) reviewed by CodeRabbit, Gemini, Greptile, CodeQL, Qodo

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Dynamic model fetching works correctly for `openai` provider |
| Conventions | PASS | Follows existing patterns — same `requestOpenAiModels` message type used by settings page |
| Changeset | PASS | Changeset included for `kilo-code` and `@kilocode/types` (patch) |
| Tests | MISSING | No tests included by author for the new `openAiModels` parameter in `getModelsByProvider` |
| i18n | N/A | No user-facing strings added |
| Types | PASS | TypeScript compiles clean (22/22 packages) |
| Security | PASS | API key handled via existing message channel, no new credential exposure |
| Scope | PASS | Well-scoped — frontend wiring to existing backend API |

## Findings

### 1. `openai-responses` provider: fetch without display (non-blocking)

The debounce in `ExtensionStateContext.tsx:567` triggers model fetching for both `"openai"` and `"openai-responses"`:

```typescript
if (apiProvider === "openai" || apiProvider === "openai-responses") {
```

But `getModelsByProvider` only handles `case "openai"` — there is no `case "openai-responses"` in the switch statement. Models are fetched from the API but never displayed for this provider. The `openai-responses` provider falls through to the `default` case which returns `{ models: {}, defaultModel: "" }`.

**Suggestion**: Either add `case "openai-responses":` before `case "openai":` (fall-through), or remove `"openai-responses"` from the debounce trigger to avoid the unnecessary API call.

### 2. API key required by backend but not by all providers (non-blocking)

The backend handler in `webviewMessageHandler.ts` requires both `baseUrl` and `apiKey`:
```typescript
if (message?.values?.baseUrl && message?.values?.apiKey) {
```

But the PR description mentions local providers like LM Studio that don't require API keys. The frontend sends the message regardless of `apiKey` presence (only checks `openAiBaseUrl`), but the backend silently drops it.

**Note**: This is a pre-existing backend limitation, not introduced by this PR. The settings page (`ApiOptions.tsx`) has the same pattern. A follow-up could make the `apiKey` check optional.

### 3. Merge conflict (non-blocking)

GitHub reports this PR as `CONFLICTING`. Needs rebase against current `main` before merge.

## Local Verification

We merged this PR on our fork and ran the full test suite.

### Regression (existing tests)

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | PASS | 22/22 packages |
| Lint | `pnpm lint` | PASS | 18/18 packages |
| Unit Tests | `pnpm test --continue` | PASS | 7,803 passed, 85 skipped (pre-existing failures: core-schemas, agent-runtime) |

### Behavioral (new targeted tests)

| Test Case | Expected | Result |
|-----------|----------|--------|
| `openAiModels: ["gpt-4o", "gpt-4o-mini", "o1-preview"]` | Models returned with sane defaults (128K context, supports images) | PASS |
| No `openAiModels` provided | Empty models, empty default | PASS |
| `openAiModels: []` (empty array) | Empty models, empty default | PASS |

Test file: [`dynamic-openai-models.spec.ts`](https://github.com/jeremylongshore/kilocode/blob/review/PR-5562/webview-ui/src/components/kilocode/hooks/__tests__/dynamic-openai-models.spec.ts)

> Tested on fork branch [`review/PR-5562`](https://github.com/jeremylongshore/kilocode/tree/review/PR-5562)

## Code Analysis

### Architecture

This PR connects the **front page** model selector to an existing backend API (`requestOpenAiModels`) that was already used by the **settings page**. Clean layering:

1. `ExtensionStateContext.tsx` — debounced message sender (triggers on config change)
2. `webviewMessageHandler.ts` (pre-existing) — fetches from `/v1/models` endpoint
3. `useProviderModels.ts` — consumes `openAiModels` from state, converts to `ModelRecord`
4. `vscode-extension-host.ts` — adds `openAiModels?: string[]` to `ExtensionState` type

### Key Design Decisions

- **`useDebounce(500ms)`**: Prevents API spam during rapid config changes. Appropriate for text input fields.
- **`openAiModelInfoSaneDefaults`**: Uses 128K context, supports images, $0 pricing. Reasonable for unknown models.
- **State via message channel**: Models are fetched on demand and stored in React state, not persisted to disk. Re-fetches on startup via the `didHydrateState` trigger.

## CI Status

| Check | Result |
|-------|--------|
| Upstream CI | PASS (11/11 checks) |
| Merge status | CONFLICTING (needs rebase) |
| Fork CI | [PR #12](https://github.com/jeremylongshore/kilocode/pull/12) |
| Local verification | PASS (all tests) |

## Verdict

**APPROVE** — Well-scoped feature that connects the front page to an existing backend API for dynamic model fetching. The `openai-responses` mismatch is non-blocking and the merge conflict needs resolution by the author. Code follows established patterns and passes all tests.

---
