<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5646
title: "feat(claude-code): Replace OAuth with CLI subprocess integration"
author: Drilmo
category: feature
tier: 6
lines: 4382
files: 23
verdict: REQUEST_CHANGES
confidence: high
reviewed_at: 2026-02-14T12:00:00Z
-->

# Review: kilocode #5646

> **feat(claude-code): Replace OAuth with CLI subprocess integration** by @Drilmo

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | CRITICAL | Security: temp file race condition, missing subprocess input validation |
| Conventions | PASS | Clean architectural simplification |
| Changeset | PASS | Well-documented in changeset file |
| Tests | FAIL | All tests deleted, no new tests added for CLI subprocess |
| i18n | PASS | Error messages use plain English |
| Types | PASS | TypeScript types properly defined |
| Security | CRITICAL | Multiple security concerns with subprocess execution |
| Scope | PASS | Large but coherent: OAuth → CLI migration |

## Findings

### CRITICAL: Security - Temp File Race Condition

**File**: `src/integrations/claude-code/run.ts:3277-3279`

```typescript
if (os.platform() === "win32" || isSystemPromptTooLong) {
    await fs.writeFile(tempFilePath, options.systemPrompt, { encoding: "utf8", mode: 0o600, flag: "wx" })
    options.systemPrompt = tempFilePath
```

**Problem**: While `flag: "wx"` prevents TOCTOU attacks, the temp file path is predictable (`kilocode-system-prompt-${uniqueId}.txt`) and remains on disk until cleanup. If cleanup fails (process crash, kill -9), sensitive system prompts persist in `/tmp`.

**Risk**: System prompts may contain:
- API keys mentioned in context
- Proprietary code patterns
- User instructions with sensitive information

**Recommendation**:
1. Use secure temp directory with proper permissions
2. Ensure cleanup happens even on process crash (register cleanup handler)
3. Consider encrypting temp files
4. Add file shredding on delete for sensitive content

### CRITICAL: Security - Subprocess Input Validation Missing

**File**: `src/integrations/claude-code/run.ts:3429-3445`

```typescript
const executablePath = claudePath?.trim() || "claude"

const args = [
    shouldUseFile ? "--system-prompt-file" : "--system-prompt",
    systemPrompt,
    "--verbose",
    ...
```

**Problem**: No validation of `claudePath` or `systemPrompt` content before subprocess execution.

**Attack Vector**:
1. User sets `claudeCodePath` to malicious executable
2. Attacker-controlled executable receives system prompts
3. Messages passed via stdin contain full conversation history

**Recommendation**:
```typescript
// Validate executable exists and is in safe locations
const executablePath = await validateClaudeCodePath(claudePath?.trim() || "claude")

// Sanitize arguments to prevent injection
const sanitizedArgs = args.map(arg => sanitizeArgument(arg))
```

### CRITICAL: Configuration - Forces XML Tool Protocol

**File**: `packages/types/src/providers/claude-code.ts:128-135`

```typescript
// NOTE: We intentionally do NOT set supportsNativeTools or defaultToolProtocol here.
// Claude Code CLI with --disallowedTools prevents native tool_use blocks,
// so kilocode must use XML tool format for Claude Code provider.
const claudeCodeModelBase = {
    maxTokens: 32768,
    contextWindow: 200_000,
    supportsImages: false, // Claude Code CLI doesn't support images
    supportsPromptCache: false,
```

**Problem**: Forces downgrade from native tools to XML format.

**Impact**:
- **Native tools**: Structured JSON parsing, type safety, better reliability
- **XML tools**: String parsing, brittle, more tokens consumed

**Question**: Why does CLI block native tool_use? This seems like a regression.

**Recommendation**: Document in changeset WHY this downgrade is necessary. If it's a CLI limitation, file issue with Claude Code team.

### HIGH: Configuration - Disabled Images and Prompt Cache

**Lines**: Same as above

**Problem**: Disables key features:
- `supportsImages: false` - vision capabilities lost
- `supportsPromptCache: false` - no caching = slower + more expensive

**Impact**:
- Users lose image analysis capabilities
- Every request re-processes system prompt (no cache)
- Increased latency and cost

**Question**: Are these CLI limitations or intentional?

