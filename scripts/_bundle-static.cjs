const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const entries = [
  { entry: path.join(ROOT, 'static', 'viewer', 'viewer.js'), outfile: path.join(ROOT, 'static', 'viewer', 'viewer.bundle.js') },
  { entry: path.join(ROOT, 'static', 'builder', 'builder.js'), outfile: path.join(ROOT, 'static', 'builder', 'builder.bundle.js') },
];

Promise.all(entries.map(({entry, outfile}) => {
  return esbuild.build({
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
}))
.then(() => {
  console.log('Static bundles created');
  process.exit(0);
})
.catch(err => {
  console.error(err);
  process.exit(1);
});
