import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  // Relative asset paths on build so the produced folder can be opened
  // directly from disk (file://) as a standalone demo.
  base: command === 'build' ? './' : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  server: { port: 5173 },
}))