**Recommendation**:
1. Document in PR description why these are disabled
2. Add TODO comments to re-enable when CLI supports them
3. Consider keeping OAuth as fallback for users who need these features

### HIGH: Testing - All Tests Deleted, None Added

**Deleted Files**:
- `claude-code.spec.ts` (597 lines)
- `claude-code-caching.spec.ts` (169 lines)
- `oauth.spec.ts` (235 lines)
- `streaming-client.spec.ts` (585 lines)

**Total**: 1,586 lines of tests deleted

**Added Tests**: 0

**Problem**: Major architectural change with zero test coverage.

**What Needs Testing**:
1. CLI subprocess execution success/failure paths
2. Temp file creation/cleanup on all platforms
3. Error handling for missing/outdated CLI
4. JSON parsing of CLI output
5. Usage/cost tracking from CLI responses
6. System prompt length limits
7. Windows vs Unix path handling

**Recommendation**: Add comprehensive test suite before merge.

### MEDIUM: Error Handling - Subprocess Exit Codes

**File**: `src/integrations/claude-code/run.ts:3334-3339`

```typescript
const { exitCode } = await cProcess
if (exitCode !== null && exitCode !== 0) {
    const errorOutput = processState.error?.message || processState.stderrLogs?.trim()
    throw new Error(
        `Claude Code process exited with code ${exitCode}.${errorOutput ? ` Error output: ${errorOutput}` : ""}`,
    )
}
```

**Problem**: Generic error handling doesn't distinguish between:
- Exit code 1: Invalid arguments
- Exit code 2: Authentication failure
- Exit code 126: Permission denied
- Exit code 127: Command not found
- Exit code 130: SIGINT (Ctrl+C)

**Recommendation**: Map exit codes to specific error messages for better UX.

### MEDIUM: Performance - No Subprocess Pooling

**File**: `src/integrations/claude-code/run.ts:3272-3395`

**Problem**: Every request spawns new subprocess:
1. Fork overhead (~50-100ms per request)
2. CLI startup time
3. Process cleanup

**Impact**: Adds latency to every request.

**Recommendation**: Consider long-running subprocess with stdin/stdout streaming for multiple requests. Benchmark: single subprocess vs spawn-per-request.

### LOW: Magic Numbers - Hardcoded Constants

**File**: `src/integrations/claude-code/run.ts:3270-3424`

```typescript
export const MAX_SYSTEM_PROMPT_LENGTH = 65536
const CLAUDE_CODE_TIMEOUT = 600000 // 10 minutes
const BUFFER_SIZE = 20_000_000 // 20 MB
const CLAUDE_CODE_MAX_OUTPUT_TOKENS = "32000"
```

**Problem**: Magic numbers hardcoded without configuration options.

**Recommendation**: Expose as provider settings:
```typescript
claudeCodeSchema = {
    claudeCodePath: z.string().optional(),
    maxSystemPromptLength: z.number().default(65536),
    timeout: z.number().default(600000),
    maxOutputTokens: z.string().default("32000"),
}
```

### POSITIVE: Architectural Simplification

**Deleted Code**:
- OAuth flow implementation (638 lines)
- Streaming client (759 lines)
- Rate limit tracking
- Token refresh logic
- HTTP callback server

**Net Deletion**: 3,144 lines

**Benefit**: Simpler codebase, less maintenance burden, delegates auth to CLI.

### POSITIVE: Better Error Messages

**File**: `src/integrations/claude-code/run.ts:3343-3372`

```typescript
if (processState.stderrLogs.includes("unknown option '--system-prompt-file'")) {
    throw new Error(`The Claude Code executable is outdated. Please update it to the latest version.`, {
        cause: err,
    })
}

if (err.message.includes("ENOENT")) {
    throw new Error(
        `Failed to find the Claude Code executable.
