import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import {
  DEG,
  PROJ_CONFIG,
  projectLonLat,
  unprojectXZ,
  xzToUV,
  uvToXZ,
  elevMetersToWorldY,
} from '../src/utils/projection.js';
import {
  PROVINCE_CATALOG,
  MOUNTAIN_RANGES,
  RIVER_SYSTEMS,
  MAJOR_LAKES,
  CLIMATIC_DIVIDES,
} from './geography-catalog.mjs';

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, '.cache', 'terrarium');
const OUT_DIR = path.join(ROOT, 'public', 'assets');
fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const W = 1600;
const H = 1280;
const ZOOM = 6; // 64x64 tiles globally (~2.4km equatorial pixel resolution)
const N_TILES = 1 << ZOOM;

// Web Mercator lon/lat -> fractional tile coordinates
function lonLatToTileXY(lonDeg, latDeg) {
  const x = ((lonDeg + 180.0) / 360.0) * N_TILES;
  const latRad = Math.max(-85.0, Math.min(85.0, latDeg)) * DEG;
  const y =
    ((1.0 - Math.log(Math.tan(latRad) + 1.0 / Math.cos(latRad)) / Math.PI) * 0.5) *
    N_TILES;
  return [x, y];
}

async function fetchTile(tx, ty) {
  const file = path.join(CACHE_DIR, `${ZOOM}_${tx}_${ty}.png`);
  if (fs.existsSync(file) && fs.statSync(file).size > 100) {
    return PNG.sync.read(fs.readFileSync(file));
  }
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ZOOM}/${tx}/${ty}.png`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(file, buf);
      return PNG.sync.read(buf);
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
}

async function loadTerrariumGrid() {
  const txMin = 41, txMax = 59;
  const tyMin = 17, tyMax = 31;
  const jobs = [];
  for (let ty = tyMin; ty <= tyMax; ty++) {
    for (let tx = txMin; tx <= txMax; tx++) {
      jobs.push([tx, ty]);
    }
  }
  console.log(`Downloading/loading ${jobs.length} AWS SRTM/ETOPO Terrarium tiles (zoom ${ZOOM})...`);
  const tileMap = new Map();
  let idx = 0;
  const concurrency = 18;
  async function worker() {
    while (idx < jobs.length) {
      const [tx, ty] = jobs[idx++];
      const png = await fetchTile(tx, ty);
      tileMap.set(`${tx}_${ty}`, png.data);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log('All DEM tiles ready.');

  function sampleTilePixel(tx, ty, px, py) {
    // Handle overflow across tile seams cleanly
    tx += Math.floor(px / 256);
    ty += Math.floor(py / 256);
    px = ((px % 256) + 256) % 256;
    py = ((py % 256) + 256) % 256;
    const data = tileMap.get(`${tx}_${ty}`);
    if (!data) return 0;
    const off = (py * 256 + px) * 4;
    return data[off] * 256 + data[off + 1] + data[off + 2] / 256 - 32768;
  }

  return function sampleElevationLonLat(lonDeg, latDeg) {
    const [fx, fy] = lonLatToTileXY(lonDeg, latDeg);
    const tx = Math.floor(fx);
    const ty = Math.floor(fy);
    const lx = (fx - tx) * 256 - 0.5;
    const ly = (fy - ty) * 256 - 0.5;
    const x0 = Math.floor(lx);
    const y0 = Math.floor(ly);
    const txFrac = lx - x0;
    const tyFrac = ly - y0;

    const e00 = sampleTilePixel(tx, ty, x0, y0);
    const e10 = sampleTilePixel(tx, ty, x0 + 1, y0);
    const e01 = sampleTilePixel(tx, ty, x0, y0 + 1);
    const e11 = sampleTilePixel(tx, ty, x0 + 1, y0 + 1);

    const top = e00 * (1 - txFrac) + e10 * txFrac;
    const bot = e01 * (1 - txFrac) + e11 * txFrac;
    return top * (1 - tyFrac) + bot * tyFrac;
  };
}

// Scanline rasterizer for projected polygon rings onto Uint8Array(W * H)
function rasterizePolygonRing(ringUV, grid, value, xorMask = null) {
  let minY = H - 1, maxY = 0;
  for (let i = 0; i < ringUV.length; i++) {
    const py = ringUV[i][1] * H;
    if (py < minY) minY = Math.max(0, Math.floor(py));
    if (py > maxY) maxY = Math.min(H - 1, Math.ceil(py));
  }
  const xIntersections = [];
  for (let row = minY; row <= maxY; row++) {
    const y = row + 0.5;
    xIntersections.length = 0;
    for (let i = 0, j = ringUV.length - 1; i < ringUV.length; j = i++) {
      const x1 = ringUV[i][0] * W, y1 = ringUV[i][1] * H;
      const x2 = ringUV[j][0] * W, y2 = ringUV[j][1] * H;
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        const t = (y - y1) / (y2 - y1);
        xIntersections.push(x1 + t * (x2 - x1));
      }
    }
    xIntersections.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xIntersections.length; k += 2) {
      const cStart = Math.max(0, Math.ceil(xIntersections[k] - 0.5));
      const cEnd = Math.min(W - 1, Math.floor(xIntersections[k + 1] - 0.5));
      const rowOff = row * W;
      for (let col = cStart; col <= cEnd; col++) {
        if (xorMask) {
          xorMask[rowOff + col] ^= 1;
        } else {
          grid[rowOff + col] = value;
        }
      }
    }
  }
}

function drawAntiAliasedPolyline(uvPoints, floatGrid, radiusPx, strength = 1.0) {
  const rCeil = Math.ceil(radiusPx + 1.0);
  for (let i = 0; i + 1 < uvPoints.length; i++) {
    const x0 = uvPoints[i][0] * W, y0 = uvPoints[i][1] * H;
    const x1 = uvPoints[i + 1][0] * W, y1 = uvPoints[i + 1][1] * H;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1) - rCeil));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + rCeil));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1) - rCeil));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + rCeil));
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1e-6;
    for (let py = minY; py <= maxY; py++) {
      const cy = py + 0.5;
      const rowOff = py * W;
      for (let px = minX; px <= maxX; px++) {
        const cx = px + 0.5;
        const t = Math.max(0, Math.min(1, ((cx - x0) * dx + (cy - y0) * dy) / len2));
        const dist = Math.hypot(cx - (x0 + t * dx), cy - (y0 + t * dy));
        if (dist <= radiusPx + 1.0) {
          const val = Math.max(0, Math.min(1, 1.0 - Math.max(0, dist - (radiusPx - 0.6)) / 1.6)) * strength;
          if (val > floatGrid[rowOff + px]) floatGrid[rowOff + px] = val;
        }
      }
    }
  }
}

// Fast 2-pass Chamfer Euclidean-approximate distance transform (in pixels)
function computeDistanceField(seedMask) {
  const INF = 1e6;
  const dist = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) dist[i] = seedMask[i] ? 0 : INF;
  const d1 = 1.0, d2 = 1.41421356;
  for (let y = 0; y < H; y++) {
    const off = y * W;
    for (let x = 0; x < W; x++) {
      let best = dist[off + x];
      if (x > 0) best = Math.min(best, dist[off + x - 1] + d1);
      if (y > 0) {
        best = Math.min(best, dist[off - W + x] + d1);
        if (x > 0) best = Math.min(best, dist[off - W + x - 1] + d2);
        if (x + 1 < W) best = Math.min(best, dist[off - W + x + 1] + d2);
      }
      dist[off + x] = best;
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    const off = y * W;
    for (let x = W - 1; x >= 0; x--) {
      let best = dist[off + x];
      if (x + 1 < W) best = Math.min(best, dist[off + x + 1] + d1);
      if (y + 1 < H) {
        best = Math.min(best, dist[off + W + x] + d1);
        if (x + 1 < W) best = Math.min(best, dist[off + W + x + 1] + d2);
        if (x > 0) best = Math.min(best, dist[off + W + x - 1] + d2);
      }
      dist[off + x] = best;
    }
  }
  return dist;
}

function simplifyRing(ring, tolerance = 0.08) {
  if (ring.length <= 6) return ring;
  const out = [ring[0]];
  let last = ring[0];
  for (let i = 1; i < ring.length - 1; i++) {
    if (Math.hypot(ring[i][0] - last[0], ring[i][1] - last[1]) >= tolerance) {
      out.push(ring[i]);
      last = ring[i];
    }
  }
  out.push(ring[ring.length - 1]);
  return out;
}

function catmullRomSubdivide(pts, subdivisions = 4) {
  if (pts.length < 3) return pts;
  const res = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < subdivisions; s++) {
      const t = s / subdivisions;
      const t2 = t * t, t3 = t2 * t;
      const x = 0.5 * (
        2 * p1[0] +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
      );
      const y = 0.5 * (
        2 * p1[1] +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
      );
      res.push([x, y]);
    }
  }
  res.push(pts[pts.length - 1]);
  return res;
}

async function main() {
  const sampleElevation = await loadTerrariumGrid();

  // 1. Sample 1600x1280 Albers DEM + lat/lon caches
  console.log('Sampling 1600x1280 Albers DEM...');
  const elevGrid = new Float32Array(W * H);
  const lonGrid = new Float32Array(W * H);
  const latGrid = new Float32Array(W * H);

  for (let py = 0; py < H; py++) {
    const v = (py + 0.5) / H;
    for (let px = 0; px < W; px++) {
      const u = (px + 0.5) / W;
      const [x, z] = uvToXZ(u, v);
      const [lon, lat] = unprojectXZ(x, z);
      const idx = py * W + px;
      lonGrid[idx] = lon;
      latGrid[idx] = lat;
      elevGrid[idx] = sampleElevation(lon, lat);
    }
  }

  // Despike SRTM radar-shadow void pixels (e.g. Namcha Barwa / Hengduan gorges) & apply gentle 2-pass smoothing
  console.log('Despiking SRTM radar voids & smoothing micro-aliasing...');
  const cleanGrid = new Float32Array(elevGrid);
  for (let pass = 0; pass < 2; pass++) {
    const src = pass === 0 ? elevGrid : cleanGrid;
    const dst = new Float32Array(src);
    const nb = [];
    for (let py = 1; py < H - 1; py++) {
      for (let px = 1; px < W - 1; px++) {
        const i = py * W + px;
        const v = src[i];
        nb.length = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nv = src[(py + dy) * W + (px + dx)];
            if (nv > -10500 && nv < 8860) nb.push(nv);
          }
        }
        if (nb.length >= 4) {
          nb.sort((a, b) => a - b);
          const med = nb[nb.length >> 1];
          if (v < -10500 || v > 8855 || Math.abs(v - med) > 1350) {
            dst[i] = med;
          }
        }
      }
    }
    cleanGrid.set(dst);
  }
  // Gentle 3x3 tent filter ([1,2,1] separable) so close-up 3D ridges look sculpted & natural, never spiky!
  const tempSmooth = new Float32Array(W * H);
  for (let py = 0; py < H; py++) {
    const off = py * W;
    for (let px = 0; px < W; px++) {
      const xm = Math.max(0, px - 1), xp = Math.min(W - 1, px + 1);
      tempSmooth[off + px] = 0.25 * cleanGrid[off + xm] + 0.5 * cleanGrid[off + px] + 0.25 * cleanGrid[off + xp];
    }
  }
  for (let py = 0; py < H; py++) {
    const ym = Math.max(0, py - 1), yp = Math.min(H - 1, py + 1);
    for (let px = 0; px < W; px++) {
      elevGrid[py * W + px] =
        0.25 * tempSmooth[ym * W + px] + 0.5 * tempSmooth[py * W + px] + 0.25 * tempSmooth[yp * W + px];
    }
  }

  function sampleElevAtXZ(x, z) {
    const [u, v] = xzToUV(x, z);
    const fx = Math.max(0, Math.min(W - 1.001, u * W - 0.5));
    const fy = Math.max(0, Math.min(H - 1.001, v * H - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const e00 = elevGrid[y0 * W + x0];
    const e10 = elevGrid[y0 * W + x0 + 1];
    const e01 = elevGrid[(y0 + 1) * W + x0];
    const e11 = elevGrid[(y0 + 1) * W + x0 + 1];
    return (e00 * (1 - tx) + e10 * tx) * (1 - ty) + (e01 * (1 - tx) + e11 * tx) * ty;
  }

  // 2. Rasterize China 34 Provinces + South China Sea GeoJSON
  console.log('Rasterizing 34 provincial administrative regions & borders...');
  const chinaGeo = JSON.parse(fs.readFileSync(path.join(ROOT, 'china_full.json'), 'utf8'));
  const provinceIdGrid = new Uint8Array(W * H);
  const xorScratch = new Uint8Array(W * H);

  const adcodeToIndex = new Map();
  PROVINCE_CATALOG.forEach((p, idx) => adcodeToIndex.set(p.adcode, idx + 1)); // 1..34

  const provincesOut = [];
  const scsRawPolys = [];
  const tenDashLinesXZ = [];
  const tenDashRaw = [];

  for (const feat of chinaGeo.features) {
    const adcode = feat.properties.adcode;
    if (adcode === '100000_JD') {
      const gType = feat.geometry.type;
      const lines =
        gType === 'LineString'
          ? [feat.geometry.coordinates]
          : gType === 'MultiLineString' || gType === 'Polygon'
          ? feat.geometry.coordinates
          : feat.geometry.coordinates.flat(1); // MultiPolygon -> array of rings
      for (const line of lines) {
        if (!Array.isArray(line) || !Array.isArray(line[0]) || typeof line[0][0] !== 'number') continue;
        tenDashRaw.push(line.map(([lon, lat]) => [+Number(lon).toFixed(3), +Number(lat).toFixed(3)]));
        const clipped = line
          .filter(([lon, lat]) => lat >= 13.0 && lat <= 54.0 && lon >= 70.0 && lon <= 140.0)
          .map(([lon, lat]) => {
            const [x, z] = projectLonLat(lon, lat);
            return [+x.toFixed(2), +z.toFixed(2)];
          });
        if (clipped.length >= 2) tenDashLinesXZ.push(clipped);
      }
      continue;
    }

    const pIndex = adcodeToIndex.get(Number(adcode));
    if (!pIndex) continue;
    const meta = PROVINCE_CATALOG[pIndex - 1];

    xorScratch.fill(0);
    const polys = feat.geometry.type === 'Polygon' ? [feat.geometry.coordinates] : feat.geometry.coordinates;
    const simplifiedRingsXZ = [];

    for (const poly of polys) {
      // Save South China Sea / southern China raw polygons for inset map
      const outer = poly[0];
      if (outer.some(([lon, lat]) => lon >= 105 && lon <= 123 && lat >= 3 && lat <= 25.5)) {
        if (outer.length >= 4) {
          const step = Math.max(1, Math.floor(outer.length / 80));
          const slim = [];
          for (let k = 0; k < outer.length; k += step) {
            slim.push([+outer[k][0].toFixed(2), +outer[k][1].toFixed(2)]);
          }
          scsRawPolys.push(slim);
        }
      }

      for (let rIdx = 0; rIdx < poly.length; rIdx++) {
        const ring = poly[rIdx];
        // Skip tiny distant coral reefs below 13N for main 3D slab rasterization (handled in SCS inset & markers)
        const maxRingLat = ring.reduce((m, c) => Math.max(m, c[1]), -90);
        if (maxRingLat < 13.0) continue;

        const ringUV = [];
        const ringXZ = [];
        for (const [lon, lat] of ring) {
          const [x, z] = projectLonLat(lon, lat);
          ringUV.push(xzToUV(x, z));
          ringXZ.push([+x.toFixed(2), +z.toFixed(2)]);
        }
        rasterizePolygonRing(ringUV, provinceIdGrid, pIndex, xorScratch);

        if (rIdx === 0 && ringXZ.length >= 8) {
          const simp = simplifyRing(ringXZ, 0.16);
          if (simp.length >= 5) simplifiedRingsXZ.push(simp);
        }
      }
    }

    for (let i = 0; i < W * H; i++) {
      if (xorScratch[i]) provinceIdGrid[i] = pIndex;
    }

    // Ensure tiny SARs (Macau, Hong Kong) have at least a crisp footprint around their capital if sub-pixel
    const [capX, capZ] = projectLonLat(meta.capLonLat[0], meta.capLonLat[1]);
    const [capU, capV] = xzToUV(capX, capZ);
    const capPx = Math.round(capU * W), capPy = Math.round(capV * H);
    if (adcode === 810000 || adcode === 820000) {
      const rad = adcode === 810000 ? 3 : 2;
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (dx * dx + dy * dy <= rad * rad) {
            const xx = capPx + dx, yy = capPy + dy;
            if (xx >= 0 && xx < W && yy >= 0 && yy < H) provinceIdGrid[yy * W + xx] = pIndex;
          }
        }
      }
    }

    // Compute centroid & average elevation from rasterized pixels
    let sumX = 0, sumZ = 0, sumElev = 0, count = 0;
    let minX = 999, maxX = -999, minZ = 999, maxZ = -999;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const idx = py * W + px;
        if (provinceIdGrid[idx] === pIndex) {
          const [x, z] = uvToXZ((px + 0.5) / W, (py + 0.5) / H);
          sumX += x;
          sumZ += z;
          sumElev += Math.max(0, elevGrid[idx]);
          count++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (z < minZ) minZ = z;
          if (z > maxZ) maxZ = z;
        }
      }
    }
    const centroidXZ = count > 20 ? [+(sumX / count).toFixed(2), +(sumZ / count).toFixed(2)] : [+capX.toFixed(2), +capZ.toFixed(2)];
    const avgElev = count > 0 ? Math.round(sumElev / count) : Math.round(Math.max(2, sampleElevAtXZ(capX, capZ)));
    const capElev = Math.max(5, Math.round(sampleElevAtXZ(capX, capZ)));

    provincesOut.push({
      id: pIndex,
      adcode: Number(adcode),
      name: feat.properties.name,
      short: meta.short,
      abbr: meta.abbr,
      capital: meta.capital,
      capLonLat: meta.capLonLat,
      capXZ: [+capX.toFixed(2), +capZ.toFixed(2)],
      capY: +elevMetersToWorldY(capElev).toFixed(3),
      capElev,
      avgElev,
      centroidXZ,
      bboxXZ: count > 0 ? [+minX.toFixed(2), +minZ.toFixed(2), +maxX.toFixed(2), +maxZ.toFixed(2)] : [capX - 2, capZ - 2, capX + 2, capZ + 2],
      climate: meta.climate,
      janT: meta.janT,
      julT: meta.julT,
      precip: meta.precip,
      landform: meta.landform,
      rings: simplifiedRingsXZ.slice(0, 6), // largest rings for crisp 3D selection highlight
    });
  }
  provincesOut.sort((a, b) => a.id - b.id);

  // 3. True Ocean Flood-Fill (prevents inland depressions like Turpan -154m from becoming ocean!)
  console.log('Running true-ocean flood fill & border distance transforms...');
  const isOcean = new Uint8Array(W * H);
  const queue = new Int32Array(W * H);
  let qHead = 0, qTail = 0;

  // Seed ocean along East, South, and SE boundaries where elev <= 0 and not inside land province
  for (let py = 0; py < H; py++) {
    for (const px of [0, W - 1]) {
      const i = py * W + px;
      if (elevGrid[i] <= 0.5 && provinceIdGrid[i] === 0 && !isOcean[i]) {
        isOcean[i] = 1;
        queue[qTail++] = i;
      }
    }
  }
  for (let px = 0; px < W; px++) {
    for (const py of [0, H - 1]) {
      const i = py * W + px;
      if (elevGrid[i] <= 0.5 && provinceIdGrid[i] === 0 && !isOcean[i]) {
        isOcean[i] = 1;
        queue[qTail++] = i;
      }
    }
  }
  while (qHead < qTail) {
    const curr = queue[qHead++];
    const cx = curr % W, cy = (curr / W) | 0;
    const neighbors = [];
    if (cx > 0) neighbors.push(curr - 1);
    if (cx + 1 < W) neighbors.push(curr + 1);
    if (cy > 0) neighbors.push(curr - W);
    if (cy + 1 < H) neighbors.push(curr + W);
    for (const nb of neighbors) {
      if (!isOcean[nb] && elevGrid[nb] <= 1.0 && provinceIdGrid[nb] === 0) {
        isOcean[nb] = 1;
        queue[qTail++] = nb;
      }
    }
  }
  // Ensure any China land pixel has elev >= 1.5m (so coastal lowlands don't dip below ocean water plane)
  // Except Turpan Depression in Xinjiang (adcode 650000, id 31) which stays dry land even if elev < 0!
  for (let i = 0; i < W * H; i++) {
    if (!isOcean[i] && elevGrid[i] < 2.0) {
      // Keep gentle positive land height so ocean mesh at y=0 never clips inland basins!
      const lon = lonGrid[i], lat = latGrid[i];
      const inTurpan = lon > 87.5 && lon < 91.0 && lat > 41.8 && lat < 43.3;
      elevGrid[i] = inTurpan ? Math.max(1.0, 2.0 + elevGrid[i] * 0.002) : 2.5;
    }
  }

  // National & Provincial Border Seeds
  const natBorderSeed = new Uint8Array(W * H);
  const provBorderSeed = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const p = provinceIdGrid[i];
      const pR = provinceIdGrid[i + 1];
      const pD = provinceIdGrid[i + W];
      if ((p > 0) !== (pR > 0) || (p > 0) !== (pD > 0)) {
        natBorderSeed[i] = 1;
      } else if ((p !== pR && p > 0 && pR > 0) || (p !== pD && p > 0 && pD > 0)) {
        provBorderSeed[i] = 1;
      }
    }
  }
  const natDist = computeDistanceField(natBorderSeed);
  const provDist = computeDistanceField(provBorderSeed);

  // 4. Hydrology: Rasterize Natural Earth 10m Lakes + Extract & Rasterize Major Rivers
  console.log('Processing Natural Earth 10m lakes & 14 major river systems...');
  const waterMask = new Float32Array(W * H);
  const lakesGeo = JSON.parse(fs.readFileSync(path.join(ROOT, 'ne_lakes.geojson'), 'utf8'));
  for (const feat of lakesGeo.features) {
    if ((feat.properties.scalerank ?? 10) > 6) continue;
    const polys = feat.geometry.type === 'Polygon' ? [feat.geometry.coordinates] : feat.geometry.coordinates;
    for (const poly of polys) {
      const outer = poly[0];
      if (!outer.some(([lon, lat]) => lon >= 62 && lon <= 145 && lat >= 12 && lat <= 57)) continue;
      xorScratch.fill(0);
      for (const ring of poly) {
        const ringUV = ring.map(([lon, lat]) => {
          const [x, z] = projectLonLat(lon, lat);
          return xzToUV(x, z);
        });
        rasterizePolygonRing(ringUV, provinceIdGrid, 1, xorScratch);
      }
      for (let i = 0; i < W * H; i++) {
        if (xorScratch[i]) waterMask[i] = 1.0;
      }
    }
  }

  const riversGeo = JSON.parse(fs.readFileSync(path.join(ROOT, 'ne_rivers.geojson'), 'utf8'));
  // Also rasterize all background rivers (scalerank <= 8) softly onto terrain waterMask
  for (const feat of riversGeo.features) {
    const sc = feat.properties.scalerank ?? 10;
    if (sc > 8) continue;
    const lines = feat.geometry.type === 'LineString' ? [feat.geometry.coordinates] : feat.geometry.coordinates;
    for (const line of lines) {
      if (!line.some(([lon, lat]) => lon >= 72 && lon <= 136 && lat >= 18 && lat <= 54)) continue;
      const uvPts = line.map(([lon, lat]) => {
        const [x, z] = projectLonLat(lon, lat);
        return xzToUV(x, z);
      });
      const rad = sc <= 3 ? 1.55 : sc <= 5 ? 1.15 : 0.8;
      const strength = sc <= 3 ? 0.95 : sc <= 5 ? 0.78 : 0.52;
      drawAntiAliasedPolyline(uvPts, waterMask, rad, strength);
    }
  }

  // Extract 3D polylines for the 14 curated Major River Systems
  const riversOut = [];
  for (const sys of RIVER_SYSTEMS) {
    const rawSegmentsXZ = [];
    if (sys.customCoords) {
      const sub = catmullRomSubdivide(sys.customCoords, 5);
      rawSegmentsXZ.push(sub.map(([lon, lat]) => projectLonLat(lon, lat)));
      drawAntiAliasedPolyline(
        sub.map(([lon, lat]) => xzToUV(...projectLonLat(lon, lat))),
        waterMask,
        1.1,
        0.85
      );
    } else {
      for (const feat of riversGeo.features) {
        if (!sys.neNames.includes(feat.properties.name)) continue;
        const lines = feat.geometry.type === 'LineString' ? [feat.geometry.coordinates] : feat.geometry.coordinates;
        for (const line of lines) {
          // Keep segments inside extended China view
          const filtered = line.filter(([lon, lat]) => lon >= 72 && lon <= 136.5 && lat >= 17.5 && lat <= 54.5);
          if (filtered.length < 3) continue;
          const proj = filtered.map(([lon, lat]) => projectLonLat(lon, lat));
          rawSegmentsXZ.push(proj);
        }
      }
    }

    const segments3D = rawSegmentsXZ.map((seg) => {
      const simp = simplifyRing(seg, 0.22);
      const smooth = catmullRomSubdivide(simp, 2);
      const pts3D = smooth.map(([x, z]) => {
        const elev = Math.max(2, sampleElevAtXZ(x, z));
        const y = elevMetersToWorldY(elev) + 0.038;
        return [+x.toFixed(2), +y.toFixed(3), +z.toFixed(2)];
      });
      //Ensure flow direction goes downhill (high start -> low end) for animated current direction!
      if (pts3D.length >= 2 && pts3D[0][1] < pts3D[pts3D.length - 1][1]) {
        pts3D.reverse();
      }
      return pts3D;
    });

    // Pick label anchor near middle of longest segment
    let bestSeg = segments3D[0] || [];
    for (const s of segments3D) if (s.length > bestSeg.length) bestSeg = s;
    const midPt = bestSeg[Math.floor(bestSeg.length * 0.52)] || [0, 0.5, 0];

    riversOut.push({
      id: sys.id,
      name: sys.name,
      en: sys.en,
      lengthKm: sys.lengthKm,
      basinKm2: sys.basinKm2,
      origin: sys.origin,
      outlet: sys.outlet,
      role: sys.role,
      color: sys.color,
      primary: sys.primary,
      labelXYZ: midPt,
      segments: segments3D,
    });
  }

  // 5. Mountain Ranges & Peaks 3D Spines
  const mountainsOut = MOUNTAIN_RANGES.map((m) => {
    const smoothLonLat = catmullRomSubdivide(m.spine, 5);
    const spine3D = smoothLonLat.map(([lon, lat]) => {
      const [x, z] = projectLonLat(lon, lat);
      const elev = Math.max(200, sampleElevAtXZ(x, z));
      const y = elevMetersToWorldY(elev) + 0.08;
      return [+x.toFixed(2), +y.toFixed(3), +z.toFixed(2)];
    });
    const [px, pz] = projectLonLat(m.peakLonLat[0], m.peakLonLat[1]);
    const sampledPeak = Math.max(m.elev * 0.68, sampleElevAtXZ(px, pz));
    const py = elevMetersToWorldY(sampledPeak) + 0.12;
    return {
      id: m.id,
      name: m.name,
      peak: m.peak,
      elev: m.elev,
      tier: m.tier,
      role: m.role,
      peakXYZ: [+px.toFixed(2), +py.toFixed(3), +pz.toFixed(2)],
      spine: spine3D,
    };
  });

  // Major Lakes 3D Labels
  const lakesOut = MAJOR_LAKES.map((lk) => {
    const [x, z] = projectLonLat(lk.lonLat[0], lk.lonLat[1]);
    const elev = Math.max(2, sampleElevAtXZ(x, z));
    return {
      ...lk,
      xyz: [+x.toFixed(2), +(elevMetersToWorldY(elev) + 0.05).toFixed(3), +z.toFixed(2)],
    };
  });

  // Climatic & Topographic Step Divide Lines 3D
  const dividesOut = CLIMATIC_DIVIDES.map((d) => {
    const smooth = catmullRomSubdivide(d.coords, 6);
    const pts3D = smooth.map(([lon, lat]) => {
      const [x, z] = projectLonLat(lon, lat);
      const elev = Math.max(5, sampleElevAtXZ(x, z));
      return [+x.toFixed(2), +(elevMetersToWorldY(elev) + 0.09).toFixed(3), +z.toFixed(2)];
    });
    return {
      id: d.id,
      name: d.name,
      desc: d.desc,
      color: d.color,
      points: pts3D,
    };
  });

  // 6. Compute Multi-Scale Topographic Ambient Occlusion (SVF), Curvature, Normals, Moisture & Climate Zones
  console.log('Baking multi-scale Sky-View Ambient Occlusion, normals, moisture & climate zones...');
  const demAoPng = new PNG({ width: W, height: H });
  const normWaterPng = new PNG({ width: W, height: H });
  const provBorderPng = new PNG({ width: W, height: H });

  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [0.707, 0.707], [-0.707, 0.707], [0.707, -0.707], [-0.707, -0.707],
  ];
  const stepRadii = [1, 3, 7, 14];

  // World-space y cache for accurate normal & horizon AO calculation
  const worldYGrid = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    worldYGrid[i] = isOcean[i] ? elevMetersToWorldY(elevGrid[i]) : elevMetersToWorldY(Math.max(2, elevGrid[i]));
  }

  const cellDX = PROJ_CONFIG.worldWidth / W; // ~0.05625 world units

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = py * W + px;
      const off = i * 4;
      const elev = elevGrid[i];
      const wy = worldYGrid[i];
      const lon = lonGrid[i];
      const lat = latGrid[i];

      // A) 16-bit elevation encoding: [-6000m, +9000m] -> [0..65535]
      const normElev = Math.max(0, Math.min(1, (elev - PROJ_CONFIG.minElev) / (PROJ_CONFIG.maxElev - PROJ_CONFIG.minElev)));
      const u16 = Math.round(normElev * 65535);
      demAoPng.data[off] = (u16 >> 8) & 255;
      demAoPng.data[off + 1] = u16 & 255;

      // B) Multi-scale Horizon Ambient Occlusion (Sky-View Factor)
      let occSum = 0;
      for (let d = 0; d < 8; d++) {
        const dx = dirs[d][0], dy = dirs[d][1];
        let maxTan = 0;
        for (let rIdx = 0; rIdx < 4; rIdx++) {
          const r = stepRadii[rIdx];
          const sx = Math.max(0, Math.min(W - 1, Math.round(px + dx * r)));
          const sy = Math.max(0, Math.min(H - 1, Math.round(py + dy * r)));
          const dh = worldYGrid[sy * W + sx] - wy;
          if (dh > 0) {
            const tanAngle = dh / (r * cellDX * 0.85);
            if (tanAngle > maxTan) maxTan = tanAngle;
          }
        }
        occSum += maxTan / Math.sqrt(1 + maxTan * maxTan); // sin(horizonAngle)
      }
      const ao = Math.max(0.12, Math.min(1.0, 1.0 - (occSum / 8.0) * 0.88));
      demAoPng.data[off + 2] = Math.round(ao * 255);

      // C) Ridge Curvature (Laplacian) + Central-Difference Normal
      const xm = Math.max(0, px - 1), xp = Math.min(W - 1, px + 1);
      const ym = Math.max(0, py - 1), yp = Math.min(H - 1, py + 1);
      const hL = worldYGrid[py * W + xm];
      const hR = worldYGrid[py * W + xp];
      const hU = worldYGrid[ym * W + px];
      const hD = worldYGrid[yp * W + px];

      const laplacian = wy - 0.25 * (hL + hR + hU + hD);
      const curv = Math.max(0, Math.min(1, 0.5 + laplacian * 6.5));
      demAoPng.data[off + 3] = Math.round(curv * 255);

      // Surface Normal (nx, ny, nz)
      const dX = (hR - hL) / (2 * cellDX);
      const dZ = (hD - hU) / (2 * cellDX);
      let nx = -dX, ny = 1.0, nz = -dZ;
      const nLen = Math.hypot(nx, ny, nz);
      nx /= nLen;
      nz /= nLen;
      normWaterPng.data[off] = Math.round((nx * 0.5 + 0.5) * 255);
      normWaterPng.data[off + 1] = Math.round((nz * 0.5 + 0.5) * 255);

      // Water Mask (0 = dry land, 1..254 = river/lake intensity, 255 = true ocean)
      if (isOcean[i]) {
        normWaterPng.data[off + 2] = 255;
      } else {
        normWaterPng.data[off + 2] = Math.min(245, Math.round(waterMask[i] * 245));
      }

      // D) Scientific Aridity / Moisture Index (0 = hyper-arid Taklamakan/Gobi, 255 = lush tropical/Jiangnan)
      // Models SE Pacific monsoon + SW Bay of Bengal monsoon + rain shadows behind Himalayas/Tibetan Plateau/Tian Shan
      const seProximity = Math.max(0, Math.min(1, (lon - 96.0) / 26.0)) * Math.max(0, Math.min(1, (48.0 - lat) / 24.0));
      const neForest = Math.max(0, Math.min(1, (lon - 117.5) / 14.0)) * Math.max(0, Math.min(1, (lat - 40.0) / 10.0)) * 0.72;
      const swYunnanAssam = Math.exp(-(((lon - 97.5) / 9.5) ** 2 + ((lat - 23.5) / 6.5) ** 2)) * 0.92;
      const sichuanHumidity = Math.exp(-(((lon - 105.5) / 4.5) ** 2 + ((lat - 30.2) / 3.5) ** 2)) * 0.55;
      const tarimAridity = Math.exp(-(((lon - 83.5) / 8.5) ** 2 + ((lat - 39.2) / 3.8) ** 2)) * 0.85;
      const gobiAridity = Math.exp(-(((lon - 101.0) / 11.0) ** 2 + ((lat - 42.5) / 4.8) ** 2)) * 0.72;
      const qaidamAridity = Math.exp(-(((lon - 94.5) / 4.5) ** 2 + ((lat - 37.2) / 2.2) ** 2)) * 0.75;
      const iliOasis = Math.exp(-(((lon - 82.5) / 3.2) ** 2 + ((lat - 43.8) / 1.8) ** 2)) * 0.42;
      const tibetRainShadow = elev > 3400 ? Math.max(0, Math.min(0.55, (34.0 - lat) * 0.04 + (95.0 - lon) * 0.03)) : 0;

      let moisture = 0.24 + seProximity * 0.82 + neForest + swYunnanAssam + sichuanHumidity + iliOasis
        - tarimAridity - gobiAridity - qaidamAridity - tibetRainShadow;
      moisture = Math.max(0.02, Math.min(1.0, moisture));
      normWaterPng.data[off + 3] = Math.round(moisture * 255);

      // E) Province ID + Smooth Border SDF + Climate Zone Classification (1..5)
      provBorderPng.data[off] = provinceIdGrid[i]; // R: 0..34 exact province ID

      // G: Signed Distance to National Border (128 = exact border, >128 inside China, <128 outside)
      const sign = provinceIdGrid[i] > 0 ? 1 : -1;
      const sdfVal = Math.max(0, Math.min(255, Math.round(128 + sign * Math.min(127, natDist[i] * 8.0))));
      provBorderPng.data[off + 1] = sdfVal;

      // B: Provincial Border Line Intensity (smooth 3.5px falloff)
      const pLine = provinceIdGrid[i] > 0 ? Math.max(0, Math.min(1, 1.0 - provDist[i] / 3.2)) : 0;
      provBorderPng.data[off + 2] = Math.round(pLine * 255);

      // A: 5 Major Climate Zones of China (encoded smoothly as 1..5 * 45)
      // 1 = Tropical Monsoon (45), 2 = Subtropical Monsoon (90), 3 = Temperate Monsoon (135),
      // 4 = Temperate Continental (180), 5 = Alpine Plateau Mountain (225)
      let cZone = 3;
      const qinlingLat = 33.85 - (lon - 108.0) * 0.03;
      const monsoon400Lon = 120.5 - (50.0 - lat) * 1.15; // ~121E at 50N -> ~104E at 36N
      if (elev >= 3000 || (elev >= 2500 && lat > 29.0 && lon < 104.0) || (elev >= 2300 && lat > 41.5 && lon < 95.0)) {
        cZone = 5; // 高原山地气候
      } else if (lat < 22.3 + (lon > 119.5 ? 1.3 : 0.0) && elev < 1400 && lon > 97.5) {
        cZone = 1; // 热带季风气候 (Hainan, Leizhou, S Taiwan, Xishuangbanna)
      } else if (lat < qinlingLat && lon > 98.0) {
        cZone = 2; // 亚热带季风气候
      } else if (lon >= monsoon400Lon && moisture > 0.34) {
        cZone = 3; // 温带季风气候
      } else {
        cZone = 4; // 温带大陆性气候
      }
      provBorderPng.data[off + 3] = cZone * 45;
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, 'dem_ao.png'), PNG.sync.write(demAoPng));
  fs.writeFileSync(path.join(OUT_DIR, 'normal_water.png'), PNG.sync.write(normWaterPng));
  fs.writeFileSync(path.join(OUT_DIR, 'province_border.png'), PNG.sync.write(provBorderPng));

  const atlasData = {
    meta: {
      width: W,
      height: H,
      worldWidth: PROJ_CONFIG.worldWidth,
      worldHeight: PROJ_CONFIG.worldHeight,
      minElev: PROJ_CONFIG.minElev,
      maxElev: PROJ_CONFIG.maxElev,
    },
    provinces: provincesOut,
    mountains: mountainsOut,
    rivers: riversOut,
    lakes: lakesOut,
    divides: dividesOut,
    southChinaSea: {
      tenDashLinesXZ,
      tenDashRaw,
      landPolysRaw: scsRawPolys,
      archipelagos: [
        { name: '东沙群岛', lonLat: [116.72, 20.70], xz: projectLonLat(116.72, 20.70).map((v) => +v.toFixed(2)) },
        { name: '西沙群岛', lonLat: [112.33, 16.83], xz: projectLonLat(112.33, 16.83).map((v) => +v.toFixed(2)) },
        { name: '中沙群岛 · 黄岩岛', lonLat: [117.75, 15.18], xz: projectLonLat(117.75, 15.18).map((v) => +v.toFixed(2)) },
        { name: '南沙群岛', lonLat: [114.28, 9.90], xz: null },
        { name: '曾母暗沙', lonLat: [112.27, 3.97], xz: null },
        { name: '钓鱼岛', lonLat: [123.47, 25.74], xz: projectLonLat(123.47, 25.74).map((v) => +v.toFixed(2)) },
      ],
    },
  };

  const jsonPath = path.join(OUT_DIR, 'atlas_data.json');
  fs.writeFileSync(jsonPath, JSON.stringify(atlasData));

  console.log('Done baking GIS textures & vector atlas!');
  for (const f of ['dem_ao.png', 'normal_water.png', 'province_border.png', 'atlas_data.json']) {
    const sz = (fs.statSync(path.join(OUT_DIR, f)).size / 1024).toFixed(1);
    console.log(`  ${f.padEnd(22)} ${sz} KB`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
