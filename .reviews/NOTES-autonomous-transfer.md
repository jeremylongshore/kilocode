# Notes: Autonomous Agentic Transfer

## Current Stack (v2)

### Active
- **Claude Code** - main driver (interactive, human-gated on submit)
- **CodeRabbit** - auto-reviews on fork PRs (free, public repos)
- **Gemini Code Assist** - auto-reviews on fork PRs (free)
- **Greptile** - codebase-graph-aware reviews on fork PRs ($20/mo)
- **CodeQL** - SAST security scanning via GitHub Action (free)
- **Qodo PR-Agent** - open-source auto-review via GitHub Action (free)
- **Dependabot** - dependency vulnerability scanning (free)
- **Sourcegraph** - public code search for blast radius (free)

### Not Yet Wired In
- **GWI** - triage scoring, slop detection, codebase-aware drafts
- **Bounty tone lint** - AI slop detection gate before posting
- **Sourcegraph Cody Pro** - unlimited AI codebase chat ($9/mo, pending signup)

## Fork-Based Testing Pattern

The fork (jeremylongshore/kilocode) serves as a test lab:
1. Mirror each upstream PR as a fork PR
2. All bots auto-review the fork PR (5-6 independent AI analyses)
3. Synthesize bot findings into human review
4. Post to upstream with links back to fork
5. Fork becomes public evidence of the methodology

This is the industry-standard pattern for PR verification:
- Cherry-pick/mirror the change
- Run independent analysis in isolated environment
- Document findings with links to evidence
- Submit with full audit trail

## Transfer Path: Interactive → Autonomous

### Phase 1 (Current): Human-driven, bot-assisted
- Human triggers each step
- Bots run automatically on fork
- Human synthesizes and approves
- Human submits to upstream

### Phase 2: Scripted pipeline
- Script creates fork PR automatically
- Script waits for bot reviews
- Script drafts review + journal from bot synthesis
- Human approves and submits

### Phase 3: Agent loop
- Agent processes queue from priority-queue.json
- Agent creates fork PRs, waits for bots, drafts reviews
- Human gate only on submit
- Confidence calibration: tier 1-2 auto-submit, tier 3+ human review

### Phase 4: Full autonomous
- Human audit on sample (every 5th PR)
- GWI triage score drives confidence thresholds
- Bounty tone lint gates all output
- Failure mode monitoring: track post-submit feedback

## Key Questions for Later
- Can GWI's triage score predict which PRs need human review?
- What's the false positive rate per bot? (track in Bot Review Synthesis)
- What's the minimum viable confidence threshold for auto-submit?
- How does Devin's auto-review API endpoint model compare?

## Infrastructure

### Build/Test Environment: GitHub Codespaces
- **Decision**: Use Codespaces on the fork for all build, test, and push operations
- **Rationale**: Local dev VM (4GB) OOM-kills on `pnpm install` for the kilocode monorepo (~2GB node_modules). Codespaces provide 4-core/32GB machines with the project's devcontainer pre-configured.
- **Setup**: Added `ghcr.io/devcontainers/features/sshd:1` to fork's devcontainer.json for CLI access via `gh codespace ssh`
- **Cost**: Free tier = 60 core-hours/month. At ~15 min per PR review session = 1 core-hour = 60 PRs/month on free tier.
- **Machine**: `basicLinux32gb` (4-core, 32GB RAM)
- **Workflow**: SSH into Codespace → cherry-pick upstream PR → push branch → create PR → bots auto-review
- **Why not GCP VM**: Codespaces are already integrated with the fork repo, have the devcontainer, and need zero infrastructure management. GCP VM would require SSH setup, git auth, Node/pnpm install, and ongoing maintenance.

### Local Environment (this VM)
- Used for: analysis, review composition, journal writing, methodology docs
- NOT used for: building, testing, or pushing kilocode changes
- Reason: 4GB RAM cannot handle the monorepo's dependency tree

## Cost Analysis
- Current: $35/mo (Greptile $20 + Sourcegraph Cody $9 + buffer)
- Codespaces: Free tier (60 core-hours/month)
- Per PR: $35/75 = $0.47/PR
- Devin: $500/mo, roughly $6.67/PR at similar volume
- Delta: 14x cheaper with full transparency
