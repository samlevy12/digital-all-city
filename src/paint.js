// Paint app — full MS Paint-style sketcher.
// Mounts inside a window body. Each instance owns its own canvas + state.

import { el, toast, confirmDialog, promptDialog } from './desktop.js';
import { Storage, emitStorageChange } from './storage.js';

// 28-color classic palette (top row darks, bottom row lights)
const PALETTE = [
  '#000000','#808080','#800000','#808000','#008000','#008080','#000080','#800080','#808040','#004040','#0080ff','#004080','#4000ff','#804000',
  '#ffffff','#c0c0c0','#ff0000','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff','#ffff80','#00ff80','#80ffff','#8080ff','#ff0080','#ff8040'
];

const TOOL_DEFS = [
  { id: 'select',     label: 'Free-Form Select' },
  { id: 'selectrect', label: 'Select' },
  { id: 'eraser',     label: 'Eraser',           sizes: [4, 6, 8, 12] },
  { id: 'fill',       label: 'Fill With Color' },
  { id: 'eyedropper', label: 'Pick Color' },
  { id: 'zoom',       label: 'Magnifier',        zooms: [1, 2, 4, 6, 8] },
  { id: 'pencil',     label: 'Pencil' },
  { id: 'brush',      label: 'Brush',            sizes: [1, 3, 5, 8] },
  { id: 'spray',      label: 'Airbrush',         sizes: [4, 7, 10] },
  { id: 'text',       label: 'Text',             fonts: true },
  { id: 'line',       label: 'Line',             sizes: [1, 2, 3, 5] },
  { id: 'curve',      label: 'Curve',            sizes: [1, 2, 3, 5] },
  { id: 'rect',       label: 'Rectangle',        hasFill: true },
  { id: 'polygon',    label: 'Polygon',          hasFill: true },
  { id: 'ellipse',    label: 'Ellipse',          hasFill: true },
  { id: 'roundrect',  label: 'Rounded Rectangle',hasFill: true },
];

// 16x16 1bpp tool icons. '#' = ink, '.' = empty.
const ICONS = {
  select: ['................','.#.#.#.#.#......','#...............','..............#.','#...............','..............#.','#...............','..............#.','#...............','..............#.','#...............','..............#.','#...............','.#.#.#.#.#.#.#..','................','................'],
  selectrect: ['................','#.#.#.#.#.#.#.#.','................','#.............#.','................','#.............#.','................','#.............#.','................','#.............#.','................','#.............#.','................','#.#.#.#.#.#.#.#.','................','................'],
  eraser: ['................','......######....','.....#......#...','....#......##...','...#......##.#..','..#......##..#..','.########...##..','.#......#.##....','.#......##......','.#.....##.......','.#....##........','.#...##.........','.#..##..........','.####...........','................','................'],
  fill: ['................','..........#.....','.........###....','........#####...','.......##...##..','......#......#..','.....#.......#..','....##......##..','....##.....##...','....##....##....','....##...##.....','.....####.......','.....#..........','....##.#........','...##############','................'],
  eyedropper: ['................','............###.','...........#####','..........#####.','..........###...','.........###....','........###.....','.......###......','......###.......','.....###........','....###.........','...###..........','..###...........','.###............','##..............','#...............'],
  zoom: ['................','....######......','...#......#.....','..#........#....','..#...##...#....','.#....##....#...','.#..######..#...','.#....##....#...','.#....##....#...','..#........#....','..#........#....','...#......##....','....######.##...','............##..','.............##.','..............#.'],
  pencil: ['................','............##..','...........####.','..........####..','.........####...','........####....','.......####.....','......####......','.....####.......','....####........','...####.........','..####..........','.###............','###.............','##..............','................'],
  brush: ['................','...........###..','..........#####.','.........######.','........######..','.......######...','......######....','.....######.....','....######......','...######.......','..######........','.######.........','######..........','####............','##..............','................'],
  spray: ['................','......##........','.....####.......','...##.##........','..#..####..##...','..####.######...','..#######.#.....','...####.....##..','....#.....##....','..............#.','..#.............','...........#....','....#...........','.........#......','..#.............','......#.........'],
  text: ['................','..############..','..############..','..#....##....#..','.......##.......','.......##.......','.......##.......','.......##.......','.......##.......','.......##.......','.......##.......','.......##.......','.......##.......','.....######.....','.....######.....','................'],
  line: ['................','..............##','.............##.','............##..','...........##...','..........##....','.........##.....','........##......','.......##.......','......##........','.....##.........','....##..........','...##...........','..##............','.##.............','##..............'],
  curve: ['................','...........#####','.........###....','........##......','.......##.......','......##........','......##........','.....##.........','....##..........','....##..........','....##..........','....##..........','....###.........','....####........','....######......','......##########'],
  rect: ['................','################','#..............#','#..............#','#..............#','#..............#','#..............#','#..............#','#..............#','#..............#','#..............#','#..............#','#..............#','#..............#','################','................'],
  polygon: ['................','........#.......','.......###......','......##.##.....','.....##...##....','....##.....##...','....#.......#...','....#.......#...','....#.......#...','....##.....##...','....##.....##...','....###...##....','......#####.....','........#.......','................','................'],
  ellipse: ['................','......######....','....##......##..','...##........##.','..##..........##','.##............#','.##............#','.##............#','.##............#','..##..........##','..##.........##.','...##.......##..','....##.....##...','......######....','................','................'],
  roundrect: ['................','...##########...','..#..........#..','.#............#.','#..............#','#..............#','#..............#','#..............#','#..............#','#..............#','#..............#','#..............#','.#............#.','..#..........#..','...##########...','................'],
};

function iconSvg(name) {
  const grid = ICONS[name] || [];
  let rects = '';
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '#') rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="#000"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" shape-rendering="crispEdges">${rects}</svg>`;
}

function hexToRgba(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    255
  ];
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Drawing primitives — all integer-snapped, no AA.
// ---------------------------------------------------------------------------

function stamp(target, cx, cy, size, color) {
  target.fillStyle = color;
  if (size <= 1) { target.fillRect(cx, cy, 1, 1); return; }
  const r = size / 2;
  const r2 = r * r;
  const lo = -Math.floor(r);
  const hi = Math.ceil(r) - 1;
  for (let dy = lo; dy <= hi; dy++) {
    for (let dx = lo; dx <= hi; dx++) {
      const ddx = dx + 0.5;
      const ddy = dy + 0.5;
      if (ddx * ddx + ddy * ddy <= r2) target.fillRect(cx + dx, cy + dy, 1, 1);
    }
  }
}

function stampPencil(target, cx, cy, color) {
  target.fillStyle = color;
  target.fillRect(cx, cy, 1, 1);
}

