<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5508
title: "[do not merge] Spped UP CI -  BlackSmith Runners"
author: catrielmuller
category: infra
tier: 2
lines: 53
files: 7
review_number: 23
fork_pr: N/A (batch review)
-->

# Review Journal: kilocode #5508

> **PR**: [#5508](https://github.com/Kilo-Org/kilocode/pull/5508) |
> **Title**: [do not merge] Spped UP CI -  BlackSmith Runners |
> **Author**: @catrielmuller |
> **Category**: infra | **Tier**: 2 | **Size**: 53 lines, 7 files

---

## Summary

CI infrastructure PR that replaces GitHub-hosted `ubuntu-latest` runners with BlackSmith managed runners (`blacksmith-4vcpu-ubuntu-2404`) across all 6 Linux workflow files. Also bundles an unrelated but correct bugfix to lancedb path normalization. All CI checks pass. Marked `[do not merge]` by the author.

## First Impressions

The `[do not merge]` tag and the typo in the title ("Spped UP") signal this is experimental/in-progress work. The commit history (7 commits evolving from Depot to BlackSmith, with Windows runner experiments in between) confirms this is an iteration. The PR description is minimal: just "- BlackSmith Runners". The KiloConnect bot already flagged the fork-breakage concern across all 6 workflow files.

## What I Looked At

- All 6 modified workflow files: `build-cli.yml`, `changeset-release.yml`, `cli-publish.yml`, `code-qa.yml`, `markdoc-build.yml`, `update-contributors.yml`
- The lancedb vector store change at `src/services/code-index/vector-store/lancedb-vector-store.ts:358-376`
- Commit history (7 commits showing the Depot -> BlackSmith evolution)
- CI check results (all 12 checks pass)
- KiloConnect bot's 6 inline warnings about fork breakage
- PR metadata (open, not draft, no labels, `REVIEW_REQUIRED`)

## Analysis

### The CI runner migration

Straightforward find-and-replace of `ubuntu-latest` with `blacksmith-4vcpu-ubuntu-2404`. BlackSmith provides faster managed runners with better caching, which explains the "Speed UP CI" motivation. The change is mechanically correct -- CI proves it works.

Two concerns remain:

**Fork breakage**: BlackSmith runner labels are only available to repos with BlackSmith integration. PRs from forks will fail to schedule because the runner label does not resolve. This is the most important issue to fix. The standard pattern is a conditional:

```yaml
runs-on: ${{ github.event.pull_request.head.repo.fork && 'ubuntu-latest' || 'blacksmith-4vcpu-ubuntu-2404' }}
```

**Publish workflow OIDC**: The `cli-publish.yml` uses `id-token: write` for npm provenance. This permission depends on GitHub's OIDC token endpoint being available on the runner. BlackSmith documents OIDC support, but this path is not exercised by PR CI -- it only runs on actual releases. This is a latent risk, not a blocker.

### The lancedb bugfix

The change to `deletePointsByMultipleFilePaths` fixes a real edge case: when `workspacePath` is relative (common in tests/mocks), `path.relative()` produces nonsensical results. The fix adds two guards:
1. Only relativize when both the file path and workspace root are absolute
2. Only use the relative path when the file is actually inside the workspace (no `..` prefix, not still absolute)

This is correct and well-commented. But it has nothing to do with CI runners and should be in its own PR.

### Runner size choices

The `update-contributors` workflow gets `blacksmith-2vcpu-ubuntu-2404` (2 vCPU) while everything else gets 4 vCPU. Makes sense -- that workflow just runs a simple contributor list update. Not documented but reasonable.

## Verification

- CI: All 12 checks pass on the latest commit (`86eba8e0`)
- Publish path: Not testable from PR CI (requires actual release trigger)
- Fork scenario: Not testable without forking and opening a PR
- lancedb fix: No new tests added; the fix is defensive and unlikely to break existing behavior

## Bot Review Synthesis

| Bot | Status | Key Finding | Useful? |
|-----|--------|-------------|---------|
| CodeRabbit | Not collected | Batch review — no individual fork PR | N/A |
| Gemini | Not collected | Batch review — no individual fork PR | N/A |
| Greptile | Not collected | Batch review — no individual fork PR | N/A |
| CodeQL | Not collected | Batch review — no individual fork PR | N/A |
| Qodo | Not collected | Batch review — no individual fork PR | N/A |

## Lessons Learned

- **`[do not merge]` PRs still deserve review**: They communicate intent ("we want to do this") and the review can catch issues before the author is ready. Reviewing early prevents wasted effort later.
- **Commit archaeology matters**: The 7-commit history (Depot -> Windows experiments -> BlackSmith) tells the story of the author's iteration. The inline bot comments still reference "Depot" from an earlier revision, which could confuse reviewers who do not check the final diff.
- **Runner migration has a fork-breakage pattern**: Any switch from GitHub-hosted to custom runners needs a fork fallback strategy. This is a recurring pattern worth documenting in CI contribution guidelines.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
