<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5771
title: "Add OTLP Telemetry Export"
author: jdbohrman
category: feature
tier: 3
lines: 808
files: 14
verdict: REQUEST_CHANGES
confidence: 4
reviewed_at: 2026-02-14
linked_issue: null
fork_pr: null
-->

# Review: kilocode #5771

> **Add OTLP Telemetry Export** by @jdbohrman
> Adds optional OTLP (OpenTelemetry Protocol) telemetry export alongside PostHog

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | WARN | Global tracer provider registration can conflict with other extensions -- see findings |
| Conventions | PASS | Uses `// kilocode_change` markers, follows existing telemetry client pattern |
| Changeset | FAIL | Missing changeset (4 packages touched: kilo-code, telemetry, types, webview) |
| Tests | FAIL | No tests for `OtlpTelemetryClient.ts` (232 lines of new logic) |
| i18n | WARN | Only `en/settings.json` updated; 22 other locales missing `otelExport` keys |
| Types | PASS | Clean TypeScript, proper Zod schema, well-typed settings |
| Security | WARN | PII flows to user-controlled endpoints; header values stored in cleartext global state |
| Scope | PASS | Focused, opt-in, does not alter existing telemetry behavior |
| Merge | FAIL | PR has merge conflicts (`mergeable: CONFLICTING`) |

## Findings

### RED: Global TracerProvider registration conflicts with other extensions

`OtlpTelemetryClient.ts:88` -- `this.tracerProvider.register()` calls `trace.setGlobalTracerProvider()` under the hood, which registers a **process-global** singleton. If any other VS Code extension (or the VS Code host itself) also uses OpenTelemetry and registers a global provider, one will overwrite the other.

