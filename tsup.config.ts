import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        index: 'src/common/index.ts',
        client: 'src/client/index.ts',
        server: 'src/server/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['@sveltejs/kit', 'vite', 'ws'],
});
