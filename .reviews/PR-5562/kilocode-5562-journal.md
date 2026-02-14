<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5562
title: "Dynamic OpenAI compatible model fetching on front page"
author: crazyrabbit0
category: feature
tier: 3
lines: 59
files: 4
review_number: 19
fork_pr: https://github.com/jeremylongshore/kilocode/pull/12
-->

# Review Journal: kilocode #5562

> **PR**: [#5562](https://github.com/Kilo-Org/kilocode/pull/5562) |
> **Author**: @crazyrabbit0 | **Size**: 59 lines, 4 files | **Confidence**: 4/5

## Summary

Adds dynamic model fetching for the OpenAI provider on the front page. When users configure an OpenAI-compatible base URL, the extension now automatically queries the `/v1/models` endpoint and populates the model dropdown. We merged this on our fork, ran 7,803 tests, all passed. APPROVE with notes about `openai-responses` mismatch and merge conflict.

## What Changed

The PR connects the front page model selector to an existing backend API that was already used by the settings page. The architecture is clean — four files touched, each with a clear role:

1. **Type extension** (`vscode-extension-host.ts`): Adds `openAiModels?: string[]` to `ExtensionState`
2. **State management** (`ExtensionStateContext.tsx`): Debounced effect (500ms) sends `requestOpenAiModels` when OpenAI config changes
3. **Model consumption** (`useProviderModels.ts`): `getModelsByProvider` uses `openAiModels` to build `ModelRecord` with sane defaults
4. **Changeset**: Patch bump for `kilo-code` and `@kilocode/types`

The backend handler (`webviewMessageHandler.ts`) already existed — it fetches from `/v1/models`, returns model IDs. The settings page already used it. This PR just wires it to the front page too.

## Verification

### Regression (did we break anything?)

| Test | Command | Result |
|------|---------|--------|
| TypeScript | `pnpm check-types` | PASS (22/22 packages) |
| Lint | `pnpm lint` | PASS (18/18 packages) |
| Unit Tests | `pnpm test --continue` | PASS (7,803 tests, 0 failures) |
| Upstream CI | `gh pr checks` | PASS (11/11 checks) |

### Behavioral (does the feature actually work?)

We wrote 3 targeted tests to verify the `getModelsByProvider` function:

| Test | Assertion | Result |
|------|-----------|--------|
| Models provided | Returns all models with 128K context defaults | PASS |
| No models provided | Returns empty models and default | PASS |
| Empty array | Handles gracefully, returns empty | PASS |

Test file: [`dynamic-openai-models.spec.ts`](https://github.com/jeremylongshore/kilocode/blob/review/PR-5562/webview-ui/src/components/kilocode/hooks/__tests__/dynamic-openai-models.spec.ts)

Tested on fork branch [`review/PR-5562`](https://github.com/jeremylongshore/kilocode/tree/review/PR-5562).

## Lessons Learned

- The backend API (`requestOpenAiModels`) already existed for the settings page. This PR just wires the front page to it. Always check what infrastructure already exists before assuming a PR is incomplete.
- `RouterModels` type requires ALL provider keys — can't use a partial mock in tests. The existing test file `getModelsByProvider.spec.ts` shows the correct pattern.
- Pre-push hooks (Husky) run `check-types` and `lint` — caught our type error before push (second time this happened). The hooks are a safety net worth appreciating.
- `openai-responses` has no case in the `getModelsByProvider` switch at all — not just missing the dynamic models, it has zero model handling. This is a pre-existing gap.

---

<sub>Review #19 of 75 | [Multi-AI analysis](https://github.com/jeremylongshore/kilocode/pull/12) | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews/METHODOLOGY.md)</sub>
