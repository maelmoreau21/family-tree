import fs from 'fs';
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const meta = JSON.parse(fs.readFileSync("./package.json", "utf8"));

const globals = {
  "d3": "d3",
  "d3-selection": "d3",
  "d3-shape": "d3",
  "d3-hierarchy": "d3",
  "d3-zoom": "d3",
  "d3-array": "d3",
  "d3-transition": "d3"
}
const banner = `// ${meta.homepage} v${meta.version} Copyright ${(new Date).getFullYear()} ${meta.author.name}`
const input = "src/index.ts"
const external = [
  "d3",
  "d3-selection",
  "d3-shape",
  "d3-hierarchy",
  "d3-zoom",
  "d3-array",
  "d3-transition"
]
const plugins = [
  typescript({
    tsconfig: "./tsconfig.json",
    declaration: true,
    declarationDir: "./dist/types",
    exclude: ["tests/**/*"]
  })
]

export default [
  {
    input: input,
    external: external,
    output: {
      file: `dist/${meta.name}.js`,
      name: "f3",
      format: "umd",
      exports: "named",
      banner: banner,
      globals: globals
    },
    plugins: plugins
  },
  
  {
    input: input,
    external: external,
    output:     {
      file: `dist/${meta.name}.esm.js`,
      format: 'es',
      banner: banner,
      globals: globals
    },
    plugins: plugins
  },
  
  {
    input: input,
    external: external,
    output: {
      file: `dist/${meta.name}.min.js`,
      name: "f3",
      format: "umd",
      exports: "named",
      banner: banner,
      globals: globals
    },
    plugins: [
      ...plugins,
      terser({
        output: {
          preamble: banner
        }
      })
    ]
  }
]