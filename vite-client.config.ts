import {createLogger, defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'

const logger = createLogger('info', {
  prefix: '[client]',
})

// https://vite.dev/config/
export default defineConfig({
  customLogger: logger,
  clearScreen: false,
  build: {
    outDir: 'dist/spa',
    rollupOptions: {
      output: {
        assetFileNames: 'static/[hash][extname]',
        chunkFileNames: 'static/[hash].js',
        entryFileNames: 'static/[hash].js',
      },
    },
  },
  plugins: [
    vue(),
  ],
})
