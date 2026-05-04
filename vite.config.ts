import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["8ba9-103-250-149-245.ngrok-free.app"],
    host: true,
  }
})
