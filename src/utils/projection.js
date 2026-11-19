// Unified Albers Equal-Area Conic Projection for China (Standard Cartographic Parameters)
// Central Meridian: 104.0°E, Origin Latitude: 35.2°N, Standard Parallels: 25°N & 47°N
// World Slab Dimensions: X in [-45, +45] (W = 90), Z in [-36, +36] (H = 72)

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export const PROJ_CONFIG = {
  lon0: 104.0 * DEG,
  lat0: 35.2 * DEG,
  phi1: 25.0 * DEG,
  phi2: 47.0 * DEG,
  scale: 92.0,
  worldWidth: 90.0,
  worldHeight: 72.0,
  minElev: -6000.0,
  maxElev: 9000.0,
};

const n = 0.5 * (Math.sin(PROJ_CONFIG.phi1) + Math.sin(PROJ_CONFIG.phi2));
const C = Math.cos(PROJ_CONFIG.phi1) ** 2 + 2 * n * Math.sin(PROJ_CONFIG.phi1);
const rho = (latRad) => Math.sqrt(Math.max(0, C - 2 * n * Math.sin(latRad))) / n;
const rho0 = rho(PROJ_CONFIG.lat0);

/**
 * Forward Albers projection: (lonDeg, latDeg) -> [x, z] in Three.js world space (-z is North)
 */
export function projectLonLat(lonDeg, latDeg) {
  const lon = lonDeg * DEG;
  const lat = latDeg * DEG;
  const r = rho(lat);
  const theta = n * (lon - PROJ_CONFIG.lon0);
  const x = PROJ_CONFIG.scale * r * Math.sin(theta);
  const z = -PROJ_CONFIG.scale * (rho0 - r * Math.cos(theta));
  return [x, z];
}

/**
 * Inverse Albers projection: (x, z) in Three.js world space -> [lonDeg, latDeg]
 */
export function unprojectXZ(x, z) {
  const rx = x / PROJ_CONFIG.scale;
  const ry = rho0 + z / PROJ_CONFIG.scale;
  const r = Math.hypot(rx, ry);
  const theta = Math.atan2(rx, ry);
  const sinLat = (C - (r * n) ** 2) / (2 * n);
  const latDeg = Math.asin(Math.max(-1, Math.min(1, sinLat))) * RAD;
  const lonDeg = (PROJ_CONFIG.lon0 + theta / n) * RAD;
  return [lonDeg, latDeg];
}

/**
 * World (x, z) <-> Normalized UV [0, 1] (u: West->East, v: North->South image row order)
 */
export function xzToUV(x, z) {
  const u = (x + PROJ_CONFIG.worldWidth * 0.5) / PROJ_CONFIG.worldWidth;
  const v = (z + PROJ_CONFIG.worldHeight * 0.5) / PROJ_CONFIG.worldHeight;
  return [u, v];
}

export function uvToXZ(u, v) {
  const x = (u - 0.5) * PROJ_CONFIG.worldWidth;
  const z = (v - 0.5) * PROJ_CONFIG.worldHeight;
  return [x, z];
}

/**
 * Convert real-world elevation (meters) to Three.js Y vertical displacement
 * Uses artistic non-linear hypsometric exaggeration so plains/hills (50-1500m) have rich sculpted relief
 * while Himalayas/Tibet (4500-8848m) tower dramatically without clipping the camera!
 */
export function elevMetersToWorldY(elevMeters, exaggeration = 1.0) {
  if (elevMeters <= 0) {
    // Subtle ocean trench depression under water surface (water sits at y = 0.0)
    const depthNorm = Math.min(1.0, Math.abs(elevMeters) / 5500.0);
    return -Math.pow(depthNorm, 0.72) * 0.95 * exaggeration;
  }
  // Smooth power curve: 500m -> 0.48, 1500m -> 1.15, 4500m -> 2.78, 8848m -> 4.85
  const hKm = elevMeters / 1000.0;
  return Math.pow(hKm, 0.78) * 0.88 * exaggeration;
}
