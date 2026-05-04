// Gallery — grid of saved sketches with rename / delete / place / open actions.

import { el, toast, confirmDialog, promptDialog } from './desktop.js';
import { Storage, onStorageChange, emitStorageChange } from './storage.js';

export function createGalleryApp(body, env) {
  body.style.flexDirection = 'column';
  body.style.flex = '1';
  body.style.display = 'flex';
  body.classList.add('gallery');

  const toolbar = el('div', { class: 'gallery-toolbar' });
  const btnOpen = el('button', { class: 'btn disabled', disabled: true }, 'Open');
  const btnPlace = el('button', { class: 'btn disabled', disabled: true }, 'Place at...');
  const btnRename = el('button', { class: 'btn disabled', disabled: true }, 'Rename');
  const btnDelete = el('button', { class: 'btn disabled', disabled: true }, 'Delete');
  const btnMap = el('button', { class: 'btn' }, 'View Map');
  toolbar.append(btnOpen, btnPlace, btnRename, btnDelete,
    el('div', { style: 'flex: 1' }), btnMap);

  const wrap = el('div', { class: 'gallery-grid-wrap' });
  const grid = el('div', { class: 'gallery-grid' });
  wrap.appendChild(grid);

  const status = el('div', { class: 'statusbar' },
    el('div', { class: 'grow', id: 'gallery-status' }, '0 sketches'),
  );

  body.appendChild(toolbar);
  body.appendChild(wrap);
  body.appendChild(status);

  let selectedId = null;

  function setSelected(id) {
    selectedId = id;
    grid.querySelectorAll('.gallery-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.id === id);
    });
    [btnOpen, btnPlace, btnRename, btnDelete].forEach(b => {
      b.classList.toggle('disabled', !id);
      b.disabled = !id;
    });
  }

  function render() {
    grid.innerHTML = '';
    const pieces = Storage.list();
    document.getElementById('gallery-status').textContent =
      pieces.length === 0 ? 'No sketches yet'
      : pieces.length === 1 ? '1 sketch'
      : pieces.length + ' sketches';

    if (pieces.length === 0) {
      const empty = el('div', { class: 'gallery-empty' });
      empty.innerHTML = `
        <p style="font-size: 12px; margin-bottom: 12px;"><strong>No sketches yet.</strong></p>
        <p>Open Digital All City from the desktop, draw something nasty, then File → Save.</p>
      `;
      grid.appendChild(empty);
      setSelected(null);
      return;
    }

    pieces.forEach(p => {
      const card = el('div', {
        class: 'gallery-card' + (p.id === selectedId ? ' selected' : ''),
        onClick: () => setSelected(p.id),
        onDblclick: () => openPiece(p.id),
      });
      card.dataset.id = p.id;
      const thumbWrap = el('div', { class: 'gallery-thumb-wrap' });
      const thumb = el('img', { class: 'gallery-thumb', src: p.thumb, alt: p.name });
      thumbWrap.appendChild(thumb);
      const meta = el('div', { class: 'gallery-meta' });
      meta.appendChild(el('div', { class: 'name' }, p.name || 'untitled'));
      const dim = (p.width || '?') + 'x' + (p.height || '?');
      const date = new Date(p.createdAt).toLocaleDateString();
      meta.appendChild(el('div', { class: 'date' }, dim + '  •  ' + date));
      if (p.geotag) {
        const g = p.geotag;
        meta.appendChild(el('div', { class: 'geo' }, '@ ' + g.lat.toFixed(4) + ', ' + g.lng.toFixed(4)));
      }
      card.appendChild(thumbWrap);
      card.appendChild(meta);
      grid.appendChild(card);
    });

    // Keep selected if still present
    if (selectedId && !pieces.find(p => p.id === selectedId)) setSelected(null);
  }

  function openPiece(id) {
    const piece = Storage.get(id);
    if (!piece) return;
    const win = env.open('paint');
    setTimeout(() => win.lifecycle.loadPiece && win.lifecycle.loadPiece(piece), 50);
  }

  async function placePiece(id) {
    const piece = Storage.get(id);
    if (!piece) return;
    if (!navigator.geolocation) { toast('Geolocation unavailable.'); return; }
    toast('Locating...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const geotag = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        Storage.setGeotag(id, geotag, null);
        emitStorageChange();
        render();
        toast('Placed at ' + geotag.lat.toFixed(4) + ', ' + geotag.lng.toFixed(4));
      },
      (err) => { toast('Location denied: ' + err.message); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function renamePiece(id) {
    const piece = Storage.get(id);
    if (!piece) return;
    const name = await promptDialog({ title: 'Rename', message: 'New name:', defaultValue: piece.name });
    if (!name) return;
    Storage.rename(id, name.trim() || piece.name);
    emitStorageChange();
    render();
  }

  async function deletePiece(id) {
    const piece = Storage.get(id);
    if (!piece) return;
    const ok = await confirmDialog({ message: 'Delete "' + piece.name + '"? This cannot be undone.', okLabel: 'Delete' });
    if (!ok) return;
    Storage.remove(id);
    emitStorageChange();
    render();
  }

  btnOpen.addEventListener('click', () => selectedId && openPiece(selectedId));
  btnPlace.addEventListener('click', () => selectedId && placePiece(selectedId));
  btnRename.addEventListener('click', () => selectedId && renamePiece(selectedId));
  btnDelete.addEventListener('click', () => selectedId && deletePiece(selectedId));
  btnMap.addEventListener('click', () => env.open('map', { singleton: true }));

  // Right-click context menu (minimal)
  grid.addEventListener('contextmenu', e => {
    const card = e.target.closest('.gallery-card');
    if (!card) return;
    e.preventDefault();
    setSelected(card.dataset.id);
  });

  env.setIcon('gallery');
  render();
  const unsub = onStorageChange(render);

  return {
    beforeClose: () => true,
    onClose: () => unsub(),
  };
}
