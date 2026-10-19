#!/bin/sh
# Runs the e2e suite in Playwright's Linux image (npm run test:e2e), so the
# screenshots render the same on every machine and in CI. The container's
# Linux node_modules live in a Docker volume, apart from this machine's.
# Arguments go to playwright test, e.g. --update-snapshots.
set -e
cd "$(dirname "$0")/.."
version=$(node -p 'require("./package-lock.json").packages["node_modules/@playwright/test"].version')
exec docker run --rm --ipc=host \
  -v "$PWD":/work -v p2pgames-e2e-modules:/work/node_modules -w /work \
  "mcr.microsoft.com/playwright:v$version-noble" \
  sh -c 'cmp -s package-lock.json node_modules/.installed-lock ||
    { npm ci && cp package-lock.json node_modules/.installed-lock; }
    exec npx playwright test "$@"' sh "$@"
