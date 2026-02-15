<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5771
title: "Add OTLP Telemetry Export"
author: jdbohrman
category: feature
tier: 5
lines: 808
files: 14
review_number: 55
-->

# Review Journal: kilocode #5771

> **PR**: [#5771](https://github.com/Kilo-Org/kilocode/pull/5771) |
> **Title**: Add OTLP Telemetry Export |
> **Author**: @jdbohrman |
> **Category**: feature | **Tier**: 5 | **Size**: +788/-20, 14 files

---

## Summary

Adds optional OTLP telemetry export alongside PostHog, allowing teams to send data to their own observability stacks. The architecture is correct (extends BaseTelemetryClient, opt-in, Zod-validated settings) but the PR is missing a changeset, has no test coverage, and CI has not run. The dual OTel SDK version tree and plaintext header storage are additional concerns.

## First Impressions

Title signals a significant feature addition. The PR description is detailed and well-organized, explaining the three-layer architecture (client, extension-host wiring, settings UI). The author provides Docker instructions for local testing with Jaeger. The scope is contained to the telemetry subsystem and settings.

## What I Looked At

- Full diff of all 14 files (788 additions)
- `packages/telemetry/src/OtlpTelemetryClient.ts` - the core new class (232 lines)
- `packages/types/src/global-settings.ts` - OtlpExportSettings Zod schema
- `src/extension.ts` - OTLP client registration at activation
- `src/services/telemetry/otlpClientHolder.ts` - module-scoped holder
- `src/core/webview/webviewMessageHandler.ts` - settings persistence
- `webview-ui/src/components/settings/OtelExportSettings.tsx` - settings UI (187 lines)
- `webview-ui/src/components/settings/SettingsView.tsx` - tab integration
- `pnpm-lock.yaml` - dependency analysis (214 additions from 7 new OTel packages)
- PR comments (changeset-bot warning only)
- CI status (no checks ran)

## Analysis

### Architecture

The implementation spans three layers:

1. **OtlpTelemetryClient** (`packages/telemetry/`): Extends `BaseTelemetryClient`. Task lifecycle events become OTel trace spans (TASK_CREATED starts, TASK_COMPLETED ends, TASK_RESTARTED restarts). All events additionally emit OTLP log records. Uses `BatchSpanProcessor` and `BatchLogRecordProcessor` for efficient export over OTLP/HTTP with protobuf encoding.

2. **Extension-host wiring** (`src/extension.ts`, `otlpClientHolder.ts`, `webviewMessageHandler.ts`): Client instantiated at activation, registered with TelemetryService, and configured from persisted global state. The module-scoped holder pattern allows the webview message handler to reconfigure the client when settings change.

3. **Settings UI** (`OtelExportSettings.tsx`, `SettingsView.tsx`): New "OTLP Export" tab with enable toggle, traces/logs endpoints, service name, and custom headers (key-value with masked values). Settings flow through the standard `globalSettings` pipeline with Zod validation.

### Dependency Concern

The PR introduces 7 new `@opentelemetry/*` packages at version 0.52.x/1.25.x. The project already uses `@opentelemetry/*` at version 2.2.0 (used by the existing instrumentation setup). The lock file shows duplicate dependency trees:
- `@opentelemetry/core@1.25.1` AND `@opentelemetry/core@2.2.0`
- `@opentelemetry/resources@1.25.1`, `@opentelemetry/resources@1.30.1`, AND `@opentelemetry/resources@2.2.0`
- `@opentelemetry/sdk-trace-base@1.25.1`, `@opentelemetry/sdk-trace-base@1.30.1`, AND `@opentelemetry/sdk-trace-base@2.2.0`

The OpenTelemetry API uses a global singleton (`@opentelemetry/api@1.9.0`), so multiple SDK versions should work, but the bundle size increase and potential for subtle incompatibilities is a concern.

### Security Analysis

OTLP authentication headers are stored as plain key-value pairs in VS Code global state. For providers like Datadog and Honeycomb, these headers contain API keys. The extension stores other provider API keys in VS Code's Secret Storage. The inconsistency means OTLP auth tokens are less protected than other credentials. The UI uses `type="password"` for the value field, which only hides the display.

### Missing Pieces

1. **No changeset** - Changeset-bot flagged this. A `patch` changeset for `kilo-code`, `@roo-code/telemetry`, and `@roo-code/types` is needed.
2. **No tests** - The `OtlpTelemetryClient` class has no test file. The settings UI has no test file.
3. **No CI** - Branch has no check runs, so type-checking, compilation, and test suite have not been verified.

## Verification

- **CI**: No checks have run on this branch.
- **Upstream**: REVIEW_REQUIRED, no reviews submitted.
- **Dependency analysis**: 7 new OpenTelemetry packages create a dual SDK version tree.

## Lessons Learned

1. **Telemetry features need test coverage for the client lifecycle.** Span start/end, log emission, and reconfiguration are all stateful operations that should be tested.

2. **Credential storage should be consistent across the extension.** If API keys go in Secret Storage, OTLP authentication headers should too.

3. **Dependency version alignment matters in the OpenTelemetry ecosystem.** The OTel API singleton means multiple SDK versions *can* coexist, but shouldn't without good reason.

4. **CI must pass before review can reach APPROVE.** Without CI, we cannot verify that the new dependencies integrate without breakage.

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
