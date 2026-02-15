<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5867
review_number: 24
tier: 1
category: docs
started_at: 2026-02-15T12:00:00Z
completed_at: 2026-02-15T12:30:00Z
-->

# Journal: kilocode #5867 — Review #24

> **PR**: [#5867](https://github.com/Kilo-Org/kilocode/pull/5867) |
> **Title**: Add banner and pre-release extension info |
> **Author**: @lambertjosh |
> **Category**: docs | **Tier**: 1 | **Size**: 80 lines, 3 files

---

## Summary

Docs PR by @lambertjosh adding two things: (1) a site-wide announcement banner in the TopNav directing contributors to the new `Kilo-Org/kilo` repository, and (2) a "Pre-Release Extension" section on the installing page with instructions for trying the new Solid.js-based extension built on the Kilo CLI.

3 files changed, +78/-2 lines. All within `apps/kilocode-docs/`. Verdict: COMMENT due to a broken cross-repo link that points to a nonexistent `main` branch.

## First Impressions

Clean, focused PR from a Kilo team member. The scope is tight: banner component, install docs, CSS height adjustment. No runtime code touched. The screenshots in the PR description show exactly what the changes look like, which is helpful for a visual change.

## What I Looked At

- `apps/kilocode-docs/components/TopNav.tsx` -- banner JSX and embedded CSS
- `apps/kilocode-docs/pages/getting-started/installing.md` -- new pre-release section
- `apps/kilocode-docs/public/globals.css` -- nav height variable adjustments
- All external links referenced in the changes (4 links total)
- Existing bot comments (kiloconnect, changeset-bot)
- Existing human reviews (2 approvals from @emilieschario)
- CI status (all 11 checks passing)

## Analysis

### What the PR does

1. **TopNav.tsx**: Adds an announcement banner div after the main header content. Uses JSX-in-CSS style consistent with the rest of the component. Links to the Kilo CLI blog post and the new `Kilo-Org/kilo` repository. Responsive font size reduction at the 768px breakpoint. Dark background (`#1a1a18`) with muted text and yellow accent links matches the existing Kilo docs color palette.

2. **installing.md**: New "Pre-Release Extension" section inserted between the standard install tabs and the manual installation section. Good placement -- users see the stable install first, then learn about the pre-release option. Includes VS Code install/revert instructions and links to the feature parity tracking document. Uses Markdoc callout syntax correctly.

3. **globals.css**: Updates `--top-nav-height` for both desktop (105px -> 141px, adding 36px for banner) and mobile (60px -> 116px, adding 56px for banner wrapping). Comments document the breakdown clearly.

### Link verification

| Link | Status |
|------|--------|
| `https://github.com/Kilo-Org/kilo` | Verified -- repo exists |
| `https://blog.kilo.ai/p/kilo-cli` | Could not verify (curl timeout), but official Kilo URL from team member |
| `https://github.com/Kilo-Org/kilo/blob/main/...opencode-migration-plan.md` | **BROKEN** -- `main` branch does not exist |
| `https://github.com/Kilo-Org/kilo/issues` | Standard issues URL, will work |

The critical finding: `Kilo-Org/kilo` uses `dev` as its default branch. There is no `main` branch. The link in `installing.md` to the feature parity tracking document uses `blob/main/` and will 404.

### Bot and reviewer observations

- kiloconnect flagged the hardcoded `--top-nav-height` as fragile if the banner wraps differently than expected. Valid but low severity for a temporary banner.
- changeset-bot noted no changeset, which is appropriate for docs-only changes.
- @emilieschario approved without requesting changes.

## Verification

- All 11 CI checks pass (including Markdoc site build)
- No test failures
- Link verification performed via GitHub API

## Lessons Learned

- Always verify branch references in cross-repo links. `Kilo-Org/kilo` uses `dev` as default, not `main`. This is a common gotcha when the linked repo uses a non-standard default branch name.
- Hardcoded height calculations for dynamic content (banners that could wrap) are a known fragility pattern. The inline comment documenting the arithmetic breakdown is the right mitigation for a temporary banner.
- For Tier 1 docs PRs, link verification is the highest-value check -- the code patterns are usually straightforward but broken links directly harm user experience.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md) | Reviewed with GWI + Claude Code</sub>
