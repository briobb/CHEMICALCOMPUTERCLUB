import test from "node:test";
import assert from "node:assert/strict";
import { createStripeParameters, isAllowedOrigin, validateCart } from "../src/index.js";

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
  assert.match(params.get("success_url"), /checkout=success/);
});
