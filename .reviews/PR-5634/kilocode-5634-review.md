<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5634
title: "fix: context condensing prompt not saving properly"
author: Patel230
category: fix
tier: 2
lines: +31/-2
files: 2
verdict: APPROVE
confidence: 4
reviewed_at: 2026-02-14
linked_issue: N/A
fork_pr: N/A (batch review)
-->

# Review: kilocode #5634

> **fix: context condensing prompt not saving properly** by @Patel230
> Multi-AI analysis: N/A (batch review) -- static analysis only

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Local state + onBlur sync prevents flickering |
| Conventions | PASS | Standard React controlled input pattern |
| Changeset | PASS | `fix-condensing-prompt.md` included (patch for kilo-code) |
| Tests | N/A | No new tests, but fix is straightforward controlled input pattern |
| i18n | N/A | No user-facing strings |
| Types | PASS | Uses existing types, no changes needed |
| Security | PASS | No security surface changes |
| Scope | PASS | Single component, focused fix |

## Findings

### GREEN: Correct local state pattern

`PromptsSettings.tsx:57` -- Adds `localCondensingPrompt` state that handles immediate keystroke updates without round-tripping through the VS Code extension host:

```typescript
const [localCondensingPrompt, setLocalCondensingPrompt] = useState<string | undefined>(undefined)
```

### GREEN: Proper initialization and sync

Two useEffect/event handlers manage the lifecycle:

1. **Initialization** (`PromptsSettings.tsx:75-78`): When switching to the CONDENSE tab (`activeSupportOption === "CONDENSE"`), local state initializes from extension state.

2. **Blur sync** (`PromptsSettings.tsx:205-212`): On blur, local state is cleared (`setLocalCondensingPrompt(undefined)`) and the final value is synced to extension state via `updateSupportPrompt()`.

3. **Read path** (`PromptsSettings.tsx:131-133`): `getSupportPromptValue()` returns `localCondensingPrompt ?? customCondensingPrompt ?? supportPrompt.default.CONDENSE` -- local state takes priority during editing, falls back to extension state, then default.

### GREEN: Scoped to CONDENSE only

The fix is applied only to the CONDENSE prompt type, not ENHANCE. The `onChange` handler checks `if (activeSupportOption === "CONDENSE")` before updating local state. This minimizes the blast radius.

### YELLOW: Minor code duplication

The value extraction logic in `onBlur` duplicates the pattern from `onChange`:
```typescript
const value = (e as unknown as CustomEvent)?.detail?.target?.value ??
  ((e as any).target as HTMLTextAreaElement).value
```

This could be extracted to a shared helper, but it is a minor style issue, not a correctness concern.

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review |
| Lint | `pnpm lint` | NOT_RUN | Batch review |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review |

> Static analysis only. No fork branch created for this PR.

## Verdict

**APPROVE** -- Correct fix for a common React controlled input issue. The local state pattern (immediate local updates, sync on blur) is the standard solution for inputs that need to sync with external state that has round-trip latency. The fix is scoped to the affected prompt type only. Changeset included. Merge.
