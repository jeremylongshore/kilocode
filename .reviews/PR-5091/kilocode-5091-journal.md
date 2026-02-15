<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5091
title: "feat(mode): implement Ralph mode for infinite task loops"
author: dannycreations
category: feature
tier: 5
lines: 768
files: 39
review_number: 41
-->

# Review Journal: kilocode #5091

> **PR**: [#5091](https://github.com/Kilo-Org/kilocode/pull/5091) |
> **Title**: feat(mode): implement Ralph mode for infinite task loops |
> **Author**: @dannycreations |
> **Category**: feature | **Tier**: 5 | **Size**: 768 lines, 39 files

---

## Summary

Infinite task loop feature with safety gaps. No cost ceiling, race condition in restart flow, and mistake limit override could create failure loops. The concept is valid but needs safety guardrails. REQUEST_CHANGES.

## First Impressions

"Infinite task loops" immediately raises safety questions. The feature is inspired by Manus-like autonomous agents that repeatedly execute tasks. The author is the same as PR #4704 (configurable retry), suggesting a pattern of autonomy features.

## What I Looked At

- `src/core/task/Task.ts` -- handleRalphRestart (82 lines), handleMistakeLimitReached (new method)
- `src/core/tools/AttemptCompletionTool.ts` -- Ralph restart hook
- `src/core/tools/__tests__/AttemptCompletionToolRalph.spec.ts` (219 lines) -- tests
- `src/core/assistant-message/presentAssistantMessage.ts` -- mistake limit changes
- `packages/types/src/global-settings.ts` -- 4 new settings (alwaysAllowRalph, ralphEnabled, ralphLoopLimit, ralphCompletionDelimiter)
- `webview-ui/src/components/chat/ChatTextArea.tsx` -- infinity icon toggle
- `webview-ui/src/components/settings/AutoApproveSettings.tsx` -- Ralph settings section

## Analysis

### Safety is the critical issue

The feature operates like YOLO mode but with automatic restart. YOLO mode at least stops when the task completes. Ralph mode restarts it. With `ralphLoopLimit: 0`, there is no stop condition except:
1. The delimiter appearing in the output
2. The user manually stopping
3. The API returning persistent errors

There is no cost tracking, no token budget, and no wall-clock timeout. For paid APIs, this is a billing risk.

### The restart mechanism is fragile

Using `setTimeout(fn, 1000)` to schedule a task restart after calling `abortTask()` is a timing-based approach. The 1-second gap assumes that abort cleanup completes within that window. A proper approach would await abort completion, then create the new task using event-based sequencing rather than timers.

### The test quality is reasonable

The 219-line test file uses mock task objects but tests meaningful scenarios: Ralph restart when enabled, loop limit enforcement, delimiter detection in result text, delimiter detection in previous messages. The tests do not exercise the actual setTimeout/abortTask race condition.

### Mistake limit interaction is concerning

When Ralph mode is active and the mistake limit is reached, the task restarts silently. This creates a potential infinite failure loop: task fails, Ralph restarts, task fails again, Ralph restarts again -- each loop generating API costs for a task that is known to be failing.

## Verification

- CI: No checks reported on branch
- Merge status: UNKNOWN
- Maintainer @marius-kilocode asked about completion conditions (addressed with delimiter)
- Maintainer Kevin: deprioritized for rebuild

## Lessons Learned

- Autonomous loop features need mandatory circuit breakers (cost ceiling, error count, wall-clock timeout)
- setTimeout-based coordination between abort and restart is fragile -- event-based sequencing is more reliable
- When a feature says "infinite loops" in the title, the first review question should be "what stops it?"
- The "treat it like YOLO mode" philosophy works for single-task execution but breaks down for loops where damage accumulates

---

<sub>Review methodology: [AI PR Review Case Studies](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with GWI + Claude Code</sub>
