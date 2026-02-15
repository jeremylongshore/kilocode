<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5867
title: "Add banner and pre-release extension info"
author: lambertjosh
category: docs
tier: 1
lines: 80
files: 3
verdict: COMMENT
confidence: 92
reviewed_at: 2026-02-15
-->

# Review: kilocode #5867

> **Add banner and pre-release extension info** by @lambertjosh

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | WARN | Broken link to feature parity doc (see findings) |
| Conventions | PASS | JSX-style CSS, Markdoc callouts, matches existing patterns |
| Changeset | SKIP | Docs-only, no changeset needed |
| Tests | N/A | Documentation change |
| i18n | N/A | Docs site, not extension UI |
| Types | N/A | No type changes |
| Security | PASS | No secrets, external links only |
| Scope | PASS | Clean 3-file change, focused on banner + install docs |

## Findings

### YELLOW: Broken link to feature parity doc

**File**: `apps/kilocode-docs/pages/getting-started/installing.md`

The link to the feature parity tracking document points to:
```
https://github.com/Kilo-Org/kilo/blob/main/packages/kilo-vscode/docs/opencode-migration-plan.md
```

The `Kilo-Org/kilo` repository has no `main` branch -- its default branch is `dev`. This link will 404 for users. Should be:
```
https://github.com/Kilo-Org/kilo/blob/dev/packages/kilo-vscode/docs/opencode-migration-plan.md
```

Or better, omit the branch entirely and link to the default:
```
https://github.com/Kilo-Org/kilo/packages/kilo-vscode/docs/opencode-migration-plan.md
```

**Evidence**: `gh api repos/Kilo-Org/kilo --jq '.default_branch'` returns `dev`. Branch listing confirms no `main` branch exists.

### GRAY: Hardcoded banner height in CSS variable

**File**: `apps/kilocode-docs/public/globals.css:7`

The `--top-nav-height` calculation assumes a fixed 36px banner height (desktop) and 56px (mobile). If banner text wraps on narrow viewports, the actual height may exceed the CSS variable, causing content overlap. A comment documents the breakdown (`105px nav + 36px banner`), which is good practice, but this is inherently fragile.

This was also flagged by kiloconnect's automated review. Low severity since the banner is temporary (pre-release announcement) and the math is well-documented.

### GRAY: No dismiss/close mechanism for banner

The banner is always visible with no way to dismiss it. For a temporary announcement this is acceptable, but worth noting if it stays up long-term.

## CI Status

| Check | Result |
|-------|--------|
| Build Markdoc Site | PASS |
| build-cli | PASS |
| check-translations | PASS |
| compile | PASS |
| test-cli | PASS |
| test-extension (ubuntu) | PASS |
| test-extension (windows) | PASS |
| test-jetbrains | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| unit-test | PASS |

All CI checks pass. No test failures.

## Code Snippets

Banner component (TopNav.tsx):
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

Pre-release install section (installing.md):
```markdown
## Pre-Release Extension

{% callout type="info" %}
We're rebuilding Kilo Code from the ground up on the new [Kilo CLI](https://github.com/Kilo-Org/kilo).
{% /callout %}
```

## Verdict

**COMMENT** -- The PR is well-structured and achieves its goal cleanly. The banner placement, styling, and responsive adjustments are solid. The installing.md additions are clear and include appropriate callouts for the pre-release status.

One concrete issue: the feature parity tracking link points to `blob/main/` but the `Kilo-Org/kilo` repo has no `main` branch (default is `dev`). This will 404 for users and should be fixed before merge.

Already approved by @emilieschario. No blocking issues beyond the link fix.

---

*Review conducted per [methodology v1.7.0](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)*
