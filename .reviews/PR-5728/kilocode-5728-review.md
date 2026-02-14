<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5728
title: "feat(docs): add dynamic sitemap.xml generation"
author: app/kiloconnect
category: docs
tier: 1
lines: 279
files: 3
verdict: COMMENT
confidence: 4
reviewed_at: 2026-02-14
fork_pr: https://github.com/jeremylongshore/kilocode/pull/8
-->

# Review: kilocode #5728

> **feat(docs): add dynamic sitemap.xml generation** by @kiloconnect / @olearycrew
> Multi-AI analysis: [Fork PR #8](https://github.com/jeremylongshore/kilocode/pull/8) — reviewed by CodeRabbit, Gemini, CodeQL, Qodo

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | ISSUE | Duplicate homepage entry; homepage missing lastmod |
| Conventions | PASS | Follows existing pattern (llms.txt rewrite in same file) |
| Changeset | SKIP | Docs-site infrastructure, no extension version bump needed |
| Tests | PASS | 162 lines, good coverage with mocked fs |
| i18n | N/A | No UI strings |
| Types | PASS | TypeScript, proper Next.js types used |
| Security | PASS | XML escaping implemented; no user input in file paths |
| Scope | PASS | 3 files, single concern (sitemap generation) |

## Findings

### 🟡 Duplicate homepage entry

**File**: `apps/kilocode-docs/pages/api/sitemap.xml.ts` (lines 78-84, 86-99)

The homepage is added as a hardcoded entry (line 78-84), but the root `index.md` file will also be discovered by `findMarkdownFiles()` and generate a URL path of `/` → `https://kilo.ai/docs`. This creates two `<url>` entries for the same location.

**Fix**: Either skip root `index.md` in the file scanner, or remove the hardcoded homepage entry and handle `index.md` with priority 1.0 as a special case.

### 🟡 Homepage missing `<lastmod>`

**File**: `apps/kilocode-docs/pages/api/sitemap.xml.ts` (lines 78-84)

The hardcoded homepage entry omits `<lastmod>` while all other entries include it. Search engines use `lastmod` for crawl scheduling — the most important page should have it.

```typescript
// Current (missing lastmod):
urls.push(`  <url>
    <loc>${SITE_URL}</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`)
```

### ⚪ Unused `baseDir` parameter

**File**: `apps/kilocode-docs/pages/api/sitemap.xml.ts` (line 11)

`findMarkdownFiles(dir: string, baseDir: string = dir)` — the `baseDir` parameter is passed through recursive calls but never read. Can be removed.

### ⚪ Hardcoded `SITE_URL`

**File**: `apps/kilocode-docs/pages/api/sitemap.xml.ts` (line 5)

`const SITE_URL = "https://kilo.ai/docs"` — consider using `process.env.NEXT_PUBLIC_SITE_URL` with this as fallback, for staging/preview environments.

### ⚪ Synchronous I/O in API route

`readdirSync` and `statSync` block the event loop during generation. Mitigated by the 1-hour cache, but `readdir`/`stat` (async) would be more idiomatic for a Next.js API route. Low priority given the cache strategy.

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

```typescript
// apps/kilocode-docs/pages/api/sitemap.xml.ts — core logic
function findMarkdownFiles(dir: string, baseDir: string = dir): string[] {
    const files: string[] = []
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (entry.name === "api") continue  // Skip api directory
            files.push(...findMarkdownFiles(fullPath, baseDir))
        } else if (entry.name.endsWith(".md")) {
            files.push(fullPath)
        }
    }
    return files
}
```

```javascript
// apps/kilocode-docs/next.config.js — rewrite rule (matches existing llms.txt pattern)
{
    source: "/sitemap.xml",
    destination: "/api/sitemap.xml",
},
```

## Verdict

**COMMENT** - Solid implementation with good test coverage (162 lines). The architecture follows the existing `llms.txt` pattern for API routes with rewrites. Two functional issues should be addressed: duplicate homepage entry (hardcoded + scanned `index.md`) and missing `lastmod` on the homepage. The unused `baseDir` parameter, hardcoded URL, and sync I/O are minor polish items. Security is clean — XML escaping is properly implemented.
