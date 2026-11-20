// Pure presentation math; no game state or pointer authority lives here.
const presets = Object.freeze({ angled: 58, overhead: 88, player: 38 });
const finite = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export function cameraView(previous = {}, patch = {}) {
  const preset = Object.hasOwn(presets, patch?.preset) ? patch.preset : Object.hasOwn(presets, previous?.preset) ? previous.preset : 'angled';
  const reset = Object.hasOwn(presets, patch?.preset);
  return {
    preset,
    orbit: clamp(finite(patch?.orbit, reset ? 0 : finite(previous?.orbit, 0)), -180, 180),
    tilt: clamp(finite(patch?.tilt, reset ? presets[preset] : finite(previous?.tilt, presets[preset])), 25, 88),
    zoom: clamp(finite(patch?.zoom, reset ? 1 : finite(previous?.zoom, 1)), 0.7, 1.6)
  };
}

export function cameraPose(view, side = 'white', aspect = 1, fov = 39) {
  const v = cameraView({}, view), yaw = (v.orbit + (side === 'black' ? 180 : 0)) * Math.PI / 180, elevation = v.tilt * Math.PI / 180;
  const direction = { x: Math.sin(yaw) * Math.cos(elevation), y: Math.sin(elevation), z: Math.cos(yaw) * Math.cos(elevation) };
  const right = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
  const up = { x: -Math.sin(elevation) * Math.sin(yaw), y: Math.cos(elevation), z: -Math.sin(elevation) * Math.cos(yaw) };
  const target = { x: 0, y: 0.15, z: 0 }, vertical = Math.tan(clamp(finite(fov, 39), 20, 80) * Math.PI / 360), horizontal = vertical * clamp(finite(aspect, 1), 0.3, 4);
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  // Fit the board and tall royals, not the distant decorative columns. Recompute
  // for aspect changes; deliberate zoom-in may crop, Reset always restores fit.
  let distance = 0;
  for (const x of [-4.4, 4.4]) for (const z of [-4.4, 4.4]) for (const y of [-0.45, 2.15]) {
    const p = { x, y: y - target.y, z }, depth = dot(p, direction);
    distance = Math.max(distance, depth + Math.abs(dot(p, right)) / horizontal, depth + Math.abs(dot(p, up)) / vertical);
  }
  distance = Math.max(7.5, distance * 1.06 / v.zoom);
  return { position: { x: direction.x * distance, y: target.y + direction.y * distance, z: direction.z * distance }, target };
}
