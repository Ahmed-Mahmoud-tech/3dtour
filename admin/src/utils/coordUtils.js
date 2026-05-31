// Shared coord utils — identical to client/src/utils/coordUtils.js
const R = 50;
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

export function degToCartesian(x_deg, y_deg, radius = R) {
  const phi   = toRad(x_deg);
  const theta = toRad(y_deg);
  return {
    x: -radius * Math.sin(theta) * Math.cos(phi),
    y:  radius * Math.cos(theta),
    z: -radius * Math.sin(theta) * Math.sin(phi),
  };
}

export function cartesianToDeg(x, y, z, radius = R) {
  const theta = Math.acos(Math.max(-1, Math.min(1, y / radius)));
  const phi   = Math.atan2(-z, -x);
  const y_deg = toDeg(theta);
  let   x_deg = toDeg(phi);
  if (x_deg < 0) x_deg += 360;
  return {
    x_deg: parseFloat(x_deg.toFixed(2)),
    y_deg: parseFloat(y_deg.toFixed(2)),
  };
}

export function degToPosition(x_deg, y_deg, radius = R) {
  const { x, y, z } = degToCartesian(x_deg, y_deg, radius);
  return [x, y, z];
}
