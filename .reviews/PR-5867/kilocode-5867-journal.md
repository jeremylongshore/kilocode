<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5867
title: "Add banner and pre-release extension info"
author: lambertjosh
category: docs
tier: 1
lines: 80
files: 3
review_number: 34
fork_pr: "N/A (docs-only change)"
codespace: "N/A (docs-only change)"
-->

# Review Journal: kilocode #5867

> **PR**: [#5867](https://github.com/Kilo-Org/kilocode/pull/5867) |
> **Author**: @lambertjosh | **Size**: 80 lines, 3 files | **Confidence**: 4/5

## Summary

Docs-only PR adding a site-wide announcement banner to the Kilo docs site and a new "Pre-Release Extension" section on the installing page. The banner directs contributors to the new Kilo CLI monorepo (Kilo-Org/kilo) and links to the replatforming blog post. All links verified, CI clean, already approved and merged. APPROVE.

## First Impressions

Title signals a straightforward docs/marketing update. The PR description includes screenshots of both the banner and the new install section, which immediately communicates what changed visually. Author is @lambertjosh, who appears to be a Kilo team member handling the public communications around the CLI replatforming effort. Expected a small, non-controversial change -- and that's what it is.

## What I Looked At

- **3 changed files**: `TopNav.tsx` (banner component + CSS-in-JS), `installing.md` (new pre-release section), `globals.css` (nav height adjustment)
- **PR description**: Two screenshots showing banner and install section
- **External links**: Verified all 4 outbound links resolve correctly
- **CI checks**: 11 required checks all passing
- **Existing reviews**: Approved by @emilieschario (2 approvals logged), inline comment from kiloconnect bot about hard-coded height
- **PR state**: Already merged (2026-02-14T11:00:52Z)

## Analysis

### The Banner (TopNav.tsx)

The banner is inserted after the main nav `<div>` blocks and before the `<style jsx>` block. It uses the existing `<Link>` component from the docs framework for the two outbound links. The CSS is scoped via styled-jsx (matching the existing pattern in TopNav.tsx) with appropriate dark theme colors:

- Background: `#1a1a18` (near-black, matching the nav)
- Text: `#a3a3a2` (muted gray)
- Links: `#f8f674` (Kilo's yellow accent color) with hover state `#ffff8d`

The banner text is concise: one sentence with two links. Mobile gets a slightly smaller font (`0.8rem` vs `0.875rem`).

### Nav Height Adjustment (globals.css)

The `--top-nav-height` CSS variable is used by the docs layout to offset content below the fixed header. The PR updates:

- Desktop: `105px` to `141px` (+36px for banner)
- Mobile: `60px` to `116px` (+56px for banner, accounting for text wrap)

The kiloconnect bot flagged this as fragile -- if banner text wraps differently than expected, content could hide under the header. Valid concern but low risk given the short banner copy and the mobile breakpoint already accounting for a taller banner.

### Pre-Release Section (installing.md)

New section added between the existing install tabs and the "Manual Installations" section. Contains:

1. An info callout explaining the replatforming context
2. Feature highlights (Solid.js UI, CLI backend, session management)
3. "Current Status" paragraph with link to feature parity tracking document
4. "Installing the Pre-Release" steps (standard VS Code extension pre-release flow)
5. "Switching Back to Stable" steps
6. "Feedback and Issues" link

Uses existing Markdoc conventions (`{% callout %}`) from the docs site. Content is accurate -- the Kilo-Org/kilo repo does contain the new CLI and the migration plan document exists at the linked path.

### Link Verification

| Link | Status | Destination |
|------|--------|-------------|
| `blog.kilo.ai/p/kilo-cli` | Valid | "Kilo CLI 1.0: Built for Kilo Speed" (2026-02-03) |
| `github.com/Kilo-Org/kilo` | Valid | New Kilo monorepo |
| Feature parity doc | Valid | `opencode-migration-plan.md` in kilo repo |
| `github.com/Kilo-Org/kilo/issues` | Valid | Issues page |

## Verification

- **CI**: All 11 required checks pass (Build Markdoc Site, compile, tests across platforms, etc.)
- **Local testing**: Not applicable -- docs-only change, no fork mirror needed
- **Visual verification**: PR description includes screenshots showing the banner rendered correctly
- **Link verification**: All 4 external links confirmed accessible and correct
- **Stale docs risk**: Low. The pre-release section references the current state of the Kilo CLI replatforming, which is actively underway. The banner is inherently temporal and will need removal once the replatforming is complete, but that's expected.

## Bot Review Synthesis

| Bot | Status | Key Finding | Useful? |
|-----|--------|-------------|---------|
| CodeRabbit | Not collected | Batch review — no individual fork PR | N/A |
| Gemini | Not collected | Batch review — no individual fork PR | N/A |
| Greptile | Not collected | Batch review — no individual fork PR | N/A |
| CodeQL | Not collected | Batch review — no individual fork PR | N/A |
| Qodo | Not collected | Batch review — no individual fork PR | N/A |

## Lessons Learned

- For docs-only PRs, the key review axes are: link validity, content accuracy, stale-docs risk, and CSS/layout correctness. This PR hits all four.
- Hard-coded layout offsets for dynamic content (banners, alerts) are a recurring pattern in docs sites. The kiloconnect bot's suggestion to derive offsets from actual layout is good engineering practice, but pragmatically the hard-coded approach works fine for announcements with known, short copy.
- Temporal announcements (banners, callouts about "current status") carry inherent stale-docs risk. Worth noting in review but not blocking -- the team will need to remember to update/remove these when the replatforming completes.

---

<sub>Review #34 of 75 | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews)</sub>
