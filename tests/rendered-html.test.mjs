import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the lyricstapper workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>lyricstapper<\/title>/i);
  assert.match(html, /Media &amp; lyrics/i);
  assert.match(html, /Source/i);
  assert.match(html, /Captions/i);
  assert.match(html, /Style/i);
  assert.match(html, /Export/i);
  assert.match(html, /Choose audio or video/i);
  assert.doesNotMatch(html, /Local only|Manual lyric timing|Your media stays on this device/i);
  assert.doesNotMatch(html, /Beatmark|codex-preview|Building your site/i);
});