This is a [documented footgun in the OpenTelemetry JS SDK](https://github.com/open-telemetry/opentelemetry-js/issues/2218). The fix is to avoid global registration entirely and use the tracer provider directly:

```typescript
// Instead of:
this.tracerProvider.register()
this.tracer = trace.getTracer("kilocode-extension", this.extensionVersion)

// Use:
this.tracer = this.tracerProvider.getTracer("kilocode-extension", this.extensionVersion)
```

This keeps the provider scoped to the client instance and avoids polluting the global state.

### RED: PII leakage to user-controlled endpoints

The `OtlpTelemetryClient` calls `getEventProperties()` (inherited from `BaseTelemetryClient`) which returns all telemetry properties including:
- `machineId` (ClineProvider.ts:3493)
- `vscodeVersion`, `platform`, `editorName`
- `apiProvider`, `modelId`
- `kilocodeOrganizationId`
- Git repository info (`repositoryUrl`, `repositoryName`, `defaultBranch`)
- Process memory usage

Unlike PostHog which explicitly filters git properties via `isPropertyCapturable()`, the OTLP client **does not override `isPropertyCapturable()`** and inherits the base class's default (allow everything). This means all properties -- including git repository URLs -- are sent to whatever endpoint the user configures.

While this is technically the user's own endpoint, the OTLP client should still:
1. Document what data is exported
2. Consider filtering the same properties PostHog filters (git info, org-specific error details)
3. Or add an event subscription filter like PostHog does (excluding `TASK_MESSAGE`)

### YELLOW: No test coverage for 232-line telemetry client

`OtlpTelemetryClient.ts` adds significant logic:
- Span lifecycle management (`activeSpans` Map)
- Provider reconfiguration with shutdown/recreate
- Attribute sanitization
- Header building
- Integration with the `BaseTelemetryClient` event pipeline

Zero test coverage for any of this. The existing `PostHogTelemetryClient` has extensive tests (400+ lines). The OTLP client should have at minimum:
- `configure()` enable/disable/reconfigure tests
- `capture()` routing TASK_CREATED/COMPLETED/RESTARTED to spans
- `sanitizeAttributes()` edge cases (null, nested objects, arrays)
- `shutdown()` cleaning up active spans
- `updateTelemetryState()` respecting global opt-out

### YELLOW: Active spans leak if task never completes

`OtlpTelemetryClient.ts:50` -- `activeSpans: Map<string, Span>` grows with every `TASK_CREATED` event. If a task is abandoned (user closes VS Code, crashes, etc.) without a `TASK_COMPLETED` event, the span object remains in the map. Over a long session with many abandoned tasks, this becomes a memory leak.

Mitigations:
- Add a max size or TTL to the `activeSpans` map
- End orphaned spans during `configure()` (reconfiguration already shuts down providers, but doesn't clean the map)
- The `shutdown()` method does clean up, but only on extension deactivation

### YELLOW: Header values stored in plaintext global state

`webviewMessageHandler.ts:1981-1985` -- OTLP authentication headers (API keys like `DD-API-KEY`, `x-honeycomb-team`) are stored via `updateGlobalState("otlpExportSettings", validated)`. VS Code global state is stored in a SQLite database on disk with no encryption.

The UI correctly masks header values with `type="password"` in the input field, but the values are persisted in plaintext. Sensitive auth tokens should use VS Code's `SecretStorage` API (`context.secrets.store()`) instead.

### YELLOW: Endpoint URL not validated

The `otlpExportSettingsSchema` accepts any `z.string()` for `tracesEndpoint` and `logsEndpoint`. There's no URL format validation, which means:
- Typos won't be caught until the OTLP exporter silently fails
- Non-HTTP URLs could cause unexpected behavior
- No guidance to users that URLs must include the path (e.g., `/v1/traces`)

Consider `z.string().url().optional()` or at minimum a URL pattern check.

### GRAY: Missing changeset

The changeset bot flagged this. Four packages are modified (`kilo-code`, `@roo-code/telemetry`, `@roo-code/types`, `@roo-code/vscode-webview`). A patch changeset is needed.

### GRAY: Dependency weight

7 new OpenTelemetry packages added to `packages/telemetry/package.json`:
- `@opentelemetry/api` (^1.9.0)
- `@opentelemetry/sdk-trace-base` (^1.25.0)
- `@opentelemetry/sdk-logs` (^0.52.0)
- `@opentelemetry/exporter-trace-otlp-proto` (^0.52.0)
- `@opentelemetry/exporter-logs-otlp-proto` (^0.52.0)
- `@opentelemetry/resources` (^1.25.0)
- `@opentelemetry/semantic-conventions` (^1.25.0)

These transitively pull in `protobufjs`, `@opentelemetry/otlp-transformer`, `@opentelemetry/sdk-metrics`, `@opentelemetry/core`, and `@opentelemetry/otlp-exporter-base`. The pnpm-lock diff is 214 lines of new resolution entries. This is a significant dependency footprint for an opt-in feature.

Worth noting: the project already has `@opentelemetry/api@1.9.0` and some OTel packages (v2.2.0 line) in the lockfile, but this PR pins to older v1.25/0.52 versions. This creates version duplication in the dependency tree (both 1.25.1 and 1.30.1 of `sdk-trace-base` are resolved, for example).

### GRAY: `pnpm-lock.yaml` includes unrelated `@types/node` version drift

The lock diff shows `@types/node@20.17.57` changing to `@types/node@25.0.10` in multiple jest-related entries. This is unrelated churn that suggests the lockfile was regenerated on a different Node.js version.

## CI Status

No CI checks reported on the `custom-otel-exporters` branch. PR has merge conflicts (`mergeable: CONFLICTING`).

## Local Verification

Not performed -- PR has merge conflicts that prevent clean checkout.

## Code Snippets

### Core OTLP client span lifecycle:
```typescript
// OtlpTelemetryClient.ts -- routes task events to OTel spans
case TelemetryEventName.TASK_CREATED:
    if (taskId) {
        this.startSpan("task_lifecycle", taskId, properties)
    }
    break
case TelemetryEventName.TASK_COMPLETED:
    if (taskId) {
        this.endSpan(taskId, properties)
    }
    break
```

### Global provider registration (problematic):
```typescript
// OtlpTelemetryClient.ts:86-89
this.tracerProvider = new BasicTracerProvider({ resource })
this.tracerProvider.addSpanProcessor(new BatchSpanProcessor(traceExporter))
this.tracerProvider.register()  // <-- sets global singleton
this.tracer = trace.getTracer("kilocode-extension", this.extensionVersion)
```

### Settings schema:
```typescript
// global-settings.ts
export const otlpExportSettingsSchema = z.object({
    enabled: z.boolean().optional(),
    tracesEndpoint: z.string().optional(),
    logsEndpoint: z.string().optional(),
    headers: z.array(otlpHeaderSchema).optional(),
    serviceName: z.string().optional(),
})
```

### Module-scoped client holder:
```typescript
// otlpClientHolder.ts -- bridges extension.ts and webviewMessageHandler.ts
let _client: OtlpTelemetryClient | null = null
export function setOtlpClient(client: OtlpTelemetryClient): void { _client = client }
export function getOtlpClient(): OtlpTelemetryClient | null { return _client }
```

## Verdict

**REQUEST_CHANGES** -- The concept is sound and well-implemented structurally -- OTLP export is a legitimate power-user feature that complements the existing telemetry pipeline. The code follows established patterns (`BaseTelemetryClient`, Zod schema, settings UI). However, several issues need to be addressed before merge:

1. **Global tracer registration** will conflict with other OTel-using extensions. Switch to instance-scoped tracer retrieval.
2. **No property filtering** means git repository URLs and other sensitive data flow to user-configured endpoints without the same protections PostHog has.
3. **Zero test coverage** for 232 lines of span lifecycle, reconfiguration, and sanitization logic.
4. **Auth headers in plaintext** global state -- should use VS Code SecretStorage.
5. **Merge conflicts** need resolution.
6. **Missing changeset** for 4 affected packages.
