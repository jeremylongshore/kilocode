<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5771
title: "Add OTLP Telemetry Export"
author: jdbohrman
category: feature
tier: 3
lines: 808
files: 14
review_number: 53
-->

# Review Journal: kilocode #5771

> **PR**: [#5771](https://github.com/Kilo-Org/kilocode/pull/5771) |
> **Title**: Add OTLP Telemetry Export |
> **Author**: @jdbohrman |
> **Category**: feature | **Tier**: 3 | **Size**: 808 lines, 14 files

---

## Summary

Adds opt-in OTLP telemetry export so users can send Kilo Code telemetry to any OpenTelemetry-compatible backend (Datadog, Honeycomb, Grafana Cloud, Jaeger). Runs alongside PostHog. Well-structured implementation following existing patterns, but has a global tracer registration conflict, missing PII filtering, no tests, plaintext auth storage, and merge conflicts. Verdict: REQUEST_CHANGES.

## First Impressions

The PR title and description are clear. OTLP export is a reasonable power-user feature for teams that want observability in their own stack. The description is thorough -- explains the three-layer implementation (client, wiring, UI), provides testing instructions with a Docker command for local Jaeger. The 808-line size across 14 files is medium-large, with ~214 lines being pnpm-lock churn.

Telemetry PRs warrant special scrutiny for: PII leakage, opt-in/opt-out correctness, configuration security, and dependency weight. This PR touches all of those.

## What I Looked At

**Core files examined:**
- `packages/telemetry/src/OtlpTelemetryClient.ts` -- New 232-line OTLP client (full diff)
- `packages/telemetry/src/BaseTelemetryClient.ts` -- Base class to understand inheritance
- `packages/telemetry/src/PostHogTelemetryClient.ts` -- Existing client for pattern comparison
- `packages/telemetry/src/TelemetryService.ts` -- Service registration
- `packages/telemetry/src/DebugTelemetryClient.ts` -- Another client for comparison
- `packages/types/src/global-settings.ts` -- Schema definitions, GlobalState derivation
- `packages/types/src/vscode-extension-host.ts` -- ExtensionState and WebviewMessage types
- `src/extension.ts` -- Activation wiring
- `src/services/telemetry/otlpClientHolder.ts` -- Module-scoped holder pattern
- `src/core/webview/webviewMessageHandler.ts` -- Settings save handler
- `src/core/webview/ClineProvider.ts` -- State propagation + getTelemetryProperties
- `src/core/config/ContextProxy.ts` -- GlobalState key typing chain
- `webview-ui/src/components/settings/OtelExportSettings.tsx` -- Settings UI
- `webview-ui/src/components/settings/SettingsView.tsx` -- Tab integration
- `webview-ui/src/context/ExtensionStateContext.tsx` -- State context
- `webview-ui/src/i18n/locales/en/settings.json` -- i18n strings

**Context gathered:**
- Verified GlobalState type derivation chain: `globalSettingsSchema` -> `GLOBAL_SETTINGS_KEYS` -> `GLOBAL_STATE_KEYS` -> `GlobalState` (the `otlpExportSettings` field flows correctly through the type system since it's added to the schema)
- Confirmed `ghostServiceSettings` import conflict (main has `autocompleteServiceSettingsSchema`, PR references `ghostServiceSettingsSchema`)
- Verified PostHog filters git properties (`repositoryUrl`, `repositoryName`, `defaultBranch`) via `isPropertyCapturable()` -- OTLP client does not
- Confirmed `getTelemetryProperties()` returns `machineId`, git info, memory usage, org IDs
- Checked OpenTelemetry `register()` global singleton behavior via SDK documentation and issue tracker

## Analysis

### Architecture

The PR follows the established telemetry architecture well:

```
TelemetryService (singleton)
  |-- PostHogTelemetryClient (existing)
  |-- DebugTelemetryClient (existing, dev only)
  |-- OtlpTelemetryClient (new, this PR)
```

All clients receive every event via `TelemetryService.captureEvent()` -> `client.capture()`. Each client filters/transforms independently.

The OTLP client adds an interesting layer: task lifecycle events (`TASK_CREATED`, `TASK_COMPLETED`, `TASK_RESTARTED`) are modeled as OpenTelemetry trace spans with a parent span per task, while all events are additionally emitted as OTLP log records. This is a sensible mapping.

### The global registration problem

`BasicTracerProvider.register()` calls `trace.setGlobalTracerProvider(this)` internally. The `@opentelemetry/api` package uses a global singleton pattern. VS Code extensions share a Node.js process (the extension host), so calling `register()` will overwrite any global provider set by another extension. This is not hypothetical -- several VS Code extensions and VS Code itself use OTel.

The fix is simple: use `this.tracerProvider.getTracer()` instead of `trace.getTracer()`. The tracer provider instance has its own `getTracer()` that doesn't require global registration.

### PII analysis

The OTLP client inherits `getEventProperties()` from `BaseTelemetryClient`, which merges:
1. Provider properties (`getTelemetryProperties()` from ClineProvider) -- includes machineId, git URLs, memory, org ID
2. Event-specific properties (taskId, tool name, etc.)

PostHog explicitly blocks `repositoryUrl`, `repositoryName`, `defaultBranch` and org-specific error details. The OTLP client sends everything.

Since the user configures the endpoint, they're implicitly consenting to data export. But:
- Users may not realize git repo URLs are included
- In a team setting with shared OTLP infrastructure, this could expose repos one team member shouldn't see
- The UI description doesn't mention what data is exported

### Settings UI quality

The `OtelExportSettings.tsx` component is well-built:
- Correct conditional rendering (fields hidden when disabled)
- Header values masked with `type="password"`
- Add/remove header rows with proper key management
- i18n strings for all labels/descriptions

One design choice: the save happens on the entire settings form save (not field-by-field), and reconfiguration is immediate via `otlpClient.configure(validated)`. This is clean.

## Verification

- **CI**: No checks reported on the `custom-otel-exporters` branch
- **Merge status**: CONFLICTING -- cannot be merged in current state
- **Local build**: Not attempted due to merge conflicts
- **Tests**: No tests exist for the new OTLP client

## Diagrams

```
Extension Activation
    |
    v
TelemetryService.createInstance([])
    |
    +-- register(PostHogTelemetryClient)
    +-- register(DebugTelemetryClient)  [dev only]
    +-- register(OtlpTelemetryClient)   [this PR]
    |       |
    |       +-- configure() from persisted settings
    |       |       |
    |       |       +-- Creates BasicTracerProvider + BatchSpanProcessor
    |       |       +-- Creates LoggerProvider + BatchLogRecordProcessor
    |       |       +-- register() <-- PROBLEM: global singleton
    |       |
    |       +-- capture(event)
    |               |
    |               +-- TASK_CREATED  -> startSpan()
    |               +-- TASK_COMPLETED -> endSpan()
    |               +-- TASK_RESTARTED -> endSpan() + startSpan()
    |               +-- other events  -> span.addEvent()
    |               +-- ALL events    -> emitLogRecord()
    |
    v
Settings UI (OtelExportSettings.tsx)
    |
    +-- Save -> webviewMessageHandler "otlpExportSettings"
    |       +-- Zod validate
    |       +-- updateGlobalState (plaintext!)
    |       +-- otlpClient.configure(settings)
```

## Lessons Learned

1. **OpenTelemetry's global registration is a footgun in VS Code extensions** -- because all extensions share an extension host process, `register()` creates cross-extension conflicts. Always use instance-scoped providers.

2. **Telemetry clients inheriting from a base class still need per-client privacy filtering** -- the base class provides a hook (`isPropertyCapturable()`) but defaults to allowing everything. New clients must explicitly opt into filtering or document why they don't.

3. **VS Code's `globalState` is not encrypted** -- any secrets stored there are in a SQLite DB on disk. Use `context.secrets` (SecretStorage) for API keys and auth tokens.

4. **Lock file churn reveals environment inconsistency** -- `@types/node` version drift from 20.x to 25.x in unrelated jest entries indicates the contributor ran `pnpm install` on a different Node.js version than the project targets.

5. **Even opt-in features need test coverage** -- "users choose to enable this" doesn't reduce the risk of span lifecycle bugs, shutdown races, or reconfiguration state corruption.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
