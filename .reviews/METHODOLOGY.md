# AI PR Review Methodology

Built from evidence. Each section added after patterns emerge from actual reviews.

---

## Stack

| Layer | Tool | Role | Cost |
|-------|------|------|------|
| Primary | Claude Code | Deep analysis, review composition, journal writing | - |
| Bot | CodeRabbit | Line-by-line review, summaries | Free (public) |
| Bot | Gemini Code Assist | Google model perspective, /gemini commands | Free |
| Bot | Greptile | Codebase-graph-aware review, architecture context | $20/mo |
| Bot | CodeQL | SAST security scanning | Free |
| Bot | Qodo PR-Agent | Open-source auto-describe/review | Free |
| Search | Sourcegraph | Blast radius queries, cross-repo references | Free (public) |
| Gate | Human (Jeremy) | Final approval before submit | - |

## Workflow

1. Pick PR from priority queue
2. **Read ALL existing comments/reviews on upstream PR** — understand maintainer feedback, contributor discussion, and any pending requests before writing our review
3. Mirror PR on fork → bots auto-review (2-5 min)
4. Fetch upstream metadata, diff, CI status
5. Read codebase context + synthesize bot findings
6. Analyze diff, run checklist, create artifacts
7. Verify (CI + local testing scaled by tier)
8. Compose review (Comment 1) + journal (Comment 2)
9. Quality gate (tone lint, metadata check, link check)
10. **Human (Jeremy) approves** — reviews are NOT posted until explicitly approved
11. Submit to upstream with links to fork evidence

## Verification Strategy

| Tier | What We Check |
|------|--------------|
| All | Upstream CI, bot consensus on fork PR |
| 3+ | Targeted tests, type checking, Sourcegraph blast radius |
| 5+ | Full build, manual testing for UI changes |
| Providers | Pattern compliance, security audit, streaming support |

## Evidence

All reviews link to fork PRs where 5-6 independent AI tools analyzed the same change. Bot agreement/disagreement is documented in each journal's "Bot Review Synthesis" section.

---

## Patterns (Emerging)

### Docs PRs (from review #1: PR #5667)
- Changesets not required for docs-only changes in `apps/kilocode-docs/`
- Only `Build Markdoc Site` and `check-translations` CI checks are directly relevant
- Acknowledge contributor resilience (adapting to upstream file removals)
- "Is this true?" is a high-value review question

### Infrastructure (from review #1: PR #5667)
- GitHub Codespaces on fork for build/test/push (devcontainer + SSHD feature)
- Local VM for analysis, review composition, journal writing only
- Cherry-pick upstream PR commits (not API file replacement) for accurate bot diffs
- Codespace free tier (60 core-hours/mo) covers ~60 PRs/month

### Fork PR Methodology (from review #1: PR #5667)
- API file replacement via GitHub Contents API creates wrong diffs (full file swap)
- Must use `git am` with patches from `gh pr diff --patch` for accurate cherry-picks
- Bot reviews are only as good as the diff they see
- Track bot false positives in status.json `bot_findings` field

### Bot Consensus (from review #2: PR #5869)
- When 2+ bots independently flag the same issue with different framing, the finding is almost certainly real
- CodeRabbit: "orphaned bullet point" + Gemini: "breaks grammatical flow" = same structural issue
- Bot agreement directly validates manual analysis and increases confidence score
- Greptile still not responding on docs PRs — investigate trigger conditions

### Document Structure (from review #2: PR #5869)
- Cross-cutting docs changes must check for in-progress syntactic structures (lists, tables, code blocks)
- Inserting a new section mid-list is a classic "insert in the wrong spot" issue
- All CI green doesn't mean content is correct — Markdoc validates syntax, not document coherence
- Source code verification prevents docs drift (check actual command definitions)

### File Deletions (from review #3: PR #5807)
- Always search codebase for references to deleted files (nav configs, feature tables, imports)
- Bots only analyze the diff — they can't flag what's missing from the PR
- Markdoc build passes despite broken internal links — needs link checker CI
- Bot-generated PRs (kiloconnect) may have gaps in cross-reference cleanup

### Links & References (from review #7+)
- Methodology link in journals MUST point to fork: `https://github.com/jeremylongshore/kilocode/tree/main/.reviews`
- NEVER link to `Kilo-Org/kilocode/.reviews` — that path doesn't exist upstream
- All fork PR links must be verified before posting
- No 404s in anything we post — test every link

### Maintainer Context (from reviews #9, #11)
- Always read existing comments — contributor may have agreed to revisions (#5760)
- Maintainer feedback can invalidate the PR approach entirely (#5569)
- Don't approve PRs where the contributor themselves plans to change the implementation

<!-- More patterns added as reviews accumulate -->
