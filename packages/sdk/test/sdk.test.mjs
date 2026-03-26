import assert from "node:assert/strict";
import test from "node:test";
import {
  SdkError,
  buildLiveUrl,
  createStream,
  deleteStream,
  getStream,
  listStreams
} from "../dist/index.js";

test("buildLiveUrl should format expected flv endpoint", () => {
  const url = buildLiveUrl("http://localhost:3000/", "st_demo");
  assert.equal(url, "http://localhost:3000/v1/live/st_demo.flv");
});

test("createStream should POST and return parsed payload", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "http://localhost:3000/v1/streams");
    assert.equal(init?.method, "POST");
    return new Response(
      JSON.stringify({
        streamId: "st_1",
        state: "idle",
        playUrl: "http://localhost:3000/v1/live/st_1.flv",
        reused: false,
        createdAt: "2026-03-26T00:00:00.000Z"
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  try {
    const result = await createStream("http://localhost:3000", {
      url: "rtsp://example/live"
    });
    assert.equal(result.streamId, "st_1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("get/list/delete should hit expected paths", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ input: String(input), method: init?.method ?? "GET" });
    if (String(input).endsWith("/v1/streams/st_x")) {
      return new Response(
        JSON.stringify({
          streamId: "st_x",
          state: "idle",
          viewerCount: 0,
          createdAt: "2026-03-26T00:00:00.000Z",
          config: {
            transport: "tcp",
            video: {
              mode: "auto",
              forceCodec: "h264",
              width: 0,
              height: 0,
              fps: 0,
              bitrateKbps: 0,
              gop: 0
            },
            audio: { enabled: false, mode: "drop", codec: "aac", bitrateKbps: 0 }
          },
          stats: {
            bytesOut: 0,
            startAttempts: 0
          }
        }),
        { status: 200 }
      );
    }
    if (String(input).endsWith("/v1/streams")) {
      return new Response("[]", { status: 200 });
    }
    return new Response("", { status: 204 });
  };

  try {
    await getStream("http://localhost:3000", "st_x");
    await listStreams("http://localhost:3000");
    await deleteStream("http://localhost:3000", "st_x");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(calls, [
    { input: "http://localhost:3000/v1/streams/st_x", method: "GET" },
    { input: "http://localhost:3000/v1/streams", method: "GET" },
    { input: "http://localhost:3000/v1/streams/st_x", method: "DELETE" }
  ]);
});

test("failed response should throw SdkError", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ code: "INVALID_ARGUMENT", message: "bad request" }), {
      status: 400
    });

  try {
    await assert.rejects(
      () => createStream("http://localhost:3000", { url: "rtsp://bad" }),
      (error) => {
        assert.ok(error instanceof SdkError);
        assert.equal(error.status, 400);
        assert.equal(error.code, "INVALID_ARGUMENT");
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

