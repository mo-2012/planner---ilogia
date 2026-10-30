// iLogia Planner — lightweight SVG charts (no external deps)
const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };

/** Bar chart: data = [{label, value, color?}] */
export function barChart(data, { height = 180, max = null, unit = '' } = {}) {
  const W = 560, H = height, padB = 24, padT = 12;
  const m = max ?? Math.max(1, ...data.map(d => d.value));
  const bw = (W / data.length) * 0.6;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H });
  // gridlines
  for (let i = 0; i <= 4; i++) {
    const y = padT + (H - padB - padT) * (1 - i / 4);
    svg.append(s('line', { x1: 0, x2: W, y1: y, y2: y, stroke: 'var(--line)', 'stroke-width': 1, 'stroke-dasharray': i ? '3 4' : '' }));
    const lbl = s('text', { x: 4, y: y - 3, 'font-size': 10, fill: 'var(--mut)' });
    lbl.textContent = Math.round(m * i / 4) + unit;
    svg.append(lbl);
  }
  data.forEach((d, i) => {
    const cx = (W / data.length) * (i + 0.5);
    const h = (H - padB - padT) * (d.value / m);
    const rect = s('rect', {
      x: cx - bw / 2, y: H - padB - h, width: bw, height: Math.max(2, h), rx: 4,
      fill: d.color || 'var(--primary-c)',
    });
    const ti = s('title', {}); ti.textContent = `${d.label}: ${d.value}${unit}`;
    rect.append(ti);
    svg.append(rect);
    const lbl = s('text', { x: cx, y: H - 8, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--mut)' });
    lbl.textContent = d.label;
    svg.append(lbl);
  });
  return svg;
}

/** Donut chart: data = [{label, value, color}] */
export function donut(data, { size = 180, thickness = 26, centerLabel = '' } = {}) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const R = (size - thickness) / 2, C = 2 * Math.PI * R;
  const svg = s('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size });
  svg.append(s('circle', { cx: size / 2, cy: size / 2, r: R, fill: 'none', stroke: 'var(--cream)', 'stroke-width': thickness }));
  let off = 0;
  for (const d of data) {
    const frac = d.value / total;
    const seg = s('circle', {
      cx: size / 2, cy: size / 2, r: R, fill: 'none', stroke: d.color, 'stroke-width': thickness,
      'stroke-dasharray': `${frac * C} ${C}`, 'stroke-dashoffset': -off * C,
      transform: `rotate(-90 ${size / 2} ${size / 2})`,
    });
    const ti = s('title', {}); ti.textContent = `${d.label}: ${Math.round(frac * 100)}%`;
    seg.append(ti);
    svg.append(seg);
    off += frac;
  }
  const lbl = s('text', { x: size / 2, y: size / 2 + 5, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: 'var(--ink)' });
  lbl.textContent = centerLabel;
  svg.append(lbl);
  return svg;
}

/** Line/area chart: data = [{label, value}] */
export function lineChart(data, { height = 180, unit = '' } = {}) {
  const W = 560, H = height, padB = 24, padT = 12;
  const m = Math.max(1, ...data.map(d => d.value));
  const px = (i) => (W / Math.max(1, data.length - 1)) * i;
  const py = (v) => padT + (H - padB - padT) * (1 - v / m);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H });
  for (let i = 0; i <= 4; i++) {
    const y = padT + (H - padB - padT) * (1 - i / 4);
    svg.append(s('line', { x1: 0, x2: W, y1: y, y2: y, stroke: 'var(--line)', 'stroke-dasharray': i ? '3 4' : '' }));
  }
  const pts = data.map((d, i) => `${px(i)},${py(d.value)}`).join(' ');
  svg.append(s('polygon', { points: `0,${H - padB} ${pts} ${W},${H - padB}`, fill: 'var(--tint)' }));
  svg.append(s('polyline', { points: pts, fill: 'none', stroke: 'var(--primary-c)', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
  data.forEach((d, i) => {
    svg.append(s('circle', { cx: px(i), cy: py(d.value), r: 3.5, fill: 'var(--primary-c)' }));
    const lbl = s('text', { x: px(i), y: H - 8, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--mut)' });
    lbl.textContent = d.label;
    svg.append(lbl);
  });
  return svg;
}

/** Progress ring */
export function ring(frac, { size = 88, thickness = 9, color = 'var(--primary-c)', label = '' } = {}) {
  const R = (size - thickness) / 2, C = 2 * Math.PI * R;
  const svg = s('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size });
  svg.append(s('circle', { cx: size / 2, cy: size / 2, r: R, fill: 'none', stroke: 'var(--cream)', 'stroke-width': thickness }));
  svg.append(s('circle', {
    cx: size / 2, cy: size / 2, r: R, fill: 'none', stroke: color, 'stroke-width': thickness, 'stroke-linecap': 'round',
    'stroke-dasharray': `${Math.min(1, frac) * C} ${C}`, transform: `rotate(-90 ${size / 2} ${size / 2})`,
  }));
  const lbl = s('text', { x: size / 2, y: size / 2 + 5, 'text-anchor': 'middle', 'font-size': size > 70 ? 16 : 12, 'font-weight': 700, fill: 'var(--ink)' });
  lbl.textContent = label || `${Math.round(frac * 100)}%`;
  svg.append(lbl);
  return svg;
}
