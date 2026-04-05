const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 15000,
  retries: 1,
  use: {
    baseURL: 'https://app.octile.eu.cc',
    viewport: { width: 540, height: 720 },
    channel: 'chrome',
  },
});
