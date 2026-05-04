// Map view — Leaflet + OpenStreetMap, geotagged sketches as custom pins.

import { el, toast, confirmDialog } from './desktop.js';
import { Storage, onStorageChange, emitStorageChange } from './storage.js';

let leafletPromise = null;
function loadLeaflet() {
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);
    // Inject CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);
    // Inject JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return leafletPromise;
}

export function createMapApp(body, env) {
  body.style.flexDirection = 'column';
  body.style.flex = '1';
  body.style.display = 'flex';
  body.classList.add('map-window-body');

  const toolbar = el('div', { class: 'map-toolbar' });
  const btnLocate = el('button', { class: 'btn' }, 'Find Me');
  const btnFit = el('button', { class: 'btn' }, 'Fit All');
  const btnPlace = el('button', { class: 'btn' }, 'Drop Pin Here');
  const status = el('div', { style: 'margin-left:8px; flex:1;' }, 'Loading map...');
  toolbar.append(btnLocate, btnFit, btnPlace, status);

  const mapContainer = el('div', { class: 'map-container' });
  const statusbar = el('div', { class: 'statusbar' },
    el('div', { class: 'grow' }, 'Click a pin to view a sketch. Double-click the map to drop a sketch here.'),
    el('div', { id: 'map-coords' }, 'Click on map'),
  );

  body.appendChild(toolbar);
  body.appendChild(mapContainer);
  body.appendChild(statusbar);

  let leaflet = null;
  let map = null;
  let markersLayer = null;
  let myMarker = null;
  const markerById = new Map();
  let selectedPieceForPlacement = null;

  loadLeaflet().then(L => {
    leaflet = L;
    // Default center: world view
    map = L.map(mapContainer, {
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: true,
    }).setView([20, 0], 2);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);

    map.on('mousemove', e => {
      const c = e.latlng;
      document.getElementById('map-coords').textContent =
        c.lat.toFixed(4) + ', ' + c.lng.toFixed(4);
    });

    map.on('dblclick', async e => {
      // Quick-place: prompt to pick a sketch
      const pieces = Storage.list();
      if (!pieces.length) { toast('Save a sketch first.'); return; }
      const piece = await pickSketch(pieces);
      if (!piece) return;
      Storage.setGeotag(piece.id, { lat: e.latlng.lat, lng: e.latlng.lng, accuracy: null }, null);
      emitStorageChange();
      refresh();
      toast('Placed "' + piece.name + '"');
    });

    refresh();
    // Try to auto-fit existing markers
    setTimeout(() => fitAll(), 50);
    status.textContent = '';
  }).catch(() => {
    status.textContent = 'Failed to load map. Check connection.';
  });

  function makePinIcon(piece) {
    const html = `<div class="graffiti-pin"><img src="${piece.thumb}" alt=""/></div>`;
    return leaflet.divIcon({
      html,
      className: 'graffiti-pin-icon',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }

  function makePopupContent(piece) {
    const card = document.createElement('div');
    card.className = 'popup-card';
    const imgWrap = document.createElement('div');
    imgWrap.className = 'popup-img-wrap';
    const img = document.createElement('img');
    img.src = piece.thumb;
    imgWrap.appendChild(img);
    const name = document.createElement('div');
    name.className = 'popup-name';
    name.textContent = piece.name || 'untitled';
    const meta = document.createElement('div');
    meta.className = 'popup-meta';
    meta.textContent = new Date(piece.createdAt).toLocaleString();
    const actions = document.createElement('div');
    actions.className = 'popup-actions';
    const open = document.createElement('button');
    open.className = 'btn';
    open.textContent = 'Open';
    open.addEventListener('click', () => {
      const full = Storage.get(piece.id);
      const win = env.open('paint');
      setTimeout(() => win.lifecycle.loadPiece && win.lifecycle.loadPiece(full), 50);
    });
    const remove = document.createElement('button');
    remove.className = 'btn';
    remove.textContent = 'Remove Pin';
    remove.addEventListener('click', async () => {
      const ok = await confirmDialog({ message: 'Remove geotag for "' + piece.name + '"?', okLabel: 'Remove' });
      if (!ok) return;
      Storage.setGeotag(piece.id, null, null);
      emitStorageChange();
      refresh();
    });
    actions.appendChild(open);
    actions.appendChild(remove);
    card.appendChild(imgWrap);
    card.appendChild(name);
    card.appendChild(meta);
    card.appendChild(actions);
    return card;
  }

  function refresh() {
    if (!leaflet || !map) return;
    markersLayer.clearLayers();
    markerById.clear();
    const pieces = Storage.list().filter(p => p.geotag);
    pieces.forEach(p => {
      const m = leaflet.marker([p.geotag.lat, p.geotag.lng], { icon: makePinIcon(p) });
      m.bindPopup(makePopupContent(p), { closeButton: false });
      markersLayer.addLayer(m);
      markerById.set(p.id, m);
    });
  }

  function fitAll() {
    if (!leaflet || !map) return;
    const pieces = Storage.list().filter(p => p.geotag);
    if (!pieces.length) return;
    const bounds = leaflet.latLngBounds(pieces.map(p => [p.geotag.lat, p.geotag.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }

  function pickSketch(pieces) {
    return new Promise(resolve => {
      const backdrop = el('div', { class: 'modal-backdrop open' });
      const list = el('div', { style: 'max-height: 280px; overflow-y: auto; background:#fff; border:1px solid #404040; padding: 4px;' });
      pieces.forEach(p => {
        const row = el('div', {
          style: 'display:flex; gap:6px; padding: 4px; cursor: default; align-items:center;',
          onMouseenter: e => e.currentTarget.style.background = '#000080',
          onMouseleave: e => e.currentTarget.style.background = '',
          onClick: () => done(p),
        });
        const t = el('img', { src: p.thumb, style: 'width: 40px; height: 30px; object-fit:contain; background:#fff; border:1px solid #404040; image-rendering: pixelated;' });
        const text = el('div', { style: 'color:#000;' });
        text.appendChild(el('div', { style: 'font-weight:bold;' }, p.name));
        text.appendChild(el('div', { style: 'font-size:9px; color:#404040;' }, new Date(p.createdAt).toLocaleDateString()));
        row.append(t, text);
        list.appendChild(row);
      });
      const dlg = el('div', { class: 'dialog' },
        el('div', { class: 'titlebar' }, el('div', { class: 'titlebar-title' }, 'Pick a sketch')),
        el('div', { class: 'dialog-body' }, list),
        el('div', { class: 'dialog-actions' },
          el('button', { class: 'btn', onClick: () => done(null) }, 'Cancel'),
        ),
      );
      document.body.appendChild(backdrop);
      document.body.appendChild(dlg);
      function done(piece) { backdrop.remove(); dlg.remove(); resolve(piece); }
    });
  }

  // Toolbar actions
  btnLocate.addEventListener('click', () => {
    if (!navigator.geolocation) { toast('Geolocation unavailable.'); return; }
    toast('Locating...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll = [pos.coords.latitude, pos.coords.longitude];
        map.setView(ll, 16);
        if (myMarker) markersLayer.removeLayer(myMarker);
        myMarker = leaflet.circleMarker(ll, {
          radius: 6,
          color: '#fff',
          weight: 2,
          fillColor: '#000080',
          fillOpacity: 1,
        }).addTo(map);
      },
      (err) => toast('Location denied: ' + err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
  btnFit.addEventListener('click', fitAll);
  btnPlace.addEventListener('click', async () => {
    if (!leaflet || !map) return;
    const pieces = Storage.list();
    if (!pieces.length) { toast('Save a sketch first.'); return; }
    const piece = await pickSketch(pieces);
    if (!piece) return;
    const c = map.getCenter();
    Storage.setGeotag(piece.id, { lat: c.lat, lng: c.lng, accuracy: null }, null);
    emitStorageChange();
    refresh();
    toast('Placed "' + piece.name + '" at center.');
  });

  env.setIcon('map');

  const unsub = onStorageChange(refresh);

  return {
    onResize: () => { if (map) setTimeout(() => map.invalidateSize(), 0); },
    onClose: () => unsub(),
  };
}
