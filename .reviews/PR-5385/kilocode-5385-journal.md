<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5385
title: "Jetbrains - SDK Update (v2025.3) / Fix terminal integration"
author: catrielmuller
category: feature
tier: 5
lines: 612
files: 10
review_number: 43
-->

# Review Journal: kilocode #5385

> **PR**: [#5385](https://github.com/Kilo-Org/kilocode/pull/5385) |
> **Title**: Jetbrains - SDK Update (v2025.3) / Fix terminal integration |
> **Author**: @catrielmuller |
> **Category**: feature | **Tier**: 5 | **Size**: 612 lines, 10 files

---

## Summary

SDK 2025.3 migration for the JetBrains plugin. Kotlin bumped to 2.2.0, deprecated APIs replaced, and terminal integration fixed with OSC 133 (FinalTerm) protocol support alongside existing OSC 633 (VS Code) support. The main concern is a ~300-line reflection-based approach for TtyConnector output capture that is inherently fragile across SDK versions.

## First Impressions

Resolves #2846. Author (catrielmuller / Catriel Muller) is an established contributor. The PR bundles two logical changes (SDK upgrade + terminal fix), which is common for SDK migrations where the fix is forced by the upgrade. The kiloconnect bot already reviewed and found no issues.

## What I Looked At

- Full diff: 471+/141- across 10 files
- `build.gradle.kts` for SDK dependency changes
- `gradle.properties.template` for version bounds
- `TerminalInstance.kt` (324+/46-) -- the bulk of changes
- `ShellIntegrationOutputState.kt` (78+/50-) -- OSC protocol handling
- `WeCoderTerminalCustomizer.kt` -- extension terminal detection
- All other touched files for logging cleanup
- kiloconnect review comment
- CI status (all 11 checks pass)

## Analysis

### SDK Migration (Straightforward)

- `create(type, version)` -> `intellijIdea(version)`: Required API change for IntelliJ Platform 2025.3
- `instrumentationTools()` removed: Deprecated, no replacement needed
- Kotlin 2.0.21 -> 2.2.0: Language version bump, compatible
- Dynamic sandbox detection: Good future-proofing against SDK version name changes

### Terminal Output Capture (Main Risk)

SDK 2025.3 changed terminal session initialization to be asynchronous. `createProcess()` is now deprecated and the TtyConnector is not immediately available. The solution:

1. Poll for TtyConnector availability (50 attempts * 100ms = 5s)
2. Use Java reflection to find `myReader` / `myInputStream` fields
3. Replace them with proxy streams for output interception

This works but is:
- **Brittle**: Any field rename in a point release breaks it
- **Silent on failure**: Terminal appears functional but output capture doesn't work
- **Hard to debug**: The scanning approach tries multiple candidate names and type scans

### OSC 133 Support (Clean)

Well-implemented. The `ShellIntegrationOutputState` now handles both protocols by:
- Finding whichever marker (633 or 133) comes first
- Capturing command lines between B and C markers (OSC 133 doesn't have explicit command line markers like OSC 633's E marker)
- Cleaning ANSI escape sequences from captured command lines
- Using `@Volatile` for thread-safe access to shared state

### KILOCODE_EXTENSION_TERMINAL Environment Variable

Smart approach: extension-owned terminals set this marker so `WeCoderTerminalCustomizer` can force VS Code shell integration even when JetBrains integration is detected. This solves the conflict between IDE and extension shell integration for agent terminals.

## Verification

- CI: All 11 checks pass including `test-jetbrains`
- Changeset: Two included (slightly overlapping descriptions)
- No automated tests for the reflection-based output capture
- Backward compatibility: `pluginSinceBuild` changed from 243 to 253 (breaking for 2024.3 users)

## Lessons Learned

1. SDK migrations often force architectural changes (sync -> async terminal init) that require creative solutions (polling + reflection).
2. Reflection-based field access is sometimes the only option for intercepting SDK internals, but should be documented as a maintenance risk.
3. Dual shell integration protocol support (OSC 633 + 133) is necessary for cross-IDE compatibility.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
