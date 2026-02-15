<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 4963
title: "Initial draft of kilo pass support on profile page"
author: lambertjosh
category: feature
tier: 6
lines: 2259
files: 34
verdict: COMMENT
confidence: 72
reviewed_at: 2026-02-14
linked_issue: none
fork_pr: none
-->

# Review: kilocode #4963

> **Initial draft of kilo pass support on profile page** by @lambertjosh
> Static analysis review (no fork mirror / no local verification for this draft PR)

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Correctness | WARN | Loading states not reset on refetch; no-op ternaries; missing status translations |
| Conventions | PASS | Follows existing kilocode_change patterns, proper type exports |
| Changeset | PASS | Minor changeset present with clear description |
| Tests | WARN | 2 tests exist but cover only org-hidden and buy-credits paths; no subscription-active tests |
| i18n | PASS | All 23 locales populated; proper use of Trans components |
| Types | PASS | Clean type definitions in packages/types; proper re-exports through shim files |
| Security | PASS | Token sent via Authorization header over HTTPS; no secrets exposed in webview |
| Scope | PASS | Contained to profile view, types, message handler, i18n files |

## Findings

### 1. Loading states not reset on refetch (bug -- confirmed by @iscekic)

**File**: `webview-ui/src/components/kilocode/profile/ProfileView.tsx`

When `updateProfileData` message arrives, the component dispatches three new fetch requests but does not reset `isLoadingUser`, `isLoadingBalance`, or `isLoadingKiloPass` to `true`. Stale data remains visible without a loading indicator until responses arrive. The initial `useEffect` correctly sets them, but the refetch branch does not.

```tsx
// Current (bug):
} else if (message.type === "updateProfileData") {
    vscode.postMessage({ type: "fetchProfileDataRequest" })
    vscode.postMessage({ type: "fetchBalanceDataRequest" })
    vscode.postMessage({ type: "fetchKiloPassStateRequest" })
}

// Fix:
} else if (message.type === "updateProfileData") {
    setIsLoadingUser(true)
    setIsLoadingBalance(true)
    setIsLoadingKiloPass(true)
    vscode.postMessage({ type: "fetchProfileDataRequest" })
    vscode.postMessage({ type: "fetchBalanceDataRequest" })
    vscode.postMessage({ type: "fetchKiloPassStateRequest" })
}
```

### 2. Duplicate ternaries in progress bar (confirmed by @iscekic)

**File**: `webview-ui/src/components/kilocode/profile/ProfileView.tsx`

Two ternaries produce identical output for both branches:

```tsx
// Paid fill:
isLightTheme
    ? "bg-gradient-to-r from-amber-500 to-amber-400"
    : "bg-gradient-to-r from-amber-500 to-amber-400"

// Bonus fill:
isLightTheme
    ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
    : "bg-gradient-to-r from-emerald-500 to-emerald-400"
```

Either differentiate the light/dark variants or remove the ternary. This is dead code that confuses future readers into thinking theming was implemented here.

### 3. Fragile tRPC response normalization (raised by @iscekic)

**File**: `src/core/webview/webviewMessageHandler.ts`

The three-level fallback chain with manual object shape check is fragile:

```tsx
const subscriptionData =
    response.data?.result?.data?.json ?? response.data?.result?.data ?? response.data

const normalizedData =
    subscriptionData && typeof subscriptionData === "object" && "subscription" in subscriptionData
        ? subscriptionData
        : { subscription: null }
```

The codebase already uses zod. A `safeParse` with a defined schema would give type-safe validation and clear error logging on shape mismatch, replacing the hand-rolled check. @iscekic provided a concrete schema in their review.

### 4. Hardcoded subscription plans re-created every render

**File**: `webview-ui/src/components/kilocode/profile/ProfileView.tsx`

The `subscriptionPlans` array is defined inside the component body. It is static data with no dependency on props or state. Move to module scope or a constants file to avoid unnecessary re-allocation on every render and make pricing changes easier to locate.

### 5. Missing i18n status translations for 3 of 8 statuses

**Files**: All 23 locale files

`KiloPassSubscriptionStatus` is a union of 8 values (`active`, `canceled`, `incomplete`, `incomplete_expired`, `past_due`, `paused`, `trialing`, `unpaid`), but the i18n `status` object only defines 6. If the backend returns `incomplete`, `incomplete_expired`, or `unpaid`, the UI renders the raw translation key. Add translations for all 8 statuses or map unknown statuses to a fallback label.

### 6. Test coverage gaps for the core feature

**File**: `webview-ui/src/components/kilocode/profile/__tests__/ProfileView.spec.tsx`

The test file has 2 test cases:
1. Verifies Kilo Pass section is hidden for org accounts
2. Verifies `shopBuyCredits` message on buy-now click

Missing coverage:
- Active subscription rendering (tier display, status badge, usage bar, renewal info)
- No-subscription upsell rendering (plan cards visible, subscribe buttons work)
- Loading state display
- Error state handling (failed fetch)
- Progress bar math with edge cases (zero usage, over-limit, zero total)

### 7. useIsLightTheme hook -- good refactoring (positive)

The new `useIsLightTheme` hook correctly uses MutationObserver on `document.body` class changes, handles SSR guard, and consolidates duplicate implementations from `KiloLogo.tsx` and `ChatView.tsx`. Earlier bot reviews incorrectly flagged this as non-reactive -- it is reactive via the observer.

## CI Status

Not verified locally. PR is in active review with changes requested by @iscekic.

## Local Verification

Not performed. The PR is still iterating on review feedback. Local verification is warranted once the identified issues are addressed and the PR approaches merge readiness.

## Code Architecture Notes

The PR follows the established extension messaging pattern:
1. Types defined in `packages/types/src/vscode-extension-host.ts`
2. Re-exported through shim files in `src/shared/ExtensionMessage.ts` and `src/shared/WebviewMessage.ts`
3. Message handler case added in `src/core/webview/webviewMessageHandler.ts`
4. Webview component consumes via `window.addEventListener("message", ...)` listener

The tRPC call pattern (`axios.get` to `api.kilo.ai/api/trpc/kiloPass.getState`) matches how `fetchBalanceDataRequest` works, maintaining consistency.

The i18n structure is thorough -- 23 locales with ~60 new keys each, using `Trans` components with interpolation for styled inline text. Keys are well-organized under a `kiloPass` namespace with logical sub-groups (status, tiers, cadence, boost, plans, legend).

The line count is high (2,259 lines) but ~1,380 of those are i18n translations across 23 locales (60 keys x 23 files). The actual code changes are ~880 lines across 11 non-i18n files, which is reasonable for this feature scope.

## Verdict

**COMMENT** -- The architecture follows established patterns and the implementation is on a reasonable track for a draft. @iscekic has already requested changes covering the main issues (loading state bug, zod validation, constants extraction, no-op ternaries). The missing status translations and thin test coverage are additional items worth addressing before merge. No blocking architectural concerns.
