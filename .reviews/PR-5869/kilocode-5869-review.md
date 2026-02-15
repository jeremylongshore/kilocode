<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5869
title: "docs: clarify slash commands (/newtask vs /smol) (#2160)"
author: EloiRamos
category: docs
tier: 1
lines: 20
files: 2
verdict: COMMENT
confidence: 4
reviewed_at: 2026-02-14
linked_issue: 2160
fork_pr: https://github.com/jeremylongshore/kilocode/pull/5
-->

# Review: kilocode #5869

> **docs: clarify slash commands (/newtask vs /smol) (#2160)** by @EloiRamos
> Multi-AI analysis: [Fork PR #5](https://github.com/jeremylongshore/kilocode/pull/5) — reviewed by CodeRabbit, Gemini, CodeQL, Qodo

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | `/newtask` and `/smol` descriptions match source code |
| Conventions | ISSUE | cli.md change breaks existing document structure |
| Changeset | SKIP | Docs-only PR, no version bump required |
| Tests | N/A | No code changes |
| i18n | N/A | Docs site, not UI strings |
| Types | N/A | No TypeScript |
| Security | N/A | Static documentation |
| Scope | PASS | Two files, single concern |

## Findings

### 🟡 cli.md: New section breaks existing configuration list

**File**: `apps/kilocode-docs/pages/code-with-ai/platforms/cli.md` (lines 167-174)

The new `## Slash Commands` header is inserted in the middle of the "Configuration is managed through:" list, which:
1. Removes two existing list items (`/connect` command and config file path `~/.config/kilo/config.json`)
2. Orphans the remaining `kilo auth` bullet point after the new section
3. Breaks the grammatical flow — the sentence "Configuration is managed through:" now has no list following it

**Before**:
```markdown
Configuration is managed through:

- `/connect` command for provider setup (interactive)
- Config files directly at `~/.config/kilo/config.json`
- `kilo auth` for credential management
```

**After** (problematic):
```markdown
Configuration is managed through:

## Slash Commands
...
{% /callout %}
- `kilo auth` for credential management
```

**Suggested fix**: Keep the configuration list intact. Place the new Slash Commands section either before or after the Configuration block, and restore the removed list items.

### ✅ using-modes.md: Clean and accurate

The additions to `using-modes.md` are well-structured. The comparison table for `/newtask` vs `/smol` is clear and the descriptions match the source code in `webview-ui/src/utils/slash-commands.ts`.

## CI Status

| Check | Result |
|-------|--------|
| Build Markdoc Site | PASS |
| compile | PASS |
| check-translations | PASS |
| unit-test | PASS |
| test-extension (ubuntu) | PASS |
| test-extension (windows) | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| build-cli | PASS |
| test-cli | PASS |
| test-jetbrains | PASS |
| Vercel | SKIP (auth required, expected for external contributors) |

## Code Snippets

```diff
# apps/kilocode-docs/pages/code-with-ai/platforms/cli.md (structural issue)

 Configuration is managed through:

-- `/connect` command for provider setup (interactive)
-- Config files directly at `~/.config/kilo/config.json`
+## Slash Commands
+
+The CLI's interactive mode supports slash commands for common operations...
+
+{% callout type="tip" %}
+**Confused about /newtask vs /smol in the IDE?**...
+{% /callout %}
 - `kilo auth` for credential management
```

```diff
# apps/kilocode-docs/pages/code-with-ai/agents/using-modes.md (clean)

-2. **Slash command:** Type `/architect`, `/ask`, `/debug`, or `/code` in the chat input
+2. **Slash command:** Type `/architect`, `/ask`, `/debug`, or `/code` in the chat input to switch modes. Type `/newtask` to create a new task, or `/smol` to condense your context window.

+### Understanding /newtask vs /smol
+
+| Command    | Purpose                                               | When to Use                                      |
+| ---------- | ----------------------------------------------------- | ------------------------------------------------ |
+| `/newtask` | Creates a new task with context from the current task | When you want to start something new...          |
+| `/smol`    | Condenses your current context window                 | When your conversation is getting too long...    |
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**COMMENT** - The `using-modes.md` changes are clean and accurate. However, the `cli.md` change has a structural issue: it breaks the existing configuration list by inserting a new `## Slash Commands` section in the middle of it, removing two configuration items (`/connect` and config file path) and orphaning `kilo auth`. This was independently flagged by both CodeRabbit and Gemini on the fork analysis. Recommend restructuring cli.md to keep the configuration list intact while adding the slash commands section separately.
