import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',
  plugins: [react()],
  build: { target: 'es2022' },
  preview: { port: 4173, strictPort: true },
});
