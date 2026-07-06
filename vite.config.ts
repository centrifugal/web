/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'

// Admin UI is embedded and served under an arbitrary path prefix, so all asset
// URLs must be relative — mirrors the old CRA `homepage: "./"`.
export default defineConfig({
  base: './',
  plugins: [react()],
  // Resolve bare imports against tsconfig `baseUrl: src` (e.g. `components/...`).
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    // Keep the CRA output location so downstream statik generation is unchanged.
    outDir: 'dist',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    css: true,
  },
})
