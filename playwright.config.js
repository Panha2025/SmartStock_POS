import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 30000, fullyParallel: false,
  use: {baseURL: 'http://127.0.0.1:4174', headless: true, trace: 'retain-on-failure', timezoneId:'Asia/Phnom_Penh', ...(process.env.PW_CHANNEL ? {channel:process.env.PW_CHANNEL} : {})},
  webServer: {command: 'node server.mjs', env: {PORT:'4174'}, url:'http://127.0.0.1:4174', reuseExistingServer: false},
});
