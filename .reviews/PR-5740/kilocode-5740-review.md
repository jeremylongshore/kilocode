<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5740
title: "fix: node.js detection issue in Intellij post fresh plugin installation"
author: muddlebee
category: fix
tier: 4
lines: 496
files: 4
verdict: APPROVE
confidence: high
reviewed_at: 2026-02-15
-->

# Review: kilocode #5740

> **fix: node.js detection issue in Intellij post fresh plugin installation** by @muddlebee

[Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Comprehensive Node.js detection with proper priority order |
| Conventions | PASS | JetBrains-specific code, no kilocode_change markers needed |
| Changeset | WARN | Missing changeset (JetBrains plugin may not need one per project conventions) |
| Tests | PASS | 131-line test file covering bundled, PATH, env override, nvm, and Windows scenarios |
| i18n | N/A | No UI strings |
| Types | PASS | Kotlin types are sound |
| Security | PASS | No security concerns; reads only env vars and file paths |
| Scope | PASS | Focused on Node.js detection refactoring for JetBrains |

## Findings

**GREEN - Well-designed priority order (NodeExecutableFinder.kt)**

The finder checks Node.js locations in a sensible priority order:
1. Bundled Node.js under plugin resources (most reliable)
2. IntelliJ PATH lookup via `PathEnvironmentVariableUtil` (IDE-aware)
3. Explicit environment variable overrides (`KILOCODE_NODE_PATH`, `KILOCODE_NODE`, `NODE_BINARY`, `NODE_EXECUTABLE`)
4. Direct PATH directory scan
5. Fallback: nvm, fnm, volta, asdf, Homebrew, common OS paths

This covers the reported issue (#2650) where fnm-installed Node.js was not detected.

**GREEN - Dependency injection enables testability**

The `findNodeExecutable` function accepts `osInfo`, `envVars`, and `pathLookup` as parameters with sensible defaults. This makes the unit tests straightforward: inject fake environment variables, mock the path lookup, and test each detection path independently without filesystem side effects.

**GREEN - Cross-platform support is thorough**

Windows paths include: `ProgramFiles`, `ProgramFiles(x86)`, `LocalAppData`, `NVM_SYMLINK`, `NVM_HOME`, WinGet links. macOS paths include: `/opt/homebrew/bin`, `/usr/local/bin`, `/opt/local/bin`. Linux paths include: `/usr/local/bin`, `/usr/bin`, `/snap/bin`. The `isValidNodeBinary` correctly skips the `canExecute()` check on Windows (where it is unreliable).

**GREEN - nvm/fnm version sorting picks latest**

The `versionedNodeCandidates` function sorts version directories by semantic version descending, ensuring the latest installed Node.js is preferred. The `parseSemanticVersion` handles the `v` prefix correctly.

**GREEN - Code deduplication in RooToolWindowFactory**

The inline Node.js detection code was duplicated in two methods (`createSystemInfoHtml` and `createSystemInfoPlainText`). The PR extracts this into `resolveNodeVersionText()`, eliminating the duplication and using the same `NodeExecutableFinder`.

**YELLOW - Missing changeset**

The changeset-bot reports no changeset. For JetBrains-only changes, project conventions may not require one (since the JetBrains plugin has a separate versioning scheme). Flagging for maintainer judgment.

**GRAY - No CI runs**

CI has not been triggered on this branch (`no checks reported on the 'jetbrains-node-path' branch`). The test-jetbrains job would validate the Kotlin compilation and unit tests.

**GRAY - SPDX header says "Weibo, Inc." (NodeExecutableFinder.kt:1)**

The copyright header says `SPDX-FileCopyrightText: 2026 Weibo, Inc.` which matches other JetBrains files in the project. This appears to be the existing convention for the JetBrains module.

## CI Status

| Check | Result |
|-------|--------|
| All CI checks | NOT RUN - no checks reported on branch |

## Code Snippets

NodeExecutableFinder priority chain:
```kotlin
fun findNodeExecutable(
    bundledNodeModulesDir: String?,
    osInfo: OsInfo = OsInfo.current(),
    envVars: Map<String, String> = System.getenv(),
    pathLookup: (String) -> String? = { binaryName ->
        PathEnvironmentVariableUtil.findExecutableInPathOnAnyOS(binaryName)?.absolutePath
    },
): String? {
    val bundledNode = findBundledNodeExecutable(bundledNodeModulesDir, osInfo)
    if (bundledNode != null) return bundledNode

    val systemPathNode = normalizePath(pathLookup("node"))
    if (isValidNodeBinary(systemPathNode, osInfo)) return systemPathNode

    val explicitEnvNode = findNodeFromExplicitEnv(envVars, osInfo)
    if (explicitEnvNode != null) return explicitEnvNode

    val fallbackCandidates = collectFallbackCandidates(envVars, osInfo)
    return findFirstValidCandidate(fallbackCandidates, osInfo)
}
```

Caller simplification (ExtensionProcessManager):
```kotlin
// Before: 30+ lines of inline detection logic
// After: 6 lines delegating to NodeExecutableFinder
private fun findNodeExecutable(): String? {
    val bundledNodeModulesPath = PluginResourceUtil.getResourcePath(PLUGIN_ID, NODE_MODULES_PATH)
    val nodePath = NodeExecutableFinder.findNodeExecutable(
        bundledNodeModulesDir = bundledNodeModulesPath,
        pathLookup = { binaryName ->
            PathEnvironmentVariableUtil.findExecutableInPathOnAnyOS(binaryName)?.absolutePath
        },
    )
    LOG.info("Detected Node path: $nodePath")
    return nodePath
}
```

## Verdict

**APPROVE** - This is a well-designed refactoring that solves a real user problem (#2650). The `NodeExecutableFinder` consolidates scattered Node.js detection logic into a single, testable, cross-platform utility. The priority order is sensible, the dependency injection pattern enables clean tests, and the fallback paths cover nvm/fnm/volta/asdf for users who install Node.js via version managers. The code is clear and well-structured. CI should be triggered before merge to validate compilation and tests, and a changeset may be needed depending on project conventions. The missing CI is the only concern; the code quality is high.
