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
reviewed_at: 2026-02-15
-->

# Review: kilocode #5328

> **UI accessibility enhancements** by @audioses

[Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | ARIA attributes correctly applied; keyboard handlers include Enter/Space |
| Conventions | WARN | Custom `ariaLabel` prop on Button instead of using native `aria-label` via spread |
| Changeset | FAIL | Missing changeset |
| Tests | FAIL | No tests for accessibility enhancements |
| i18n | PASS | New strings added to `en/chat.json`; only English locale updated (other locales need updating) |
| Types | PASS | TypeScript types correct |
| Security | PASS | No security concerns |
| Scope | WARN | MutationObserver in App.tsx adds runtime overhead for all users |

## Findings

### RED - Missing changeset

No changeset file included. PR body modifications to 15 webview-ui files warrant at minimum a `patch` changeset for `kilo-code`.

### RED - No test coverage

No tests added for any of the accessibility changes. At minimum, the `enhanceButtonAccessibility` utility function in `standard-tooltip.tsx` should have unit tests verifying:
- Button-like elements get `aria-label` from tooltip content
- Non-button elements are not modified
- Elements with existing `aria-label` are not overwritten
- Non-string tooltip content is handled correctly

### YELLOW - Custom `ariaLabel` prop on Button component

The PR adds a custom `ariaLabel` prop to the `Button` component (`button.tsx`) rather than letting the native `aria-label` pass through via the existing `...props` spread. Since `ButtonProps` extends `React.ButtonHTMLAttributes<HTMLButtonElement>`, users can already pass `aria-label` directly. The custom prop creates a parallel path that could diverge from the native attribute.

```tsx
// Current approach in PR:
<Button ariaLabel="Save" />

// Already works without changes:
<Button aria-label="Save" />
```

The `enhanceButtonAccessibility` function in `standard-tooltip.tsx` also auto-injects `aria-label` from tooltip content, so there are now three overlapping mechanisms for setting button labels.

### YELLOW - MutationObserver in App.tsx

The iframe-hiding `useEffect` in `App.tsx` creates a `MutationObserver` that watches `document.body` with `{ childList: true, subtree: true }`. This fires on every DOM mutation across the entire app. While the callback is lightweight (checking tagName + attributes), this is a global performance cost for all users to address a Radix UI implementation detail. Consider:
- Scoping the observer to a narrower container
- Using CSS `iframe[src="about:blank"] { display: none }` with `aria-hidden` set via Radix configuration
- Checking if Radix already handles this in newer versions

### YELLOW - `Date.now()` in render for unique IDs

In `ReasoningBlock.tsx`, the unique ID is generated as `const contentId = \`reasoning-content-${Date.now()}\``. This is not stable across re-renders and will generate a new ID each time the component re-renders, breaking the `aria-controls` association. Use `React.useId()` (React 18+) or `useMemo` with a stable seed:

```tsx
// ReasoningBlock.tsx line 22
const contentId = `reasoning-content-${Date.now()}` // Unstable across re-renders

// Better:
const contentId = React.useId()
```

### YELLOW - i18n only updated for English

New strings `editMessageLabel`, `deleteMessageLabel`, and `reasoning.toggle` are added to `en/chat.json` but none of the other 23 language files are updated. The `check-translations` CI step may flag this.

### GRAY - Hardcoded strings in CodeAccordian.tsx

`aria-label={isExpanded ? "Collapse code" : "Expand code"}` is hardcoded in English rather than using i18n. All other aria labels in this PR correctly use `t()`.

### GRAY - Visually hidden text technique

The PR uses inline `position: absolute; left: -10000px` for visually hidden text in `AutoApproveMenu.tsx`. This is a known technique, but the codebase may have a utility class (e.g., `sr-only` in Tailwind) that would be cleaner and more maintainable.

### GRAY - `kilocode_change` markers missing

Webview-ui changes require `kilocode_change` markers per project conventions. None of the 15 modified files include these markers. The `button.tsx` and `standard-tooltip.tsx` changes to shared components especially need marking.

## CI Status

| Check | Result |
|-------|--------|
| CI | No checks reported on branch |

## Code Snippets

Button component change:
```tsx
// webview-ui/src/components/ui/button.tsx
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  ariaLabel?: string  // Redundant with native aria-label
}
```

Auto-enhancement in StandardTooltip:
```tsx
// webview-ui/src/components/ui/standard-tooltip.tsx
function enhanceButtonAccessibility(children: ReactNode, tooltipContent: ReactNode): ReactNode {
  if (!React.isValidElement(children)) return children
  const isButtonLike = element.type === "button" || ...
  if (isButtonLike && !element.props?.["aria-label"] && typeof tooltipContent === "string") {
    return React.cloneElement(element, { "aria-label": tooltipContent.trim() })
  }
  return children
}
```

## Verdict

**COMMENT** -- The accessibility improvements address real needs (keyboard navigation, ARIA attributes, screen reader support), and the overall direction is sound. However, the PR needs work before merging:

1. A changeset must be added
2. The unstable `Date.now()` ID in `ReasoningBlock` needs fixing
3. The redundant `ariaLabel` prop on Button should be reconsidered in favor of native `aria-label`
4. Tests should be added, at minimum for `enhanceButtonAccessibility`
5. The hardcoded English string in `CodeAccordian.tsx` should use i18n
6. `kilocode_change` markers are needed

These are addressable issues. The accessibility intent is good and the keyboard handling patterns are correct.
