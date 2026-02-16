#!/usr/bin/env node
import { context } from 'esbuild';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const watchMode = process.argv.includes('--watch');

const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
const isProd = !process.argv.includes('--dev');
const appVersion = isProd ? pkg.version : `${pkg.version}-dev`;
const gitCommit = process.env.GIT_COMMIT?.slice(0, 8) || 'devlocal';

const buildConfig = {
  entryPoints: [join(rootDir, 'server/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: join(rootDir, 'dist/server.mjs'),
  external: [
    'pg',
    'postgres',
    'express',
    '@libpg-query/parser',
    '@electric-sql/pglite',
    '@electric-sql/pglite-socket',
  ],
  banner: {
    js: `#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { fileURLToPath } from 'url';
import { dirname } from 'path';`,
  },
  define: {
    '__APP_VERSION__': JSON.stringify(appVersion),
    '__DEV__': JSON.stringify(watchMode),
    '__GIT_COMMIT__': JSON.stringify(gitCommit),
    'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
  },
  sourcemap: true,
  logLevel: 'info',
};

if (watchMode) {
  const ctx = await context(buildConfig);
  await ctx.watch();
  console.log('Watching for server file changes...');
} else {
  const { context: buildContext } = await import('esbuild');
  const ctx = await buildContext(buildConfig);
  await ctx.rebuild();
  await ctx.dispose();
  console.log('Server build complete!');
}
