import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        exclude: ['tests/browser/**','node_modules/**'],
        testTimeout: 15000,
    },
});
