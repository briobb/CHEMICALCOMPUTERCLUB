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
    available: false,
    sizes: ["S", "M", "L"],
    colors: ["Ivory", "Navy", "Orange"]
  },
  "test-item": {
    name: "CCC Sticker",
    price: 600
  },
  patch: {
    name: "CCC Patch",
    price: 1000,
    sizes: ["丸型", "四角型"]
  },
  "club-t": {
    name: "CCC Club T",
    price: 4400,
    sizes: ["S", "M", "L", "XL"]
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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatYen(amount) {
  return `¥${Number(amount || 0).toLocaleString("ja-JP")}`;
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
    if (product.available === false) throw new Error(`${product.name}は現在販売準備中です。`);

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

export function createStripeParameters(
  items,
  siteUrl,
  successPath = "/cloudflare-test/thank-you.html",
  cancelPath = "/cloudflare-test/index-cart-test.html?checkout=cancelled"
) {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("locale", "ja");
  const successSeparator = successPath.includes("?") ? "&" : "?";
  params.set("success_url", `${siteUrl}${successPath}${successSeparator}session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${siteUrl}${cancelPath}`);
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
    body: createStripeParameters(
      items,
      env.SITE_URL,
      env.CHECKOUT_SUCCESS_PATH,
      env.CHECKOUT_CANCEL_PATH
    )
  });
  const stripeData = await stripeResponse.json();

  if (!stripeResponse.ok || !stripeData.url) {
    console.error("Stripe Checkout Session error", stripeData?.error?.type, stripeData?.error?.code);
    return json({ error: "決済ページを作成できませんでした。" }, 502, cors);
  }

  return json({ url: stripeData.url }, 200, cors);
}

async function retrieveCheckoutSession(sessionId, secretKey) {
  const params = new URLSearchParams();
  params.append("expand[]", "line_items.data.price");
  const response = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?${params}`,
    { headers: { authorization: `Bearer ${secretKey}` } }
  );
  const session = await response.json();
  if (!response.ok || !session?.id) {
    console.error("Stripe Checkout retrieve error", session?.error?.type, session?.error?.code);
    throw new Error("Checkout Sessionを取得できませんでした。");
  }
  return session;
}

export function normalizeOrder(eventId, session) {
  const customer = session.customer_details || {};
  const shipping = session.collected_information?.shipping_details || session.shipping_details || {};
  const address = shipping.address || {};
  const items = (session.line_items?.data || []).map((item, lineIndex) => ({
    lineIndex,
    description: normalizeText(item.description) || "Item",
    quantity: Number(item.quantity) || 0,
    unitAmount: Number.isInteger(item.price?.unit_amount) ? item.price.unit_amount : null,
    amountTotal: Number(item.amount_total) || 0,
    currency: normalizeText(item.currency || session.currency).toLowerCase()
  }));

  return {
    sessionId: session.id,
    eventId,
    stripeCreatedAt: Number(session.created) || 0,
    amountTotal: Number(session.amount_total) || 0,
    currency: normalizeText(session.currency).toLowerCase(),
    paymentStatus: normalizeText(session.payment_status),
    customerEmail: normalizeText(customer.email) || null,
    customerName: normalizeText(customer.name) || null,
    customerPhone: normalizeText(customer.phone) || null,
    shippingName: normalizeText(shipping.name) || null,
    shippingCountry: normalizeText(address.country) || null,
    shippingPostalCode: normalizeText(address.postal_code) || null,
    shippingState: normalizeText(address.state) || null,
    shippingCity: normalizeText(address.city) || null,
    shippingLine1: normalizeText(address.line1) || null,
    shippingLine2: normalizeText(address.line2) || null,
    items
  };
}

async function saveOrder(db, order) {
  const statements = [
    db.prepare(`
      INSERT INTO orders (
        session_id, event_id, stripe_created_at, amount_total, currency, payment_status,
        customer_email, customer_name, customer_phone, shipping_name, shipping_country,
        shipping_postal_code, shipping_state, shipping_city, shipping_line1, shipping_line2
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
      ON CONFLICT(session_id) DO UPDATE SET
        event_id = excluded.event_id,
        payment_status = excluded.payment_status,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      order.sessionId, order.eventId, order.stripeCreatedAt, order.amountTotal, order.currency,
      order.paymentStatus, order.customerEmail, order.customerName, order.customerPhone,
      order.shippingName, order.shippingCountry, order.shippingPostalCode, order.shippingState,
      order.shippingCity, order.shippingLine1, order.shippingLine2
    ),
    ...order.items.map((item) => db.prepare(`
      INSERT OR IGNORE INTO order_items (
        session_id, line_index, description, quantity, unit_amount, amount_total, currency
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    `).bind(
      order.sessionId, item.lineIndex, item.description, item.quantity,
      item.unitAmount, item.amountTotal, item.currency
    ))
  ];
  await db.batch(statements);
}

