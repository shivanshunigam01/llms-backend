#!/bin/bash
echo "Installing dependencies and Chrome"
npm install
PUPPETEER_CACHE_DIR=.cache/puppeteer npx puppeteer browsers install chrome