import { defineConfig } from 'vitest/config';

export default defineConfig({
  // base relativo: permite abrir el build desde file:// (útil para el Publisher en F12)
  base: './',
  server: {
    port: 8080,
    // La API (F0.5) vive en el puerto 3000; la SPA la consulta con el mismo origen en dev.
    proxy: {
      '/api': 'http://localhost:3000',
      '/play': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'server/tests/**/*.test.ts'],
  },
});