export function createOrderEmail(order) {
  const itemText = order.items.map((item) =>
    `- ${item.description} × ${item.quantity}（${formatYen(item.amountTotal)}）`
  ).join("\n");
  const addressParts = [
    order.shippingPostalCode ? `〒${order.shippingPostalCode}` : "",
    order.shippingState,
    order.shippingCity,
    order.shippingLine1,
    order.shippingLine2
  ].filter(Boolean);
  const text = [
    "CCCストアに新しい注文が入りました。",
    "",
    `注文番号: ${order.sessionId}`,
    `合計: ${formatYen(order.amountTotal)}`,
    `決済状態: ${order.paymentStatus}`,
    "",
    "商品:",
    itemText,
    "",
    `購入者: ${order.customerName || "未入力"}`,
    `メール: ${order.customerEmail || "未入力"}`,
    `電話番号: ${order.customerPhone || "未入力"}`,
    `配送先名: ${order.shippingName || "未入力"}`,
    `配送先: ${addressParts.join(" ") || "未入力"}`,
    "",
    "発送状態はCloudflare D1で unfulfilled として登録されています。"
  ].join("\n");

  const itemHtml = order.items.map((item) =>
    `<li>${escapeHtml(item.description)} × ${item.quantity}（${escapeHtml(formatYen(item.amountTotal))}）</li>`
  ).join("");
  const html = `
    <h1>CCCストアに新しい注文が入りました。</h1>
    <p><strong>注文番号:</strong> ${escapeHtml(order.sessionId)}<br>
    <strong>合計:</strong> ${escapeHtml(formatYen(order.amountTotal))}<br>
    <strong>決済状態:</strong> ${escapeHtml(order.paymentStatus)}</p>
    <h2>商品</h2><ul>${itemHtml}</ul>
    <h2>購入者・配送先</h2>
    <p><strong>購入者:</strong> ${escapeHtml(order.customerName || "未入力")}<br>
    <strong>メール:</strong> ${escapeHtml(order.customerEmail || "未入力")}<br>
    <strong>電話番号:</strong> ${escapeHtml(order.customerPhone || "未入力")}<br>
    <strong>配送先名:</strong> ${escapeHtml(order.shippingName || "未入力")}<br>
    <strong>配送先:</strong> ${escapeHtml(addressParts.join(" ") || "未入力")}</p>
    <p>発送状態はCloudflare D1で <code>unfulfilled</code> として登録されています。</p>
  `;

  return {
    to: "chemicalcomputerclub@gmail.com",
    from: { email: "orders@chemicalcomputerclub.com", name: "CCC Orders" },
    subject: `[CCC] 新しい注文 ${formatYen(order.amountTotal)}`,
    text,
    html
  };
}

async function notifyOrder(env, order) {
  const existing = await env.DB.prepare(
    "SELECT notification_sent_at FROM orders WHERE session_id = ?1 LIMIT 1"
  ).bind(order.sessionId).first();
  if (existing?.notification_sent_at) return false;

  await env.ORDER_EMAIL.send(createOrderEmail(order));
  await env.DB.prepare(
    "UPDATE orders SET notification_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?1"
  ).bind(order.sessionId).run();
  return true;
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
    if (!env.STRIPE_SECRET_KEY || !env.DB || !env.ORDER_EMAIL) {
      return json({ error: "注文保存の設定が不足しています。" }, 503);
    }
    const sessionId = event.data?.object?.id;
    if (!sessionId) return json({ error: "Checkout Session IDがありません。" }, 400);

    try {
      const session = await retrieveCheckoutSession(sessionId, env.STRIPE_SECRET_KEY);
      if (session.payment_status === "unpaid") {
        return json({ received: true, saved: false });
      }
      const order = normalizeOrder(event.id, session);
      await saveOrder(env.DB, order);
      const notificationSent = await notifyOrder(env, order);
      console.log("Stripe checkout completed", JSON.stringify({
        eventId: event.id,
        sessionId: session.id,
        paymentStatus: session.payment_status,
        saved: true,
        notificationSent
      }));
    } catch (error) {
      console.error("Order processing failed", error?.code, error?.message);
      return json({ error: "注文通知を処理できませんでした。" }, 500);
    }
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
