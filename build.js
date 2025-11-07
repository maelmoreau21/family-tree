import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { build as esbuild } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = __dirname;

function beforeRollup() {
  fs.rmSync(path.join(ROOT_DIR, 'dist'), { recursive: true, force: true });
}

function rollup() {
  execSync('rollup -c', { encoding: 'utf-8' });
}

function afterRollup() {
  fs.cpSync(path.join(ROOT_DIR, 'src', 'styles'), path.join(ROOT_DIR, 'dist', 'styles'), { recursive: true });
}

async function bundleStatic() {
  const entries = [
    {
      name: 'viewer',
      entry: path.join(ROOT_DIR, 'static', 'viewer', 'viewer.js'),
      outfile: path.join(ROOT_DIR, 'static', 'viewer', 'viewer.bundle.js')
    },
    {
      name: 'builder',
      entry: path.join(ROOT_DIR, 'static', 'builder', 'builder.js'),
      outfile: path.join(ROOT_DIR, 'static', 'builder', 'builder.bundle.js')
    }
  ];

  await Promise.all(entries.map(async ({ name, entry, outfile }) => {
    try {
      await esbuild({
        entryPoints: [entry],
        bundle: true,
        format: 'esm',
        minify: true,
        sourcemap: true,
        target: ['es2019'],
        outfile,
        external: ['/lib/family-tree.esm.js'],
        define: {
          'process.env.NODE_ENV': '"production"'
        },
        logLevel: 'info'
      });
    } catch (error) {
      error.message = `[bundle:${name}] ${error.message}`;
      throw error;
    }
  }));
}

async function main() {
  beforeRollup();
  rollup();
  afterRollup();
  await bundleStatic();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
