/// <reference types="vitest/config" />
import { copyFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The build inlines all JS and CSS into one HTML file so the tool can be
// opened straight from disk (file://) in Chrome without a web server.
// That file is also copied to the repo root so it can be downloaded directly.
const RELEASE_FILE = 'ute-load-estimator.html';

const copyRelease = (): Plugin => ({
  name: 'copy-release-file',
  apply: 'build',
  closeBundle() {
    copyFileSync('dist/index.html', RELEASE_FILE);
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile(), copyRelease()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 4000,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
