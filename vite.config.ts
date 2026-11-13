import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: [
        '**/sessions/**',
        '**/outputs/**',
        '**/*.db*',
        '**/*.db-journal',
        '**/__pycache__/**',
        '**/*.log',
        '**/.git/**',
      ],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
