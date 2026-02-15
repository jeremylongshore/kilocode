<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5508
title: "[do not merge] Spped UP CI -  BlackSmith Runners"
author: catrielmuller
category: infra
tier: 2
lines: 53
files: 7
verdict: COMMENT
confidence: 85
reviewed_at: 2026-02-14
fork_pr: N/A (batch review)
linked_issue: N/A
-->

# Review: kilocode #5508

> **[do not merge] Spped UP CI -  BlackSmith Runners** by @catrielmuller

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | CI passes on all BlackSmith runners |
| Conventions | WARN | PR bundles an unrelated lancedb fix with CI infra changes |
| Changeset | N/A | CI-only + bugfix, no version bump needed |
| Tests | PASS | All 12 CI checks pass (including cross-platform matrix) |
| i18n | N/A | No user-facing strings |
| Types | PASS | lancedb change is well-typed |
| Security | WARN | Fork CI will fail; OIDC/provenance on publish workflows needs validation |
| Scope | WARN | Two unrelated changes in one PR |

## Findings

### 1. (yellow) Unrelated lancedb change bundled with CI infra PR

**File**: `src/services/code-index/vector-store/lancedb-vector-store.ts`

The PR title and description are about BlackSmith CI runners, but the diff includes a substantive logic change to `deletePointsByMultipleFilePaths`. This path normalization fix looks correct and well-commented, but it belongs in a separate PR with its own tests and review scope. Mixing infra changes with application logic makes both harder to review and bisect.

### 2. (yellow) Fork/contributor CI breakage

**Files**: All 6 workflow files

BlackSmith runners are custom labels provided by the BlackSmith CI service. External contributors and forks will not have access to these runners, causing all PR CI checks to fail with runner resolution errors. This is the same concern the KiloConnect bot flagged. Options:
- Gate BlackSmith runners to `push` events only, keep `ubuntu-latest` for `pull_request` from forks
- Use a conditional expression: `runs-on: ${{ github.event.pull_request.head.repo.fork && 'ubuntu-latest' || 'blacksmith-4vcpu-ubuntu-2404' }}`

### 3. (gray) Runner size inconsistency for update-contributors

**File**: `.github/workflows/update-contributors.yml`

Uses `blacksmith-2vcpu-ubuntu-2404` while every other workflow uses `blacksmith-4vcpu-ubuntu-2404`. This is likely intentional (lightweight job = smaller runner), but it is not documented anywhere and could confuse future maintainers.

### 4. (gray) OIDC/provenance compatibility on publish workflows

**File**: `.github/workflows/cli-publish.yml`

The npm publish job uses `id-token: write` for provenance. BlackSmith runners need to support GitHub's OIDC token endpoint for this to work. CI passes on the PR (which does not trigger publish), but the publish path is untested until an actual release is attempted on these runners.

## CI Status

| Check | Result |
|-------|--------|
| compile | PASS |
| check-translations | PASS |
| test-extension (blacksmith-4vcpu-ubuntu-2404) | PASS |
| test-extension (windows-latest) | PASS |
| test-webview (blacksmith-4vcpu-ubuntu-2404) | PASS |
| test-webview (windows-latest) | PASS |
| test-jetbrains | PASS |
| test-cli | PASS |
| build-cli | PASS |
| Build Markdoc Site | PASS |
| unit-test | PASS |
| storybook-playwright-snapshot | SKIPPED |

## Code Snippets

### BlackSmith runner replacement (typical change across 6 workflow files)

```yaml
# Before
runs-on: ubuntu-latest

# After
runs-on: blacksmith-4vcpu-ubuntu-2404
```

### lancedb path normalization fix (unrelated to CI)

```typescript
// Before: blindly relativized all absolute paths
const normalizedPaths = filePaths.map((fp) =>
    path.normalize(path.isAbsolute(fp) ? path.relative(workspaceRoot, fp) : fp),
)

// After: guards against non-absolute workspace roots and paths outside workspace
const normalizedPaths = filePaths.map((fp) => {
    if (path.isAbsolute(fp) && path.isAbsolute(workspaceRoot)) {
        const relative = path.relative(workspaceRoot, fp)
        const isInsideWorkspace =
            relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
        return path.normalize(isInsideWorkspace ? relative : fp)
    }
    return path.normalize(fp)
})
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**COMMENT** -- The PR is explicitly marked `[do not merge]`, so no approval or rejection is appropriate. The CI migration to BlackSmith runners works (all checks pass), but two issues need resolution before this could merge:

1. **Split the lancedb fix into its own PR.** It is a real bugfix but does not belong here.
2. **Address fork/contributor CI breakage.** Add conditional runner selection so forks fall back to `ubuntu-latest`.

The commit history (7 commits: Depot -> Windows fixes -> back to GH Windows -> BlackSmith) also suggests this should be squashed before merge.
