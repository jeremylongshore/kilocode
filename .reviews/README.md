# AI-Assisted PR Review: A Case Study

Can a single person clear a 75-PR backlog using AI tooling instead of hiring more developers? This is an experiment to find out.

## The Premise

Open-source projects accumulate PR backlogs. Maintainers burn out. Contributors wait weeks for reviews. The traditional answer is "hire more reviewers." We're testing a different approach: one human orchestrating 6+ AI review tools to produce thorough, evidence-backed reviews at scale.

## The Method

Each PR goes through a 10-step pipeline that combines multiple independent AI analyses with local verification:

```
Upstream PR
    |
    v
Fork Mirror ──> 5+ AI Bots Auto-Review
    |               |
    v               v
Deep Analysis  <── Bot Synthesis
    |
    v
Local Verification (merge + full test suite)
    |
    v
Review + Journal ──> Human Approval ──> Submit
```

### The Stack

| Tool | Role | Cost |
|------|------|------|
| [Claude Code](https://claude.ai/code) | Deep analysis, review composition | Primary |
| [CodeRabbit](https://coderabbit.ai) | Line-by-line review, summaries | Free |
| [Gemini Code Assist](https://cloud.google.com/gemini/docs/code-assist) | Alternative model perspective | Free |
| [Greptile](https://greptile.com) | Codebase-graph-aware review | $20/mo |
| [CodeQL](https://codeql.github.com) | SAST security scanning | Free |
| [Qodo](https://www.qodo.ai) | Auto-describe, bug detection | Free |
| [GitHub Codespaces](https://github.com/features/codespaces) | Build, test, verify | Free tier |

**Total cost: ~$35/month** for infrastructure that produces 6+ independent analyses per PR.

### Per-PR Artifacts

Every review produces:

| File | Purpose | Audience |
|------|---------|----------|
| `review.md` | Structured checklist, findings, verdict | Maintainers, agents |
| `journal.md` | Human narrative, bot synthesis, lessons | Humans, learning |
| `status.json` | Machine-readable metadata, test results | Automation |
| `test-evidence*.log` | Raw terminal output from test runs | Proof of work |

### Verification

Every PR gets merged on a fork branch and tested. No claims without evidence:

- **check-types**: Full TypeScript compilation (22 packages)
- **lint**: ESLint across all packages (18 packages)
- **test**: Complete test suite (~7,900+ tests)
- **Combined batch tests**: Multiple PRs merged together to prove cross-compatibility

Log files are 6,000+ lines of raw terminal output each, committed alongside reviews.

## Results

| Metric | Value |
|--------|-------|
| PRs Reviewed | **75 / 75** |
| Test Runs Captured | 10 (with full evidence logs) |
| Total Tests Verified | ~7,900+ per run |
| Avg Time per Review | ~12 minutes |
| Infrastructure Cost | ~$0.47/PR |
| Real Bugs Found | 3 (i18n keys, test mocks, path doubling) |
| Upstream Fix Submitted | [PR #5880](https://github.com/Kilo-Org/kilocode/pull/5880) |

### Verdict Distribution (75 PRs)

```
APPROVE            █████████░░░░░░░░  35%  (26)
REQUEST_CHANGES    █████████░░░░░░░░  36%  (27)
COMMENT            ███████░░░░░░░░░░  29%  (22)
```

## Test Evidence Logs

Raw terminal output from fresh test runs (turbo cache cleared before each run). Every log is the full `pnpm test` output — nothing filtered, nothing hidden.

| Log | PRs Covered | Tests | Size |
|-----|-------------|-------|------|
| [combined-batch-1_FRESH_20260214-222323.log](logs/combined-batch-1_FRESH_20260214-222323.log) | #5370, #5660, #5704 | 7,859 | 972K |
| [PR-5562_FRESH.log](logs/PR-5562_FRESH.log) | #5562 | 7,803 | 942K |
| [combined-batch-2_FRESH.log](logs/combined-batch-2_FRESH.log) | #5739, #5817 | 7,938 | 946K |
| [combined-batch-3_FRESH.log](logs/combined-batch-3_FRESH.log) | #5331, #5568 | 7,935 | 944K |
| [combined-batch-4_FRESH.log](logs/combined-batch-4_FRESH.log) | #5667, #5728, #5807, #5865, #5869 | 7,935 | 946K |
| [mega-combined-all_FRESH.log](logs/mega-combined-all_FRESH.log) | **11 PRs merged together** | **7,938** | 947K |
| [PR-5750_FRESH_20260214-173124.log](logs/PR-5750_FRESH_20260214-173124.log) | #5750 | 7,900+ | 951K |
| [PR-5726_FRESH_20260214-174202.log](logs/PR-5726_FRESH_20260214-174202.log) | #5726 | 7,900+ | 804K |
| [PR-5739_FRESH_20260214-175226.log](logs/PR-5739_FRESH_20260214-175226.log) | #5739 | 7,900+ | 951K |
| [batch-5-mirrors_FRESH_20260215.log](logs/batch-5-mirrors_FRESH_20260215.log) | 10 mirror PRs merged | 7,991 | 941K |

All logs are also browsable in the [logs/](logs/) directory.

## Other Evidence

### Fork PRs

34 fork PRs created for multi-AI review analysis:

- PRs #3–#24: Original review mirrors (24 PRs, all merged)
- PRs #25–#34: Additional mirror batch (10 PRs, all merged)

### Fork Branches

All review branches are publicly inspectable:

- Individual: `review/PR-{NUM}` (14 branches)
- Combined batches: `review/combined-batch-{1-4}` (4 branches)
- Integration proof: `review/mega-combined-all` (11 PRs merged, all tests pass)

### Bot Review Examples

Each fork PR collects independent AI reviews. Examples:

- [Fork PR #15](https://github.com/jeremylongshore/kilocode/pull/15) - Gemini + Qodo caught missing i18n key
- [Fork PR #14](https://github.com/jeremylongshore/kilocode/pull/14) - Identified test mock mismatch after SDK refactor
- [Fork PR #13](https://github.com/jeremylongshore/kilocode/pull/13) - Multiple bots agreed on correctness

## Directory Structure

```
.reviews/
├── README.md                    # This file
├── METHODOLOGY.md               # Emergent patterns from actual reviews
├── DASHBOARD.md                 # Live dashboard with all verdicts
├── PROGRESS.md                  # Review log with timing data
├── priority-queue.json          # Sorted PR queue (75 PRs)
├── db/                          # SQLite tracking database
├── logs/                        # Master test evidence archive (10 runs, ~9.3MB)
├── templates/                   # Review comment templates
└── PR-{NUM}/                    # Per-PR review packages (75 directories)
    ├── kilocode-{NUM}-review.md     # Structured review
    ├── kilocode-{NUM}-journal.md    # Human narrative
    ├── status.json                  # Metadata + test results
    ├── test-evidence*.log           # Raw test output
    └── artifacts/                   # Diagrams, screenshots
```

## Findings

### What Works

1. **Bot consensus is signal.** When 2+ bots independently flag the same issue with different framing, it's almost certainly real.
2. **Combined batch testing** proves cross-PR compatibility efficiently. One test run covers multiple PRs.
3. **Structured artifacts** (review + journal + evidence) create an audit trail that's both machine-parseable and human-readable.
4. **$35/month** replaces what would traditionally require dedicated reviewer hours.

### What Doesn't

1. **Greptile** hasn't produced reviews on fork PRs despite being installed and configured.
2. **CodeRabbit free tier** rate-limits during batch operations.
3. **Flaky tests** (`filter.test.ts` race condition) require documenting pre-existing issues vs PR-caused failures.
4. **No substitute for codebase knowledge.** AI tools are force multipliers, not replacements for understanding architecture.

### Unexpected Discoveries

- Found and fixed a [pre-existing test bug](https://github.com/Kilo-Org/kilocode/pull/5880) (doubled path in `__dirname` vs `process.cwd()`) while verifying PR changes
- Qodo's bug detection caught a user-visible i18n issue that manual review might have missed
- Bot disagreement is more valuable than agreement — it highlights areas needing deeper analysis

## Methodology Details

See [METHODOLOGY.md](METHODOLOGY.md) for the full emergent playbook built from patterns discovered during reviews.

See [DASHBOARD.md](DASHBOARD.md) for the live review dashboard with verdicts, findings, and links.

See [PROGRESS.md](PROGRESS.md) for the review log with timing data.

---

*This is an ongoing experiment. Patterns, tools, and processes evolve as evidence accumulates.*
