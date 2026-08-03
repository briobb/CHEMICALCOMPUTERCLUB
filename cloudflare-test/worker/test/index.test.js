import test from "node:test";
import assert from "node:assert/strict";
import worker, {
  createStripeParameters,
  isAllowedOrigin,
  validateCart,
  verifyStripeSignature
} from "../src/index.js";

async function stripeSignature(payload, secret, timestamp) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`)
  );
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

test("allows configured site origins and local development", () => {
  const configured = "https://chemicalcomputerclub.com, https://briobb.github.io";
  assert.equal(isAllowedOrigin("https://chemicalcomputerclub.com", configured), true);
  assert.equal(isAllowedOrigin("https://briobb.github.io", configured), true);
  assert.equal(isAllowedOrigin("http://localhost:8080", configured), true);
  assert.equal(isAllowedOrigin("https://example.com", configured), false);
});

test("validates a cart with product variations", () => {
  const items = validateCart([
    { productId: "logo-t", variant: "M", quantity: 2 },
    { productId: "sox", variant: "L", color: "Orange", quantity: 1 },
    { productId: "mug", quantity: 1 }
  ]);
  assert.equal(items[0].unitAmount, 4400);
  assert.equal(items[1].name, "CCC Sox — Orange / L");
  assert.equal(items[2].unitAmount, 2200);
});

test("rejects a client-side price and invalid variation implicitly", () => {
  assert.throws(
    () => validateCart([{ productId: "sox", variant: "XL", color: "Ivory", quantity: 1, price: 1 }]),
    /サイズが正しくありません/
  );
});

test("builds Stripe Checkout line item parameters", () => {
  const items = validateCart([{ productId: "bag", quantity: 2 }]);
  const params = createStripeParameters(items, "https://example.com");
  assert.equal(params.get("line_items[0][price_data][unit_amount]"), "2200");
  assert.equal(params.get("line_items[0][quantity]"), "2");
  assert.equal(
    params.get("success_url"),
    "https://example.com/cloudflare-test/thank-you.html?session_id={CHECKOUT_SESSION_ID}"
  );
});

test("verifies a current Stripe webhook signature", async () => {
  const payload = JSON.stringify({ id: "evt_test", type: "checkout.session.completed" });
  const secret = "whsec_test_secret";
  const timestamp = 1_800_000_000;
  const signature = await stripeSignature(payload, secret, timestamp);

  assert.equal(
    await verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, timestamp),
    true
  );
  assert.equal(
    await verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, "wrong-secret", timestamp),
    false
  );
  assert.equal(
    await verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, timestamp + 301),
    false
  );
});

test("accepts a signed checkout completion webhook", async () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = "whsec_test_secret";
  const payload = JSON.stringify({
    id: "evt_test",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_123", payment_status: "paid" } }
  });
  const signature = await stripeSignature(payload, secret, timestamp);
  const request = new Request("https://worker.example/stripe-webhook", {
    method: "POST",
    headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
    body: payload
  });
  const response = await worker.fetch(request, { STRIPE_WEBHOOK_SECRET: secret });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true });
});
