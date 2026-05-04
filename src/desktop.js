// Window manager + desktop chrome.
// Each app is registered with a factory function that returns a DOM node and
// optional lifecycle hooks. Opening an app spawns a new Window that wraps it.

let zCounter = 100;
const windows = new Map();
let activeWindow = null;
let nextX = 60;
let nextY = 40;

const apps = new Map();

export function registerApp(id, factory) {
  apps.set(id, factory);
}

export function getOpenWindows() {
  return Array.from(windows.values());
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v === true) {
      node.setAttribute(k, '');
    } else if (v !== false && v != null) {
      node.setAttribute(k, v);
    }
  }
  for (const child of children) {
    if (child == null) continue;
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  }
  return node;
}

// Tiny SVG icon set used in titlebars, taskbar, desktop, start menu.
const ICONS_SVG = {
  paint: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
    <rect x="1" y="1" width="14" height="11" fill="#fff" stroke="#000"/>
    <rect x="2" y="2" width="3" height="3" fill="#f00"/>
    <rect x="6" y="2" width="3" height="3" fill="#0f0"/>
    <rect x="10" y="2" width="3" height="3" fill="#00f"/>
    <rect x="2" y="6" width="3" height="3" fill="#ff0"/>
    <rect x="6" y="6" width="3" height="3" fill="#f0f"/>
    <rect x="10" y="6" width="3" height="3" fill="#0ff"/>
    <rect x="3" y="13" width="10" height="2" fill="#888"/>
  </svg>`,
  gallery: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
    <rect x="1" y="1" width="14" height="11" fill="#fff" stroke="#000"/>
    <path d="M1 9 L4 6 L7 9 L10 5 L15 11 L15 12 L1 12 Z" fill="#888"/>
    <rect x="11" y="3" width="2" height="2" fill="#fc0"/>
    <rect x="2" y="13" width="12" height="1" fill="#888"/>
    <rect x="5" y="14" width="6" height="1" fill="#888"/>
  </svg>`,
  map: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
    <rect x="0" y="0" width="16" height="16" fill="#aad3df"/>
    <path d="M0 10 L5 8 L9 11 L16 9 L16 16 L0 16 Z" fill="#9c6"/>
    <circle cx="10" cy="6" r="2" fill="#c00"/>
    <rect x="9" y="6" width="2" height="4" fill="#c00"/>
  </svg>`,
  about: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
    <circle cx="8" cy="8" r="7" fill="#00b" stroke="#000"/>
    <text x="8" y="12" font-family="serif" font-size="11" font-weight="bold" text-anchor="middle" fill="#fff">i</text>
  </svg>`,
  flag: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
    <rect x="2" y="1" width="6" height="5" fill="#f00"/>
    <rect x="8" y="1" width="6" height="5" fill="#fff"/>
    <rect x="2" y="6" width="6" height="5" fill="#0c0"/>
    <rect x="8" y="6" width="6" height="5" fill="#08f"/>
    <rect x="2" y="1" width="1" height="14" fill="#000"/>
  </svg>`,
  shutdown: `<svg viewBox="0 0 24 24" shape-rendering="crispEdges">
    <circle cx="12" cy="14" r="6" fill="none" stroke="#000" stroke-width="2"/>
    <rect x="11" y="3" width="2" height="9" fill="#000"/>
  </svg>`,
};

export function svg(name, size) {
  const wrap = document.createElement('span');
  wrap.className = 'icon-glyph';
  if (size) wrap.style.cssText = `width:${size}px;height:${size}px;display:inline-block;`;
  wrap.innerHTML = ICONS_SVG[name] || '';
  return wrap;
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

export function openApp(appId, options = {}) {
  const factory = apps.get(appId);
  if (!factory) {
    console.warn('Unknown app:', appId);
    return null;
  }

  // Singleton apps — bring existing window to front instead of spawning.
  if (options.singleton) {
    for (const w of windows.values()) {
      if (w.appId === appId && (!options.match || options.match(w))) {
        focusWindow(w.id);
        if (w.minimized) toggleMinimize(w.id);
        return w;
      }
    }
  }

  const id = 'win_' + Math.random().toString(36).slice(2, 9);
  const win = createWindow(id, appId, options);

  const lifecycle = factory(win.body, {
    win,
    setTitle: (t) => setTitle(win, t),
    setIcon: (n) => setIcon(win, n),
    close: () => closeWindow(id),
    open: openApp,
  });

  win.lifecycle = lifecycle || {};
  win.appId = appId;
  windows.set(id, win);
  document.body.appendChild(win.el);
  focusWindow(id);
  renderTaskbar();

  return win;
}

function createWindow(id, appId, options) {
  const w = options.width || 640;
  const h = options.height || 460;
  const x = options.x ?? nextX;
  const y = options.y ?? nextY;
  nextX = (nextX + 30) % 240;
  nextY = (nextY + 24) % 160;

  const titleEl = el('div', { class: 'titlebar-title' });
  const iconSlot = el('span');
  const titleText = el('span');
  titleText.textContent = options.title || 'Window';
  titleEl.appendChild(iconSlot);
  titleEl.appendChild(titleText);
  iconSlot.appendChild(svg(options.icon || appId));

  const btnMin = el('button', { class: 'tb-btn', tabindex: '-1', html: '_' });
  const btnMax = el('button', { class: 'tb-btn', tabindex: '-1', html: '&#9633;' });
  const btnClose = el('button', { class: 'tb-btn', tabindex: '-1', html: '&times;' });

  const titlebar = el('div', { class: 'titlebar' },
    titleEl,
    el('div', { class: 'titlebar-buttons' }, btnMin, btnMax, btnClose),
  );

  const body = el('div', { class: 'window-body' });

  const winEl = el('div', { class: 'window' },
    titlebar,
    body,
  );
  winEl.style.left = x + 'px';
  winEl.style.top = y + 'px';
  winEl.style.width = w + 'px';
  winEl.style.height = h + 'px';

  const win = {
    id, appId,
    el: winEl, body, titlebar, titleText, iconSlot,
    minimized: false, maximized: false,
    lifecycle: {},
    options,
  };

  // Click anywhere to focus
  winEl.addEventListener('mousedown', () => focusWindow(id), true);

  // Title-bar drag (only when not maximized)
  let dragOffset = null;
  titlebar.addEventListener('mousedown', e => {
    if (win.maximized) return;
    if (e.target.closest('.tb-btn')) return;
    const rect = winEl.getBoundingClientRect();
    dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    document.body.style.cursor = 'move';
  });
  window.addEventListener('mousemove', e => {
    if (!dragOffset) return;
    const x = Math.max(0, e.clientX - dragOffset.x);
    const y = Math.max(0, e.clientY - dragOffset.y);
    winEl.style.left = x + 'px';
    winEl.style.top = y + 'px';
  });
  window.addEventListener('mouseup', () => {
    if (dragOffset) document.body.style.cursor = '';
    dragOffset = null;
  });
  titlebar.addEventListener('dblclick', e => {
    if (e.target.closest('.tb-btn')) return;
    toggleMaximize(id);
  });

  btnMin.addEventListener('click', e => { e.stopPropagation(); toggleMinimize(id); });
  btnMax.addEventListener('click', e => { e.stopPropagation(); toggleMaximize(id); });
  btnClose.addEventListener('click', e => { e.stopPropagation(); closeWindow(id); });

  // Resize handle (bottom-right)
  const resize = el('div');
  resize.style.cssText = 'position:absolute;right:0;bottom:0;width:14px;height:14px;cursor:nwse-resize;z-index:5;';
  winEl.appendChild(resize);
  let rs = null;
  resize.addEventListener('mousedown', e => {
    if (win.maximized) return;
    e.stopPropagation();
    const rect = winEl.getBoundingClientRect();
    rs = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height };
  });
  window.addEventListener('mousemove', e => {
    if (!rs) return;
    const w = Math.max(240, rs.w + (e.clientX - rs.x));
    const h = Math.max(160, rs.h + (e.clientY - rs.y));
    winEl.style.width = w + 'px';
    winEl.style.height = h + 'px';
    if (win.lifecycle.onResize) win.lifecycle.onResize();
  });
  window.addEventListener('mouseup', () => { rs = null; });

  return win;
}

function setTitle(win, t) {
  win.titleText.textContent = t;
  if (win.lifecycle._taskbarLabel) win.lifecycle._taskbarLabel.textContent = t;
  renderTaskbar();
}

function setIcon(win, name) {
  win.iconSlot.innerHTML = '';
  win.iconSlot.appendChild(svg(name));
}

export function focusWindow(id) {
  const w = windows.get(id);
  if (!w) return;
  zCounter++;
  w.el.style.zIndex = String(zCounter);
  windows.forEach(other => other.el.classList.remove('active'));
  w.el.classList.add('active');
  activeWindow = id;
  renderTaskbar();
}

export function closeWindow(id) {
  const w = windows.get(id);
  if (!w) return;
  if (w.lifecycle.beforeClose) {
    const ok = w.lifecycle.beforeClose();
    if (ok === false) return;
  }
  if (w.lifecycle.onClose) try { w.lifecycle.onClose(); } catch {}
  w.el.remove();
  windows.delete(id);
  if (activeWindow === id) activeWindow = null;
  renderTaskbar();
}

function toggleMinimize(id) {
  const w = windows.get(id);
  if (!w) return;
  w.minimized = !w.minimized;
  w.el.classList.toggle('minimized', w.minimized);
  if (w.minimized && activeWindow === id) activeWindow = null;
  if (!w.minimized) focusWindow(id);
  renderTaskbar();
}

function toggleMaximize(id) {
  const w = windows.get(id);
  if (!w) return;
  w.maximized = !w.maximized;
  w.el.classList.toggle('maximized', w.maximized);
  if (w.lifecycle.onResize) setTimeout(() => w.lifecycle.onResize(), 0);
}

// ---------------------------------------------------------------------------
// Taskbar
// ---------------------------------------------------------------------------

function renderTaskbar() {
  const items = document.getElementById('taskbar-items');
  if (!items) return;
  items.innerHTML = '';
  for (const w of windows.values()) {
    const isActive = w.id === activeWindow && !w.minimized;
    const item = el('div', {
      class: 'taskbar-item' + (isActive ? ' active' : ''),
      onClick: () => {
        if (w.minimized) toggleMinimize(w.id);
        else if (activeWindow === w.id) toggleMinimize(w.id);
        else focusWindow(w.id);
      },
    });
    item.appendChild(svg(w.appId));
    const label = el('span', { class: 'label' });
    label.textContent = w.titleText.textContent;
    w.lifecycle._taskbarLabel = label;
    item.appendChild(label);
    items.appendChild(item);
  }
}

// ---------------------------------------------------------------------------
// Desktop & Start menu setup
// ---------------------------------------------------------------------------

export function buildDesktop(rootApps) {
  // Desktop icons
  const iconsContainer = document.getElementById('desktop-icons');
  rootApps.forEach(({ id, label, icon }) => {
    const ic = el('div', {
      class: 'desktop-icon',
      tabindex: '0',
      onDblclick: () => openApp(id, { singleton: id !== 'paint' }),
      onClick: () => {
        document.querySelectorAll('.desktop-icon').forEach(n => n.classList.remove('active'));
        ic.classList.add('active');
      },
    });
    ic.appendChild(svg(icon || id, 32));
    const lbl = el('span', { class: 'label' });
    lbl.textContent = label;
    ic.appendChild(lbl);
    iconsContainer.appendChild(ic);
  });

  // Start menu items
  const startItems = document.getElementById('start-menu-items');
  rootApps.forEach(({ id, label, icon }) => {
    const item = el('div', {
      class: 'start-menu-item',
      onClick: () => { closeStartMenu(); openApp(id, { singleton: id !== 'paint' }); },
    });
    item.appendChild(svg(icon || id, 24));
    item.appendChild(el('span', {}, label));
    startItems.appendChild(item);
  });

  // Click outside closes start menu
  document.addEventListener('mousedown', e => {
    if (e.target.closest('#start-menu') || e.target.closest('#start-btn')) return;
    closeStartMenu();
  });

  // Start button
  document.getElementById('start-btn').addEventListener('click', toggleStartMenu);

  // Click on desktop deselects icons
  document.querySelector('.desktop').addEventListener('click', e => {
    if (e.target.closest('.desktop-icon')) return;
    document.querySelectorAll('.desktop-icon').forEach(n => n.classList.remove('active'));
  });

  // Clock
  const clockEl = document.getElementById('clock');
  function updateClock() {
    const d = new Date();
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    clockEl.textContent = `${h}:${m} ${ampm}`;
  }
  updateClock();
  setInterval(updateClock, 30000);
}

function toggleStartMenu() {
  document.getElementById('start-menu').classList.toggle('open');
  document.getElementById('start-btn').classList.toggle('open');
}
function closeStartMenu() {
  document.getElementById('start-menu').classList.remove('open');
  document.getElementById('start-btn').classList.remove('open');
}

// ---------------------------------------------------------------------------
// Toasts (minimal)
// ---------------------------------------------------------------------------

export function toast(msg) {
  const t = el('div', { class: 'toast' });
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ---------------------------------------------------------------------------
// Confirm dialog (Win95-styled)
// ---------------------------------------------------------------------------

export function confirmDialog({ title = 'Digital All City', message, okLabel = 'OK', cancelLabel = 'Cancel' }) {
  return new Promise(resolve => {
    const backdrop = el('div', { class: 'modal-backdrop open' });
    const okBtn = el('button', { class: 'btn', onClick: () => done(true) }, okLabel);
    const cancelBtn = el('button', { class: 'btn', onClick: () => done(false) }, cancelLabel);
    const dlg = el('div', { class: 'dialog' },
      el('div', { class: 'titlebar' },
        el('div', { class: 'titlebar-title' }, title),
      ),
      el('div', { class: 'dialog-body' }, message),
      el('div', { class: 'dialog-actions' }, okBtn, cancelBtn),
    );
    document.body.appendChild(backdrop);
    document.body.appendChild(dlg);
    function done(ok) { backdrop.remove(); dlg.remove(); resolve(ok); }
  });
}

export function promptDialog({ title = 'Digital All City', message, defaultValue = '' }) {
  return new Promise(resolve => {
    const backdrop = el('div', { class: 'modal-backdrop open' });
    const input = el('input', { class: 'input', type: 'text', style: 'width: 100%;' });
    input.value = defaultValue;
    const okBtn = el('button', { class: 'btn', onClick: () => done(input.value) }, 'OK');
    const cancelBtn = el('button', { class: 'btn', onClick: () => done(null) }, 'Cancel');
    const dlg = el('div', { class: 'dialog' },
      el('div', { class: 'titlebar' },
        el('div', { class: 'titlebar-title' }, title),
      ),
      el('div', { class: 'dialog-body' },
        el('div', { style: 'margin-bottom: 8px;' }, message),
        input,
      ),
      el('div', { class: 'dialog-actions' }, okBtn, cancelBtn),
    );
    document.body.appendChild(backdrop);
    document.body.appendChild(dlg);
    setTimeout(() => { input.focus(); input.select(); }, 0);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); done(input.value); }
      if (e.key === 'Escape') { e.preventDefault(); done(null); }
    });
    function done(value) { backdrop.remove(); dlg.remove(); resolve(value); }
  });
}

export { el };
