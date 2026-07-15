import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        open: true,
        host: true,
        headers: {
            'Cache-Control': 'no-store',
        },
        // Proxy API + WebSocket to the backend so the frontend can use
        // same-origin URLs in both dev and production.
        proxy: {
            '/api': { target: 'http://localhost:3001', changeOrigin: true },
            '/ws': { target: 'ws://localhost:3001', ws: true },
        },
    },
});
