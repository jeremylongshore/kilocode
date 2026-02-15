<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5867
title: "Add banner and pre-release extension info"
author: lambertjosh
category: docs
tier: 1
lines: 80
files: 3
confidence: 4
verdict: APPROVE
fork_pr: "N/A (docs-only change)"
codespace: "N/A (docs-only change)"
reviewed_at: 2026-02-14
linked_issue: N/A
-->

## Review Summary

| Aspect | Assessment |
|--------|------------|
| **Verdict** | APPROVE |
| **Confidence** | 4/5 |
| **Blocking Issues** | 0 |

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | pass | Links verified, content accurate |
| Conventions | pass | Follows existing docs site patterns |
| Changeset | N/A | Docs-only, no changeset needed |
| Tests | N/A | No testable logic |
| i18n | N/A | Docs site, not extension UI |
| Types | N/A | JSX is straightforward, no type changes |
| Security | pass | External links only, no secrets |
| Scope | pass | Tightly scoped to banner + install docs |

## Findings

### 1. Hard-coded banner height in CSS variable (yellow)

**File**: `apps/kilocode-docs/public/globals.css:7`

The `--top-nav-height` is changed from `105px` to `141px` with a comment `/* 105px nav + 36px banner */`. The mobile variant is similarly adjusted from `60px` to `116px` (`/* 60px nav + 56px banner */`). If the banner text wraps on narrower viewports or with different font metrics, the actual height may exceed the hard-coded value, causing content to hide under the fixed header.

The bot reviewer (kiloconnect) flagged this same issue. This is a cosmetic risk, not a blocker -- the banner content is short and unlikely to wrap at reasonable viewport widths, and the mobile override already accounts for a taller banner (56px vs 36px desktop).

```css
/* Desktop */
--top-nav-height: 141px; /* 105px nav + 36px banner */

/* Mobile (max-width: 768px) */
--top-nav-height: 116px; /* 60px nav + 56px banner */
```

**Severity**: Low. Cosmetic edge case, not a functional blocker.

### 2. No dismiss/close mechanism for banner (gray)

The announcement banner has no close button or cookie-based dismiss. Every page load will show it. This is a deliberate design choice for an important announcement (replatforming), not an oversight -- but worth noting it will persist indefinitely until removed in a future PR.

**Severity**: Informational. Expected for this type of announcement.

### 3. External links verified (pass)

- `https://blog.kilo.ai/p/kilo-cli` -- Valid. Resolves to "Kilo CLI 1.0: Built for Kilo Speed" blog post by Scott Breitenother, published 2026-02-03.
- `https://github.com/Kilo-Org/kilo` -- Valid. The new Kilo monorepo.
- `https://github.com/Kilo-Org/kilo/blob/main/packages/kilo-vscode/docs/opencode-migration-plan.md` -- Valid. Feature parity tracking document exists in the repo.
- `https://github.com/Kilo-Org/kilo/issues` -- Valid. Standard issues link.

## CI Status

| Check | Result |
|-------|--------|
| Build Markdoc Site | pass |
| build-cli | pass |
| check-translations | pass |
| compile | pass |
| test-cli | pass |
| test-extension (ubuntu) | pass |
| test-extension (windows) | pass |
| test-jetbrains | pass |
| test-webview (ubuntu) | pass |
| test-webview (windows) | pass |
| unit-test | pass |

All 11 required checks pass. Release/publish jobs correctly skipping.

## Code Snippets

### Banner component (TopNav.tsx)

```tsx
{/* Announcement banner */}
<div className="announcement-banner">
    <p>
        We're{" "}
        <Link href="https://blog.kilo.ai/p/kilo-cli">replatforming our extensions on the new Kilo CLI</Link>
        . Contribute to the new CLI and pre-release extensions at{" "}
        <Link href="https://github.com/Kilo-Org/kilo">Kilo-Org/kilo</Link>.
    </p>
</div>
```

### Pre-release install section (installing.md)

New section with callout, feature list, install/uninstall instructions, and feedback link. Uses existing Markdoc `{% callout %}` and `{% tabs %}` patterns from the docs site.

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**APPROVE** -- Clean docs-only PR that adds an announcement banner and pre-release extension documentation. All CI passes. All external links verified. The hard-coded banner height is a minor cosmetic risk already flagged by the bot reviewer but not a blocker. Already approved by @emilieschario and merged.

---
