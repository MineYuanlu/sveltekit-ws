import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { viteWebSocketServer } from '@yuanlu_yl/sveltekit-ws/server';

export default defineConfig({
    plugins: [
        // ⚠️ WebSocket plugin MUST be before sveltekit()
        viteWebSocketServer({
            path: '/ws',
            maxPayload: 1024 * 1024,
            heartbeat: true,
            heartbeatInterval: 30000,
        }),
        sveltekit(),
    ],
    ssr: {
        noExternal: ['svelte-motion'],
    },
});
