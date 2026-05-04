// About — small info window styled like a Win95 About dialog.

import { el } from './desktop.js';

export function createAboutApp(body, env) {
  body.style.padding = '16px';
  body.style.background = 'var(--bg)';
  body.style.flexDirection = 'column';
  body.style.gap = '12px';
  body.style.overflow = 'auto';

  body.appendChild(el('div', { style: 'display:flex; gap:12px; align-items:flex-start;' },
    aboutIcon(),
    el('div', {},
      el('div', { style: 'font-size:14px; font-weight:bold; margin-bottom:4px;' }, 'Digital All City'),
      el('div', { style: 'font-size:11px; color:#404040; margin-bottom:8px;' }, 'Version 0.2 — "fresh tags"'),
      el('div', { style: 'font-size:11px; line-height:1.5;' },
        'A 90s-flavored sketchpad that lets you tag the world without ',
        'damaging anything physical. Draw something nasty, save it, then ',
        'place it at your current GPS coordinates so it lives on the map. ',
        'Anyone walking past can see it (eventually — sharing is local for now).',
      ),
    ),
  ));

  body.appendChild(el('div', { style: 'border: 1px solid; border-color: #404040 #fff #fff #404040; padding: 10px; background:#fff;' },
    el('div', { style: 'font-weight:bold; margin-bottom: 6px;' }, 'Tools'),
    el('ul', { style: 'margin: 0 0 0 18px; padding: 0; line-height: 1.5;' },
      el('li', {}, 'Pencil, brush, eraser, fill bucket, airbrush, eyedropper'),
      el('li', {}, 'Line, curve (3-step Bezier), rect, ellipse, rounded rect, polygon'),
      el('li', {}, 'Text with bitmap-style edges'),
      el('li', {}, 'Rectangle selection — drag to move'),
      el('li', {}, 'Magnifier (1x / 2x / 4x / 6x / 8x)'),
      el('li', {}, 'Save to gallery, drop a pin on the map, view your tags'),
    ),
  ));

  body.appendChild(el('div', { style: 'font-size: 10px; color:#404040;' },
    'Built without anti-aliasing on purpose.'));

  env.setIcon('about');
  env.setTitle('About Digital All City');

  return { beforeClose: () => true };
}

function aboutIcon() {
  return el('div', { style: 'width:48px; height:48px; flex-shrink:0;', html:
    `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" width="48" height="48">
      <rect x="1" y="1" width="14" height="14" fill="#fff" stroke="#000"/>
      <rect x="3" y="3" width="2" height="2" fill="#f00"/>
      <rect x="6" y="3" width="2" height="2" fill="#0f0"/>
      <rect x="9" y="3" width="2" height="2" fill="#00f"/>
      <rect x="3" y="6" width="2" height="2" fill="#ff0"/>
      <rect x="6" y="6" width="2" height="2" fill="#f0f"/>
      <rect x="9" y="6" width="2" height="2" fill="#0ff"/>
      <rect x="3" y="9" width="9" height="1" fill="#888"/>
      <rect x="3" y="11" width="6" height="1" fill="#888"/>
    </svg>`
  });
}
