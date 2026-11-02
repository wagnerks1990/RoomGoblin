"use strict";

const actions = new Set(["play", "pause", "stop", "restart", "seek", "volume", "mute", "rate"]);

function finiteControl(value, name, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw Error(`${name} must be a finite number`);
  return Math.max(min, Math.min(max, number));
}

function validate(input = {}) {
  const action = String(input?.action || "").trim().toLowerCase();
  if (!actions.has(action)) throw Error("Unsupported media control action");
  const payload = {action};
  if (action === "seek") payload.positionSeconds = finiteControl(input.positionSeconds ?? 0, "Position", 0, Number.MAX_SAFE_INTEGER);
  if (action === "volume") payload.volume = finiteControl(input.volume ?? 1, "Volume", 0, 1);
  if (action === "mute") payload.muted = input.muted !== false;
  if (action === "rate") payload.playbackRate = finiteControl(input.playbackRate ?? 1, "Playback rate", .25, 4);
  return payload;
}

// The receiver owns playback position and pause/play operations. Save only
// settings here; a reconnect snapshot must not replay a seek or restart.
function applySettings(media, payload) {
  if (media?.type !== "video") return null;
  if (payload.action === "volume") return {...media, volume: payload.volume, ...(payload.volume > 0 ? {muted: false} : {})};
  if (payload.action === "mute") return {...media, muted: payload.muted};
  if (payload.action === "rate") return {...media, playbackRate: payload.playbackRate};
  return null;
}

module.exports = {validate, applySettings};
