<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5331
title: "feat(mcp): re-enable oauth resource parameter and add discovery logging"
author: jrf0110
category: feature
tier: 2
lines: 4
files: 2
confidence: 5
verdict: APPROVE
fork_pr: https://github.com/jeremylongshore/kilocode/pull/10
linked_issue: N/A
-->

## Review Summary

| Aspect | Assessment |
|--------|------------|
| **Verdict** | APPROVE |
| **Confidence** | 5/5 |
| **Risk** | Low |
| **Blocking Issues** | 0 |
| **Suggestions** | 1 (minor) |

## Checklist

- [x] CI passes (all 11 checks green)
- [x] Maintainer approved (@marius-kilocode)
- [x] Changes match PR description
- [x] No security concerns (logging, auth params)
- [ ] Changeset included (missing, but patch-level change)

## Findings

### 1. Stale Comment (Minor)

**Location**: `src/services/mcp/oauth/McpOAuthService.ts:187-188`

The comment above the authorization params still says:
```typescript
// Note: We don't include the 'resource' parameter by default as some servers
// (like Cloudflare) don't support RFC 8707 and return internal server error
```

But the code now **does** include the resource parameter:
```typescript
resource: serverUrl,
```

**Suggestion**: Update or remove the comment to reflect the new behavior.

### 2. Cloudflare Compatibility (Context)

The original #5297 PR disabled the resource parameter specifically because Cloudflare doesn't support RFC 8707. Re-enabling it will break Cloudflare-hosted MCP servers.

This is likely intentional (RFC compliance > single provider compatibility), but worth noting in changelog.

## Verification

| What | How | Result |
|------|-----|--------|
| CI | `gh pr checks` | 11/11 pass |
| Maintainer approval | Review state | APPROVED |
| Bot reviews | Fork PR #10 | Gemini: no issues. CodeRabbit: rate-limited (1 of 2 bots responded) |
| Type safety | check-types | PASS (22 packages) |

## Code Changes

```typescript
// McpAuthorizationDiscovery.ts - Added logging
} catch (e) {
  console.warn(`Failed to fetch RFC 8414 metadata:`, e)
}
// ...
} catch (e) {
  console.warn(`Failed to fetch OIDC metadata:`, e)
}

// McpOAuthService.ts - Re-enabled resource param
-// resource: serverUrl, // Disabled: Cloudflare doesn't support RFC 8707
+resource: serverUrl,
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Recommendation

**APPROVE** — Clean RFC 8707 compliance change with improved observability. The stale comment is minor and can be fixed in a follow-up.

---

> Multi-AI analysis: [Fork PR #10](https://github.com/jeremylongshore/kilocode/pull/10)
