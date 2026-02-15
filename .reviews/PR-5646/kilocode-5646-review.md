<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5646
title: "feat(claude-code): Replace OAuth with CLI subprocess integration"
author: Drilmo
category: feature
tier: 6
lines: 4382
files: 23
verdict: COMMENT
confidence: 0.82
reviewed_at: 2026-02-15
review_number: 70
-->

# Review: kilocode #5646

> **feat(claude-code): Replace OAuth with CLI subprocess integration** by @Drilmo

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | pass | Addresses real Anthropic credential restriction. CLI subprocess approach matches Cline's implementation. |
| Conventions | warn | Missing `kilocode_change` markers on several modified files in shared code |
| Changeset | pass | Minor changeset for `kilo-code` |
| Tests | warn | Deleted 812 lines of tests (oauth, caching, streaming-client), no new tests added for CLI subprocess |
| i18n | pass | No new user-facing strings requiring translation |
| Types | pass | Model definitions properly updated, `claudeCodePath` added to schema |
| Security | info | CLI subprocess inherits user's shell environment -- see findings |
| Scope | pass | Large net deletion (-3763), good cleanup of dead OAuth code |

## Findings

### Red: All existing test coverage deleted with no replacements

The PR deletes `claude-code.spec.ts` (597 lines), `claude-code-caching.spec.ts` (169 lines), `streaming-client.spec.ts` (585 lines), and `oauth.spec.ts` (235 lines) -- a total of 1,586 lines of test code. The new `run.ts` CLI subprocess runner (270 lines) and rewritten `claude-code.ts` handler (170 lines) have zero test coverage. This is a significant regression in test coverage for a critical provider.

### Yellow: Image support disabled for all Claude Code models

The new model definitions set `supportsImages: false` with the comment "Claude Code CLI doesn't support images". However, the Claude CLI does support images through conversation mode. If this limitation is from the subprocess approach specifically, it should be documented. The previous implementation supported images.

### Yellow: `supportsPromptCache: false` on all models

The previous implementation had `supportsPromptCache: true`. Disabling this across all models removes a performance optimization. If the CLI approach cannot support prompt caching, this should be explicitly called out as a known regression.

### Yellow: Capability regression -- reasoning effort removed

The previous models had `supportsReasoningEffort: ["disable", "low", "medium", "high"]` and `reasoningEffort: "medium"`. The new model definitions drop these capabilities entirely, but `getReasoningEffort()` is still called in `createMessage()`. The handler still references `claudeCodeReasoningConfig` but the model info no longer declares support.

### Yellow: Security consideration -- CLI path injection

The `claudeCodePath` option allows specifying an arbitrary path to the claude CLI executable. If this is stored in user-accessible settings, a compromised settings file could point to a malicious executable. Consider validating the path or restricting to known CLI locations.

### Gray: Model ID proliferation

The model list expanded from 3 IDs to 16 IDs to cover short aliases (`sonnet`, `opus`, `haiku`), intermediate forms (`claude-sonnet-4-5`), and dated forms (`claude-sonnet-4-5-20250929`). The old `normalizeClaudeCodeModelId()` function handled this mapping. The new approach duplicates model info across all variants. Consider a normalization approach to reduce duplication.

### Gray: Missing `filterMessagesForClaudeCode` implementation

The `claude-code.ts` imports `filterMessagesForClaudeCode` from `../../integrations/claude-code/message-filter` but this file is not in the diff. If it is a new file, it should be included. If existing, the import path may need verification.

## CI Status

| Check | Result |
|-------|--------|
| compile | pass |
| test-extension (ubuntu) | pass |
| test-extension (windows) | pass |
| test-webview (ubuntu) | pass |
| test-webview (windows) | pass |
| test-cli | pass |
| check-translations | pass |
| build-cli | pass |

## Code Snippets

New CLI subprocess approach in `src/api/providers/claude-code.ts`:
```typescript
async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
    const filteredMessages = filterMessagesForClaudeCode(messages)
    const claudeProcess = runClaudeCode({
        systemPrompt,
        messages: filteredMessages,
        path: this.options.claudeCodePath,
        modelId: model.id,
        thinkingBudgetTokens,
    })
    // Process stdout chunks from CLI subprocess
}
```

Model ID change from 3 entries to 16 entries with shared base:
```typescript
const claudeCodeModelBase = {
    maxTokens: 32768,
    contextWindow: 200_000,
    supportsImages: false,
    supportsPromptCache: false,
}
```

## Verdict

**COMMENT** -- This PR solves a real problem (Anthropic restricting OAuth credentials to CLI-only) with a pragmatic approach that matches Cline's implementation. The deletion of the OAuth/streaming infrastructure is correct. However, the complete elimination of test coverage for this provider is concerning -- the new CLI subprocess code path has zero tests. The capability regressions (images, prompt caching, reasoning effort declarations) should be explicitly documented. Adding tests for `run.ts` and the rewritten handler before merge would significantly reduce risk.

---

Review conducted per [Kilo Code PR Review Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md).
