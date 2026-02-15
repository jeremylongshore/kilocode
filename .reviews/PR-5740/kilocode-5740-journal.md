<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5740
title: "fix: node.js detection issue in Intellij post fresh plugin installation"
author: muddlebee
category: fix
tier: 4
lines: 496
files: 4
review_number: 32
fork_pr: N/A (batch review)
-->

# Review Journal: kilocode #5740

> **PR**: [#5740](https://github.com/Kilo-Org/kilocode/pull/5740) |
> **Title**: fix: node.js detection issue in Intellij post fresh plugin installation |
> **Author**: @muddlebee |
> **Category**: fix | **Tier**: 4 | **Size**: 496 lines, 4 files

---

## Summary

Extracts Node.js executable detection into a shared `NodeExecutableFinder` utility for the JetBrains plugin. Replaces duplicated inline detection logic in `ExtensionProcessManager` and `RooToolWindowFactory` with a comprehensive 5-level fallback chain: bundled Node, IntelliJ PATH, environment overrides, PATH scan, and common install locations (nvm/fnm/asdf/volta). Clean Kotlin, testable design with dependency injection, 6 unit tests.

## First Impressions

Issue #2650 reports Node.js not being detected after fresh IntelliJ plugin installation. The root cause: the original detection only checked bundled Node and system PATH. Users with Node installed via nvm, fnm, volta, or other version managers would see "Node.js not found" because those managers don't always add to the system PATH that IntelliJ sees.

The fix is comprehensive — almost too comprehensive at 267 lines for the finder alone. But Node.js detection across operating systems and installation methods is genuinely complex. The fallback chain is well-ordered (most specific → most general) and the dependency injection makes it testable.

## What I Looked At

- `jetbrains/plugin/src/main/kotlin/ai/kilocode/jetbrains/util/NodeExecutableFinder.kt` — New shared utility (267 lines)
- `jetbrains/plugin/src/main/kotlin/ai/kilocode/jetbrains/core/ExtensionProcessManager.kt` — Refactored to use finder
- `jetbrains/plugin/src/main/kotlin/ai/kilocode/jetbrains/ui/RooToolWindowFactory.kt` — Refactored to use finder, DRY'd duplicated code
- `jetbrains/plugin/src/test/kotlin/ai/kilocode/jetbrains/util/NodeExecutableFinderTest.kt` — 6 unit tests
- Issue #2650 (Node.js detection)
- Upstream CI (no checks on branch)

## Analysis

### The Fallback Chain

```
1. Bundled Node.js (plugin resources)
   └─ .bin/node, node/bin/node
2. IntelliJ PATH lookup
   └─ PathEnvironmentVariableUtil.findExecutableInPathOnAnyOS
3. Explicit environment overrides
   └─ KILOCODE_NODE_PATH, KILOCODE_NODE, NODE_BINARY, NODE_EXECUTABLE
4. PATH directory scan
   └─ Manual split of PATH, check each directory
5. Common install locations
   ├─ nvm:   ~/.nvm/versions/node/v*/bin/node (sorted by version, newest first)
   ├─ fnm:   ~/.fnm/node-versions/*/installation/bin/node
   ├─ volta:  ~/.volta/bin/node
   ├─ asdf:  ~/.asdf/shims/node
   ├─ Homebrew: /opt/homebrew/bin/node (macOS)
   ├─ snap:  /snap/bin/node (Linux)
   └─ System: /usr/local/bin/node, /usr/bin/node
```

### Testable Design

The key design decision is making everything injectable:

```kotlin
fun findNodeExecutable(
    bundledNodeModulesDir: String?,
    osInfo: OsInfo = OsInfo.current(),         // injectable OS detection
    envVars: Map<String, String> = System.getenv(),  // injectable env
    pathLookup: (String) -> String? = { ... }  // injectable PATH lookup
): String?
```

This means tests don't need real filesystems or PATH manipulation. Each test creates temp directories, passes controlled parameters, and verifies the correct candidate is selected.

### DRY Improvement in RooToolWindowFactory

The Node version detection code was duplicated in `getDebugTooltipContent()` and `getDebugNotificationContent()`. Both called the same inline logic:

```kotlin
// BEFORE: 16 lines of inline Node detection, duplicated in 2 methods
val nodePath = PluginResourceUtil.getResourcePath(...)?.let { ... }
    ?: PathEnvironmentVariableUtil.findExecutableInPathOnAnyOS("node")?.absolutePath

// AFTER: 1-line call to shared method
val nodeVersion = resolveNodeVersionText()
```

### Versioned Directory Sorting

For nvm and fnm, the finder sorts version directories by semantic version descending:

```kotlin
val versions = versionRoot.listFiles { file -> file.isDirectory }
    ?.sortedWith(compareByDescending<File> { parseSemanticVersion(it.name) }
        .thenByDescending { it.name })
```

This ensures the newest Node version is preferred, which is what users expect.

## Verification

### Upstream CI
No CI checks reported on the `jetbrains-node-path` branch. The JetBrains test suite wasn't triggered upstream.

### Local Testing
Pending — fork mirror needed. JetBrains tests require special test infrastructure (IntelliJ test framework).

## Bot Review Synthesis

| Bot | Status | Key Finding | Useful? |
|-----|--------|-------------|---------|
| CodeRabbit | Not collected | Batch review — no individual fork PR | N/A |
| Gemini | Not collected | Batch review — no individual fork PR | N/A |
| Greptile | Not collected | Batch review — no individual fork PR | N/A |
| CodeQL | Not collected | Batch review — no individual fork PR | N/A |
| Qodo | Not collected | Batch review — no individual fork PR | N/A |

## Lessons Learned

1. **Dependency injection enables testability for system-level code** — Node.js detection depends on OS, filesystem, environment variables, and PATH. Making all of these injectable via parameters turns a hard-to-test system utility into a pure function with predictable behavior.
2. **Version managers complicate PATH** — Users install Node via nvm/fnm/volta/asdf, which use shims and don't always add to the system PATH that IDE plugins see. Supporting these explicitly is the right approach — checking 5+ locations is the cost of cross-platform compatibility.
3. **DRY refactors pay compound dividends** — The duplicated Node detection in RooToolWindowFactory would have needed updating in 2 places for any future change. Extracting to a shared utility with a single call site prevents this.

---

<sub>Review #32 | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
