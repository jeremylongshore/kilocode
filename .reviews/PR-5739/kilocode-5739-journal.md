<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5739
title: "Honor explicit 'disable' for reasoning effort"
author: rayss868
category: feature
tier: 3
lines: 33
files: 2
review_number: 18
fork_pr: https://github.com/jeremylongshore/kilocode/pull/11
-->

# Review Journal: kilocode #5739

> **PR**: [#5739](https://github.com/Kilo-Org/kilocode/pull/5739) |
> **Author**: @rayss868 | **Size**: 33 lines, 2 files | **Confidence**: 4/5

## Summary

Fixes a bug where selecting "disable" for reasoning effort in the OpenAI Compatible provider had no effect — the extension still sent `thinking: { type: "enabled" }` to the API. Also adds previously missing `reasoning_effort` parameter support. We merged this on our fork, ran 7,831 tests, all passed. APPROVE with notes about missing changeset and tests.

## What Changed

The bug was in `BaseOpenAiCompatibleProvider`. The old code checked `enableReasoningEffort && supportsReasoningBinary` and always sent `thinking: { type: "enabled" }`. There was no path for "disable" to prevent this.

The fix introduces `isExplicitlyDisabled`:
```typescript
const effort = this.options.reasoningEffort || info.reasoningEffort
const isExplicitlyDisabled = effort === "disable"

if (info.supportsReasoningBinary && !isExplicitlyDisabled) {
    (params as any).thinking = { type: "enabled" }
}
```

This pattern is applied to both `createMessage()` and `streamCompletion()` — the provider has duplicate logic paths (pre-existing architecture, not introduced by this PR).

The UI fix in `OpenAICompatible.tsx` adds `setApiConfigurationField("reasoningEffort", value)` to keep the parent state in sync with the dropdown selection.

## Verification

### Regression (did we break anything?)

| Test | Command | Result |
|------|---------|--------|
| TypeScript | `pnpm check-types` | PASS (22/22 packages) |
| Lint | `pnpm lint` | PASS (18/18 packages) |
| Unit Tests | `pnpm test --continue` | PASS (7,831 tests, 0 failures) |
| Upstream CI | `gh pr checks` | No checks ran (needs rebase) |

### Behavioral (does the fix actually work?)

We wrote 3 targeted tests to prove the specific fix works:

| Test | Assertion | Result |
|------|-----------|--------|
| `reasoningEffort: "disable"` | No `thinking` or `reasoning_effort` in API call | PASS |
| `reasoningEffort: "medium"` | Both params correctly sent | PASS |
| `enableReasoningEffort: false` | No reasoning params at all | PASS |

Test file: [`reasoning-effort-disable.spec.ts`](https://github.com/jeremylongshore/kilocode/blob/review/PR-5739/src/api/providers/__tests__/reasoning-effort-disable.spec.ts)

Tested on fork branch [`review/PR-5739`](https://github.com/jeremylongshore/kilocode/tree/review/PR-5739).

## Lessons Learned

- Running 7,831 existing tests proves "nothing broke." Writing 3 targeted tests proves "the fix works." Both are needed.
- The `--continue` flag on `pnpm test` is essential — `core-schemas` has no test files (pre-existing), and without `--continue` it halts the entire suite.
- This PR does more than the title suggests — it also adds `reasoning_effort` parameter support. Always read the diff, not just the title.
- Types matter: the test initially used `string` for `reasoningEffort` but the actual type is a union (`"low" | "medium" | "high" | ...`). check-types caught it before push.

---

<sub>Review #18 of 75 | [Multi-AI analysis](https://github.com/jeremylongshore/kilocode/pull/11) | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews/METHODOLOGY.md)</sub>
