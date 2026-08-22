// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } }
    }
  },
  server: {
    host: true,          // veya '0.0.0.0'
    port: 3000,
    // Mobilde HMR soketi için (gerekirse):
  }
});
