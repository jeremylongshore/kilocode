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
reviewed_at: 2026-02-14
linked_issue: 2846
fork_pr: N/A (batch review)
-->

# Review: kilocode #5385

> **Jetbrains - SDK Update (v2025.3) / Fix terminal integration** by @catrielmuller
> Resolves #2846 (macOS JetBrains plugin shell issue)

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | WARN | Heavy reflection in TerminalInstance.kt is fragile -- see findings |
| Conventions | PASS | Consistent with existing JetBrains plugin patterns |
| Changeset | PASS | Two patch changesets included (SDK upgrade + terminal fix) |
| Tests | WARN | No new tests for 293 lines of reflection/polling logic or OSC 133 parsing |
| i18n | N/A | No user-facing strings |
| Types | PASS | Proper Kotlin types, clean imports |
| Security | PASS | Reflection is internal only, KILOCODE_EXTENSION_TERMINAL env var is low-risk |
| Scope | WARN | Breaking change: drops support for IDE versions before 2025.3 (sinceBuild 243->253) |

## Findings

### YELLOW: Reflection-based TtyConnector output capture is inherently fragile

`TerminalInstance.kt` adds ~200 lines of reflection code to find and replace internal fields (`myReader`, `myInputStream`, etc.) in the JetBrains SDK's `ProcessTtyConnector` class hierarchy. This involves:

1. Iterating candidate field names (`myReader`, `reader`, `inputReader`, `myInputReader`)
2. Walking the class hierarchy via `superclass`
3. Scanning all fields by type (`InputStream`, `Reader`)
4. Replacing fields with proxied versions using `field.set()`

This approach works today but will silently break if JetBrains renames internal fields, changes access modifiers, or restructures the class hierarchy. The fallback chain (Strategy 1 -> Strategy 2 -> warn) is good, but:

```kotlin
// Strategy 1: Replace the InputStreamReader (myReader)
val readerReplaced = replaceInputStreamReaderField(ttyConnector)

if (readerReplaced) {
    logger.info("TtyConnector output capture configured")
    return
}

// Strategy 2: Try to replace the input stream field
val inputStream = findInputStreamField(ttyConnector)
```

If both strategies fail, the terminal opens but output capture silently does not work -- the user gets a terminal that appears functional but Kilo cannot see its output. Consider adding a more visible warning to the user or a health-check mechanism.

### YELLOW: Polling loop for TtyConnector availability

```kotlin
private fun setupDelayedTtyConnectorAccess() {
    scope.launch {
        var attempts = 0
        val maxAttempts = 50 // 5 seconds total (50 * 100ms)

        while (attempts < maxAttempts) {
            val ttyConnector = terminalWidget?.ttyConnector
            if (ttyConnector != null) { ... }
            attempts++
            delay(100)
        }
        logger.error("TtyConnector not available after $maxAttempts attempts")
    }
}
```

The 5-second polling approach (50 x 100ms) is pragmatic for SDK 2025.3's async terminal startup, but the error message at the end provides no guidance. Users hitting this will see a cryptic error in the IDE log. Suggest including the terminal ID and recommending a restart.

### YELLOW: Breaking change -- minimum IDE version bumped to 2025.3

`gradle.properties.template` changes `pluginSinceBuild` from `243` to `253`, meaning users on IntelliJ 2024.3 (the current stable for many) will no longer be able to install the plugin. This is noted in the SDK migration but should be called out prominently in release notes. The PR description does not mention this compatibility break.

### GRAY: Two changesets for one PR

The PR includes two changeset files:
- `five-snakes-scream.md` -- "Fix Terminal Integration ZSH/Bash"
- `frank-toes-fry.md` -- "Upgrade to SDK 2025.3 / Fix Terminal Integration"

These overlap in scope. A single changeset describing both changes would be cleaner.

### GRAY: `@Suppress("DEPRECATION")` on createProcess

```kotlin
private fun createCustomRunner(): LocalTerminalDirectRunner {
    return object : LocalTerminalDirectRunner(project) {
        @Suppress("DEPRECATION")
        override fun createProcess(options: ShellStartupOptions): PtyProcess {
            val originalProcess = super.createProcess(options)
            return createProxyPtyProcess(originalProcess)
        }
    }
}
```

The `createProcess` override is now annotated with `@Suppress("DEPRECATION")` because SDK 2025.3 has deprecated this method. The delayed TtyConnector access via `setupDelayedTtyConnectorAccess()` handles the new path, but the deprecated override is still present. If `createProcess` is actually called (for non-async paths), both the proxy AND the reflection-based capture would fire, potentially double-reporting output data.

### GRAY: OSC 133 command line ANSI cleanup regex

