import { defineConfig, createLogger } from 'vite'
import vue from '@vitejs/plugin-vue'

const logger = createLogger('info',{
  prefix: '[client]',
})

// https://vite.dev/config/
export default defineConfig({
  customLogger: logger,
  plugins: [
    vue()
  ],
})
