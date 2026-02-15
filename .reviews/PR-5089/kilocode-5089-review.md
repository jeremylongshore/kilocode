<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5089
title: "Feat: Workflows now AI executable, updated slash_command tool allows agentic autonomous discovery & execution"
author: James-Cherished
category: feature
tier: 6
lines: 2785
files: 54
verdict: REQUEST_CHANGES
confidence: high
reviewed_at: 2026-02-14
-->

# Review: kilocode #5089

> **Feat: Workflows now AI executable, updated slash_command tool allows agentic autonomous discovery & execution** by @James-Cherished

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | RED | Multiple breaking changes, unrelated infrastructure changes mixed in |
| Conventions | YELLOW | Inconsistent naming (command vs workflow), excessive `kilocode_change` comments |
| Changeset | RED | 6 changesets with conflicting semver (1 minor, 5 patch), scope confusion |
| Tests | GREEN | Comprehensive test coverage for new workflow discovery code |
| i18n | YELLOW | Incomplete translations - only English updated properly |
| Types | GREEN | Type definitions look solid |
| Security | GREEN | No security issues identified |
| Scope | RED | 54 files - combines 3+ distinct PRs worth of changes |

## Findings

### CRITICAL (Must fix before deployment)

**1. Breaking Change: Experiment Rename Without Migration Path**
- **File**: `packages/types/src/experiment.ts`
- **Issue**: Renames `runSlashCommand` → `autoExecuteWorkflow` without backward compatibility
- **Impact**: Existing user settings with `runSlashCommand: true` will silently fail
- **Evidence**:
  ```typescript
  // OLD
  "runSlashCommand",
  // NEW
  "autoExecuteWorkflow",
  ```
- **Fix Required**: Add migration logic in settings loader or keep both keys temporarily

**2. Infrastructure Changes Mixed With Feature Code**
- **File**: `.husky/pre-push`
- **Issue**: Adds memory limits (`NODE_OPTIONS=--max-old-space-size=3072`) and timeouts (300s type check, 600s tests)
- **Why This Matters**: These are unrelated to workflow discovery and should be a separate PR
- **Configuration Risk**:
  - Why 3072MB specifically? No justification provided
  - Timeout values seem arbitrary - what workload was this tested with?
  - What happens when timeout is hit? Build fails silently?
- **Evidence**:
  ```bash
  +export NODE_OPTIONS="--max-old-space-size=3072 --max-semi-space-size=256"
  +timeout 300 $pnpm_cmd run check-types
  +timeout 600 $pnpm_cmd run test
  ```
- **Fix Required**: Split into separate PR with justification

**3. .gitignore Change Unrelated to Feature**
- **File**: `.gitignore`
- **Issue**: Adds `env/` and `venv/` patterns (Python virtual environment directories)
- **Why This Matters**: PR is about TypeScript workflow discovery, not Python tooling
- **Evidence**:
  ```diff
  +# venv
  +env/
  ```
- **Fix Required**: Remove or explain in PR description

**4. Scope Explosion - Multiple Features in One PR**

This PR actually contains at least 3 distinct features based on changesets:

1. **Workflow discovery infrastructure** (6 new files in `src/core/workflow-discovery/`)
2. **Workflow execution tool migration** (replaces command service with workflow service)
3. **UI display bug fixes** (webview rendering issues)
4. **Translation key updates** (all i18n files)
5. **Hook infrastructure changes** (pre-push timeout/memory)

**Why This Is Critical**:
- Impossible to revert one feature without breaking others
- Review complexity makes bugs more likely to slip through
- Merge conflicts with other PRs become catastrophic
- Testing becomes all-or-nothing

**Fix Required**: Split into 3-4 separate PRs:
- PR 1: Core workflow discovery service (new files only)
- PR 2: Migrate RunSlashCommandTool to use workflows
- PR 3: Fix workflow UI display bugs
- PR 4: Infrastructure (husky hooks) - separate discussion needed

### HIGH PRIORITY (Should fix)

**5. Changeset Confusion - Minor vs Patch**
- **Issue**: 6 changesets with inconsistent semver classification
- **Evidence**:
  - `workflow-discovery-feature.md`: **minor** - "Add automatic workflow discovery"
  - All others: **patch** - various fixes and migrations