Make sure it's installed and available in your PATH or properly set in your provider settings.`,
        { cause: err },
    )
}
```

**Praise**: Clear, actionable error messages with specific remediation steps.

## CI Status

| Check | Result |
|-------|--------|
| TypeScript Compilation | UNKNOWN - needs verification |
| Unit Tests | N/A - all tests deleted |
| Integration Tests | UNKNOWN - needs manual testing |

## Code Snippets

### New CLI Subprocess Integration

```typescript
// src/integrations/claude-code/run.ts
export async function* runClaudeCode(options: ClaudeCodeOptions): AsyncGenerator<ClaudeCodeMessage | string> {
    const uniqueId = crypto.randomUUID()
    const tempFilePath = path.join(os.tmpdir(), `kilocode-system-prompt-${uniqueId}.txt`)

    // Write system prompt to file to avoid ENAMETOOLONG on Windows
    if (os.platform() === "win32" || isSystemPromptTooLong) {
        await fs.writeFile(tempFilePath, options.systemPrompt, { encoding: "utf8", mode: 0o600, flag: "wx" })
        options.systemPrompt = tempFilePath
        options.shouldUseFile = true
    }

    const cProcess = runProcess(options, cwd)
    // Stream JSON output from CLI stdout
    const rl = readline.createInterface({ input: cProcess.stdout })

    for await (const line of rl) {
        const chunk = parseChunk(line, processState)
        if (chunk) yield chunk
    }
}
```

### Disallowed Tools Configuration

```typescript
// Force kilocode to use XML tool format instead of native tool_use
const claudeCodeDisallowedTools = [
    "Task", "Bash", "Glob", "Grep", "LS", "exit_plan_mode",
    "Read", "Edit", "MultiEdit", "Write", "NotebookRead", "NotebookEdit",
    "WebFetch", "TodoRead", "TodoWrite", "WebSearch",
].join(",")
```

### Model ID Compatibility

```typescript
// packages/types/src/providers/claude-code.ts
export const claudeCodeModels = {
    // Short aliases (recommended)
    sonnet: { ...claudeCodeModelBase, description: "Claude Sonnet 4.5 - Balanced performance" },
    opus: { ...claudeCodeModelBase, description: "Claude Opus 4.5 - Most capable" },
    haiku: { ...claudeCodeModelBase, description: "Claude Haiku 4.5 - Fast and efficient" },

    // Intermediate model IDs (backward compatibility)
    "claude-sonnet-4-5": { ...claudeCodeModelBase, ... },
    "claude-opus-4-5": { ...claudeCodeModelBase, ... },

    // Full model IDs with dates
    "claude-sonnet-4-5-20250929": { ...claudeCodeModelBase, ... },
    "claude-opus-4-5-20251101": { ...claudeCodeModelBase, ... },
    // ... etc
}
```

## Verdict

**REQUEST_CHANGES** - High Confidence

This PR represents a significant architectural improvement by replacing complex OAuth flow with simpler CLI subprocess integration. The net deletion of 3,144 lines is commendable.

However, CRITICAL security issues must be addressed before merge:

1. **Temp file security**: Predictable paths, no guaranteed cleanup, potential sensitive data leak
2. **Subprocess validation**: No input validation on executable path or arguments
3. **Zero test coverage**: 1,586 lines of tests deleted, 0 added for new implementation

Additionally, several QUESTIONS need answers:

1. **Why force XML tool protocol?** Native tools are superior - is this a CLI bug or limitation?
2. **Why disable images and prompt cache?** Are these temporary limitations?
3. **Should OAuth remain as fallback?** For users needing images/cache/native tools

### Blocking Issues for Merge

1. Fix temp file security (CRITICAL)
2. Add subprocess input validation (CRITICAL)
3. Add test coverage for CLI integration (HIGH)
4. Document why features are disabled (HIGH)

### Recommendations for Improvement

1. Consider keeping OAuth as fallback for feature-rich mode
2. Add subprocess pooling for performance
3. Expose configuration options for timeouts/limits
4. Map subprocess exit codes to specific errors
5. Benchmark CLI vs OAuth performance

### Testing Checklist (Required)

- [ ] Test on Windows with long system prompts
- [ ] Test on Linux/macOS with file permissions
- [ ] Test with missing/outdated CLI executable
- [ ] Test temp file cleanup on process crash
- [ ] Test subprocess timeout handling
- [ ] Test malformed JSON output parsing
- [ ] Test concurrent requests
- [ ] Integration test with real Claude Code CLI

---

**Effort Level**: This is excellent architectural work but needs security hardening and testing before production.

