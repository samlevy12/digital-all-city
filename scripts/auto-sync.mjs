#!/usr/bin/env node
/**
 * Auto-sync — watches source files, debounces, then commits + pushes to
 * github. Vercel auto-deploys from the push (git integration must be set up
 * once via `vercel git connect` or via the dashboard).
 *
 * Run via `npm run live` (alongside electron), or solo:
 *   node scripts/auto-sync.mjs
 *
 * Env knobs:
 *   AUTO_SYNC_DEBOUNCE_MS=30000   wait this long after last change before committing
 *   AUTO_SYNC_BRANCH=main         branch to push to
 */

import { execSync, spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import chokidar from 'chokidar';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const DEBOUNCE_MS = parseInt(process.env.AUTO_SYNC_DEBOUNCE_MS ?? '30000', 10);
const BRANCH = process.env.AUTO_SYNC_BRANCH ?? 'main';

const log = (...args) => console.log('[auto-sync]', ...args);
const out = (cmd) => execSync(cmd, { cwd: root }).toString().trim();

// Sanity: must be in a git repo
try {
  out('git rev-parse --is-inside-work-tree');
} catch {
  console.error('[auto-sync] not a git repo — run `git init && gh repo create` first. exiting.');
  process.exit(1);
}

let timer = null;
let syncing = false;
let pendingDuringSync = false;

function scheduleSync(reason) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(doSync, DEBOUNCE_MS);
  log(`change: ${reason}  → committing in ${DEBOUNCE_MS / 1000}s`);
}

function doSync() {
  if (syncing) {
    pendingDuringSync = true;
    return;
  }
  syncing = true;
  try {
    const status = out('git status --porcelain');
    if (!status) {
      log('nothing to commit');
      return;
    }

    const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const fileCount = status.split('\n').length;
    const message = `auto-sync ${ts} (${fileCount} file${fileCount === 1 ? '' : 's'})`;

    execSync('git add -A', { cwd: root });
    execSync(`git commit -m ${JSON.stringify(message)}`, { cwd: root });

    log(`committed: ${message}`);

    const push = spawnSync('git', ['push', 'origin', BRANCH], { cwd: root });
    if (push.status === 0) {
      log(`pushed → vercel will auto-deploy`);
    } else {
      log(`push failed (${push.stderr?.toString().trim() || 'unknown'}) — will retry on next change`);
    }
  } catch (err) {
    log('sync failed:', err.message);
  } finally {
    syncing = false;
    if (pendingDuringSync) {
      pendingDuringSync = false;
      scheduleSync('queued during last sync');
    }
  }
}

const watcher = chokidar.watch(
  [
    'src/**',
    'index.html',
    'styles.css',
    'package.json',
    'electron/**',
    'scripts/**',
    'vercel.json',
  ],
  {
    cwd: root,
    ignored: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-electron/**',
      '**/.git/**',
      '**/*.log',
      '**/.DS_Store',
    ],
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 100 },
  },
);

watcher.on('all', (event, path) => scheduleSync(`${event} ${path}`));

log(`watching ${root}`);
log(`debounce ${DEBOUNCE_MS / 1000}s, branch ${BRANCH}`);
log('save a file to start the cycle.  ctrl+c to stop.');

process.on('SIGINT', () => {
  log('stopping');
  watcher.close().then(() => process.exit(0));
});
