import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Chemins relatifs : indispensable pour l'application de bureau (file://) et mobile.
  base: './',
  plugins: [react()],
})
