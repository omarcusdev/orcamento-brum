# Deferred Backlog — Phase 4 (whatsapp-api server dedup / group D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dedup the two repeated patterns in the `whatsapp-api` server — the signed-webhook POST and the pairing-state reset — into small, unit-tested helper modules, adding the first real (non-sanity) vitest tests to the package.

**Architecture:** Two new pure/thin modules in `whatsapp-api/src/`: `webhook.ts` (`postSigned` — a thin signed `fetch` wrapper that returns the `Response`, so each caller keeps its own status/error logging) and `pairing-state.ts` (`PairingState` type + pure `idlePairingState()` factory). `baileys.ts` collapses its five scattered pairing `let`s into one `pairing` object reset via `idlePairingState()`, and `sendDownAlert`/`forwardInbound` call `postSigned`.

**Tech Stack:** Node + Fastify + Baileys (`@whiskeysockets/baileys`) + pino, TypeScript (ESM, `.js` import specifiers), vitest 3 (harness added in Phase 0).

## Global Constraints

- **Branch:** all work stacks on `refactor/thermo-nuclear-code-quality` (single PR #2). Do NOT merge, do NOT branch, do NOT touch `main`.
- **This phase touches ONLY `whatsapp-api/`** — the `app` package is unaffected. Per-commit gate (from repo root, both green before every commit):
  - `npm --prefix whatsapp-api run build` (→ `tsc`; typechecks + emits to `dist/`)
  - `npm --prefix whatsapp-api run test` (→ `vitest run`)
- **Commit trailers (every commit, exactly):**
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011vQov9fd6qHob8mbpchWG6
  ```
- **Behavior-preserving.** Keep observable log output (the `console.error`/`console.log` messages) unchanged. The ONE sanctioned, behavior-equivalent change: after the pairing-state refactor, the `loggedOut` / unpaired-close / `open` transitions reset the full pairing state (incl. `pairingPhone`/`codeRequested`) instead of a subset — those fields were already idle-or-unread at those points, so no observable difference.
- **ESM import specifiers:** this package uses `"type": "module"` + NodeNext resolution — relative imports MUST include the `.js` extension (e.g. `import { postSigned } from "./webhook.js"`), matching the existing `import { extractInbound, forwardInbound } from "./inbound.js"`.
- **Staging:** `git add` only the exact files named per task — do NOT `git add -A` (the `tsc` build writes `dist/`; don't stage it).

---

## File Structure (what each new file owns)

- `whatsapp-api/src/webhook.ts` — `postSigned(url, secret, secretHeader, payload)` → `Promise<Response>`: one signed JSON POST. No logging (callers own their logs).
- `whatsapp-api/src/pairing-state.ts` — `PairingState` type + `idlePairingState()` pure factory (the idle values of the 5 pairing fields).
- Modified: `whatsapp-api/src/inbound.ts` (`forwardInbound` → `postSigned`), `whatsapp-api/src/baileys.ts` (`sendDownAlert` → `postSigned`; the 5 pairing `let`s → one `pairing` object).
- Tests: `whatsapp-api/src/webhook.test.ts`, `whatsapp-api/src/pairing-state.test.ts`.

---

### Task 1: `postSigned` signed-webhook helper

**Files:**
- Create: `whatsapp-api/src/webhook.ts`
- Create: `whatsapp-api/src/webhook.test.ts`
- Modify: `whatsapp-api/src/inbound.ts`
- Modify: `whatsapp-api/src/baileys.ts` (only `sendDownAlert`)

**Interfaces:**
- Produces:
  ```ts
  export const postSigned: (url: string, secret: string, secretHeader: string, payload: unknown) => Promise<Response>
  ```
  Sends `POST` with headers `{ [secretHeader]: secret, "content-type": "application/json" }` and body `JSON.stringify(payload)`; returns the `fetch` `Response` (does NOT check `res.ok` and does NOT log — the caller does, preserving its exact messages).

- [ ] **Step 1: Write the failing test**

`whatsapp-api/src/webhook.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from "vitest"
import { postSigned } from "./webhook.js"

afterEach(() => vi.restoreAllMocks())

describe("postSigned", () => {
  it("POSTs JSON with the signed header and returns the response", async () => {
    const res = new Response(null, { status: 200 })
    const fetchMock = vi.fn().mockResolvedValue(res)
    vi.stubGlobal("fetch", fetchMock)

    const out = await postSigned("https://app/webhook", "s3cr3t", "x-inbound-secret", { a: 1 })

    expect(out).toBe(res)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://app/webhook")
    expect(init.method).toBe("POST")
    expect(init.headers).toEqual({ "x-inbound-secret": "s3cr3t", "content-type": "application/json" })
    expect(init.body).toBe(JSON.stringify({ a: 1 }))
  })

  it("propagates fetch rejections to the caller", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))
    await expect(postSigned("https://app/webhook", "s", "x-alert-secret", {})).rejects.toThrow("network down")
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm --prefix whatsapp-api run test -- webhook.test.ts`
Expected: FAIL — `Cannot find module './webhook.js'`.

- [ ] **Step 3: Implement `whatsapp-api/src/webhook.ts`**
```ts
// One signed JSON POST to an app webhook. Returns the raw Response — callers keep their own
// status/error logging (sendDownAlert and forwardInbound log differently). Extracted from the
// two identical fetch-construction blocks in baileys.ts (sendDownAlert) and inbound.ts (forwardInbound).
export const postSigned = (
  url: string,
  secret: string,
  secretHeader: string,
  payload: unknown,
): Promise<Response> =>
  fetch(url, {
    method: "POST",
    headers: { [secretHeader]: secret, "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm --prefix whatsapp-api run test -- webhook.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Migrate `forwardInbound` in `inbound.ts`**

Add `import { postSigned } from "./webhook.js"` at the top. Replace the `try { const res = await fetch(url, {...}); if (!res.ok) ... } catch ...` block body so the fetch construction comes from `postSigned`, keeping the SAME `res.ok`/error logging:
```ts
  try {
    const res = await postSigned(url, secret, "x-inbound-secret", payload)
    if (!res.ok) {
      console.error("forwardInbound non-2xx:", res.status)
    }
  } catch (err) {
    console.error("forwardInbound failed:", err)
  }
```
(The missing-config guard above it and the `missingConfigLogged` once-flag stay exactly as-is.)

- [ ] **Step 6: Migrate `sendDownAlert` in `baileys.ts`**

Add `import { postSigned } from "./webhook.js"` to the imports. Replace the `try { await fetch(webhookUrl, {...}) } catch ...` block, keeping the SAME behavior (no `res.ok` check, same catch message):
```ts
  try {
    await postSigned(webhookUrl, secret, "x-alert-secret", { reason, since: new Date().toISOString() })
  } catch (err) {
    console.error("Failed to deliver WhatsApp down alert:", err)
  }
```
(The `webhookUrl`/`secret` resolution + the `missingAlertConfigLogged` guard above it stay exactly as-is.)

- [ ] **Step 7: Gate + commit**

```bash
npm --prefix whatsapp-api run build && npm --prefix whatsapp-api run test
git add whatsapp-api/src/webhook.ts whatsapp-api/src/webhook.test.ts whatsapp-api/src/inbound.ts whatsapp-api/src/baileys.ts
git commit   # "refactor(whatsapp-api): extract postSigned signed-webhook helper"
```

---

### Task 2: `idlePairingState` + collapse the 5 pairing `let`s into one object

**Files:**
- Create: `whatsapp-api/src/pairing-state.ts`
- Create: `whatsapp-api/src/pairing-state.test.ts`
- Modify: `whatsapp-api/src/baileys.ts`

**Interfaces:**
- Produces:
  ```ts
  export type PairingState = {
    currentQr: string | null
    currentCode: string | null
    pairingMethod: "qr" | "code" | null
    pairingPhone: string | null
    codeRequested: boolean
  }
  export const idlePairingState: () => PairingState
  ```
  `idlePairingState()` returns a FRESH object each call with all fields at their idle values (`null`/`false`). Consumed by `baileys.ts` to replace the five module-level `let`s and their five identical reset sites.

**Sanctioned behavior-equivalent change:** the `loggedOut`, unpaired-close, and `open` transitions currently null only `currentQr`/`currentCode`/`pairingMethod`; after this refactor they reset the full pairing state (also `pairingPhone`/`codeRequested`). Those two fields are already idle (reset on the prior `startPairing`/`open`) and are only read inside the qr handler during an active pairing, so there is no observable difference.

- [ ] **Step 1: Write the failing test**

`whatsapp-api/src/pairing-state.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { idlePairingState } from "./pairing-state.js"

describe("idlePairingState", () => {
  it("returns all fields at their idle values", () => {
    expect(idlePairingState()).toEqual({
      currentQr: null,
      currentCode: null,
      pairingMethod: null,
      pairingPhone: null,
      codeRequested: false,
    })
  })

  it("returns a fresh object each call (no shared mutable reference)", () => {
    const a = idlePairingState()
    const b = idlePairingState()
    expect(a).not.toBe(b)
    a.currentQr = "changed"
    expect(b.currentQr).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm --prefix whatsapp-api run test -- pairing-state.test.ts`
Expected: FAIL — `Cannot find module './pairing-state.js'`.

- [ ] **Step 3: Implement `whatsapp-api/src/pairing-state.ts`**
```ts
// The five pieces of pairing-flow state that baileys.ts resets together at every idle transition
// (reset-to-idle, logged-out, pairing-window-closed, connected, logout). One object + one factory
// replaces five scattered `let`s and five near-identical reset blocks.
export type PairingState = {
  currentQr: string | null
  currentCode: string | null
  pairingMethod: "qr" | "code" | null
  pairingPhone: string | null
  codeRequested: boolean
}

export const idlePairingState = (): PairingState => ({
  currentQr: null,
  currentCode: null,
  pairingMethod: null,
  pairingPhone: null,
  codeRequested: false,
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm --prefix whatsapp-api run test -- pairing-state.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Refactor `baileys.ts` to use one `pairing` object**

Add `import { idlePairingState } from "./pairing-state.js"` to the imports.

Replace the five module `let` declarations:
```ts
let currentQr: string | null = null
let currentCode: string | null = null
let pairingMethod: "qr" | "code" | null = null
let pairingPhone: string | null = null
let codeRequested = false
```
with a single:
```ts
let pairing = idlePairingState()
```
(Keep `socket`, `connectionStatus`, `paired`, `alertSent`, `offlineTimer`, `missingAlertConfigLogged` as-is — those are NOT pairing state.)

Then update every read/write of those five names to `pairing.<field>`, and replace each full reset with `pairing = idlePairingState()`. The exact resulting forms:

`resetToIdle`:
```ts
const resetToIdle = (): void => {
  try {
    socket?.end(undefined)
  } catch {}
  socket = null
  connectionStatus = "disconnected"
  pairing = idlePairingState()
  clearOfflineTimer()
}
```

Inside the `connection.update` handler, the `qr` branch:
```ts
    if (qr) {
      if (pairing.pairingMethod === "code") {
        if (pairing.pairingPhone && !pairing.codeRequested) {
          pairing.codeRequested = true
          newSocket
            .requestPairingCode(pairing.pairingPhone)
            .then((code) => {
              pairing.currentCode = code
              console.log("WhatsApp pairing code:", code)
            })
            .catch((err) => {
              console.error("requestPairingCode failed:", err)
              resetToIdle()
            })
        }
      } else if (pairing.pairingMethod === "qr") {
        pairing.currentQr = qr
        console.log("Scan this QR code to connect WhatsApp:")
        console.log("WA_QR " + qr)
        QRCode.generate(qr, { small: true })
      }
    }
```

The `loggedOut` branch (replace the four individual nulls + keep the rest):
```ts
      if (statusCode === DisconnectReason.loggedOut) {
        console.log("Logged out. Re-pair via the admin WhatsApp page.")
        socket = null
        paired = false
        pairing = idlePairingState()
        clearOfflineTimer()
        if (wasPaired && !alertSent) {
          alertSent = true
          sendDownAlert("logged_out")
        }
      } else if (wasPaired) {
        // ...unchanged (reconnect + offline timer)...
      } else {
        console.log("Pairing attempt ended without pairing. Idle until next /connect.")
        socket = null
        pairing = idlePairingState()
        clearOfflineTimer()
      }
```

The `open` branch:
```ts
    } else if (connection === "open") {
      connectionStatus = "connected"
      paired = true
      pairing = idlePairingState()
      alertSent = false
      clearOfflineTimer()
      console.log("WhatsApp connected successfully!")
    }
```

`startPairing` — replace the `pairingMethod=`/`pairingPhone=`/`codeRequested=`/`currentQr=`/`currentCode=` assignments with one object construction (an in-progress pairing state, NOT idle):
```ts
  pairing = {
    currentQr: null,
    currentCode: null,
    pairingMethod: method,
    pairingPhone: method === "code" && phone ? normalizePhone(phone) : null,
    codeRequested: false,
  }
  connectionStatus = "connecting"
```

`logout`:
```ts
  socket = null
  connectionStatus = "disconnected"
  paired = false
  pairing = idlePairingState()
  alertSent = false
  clearOfflineTimer()
```

`getConnectionInfo` (reads):
```ts
const getConnectionInfo = () => ({
  status: connectionStatus,
  paired,
  qr: connectionStatus === "connected" ? null : pairing.currentQr,
  code: connectionStatus === "connected" ? null : pairing.currentCode,
  me: connectionStatus === "connected" ? extractPhone(socket?.user?.id) : null,
})
```

- [ ] **Step 6: Verify no bare pairing-var references remain**

Run: `grep -nE "\b(currentQr|currentCode|pairingMethod|pairingPhone|codeRequested)\b" whatsapp-api/src/baileys.ts | grep -v "pairing\."`
Expected: no matches (every occurrence is now `pairing.<field>`; the only line mentioning the bare names is gone since the five `let`s were replaced by `let pairing = idlePairingState()`).

- [ ] **Step 7: Gate + commit**

```bash
npm --prefix whatsapp-api run build && npm --prefix whatsapp-api run test
git add whatsapp-api/src/pairing-state.ts whatsapp-api/src/pairing-state.test.ts whatsapp-api/src/baileys.ts
git commit   # "refactor(whatsapp-api): collapse pairing state into one idlePairingState object"
```

---

## Final whole-branch review (after Task 2)

Dispatch the final reviewer over the Phase 4 range with `scripts/review-package <phase4-base> HEAD`. Hand it the Global Constraints (behavior-preserving; logs unchanged; the one sanctioned full-reset equivalence) and confirm: `postSigned` is byte-faithful to the two original fetch blocks and each caller keeps its exact logging; the `pairing` object refactor preserves the connection state machine (qr/code request flow, loggedOut vs offline vs unpaired-close vs open, reconnect); no bare pairing-var references remain; `whatsapp-api` build + test green.

## Success criteria

- `postSigned` + `idlePairingState` extracted, each with a real vitest test (the first non-sanity tests in `whatsapp-api`).
- `sendDownAlert` + `forwardInbound` use `postSigned`; the five pairing resets use `idlePairingState()`.
- `whatsapp-api` `tsc` build clean, `vitest run` green; observable logs unchanged.
- Behavior preserved (pairing flow + alert/inbound webhooks) modulo the one sanctioned full-reset equivalence.

## Self-review notes (author)

- **Spec coverage:** `clearPairingState`/pairing dedup ✓ (Task 2, via the `idlePairingState` object — the testable form of "clearPairingState"); `postSigned` dedup ✓ (Task 1); first whatsapp-api tests ✓ (both tasks).
- **Logs unchanged:** `postSigned` deliberately does NOT log or check `res.ok` — each caller keeps its exact `console.error` messages and (for forwardInbound) its `res.ok` check. That's why `postSigned` returns the `Response` instead of `void`.
- **Behavior-preserving:** the only delta is the sanctioned full-reset equivalence at loggedOut/unpaired-close/open (fields already idle-or-unread). The connection state machine, reconnect logic, offline-alert timer, and env-config guards are untouched.
- **ESM:** all new relative imports use `.js` specifiers (NodeNext), matching the existing `./inbound.js` import.
- **Type consistency:** `PairingState.pairingMethod` is `"qr" | "code" | null` (matches the original `let` type); `idlePairingState()` return type flows into `let pairing`, so `pairing.pairingMethod` keeps that union at every use site.
