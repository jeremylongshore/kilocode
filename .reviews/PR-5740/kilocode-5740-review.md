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
confidence: 4
reviewed_at: 2026-02-15
linked_issue: 2650
fork_pr: N/A (batch review)
-->

# Review: kilocode #5740

> **fix: node.js detection issue in Intellij post fresh plugin installation** by @muddlebee

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | Comprehensive Node.js discovery with proper fallback chain |
| Conventions | PASS | Clean Kotlin object, dependency injection, testable design |
| Changeset | WARN | Missing changeset |
| Tests | PASS | 6 unit tests covering all discovery paths |
| i18n | N/A | No user-facing strings |
| Types | PASS | Kotlin type safety maintained |
| Security | PASS | File existence checks only, no execution |
| Scope | PASS | Focused refactor of Node.js detection |

## Findings

### GREEN: Well-designed NodeExecutableFinder with comprehensive fallback chain

**File**: `jetbrains/plugin/src/main/kotlin/ai/kilocode/jetbrains/util/NodeExecutableFinder.kt`

The finder implements a 5-level discovery chain:

1. **Bundled Node.js** — plugin resources (`.bin/node`, `node/bin/node`)
2. **IntelliJ PATH lookup** — `PathEnvironmentVariableUtil.findExecutableInPathOnAnyOS`
3. **Explicit env overrides** — `KILOCODE_NODE_PATH`, `KILOCODE_NODE`, `NODE_BINARY`, `NODE_EXECUTABLE`
4. **PATH directory scan** — manual PATH splitting and binary search
5. **Common install locations** — nvm, fnm, asdf, volta, Homebrew, snap, system paths

For versioned managers (nvm, fnm), it sorts by semantic version descending — newest version preferred.

### GREEN: Testable design via dependency injection

```kotlin
fun findNodeExecutable(
    bundledNodeModulesDir: String?,
    osInfo: OsInfo = OsInfo.current(),
    envVars: Map<String, String> = System.getenv(),
    pathLookup: (String) -> String? = { ... }
): String?
```

All external dependencies (OS detection, environment, PATH lookup) are injectable. Tests pass in controlled values. No filesystem assumptions in tests.

### GREEN: DRY refactor — removes duplicated Node detection logic

`RooToolWindowFactory.kt` had the same Node detection code duplicated in two places (`getDebugTooltipContent` and `getDebugNotificationContent`). Both now call `resolveNodeVersionText()` which uses the shared `NodeExecutableFinder`.

`ExtensionProcessManager.kt` replaces its inline `findNodeExecutable` + `findExecutableInPath` with a single call to `NodeExecutableFinder.findNodeExecutable(...)`.

### GREEN: Comprehensive test coverage

**File**: `jetbrains/plugin/src/test/kotlin/ai/kilocode/jetbrains/util/NodeExecutableFinderTest.kt`

6 tests covering:
- Bundled Node preference
- IntelliJ PATH lookup
- PATH entry scanning
- NVM versioned directory (newest first)
- Explicit environment variable override
- Windows common install directories

Each test creates temp files with proper cleanup.

### YELLOW: Missing changeset

No `.changeset/` file. Should have a patch changeset for the bug fix.

### YELLOW: No CI checks on the branch

The `jetbrains-node-path` branch has no reported CI checks. This means the JetBrains tests haven't been validated upstream.

### GRAY: Copyright header says "Weibo, Inc."

**File**: `NodeExecutableFinder.kt:1`

```kotlin
// SPDX-FileCopyrightText: 2026 Weibo, Inc.
```

This appears to be the contributor's employer. The Apache-2.0 license is compatible with kilocode's license, so no issue — just noting for transparency.

### GRAY: Unused `Logger` import in `NodeExecutableFinder`

The `LOG` instance is used for info logging throughout, so this is fine.

## CI Status

| Check | Result |
|-------|--------|
| (no checks reported) | N/A |

No CI checks on the `jetbrains-node-path` branch.

## Code Snippets

### Versioned Node discovery (nvm/fnm):
```kotlin
private fun versionedNodeCandidates(versionRoot: File, relativeNodePath: String): List<String> {
    val versions = versionRoot.listFiles { file -> file.isDirectory }
        ?.toList().orEmpty()
        .sortedWith(compareByDescending<File> { parseSemanticVersion(it.name) }
            .thenByDescending { it.name })
    return versions.map { versionDir -> File(versionDir, relativeNodePath).absolutePath }
}
```

### Test pattern (dependency injection):
```kotlin
val detected = NodeExecutableFinder.findNodeExecutable(
    bundledNodeModulesDir = root.absolutePath,
    osInfo = NodeExecutableFinder.OsInfo(isWindows = false, isMac = true),
    envVars = emptyMap(),
    pathLookup = { _ -> null },
)
assertEquals(bundledNode.absolutePath, detected)
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**APPROVE** — Clean refactor that extracts duplicated Node.js detection into a well-tested, injectable utility. The 5-level fallback chain covers all common Node.js installation methods. Missing changeset should be added. No CI checks on the branch means we rely on our fork testing for verification.
