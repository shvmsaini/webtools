import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Forward /api calls to the Spring backend so the dev server can be
// pointed at the same address from the dashboard UI without CORS.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true,
            },
        },
    },
});
