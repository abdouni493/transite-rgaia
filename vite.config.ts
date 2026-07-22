import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split the heavy vendors out of the entry chunk.
        // Rolldown (Vite 8) only accepts the function form here.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('framer-motion') || id.includes('motion-dom')) return 'motion';
          if (id.includes('react-dom') || id.includes('/react/')) return 'react';
        },
      },
    },
  },
});
