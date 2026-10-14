import { defineConfig } from 'vite';
import { env } from 'node:process';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview
    ? (env.PAGES_BASE_PATH ?? (env.GITHUB_ACTIONS || env.E2E_PREVIEW === '1' ? '/labs/' : './'))
    : '/',
  build: { target: 'es2022' },
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
}));