- **Why This Matters**:
  - Is this a new feature (minor) or a bug fix (patch)?
  - Breaking the experiment rename is actually a MAJOR change
  - Changesets suggest author wasn't sure about scope
- **Fix Required**: Consolidate to 1-2 changesets with correct semver

**6. Inconsistent Terminology: Commands vs Workflows**
- **Issue**: Tool is still called `run_slash_command` but now executes "workflows"
- **Impact**: Confusing for users and maintainers
- **Evidence**:
  ```typescript
  // Tool name
  export default {
    type: "function",
    function: {
      name: "run_slash_command",  // OLD NAME
      description: `Execute a workflow...`,  // NEW CONCEPT
  ```
- **Fix Required**: Decide on terminology and be consistent (probably keep "command" or rename tool)

**7. Incomplete i18n Updates**
- **Issue**: Only English translation fully updated, others use old terminology
- **Evidence** (French example):
  ```json
  "AUTO_EXECUTE_WORKFLOW": {
    "name": "Activer les commandes slash initiées par le modèle",  // Still says "slash commands"
    "description": "Lorsque activé, Kilo Code peut exécuter tes commandes slash..."
  ```
- **English**:
  ```json
  "AUTO_EXECUTE_WORKFLOW": {
    "name": "Enable Kilo workflow access",  // Updated to "workflow"
    "description": "When enabled, Kilo Code can access and execute workflow slash commands..."
  ```
- **Fix Required**: Update all 16 locale files or mark as needing translation

**8. Missing Test Evidence for Integration**
- **Issue**: No evidence that workflow discovery integrates with existing slash command system
- **Tests Present**: Unit tests for scanner, metadata extractor, service
- **Tests Missing**:
  - Integration test showing workflow discovery → tool execution
  - Test showing global vs workspace priority
  - Test showing symlink resolution in production paths
- **Fix Required**: Add integration test or provide manual test evidence

### SUGGESTIONS (Consider improving)

**9. Cache TTL Hardcoded Without Justification**
- **File**: `src/core/workflow-discovery/WorkflowDiscoveryService.ts`
- **Issue**: 5-minute cache TTL seems arbitrary
- **Code**:
  ```typescript
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  ```
- **Question**: How often do workflows change? Should this be configurable?
- **Suggestion**: Make configurable or document why 5 minutes

**10. Excessive "kilocode_change" Comments**
- **Issue**: 73 occurrences of `// kilocode_change` comments throughout
- **Impact**: Code is harder to read, suggests uncertainty about changes
- **Example**:
  ```typescript
  // kilocode_change start
  import { getWorkflowsForEnvironment } from "../workflow-discovery/getWorkflowsForEnvironment"
  import { refreshWorkflowToggles } from "../context/instructions/workflows"
  // kilocode_change end
  ```
- **Suggestion**: Remove these comments - git history tracks changes

**11. Console.log Debugging Left In Production Code**
- **File**: `src/core/tools/RunSlashCommandTool.ts`
- **Evidence**:
  ```typescript
  console.log(`[RunSlashCommandTool.handlePartial] Sending COMPLETE message to webview:`, completeMessage)
  await task.ask("tool", completeMessage, false).catch(() => {})
  console.log(`[RunSlashCommandTool.handlePartial] COMPLETE message sent successfully`)
  ```
- **Suggestion**: Remove debug logs or use proper logging framework

**12. Symlink Resolution Depth Hardcoded**
- **File**: `src/core/workflow-discovery/WorkflowScanner.ts`
- **Code**:
  ```typescript
  const MAX_DEPTH = 5
  ```
- **Question**: Why 5? What happens with deeper symlink chains?
- **Suggestion**: Document reasoning or make configurable

## CI Status

| Check | Result |
|-------|--------|
| Build | Unknown - needs verification |
| Tests | Unknown - needs verification |
| Lint | Unknown - needs verification |
| Type Check | Unknown - may timeout with new 300s limit |

## Code Snippets

### Positive: Well-Structured Workflow Discovery Service

