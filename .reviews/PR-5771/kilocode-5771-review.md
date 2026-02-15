<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5771
title: "Add OTLP Telemetry Export"
author: jdbohrman
category: feature
tier: 5
lines: 808
files: 14
verdict: REQUEST_CHANGES
confidence: 4
reviewed_at: 2026-02-15
-->

# Review: kilocode #5771

> **Add OTLP Telemetry Export** by @jdbohrman

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | PASS | OTLP client implementation follows OTel SDK patterns correctly |
| Conventions | PASS | kilocode_change markers on all shared-code changes |
| Changeset | FAIL | No changeset included - changeset-bot flagged this |
| Tests | FAIL | No tests for OtlpTelemetryClient or settings UI |
| i18n | PARTIAL | English strings added; other languages not updated |
| Types | PASS | OtlpExportSettings Zod schema well-defined |
| Security | WARN | Headers stored in global state, not secret storage; endpoint URLs not validated |
| Scope | PASS | Additive feature, opt-in, does not alter existing telemetry |

## Findings

### [red] Missing changeset
The changeset-bot detected no changeset. This PR adds new OpenTelemetry dependencies and a new settings tab - it requires at minimum a patch changeset for `kilo-code` and potentially `@roo-code/telemetry` and `@roo-code/types`.

### [red] No tests for OtlpTelemetryClient
**File**: `packages/telemetry/src/OtlpTelemetryClient.ts`
This 232-line class handles span lifecycle, log emission, attribute sanitization, and provider reconfiguration. None of these behaviors have test coverage. Key areas needing tests:
- `configure()` with valid/invalid settings
- `capture()` routing (TASK_CREATED creates span, TASK_COMPLETED ends span, TASK_RESTARTED restarts)
- `sanitizeAttributes()` type coercion
- `shutdown()` ending all active spans
- `updateTelemetryState()` respecting global opt-out

### [red] No CI checks ran
CI reports "no checks reported on the 'custom-otel-exporters' branch". This means compile, test, and type-check have not been verified. The 7 new OpenTelemetry dependencies and their version compatibility are unverified.

### [yellow] Authentication headers stored in plaintext global state
**File**: `packages/types/src/global-settings.ts`, `webview-ui/src/components/settings/OtelExportSettings.tsx`
OTLP headers (which typically contain authentication tokens like `DD-API-KEY` or `x-honeycomb-team`) are stored in VS Code global state as plain key-value pairs. The settings UI correctly uses `type="password"` for the value input, but the underlying storage is not VS Code's Secret Storage. This is inconsistent with how the extension handles API keys for providers.

### [yellow] Endpoint URLs not validated
**File**: `packages/telemetry/src/OtlpTelemetryClient.ts:80-101`
The traces and logs endpoint URLs are passed directly to the OTLP exporters without validation. A malformed URL would cause the OTel SDK to throw at runtime. The `configure()` method should validate URLs before constructing exporters.

### [yellow] Module-scoped holder pattern for cross-module access
**File**: `src/services/telemetry/otlpClientHolder.ts`
The OTLP client is shared via a module-scoped `_client` variable with `setOtlpClient`/`getOtlpClient`. This pattern works but is a code smell - it creates implicit coupling. A singleton accessor on the TelemetryService would be more discoverable.

### [yellow] OpenTelemetry SDK version pinning uses older 0.52.x track
**File**: `packages/telemetry/package.json`
The SDK logs and exporters use `^0.52.0` while the project already has `@opentelemetry/core@2.2.0` elsewhere. This creates two parallel OTel dependency trees (1.25.x/0.52.x and 2.2.0). The lock file confirms this with duplicate `@opentelemetry/core`, `@opentelemetry/resources`, and `@opentelemetry/sdk-trace-base` versions. This increases bundle size and may cause runtime conflicts with the OpenTelemetry global API singleton.

### [gray] i18n strings only in English
**File**: `webview-ui/src/i18n/locales/en/settings.json`
32 new translation strings added for the OTLP Export settings section, but only in the English locale. The project has 24 languages; the `check-translations` check would likely flag this if CI ran.

## CI Status

| Check | Result |
|-------|--------|
| All checks | NOT RUN |

## Code Snippets

### OTLP client task lifecycle routing
```typescript
// packages/telemetry/src/OtlpTelemetryClient.ts
switch (event.event) {
    case TelemetryEventName.TASK_CREATED:
        if (taskId) this.startSpan("task_lifecycle", taskId, properties)
        break
    case TelemetryEventName.TASK_COMPLETED:
        if (taskId) this.endSpan(taskId, properties)
        break
    case TelemetryEventName.TASK_RESTARTED:
        if (taskId) {
            this.endSpan(taskId, properties)
            this.startSpan("task_lifecycle", taskId, properties)
        }
        break
    default:
        if (taskId) {
            const span = this.activeSpans.get(taskId)
            if (span) span.addEvent(event.event, this.sanitizeAttributes(properties))
        }
        break
}
// All events also emitted as log records
this.emitLogRecord(event.event, properties)
```

### Settings persistence via webview message handler
```typescript
// src/core/webview/webviewMessageHandler.ts
case "otlpExportSettings": {
    const validated = otlpExportSettingsSchema.parse(message.values)
    await updateGlobalState("otlpExportSettings", validated)
    const otlpClient = getOtlpClient()
    if (otlpClient) {
        await otlpClient.configure(validated)
    }
    await provider.postStateToWebview()
    break
}
```

## Verdict

**REQUEST_CHANGES** - The feature concept is sound and the implementation architecture is reasonable (extends BaseTelemetryClient, opt-in, does not modify existing PostHog flow). However, three blocking issues prevent approval:

1. **Missing changeset** - Required for version bumping.
2. **No tests** - A 232-line telemetry client with span lifecycle management needs unit tests.
3. **CI has not run** - Cannot verify compilation, type-checking, or test suite compatibility with the 7 new dependencies.

Additionally, the security model for header storage should be reviewed (consider using VS Code Secret Storage for authentication tokens), and the dual OTel SDK version tree should be resolved to avoid runtime conflicts.

---

*Reviewed by: Jeremy Longshore*
*Review methodology: [Kilo Code Review Process](https://github.com/jeremylongshore/kilocode/blob/main/.reviews/METHODOLOGY.md)*
