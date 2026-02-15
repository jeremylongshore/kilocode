<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 4100
title: "[VIBE CODED] Feat: Intelligent provider"
author: ivanarifin
category: provider
tier: 5
lines: 1904
files: 50
review_number: 36
-->

# Review Journal: kilocode #4100

> **PR**: [#4100](https://github.com/Kilo-Org/kilocode/pull/4100) |
> **Title**: [VIBE CODED] Feat: Intelligent provider |
> **Author**: @ivanarifin |
> **Category**: provider | **Tier**: 5 | **Size**: 1904 lines, 50 files

---

## Summary

Large feature adding difficulty-based provider routing. The "VIBE CODED" label is accurate -- tests mock everything rather than testing real logic, the AI response parser lacks validation, and cross-cutting changes affect all providers. Maintainer has deprioritized. REQUEST_CHANGES.

## First Impressions

The title's honesty about vibe coding set expectations. At 1885 additions across 50 files with i18n for all 22 locales, this is a substantial feature. The concept mirrors the existing VirtualQuotaFallbackHandler pattern but adds AI-driven difficulty classification as the routing mechanism.

## What I Looked At

- `src/api/providers/intelligent.ts` (521 lines) -- core handler with classifier prompt, difficulty assessment, profile loading
- `src/api/providers/__tests__/intelligent-provider.spec.ts` (390 lines) -- test file
- `src/core/task/Task.ts` changes -- rawInputValue tracking, metadata passing, constructor.name check
- `packages/types/src/provider-settings.ts` -- Zod schema additions
- `webview-ui/src/components/chat/ChatTextArea.tsx` -- send button behavior changes
- `webview-ui/src/components/settings/providers/IntelligentProvider.tsx` and IntelligentProviderPresentation.tsx
- CI status, maintainer comments

## Analysis

### Test quality is the primary concern

The 390-line test file creates mock objects with `vi.fn()` for every method and then asserts against mock return values. Example:

```typescript
handler.assessDifficulty.mockResolvedValue("easy")
const difficulty = await handler.assessDifficulty(prompt)
expect(difficulty).toBe("easy") // tautology
```

This tests vitest mocking, not the IntelligentHandler. The real class is imported but never instantiated.

### Constructor name check is fragile

```typescript
if (this.api.constructor.name === "IntelligentHandler" ...)
```

This breaks with minification and contradicts the existing pattern where VirtualQuotaFallbackHandler uses `instanceof`.

### AI classification adds unaccounted latency

Every new user message triggers a full LLM API call (~600 token classifier prompt + response) before actual task processing begins. No loading indicator, no timeout, no opt-out per message.

### Cross-cutting ChatTextArea changes

The send button handler was rewritten to clear input/images before `onSend()`, affecting all providers.

## Verification

- CI: Translation check fails; all other checks pass
- Merge status: CONFLICTING
- One community approval from @Ari4ka
- Maintainer Kevin: "start temporarily limiting the size of features"

## Lessons Learned

- "VIBE CODED" in a PR title is a useful honesty signal -- it directly predicted the test quality issues found
- When a handler needs to be detected at runtime, a shared interface or symbol is more robust than constructor.name
- AI-in-the-loop patterns (using LLM to route to LLM) create compounding latency and cost that need explicit user consent and visibility

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
