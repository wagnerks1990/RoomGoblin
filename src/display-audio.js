"use strict";
const crypto = require("node:crypto");

function sources(state = {}) {
  state ||= {};
  const rows = [];
  if (["video", "web"].includes(state.media?.type)) rows.push({kind: state.media.type, value: state.media});
  for (const scene of [state.textOptions?.scene, ...(state.layers || []).filter(row => Number(row.expiresAt) > Date.now()).map(row => row.scene)]) {
    for (const layer of scene?.layers || []) {
      if (layer.type === "widget" && layer.widget === "sports-board" && layer.visible !== false) rows.push({kind: "sports", value: layer});
    }
  }
  return rows;
}

function describe(state) {
  const rows = sources(state);
  const settings = rows.map(({kind, value}) => ({
    volume: Number(kind === "sports" ? value.sportsVolume ?? 1 : value.volume ?? 1),
    muted: kind === "sports" ? value.sportsAudio !== true : value.muted === true
  }));
  // Return only an opaque content identity, never media URLs or scene contents.
  const identity = rows.map(({kind, value}) => kind === "sports"
    ? [kind, value.id, value.sportsBoardId] : [kind, value.sessionId, value.url]);
  return {available: rows.length > 0, kinds: [...new Set(rows.map(row => row.kind))],
    boardIds: [...new Set(rows.filter(row => row.kind === "sports").map(row => row.value.sportsBoardId))],
    contentKey: crypto.createHash("sha256").update(JSON.stringify([state?.audioContentId, identity])).digest("hex"),
    volume: settings[0]?.volume ?? 1, muted: settings[0]?.muted ?? true,
    mixed: settings.some(value => value.volume !== settings[0].volume || value.muted !== settings[0].muted),
    audible: settings.some(value => !value.muted && value.volume > 0)};
}

function validate(input = {}) {
  const payload = {};
  if (input.volume !== undefined) {
    if (typeof input.volume !== "number" || !Number.isFinite(input.volume) || input.volume < 0 || input.volume > 1) throw Error("Volume must be a number from 0 to 1");
    payload.volume = input.volume;
  }
  if (input.muted !== undefined) {
    if (typeof input.muted !== "boolean") throw Error("Muted must be true or false");
    payload.muted = input.muted;
  }
  if (!Object.keys(payload).length) throw Error("Choose volume or mute");
  if (input.contentKey !== undefined) {
    if (typeof input.contentKey !== "string" || !/^[a-f0-9]{64}$/.test(input.contentKey)) throw Error("Invalid audio content identity");
    payload.contentKey = input.contentKey;
  }
  return payload;
}

function apply(state, payload) {
  const next = structuredClone(state || {});
  for (const {kind, value} of sources(next)) {
    if (payload.volume !== undefined) value[kind === "sports" ? "sportsVolume" : "volume"] = payload.volume;
    if (payload.muted !== undefined) {
      value[kind === "sports" ? "sportsAudio" : "muted"] = kind === "sports" ? !payload.muted : payload.muted;
      if (kind === "web") value.forceAudio = !payload.muted;
    }
  }
  return next;
}

module.exports = {describe, validate, apply};
