<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5641
title: "feat: parallel task execution with git worktrees in main panel"
author: Drilmo
category: feature
tier: 3
lines: 101
files: 1
verdict: COMMENT
confidence: 0.90
reviewed_at: 2026-02-15
-->

# Review: kilocode #5641

> **feat: parallel task execution with git worktrees in main panel** by @Drilmo

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | n/a | RFC doc only, no code |
| Conventions | yellow | New `.github/docs/` directory has no precedent in this repo |
| Changeset | pass | Not required for docs-only RFC |
| Tests | n/a | No code to test |
| i18n | n/a | No UI strings |
| Types | n/a | No code |
| Security | n/a | No code |
| Scope | pass | Single RFC document, appropriately scoped |

## Findings

1. **yellow** `.github/docs/` is a new directory convention
   No existing `docs/` or `rfcs/` directory exists under `.github/`. If the team wants to establish an RFC convention, this should be a conscious decision. Current `.github/` contents are: `actions/`, `ISSUE_TEMPLATE/`, `scripts/`, `workflows/`, and config files.

2. **yellow** RFC is thin on implementation specifics
   The document outlines high-level components (TaskManager, WorktreeManager reuse, UI changes) and a 4-phase migration path, but lacks detail on the hard problems:
   - How does TaskManager interact with `clineStack` (21 references in ClineProvider.ts)?
   - What happens to checkpoint/undo when multiple tasks run on different worktrees?
   - How are file watchers, terminal sessions, and diagnostics scoped per worktree?
   - Rate limiting across parallel tasks (listed as open question, but this is a prerequisite)

3. **gray** Open questions are the right questions
   The four listed open questions (rate limiting, opt-in vs default, UI visualization, restart persistence) are legitimate and need answers before implementation starts.

4. **gray** No changeset needed
   The changeset bot flagged this, but docs-only RFCs don't need one. No functional code is being shipped.

## CI Status

| Check | Result |
|-------|--------|
| Build Markdoc Site | pass |
| compile | pass |
| test-extension (ubuntu) | pass |
| test-extension (windows) | pass |
| test-webview (ubuntu) | pass |
| test-webview (windows) | pass |
| build-cli | pass |
| test-cli | pass |
| test-jetbrains | pass |
| check-translations | pass |

## Code Snippets

The RFC's architecture diagram:
```
┌─────────────────────────────────────────────────────────┐
│                    ClineProvider                         │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Task 1    │  │   Task 2    │  │   Task 3    │     │
│  │ (main repo) │  │ (worktree1) │  │ (worktree2) │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│         │                │                │             │
│         ▼                ▼                ▼             │
│  ┌─────────────────────────────────────────────────┐   │
│  │              TaskManager (new)                   │   │
│  │  - Active tasks registry                         │   │
│  │  - Worktree management                           │   │
│  │  - Task switching                                │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

Verified references:
- `WorktreeManager.ts` exists at 16KB in `src/core/kilocode/agent-manager/`
- `ClineProvider.ts` exists at 155KB with 21 `clineStack` references
- Agent Manager directory has full parallel execution infrastructure

## Verdict

**COMMENT**

This is a pure RFC -- one markdown file, no code changes, all CI passing. The design direction makes sense: reusing the Agent Manager's worktree infrastructure for the main panel. The referenced components (`WorktreeManager`, `clineStack`, Agent Manager) all exist as described.

The RFC would benefit from more depth on the hard integration questions before implementation starts: checkpoint/undo semantics, file watcher scoping, and terminal session isolation per worktree. The `clineStack` replacement in particular is a massive refactor given ClineProvider's 155KB size and tight coupling.

No objection to merging this as a discussion document. The `feat:` prefix in the title is slightly misleading since no feature is being shipped -- `docs:` or `rfc:` would be more accurate.

---

<sub>Methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)</sub>
