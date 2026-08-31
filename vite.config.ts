import { defineConfig } from 'vitest/config';

export default defineConfig({
  // base relativo: permite abrir el build desde file:// (útil para el Publisher en F12)
  base: './',
  server: {
    port: 8080,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});