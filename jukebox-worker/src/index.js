const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const MAX_BODY_BYTES = 4096;

function corsHeaders(origin, allowedOrigin) {
  if (origin !== allowedOrigin) return {};
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, maxLength);
}

async function readJsonBody(request) {
  if (!request.body) throw new SyntaxError("Missing body");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteCount = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteCount += value.byteLength;
    if (byteCount > MAX_BODY_BYTES) {
      await reader.cancel();
      return { tooLarge: true };
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return { value: JSON.parse(text) };
}

async function handleSongRequest(request, env, cors) {
  const contentType = request.headers.get("Content-Type") || "";
  const contentLength = Number(request.headers.get("Content-Length") || 0);

  if (!contentType.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ success: false, message: "Content-Type must be application/json." }, 415, cors);
  }
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ success: false, message: "Request is too large." }, 413, cors);
  }

  let parsed;
  try {
    parsed = await readJsonBody(request);
  } catch {
    return jsonResponse({ success: false, message: "Invalid JSON." }, 400, cors);
  }
  if (parsed.tooLarge) {
    return jsonResponse({ success: false, message: "Request is too large." }, 413, cors);
  }

  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ success: false, message: "Invalid request." }, 400, cors);
  }

  const song = cleanText(body.song, 100);
  const artist = cleanText(body.artist, 100);
  const name = cleanText(body.name, 40) || "Guest";
  const message = cleanText(body.message, 200);
  if (!song || !artist) {
    return jsonResponse({ success: false, message: "Song and artist are required." }, 400, cors);
  }

  if (!env.LINE_CHANNEL_ACCESS_TOKEN || !env.LINE_USER_ID) {
    console.error(JSON.stringify({ event: "configuration_error", missingLineSecrets: true }));
    return jsonResponse({ success: false, message: "Failed to send request." }, 500, cors);
  }

  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(new Date());
  const textLines = [
    "🎵 NEW SONG REQUEST",
    "",
    `Song: ${song}`,
    `Artist: ${artist}`,
    `From: ${name}`
  ];
  if (message) textLines.push(`Message: ${message}`);
  textLines.push("", time);
  const text = textLines.join("\n");

  try {
    const lineResponse = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: env.LINE_USER_ID,
        messages: [{ type: "text", text }]
      })
    });

    if (!lineResponse.ok) {
      console.error(JSON.stringify({ event: "line_api_error", status: lineResponse.status }));
      return jsonResponse({ success: false, message: "Failed to send request." }, 502, cors);
    }

    console.log(JSON.stringify({ event: "request_sent", requestId: crypto.randomUUID() }));
    return jsonResponse({ success: true }, 200, cors);
  } catch (error) {
    console.error(JSON.stringify({
      event: "line_fetch_error",
      error: error instanceof Error ? error.message : "unknown"
    }));
    return jsonResponse({ success: false, message: "Failed to send request." }, 502, cors);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === "OPTIONS") {
      return origin === env.ALLOWED_ORIGIN
        ? new Response(null, { status: 204, headers: cors })
        : jsonResponse({ success: false, message: "Origin not allowed." }, 403);
    }

    if (url.pathname !== "/request") {
      return jsonResponse({ success: false, message: "Not found." }, 404, cors);
    }
    if (request.method !== "POST") {
      return jsonResponse({ success: false, message: "Method not allowed." }, 405, {
        ...cors,
        "Allow": "POST, OPTIONS"
      });
    }
    if (origin !== env.ALLOWED_ORIGIN) {
      return jsonResponse({ success: false, message: "Origin not allowed." }, 403);
    }

    return handleSongRequest(request, env, cors);
  }
};
