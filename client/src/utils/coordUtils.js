/**
 * Coordinate Utility — Degrees ↔ Cartesian (3D Sphere)
 *
 * Coordinate system (0–360° for both axes):
 *   x_deg → azimuth  (0–360°, horizontal pan, maps to spherical phi)
 *   y_deg → polar    (0–360°, vertical tilt, maps to spherical theta)
 *            0°   = north pole (top of sphere)
 *            90°  = upper equator / eye level
 *            180° = south pole (floor)
 *            270° = mirror of 90° (rarely used, wraps back)
 *
 * Three.js uses a left-handed coordinate system inside an inverted sphere
 * (side: BackSide), so we negate X and Z to match the "inside-out" view.
 *
 * Sphere radius R = 50 (matching the SphereGeometry args).
 */

const R = 50;

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/**
 * Convert degree coordinates to Three.js Cartesian position.
 *
 * @param {number} x_deg  Horizontal angle 0–360°
 * @param {number} y_deg  Vertical angle   0–360°
 * @param {number} [radius=R]
 * @returns {{ x: number, y: number, z: number }}
 */
export function degToCartesian(x_deg, y_deg, radius = R) {
  const phi   = toRad(x_deg);        // azimuth  (0 → 2π)
  const theta = toRad(y_deg);        // polar    (0 → 2π, meaningful: 0 → π)

  // Standard spherical → cartesian, negated for inside-of-sphere view
  const x = -radius * Math.sin(theta) * Math.cos(phi);
  const y =  radius * Math.cos(theta);
  const z = -radius * Math.sin(theta) * Math.sin(phi);

  return { x, y, z };
}

/**
 * Convert a Three.js Cartesian point on the sphere back to degree coordinates.
 * Used by the Admin raycaster to capture click positions.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} [radius=R]
 * @returns {{ x_deg: number, y_deg: number }}
 */
export function cartesianToDeg(x, y, z, radius = R) {
  // Undo the negation applied in degToCartesian
  const nx = -x;
  const ny =  y;
  const nz = -z;

  // Polar angle θ ∈ [0, π]
  const theta = Math.acos(Math.max(-1, Math.min(1, ny / radius)));

  // Azimuth φ ∈ [-π, π] → normalised to [0, 360)
  const phi = Math.atan2(nz, nx);

  const y_deg = toDeg(theta);                          // 0–180
  let   x_deg = toDeg(phi);
  if (x_deg < 0) x_deg += 360;                        // 0–360

  return {
    x_deg: parseFloat(x_deg.toFixed(2)),
    y_deg: parseFloat(y_deg.toFixed(2)),
  };
}

/**
 * Convert degToCartesian result to an array [x, y, z] for use in
 * @react-three/fiber <mesh position={...}> props.
 *
 * @param {number} x_deg
 * @param {number} y_deg
 * @param {number} [radius=R]
 * @returns {[number, number, number]}
 */
export function degToPosition(x_deg, y_deg, radius = R) {
  const { x, y, z } = degToCartesian(x_deg, y_deg, radius);
  return [x, y, z];
}
