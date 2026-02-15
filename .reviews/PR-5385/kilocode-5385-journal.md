<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5385
title: "Jetbrains - SDK Update (v2025.3) / Fix terminal integration"
author: catrielmuller
category: feature
tier: 5
lines: 612
files: 10
review_number: 50
fork_pr: N/A (batch review)
-->

# Review Journal: kilocode #5385

> **PR**: [#5385](https://github.com/Kilo-Org/kilocode/pull/5385) |
> **Title**: Jetbrains - SDK Update (v2025.3) / Fix terminal integration |
> **Author**: @catrielmuller |
> **Category**: feature | **Tier**: 5 | **Size**: 612 lines, 10 files

---

## Summary

Upgrades the JetBrains plugin from SDK 2024.3 to 2025.3 and fixes terminal integration for ZSH/Bash shells. The SDK migration required substantial rework of how terminal output is captured (now via reflection + polling instead of process-level proxying), and shell integration now supports OSC 133 (FinalTerm) markers alongside the existing OSC 633 (VSCode) protocol. Approach is pragmatic but carries risk from heavy reflection usage with no tests.

## First Impressions

"SDK Update (v2025.3) / Fix terminal integration" -- immediately signals this is infrastructure work with compatibility implications. The linked issue #2846 describes macOS users unable to find `java`/`node`/`python` because Kilo's terminal runs in a minimal shell environment. The PR author (catrielmuller) is a core JetBrains contributor for the project, which gives confidence in platform-specific knowledge.

At 612 lines across 10 files, this is a substantial change but most of the diff is concentrated in two files: `TerminalInstance.kt` (+324/-46) and `ShellIntegrationOutputState.kt` (+78/-50).

## What I Looked At

- `jetbrains/plugin/build.gradle.kts` -- SDK migration changes
- `jetbrains/plugin/gradle.properties.template` -- Version/compatibility bumps
- `jetbrains/plugin/src/main/kotlin/.../TerminalInstance.kt` -- Core changes (bulk of PR)
- `jetbrains/plugin/src/main/kotlin/.../ShellIntegrationOutputState.kt` -- OSC 133 support
- `jetbrains/plugin/src/main/kotlin/.../WeCoderTerminalCustomizer.kt` -- Extension terminal detection
- `jetbrains/plugin/src/main/kotlin/.../MainThreadTerminalServiceShape.kt` -- Logging changes
- `jetbrains/plugin/src/main/kotlin/.../TerminalShellIntegration.kt` -- Logging cleanup
- `jetbrains/plugin/src/main/kotlin/.../ProxyPtyProcess.kt` -- License header removal
- Linked issue #2846 -- macOS shell environment problem
- kiloconnect bot review (upstream)
- All upstream CI checks (11/11 pass)

## Analysis

### The Problem (Two Intertwined Issues)

**Issue 1: SDK 2025.3 Breaking Changes**

JetBrains SDK 2025.3 introduces several API changes:
- `create(platformType, platformVersion)` is deprecated in favor of `intellijIdea(version)`
- `instrumentationTools()` is removed
- `createProcess()` on `LocalTerminalDirectRunner` is deprecated
- Terminal sessions start asynchronously -- `TtyConnector` is no longer available immediately after `startShellTerminalWidget()`
- The sandbox directory naming scheme changed from `IC-2024.3` to a dynamic pattern

**Issue 2: ZSH/Bash Shell Integration in JetBrains**

JetBrains 2025.3 uses OSC 133 (FinalTerm protocol) for its built-in shell integration instead of OSC 633 (VSCode protocol). Since Kilo relies on OSC 633 markers for command detection, terminals managed by Kilo were losing shell integration. The fix has two parts:
1. Parse both OSC 133 and OSC 633 markers
2. Force VSCode shell integration on extension-owned terminals via `KILOCODE_EXTENSION_TERMINAL` env marker

### The Fix

**Build System (build.gradle.kts)**
- Kotlin 2.0.21 -> 2.2.0
- `create()` -> `intellijIdea()` for platform dependency
- Removed `instrumentationTools()`
- Dynamic sandbox directory detection using regex `I[CU]-\d+\.\d+.*`

**TtyConnector Capture (TerminalInstance.kt -- the big change)**

Since `createProcess()` may not be called in SDK 2025.3, the proxy-based output capture via `ProxyPtyProcess` is no longer sufficient. A new `setupDelayedTtyConnectorAccess()` method polls for the TtyConnector (up to 5 seconds) then uses reflection to replace internal `InputStream`/`Reader` fields with proxied versions.

The reflection walks up the class hierarchy looking for:
```
LocalTerminalTtyConnector
  -> PtyProcessTtyConnector
    -> ProcessTtyConnector  (where myInputStream and myReader live)
```

Two strategies are attempted:
1. Find and replace the `Reader` field (preferred -- this is what TtyConnector reads from)
2. Find and replace the `InputStream` field (fallback)

**OSC 133 Support (ShellIntegrationOutputState.kt)**

The marker parser now searches for both `\u001b]633;` and `\u001b]133;` prefixes, using whichever appears first. For OSC 133 (FinalTerm), command lines are captured by buffering text between B (COMMAND_START) and C (COMMAND_EXECUTED) markers, since FinalTerm doesn't have the explicit E (COMMAND_LINE) marker that VSCode's protocol uses.

**Extension Terminal Detection (WeCoderTerminalCustomizer.kt)**

A new `KILOCODE_EXTENSION_TERMINAL` environment variable marker is set when Kilo creates a terminal. When detected in the customizer, it forces VSCode shell integration injection even when JetBrains' built-in ZSH integration is present. For extension terminals, `USER_ZDOTDIR` is set to the user's home directory (ignoring JetBrains' ZDOTDIR override) to avoid loading JetBrains' shell integration scripts that emit OSC 133 instead of OSC 633.

### Concerns

**Reflection Risk**: The reflection-based field replacement is the biggest risk. JetBrains does not guarantee internal field names as stable API. The code mitigates this with candidate field name lists and type-based scanning, but a future SDK update could break output capture silently.

**Minimum Version Bump**: `pluginSinceBuild` changes from 243 to 253. Users on IntelliJ 2024.3 (still widely used) will lose plugin support. This is not mentioned in the PR description.

**Potential Double Capture**: If `createProcess()` IS still called in some code paths (the override is still present with `@Suppress("DEPRECATION")`), both the `ProxyPtyProcess` AND the reflection-based capture could fire, leading to duplicate output events.

**Missing Tests**: 293 lines of new logic in `TerminalInstance.kt` with no tests. The `ShellIntegrationOutputState` OSC 133 parsing is also untested despite being testable in isolation.

## Verification

### Upstream CI
All 11 checks pass, including `test-jetbrains` (8m18s). This validates compilation and existing test coverage against SDK 2025.3.

### What We Couldn't Verify
- Actual behavior with ZSH/Bash on macOS (requires JetBrains IDE with SDK 2025.3)
- Reflection field replacement against live TtyConnector instances
- OSC 133 marker parsing with real terminal output
- Whether `createProcess()` is still called in any code path (would cause double capture)
- Impact on users who cannot upgrade past IntelliJ 2024.3

## Bot Review Synthesis

| Bot | Verdict | Key Finding | Useful? |
|-----|---------|-------------|---------|
| kiloconnect | MERGE | Reflection fragility noted, no blockers | Yes |
| changeset-bot | INFO | Two changesets detected | Yes |

## Diagrams

```
Terminal Output Capture: Before vs After SDK 2025.3
====================================================

BEFORE (SDK 2024.3):
  LocalTerminalDirectRunner.createProcess()
       |
       v
  ProxyPtyProcess(originalProcess)
       |
       v
  ProxyInputStream wraps process.inputStream
       |
       v
  onRawData() -> sendRawDataToExtHost() + shellIntegration.appendRawOutput()


AFTER (SDK 2025.3):
  Path A (if createProcess still called):
    Same as before (ProxyPtyProcess)

  Path B (async terminal startup):
    startShellTerminalWidget() returns
         |
         v
    setupDelayedTtyConnectorAccess()  <- polls every 100ms, up to 5s
         |
         v
    TtyConnector obtained
         |
         v
    setupTtyConnectorOutputCapture()
         |
         v
    Reflection: find myReader/myInputStream in class hierarchy
         |
         v
    Replace with ProxyInputStream -> InputStreamReader
         |
         v
    onRawData() -> sendRawDataToExtHost() + shellIntegration.appendRawOutput()


OSC Protocol Support:
  OSC 633 (VSCode):  A -> B -> E(cmd) -> C -> [output] -> D(exitcode)
  OSC 133 (FinalTerm): A -> B -> [cmd text] -> C -> [output] -> D(exitcode)
                              ^^^^^^^^^^^^^^^^^
                              Captured via commandLineBuffer
```

## Lessons Learned

1. **JetBrains SDK migrations can break fundamental assumptions** -- The move from synchronous `createProcess()` to async terminal startup invalidated the entire output capture strategy. Plugin authors need to design for this kind of tectonic API shift.

2. **Reflection is a necessary evil for IDE plugins** -- When the SDK doesn't expose what you need via public API, reflection is sometimes the only option. But it should be treated as tech debt with explicit version-pinned tests.

3. **Protocol dual-support is the right pattern** -- Supporting both OSC 633 and OSC 133 ensures compatibility across JetBrains versions and with different shell integration scripts. The "whichever comes first" approach is elegant.

4. **Environment variable markers are a clean coordination mechanism** -- Using `KILOCODE_EXTENSION_TERMINAL=true` to distinguish Kilo-owned terminals from user terminals is simple, debuggable, and doesn't require complex state management.

5. **Log level hygiene matters at scale** -- The PR correctly downgrades dozens of `info` logs to `debug`, but then introduces new `info`-level messages with `[DEBUG]` text prefixes, which is the wrong fix. Use the actual logging framework levels, not text conventions.

---

<sub>Review #50 | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
