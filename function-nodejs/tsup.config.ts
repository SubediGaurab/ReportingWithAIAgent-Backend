import { defineConfig } from 'tsup';

export default defineConfig([
  {
    name: 'lambda',
    entry: ['src/index.ts'],
    format: 'cjs',
    platform: 'node',
    target: 'node24',
    bundle: true,
    minify: false,
    sourcemap: true,
    clean: true,
    outDir: 'dist',
    external: [
      '@aws-sdk/*',
      'aws-sdk',
      '@anthropic-ai/claude-agent-sdk'
    ],
    onSuccess: 'cp src/agent/system-prompt.md dist/'
  },
  {
    name: 'dev',
    entry: ['src/manual_run.ts'],
    format: 'cjs',
    platform: 'node',
    target: 'node24',
    bundle: true,
    minify: false,
    sourcemap: true,
    outDir: 'dist'
  }
]);
