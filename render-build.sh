#!/bin/bash
echo "▶️ Running Render build script..."

# Install node modules
npm install

# Install Chrome manually using Puppeteer
npx puppeteer browsers install chrome