function lineStamp(target, x0, y0, x1, y1, size, color, isPencil = false) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0, y = y0;
  while (true) {
    if (isPencil) stampPencil(target, x, y, color);
    else stamp(target, x, y, size, color);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 <  dx) { err += dx; y += sy; }
  }
}

function rectOutline(target, x0, y0, x1, y1, size, color) {
  const lx = Math.min(x0, x1), rx = Math.max(x0, x1);
  const ty = Math.min(y0, y1), by = Math.max(y0, y1);
  lineStamp(target, lx, ty, rx, ty, size, color);
  lineStamp(target, rx, ty, rx, by, size, color);
  lineStamp(target, rx, by, lx, by, size, color);
  lineStamp(target, lx, by, lx, ty, size, color);
}

function rectFill(target, x0, y0, x1, y1, color) {
  const lx = Math.min(x0, x1), rx = Math.max(x0, x1);
  const ty = Math.min(y0, y1), by = Math.max(y0, y1);
  target.fillStyle = color;
  target.fillRect(lx, ty, rx - lx + 1, by - ty + 1);
}

function ellipseOutline(target, x0, y0, x1, y1, size, color) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = Math.max(0.5, Math.abs(x1 - x0) / 2);
  const ry = Math.max(0.5, Math.abs(y1 - y0) / 2);
  const steps = Math.max(8, Math.round((rx + ry) * 2));
  let prevX = Math.round(cx + rx);
  let prevY = Math.round(cy);
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const nx = Math.round(cx + Math.cos(t) * rx);
    const ny = Math.round(cy + Math.sin(t) * ry);
    lineStamp(target, prevX, prevY, nx, ny, size, color);
    prevX = nx; prevY = ny;
  }
}

function ellipseFill(target, x0, y0, x1, y1, color) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = Math.abs(x1 - x0) / 2;
  const ry = Math.abs(y1 - y0) / 2;
  if (rx < 0.5 || ry < 0.5) return;
  const x0i = Math.floor(cx - rx);
  const x1i = Math.ceil(cx + rx);
  const y0i = Math.floor(cy - ry);
  const y1i = Math.ceil(cy + ry);
  target.fillStyle = color;
  for (let y = y0i; y <= y1i; y++) {
    const dy = (y + 0.5 - cy) / ry;
    const inside = 1 - dy * dy;
    if (inside <= 0) continue;
    const half = Math.sqrt(inside) * rx;
    const xa = Math.round(cx - half);
    const xb = Math.round(cx + half);
    target.fillRect(xa, y, xb - xa + 1, 1);
  }
}

function roundRect(target, x0, y0, x1, y1, color, fillMode) {
  const lx = Math.min(x0, x1), rx = Math.max(x0, x1);
  const ty = Math.min(y0, y1), by = Math.max(y0, y1);
  const w = rx - lx, h = by - ty;
  const r = Math.min(8, Math.floor(Math.min(w, h) / 4));
  if (r <= 0) {
    if (fillMode === 'filled') rectFill(target, x0, y0, x1, y1, color);
    else rectOutline(target, x0, y0, x1, y1, 1, color);
    return;
  }
  if (fillMode === 'filled' || fillMode === 'both') {
    target.fillStyle = (fillMode === 'both') ? color : color;
    target.fillRect(lx + r, ty, w - 2 * r, h);
    target.fillRect(lx, ty + r, w, h - 2 * r);
    // corners (filled)
    fillCorner(target, lx + r, ty + r, r, color, Math.PI, 1.5 * Math.PI);
    fillCorner(target, rx - r, ty + r, r, color, 1.5 * Math.PI, 2 * Math.PI);
    fillCorner(target, rx - r, by - r, r, color, 0, 0.5 * Math.PI);
    fillCorner(target, lx + r, by - r, r, color, 0.5 * Math.PI, Math.PI);
  }
  if (fillMode === 'outline' || fillMode === 'both') {
    lineStamp(target, lx + r, ty, rx - r, ty, 1, color);
    lineStamp(target, lx + r, by, rx - r, by, 1, color);
    lineStamp(target, lx, ty + r, lx, by - r, 1, color);
    lineStamp(target, rx, ty + r, rx, by - r, 1, color);
    drawCorner(target, lx + r, ty + r, r, color, Math.PI, 1.5 * Math.PI);
    drawCorner(target, rx - r, ty + r, r, color, 1.5 * Math.PI, 2 * Math.PI);
    drawCorner(target, rx - r, by - r, r, color, 0, 0.5 * Math.PI);
    drawCorner(target, lx + r, by - r, r, color, 0.5 * Math.PI, Math.PI);
  }
}

function drawCorner(target, cx, cy, r, color, t0, t1) {
  const steps = Math.max(6, r * 4);
  let prevX = Math.round(cx + Math.cos(t0) * r);
  let prevY = Math.round(cy + Math.sin(t0) * r);
  for (let i = 1; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i / steps);
    const nx = Math.round(cx + Math.cos(t) * r);
    const ny = Math.round(cy + Math.sin(t) * r);
    lineStamp(target, prevX, prevY, nx, ny, 1, color);
    prevX = nx; prevY = ny;
  }
}

function fillCorner(target, cx, cy, r, color, t0, t1) {
  // Naive — draw fan of triangles via tiny line sweeps.
  target.fillStyle = color;
  const steps = Math.max(6, r * 4);
  for (let i = 0; i < steps; i++) {
    const t = t0 + ((t1 - t0) * i / steps);
    const nx = cx + Math.cos(t) * r;
    const ny = cy + Math.sin(t) * r;
    lineStamp(target, Math.round(cx), Math.round(cy), Math.round(nx), Math.round(ny), 1, color);
  }
}

function spray(target, cx, cy, radius, color) {
  target.fillStyle = color;
  const density = Math.max(4, Math.floor(radius * 1.4));
  for (let i = 0; i < density; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * radius;
    const px = Math.floor(cx + Math.cos(angle) * dist);
    const py = Math.floor(cy + Math.sin(angle) * dist);
    target.fillRect(px, py, 1, 1);
  }
}

function floodFill(ctx, w, h, sx, sy, fillHex) {
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const start = (sy * w + sx) * 4;
  const tr = data[start], tg = data[start + 1], tb = data[start + 2], ta = data[start + 3];
  const [fr, fg, fb, fa] = hexToRgba(fillHex);
  if (tr === fr && tg === fg && tb === fb && ta === fa) return;
  const stack = [sx, sy];
  while (stack.length) {
    const py = stack.pop();
    const px = stack.pop();
    if (px < 0 || py < 0 || px >= w || py >= h) continue;
    const i = (py * w + px) * 4;
    if (data[i] !== tr || data[i+1] !== tg || data[i+2] !== tb || data[i+3] !== ta) continue;
    data[i] = fr; data[i+1] = fg; data[i+2] = fb; data[i+3] = fa;
    stack.push(px + 1, py);
    stack.push(px - 1, py);
    stack.push(px, py + 1);
    stack.push(px, py - 1);
  }
  ctx.putImageData(img, 0, 0);
}

