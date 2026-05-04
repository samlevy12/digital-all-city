// Tiny localStorage wrapper for sketches. Each piece gets its own key so we
// don't blow the 5MB cap by re-serializing the whole list every save.

const KEY_INDEX = 'graffiti.index.v1';
const KEY_PIECE = (id) => 'graffiti.piece.v1.' + id;

function loadIndex() {
  try {
    const raw = localStorage.getItem(KEY_INDEX);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveIndex(idx) {
  localStorage.setItem(KEY_INDEX, JSON.stringify(idx));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Generate a smaller thumbnail from a full-size dataURL.
function makeThumb(dataURL, maxW = 240, maxH = 180) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.max(1, Math.round(img.width * ratio));
      const h = Math.max(1, Math.round(img.height * ratio));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const cx = c.getContext('2d');
      cx.imageSmoothingEnabled = false;
      cx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = dataURL;
  });
}

export const Storage = {
  list() {
    return loadIndex().sort((a, b) => b.createdAt - a.createdAt);
  },

  get(id) {
    const meta = loadIndex().find(p => p.id === id);
    if (!meta) return null;
    try {
      const raw = localStorage.getItem(KEY_PIECE(id));
      if (!raw) return null;
      const data = JSON.parse(raw);
      return { ...meta, ...data };
    } catch {
      return null;
    }
  },

  async save({ id, name, dataURL, width, height, geotag, placedAt }) {
    const idx = loadIndex();
    const existing = id ? idx.find(p => p.id === id) : null;
    const finalId = id || uid();
    const thumb = await makeThumb(dataURL);
    const now = Date.now();

    const meta = {
      id: finalId,
      name: name || existing?.name || 'untitled',
      width, height,
      thumb,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      geotag: geotag !== undefined ? geotag : (existing?.geotag || null),
      placedAt: placedAt !== undefined ? placedAt : (existing?.placedAt || null),
    };

    const data = { dataURL };

    try {
      localStorage.setItem(KEY_PIECE(finalId), JSON.stringify(data));
    } catch (e) {
      throw new Error('Storage full — delete some sketches and try again.');
    }

    if (existing) {
      const i = idx.indexOf(existing);
      idx[i] = meta;
    } else {
      idx.push(meta);
    }
    saveIndex(idx);
    return meta;
  },

  remove(id) {
    const idx = loadIndex().filter(p => p.id !== id);
    saveIndex(idx);
    localStorage.removeItem(KEY_PIECE(id));
  },

  setGeotag(id, geotag, placedAt) {
    const idx = loadIndex();
    const meta = idx.find(p => p.id === id);
    if (!meta) return null;
    meta.geotag = geotag;
    meta.placedAt = placedAt || null;
    meta.updatedAt = Date.now();
    saveIndex(idx);
    return meta;
  },

  rename(id, name) {
    const idx = loadIndex();
    const meta = idx.find(p => p.id === id);
    if (!meta) return null;
    meta.name = name;
    meta.updatedAt = Date.now();
    saveIndex(idx);
    return meta;
  },
};

// Pub-sub so other windows know when storage changed.
const subs = new Set();
export function onStorageChange(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
export function emitStorageChange() {
  subs.forEach(fn => { try { fn(); } catch {} });
}
window.addEventListener('storage', e => {
  if (e.key && e.key.startsWith('graffiti.')) emitStorageChange();
});
