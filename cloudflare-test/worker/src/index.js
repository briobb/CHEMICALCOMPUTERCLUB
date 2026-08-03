const PRODUCTS = Object.freeze({
  "logo-t": {
    name: "CCC Logo T",
    price: 4400,
    sizes: ["S", "M", "L", "XL"]
  },
  mug: {
    name: "CCC Mug",
    price: 2200
  },
  bag: {
    name: "Equipment Bag",
    price: 2200
  },
  sox: {
    name: "CCC Sox",
    price: 2200,
    sizes: ["S", "M", "L"],
    colors: ["Ivory", "Navy", "Orange"]
  }
});

const MAX_CART_LINES = 50;
const MAX_ITEM_QUANTITY = 20;
const WEBHOOK_TOLERANCE_SECONDS = 300;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers }
  });
}

export function isAllowedOrigin(origin, configuredOrigins) {
  if (!origin) return false;
  const allowedOrigins = String(configuredOrigins || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowedOrigins.includes(origin)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function corsHeaders(origin, configuredOrigin) {
  if (!isAllowedOrigin(origin, configuredOrigin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin"
  };
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hexToBytes(hex) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  return Uint8Array.from(hex.match(/.{2}/g), (byte) => Number.parseInt(byte, 16));
}

export async function verifyStripeSignature(payload, signatureHeader, secret, now = Math.floor(Date.now() / 1000)) {
  if (!payload || !signatureHeader || !secret) return false;

  const signatures = {};
  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.split("=", 2);
    if (!key || !value) continue;
    (signatures[key] ||= []).push(value);
  }

  const timestamp = Number(signatures.t?.[0]);
  if (!Number.isInteger(timestamp) || Math.abs(now - timestamp) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signedPayload = new TextEncoder().encode(`${timestamp}.${payload}`);

  for (const hexSignature of signatures.v1 || []) {
    const signature = hexToBytes(hexSignature);
    if (signature && await crypto.subtle.verify("HMAC", key, signature, signedPayload)) return true;
  }
  return false;
}

export function validateCart(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_CART_LINES) {
    throw new Error("カートの商品数が正しくありません。");
  }

  return items.map((item) => {
    const product = PRODUCTS[item?.productId];
    if (!product) throw new Error("存在しない商品が含まれています。");

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      throw new Error("数量は1〜20の整数で指定してください。");
    }

    const size = normalizeText(item.size ?? item.variant);
    const color = normalizeText(item.color);

    if (product.sizes && !product.sizes.includes(size)) {
      throw new Error(`${product.name}のサイズが正しくありません。`);
    }
    if (!product.sizes && size) {
      throw new Error(`${product.name}にはサイズ指定がありません。`);
    }
    if (product.colors && !product.colors.includes(color)) {
      throw new Error(`${product.name}のカラーが正しくありません。`);
    }
    if (!product.colors && color) {
      throw new Error(`${product.name}にはカラー指定がありません。`);
    }

    const options = [color, size].filter(Boolean).join(" / ");
    return {
      productId: item.productId,
      name: options ? `${product.name} — ${options}` : product.name,
      unitAmount: product.price,
      quantity,
      size,
      color
    };
  });
}

export function createStripeParameters(items, siteUrl) {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("locale", "ja");
  params.set("success_url", `${siteUrl}/cloudflare-test/thank-you.html?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${siteUrl}/cloudflare-test/index-cart-test.html?checkout=cancelled`);
  params.set("shipping_address_collection[allowed_countries][0]", "JP");

  items.forEach((item, index) => {
    const prefix = `line_items[${index}]`;
    params.set(`${prefix}[price_data][currency]`, "jpy");
    params.set(`${prefix}[price_data][unit_amount]`, String(item.unitAmount));
    params.set(`${prefix}[price_data][product_data][name]`, item.name);
    params.set(`${prefix}[quantity]`, String(item.quantity));
  });
  return params;
}

async function createCheckoutSession(request, env, cors) {
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: "STRIPE_SECRET_KEYが設定されていません。" }, 503, cors);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON形式のリクエストが必要です。" }, 400, cors);
  }

  let items;
  try {
    items = validateCart(body.items);
  } catch (error) {
    return json({ error: error.message }, 400, cors);
  }

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: createStripeParameters(items, env.SITE_URL)
  });
  const stripeData = await stripeResponse.json();

  if (!stripeResponse.ok || !stripeData.url) {
    console.error("Stripe Checkout Session error", stripeData?.error?.type, stripeData?.error?.code);
    return json({ error: "決済ページを作成できませんでした。" }, 502, cors);
  }

  return json({ url: stripeData.url }, 200, cors);
}

async function handleStripeWebhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return json({ error: "STRIPE_WEBHOOK_SECRETが設定されていません。" }, 503);
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  if (!await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET)) {
    return json({ error: "Webhook署名を確認できませんでした。" }, 400);
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ error: "WebhookのJSONが正しくありません。" }, 400);
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data?.object;
    console.log("Stripe checkout completed", JSON.stringify({
      eventId: event.id,
      sessionId: session?.id,
      paymentStatus: session?.payment_status
    }));
  }

  return json({ received: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin") || "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === "OPTIONS") {
      return isAllowedOrigin(origin, env.ALLOWED_ORIGIN)
        ? new Response(null, { status: 204, headers: cors })
        : json({ error: "許可されていないオリジンです。" }, 403);
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json({
        ok: true,
        stripeConfigured: Boolean(env.STRIPE_SECRET_KEY),
        webhookConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET)
      });
    }

    if (url.pathname === "/stripe-webhook" && request.method === "POST") {
      return handleStripeWebhook(request, env);
    }

    if (url.pathname !== "/create-checkout-session" || request.method !== "POST") {
      return json({ error: "Not Found" }, 404, cors);
    }
    if (!isAllowedOrigin(origin, env.ALLOWED_ORIGIN)) {
      return json({ error: "許可されていないオリジンです。" }, 403);
    }

    return createCheckoutSession(request, env, cors);
  }
};
