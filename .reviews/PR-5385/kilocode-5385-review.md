<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5385
title: "Jetbrains - SDK Update (v2025.3) / Fix terminal integration"
author: catrielmuller
category: feature
tier: 5
lines: 612
files: 10
verdict: COMMENT
confidence: 3
reviewed_at: 2026-02-15
-->

# Review: kilocode #5385

> **Jetbrains - SDK Update (v2025.3) / Fix terminal integration** by @catrielmuller

[Methodology](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | WARN | Reflection-based approach is fragile; polling timeout could silently fail |
| Conventions | PASS | JetBrains directory does not require kilocode_change markers |
| Changeset | PASS | Two changesets included (SDK upgrade + terminal fix) |
| Tests | N/A | JetBrains plugin tests pass in CI; no new unit tests for reflection logic |
| i18n | N/A | No user-facing strings changed |
| Types | PASS | Kotlin types correct |
| Security | PASS | No security concerns |
| Scope | WARN | Dual changesets suggest this should be two PRs |

## Findings

### YELLOW - Reflection-based TtyConnector access is inherently fragile

The `setupTtyConnectorOutputCapture` method in `TerminalInstance.kt` uses Java reflection to find and replace private fields (`myReader`, `myInputStream`, etc.) by:
1. Iterating candidate field names
2. Walking the class hierarchy
3. Scanning all declared fields by type

This will break silently on any SDK update that renames, removes, or restructures these internal fields. The fallback path (`Strategy 2: Try to replace the input stream field`) means partial capture might occur where the stream is proxied but the reader is not (or vice versa), leading to data inconsistencies.

```kotlin
// TerminalInstance.kt - field scanning by name guessing
val candidateFieldNames = listOf(
    "myReader", "reader", "inputReader", "myInputReader"
)
var searchClass: Class<*>? = ttyConnector.javaClass
while (searchClass != null && searchClass != Object::class.java) {
    for (fieldName in candidateFieldNames) {
        // ... reflection access
    }
}
```

**Recommendation**: Add a log warning when neither strategy succeeds (already done), but also consider adding a version check that logs when running on an untested SDK version so maintainers can investigate proactively.

### YELLOW - Polling timeout for TtyConnector (5 seconds) has no user notification

The `setupDelayedTtyConnectorAccess` polls up to 50 times with 100ms delays (5 seconds total). If the connector never becomes available, the only indication is a logger.error line. The terminal will appear to work (commands can be sent) but output capture will silently not function. Consider:
- Showing a subtle notification to the user
- Increasing the timeout for slower machines
- Making the timeout configurable

```kotlin
// TerminalInstance.kt
logger.error("TtyConnector not available after $maxAttempts attempts - output capture will not work")
// User sees a functional terminal but Kilo Code cannot capture output
```

### YELLOW - Two changesets for one PR

Two changesets are included:
- `five-snakes-scream.md`: "Jetbrains - Fix Terminal Integration ZSH/Bash"
- `frank-toes-fry.md`: "Jetbrains - Upgrade to SDK 2025.3 / Fix Terminal Integration"

These describe overlapping changes and both produce a `patch` bump for `kilo-code`. While not technically wrong, the overlapping descriptions suggest the PR bundles two logically distinct changes. If the SDK upgrade introduces a regression, it cannot be reverted independently of the terminal fix.

### YELLOW - Breaking backward compatibility

The `pluginSinceBuild` changes from `243` to `253`, meaning users on IntelliJ 2024.3 can no longer install the plugin. The PR description does not mention this backward-compatibility break. Is this intentional? If users on older IDEs should still be supported, the `pluginSinceBuild` should remain at `243` with conditional code paths.

### GRAY - Excessive debug logging left in place

While the PR reduces verbose logging overall (good), many `[DEBUG]` prefixed messages remain in `MainThreadTerminalServiceShape.kt`:

```kotlin
logger.info("Creating terminal: extHostTerminalId=$extHostTerminalId")
logger.info("[DEBUG] Terminal config: $config")
logger.debug("[DEBUG] Getting RPC protocol instance...")
```

The `[DEBUG]` prefix is redundant when using `logger.debug()` -- the logging framework already tracks the level. And some messages use `logger.info()` with `[DEBUG]` prefix, which means they will appear in production logs.

### GRAY - OSC 133 (FinalTerm) protocol support

Good addition. The `ShellIntegrationOutputState.kt` now handles both OSC 633 (VS Code) and OSC 133 (FinalTerm/JetBrains) shell integration protocols. The command-line capture between B and C markers is correctly implemented with ANSI escape cleanup. The `@Volatile` annotations on shared state are appropriate for the concurrent access pattern.

### GRAY - `@Suppress("DEPRECATION")` on createProcess

The `createProcess` override adds `@Suppress("DEPRECATION")`. In SDK 2025.3, this method is deprecated, which is why the delayed TtyConnector polling was added. This is the correct approach for now but should have a comment explaining that this is a temporary bridge until the new API stabilizes.

## CI Status

| Check | Result |
|-------|--------|
| compile | PASS |
| test-extension (ubuntu) | PASS |
| test-extension (windows) | PASS |
| test-jetbrains | PASS |
| test-webview (ubuntu) | PASS |
| test-webview (windows) | PASS |
| test-cli | PASS |
| build-cli | PASS |
| check-translations | PASS |
| Build Docusaurus Site | PASS |

All CI checks pass.

## Code Snippets

SDK migration in build.gradle.kts:
```kotlin
// Before
create(properties("platformType"), properties("platformVersion"))
instrumentationTools()

// After
intellijIdea(properties("platformVersion"))
// instrumentationTools() removed - deprecated in 2025.3
```

Dynamic sandbox directory:
```kotlin
val sandboxPluginsDir = sandboxDir.listFiles()
    ?.filter { it.isDirectory && it.name.matches(Regex("I[CU]-\\d+\\.\\d+.*")) }
    ?.maxByOrNull { it.name }
    ?.resolve("plugins")
    ?: throw IllegalStateException("Could not find sandbox plugins directory")
```

## Verdict

**COMMENT** -- This is a substantial and necessary SDK migration. The code is well-structured, CI passes, and the OSC 133 protocol support is a genuine improvement. However, the reflection-based approach for TtyConnector output capture is the PR's main risk. It works today but is fragile by nature. Questions for the author:

1. Is the IntelliJ 2024.3 backward-compatibility break (pluginSinceBuild 243 -> 253) intentional?
2. Has the reflection approach been tested with different JetBrains IDE versions (Community vs Ultimate, different 2025.3 point releases)?
3. Should the `[DEBUG]` prefix on `logger.info()` calls be cleaned up before merge?

If the backward-compatibility break is intentional and the reflection approach has been validated, this is close to mergeable.
