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
