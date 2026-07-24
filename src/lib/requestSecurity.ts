import { NextResponse } from "next/server";

export const MAX_JSON_BODY_BYTES = 64 * 1024;

function firstHeaderValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

export function rejectCrossOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  const requestUrl = new URL(request.url);
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const forwardedProtocol = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const host = firstHeaderValue(request.headers.get("host"));
  const allowedOrigins = new Set([requestUrl.origin]);

  for (const candidateHost of [host, forwardedHost]) {
    if (!candidateHost) continue;
    const protocol = candidateHost === forwardedHost && forwardedProtocol
      ? forwardedProtocol
      : requestUrl.protocol.replace(":", "");
    try {
      allowedOrigins.add(new URL(`${protocol}://${candidateHost}`).origin);
    } catch {
      // Invalid proxy headers cannot authorize an origin.
    }
  }

  if (allowedOrigins.has(origin)) return null;

  return NextResponse.json({ error: "Cross-origin mutations are not allowed." }, { status: 403 });
}

export async function readJsonBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Request body is too large." }, { status: 413 }),
    };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Request body could not be read." }, { status: 400 }),
    };
  }

  if (Buffer.byteLength(text, "utf8") > MAX_JSON_BODY_BYTES) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Request body is too large." }, { status: 413 }),
    };
  }

  try {
    return { ok: true as const, data: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }),
    };
  }
}
