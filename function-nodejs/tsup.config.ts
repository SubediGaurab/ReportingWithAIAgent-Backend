import { defineConfig } from 'tsup';

export default defineConfig([
  {
    name: 'lambda',
    entry: ['src/index.ts'],
    format: 'esm',
    platform: 'node',
    target: 'node22',
    bundle: true,
    minify: true,
    sourcemap: false,
    clean: true,
    outDir: 'dist',
    external: [
      '@aws-sdk/*',
      'aws-sdk'
    ],
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
    },
    onSuccess: 'cp src/agent/system-prompt.md dist/'
  },
  {
    name: 'dev',
    entry: ['src/manual_run.ts'],
    format: 'esm',
    platform: 'node',
    target: 'node22',
    bundle: true,
    minify: false,
    sourcemap: true,
    outDir: 'dist'
  }
]);
