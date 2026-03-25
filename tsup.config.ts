import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        client: 'src/client.ts',
        server: 'src/server.ts',
    },
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['@sveltejs/kit', 'vite', 'ws'],
});
