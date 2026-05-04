#!/bin/bash
# Double-click (or open via macOS Shortcuts) to launch Digital All City:
#  - opens the local Electron app
#  - watches files; auto-commits + pushes to GitHub 30s after last save
#  - Vercel auto-deploys from the push
#
# Edit AUTO_SYNC_DEBOUNCE_MS below to push faster/slower.

cd "$(dirname "$0")" || exit 1

export AUTO_SYNC_DEBOUNCE_MS=30000

echo ""
echo "  ▣  Digital All City — Live"
echo "  ───────────────────────────────────────"
echo "  electron: opens automatically"
echo "  sync:     ${AUTO_SYNC_DEBOUNCE_MS}ms after last save → github → vercel"
echo ""

npm run live