// Cubic Bezier, integer-stamped — used for the curve tool.
function bezier(target, p0, p1, p2, p3, size, color) {
  const steps = 60;
  let prevX = p0.x, prevY = p0.y;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = Math.round(u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x);
    const y = Math.round(u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y);
    lineStamp(target, prevX, prevY, x, y, size, color);
    prevX = x; prevY = y;
  }
}

// Even-odd polygon fill via scanline.
function polygonFill(target, points, color) {
  if (points.length < 3) return;
  let yMin = Infinity, yMax = -Infinity;
  for (const p of points) { if (p.y < yMin) yMin = p.y; if (p.y > yMax) yMax = p.y; }
  target.fillStyle = color;
  for (let y = Math.floor(yMin); y <= Math.ceil(yMax); y++) {
    const xs = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        const t = (y - a.y) / (b.y - a.y);
        xs.push(a.x + t * (b.x - a.x));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.round(xs[k]);
      const x1 = Math.round(xs[k + 1]);
      target.fillRect(x0, y, x1 - x0 + 1, 1);
    }
  }
}

function polygonOutline(target, points, size, color) {
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    lineStamp(target, a.x, a.y, b.x, b.y, size, color);
  }
}

// Bake text to a temp canvas, threshold alpha to keep edges crisp.
function bakeText(text, font, color) {
  const tmp = document.createElement('canvas').getContext('2d');
  tmp.font = font;
  const m = tmp.measureText(text || ' ');
  const ascent = m.actualBoundingBoxAscent || parseInt(font, 10) * 0.8;
  const descent = m.actualBoundingBoxDescent || parseInt(font, 10) * 0.2;
  const w = Math.max(1, Math.ceil(m.width) + 2);
  const h = Math.max(1, Math.ceil(ascent + descent) + 2);
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const c = off.getContext('2d');
  c.font = font;
  c.fillStyle = color;
  c.textBaseline = 'top';
  c.fillText(text, 1, 1);
  // Threshold alpha for hard edges.
  const img = c.getImageData(0, 0, w, h);
  for (let i = 3; i < img.data.length; i += 4) {
    img.data[i] = img.data[i] > 128 ? 255 : 0;
  }
  c.putImageData(img, 0, 0);
  return off;
}

// ---------------------------------------------------------------------------
// Paint app factory
// ---------------------------------------------------------------------------

let instanceCounter = 0;

