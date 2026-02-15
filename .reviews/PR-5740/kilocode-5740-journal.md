<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5740
title: "fix: node.js detection issue in Intellij post fresh plugin installation"
author: muddlebee
category: fix
tier: 4
lines: 496
files: 4
review_number: 35
-->

# Review Journal: kilocode #5740

> **PR**: [#5740](https://github.com/Kilo-Org/kilocode/pull/5740) |
> **Title**: fix: node.js detection issue in Intellij post fresh plugin installation |
> **Author**: @muddlebee |
> **Category**: fix | **Tier**: 4 | **Size**: 496 lines, 4 files

---

## Summary

Introduces `NodeExecutableFinder` utility that consolidates and extends Node.js detection in the JetBrains plugin. Replaces duplicated inline detection logic in `ExtensionProcessManager` and `RooToolWindowFactory` with a single testable utility that supports bundled Node, IntelliJ PATH, env overrides, and version manager fallbacks (nvm, fnm, volta, asdf). Well-designed and well-tested. Verdict: APPROVE.

## First Impressions

The title mentions "fresh plugin install" which suggests the issue is about initial setup when Node.js is installed via non-standard paths (version managers). Issue #2650 confirms: fnm-installed Node.js is invisible to the plugin. The fix is architectural: instead of patching the existing detection, create a comprehensive finder.

## What I Looked At

- Issue #2650: JetBrains plugin cannot find fnm-installed Node.js on macOS
- `ExtensionProcessManager.kt` on main - original `findNodeExecutable()` and `findExecutableInPath()` (30+ lines, checks bundled then system PATH only)
- `RooToolWindowFactory.kt` on main - inline Node.js detection duplicated in two methods
- `PluginResourceUtil.kt` - how bundled resource paths are resolved
- `PluginConstants.kt` - `NODE_MODULES_PATH = "node_modules"`
- New `NodeExecutableFinder.kt` (267 lines) - the core of the PR
- New `NodeExecutableFinderTest.kt` (131 lines) - unit tests

## Analysis

**Before: Two separate detection paths**

`ExtensionProcessManager.findNodeExecutable()` checked bundled Node then fell back to `PathEnvironmentVariableUtil.findExecutableInPathOnAnyOS("node")`. `RooToolWindowFactory` had its own inline version of the same logic duplicated in two places. Neither checked nvm, fnm, volta, or asdf paths.

**After: Single `NodeExecutableFinder` object**

The finder is a Kotlin `object` (singleton) with a clear API: `findNodeExecutable(bundledNodeModulesDir, osInfo, envVars, pathLookup)`. Parameters use default values so callers only pass what they need. The priority chain is:

1. Bundled (plugin resources)
2. IntelliJ PATH (via injected `pathLookup`)
3. Env overrides (KILOCODE_NODE_PATH, etc.)
4. PATH scan + version manager directories
5. OS-specific common paths

The version manager support is the key improvement. The `versionedNodeCandidates` function sorts by semantic version descending, so users with multiple Node.js versions get the latest.

**Test coverage**

Six test cases cover the main detection paths:
1. Bundled node preferred over everything
2. IntelliJ PATH lookup when no bundled
3. PATH entries scan when IntelliJ fails
4. nvm version directory selection (picks latest v20 over v18)
5. Explicit env override (KILOCODE_NODE_PATH)
6. Windows common install directories

Tests create real temp files with executable permissions, which is more reliable than pure mocking.

**Caller simplification**

`ExtensionProcessManager.findNodeExecutable()` goes from 30+ lines to 6 lines. `RooToolWindowFactory` replaces two 15-line inline blocks with calls to `resolveNodeVersionText()`.

## Verification

- CI: Not run on this branch. The test-jetbrains job would validate compilation and tests.
- Changeset: Missing. May not be required for JetBrains-only changes.
- The `findExecutableInPath` method was deleted from ExtensionProcessManager since it is fully replaced by NodeExecutableFinder.

## Lessons Learned

- Dependency injection via default parameters in Kotlin is an effective pattern for testability. The `pathLookup` lambda avoids static method calls in tests.
- When the same logic is duplicated in multiple places, a new utility class is justified even for a "bug fix" PR.
- Version manager support (nvm/fnm/volta/asdf) is important for developer tools. Many developers do not have Node.js in the standard system PATH.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
