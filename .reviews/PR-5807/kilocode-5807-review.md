<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5807
title: "docs: remove Enterprise pricing, direct users to contact sales"
author: app/kiloconnect
category: docs
tier: 1
lines: 71
files: 3
verdict: COMMENT
confidence: 5
reviewed_at: 2026-02-14
fork_pr: https://github.com/jeremylongshore/kilocode/pull/6
-->

# Review: kilocode #5807

> **docs: remove Enterprise pricing, direct users to contact sales** by @kiloconnect / @alexkgold
> Multi-AI analysis: [Fork PR #6](https://github.com/jeremylongshore/kilocode/pull/6) — reviewed by CodeRabbit, Gemini, CodeQL, Qodo

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Pricing text correctly replaced, "Contact Sales" links valid |
| Conventions | ISSUE | Indentation nit in migration.md (` 2.` should be `2.`) |
| Changeset | SKIP | Docs-only PR, no version bump required |
| Tests | N/A | No code changes |
| i18n | N/A | Docs site, not UI strings |
| Types | N/A | No TypeScript |
| Security | PASS | Removes internal pricing details from public docs |
| Scope | ISSUE | Deletes file but leaves 3 dangling references |

## Findings

### 🔴 Dangling references to deleted `annual-billing.md`

The PR deletes `apps/kilocode-docs/pages/contributing/architecture/annual-billing.md` but does not clean up references in 3 other files:

1. **`apps/kilocode-docs/lib/nav/contributing.ts`** — Navigation entry still links to `/contributing/architecture/annual-billing`. This will create a **broken nav link** in the sidebar.

2. **`apps/kilocode-docs/pages/contributing/architecture/features.md`** — Table row still links to `[Annual Billing](/docs/contributing/architecture/annual-billing)`. This will be a **broken documentation link**.

3. **`apps/kilocode-docs/mappingplan.md`** — Mapping plan references the page (lower impact, internal planning doc).

**Suggested fix**: Remove the nav entry from `contributing.ts`, remove the table row from `features.md`, and optionally remove the `mappingplan.md` reference.

### 🟡 Indentation in migration.md

**File**: `apps/kilocode-docs/pages/collaborate/enterprise/migration.md` (line ~61)

The updated line has a leading space before `2.` which may render as an indented sub-item:

```diff
-2. **Subscribe to Teams ($15/month)** or **Enterprise ($150/month)**
+ 2. **Subscribe to Teams ($15/user/month)** or **Enterprise ([Contact Sales](https://kilo.ai/contact-sales))**
```

Should be:
```markdown
2. **Subscribe to Teams ($15/user/month)** or **Enterprise ([Contact Sales](https://kilo.ai/contact-sales))**
```

Note: This line also correctly fixes "$15/month" → "$15/user/month" (adding "/user").

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
| Vercel | SKIP (auth required) |

## Code Snippets

```diff
# apps/kilocode-docs/pages/collaborate/index.md (clean)
-- **Enterprise ($150/user/month)** — Model controls, audit logs, SSO, dedicated support
+- **Enterprise ([Contact Sales](https://kilo.ai/contact-sales))** — Model controls, audit logs, SSO, dedicated support
```

```diff
# apps/kilocode-docs/pages/contributing/architecture/annual-billing.md (deleted)
# 67 lines removed — internal architecture spec with pricing details
```

```typescript
// apps/kilocode-docs/lib/nav/contributing.ts — DANGLING REFERENCE (not in PR)
{
    href: "/contributing/architecture/annual-billing",
    children: "Annual Billing",
},
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**COMMENT** - The pricing text replacements are correct and the `annual-billing.md` deletion is appropriate (removes internal pricing details from public docs). However, the deletion leaves 3 dangling references — most critically a nav entry in `contributing.ts` and a doc link in `features.md` that will produce broken links. Recommend adding these cleanups before merge. The indentation nit in migration.md is minor.
