import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: {
      'index': 'src/index.ts',
      'vite/index': 'src/vite/index.ts',
      'nuxt/index': 'src/nuxt/index.ts',
      'codegen/index': 'src/codegen/index.ts',
      'cli/index': 'src/cli/index.ts',
    },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['vite', 'chokidar'],
    target: 'node18',
  },
])
