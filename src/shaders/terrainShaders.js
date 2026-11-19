// Physically Inspired Relief Terrain, Ocean Bathymetry, Four-Seasons Biome & Climate Shader
// Uses 16-bit DEM + Sky-View Ambient Occlusion + Ridge Curvature + Hydrology + Exact Province SDF

export const terrainVertexShader = /* glsl */ `
  uniform sampler2D uDemAoTex;
  uniform sampler2D uNormWaterTex;
  uniform vec2 uTexSize;
  uniform float uExaggeration;
  uniform float uMinElev;
  uniform float uMaxElev;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vElevMeters;
  varying float vIsOcean;

  float decodeElevTexel(vec2 tc) {
    vec4 s = texture2D(uDemAoTex, tc);
    float u16 = floor(s.r * 255.0 + 0.5) * 256.0 + floor(s.g * 255.0 + 0.5);
    return mix(uMinElev, uMaxElev, u16 / 65535.0);
  }

  float sampleElevBilinear(vec2 uv) {
    vec2 pix = uv * uTexSize - 0.5;
    vec2 iPix = floor(pix);
    vec2 f = fract(pix);
    vec2 inv = 1.0 / uTexSize;
    float e00 = decodeElevTexel((iPix + vec2(0.5, 0.5)) * inv);
    float e10 = decodeElevTexel((iPix + vec2(1.5, 0.5)) * inv);
    float e01 = decodeElevTexel((iPix + vec2(0.5, 1.5)) * inv);
    float e11 = decodeElevTexel((iPix + vec2(1.5, 1.5)) * inv);
    return mix(mix(e00, e10, f.x), mix(e01, e11, f.x), f.y);
  }

  float elevToWorldY(float elevM, float isOceanFlag, float exag) {
    if (isOceanFlag > 0.5) {
      return 0.0;
    }
    float safeM = max(1.5, elevM);
    return pow(safeM / 1000.0, 0.78) * 0.88 * exag;
  }

  void main() {
    vUv = uv;
    vec4 nwSample = texture2D(uNormWaterTex, uv);

    float elevM = sampleElevBilinear(uv);
    float isOcean = step(0.99, nwSample.b);

    vElevMeters = elevM;
    vIsOcean = isOcean;

    vec3 pos = position;
    pos.y = elevToWorldY(elevM, isOcean, uExaggeration);

    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const terrainFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uDemAoTex;
  uniform sampler2D uNormWaterTex;
  uniform sampler2D uProvBorderTex;

  uniform vec2 uTexSize;
  uniform float uTime;
  uniform float uSeason;          // 0.0=Spring, 1.0=Summer, 2.0=Autumn, 3.0=Winter (continuous 0..4)
  uniform float uExaggeration;
  uniform float uMinElev;
  uniform float uMaxElev;

  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSkyColor;
  uniform float uNightMix;        // 0 = day/golden hour, 1 = starlight night

  uniform float uHoveredProv;     // 0 = none, 1..34 = hovered province id
  uniform float uSelectedProv;    // 0 = none, 1..34 = selected province id
  uniform float uShowProvBorders; // 0..1

  // Climate Mode: 0=Natural, 1=ClimateZones(5), 2=Monsoon(Base darkened slightly), 3=Temperature, 4=Precipitation
  uniform int uClimateMode;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vElevMeters;
  varying float vIsOcean;

  // Compact high-speed 2D hash & value noise for micro-relief rock/dune/wave detail
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm3(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 3; i++) {
      v += a * noise2D(p);
      p = rot * p * 2.07;
      a *= 0.5;
    }
    return v;
  }

  // Inverse Albers approximation in shader for accurate latitude & longitude climate physics
  vec2 worldXZToLonLat(vec2 xz) {
    const float SCALE = 92.0;
    const float n = 0.576986;
    const float C = 1.309083;
    const float rho0 = 1.390730;
    float rx = xz.x / SCALE;
    float ry = rho0 + xz.y / SCALE;
    float r = length(vec2(rx, ry));
    float theta = atan(rx, ry);
    float sinLat = clamp((C - (r * n) * (r * n)) / (2.0 * n), -1.0, 1.0);
    float latDeg = asin(sinLat) * 57.2957795;
    float lonDeg = 104.0 + (theta / n) * 57.2957795;
    return vec2(lonDeg, latDeg);
  }

  // Manual bilinear filter on G, B, A of uProvBorderTex while keeping R (province ID) nearest-neighbor!
  void sampleProvData(vec2 uv, out float provId, out vec3 smoothGBA) {
    vec2 pix = uv * uTexSize - 0.5;
    vec2 iPix = floor(pix);
    vec2 f = fract(pix);

    vec2 uvCenter = (floor(uv * uTexSize) + 0.5) / uTexSize;
    provId = floor(texture2D(uProvBorderTex, uvCenter).r * 255.0 + 0.5);

    vec2 uv00 = (iPix + vec2(0.5, 0.5)) / uTexSize;
    vec2 uv10 = (iPix + vec2(1.5, 0.5)) / uTexSize;
    vec2 uv01 = (iPix + vec2(0.5, 1.5)) / uTexSize;
    vec2 uv11 = (iPix + vec2(1.5, 1.5)) / uTexSize;

    vec3 s00 = texture2D(uProvBorderTex, uv00).gba;
    vec3 s10 = texture2D(uProvBorderTex, uv10).gba;
    vec3 s01 = texture2D(uProvBorderTex, uv01).gba;
    vec3 s11 = texture2D(uProvBorderTex, uv11).gba;

    smoothGBA = mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y);
  }

  // Smooth periodic season weights (wSpring, wSummer, wAutumn, wWinter) summing to 1.0
  vec4 getSeasonWeights(float s) {
    float sp = fract(s * 0.25) * 4.0;
    float d0 = min(abs(sp - 0.0), 4.0 - abs(sp - 0.0));
    float d1 = min(abs(sp - 1.0), 4.0 - abs(sp - 1.0));
    float d2 = min(abs(sp - 2.0), 4.0 - abs(sp - 2.0));
    float d3 = min(abs(sp - 3.0), 4.0 - abs(sp - 3.0));
    vec4 w = max(vec4(0.0), 1.0 - vec4(d0, d1, d2, d3));
    w = w * w * (3.0 - 2.0 * w);
    return w / max(0.0001, w.x + w.y + w.z + w.w);
  }

  // Scientific color ramp for Temperature (-32C .. +38C)
  vec3 tempColorRamp(float tempC) {
    float t = clamp((tempC + 30.0) / 66.0, 0.0, 1.0);
    vec3 c0 = vec3(0.14, 0.10, 0.48); // -30C Deep polar indigo
    vec3 c1 = vec3(0.16, 0.48, 0.88); // -12C Subzero sapphire
    vec3 c2 = vec3(0.32, 0.84, 0.88); //   0C Freezing cyan (Qinling-Huaihe in Jan!)
    vec3 c3 = vec3(0.46, 0.86, 0.44); // +12C Mild spring emerald
    vec3 c4 = vec3(0.96, 0.78, 0.24); // +24C Warm golden
    vec3 c5 = vec3(0.92, 0.24, 0.16); // +36C Scorching crimson
    if (t < 0.2) return mix(c0, c1, t / 0.2);
    if (t < 0.45) return mix(c1, c2, (t - 0.2) / 0.25);
    if (t < 0.65) return mix(c2, c3, (t - 0.45) / 0.20);
    if (t < 0.84) return mix(c3, c4, (t - 0.65) / 0.19);
    return mix(c4, c5, (t - 0.84) / 0.16);
  }

  // Scientific color ramp for Precipitation (0mm .. 2200mm)
  vec3 precipColorRamp(float mm) {
    float t = clamp(pow(mm / 2000.0, 0.65), 0.0, 1.0);
    vec3 c0 = vec3(0.76, 0.56, 0.32); // <50mm Arid Taklamakan sand
    vec3 c1 = vec3(0.84, 0.78, 0.44); // 200mm Semi-arid steppe
    vec3 c2 = vec3(0.46, 0.78, 0.52); // 400mm Semi-humid transition
    vec3 c3 = vec3(0.16, 0.66, 0.76); // 800mm Humid Jiangnan
    vec3 c4 = vec3(0.12, 0.34, 0.82); // 1600mm Heavy monsoon
    vec3 c5 = vec3(0.36, 0.16, 0.76); // >2000mm Taiwan / South China torrential
    if (t < 0.18) return mix(c0, c1, t / 0.18);
    if (t < 0.36) return mix(c1, c2, (t - 0.18) / 0.18);
    if (t < 0.58) return mix(c2, c3, (t - 0.36) / 0.22);
    if (t < 0.82) return mix(c3, c4, (t - 0.58) / 0.24);
    return mix(c4, c5, (t - 0.82) / 0.18);
  }

  void sampleDemAoBilinear(vec2 uv, out float elevM, out float aoOut, out float curvOut) {
    vec2 pix = uv * uTexSize - 0.5;
    vec2 iPix = floor(pix);
    vec2 f = fract(pix);
    vec2 inv = 1.0 / uTexSize;
    vec4 s00 = texture2D(uDemAoTex, (iPix + vec2(0.5, 0.5)) * inv);
    vec4 s10 = texture2D(uDemAoTex, (iPix + vec2(1.5, 0.5)) * inv);
    vec4 s01 = texture2D(uDemAoTex, (iPix + vec2(0.5, 1.5)) * inv);
    vec4 s11 = texture2D(uDemAoTex, (iPix + vec2(1.5, 1.5)) * inv);

    float e00 = (floor(s00.r * 255.0 + 0.5) * 256.0 + floor(s00.g * 255.0 + 0.5)) / 65535.0;
    float e10 = (floor(s10.r * 255.0 + 0.5) * 256.0 + floor(s10.g * 255.0 + 0.5)) / 65535.0;
    float e01 = (floor(s01.r * 255.0 + 0.5) * 256.0 + floor(s01.g * 255.0 + 0.5)) / 65535.0;
    float e11 = (floor(s11.r * 255.0 + 0.5) * 256.0 + floor(s11.g * 255.0 + 0.5)) / 65535.0;
    float eNorm = mix(mix(e00, e10, f.x), mix(e01, e11, f.x), f.y);
    elevM = mix(uMinElev, uMaxElev, eNorm);

    vec2 ba = mix(mix(s00.ba, s10.ba, f.x), mix(s01.ba, s11.ba, f.x), f.y);
    aoOut = mix(0.28, 1.0, ba.x);
    curvOut = ba.y;
  }

  void main() {
    float elevM, ao, ridgeCurv;
    sampleDemAoBilinear(vUv, elevM, ao, ridgeCurv);
    vec4 nwSample = texture2D(uNormWaterTex, vUv);

    float provId;
    vec3 provGBA;
    sampleProvData(vUv, provId, provGBA);

    float natSDF = (provGBA.r - 128.0 / 255.0) * 2.0; // >0 inside China, <0 outside
    float insideChina = smoothstep(-0.025, 0.025, natSDF);
    float provBorder = provGBA.g;

    vec2 lonLat = worldXZToLonLat(vWorldPos.xz);
    float lon = lonLat.x;
    float lat = lonLat.y;

    vec4 sw = getSeasonWeights(uSeason); // x:Spring, y:Summer, z:Autumn, w:Winter
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    // ================= 1. OCEAN BATHYMETRY & ANIMATED WAVES =================
    if (nwSample.b > 0.98) {
      float depthM = max(0.0, -elevM);
      float shelf = exp(-depthM / 220.0);         // Bohai, Yellow Sea, East China Sea continental shelf!
      float midDepth = exp(-depthM / 1800.0);

      // Animated dual-octave capillary & swell waves
      vec2 wUv1 = vWorldPos.xz * 0.55 + vec2(uTime * 0.035, -uTime * 0.028);
      vec2 wUv2 = vWorldPos.xz * 1.35 + vec2(-uTime * 0.048, uTime * 0.032);
      float w1 = noise2D(wUv1);
      float w2 = noise2D(wUv2);
      vec3 waveNorm = normalize(vec3(
        (w1 - 0.5) * 0.09 + (w2 - 0.5) * 0.05,
        1.0,
        (noise2D(wUv1 + 4.1) - 0.5) * 0.09 + (noise2D(wUv2 + 2.7) - 0.5) * 0.05
      ));

      vec3 shallowCol = mix(vec3(0.08, 0.34, 0.42), vec3(0.11, 0.42, 0.48), sw.y);
      vec3 slopeCol = vec3(0.04, 0.18, 0.30);
      vec3 abyssCol = vec3(0.018, 0.068, 0.155);

      vec3 seaBase = mix(abyssCol, slopeCol, midDepth);
      seaBase = mix(seaBase, shallowCol, shelf * 0.85);

      // Subtle bathymetric contour lines in deep basins (Okinawa Trough, South China Sea Basin)
      float bathyContour = smoothstep(0.92, 1.0, abs(sin(depthM / 500.0 * 3.14159)));
      seaBase += vec3(0.02, 0.05, 0.08) * bathyContour * (1.0 - shelf);

      // Bohai Liaodong Bay winter sea-ice rim
      float bohaiIce = sw.w * smoothstep(38.8, 41.0, lat) * smoothstep(25.0, 2.0, depthM) * smoothstep(117.0, 122.5, lon);
      seaBase = mix(seaBase, vec3(0.72, 0.84, 0.94), bohaiIce * 0.72);

      // Coastal turquoise glow & delicate surf line near China coastline
      float coastProx = exp(-abs(natSDF) * 14.0);
      seaBase += vec3(0.06, 0.19, 0.22) * coastProx * 0.55;

      // Sun & sky reflection (Fresnel + GGX-like sun glint)
      float fresnel = pow(1.0 - max(0.0, dot(waveNorm, viewDir)), 4.0);
      vec3 halfVec = normalize(uSunDir + viewDir);
      float spec = pow(max(0.0, dot(waveNorm, halfVec)), 140.0) * 1.15;
      float broadSpec = pow(max(0.0, dot(waveNorm, halfVec)), 22.0) * 0.22;

      float ndlSea = max(0.15, dot(waveNorm, uSunDir));
      vec3 seaCol = seaBase * (0.45 + 0.65 * ndlSea) + uSkyColor * fresnel * 0.38;
      seaCol += uSunColor * (spec + broadSpec) * (1.0 - uNightMix * 0.75);
      seaCol *= mix(1.0, 0.28, uNightMix);

      // Distance edge vignette near plinth border
      vec2 edgeDist = min(vUv, 1.0 - vUv);
      float edgeFade = smoothstep(0.0, 0.03, min(edgeDist.x, edgeDist.y));
      seaCol = mix(vec3(0.02, 0.04, 0.07), seaCol, edgeFade);

      gl_FragColor = vec4(seaCol, 1.0);
      return;
    }

    // ================= 2. LAND SURFACE NORMAL & MICRO-BUMP =================
    vec2 nXZ = nwSample.rg * 2.0 - 1.0;
    nXZ *= uExaggeration;
    float ny = sqrt(max(0.04, 1.0 - dot(nXZ, nXZ)));
    vec3 baseNorm = normalize(vec3(nXZ.x, ny, nXZ.y));
    float slope = 1.0 - baseNorm.y;

    // Procedural rock & dune micro-detail
    float detailNoise = fbm3(vWorldPos.xz * 2.2);
    float fineNoise = noise2D(vWorldPos.xz * 7.5);
    float duneRipple = sin(vWorldPos.x * 16.0 + vWorldPos.z * 9.0 + detailNoise * 4.5) * 0.5 + 0.5;

    vec3 microPerturb = vec3(
      (detailNoise - 0.5) * 0.22 + (fineNoise - 0.5) * 0.12,
      0.0,
      (noise2D(vWorldPos.xz * 2.2 + 5.3) - 0.5) * 0.22
    );
    vec3 N = normalize(baseNorm + microPerturb * (0.35 + slope * 1.1));

    // ================= 3. PHYSICAL BIOME & FOUR-SEASONS PALETTE =================
    float moisture = nwSample.a;
    float riverLake = smoothstep(0.08, 0.62, nwSample.b);

    // Base geological substrates
    vec3 desertSand   = mix(vec3(0.79, 0.64, 0.43), vec3(0.86, 0.73, 0.52), duneRipple * 0.55 + detailNoise * 0.35);
    vec3 gobiGravel   = mix(vec3(0.56, 0.49, 0.40), vec3(0.66, 0.57, 0.45), detailNoise);
    vec3 loessOchre   = mix(vec3(0.68, 0.54, 0.34), vec3(0.75, 0.61, 0.39), detailNoise);
    vec3 plateauTundra= mix(vec3(0.46, 0.44, 0.33), vec3(0.55, 0.50, 0.37), detailNoise);
    vec3 cliffGranite = mix(vec3(0.28, 0.27, 0.29), vec3(0.44, 0.41, 0.39), ridgeCurv * 0.7 + fineNoise * 0.3);

    // Seasonal Vegetation Palettes:
    // Spring: tender celadon-jade shoots & warm blossom undertones
    vec3 vegSpring = mix(vec3(0.38, 0.58, 0.30), vec3(0.18, 0.46, 0.25), smoothstep(0.35, 0.85, moisture));
    // Summer: rich, lush viridian & deep boreal emerald
    vec3 vegSummer = mix(vec3(0.29, 0.50, 0.22), vec3(0.09, 0.34, 0.17), smoothstep(0.32, 0.85, moisture));
    // Autumn: evergreen tropical south -> golden-amber Central/North -> blazing crimson-gold Khingan/Changbai/Qinling!
    float autumnLatFactor = smoothstep(25.5, 44.0, lat + elevM * 0.0035);
    vec3 autumnFoliage = mix(
      vec3(0.80, 0.53, 0.17), // burnished gold-amber
      vec3(0.74, 0.27, 0.15), // maple/larch crimson-cinnabar on ridges
      smoothstep(0.38, 0.72, detailNoise + ridgeCurv * 0.25)
    );
    vec3 vegAutumn = mix(vegSummer * 1.06, autumnFoliage, autumnLatFactor * 0.88);
    // Winter: dormant olive-taupe north, evergreen subtropical/tropical south
    float winterEvergreen = smoothstep(32.5, 22.5, lat);
    vec3 vegWinter = mix(vec3(0.38, 0.37, 0.29), vec3(0.13, 0.35, 0.20), winterEvergreen);

    vec3 vegCol = vegSpring * sw.x + vegSummer * sw.y + vegAutumn * sw.z + vegWinter * sw.w;

    // Blend arid -> steppe/loess -> lush forest by moisture & elevation
    float loessZone = exp(-pow((lon - 107.8) / 5.2, 2.0) - pow((lat - 36.6) / 3.2, 2.0));
    vec3 aridBase = mix(desertSand, gobiGravel, smoothstep(0.06, 0.24, moisture));
    aridBase = mix(aridBase, loessOchre, loessZone * 0.68);

    float vegCover = smoothstep(0.18, 0.52, moisture) * (1.0 - smoothstep(3400.0, 4600.0, elevM));
    vec3 landAlbedo = mix(aridBase, vegCol, vegCover);

    // High-altitude Qinghai-Tibet alpine meadow -> rocky scree transition
    float alpineFactor = smoothstep(3000.0, 4400.0, elevM);
    vec3 alpineMeadow = mix(plateauTundra, vegCol * 0.85, (sw.x * 0.5 + sw.y * 0.85) * smoothstep(0.15, 0.48, moisture));
    landAlbedo = mix(landAlbedo, alpineMeadow, alpineFactor * 0.82);

    // Expose craggy granite/slate rock on steep mountain cliffs & convex ridges
    float rockMask = smoothstep(0.22, 0.55, slope + max(0.0, ridgeCurv - 0.55) * 0.45);
    landAlbedo = mix(landAlbedo, cliffGranite, rockMask * 0.88);

    // ================= 4. PHYSICALLY ACCURATE SEASONAL SNOWLINE & FROST =================
    // Summer snowline ~5100m in Tibet, ~3900m in Tian Shan/Altai
    // Spring/Autumn snowline ~4100m in Tibet, ~2600m in North
    // Winter snowline reaches 0m north of Qinling-Huaihe (~34N), ~1500m in SW, ~3600m in Tibet valleys + peaks!
    float baseSnowLine =
      sw.x * (4700.0 - max(0.0, lat - 34.0) * 145.0) +
      sw.y * (5250.0 - max(0.0, lat - 36.0) * 95.0) +
      sw.z * (4450.0 - max(0.0, lat - 34.0) * 155.0) +
      sw.w * mix(3300.0, -400.0, smoothstep(31.5, 38.5, lat + (1.0 - moisture) * 1.5));

    // North-facing slopes & sheltered concavities hold snow lower; sheer cliffs shed snow!
    float northAspect = clamp(-N.z, -0.5, 0.6) * 320.0;
    float snowElevThreshold = baseSnowLine - northAspect + (detailNoise - 0.5) * 380.0;
    float snowAmount = smoothstep(snowElevThreshold - 320.0, snowElevThreshold + 380.0, elevM);
    // In winter, dry Taklamakan center has light frost rather than deep snowpack
    float desertDryness = (1.0 - smoothstep(0.04, 0.20, moisture)) * smoothstep(2600.0, 1200.0, elevM);
    snowAmount *= (1.0 - desertDryness * 0.65 * sw.w);
    // Steep cliffs shed part of snow revealing dramatic dark rock ribs (Himalayan face look!)
    snowAmount *= (1.0 - smoothstep(0.45, 0.82, slope) * 0.62);

    vec3 snowAlbedo = vec3(0.93, 0.96, 1.0);
    landAlbedo = mix(landAlbedo, snowAlbedo, clamp(snowAmount, 0.0, 0.96));

    // ================= 5. CLIMATE DEMONSTRATION THEMATIC MODES =================
    float isothermGlow = 0.0;
    if (uClimateMode == 1) {
      // 5 Major Climate Zones of China (smoothly draped over 3D relief!)
      float zoneCode = floor(provGBA.b * 255.0 / 45.0 + 0.5);
      vec3 zCol = vec3(0.5);
      if (zoneCode <= 1.5) zCol = vec3(0.95, 0.34, 0.32);      // 1: 热带季风气候 (Coral Crimson)
      else if (zoneCode <= 2.5) zCol = vec3(0.18, 0.76, 0.54); // 2: 亚热带季风气候 (Jade Emerald)
      else if (zoneCode <= 3.5) zCol = vec3(0.28, 0.62, 0.94); // 3: 温带季风气候 (Azure Blue)
      else if (zoneCode <= 4.5) zCol = vec3(0.92, 0.72, 0.28); // 4: 温带大陆性气候 (Amber Ochre)
      else zCol = vec3(0.62, 0.48, 0.92);                      // 5: 高原山地气候 (Alpine Amethyst)

      landAlbedo = mix(landAlbedo * 0.42, zCol, insideChina * 0.76);
    } else if (uClimateMode == 2) {
      // Monsoon Wind Streamline Stage: darken terrain into sleek atmospheric slate so glowing wind streams shine vividly!
      landAlbedo = landAlbedo * vec3(0.26, 0.32, 0.42);
    } else if (uClimateMode == 3) {
      // Seasonal Temperature Thermal Field + Animated Isotherm Contours!
      // Sea-level baseline temperature by latitude & season + lapse rate (-6.0 C / km) + Turpan/Sichuan basin warmth
      float janBase = 26.5 - (lat - 18.0) * 1.32;
      float julBase = 30.5 - max(0.0, lat - 24.0) * 0.26 + (1.0 - moisture) * 4.5;
      float sprAutBase = 0.5 * (janBase + julBase);
      float seaLevelT = sprAutBase * (sw.x + sw.z) + julBase * sw.y + janBase * sw.w;
      float tempC = seaLevelT - max(0.0, elevM) * 0.0060;

      vec3 tCol = tempColorRamp(tempC);
      landAlbedo = mix(landAlbedo * 0.35, tCol, 0.78);

      // Crisp 10°C & 0°C Isotherm lines!
      float zeroLine = exp(-pow(tempC / 0.65, 2.0)); // Glowing 0°C freezing line!
      float step10 = pow(abs(sin(tempC / 10.0 * 3.14159)), 28.0);
      isothermGlow = zeroLine * 0.95 + step10 * 0.35;
    } else if (uClimateMode == 4) {
      // Seasonal & Annual Precipitation Isohyet Field
      float seasonRainFactor = 0.75 * sw.x + 1.45 * sw.y + 0.68 * sw.z + 0.25 * sw.w;
      float annualMm = pow(moisture, 1.45) * 2150.0;
      float dispMm = annualMm * mix(0.65, 1.0, seasonRainFactor * 0.65);
      vec3 pCol = precipColorRamp(dispMm);
      landAlbedo = mix(landAlbedo * 0.35, pCol, 0.78);

      // Highlight 800mm, 400mm, 200mm contours
      float iso800 = exp(-pow((annualMm - 800.0) / 38.0, 2.0));
      float iso400 = exp(-pow((annualMm - 400.0) / 30.0, 2.0));
      isothermGlow = (iso800 + iso400) * 0.65;
    }

    // ================= 6. INLAND LAKES & MAJOR RIVERS ON TERRAIN =================
    if (riverLake > 0.02) {
      float winterFreeze = sw.w * smoothstep(35.0, 43.0, lat + elevM * 0.003);
      vec3 riverCol = mix(vec3(0.09, 0.44, 0.58), vec3(0.76, 0.88, 0.96), winterFreeze * 0.8);
      landAlbedo = mix(landAlbedo, riverCol, riverLake * 0.88);
      N = normalize(mix(N, vec3(0.0, 1.0, 0.0), riverLake * 0.85));
    }

    // ================= 7. SURROUNDING ASIAN RELIEF CONTEXT (OUTSIDE CHINA) =================
    // Subdue foreign terrain into refined dark obsidian-bronze bas-relief so China shines like a jewel!
    float luma = dot(landAlbedo, vec3(0.299, 0.587, 0.114));
    vec3 foreignRelief = mix(vec3(luma) * vec3(0.32, 0.35, 0.40), landAlbedo * 0.36, 0.35);
    landAlbedo = mix(foreignRelief, landAlbedo, insideChina);

    // ================= 8. PHYSICALLY INSPIRED LIGHTING, AO & ATMOSPHERE =================
    float ndl = max(0.0, dot(N, uSunDir));
    // Soft wrap diffuse for atmospheric sky bounce in deep mountain gorges
    float wrapDiff = max(0.0, (dot(N, uSunDir) + 0.25) / 1.25);

    vec3 ambient = uSkyColor * mix(0.34, 0.52, N.y * 0.5 + 0.5) * ao;
    vec3 direct = uSunColor * (ndl * 0.78 + wrapDiff * 0.28) * mix(0.45, 1.0, ao);

    // Grazing ridge rim-light & snow/water specular
    vec3 H = normalize(uSunDir + viewDir);
    float snowSpec = pow(max(0.0, dot(N, H)), 42.0) * snowAmount * 0.45;
    float waterSpec = pow(max(0.0, dot(N, H)), 96.0) * riverLake * 0.95;
    float ridgeRim = pow(1.0 - max(0.0, dot(N, viewDir)), 3.2) * ridgeCurv * insideChina * 0.14;

    vec3 color = landAlbedo * (ambient + direct) + uSunColor * (snowSpec + waterSpec + ridgeRim);

    // Subtle atmospheric valley mist in deep humid basins (Sichuan, Jiangnan, Yungui gorges)
    float valleyMist = (1.0 - ao) * smoothstep(2600.0, 300.0, elevM) * moisture * (0.35 * sw.x + 0.25 * sw.y + 0.20 * sw.z);
    color = mix(color, mix(uSkyColor, uSunColor, 0.25) * 0.85, clamp(valleyMist * 0.42, 0.0, 0.35));

    // Night / Starlight mode: dim daylight & ignite warm golden urban basin lights!
    if (uNightMix > 0.01) {
      vec3 nightCol = landAlbedo * vec3(0.09, 0.13, 0.22) * ao * (0.4 + 0.6 * ndl);
      float flatLowland = (1.0 - smoothstep(0.02, 0.18, slope)) * smoothstep(1800.0, 200.0, elevM);
      float citySparkle = pow(noise2D(vWorldPos.xz * 5.2), 4.0) * flatLowland * smoothstep(0.30, 0.70, moisture) * insideChina;
      nightCol += vec3(1.0, 0.74, 0.34) * citySparkle * 1.65;
      color = mix(color, nightCol, uNightMix);
    }

    // ================= 9. CONFORMAL BORDERS & INTERACTIVE PROVINCE HIGHLIGHT =================
    // Provincial Borders (delicate champagne-gold ink lines)
    if (uShowProvBorders > 0.01) {
      float pLine = smoothstep(0.18, 0.72, provBorder) * insideChina * uShowProvBorders;
      color = mix(color, vec3(0.92, 0.80, 0.56), pLine * 0.52);
    }

    // National Border of China: crisp imperial gold-amber ribbon + warm inner/outer halo
    float natLine = exp(-pow(natSDF * 38.0, 2.0));
    float natGlow = exp(-pow(natSDF * 11.0, 2.0)) * insideChina;
    color += vec3(0.95, 0.74, 0.36) * natGlow * 0.22;
    color = mix(color, vec3(1.0, 0.86, 0.52), clamp(natLine * 0.88, 0.0, 1.0));

    // Hovered & Selected Province Interactive Illumination!
    if (uHoveredProv > 0.5 && abs(provId - uHoveredProv) < 0.25) {
      float edgePulse = smoothstep(0.0, 0.7, provBorder) * 0.65 + 0.16;
      color += vec3(0.32, 0.78, 0.95) * edgePulse;
    }
    if (uSelectedProv > 0.5 && abs(provId - uSelectedProv) < 0.25) {
      float pulse = 0.82 + 0.18 * sin(uTime * 3.2);
      float borderGlow = smoothstep(0.05, 0.75, provBorder);
      color += vec3(0.98, 0.78, 0.35) * (0.18 + borderGlow * 0.68) * pulse;
    }

    // Isotherm / Isohyet luminous contour overlay
    color += vec3(0.95, 0.98, 1.0) * isothermGlow * insideChina * 0.75;

    // Outer tabletop slab bevel vignette
    vec2 edgeDist = min(vUv, 1.0 - vUv);
    float edgeFade = smoothstep(0.0, 0.022, min(edgeDist.x, edgeDist.y));
    color = mix(vec3(0.05, 0.06, 0.09), color, edgeFade);

    gl_FragColor = vec4(color, 1.0);
  }
`;