```kotlin
val cleanCommand = commandLineBuffer
    .replace(Regex("\u001b\\[[0-9;]*[a-zA-Z]"), "") // ANSI CSI
    .replace(Regex("\u001b\\][^\\u0007]*\\u0007"), "") // OSC sequences
    .trim()
```

The regex for cleaning ANSI CSI sequences (`\u001b\[[0-9;]*[a-zA-Z]`) does not handle intermediate bytes (range 0x20-0x2F) that some CSI sequences include. For example, `\u001b[?25h` (show cursor) includes `?` which is not in `[0-9;]`. A more robust pattern would be `\u001b\[[?!>]*[0-9;]*[a-zA-Z]`.

### GRAY: Verbose debug logging left in production code

While the PR commendably reduces log noise (downgrading many `info` to `debug`), it introduces new `[DEBUG]` prefixed messages at the `info` level in `MainThreadTerminalServiceShape.kt`:

```kotlin
logger.info("🚀 [DEBUG] createTerminal called: extHostTerminalId=$extHostTerminalId")
logger.info("🔧 [DEBUG] Terminal config: $config")
```

These should be `logger.debug()` calls, not `info` with a `[DEBUG]` text prefix.

## CI Status

| Check | Result |
|-------|--------|
| Build Docusaurus Site | PASS |
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

All 11 upstream CI checks pass (including test-jetbrains).

## Code Snippets

### SDK migration -- build.gradle.kts:
```kotlin
intellijPlatform {
    // Use intellijIdea() instead of create() for 2025.3+
    // The old create(platformType, platformVersion) API is deprecated
    intellijIdea(properties("platformVersion"))
}
```

### Dynamic sandbox directory resolution:
```kotlin
val sandboxPluginsDir = sandboxDir.listFiles()
    ?.filter { it.isDirectory && it.name.matches(Regex("I[CU]-\\d+\\.\\d+.*")) }
    ?.maxByOrNull { it.name }
    ?.resolve("plugins")
    ?: throw IllegalStateException("Could not find sandbox plugins directory")
```

### OSC 133 (FinalTerm) protocol support:
```kotlin
// Find Shell Integration marker: \u001b]633; (VSCode) or \u001b]133; (FinalTerm/JetBrains)
val vscodeMarkerIndex = output.indexOf("\u001b]633;", currentIndex)
val finaltermMarkerIndex = output.indexOf("\u001b]133;", currentIndex)

// Use whichever marker comes first
val markerIndex = when {
    vscodeMarkerIndex == -1 && finaltermMarkerIndex == -1 -> -1
    vscodeMarkerIndex == -1 -> finaltermMarkerIndex
    finaltermMarkerIndex == -1 -> vscodeMarkerIndex
    else -> minOf(vscodeMarkerIndex, finaltermMarkerIndex)
}
```

### Extension terminal marker for forcing VSCode shell integration:
```kotlin
// createStartupOptions()
val envWithMarker = (config.env?.toMutableMap() ?: mutableMapOf()).apply {
    put("KILOCODE_EXTENSION_TERMINAL", "true")
}

// injectZshScript() -- force VSCode integration for extension-owned terminals
if (jetbrainsZshDir != null || looksLikeJbZsh) {
    if (isExtensionTerminal) {
        // Don't return early - continue with VSCode injection
    } else {
        envs["USER_ZDOTDIR"] = userZdotdir
        return command
    }
}
```

## Local Verification

| Test | Command | Result | Details |
|------|---------|--------|---------|
| TypeScript | `pnpm check-types` | NOT_RUN | Batch review — no individual fork branch |
| Lint | `pnpm lint` | NOT_RUN | Batch review — no individual fork branch |
| Unit Tests | `pnpm test` | NOT_RUN | Batch review — no individual fork branch |

> Static analysis only. No fork branch created for this PR.

## Verdict

**COMMENT** -- This PR tackles a necessary SDK migration (2024.3 to 2025.3) and fixes a real user-facing issue (#2846) where Kilo-owned terminals in ZSH/Bash were not getting proper shell integration. The OSC 133 FinalTerm protocol support and the KILOCODE_EXTENSION_TERMINAL marker approach are both sound.

However, three concerns prevent a clean APPROVE:

1. **Reflection fragility** -- 200+ lines of reflection-based field replacement with no tests is risky for a production plugin. Future SDK updates could silently break output capture.
2. **No tests** -- Neither the reflection/polling logic nor the OSC 133 parsing changes have test coverage. The `ShellIntegrationOutputState` class is testable in isolation.
3. **Silent compatibility break** -- `pluginSinceBuild` jumps from 243 to 253, dropping all users on IntelliJ 2024.3. This should be documented prominently.

The CI passes (including test-jetbrains) and the kiloconnect bot found no issues. The approach is pragmatic given JetBrains SDK constraints, but the risk profile warrants careful monitoring after merge.