```typescript
// src/core/workflow-discovery/WorkflowDiscoveryService.ts
export class WorkflowDiscoveryService {
  async discoverWorkflows(cwd: string, enabledWorkflows?: Map<string, boolean>): Promise<WorkflowDiscoveryResult> {
    // Check cache first if enabled
    const cacheKey = this.getCacheKey(cwd)
    if (this.config.enableCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!
      if (now - cached.timestamp < this.config.cacheTtlMs) {
        return { workflows, fromCache: true }
      }
    }
    // Scan both global and workspace workflows
    // Clean separation of concerns
  }
}
```

This is well-designed with proper caching and configurable behavior.

### Negative: Breaking Change Without Migration

```typescript
// packages/types/src/experiment.ts
export const experimentIds = [
  // ...
  "imageGeneration",
- "runSlashCommand",        // REMOVED
+ "autoExecuteWorkflow",    // ADDED - breaks existing configs
  "multipleNativeToolCalls",
] as const
```

Users with `{ runSlashCommand: true }` in their config will silently lose this setting.

### Negative: Unrelated Infrastructure Changes

```bash
# .husky/pre-push
+# kilocode_change - optimized pre-push hook with memory limits and timeout
+export NODE_OPTIONS="--max-old-space-size=3072 --max-semi-space-size=256"
+timeout 300 $pnpm_cmd run check-types
```

Why is this in a workflow discovery PR? What problem does this solve?

### Positive: Comprehensive Test Coverage

```typescript
// src/core/workflow-discovery/__tests__/WorkflowMetadataExtractor.spec.ts
describe("extractDescription", () => {
  it("should truncate description to 30 words", () => {
    const longDescription = "one two three four five..." // 31 words
    const result = extractor.extractDescription({ description: longDescription })
    expect(result).toBe("one two...thirty...")
  })

  it("should not truncate description with exactly 30 words", () => {
    const exactDescription = "one two...thirty" // exactly 30 words
    const result = extractor.extractDescription({ description: exactDescription })
    expect(result).toBe(exactDescription)
    expect(result).not.toContain("...")
  })
})
```

Excellent edge case coverage for the 30-word truncation rule.

## Verdict

**REQUEST_CHANGES** - High confidence

### Critical Issues Blocking Merge

1. **Breaking change**: Experiment rename breaks existing user configurations
2. **Scope explosion**: 54 files combining 3-4 distinct PRs worth of changes
3. **Unrelated changes**: Husky hook modifications and .gitignore changes don't belong here
4. **Changeset confusion**: 6 changesets suggesting unclear PR scope

### What This PR Should Be

**Option A: Split into multiple PRs** (Recommended)
1. PR #1: Core workflow discovery service (new files in `workflow-discovery/`)
2. PR #2: Migrate RunSlashCommandTool to use workflow service
3. PR #3: Rename experiment with migration path
4. PR #4: Fix workflow display bugs in webview
5. PR #5 (separate discussion): Husky hook optimization with justification

**Option B: Keep together but fix critical issues**
1. Remove all unrelated changes (.husky, .gitignore)
2. Add migration for experiment rename
3. Consolidate changesets to 1-2 with correct semver
4. Complete i18n translations or mark as pending
5. Add integration tests

### Positive Aspects

- Workflow discovery architecture is well-designed
- Comprehensive unit test coverage for new code
- Clean separation between scanner, metadata extractor, and service
- Proper caching with TTL
- Symlink support is thoughtful (though depth limit should be documented)

### Recommendation

This is quality code architecturally, but the PR structure violates basic engineering hygiene:

1. **Scope**: One PR should do one thing
2. **Changesets**: Should clearly communicate semver impact
3. **Breaking changes**: Require migration paths
4. **Infrastructure**: Needs separate review and justification

**Strong recommendation**: Split into 3-4 focused PRs. Each can be reviewed and merged independently, reducing risk and making rollback possible.

If time pressure requires keeping together: Remove all unrelated changes and add experiment migration logic.

---

**Files Reviewed**: 54 files (+2479/-306 lines)

**Methodology**: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews)

**Review Confidence**: High - comprehensive analysis of architecture, breaking changes, and scope issues
