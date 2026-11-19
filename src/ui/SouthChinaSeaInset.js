// High-DPI Standard Cartographic Inset for South China Sea Islands (《南海诸岛》附图)

export function renderSouthChinaSeaInset(canvas, scsData) {
  if (!canvas || !scsData) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = 136;
  const h = 172;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Geographic window: lon [105.5, 123.0], lat [3.0, 25.5]
  const lonMin = 105.5, lonMax = 123.0;
  const latMin = 3.0, latMax = 25.5;

  function proj(lon, lat) {
    const x = ((lon - lonMin) / (lonMax - lonMin)) * (w - 10) + 5;
    const y = (1 - (lat - latMin) / (latMax - latMin)) * (h - 10) + 5;
    return [x, y];
  }

  // Deep maritime background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0c2233');
  grad.addColorStop(1, '#06111d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle lat/lon grid
  ctx.strokeStyle = 'rgba(145, 195, 235, 0.12)';
  ctx.lineWidth = 0.6;
  for (const lat of [5, 10, 15, 20]) {
    const [, y] = proj(110, lat);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  for (const lon of [110, 115, 120]) {
    const [x] = proj(lon, 15);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  // Land polygons (South China coast, Hainan, Taiwan, reefs)
  ctx.fillStyle = 'rgba(182, 162, 120, 0.42)';
  ctx.strokeStyle = 'rgba(236, 202, 134, 0.78)';
  ctx.lineWidth = 0.8;
  for (const poly of scsData.landPolysRaw) {
    if (poly.length < 3) continue;
    ctx.beginPath();
    poly.forEach(([lon, lat], idx) => {
      const [x, y] = proj(lon, lat);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Ten-Dash Line (十段线)
  ctx.strokeStyle = '#f5cb73';
  ctx.lineWidth = 1.45;
  for (const seg of scsData.tenDashRaw) {
    if (seg.length < 2) continue;
    ctx.beginPath();
    seg.forEach(([lon, lat], idx) => {
      const [x, y] = proj(lon, lat);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // Archipelago dots & crisp micro-labels
  const labels = [
    { name: '台湾岛', lon: 120.9, lat: 23.7, dot: false },
    { name: '海南岛', lon: 109.7, lat: 19.1, dot: false },
    { name: '东沙群岛', lon: 116.7, lat: 20.7, dot: true },
    { name: '西沙群岛', lon: 112.3, lat: 16.8, dot: true },
    { name: '中沙群岛', lon: 115.8, lat: 15.5, dot: true },
    { name: '南沙群岛', lon: 114.3, lat: 9.8, dot: true },
    { name: '曾母暗沙', lon: 112.3, lat: 4.0, dot: true },
  ];

  ctx.font = '500 9px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  for (const lb of labels) {
    const [x, y] = proj(lb.lon, lb.lat);
    if (lb.dot) {
      ctx.fillStyle = '#ffdf88';
      ctx.beginPath();
      ctx.arc(x, y, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(236, 242, 248, 0.88)';
    ctx.fillText(lb.name, x, y - 4);
  }
}
