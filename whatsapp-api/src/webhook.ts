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
