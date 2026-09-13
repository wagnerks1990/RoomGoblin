"use strict";

// Keep the deadline active through body consumption, not just HTTP headers.
async function bufferedVeyonFetch(url, options = {}, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 7000);
  const maxBytes = options.maxBytes || 16 * 1024 * 1024;
  try {
    const response = await fetchImpl(url, {
      method: options.method || "GET", headers: options.headers || {},
      body: options.body, signal: controller.signal, redirect: "error"
    });
    if (Number(response.headers.get("content-length")) > maxBytes) throw new Error("Veyon response exceeds size limit");
    const chunks = []; let size = 0;
    if (response.body) {
      for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > maxBytes) throw new Error("Veyon response exceeds size limit");
        chunks.push(Buffer.from(chunk));
      }
    }
    return new Response([204, 205, 304].includes(response.status) ? null : Buffer.concat(chunks), {
      status: response.status, statusText: response.statusText, headers: response.headers
    });
  } finally {
    controller.abort();
    clearTimeout(timeout);
  }
}

async function veyonResponseError(response) {
  let body;
  try { body = await response.json(); } catch { body = {}; }
  const code = Number(body?.error?.code);
  const messages = {
    2: "Veyon connection expired. Retry the preview.",
    4: "Veyon credentials are invalid. Check the configured authentication key.",
    6: "Veyon authentication failed. Check the endpoint key and access policy.",
    7: "Veyon connection limit reached. Retry shortly or reduce preview concurrency.",
    8: "Veyon connection timed out. Check the endpoint connection.",
    9: "Veyon cannot encode the requested image format.",
    10: "Screen preview is not available yet. Check the endpoint session and retry.",
    11: "Veyon could not encode the screen preview."
  };
  const error = new Error(messages[code] || `Veyon request failed (HTTP ${response.status}).`);
  error.status = response.status; error.veyonCode = code;
  return error;
}

function framebufferType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return "image/jpeg";
  throw new Error("Veyon returned an invalid screen image.");
}

async function readVeyonFrame(query, request, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  const params = new URLSearchParams(query);
  // A new VNC connection may authenticate before its first framebuffer arrives.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await request(`/api/v1/framebuffer?${params}`);
      if (!response.ok) throw await veyonResponseError(response);
      const buffer = Buffer.from(await response.arrayBuffer());
      return {buffer, contentType: framebufferType(buffer)};
    } catch (error) {
      if (attempt === 2) throw error;
      if (error.veyonCode === 9 && params.get("format") !== "png") {
        params.set("format", "png"); params.delete("quality");
      } else if (error.veyonCode === 10) {
        await wait(200 * (attempt + 1));
      } else throw error;
    }
  }
}

module.exports = {bufferedVeyonFetch, veyonResponseError, framebufferType, readVeyonFrame};
