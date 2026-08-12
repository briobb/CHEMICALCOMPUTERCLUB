import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";

const env = {
  ALLOWED_ORIGIN: "https://chemicalcomputerclub.com",
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
  LINE_USER_ID: "U00000000000000000000000000000000"
};

function request(body, origin = env.ALLOWED_ORIGIN) {
  return new Request("https://jukebox-api.chemicalcomputerclub.com/request", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": origin },
    body: JSON.stringify(body)
  });
}

test("allows preflight only from the CCC site", async () => {
  const allowed = await worker.fetch(new Request(
    "https://jukebox-api.chemicalcomputerclub.com/request",
    { method: "OPTIONS", headers: { Origin: env.ALLOWED_ORIGIN } }
  ), env);
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), env.ALLOWED_ORIGIN);

  const denied = await worker.fetch(new Request(
    "https://jukebox-api.chemicalcomputerclub.com/request",
    { method: "OPTIONS", headers: { Origin: "https://example.com" } }
  ), env);
  assert.equal(denied.status, 403);
});

test("rejects requests from other sites", async () => {
  const response = await worker.fetch(request(
    { song: "September", artist: "Earth, Wind & Fire" },
    "https://example.com"
  ), env);
  assert.equal(response.status, 403);
});

test("requires song and artist", async () => {
  const response = await worker.fetch(request({ song: "", artist: "ABBA" }), env);
  assert.equal(response.status, 400);
});

test("sends one LINE push to the configured DJ and defaults to Guest", async (t) => {
  let outbound;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    outbound = { url, init };
    return new Response("{}", { status: 200 });
  });

  const response = await worker.fetch(request({
    song: "September",
    artist: "Earth, Wind & Fire",
    name: "",
    message: "Please play this next!"
  }), env);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(outbound.url, "https://api.line.me/v2/bot/message/push");
  const payload = JSON.parse(outbound.init.body);
  assert.equal(payload.to, env.LINE_USER_ID);
  assert.equal(payload.messages.length, 1);
  assert.match(payload.messages[0].text, /From: Guest/);
  assert.match(payload.messages[0].text, /Message: Please play this next!/);
});

test("omits the optional message line when it is empty", async (t) => {
  let outbound;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    outbound = { url, init };
    return new Response("{}", { status: 200 });
  });

  const response = await worker.fetch(request({
    song: "Dancing Queen",
    artist: "ABBA",
    name: "Yuki",
    message: ""
  }), env);

  assert.equal(response.status, 200);
  const payload = JSON.parse(outbound.init.body);
  assert.doesNotMatch(payload.messages[0].text, /Message:/);
});

test("does not expose LINE API errors", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("bad token", { status: 401 }));
  const response = await worker.fetch(request({ song: "Take On Me", artist: "a-ha" }), env);
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { success: false, message: "Failed to send request." });
});
