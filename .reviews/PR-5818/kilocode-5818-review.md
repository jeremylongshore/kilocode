<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5818
title: "docs: autocomplete transplant documentation"
author: markijbema
category: docs
tier: 1
lines: 3389
files: 50
verdict: APPROVE
confidence: 95
reviewed_at: 2026-02-15
-->

# Review: kilocode #5818

> **docs: autocomplete transplant documentation** by @markijbema

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Content is accurate and internally consistent with codebase references |
| Conventions | PASS | Files placed in `src/services/autocomplete/docs/` and `i18n/` -- appropriate location |
| Changeset | N/A | Docs-only PR, no changeset needed (confirmed by changeset-bot comment) |
| Tests | N/A | Documentation only, no test impact |
| i18n | PASS | 46 new i18n files: 23 runtime locale + 23 package-nls locale, all with consistent key coverage |
| Types | N/A | No type changes |
| Security | PASS | No secrets, no credential exposure |
| Scope | PASS | All additions, zero deletions; purely additive |

## Findings

### Gray (informational)

1. **`package-nls-en.ts:3` -- Minor: Comment syntax discrepancy**
   The en.ts file has `// Source: src/package.nls.json` as a comment, but other locales omit this source-reference line. Not a bug, just an inconsistency in the header comment across locales. The en runtime i18n also has an extra source reference comment (`// Source: src/i18n/locales/en/kilocode.json`) that other locales lack.

2. **Dead code documented accurately**
   The VSCode integration investigation correctly identifies that `kilocode.autocomplete.hasSuggestions` context key is never set, making the Escape keybinding inert (line 1651 of investigation-vscode-integration.md). This is a valuable finding for future maintainers.

3. **Scope observation: 3389 lines / 50 files is large for a "Tier 1 docs" PR**
   While the commit title says "docs", the PR includes 46 i18n translation files. These are `.ts` files exporting translation dictionaries -- they are code that ships with the extension. However, since they are purely additive new files within the `src/services/autocomplete/` Kilo-specific directory (not modifying existing code), the risk is minimal. The `kilocode_change - new file` markers are correctly present on all i18n files.

4. **`investigation-internal-architecture.md` -- Architecture diagram**
   The ASCII art architecture diagram (lines 1142-1179) is well-structured and accurately represents the module's dependency flow based on the actual codebase.

5. **`TRANSPLANT-PLAN.md` -- Interface design quality**
   The proposed interfaces (`IAutocompleteLLMProvider`, `IAutocompleteProfileResolver`, `IAutocompleteSettingsStore`, `IFileIgnoreController`, `ITelemetryClient`, `IWebviewBridge`) are well-designed with clear separation of concerns. The migration checklist (Section 10) provides a practical step-by-step procedure.

## CI Status

| Check | Result |
|-------|--------|
| Build Markdoc Site | PASS |
| build-cli | PASS |
| check-translations | PASS |
| compile | PASS |
| test-cli | PASS |
| test-extension (ubuntu) | PASS |
| test-extension (windows) | PASS |
| test-jetbrains | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| unit-test | PASS |
| storybook-playwright-snapshot | SKIPPED |

All 11 checks pass. The `check-translations` pass confirms the new i18n files are well-formed.

## Code Snippets

Key interface from TRANSPLANT-PLAN.md (Section 2.1):

```ts
export interface IAutocompleteLLMProvider {
  getModelInfo(): AutocompleteModelInfo | undefined
  supportsFim(): boolean
  streamFim(params: {
    prefix: string
    suffix: string
    signal: AbortSignal
    requestId?: string
    onUsage?: (usage: AutocompleteUsage) => void
  }): AsyncGenerator<string>
  streamChat(params: {
    systemPrompt: string
    userPrompt: string
    signal: AbortSignal
    requestId?: string
  }): AsyncGenerator<ChatStreamChunk>
}
```

Example i18n file structure (en.ts, 37 keys):

```ts
export const dict = {
  "kilocode:autocomplete.statusBar.enabled": "$(kilo-logo) Autocomplete",
  "kilocode:autocomplete.statusBar.snoozed": "snoozed",
  // ... 35 more keys
}
```

## Verdict

**APPROVE** -- This is a well-executed documentation PR that serves a clear purpose: enabling the autocomplete module to be transplanted into a standalone VS Code extension. The four investigation documents are thorough, accurate, and correctly reference actual codebase locations. The i18n files are consistent across all 23 locales with matching key sets (37 runtime keys + 9 package-nls keys per locale). All CI checks pass. The `kilocode_change - new file` markers are correctly applied. No existing files are modified, making this zero-risk from a regression standpoint. No changeset is needed for documentation.

---

<sub>Methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)</sub>
