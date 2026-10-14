import { defineConfig } from '@playwright/test';
import { env } from 'node:process';

const preview = env.E2E_PREVIEW === '1';
const baseURL = preview ? 'http://127.0.0.1:4174/labs/' : 'http://127.0.0.1:5174/';

export default defineConfig({
  testDir: './tests/e2e', workers: 1, timeout: 45000, reporter: 'list',
  forbidOnly: !!env.CI,
  use: {
    baseURL, viewport: { width: 1440, height: 1050 },
    channel: env.CI ? 'chromium' : 'chrome',
    launchOptions: {
      args: ['--enable-unsafe-webgpu', ...(env.CI && process.platform === 'linux' ? [
        '--enable-features=Vulkan', '--use-angle=vulkan', '--use-vulkan=swiftshader',
        '--use-webgpu-adapter=swiftshader', '--disable-vulkan-surface',
      ] : [])],
    },
  },
  webServer: {
    command: preview ? 'npm run preview -- --host 127.0.0.1 --port 4174 --strictPort' : 'npm run dev',
    url: baseURL, reuseExistingServer: !env.CI && !preview,
  },
});
