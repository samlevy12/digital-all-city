// Bootstrap — register apps, build desktop, open Paint by default.

import { registerApp, openApp, buildDesktop } from './desktop.js';
import { createPaintApp } from './paint.js';
import { createGalleryApp } from './gallery.js';
import { createMapApp } from './map.js';
import { createAboutApp } from './about.js';

registerApp('paint', (body, env) => createPaintApp(body, env));
registerApp('gallery', (body, env) => createGalleryApp(body, env));
registerApp('map', (body, env) => createMapApp(body, env));
registerApp('about', (body, env) => createAboutApp(body, env));

const ROOT_APPS = [
  { id: 'paint',   label: 'All City',  icon: 'paint' },
  { id: 'gallery', label: 'My Tags',   icon: 'gallery' },
  { id: 'map',     label: 'World Map', icon: 'map' },
  { id: 'about',   label: 'About',     icon: 'about' },
];

buildDesktop(ROOT_APPS);

// Open paint by default, in a sensible position.
openApp('paint', { x: 80, y: 60, width: 700, height: 520, title: 'untitled - All City', icon: 'paint' });

// Tiny welcome on first run
if (!localStorage.getItem('graffiti.seen.welcome')) {
  localStorage.setItem('graffiti.seen.welcome', '1');
  setTimeout(() => {
    openApp('about', { singleton: true, x: 200, y: 120, width: 460, height: 340, title: 'About Digital All City', icon: 'about' });
  }, 400);
}
