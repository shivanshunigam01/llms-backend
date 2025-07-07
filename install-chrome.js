// install-chrome.js
const { execSync } = require("child_process");

try {
  console.log("Installing Chromium...");
  execSync("npx puppeteer browsers install chrome", { stdio: "inherit" });
  console.log("✅ Chromium installed successfully.");
} catch (error) {
  console.error("❌ Failed to install Chromium:", error);
  process.exit(1);
}
// This script is intended to be run after the package installation
// It ensures that Puppeteer has the necessary browser binaries available