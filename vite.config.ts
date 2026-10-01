import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { artStudio } from './tools/vite-plugin-art-studio.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), artStudio()],
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
