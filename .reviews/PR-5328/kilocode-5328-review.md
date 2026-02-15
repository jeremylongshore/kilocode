<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5328
title: "UI accessibility enhancements"
author: audioses
category: feature
tier: 5
lines: 271
files: 15
verdict: COMMENT
confidence: 3
reviewed_at: 2026-02-14
linked_issue: none
fork_pr: none
-->

# Review: kilocode #5328

> **UI accessibility enhancements** by @audioses
> Static analysis only (no CI runs, merge conflicts present)

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | WARN | Several issues: missing i18n key, non-deterministic IDs, visually-hidden pattern, conflict with current codebase |
| Conventions | WARN | Custom `ariaLabel` prop on Button instead of native `aria-label` via spread; no `// kilocode_change` markers |
| Changeset | FAIL | No changeset included (changeset-bot flagged) |
| Tests | N/A | No tests added, but accessibility changes are hard to unit test |
| i18n | WARN | Missing `chat:slashCommands.createCommand` key; `chat.json` adds 4 new keys but only for English |
| Types | PASS | TypeScript changes are sound |
| Security | PASS | No security implications |
| Scope | WARN | Broad scope across 15 files -- mixes several distinct concerns (ARIA labels, keyboard nav, iframe hiding, label refactoring) |
| Merge status | FAIL | CONFLICTING -- PR is based on an older codebase (references `ghost` tab, not `autocomplete`) |

## Findings

### RED: Missing i18n key `chat:slashCommands.createCommand`

`SlashCommandsSettings.tsx` -- The PR adds `ariaLabel={t("chat:slashCommands.createCommand")}` to two Button components (lines 171 and 218 in the diff), but this key does not exist in `chat.json`. The diff only adds `editMessageLabel`, `deleteMessageLabel`, and `reasoning.toggle` to the locale file. At runtime, `t()` will return the raw key string `"chat:slashCommands.createCommand"` as the aria-label, which is meaningless to screen reader users.

### RED: Merge conflicts -- `ghost` vs `autocomplete` in SettingsView

`SettingsView.tsx` -- The PR computes the `label` variable with a `ghost` tab check:
```typescript
id === "ghost" ? t(`kilocode:ghost.title`) : ...
```
But the current codebase uses `autocomplete`:
```typescript
id === "autocomplete" ? t(`kilocode:autocomplete.title`) : ...
```
The PR was authored against an older branch. The mergeable status is CONFLICTING, confirming this. The PR needs a rebase before it can be reviewed for merge.

### YELLOW: Non-deterministic IDs will cause stale ARIA references

`ReasoningBlock.tsx` -- Uses `Date.now()` for the `contentId`:
```typescript
const contentId = `reasoning-content-${Date.now()}`
```
This generates a new ID on every render (since it is not memoized), causing `aria-controls` to reference a stale ID if the component re-renders. Should use `useId()` (React 18+) or `useMemo()`.

`CodeAccordian.tsx` -- Uses `Math.random()` inside `useMemo`:
```typescript
const uniqueId = useMemo(() => `code-content-${Math.random().toString(36).substr(2, 9)}`, [])
```
This is better (memoized with empty deps so stable per mount), but `Math.random()` is non-deterministic and can cause SSR hydration mismatches. `useId()` is the idiomatic React 18 solution.

### YELLOW: Custom `ariaLabel` prop bypasses native HTML pattern

`button.tsx` -- The PR adds a custom `ariaLabel` prop to the Button component:
```typescript
export interface ButtonProps ... {
    asChild?: boolean
    ariaLabel?: string
}
```
This is redundant because `ButtonProps` already extends `React.ButtonHTMLAttributes<HTMLButtonElement>`, which includes `aria-label` natively. The standard pattern is:
```tsx
<Button aria-label="Save" />
```
The custom prop creates a parallel API (`ariaLabel` vs `aria-label`) that is confusing for other developers. It also will not work correctly with the `asChild` pattern using `Slot`, because `Slot` merges native HTML attributes but not custom props.

### YELLOW: Visually-hidden text uses inline styles instead of utility class

`AutoApproveMenu.tsx` -- The checkbox label uses inline styles for visually-hidden text:
```tsx
<span style={{
    position: "absolute",
    left: "-10000px",
    width: "1px",
    height: "1px",
    overflow: "hidden",
}}>
```
This project uses Tailwind CSS. The standard pattern is `className="sr-only"` (screen-reader only). The inline approach also risks being overridden by other styles and does not use `clip` or `clip-path`, which are more robust for screen reader compatibility.

### YELLOW: `enhanceButtonAccessibility` in StandardTooltip is fragile

