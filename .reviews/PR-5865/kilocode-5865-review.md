<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5865
title: "Add troubleshooting with console capture"
author: alexkgold
category: docs
tier: 1
lines: 58
files: 1
verdict: COMMENT
confidence: 4
reviewed_at: 2026-02-14
linked_issue: N/A
fork_pr: https://github.com/jeremylongshore/kilocode/pull/7
-->

# Review: kilocode #5865

> **Add troubleshooting with console capture** by @alexkgold
> Multi-AI analysis: [Fork PR #7](https://github.com/jeremylongshore/kilocode/pull/7) — reviewed by CodeRabbit, Gemini, CodeQL, Qodo

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | VS Code command and JetBrains JCEF steps are accurate |
| Conventions | ISSUE | Page not added to navigation (`getting-started.ts`) |
| Changeset | SKIP | Docs-only PR, no version bump required |
| Tests | N/A | No code changes |
| i18n | N/A | Docs site, not UI strings |
| Types | N/A | No TypeScript |
| Security | N/A | Static documentation |
| Scope | PASS | Single file, single concern |

## Findings

### 🟡 Page not added to navigation

The troubleshooting page is created at `getting-started/troubleshooting.md` but is not added to `apps/kilocode-docs/lib/nav/getting-started.ts`. The page won't appear in the sidebar and users can only find it via direct URL or search.

**Suggested fix**: Add to the "Help" section in `getting-started.ts`:

```typescript
{
    title: "Help",
    links: [
        { href: "/getting-started/faq", children: "FAQ" },
        { href: "/getting-started/troubleshooting", children: "Troubleshooting" },
        {
            href: "/getting-started/migrating",
            children: "Migrating from Cursor",
        },
    ],
},
```

### 🟡 Maintainer feedback: scope and organization

@olearycrew commented that this guide is geared towards the extension and suggested:
1. Making that scope explicit in the content
2. Organizing into a troubleshooting folder (e.g., `getting-started/troubleshooting/index.md`)

This feedback should be addressed before merge.

### ⚪ JetBrains instructions could be simpler

The JetBrains section asks users to enable `ide.browser.jcef.contextMenu.devTools.enabled` but then doesn't explain how to use the context menu. Instead it directs them to manually connect via `localhost:9222/json` and parse JSON. Consider:
1. Adding a "right-click → Inspect" instruction after enabling the context menu
2. Using `chrome://inspect` as an alternative to the JSON endpoint

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
| Vercel | PASS |

## Code Snippets

```markdown
# New file: apps/kilocode-docs/pages/getting-started/troubleshooting.md

## Opening Developer Tools

{% tabs %}
{% tab label="VS Code" %}
1. **Open the Command Palette**: Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. **Search for Developer Tools**: Type `Developer: Open Webview Developer Tools` and select it
{% /tab %}
{% tab label="JetBrains" %}
### Enable JCEF Debugging
1. Go to Help → Find Action → Registry
2. Set `ide.browser.jcef.debug.port` → `9222`
3. Enable `ide.browser.jcef.contextMenu.devTools.enabled`
4. Restart IDE
### Connect Chrome DevTools
1. Navigate to `http://localhost:9222/json`
2. Find entry with `"title": "Kilo Code"`, open `devtoolsFrontendUrl`
{% /tab %}
{% /tabs %}
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**COMMENT** - Well-written troubleshooting guide with good Markdoc tabs usage. Two items need attention before merge: (1) the page must be added to the nav config in `getting-started.ts` for discoverability, and (2) @olearycrew's feedback about scoping to the extension and folder organization should be addressed. The JetBrains instructions could also be simplified. Content accuracy is solid.