export function createPaintApp(body, env) {
  const instId = ++instanceCounter;
  const state = {
    tool: 'pencil',
    fg: '#000000',
    bg: '#ffffff',
    size: 1,
    activeColor: '#000000',
    drawing: false,
    button: 0,
    lastPos: null,
    startPos: null,
    fillMode: 'outline',
    pieceId: null,
    docName: 'untitled',
    dirty: false,
    undoStack: [],
    redoStack: [],
    // Curve-specific staging
    curve: null,
    // Polygon-specific staging
    polyPoints: null,
    // Rect-select staging
    selection: null,  // { x, y, w, h, dragging, dragOffset, imageData }
    // Text staging
    textBox: null,
    // Zoom factor
    zoom: 1,
    fontFamily: 'Times New Roman',
    fontSize: 16,
    fontBold: false,
    fontItalic: false,
  };

  body.style.flexDirection = 'column';
  body.classList.add('paint-window-body');
  body.style.flex = '1';
  body.style.display = 'flex';

  // ---- Menubar
  const menubar = el('div', { class: 'menubar' });
  const menus = [
    { id: 'file', label: 'File', items: [
      { action: 'new',     label: 'New',                shortcut: 'Ctrl+N' },
      { action: 'open',    label: 'Open from Gallery...', shortcut: 'Ctrl+O' },
      { action: 'save',    label: 'Save',               shortcut: 'Ctrl+S' },
      { action: 'saveas',  label: 'Save As...' },
      { action: 'place',   label: 'Save & Place at...' },
      { sep: true },
      { action: 'export',  label: 'Export PNG' },
    ]},
    { id: 'edit', label: 'Edit', items: [
      { action: 'undo',  label: 'Undo',  shortcut: 'Ctrl+Z' },
      { action: 'redo',  label: 'Redo',  shortcut: 'Ctrl+Y' },
      { sep: true },
      { action: 'cut',   label: 'Cut',   shortcut: 'Ctrl+X' },
      { action: 'copy',  label: 'Copy',  shortcut: 'Ctrl+C' },
      { action: 'paste', label: 'Paste', shortcut: 'Ctrl+V' },
      { sep: true },
      { action: 'clear', label: 'Clear Image', shortcut: 'Ctrl+Shift+N' },
    ]},
    { id: 'view', label: 'View', items: [
      { action: 'zoomin',  label: 'Zoom In',  shortcut: 'Ctrl+=' },
      { action: 'zoomout', label: 'Zoom Out', shortcut: 'Ctrl+-' },
      { action: 'zoom1',   label: 'Normal Size (100%)' },
    ]},
    { id: 'image', label: 'Image', items: [
      { action: 'attrs',  label: 'Attributes...' },
      { action: 'invert', label: 'Invert Colors', shortcut: 'Ctrl+I' },
      { action: 'fliph',  label: 'Flip Horizontal' },
      { action: 'flipv',  label: 'Flip Vertical' },
      { action: 'rot90',  label: 'Rotate 90 Right' },
    ]},
    { id: 'help', label: 'Help', items: [
      { action: 'about', label: 'About Digital All City' },
    ]},
  ];

  menus.forEach(m => {
    const items = el('div', { class: 'dropdown' });
    m.items.forEach(it => {
      if (it.sep) { items.appendChild(el('div', { class: 'dropdown-sep' })); return; }
      const item = el('div', {
        class: 'dropdown-item',
        onClick: e => { e.stopPropagation(); closeMenus(); runAction(it.action); },
      },
        el('span', {}, it.label),
        el('span', {}, it.shortcut || ''),
      );
      items.appendChild(item);
    });
    const menu = el('div', { class: 'menu' }, document.createTextNode(m.label));
    menu.appendChild(items);
    menu.addEventListener('click', e => {
      const wasOpen = menu.classList.contains('open');
      closeMenus();
      if (!wasOpen) menu.classList.add('open');
      e.stopPropagation();
    });
    menubar.appendChild(menu);
  });
  body.appendChild(menubar);

  function closeMenus() {
    menubar.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open'));
  }
  document.addEventListener('mousedown', closeMenus);

  // ---- Toolbox + canvas area
  const inner = el('div', { style: 'display:flex; flex:1; min-height:0;' });
  const toolboxEl = el('div', { class: 'toolbox' });
  const toolGrid = el('div', { class: 'tool-grid' });
  const optionsEl = el('div', { class: 'options' });
  toolboxEl.appendChild(toolGrid);
  toolboxEl.appendChild(optionsEl);

  const canvasArea = el('div', { class: 'canvas-area' });
  const frame = el('div', { class: 'canvas-frame' });
  const canvas = el('canvas', { class: 'paint-canvas', width: 480, height: 360 });
  const preview = el('canvas', { class: 'paint-preview', width: 480, height: 360 });
  frame.appendChild(canvas);
  frame.appendChild(preview);
  canvasArea.appendChild(frame);

  inner.appendChild(toolboxEl);
  inner.appendChild(canvasArea);
  body.appendChild(inner);

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pctx = preview.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  pctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Tool buttons
  TOOL_DEFS.forEach(t => {
    const btn = el('button', {
      class: 'tool',
      title: t.label,
      onClick: () => selectTool(t.id),
    });
    btn.dataset.tool = t.id;
    btn.innerHTML = iconSvg(t.id);
    toolGrid.appendChild(btn);
  });

  // ---- Palette
  const paletteRow = el('div', { class: 'palette-row' });
  const colors = el('div', { class: 'current-colors' });
  const fgSwatch = el('div', { class: 'fg' });
  const bgSwatch = el('div', { class: 'bg' });
  colors.appendChild(fgSwatch);
  colors.appendChild(bgSwatch);
  const paletteEl = el('div', { class: 'palette' });
  PALETTE.forEach(c => {
    const sw = el('div', { class: 'swatch', title: c });
    sw.style.background = c;
    sw.addEventListener('click', () => { state.fg = c; updateColors(); });
    sw.addEventListener('contextmenu', e => { e.preventDefault(); state.bg = c; updateColors(); });
    paletteEl.appendChild(sw);
  });
  paletteRow.appendChild(colors);
  paletteRow.appendChild(paletteEl);
  body.appendChild(paletteRow);

  // ---- Status bar
  const statusbar = el('div', { class: 'statusbar' });
  const statusTip = el('div', { class: 'grow' }, 'For Help, click Help Topics on the Help Menu.');
  const statusPos = el('div', {}, ' ');
  const statusSize = el('div', {}, '480 x 360');
  statusbar.appendChild(statusTip);
  statusbar.appendChild(statusPos);
  statusbar.appendChild(statusSize);
  body.appendChild(statusbar);

  // ---- State helpers
  function updateColors() {
    fgSwatch.style.background = state.fg;
    bgSwatch.style.background = state.bg;
  }

  function setDirty(d) {
    state.dirty = d;
    env.setTitle((d ? '*' : '') + state.docName + ' - All City');
  }

  function pushUndo() {
    state.undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (state.undoStack.length > 32) state.undoStack.shift();
    state.redoStack.length = 0;
    setDirty(true);
  }
  function undo() {
    if (!state.undoStack.length) return;
    state.redoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(state.undoStack.pop(), 0, 0);
  }
  function redo() {
    if (!state.redoStack.length) return;
    state.undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(state.redoStack.pop(), 0, 0);
  }

  function clearPreview() { pctx.clearRect(0, 0, preview.width, preview.height); }

  function selectTool(id) {
    commitPendingTool();  // commit text/curve/polygon if any
    state.tool = id;
    toolGrid.querySelectorAll('.tool').forEach(t => {
      t.classList.toggle('active', t.dataset.tool === id);
    });
    const def = TOOL_DEFS.find(t => t.id === id);
    statusTip.textContent = def ? def.label : '';
    renderOptions();
    // Default size pick when tool changes
    if (def?.sizes && !def.sizes.includes(state.size)) state.size = def.sizes[0];
  }

  function renderOptions() {
    optionsEl.innerHTML = '';
    const def = TOOL_DEFS.find(t => t.id === state.tool);
    if (!def) return;

    if (def.hasFill) {
      const modes = [
        { id: 'outline', label: 'Outline only' },
        { id: 'both',    label: 'Outline + fill' },
        { id: 'filled',  label: 'Solid fill' },
      ];
      modes.forEach(m => {
        const b = el('button', {
          class: 'size-btn' + (state.fillMode === m.id ? ' active' : ''),
          title: m.label,
          onClick: () => { state.fillMode = m.id; renderOptions(); },
        });
        b.innerHTML = renderFillIcon(m.id);
        optionsEl.appendChild(b);
      });
    }

    if (def.sizes) {
      def.sizes.forEach(sz => {
        const b = el('button', {
          class: 'size-btn' + (state.size === sz ? ' active' : ''),
          title: sz + 'px',
          onClick: () => { state.size = sz; renderOptions(); },
        });
        const dot = el('div', { class: 'size-dot' });
        const visual = Math.max(2, Math.min(14, sz));
        dot.style.width = visual + 'px';
        dot.style.height = visual + 'px';
        if (def.id === 'eraser') dot.style.borderRadius = '0';
        b.appendChild(dot);
        optionsEl.appendChild(b);
      });
    }

    if (def.zooms) {
      def.zooms.forEach(z => {
        const b = el('button', {
          class: 'size-btn' + (state.zoom === z ? ' active' : ''),
          onClick: () => { state.zoom = z; applyZoom(); renderOptions(); },
        });
        b.textContent = z + 'x';
        optionsEl.appendChild(b);
      });
    }

    if (def.fonts) {
      const fontSel = el('select', { class: 'input', style: 'width: 44px; font-size: 9px;' });
      ['Times New Roman','Arial','Courier New','Comic Sans MS','Impact'].forEach(f => {
        const o = el('option', { value: f }, f);
        if (state.fontFamily === f) o.setAttribute('selected', '');
        fontSel.appendChild(o);
      });
      fontSel.addEventListener('change', () => { state.fontFamily = fontSel.value; });
      optionsEl.appendChild(fontSel);

      const sizeSel = el('select', { class: 'input', style: 'width: 44px; font-size: 9px;' });
      [10, 12, 14, 16, 20, 24, 32, 48].forEach(s => {
        const o = el('option', { value: s }, s + 'px');
        if (state.fontSize === s) o.setAttribute('selected', '');
        sizeSel.appendChild(o);
      });
      sizeSel.addEventListener('change', () => { state.fontSize = parseInt(sizeSel.value, 10); });
      optionsEl.appendChild(sizeSel);

      const bBtn = el('button', { class: 'size-btn' + (state.fontBold ? ' active' : ''), style: 'font-weight: bold;', onClick: () => { state.fontBold = !state.fontBold; renderOptions(); } }, 'B');
      const iBtn = el('button', { class: 'size-btn' + (state.fontItalic ? ' active' : ''), style: 'font-style: italic;', onClick: () => { state.fontItalic = !state.fontItalic; renderOptions(); } }, 'I');
      optionsEl.appendChild(bBtn);
      optionsEl.appendChild(iBtn);
    }
  }

  function renderFillIcon(mode) {
    if (mode === 'outline') return '<svg width="32" height="14" viewBox="0 0 32 14"><rect x="2" y="2" width="28" height="10" fill="none" stroke="black" stroke-width="1"/></svg>';
    if (mode === 'filled')  return '<svg width="32" height="14" viewBox="0 0 32 14"><rect x="2" y="2" width="28" height="10" fill="black"/></svg>';
    return '<svg width="32" height="14" viewBox="0 0 32 14"><rect x="2" y="2" width="28" height="10" fill="#888" stroke="black" stroke-width="1"/></svg>';
  }

  function applyZoom() {
    canvas.style.width  = (canvas.width  * state.zoom) + 'px';
    canvas.style.height = (canvas.height * state.zoom) + 'px';
    preview.style.width  = (preview.width  * state.zoom) + 'px';
    preview.style.height = (preview.height * state.zoom) + 'px';
  }

  // ---- Mouse / touch
  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - r.left) * (canvas.width / r.width)),
      y: Math.floor((e.clientY - r.top) * (canvas.height / r.height)),
    };
  }

  preview.addEventListener('contextmenu', e => e.preventDefault());

  preview.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  preview.addEventListener('touchstart', e => { e.preventDefault(); touchToMouse(e, onDown); }, { passive: false });
  preview.addEventListener('touchmove',  e => { e.preventDefault(); touchToMouse(e, onMove); }, { passive: false });
  preview.addEventListener('touchend',   e => { e.preventDefault(); touchToMouse(e, onUp); }, { passive: false });

  function touchToMouse(e, handler) {
    const t = e.touches[0] || e.changedTouches[0];
    if (!t) return;
    handler({ clientX: t.clientX, clientY: t.clientY, button: 0, preventDefault: () => e.preventDefault() });
  }

  function onDown(e) {
    if (e.target !== preview && e.target !== canvas) return;
    if (e.preventDefault) e.preventDefault();
    if (e.button === 1) return;
    const pos = getPos(e);
    const color = e.button === 2 ? state.bg : state.fg;
    state.activeColor = color;
    state.button = e.button;

    // Single-shot tools
    if (state.tool === 'eyedropper') {
      const d = ctx.getImageData(pos.x, pos.y, 1, 1).data;
      const hex = rgbToHex(d[0], d[1], d[2]);
      if (e.button === 2) state.bg = hex; else state.fg = hex;
      updateColors();
      return;
    }
    if (state.tool === 'fill') {
      pushUndo();
      floodFill(ctx, canvas.width, canvas.height, pos.x, pos.y, color);
      return;
    }
    if (state.tool === 'zoom') {
      // Cycle through zooms
      const zooms = TOOL_DEFS.find(t => t.id === 'zoom').zooms;
      const i = zooms.indexOf(state.zoom);
      state.zoom = zooms[(i + 1) % zooms.length];
      applyZoom();
      renderOptions();
      return;
    }

    // Curve tool — multi-step
    if (state.tool === 'curve') {
      handleCurveDown(pos, color);
      return;
    }

    // Polygon — multi-click
    if (state.tool === 'polygon') {
      handlePolyDown(pos, color, e);
      return;
    }

    // Text — start a text box
    if (state.tool === 'text') {
      pushUndo();
      state.drawing = true;
      state.startPos = pos;
      return;
    }

    // Selection (rect)
    if (state.tool === 'selectrect' || state.tool === 'select') {
      handleSelectDown(pos);
      return;
    }

    // Standard draw tools
    pushUndo();
    state.drawing = true;
    state.startPos = pos;
    state.lastPos = pos;

    if (state.tool === 'pencil') stampPencil(ctx, pos.x, pos.y, color);
    else if (state.tool === 'brush') stamp(ctx, pos.x, pos.y, state.size, color);
    else if (state.tool === 'eraser') stamp(ctx, pos.x, pos.y, state.size, state.bg);
    else if (state.tool === 'spray') spray(ctx, pos.x, pos.y, state.size, color);
    else if (['line','rect','ellipse','roundrect'].includes(state.tool)) clearPreview();
  }

  function onMove(e) {
    const pos = getPos(e);
    statusPos.textContent = pos.x + ',' + pos.y;

    // Curve preview
    if (state.tool === 'curve' && state.curve) {
      handleCurveMove(pos);
      return;
    }
    // Polygon preview
    if (state.tool === 'polygon' && state.polyPoints) {
      handlePolyMove(pos);
      return;
    }
    // Selection move/drag
    if ((state.tool === 'selectrect' || state.tool === 'select') && state.selection) {
      handleSelectMove(pos);
      return;
    }

    if (!state.drawing) return;
    const color = state.activeColor;

    if (state.tool === 'pencil') {
      lineStamp(ctx, state.lastPos.x, state.lastPos.y, pos.x, pos.y, 1, color, true);
    } else if (state.tool === 'brush') {
      lineStamp(ctx, state.lastPos.x, state.lastPos.y, pos.x, pos.y, state.size, color);
    } else if (state.tool === 'eraser') {
      lineStamp(ctx, state.lastPos.x, state.lastPos.y, pos.x, pos.y, state.size, state.bg);
    } else if (state.tool === 'spray') {
      const steps = Math.max(1, Math.hypot(pos.x - state.lastPos.x, pos.y - state.lastPos.y) | 0);
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const ix = Math.round(state.lastPos.x + (pos.x - state.lastPos.x) * t);
        const iy = Math.round(state.lastPos.y + (pos.y - state.lastPos.y) * t);
        spray(ctx, ix, iy, state.size, color);
      }
    } else if (state.tool === 'line') {
      clearPreview();
      lineStamp(pctx, state.startPos.x, state.startPos.y, pos.x, pos.y, state.size, color);
    } else if (state.tool === 'rect') {
      clearPreview();
      drawShapePreview('rect', state.startPos, pos, color);
    } else if (state.tool === 'ellipse') {
      clearPreview();
      drawShapePreview('ellipse', state.startPos, pos, color);
    } else if (state.tool === 'roundrect') {
      clearPreview();
      drawShapePreview('roundrect', state.startPos, pos, color);
    } else if (state.tool === 'text') {
      clearPreview();
      rectOutline(pctx, state.startPos.x, state.startPos.y, pos.x, pos.y, 1, '#888');
    }
    state.lastPos = pos;
  }

  function onUp(e) {
    if ((state.tool === 'selectrect' || state.tool === 'select') && state.selection) {
      handleSelectUp();
      return;
    }
    if (!state.drawing) return;
    const pos = state.lastPos || state.startPos;
    const color = state.activeColor;

    if (state.tool === 'text') {
      // Spawn text editor
      const x0 = Math.min(state.startPos.x, pos.x);
      const y0 = Math.min(state.startPos.y, pos.y);
      const x1 = Math.max(state.startPos.x, pos.x);
      const y1 = Math.max(state.startPos.y, pos.y);
      clearPreview();
      spawnTextEditor(x0, y0, x1, y1, color);
    } else if (['line','rect','ellipse','roundrect'].includes(state.tool)) {
      ctx.drawImage(preview, 0, 0);
      clearPreview();
    }

    state.drawing = false;
    state.lastPos = null;
    state.startPos = null;
  }

  function drawShapePreview(kind, a, b, color) {
    if (kind === 'rect') {
      if (state.fillMode === 'filled') rectFill(pctx, a.x, a.y, b.x, b.y, color);
      else if (state.fillMode === 'both') {
        rectFill(pctx, a.x, a.y, b.x, b.y, state.bg);
        rectOutline(pctx, a.x, a.y, b.x, b.y, 1, color);
      } else rectOutline(pctx, a.x, a.y, b.x, b.y, 1, color);
    } else if (kind === 'ellipse') {
      if (state.fillMode === 'filled') ellipseFill(pctx, a.x, a.y, b.x, b.y, color);
      else if (state.fillMode === 'both') {
        ellipseFill(pctx, a.x, a.y, b.x, b.y, state.bg);
        ellipseOutline(pctx, a.x, a.y, b.x, b.y, 1, color);
      } else ellipseOutline(pctx, a.x, a.y, b.x, b.y, 1, color);
    } else if (kind === 'roundrect') {
      const fm = state.fillMode === 'filled' ? 'filled' : (state.fillMode === 'both' ? 'both' : 'outline');
      if (fm === 'both') {
        roundRect(pctx, a.x, a.y, b.x, b.y, state.bg, 'filled');
        roundRect(pctx, a.x, a.y, b.x, b.y, color, 'outline');
      } else {
        roundRect(pctx, a.x, a.y, b.x, b.y, color, fm);
      }
    }
  }

  // ---- Curve tool
  function handleCurveDown(pos, color) {
    if (!state.curve) {
      // Phase 1: start endpoint
      pushUndo();
      state.curve = { phase: 1, p0: pos, p3: pos, p1: null, p2: null, color };
    } else if (state.curve.phase === 'wait1') {
      state.curve.phase = 2;
    } else if (state.curve.phase === 'wait2') {
      state.curve.phase = 3;
    }
  }
  function handleCurveMove(pos) {
    if (!state.curve) return;
    const c = state.curve;
    clearPreview();
    if (c.phase === 1) {
      c.p3 = pos;
      lineStamp(pctx, c.p0.x, c.p0.y, c.p3.x, c.p3.y, state.size, c.color);
    } else if (c.phase === 'wait1' || c.phase === 2) {
      c.p1 = pos;
      c.p2 = c.p2 || pos;
      bezier(pctx, c.p0, c.p1, c.p2, c.p3, state.size, c.color);
    } else if (c.phase === 'wait2' || c.phase === 3) {
      c.p2 = pos;
      bezier(pctx, c.p0, c.p1, c.p2, c.p3, state.size, c.color);
    }
  }
  preview.addEventListener('mouseup', () => {
    const c = state.curve;
    if (!c) return;
    if (c.phase === 1) {
      c.phase = 'wait1';  // wait for next click
      // Initialize control points to endpoints (straight line)
      c.p1 = { ...c.p0 };
      c.p2 = { ...c.p3 };
    } else if (c.phase === 2) {
      c.phase = 'wait2';
    } else if (c.phase === 3) {
      // Commit
      ctx.drawImage(preview, 0, 0);
      clearPreview();
      state.curve = null;
    }
  });

  function commitCurve() {
    if (!state.curve) return;
    if (state.curve.phase !== 1) ctx.drawImage(preview, 0, 0);
    clearPreview();
    state.curve = null;
  }

  // ---- Polygon tool
  function handlePolyDown(pos, color, e) {
    if (!state.polyPoints) {
      pushUndo();
      state.polyPoints = { points: [pos], color };
      return;
    }
    const pts = state.polyPoints.points;
    const start = pts[0];
    // Click near start = close
    if (Math.abs(pos.x - start.x) < 5 && Math.abs(pos.y - start.y) < 5 && pts.length >= 3) {
      commitPolygon();
      return;
    }
    pts.push(pos);
    // Double-click also closes
    if (e.detail >= 2 && pts.length >= 3) commitPolygon();
  }
  function handlePolyMove(pos) {
    if (!state.polyPoints) return;
    const pts = state.polyPoints.points;
    const color = state.polyPoints.color;
    clearPreview();
    // Render preview: closed polygon if filled mode, else open path with cursor
    const all = [...pts, pos];
    if (state.fillMode === 'filled' || state.fillMode === 'both') {
      polygonFill(pctx, [...pts, pos], state.fillMode === 'filled' ? color : state.bg);
    }
    if (state.fillMode === 'outline' || state.fillMode === 'both') {
      for (let i = 0; i + 1 < all.length; i++) {
        lineStamp(pctx, all[i].x, all[i].y, all[i+1].x, all[i+1].y, state.size, color);
      }
      // Hint line back to start
      if (pts.length >= 2) {
        const start = pts[0];
        for (let x = 0; x < 20; x++) {
          const t = x / 20;
          if (x % 2 === 0) {
            const px = Math.round(pos.x + (start.x - pos.x) * t);
            const py = Math.round(pos.y + (start.y - pos.y) * t);
            stamp(pctx, px, py, 1, '#888');
          }
        }
      }
    }
  }
  function commitPolygon() {
    if (!state.polyPoints) return;
    const pts = state.polyPoints.points;
    const color = state.polyPoints.color;
    clearPreview();
    if (state.fillMode === 'filled' || state.fillMode === 'both') {
      polygonFill(ctx, pts, state.fillMode === 'filled' ? color : state.bg);
    }
    if (state.fillMode === 'outline' || state.fillMode === 'both') {
      polygonOutline(ctx, pts, state.size, color);
    }
    state.polyPoints = null;
  }

  // ---- Selection (rect)
  function handleSelectDown(pos) {
    // If clicking inside an existing selection, start drag.
    if (state.selection && pos.x >= state.selection.x && pos.x <= state.selection.x + state.selection.w
        && pos.y >= state.selection.y && pos.y <= state.selection.y + state.selection.h) {
      state.selection.dragging = true;
      state.selection.dragOffset = { x: pos.x - state.selection.x, y: pos.y - state.selection.y };
      return;
    }
    // Commit any prior selection
    if (state.selection) commitSelection();
    pushUndo();
    state.drawing = true;
    state.startPos = pos;
    state.selection = null;
  }
  function handleSelectMove(pos) {
    if (state.selection?.dragging) {
      const nx = pos.x - state.selection.dragOffset.x;
      const ny = pos.y - state.selection.dragOffset.y;
      // Erase the area where selection currently is on the main canvas (paint over with bg)
      if (!state.selection.lifted) {
        ctx.fillStyle = state.bg;
        ctx.fillRect(state.selection.origX, state.selection.origY, state.selection.w, state.selection.h);
        state.selection.lifted = true;
      }
      state.selection.x = nx;
      state.selection.y = ny;
      drawSelectionPreview();
      return;
    }
    if (!state.drawing) return;
    clearPreview();
    rectOutline(pctx, state.startPos.x, state.startPos.y, pos.x, pos.y, 1, '#000');
    // Ant pattern overlay — every other pixel light
    state.lastPos = pos;
  }
  function handleSelectUp() {
    if (state.selection?.dragging) {
      state.selection.dragging = false;
      return;
    }
    if (!state.drawing) return;
    state.drawing = false;
    if (!state.lastPos) { state.startPos = null; return; }
    const x0 = Math.min(state.startPos.x, state.lastPos.x);
    const y0 = Math.min(state.startPos.y, state.lastPos.y);
    const x1 = Math.max(state.startPos.x, state.lastPos.x);
    const y1 = Math.max(state.startPos.y, state.lastPos.y);
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (w < 2 || h < 2) { state.startPos = null; clearPreview(); return; }
    const data = ctx.getImageData(x0, y0, w, h);
    state.selection = { x: x0, y: y0, w, h, origX: x0, origY: y0, imageData: data, dragging: false, lifted: false };
    drawSelectionPreview();
    state.startPos = null;
    state.lastPos = null;
  }
  function drawSelectionPreview() {
    if (!state.selection) return;
    clearPreview();
    pctx.putImageData(state.selection.imageData, state.selection.x, state.selection.y);
    rectOutline(pctx, state.selection.x, state.selection.y, state.selection.x + state.selection.w - 1, state.selection.y + state.selection.h - 1, 1, '#000');
  }
  function commitSelection() {
    if (!state.selection) return;
    if (state.selection.lifted || state.selection.x !== state.selection.origX || state.selection.y !== state.selection.origY) {
      ctx.putImageData(state.selection.imageData, state.selection.x, state.selection.y);
    }
    state.selection = null;
    clearPreview();
  }

  // ---- Text editor
  function spawnTextEditor(x0, y0, x1, y1, color) {
    const w = Math.max(20, x1 - x0);
    const h = Math.max(20, y1 - y0);
    const ta = el('textarea', { class: 'text-edit', spellcheck: 'false' });
    ta.style.color = color;
    ta.style.fontFamily = state.fontFamily;
    ta.style.fontSize = state.fontSize + 'px';
    if (state.fontBold) ta.style.fontWeight = 'bold';
    if (state.fontItalic) ta.style.fontStyle = 'italic';
    // Position relative to canvas frame; canvas may be zoomed so multiply.
    const z = state.zoom;
    ta.style.left = (x0 * z) + 'px';
    ta.style.top = (y0 * z) + 'px';
    ta.style.minWidth = (w * z) + 'px';
    ta.style.minHeight = (h * z) + 'px';
    frame.appendChild(ta);
    setTimeout(() => ta.focus(), 0);

    const commit = () => {
      const text = ta.value;
      ta.remove();
      if (!text.trim()) return;
      const fontStr = (state.fontBold ? 'bold ' : '') + (state.fontItalic ? 'italic ' : '') + state.fontSize + 'px ' + state.fontFamily;
      // Render line by line
      const lines = text.split('\n');
      let yCursor = y0;
      for (const line of lines) {
        if (line.length) {
          const baked = bakeText(line, fontStr, color);
          ctx.drawImage(baked, x0, yCursor);
        }
        yCursor += state.fontSize + 2;
      }
    };
    ta.addEventListener('blur', commit, { once: true });
    ta.addEventListener('keydown', e => {
      if (e.key === 'Escape') { ta.value = ''; ta.blur(); }
    });
  }

  function commitPendingTool() {
    commitCurve();
    if (state.polyPoints) {
      // If at least 3 points, close it.
      if (state.polyPoints.points.length >= 3) commitPolygon();
      else { state.polyPoints = null; clearPreview(); }
    }
    if (state.selection) commitSelection();
    // Commit any open text editor
    const ta = frame.querySelector('.text-edit');
    if (ta) ta.blur();
  }

  // ---- Action runner (file/edit menus + keyboard)
  async function runAction(action) {
    if (action === 'new') {
      if (state.dirty && !(await confirmDialog({ message: 'Discard current image?' }))) return;
      pushUndo();
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      state.pieceId = null;
      state.docName = 'untitled';
      setDirty(false);
    } else if (action === 'export') {
      const link = document.createElement('a');
      link.download = (state.docName || 'untitled') + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } else if (action === 'save' || action === 'saveas') {
      let name = state.docName;
      if (action === 'saveas' || !state.pieceId) {
        name = await promptDialog({ title: 'Save As', message: 'Sketch name:', defaultValue: name === 'untitled' ? '' : name });
        if (name === null) return;
        name = name.trim() || 'untitled';
      }
      try {
        const meta = await Storage.save({
          id: action === 'saveas' ? null : state.pieceId,
          name,
          dataURL: canvas.toDataURL('image/png'),
          width: canvas.width, height: canvas.height,
        });
        state.pieceId = meta.id;
        state.docName = meta.name;
        setDirty(false);
        emitStorageChange();
        toast('Saved.');
      } catch (e) {
        toast(e.message);
      }
    } else if (action === 'place') {
      // Save (or use existing piece) + grab GPS
      let id = state.pieceId;
      if (!id) {
        let name = await promptDialog({ title: 'Save & Place', message: 'Sketch name:', defaultValue: '' });
        if (name === null) return;
        name = (name || '').trim() || 'untitled';
        try {
          const meta = await Storage.save({
            name,
            dataURL: canvas.toDataURL('image/png'),
            width: canvas.width, height: canvas.height,
          });
          id = meta.id;
          state.pieceId = id;
          state.docName = meta.name;
          setDirty(false);
        } catch (e) { toast(e.message); return; }
      }
      // Get GPS
      if (!navigator.geolocation) { toast('Geolocation unavailable.'); return; }
      toast('Locating...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const geotag = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          Storage.setGeotag(id, geotag, null);
          emitStorageChange();
          toast('Placed at ' + geotag.lat.toFixed(4) + ', ' + geotag.lng.toFixed(4));
        },
        (err) => { toast('Location denied: ' + err.message); },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else if (action === 'open') {
      env.open('gallery', { singleton: true });
    } else if (action === 'undo') undo();
    else if (action === 'redo') redo();
    else if (action === 'clear') { pushUndo(); ctx.fillStyle = state.bg; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    else if (action === 'invert') {
      pushUndo();
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i+1] = 255 - d[i+1]; d[i+2] = 255 - d[i+2]; }
      ctx.putImageData(img, 0, 0);
    } else if (action === 'fliph') {
      pushUndo();
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width; tmp.height = canvas.height;
      const tctx = tmp.getContext('2d');
      tctx.imageSmoothingEnabled = false;
      tctx.translate(canvas.width, 0);
      tctx.scale(-1, 1);
      tctx.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tmp, 0, 0);
    } else if (action === 'flipv') {
      pushUndo();
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width; tmp.height = canvas.height;
      const tctx = tmp.getContext('2d');
      tctx.imageSmoothingEnabled = false;
      tctx.translate(0, canvas.height);
      tctx.scale(1, -1);
      tctx.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tmp, 0, 0);
    } else if (action === 'rot90') {
      pushUndo();
      const tmp = document.createElement('canvas');
      tmp.width = canvas.height; tmp.height = canvas.width;
      const tctx = tmp.getContext('2d');
      tctx.imageSmoothingEnabled = false;
      tctx.translate(tmp.width, 0);
      tctx.rotate(Math.PI / 2);
      tctx.drawImage(canvas, 0, 0);
      canvas.width = tmp.width; canvas.height = tmp.height;
      preview.width = tmp.width; preview.height = tmp.height;
      ctx.imageSmoothingEnabled = false;
      pctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0);
      statusSize.textContent = canvas.width + ' x ' + canvas.height;
      applyZoom();
    } else if (action === 'attrs') {
      const s = await promptDialog({ title: 'Attributes', message: 'Width x Height (e.g. 480x360):', defaultValue: canvas.width + 'x' + canvas.height });
      if (!s) return;
      const m = s.match(/(\d+)\s*[x×]\s*(\d+)/i);
      if (!m) { toast('Invalid format.'); return; }
      const w = +m[1], h = +m[2];
      if (w < 1 || h < 1 || w > 4096 || h > 4096) { toast('Out of range.'); return; }
      pushUndo();
      const old = ctx.getImageData(0, 0, Math.min(canvas.width, w), Math.min(canvas.height, h));
      canvas.width = w; canvas.height = h;
      preview.width = w; preview.height = h;
      ctx.imageSmoothingEnabled = false;
      pctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.putImageData(old, 0, 0);
      statusSize.textContent = w + ' x ' + h;
      applyZoom();
    } else if (action === 'zoomin') {
      const zooms = [1, 2, 4, 6, 8];
      const i = zooms.indexOf(state.zoom);
      state.zoom = zooms[Math.min(zooms.length - 1, i + 1)];
      applyZoom();
    } else if (action === 'zoomout') {
      const zooms = [1, 2, 4, 6, 8];
      const i = zooms.indexOf(state.zoom);
      state.zoom = zooms[Math.max(0, i - 1)];
      applyZoom();
    } else if (action === 'zoom1') {
      state.zoom = 1; applyZoom();
    } else if (action === 'cut' || action === 'copy') {
      if (state.selection && navigator.clipboard?.write) {
        const c = document.createElement('canvas');
        c.width = state.selection.w; c.height = state.selection.h;
        c.getContext('2d').putImageData(state.selection.imageData, 0, 0);
        c.toBlob(b => navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).catch(() => {}));
        if (action === 'cut') {
          if (!state.selection.lifted) {
            ctx.fillStyle = state.bg;
            ctx.fillRect(state.selection.origX, state.selection.origY, state.selection.w, state.selection.h);
          }
          state.selection = null;
          clearPreview();
        }
        toast(action === 'cut' ? 'Cut.' : 'Copied.');
      }
    } else if (action === 'about') {
      env.open('about', { singleton: true });
    }
  }

  // ---- Keyboard
  function isPaintFocused() {
    // Ensure shortcuts only fire when this paint window is the active window.
    return env.win.el.classList.contains('active');
  }
  document.addEventListener('keydown', async (e) => {
    if (!isPaintFocused()) return;
    // Don't intercept while typing in a text editor / input
    if (e.target.matches('input, textarea, select')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); runAction('save'); return; }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); runAction('clear'); return; }
    if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); runAction('new'); return; }
    if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); runAction('invert'); return; }
    if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); runAction('open'); return; }
    if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); runAction('zoomin'); return; }
    if (mod && e.key === '-') { e.preventDefault(); runAction('zoomout'); return; }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (state.curve) { state.curve = null; clearPreview(); }
      else if (state.polyPoints) { state.polyPoints = null; clearPreview(); }
      else if (state.selection) commitSelection();
      return;
    }
    if (mod) return;
    const key = e.key.toLowerCase();
    if (key === 'p') selectTool('pencil');
    else if (key === 'b') selectTool('brush');
    else if (key === 'e') selectTool('eraser');
    else if (key === 'f') selectTool('fill');
    else if (key === 'l') selectTool('line');
    else if (key === 'r') selectTool('rect');
    else if (key === 'c') selectTool('curve');
    else if (key === 'g') selectTool('polygon');
    else if (key === 'o') selectTool('ellipse');
    else if (key === 'k') selectTool('eyedropper');
    else if (key === 'a') selectTool('spray');
    else if (key === 't') selectTool('text');
    else if (key === 's') selectTool('selectrect');
    else if (key === 'm') selectTool('zoom');
  });

  // ---- Tip on hover
  toolGrid.querySelectorAll('.tool').forEach(t => {
    t.addEventListener('mouseenter', () => {
      const def = TOOL_DEFS.find(x => x.id === t.dataset.tool);
      if (def) statusTip.textContent = def.label;
    });
    t.addEventListener('mouseleave', () => {
      statusTip.textContent = 'For Help, click Help Topics on the Help Menu.';
    });
  });

  // ---- Initial state
  updateColors();
  selectTool('pencil');
  state.size = 1;
  env.setIcon('paint');
  setDirty(false);

  // ---- Public lifecycle
  return {
    onResize: () => {},
    beforeClose: async () => {
      if (state.dirty) {
        const ok = await confirmDialog({ message: 'Discard unsaved changes to "' + state.docName + '"?' });
        return ok;
      }
      return true;
    },
    loadPiece: (piece) => {
      const img = new Image();
      img.onload = () => {
        canvas.width = piece.width || img.naturalWidth;
        canvas.height = piece.height || img.naturalHeight;
        preview.width = canvas.width;
        preview.height = canvas.height;
        ctx.imageSmoothingEnabled = false;
        pctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        statusSize.textContent = canvas.width + ' x ' + canvas.height;
        state.pieceId = piece.id;
        state.docName = piece.name || 'untitled';
        state.undoStack.length = 0;
        state.redoStack.length = 0;
        setDirty(false);
        applyZoom();
      };
      img.src = piece.dataURL;
    },
  };
}
