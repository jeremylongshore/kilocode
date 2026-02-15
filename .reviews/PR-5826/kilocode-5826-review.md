<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5826
title: "fix: prevent Create New Mode form fields from resetting while typing"
author: app/kiloconnect
category: fix
tier: 2
lines: +24/-15
files: 3
verdict: APPROVE
confidence: 5
reviewed_at: 2026-02-14
linked_issue: N/A
fork_pr: N/A (batch review)
-->

# Review: kilocode #5826

> **fix: prevent Create New Mode form fields from resetting while typing** by @app/kiloconnect
> Multi-AI analysis: N/A (batch review) -- static analysis only

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Replaces re-rendering web components with stable native elements |
| Conventions | PASS | Uses `kilocode_change` markers |
| Changeset | PASS | `fix-create-mode-form-reset.md` included (patch for kilo-code) |
| Tests | N/A | UX fix, no new testable logic |
| i18n | N/A | No user-facing strings changed |
| Types | PASS | Native elements use standard React event types |
| Security | PASS | No security surface changes |
| Scope | PASS | Two focused fixes in 3 files |

## Findings

### GREEN: Fix 1 -- Form field reset (ModesView.tsx)

Replaces VS Code web components with native HTML elements:
- `VSCodeTextArea` to `<textarea>` (3 instances: role definition, when-to-use, custom instructions)
- `VSCodeTextField` to `<Input>` (1 instance: description)

VS Code web components (`<vscode-text-area>`, `<vscode-text-field>`) maintain internal state that conflicts with React's controlled input model. On re-render, they reset their internal value, causing typed text to disappear. Native `<textarea>` and `<Input>` elements work correctly with React's controlled input pattern.

The native elements are properly themed with VS Code CSS variables:
```
bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded p-2 font-[var(--vscode-font-family)] text-[13px]
```

### GREEN: Fix 2 -- Modes tab navigation (App.tsx)

`App.tsx:178-182` -- When `message.tab === "modes"`, redirects to `"settings"` with `setCurrentSection("modes")`. This fixes a blank screen when navigating from the marketplace to the modes tab, because "modes" is a section within settings, not a standalone tab.

### GREEN: Event handler simplification

The native elements eliminate the need for the `(e.target as HTMLTextAreaElement).value` cast -- they use standard `e.target.value` directly. This is both cleaner and type-safe.

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review |
| Lint | `pnpm lint` | NOT_RUN | Batch review |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review |

> Static analysis only. No fork branch created for this PR.

## Verdict

**APPROVE** -- Clean fix for two related UX bugs. The VS Code web component to native element swap is a known-good pattern (same root cause as PR #5634). The modes tab redirect is a simple, correct fix. Changeset included. Merge.