`standard-tooltip.tsx` -- The new `enhanceButtonAccessibility` function tries to auto-inject `aria-label` from tooltip content:
```typescript
const isButtonLike =
    element.type === "button" ||
    (element.type === "input" && element.props?.type === "button") ||
    element.props?.role === "button" ||
    (element.type as any)?.displayName === "Button"
```

Issues:
1. Relies on `displayName` which can be stripped in production builds
2. Does not handle wrapped/forwarded ref components (e.g., `React.forwardRef` wrapping Button)
3. Duplicates logic that the explicit `ariaLabel` prop already handles -- the same PR adds both approaches, creating two overlapping systems
4. Only works when `content` is a string, silently does nothing for JSX tooltip content

### YELLOW: Removed aria-label from VSCodeCheckbox without reliable replacement

`AutoApproveMenu.tsx` -- The PR removes the existing `aria-label` from the checkbox:
```diff
- aria-label={
-     hasEnabledOptions
-         ? t("chat:autoApprove.toggleAriaLabel")
-         : t("chat:autoApprove.disabledAriaLabel")
- }
```
And replaces it with a visually-hidden `<span>` inside the checkbox:
```tsx
<span style={{ position: "absolute", left: "-10000px", ... }}>
    {hasEnabledOptions
        ? `Toggle auto-approval for: ${enabledActionsList}`
        : t("chat:autoApprove.disabledAriaLabel")}
</span>
```
The `VSCodeCheckbox` is a web component from `@vscode/webview-ui-toolkit`. Placing a visually-hidden span _inside_ a web component's light DOM may not be accessible to the web component's internal shadow DOM label association. The existing `aria-label` attribute approach was more reliable for web components. The improvement (listing enabled actions) is good, but it should use `aria-label` directly.

### YELLOW: MutationObserver in App.tsx for iframe hiding is heavyweight

`App.tsx` -- Adds a global MutationObserver on `document.body` with `{ childList: true, subtree: true }`:
```typescript
observer.observe(document.body, { childList: true, subtree: true })
```
This fires on every DOM mutation in the entire webview. While the callback is lightweight, the observation itself has performance implications for a frequently-updating chat UI. Consider:
1. Scoping the observer to a narrower container
2. Using a Radix UI portal container with `aria-hidden` applied once
3. Checking if Radix UI has a built-in solution for this (newer versions may already add `aria-hidden`)

### GRAY: SettingsView label refactoring is good but out of scope

The `SettingsView.tsx` changes extract the duplicated label computation into a `label` variable. This is a clean DRY improvement but is unrelated to accessibility per se -- it is a refactoring that happens to be in the same PR.

### GRAY: No changeset

The changeset bot flagged this PR as missing a changeset. Since this is a `patch`-level change to `@roo-code/vscode-webview`, a changeset should be included.

## CI Status

No CI checks have run on this PR. The branch has merge conflicts, which likely prevented CI from running.

## Code Snippets

### Keyboard navigation pattern (correct):
```typescript
// ReasoningBlock.tsx -- good ARIA expanded pattern
<div
    onClick={handleToggle}
    role="button"
    tabIndex={0}
    aria-expanded={!isCollapsed}
    aria-controls={contentId}
    aria-label={t("chat:reasoning.toggle", "Toggle thinking content")}
    onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handleToggle()
        }
    }}>
```

### Auto-label injection (fragile):
```typescript
// standard-tooltip.tsx -- relies on displayName which can be stripped
const isButtonLike =
    element.type === "button" ||
    (element.type as any)?.displayName === "Button"

if (isButtonLike && !element.props?.["aria-label"] && typeof tooltipContent === "string") {
    return React.cloneElement(element, { "aria-label": tooltipContent.trim() })
}
```

### Non-deterministic ID (problematic):
```typescript
// ReasoningBlock.tsx -- generates new ID on every render
const contentId = `reasoning-content-${Date.now()}`
// Should be: const contentId = useId()
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**COMMENT** -- This PR has good intentions and addresses real accessibility gaps (keyboard navigation, ARIA labels, screen reader support). The author clearly understands accessibility needs (screen reader testing instructions, ARIA expanded states, keyboard handlers). However, several issues need resolution before this can be merged:

1. **Must fix**: Missing `createCommand` i18n key, merge conflicts requiring rebase
2. **Should fix**: Non-deterministic IDs (use `useId()`), redundant custom `ariaLabel` prop (use native `aria-label`), visually-hidden inline styles (use `sr-only`)
3. **Should reconsider**: The dual approach of explicit `ariaLabel` AND auto-injection via `enhanceButtonAccessibility` creates two overlapping systems -- pick one
4. **Should reconsider**: Removing `aria-label` from `VSCodeCheckbox` in favor of inner visually-hidden span (web component compatibility concern)

Recommend splitting this into smaller, focused PRs (e.g., keyboard nav, ARIA labels, iframe hiding) for easier review and merge.
