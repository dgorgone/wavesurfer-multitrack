import glob from 'glob'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'
import nodeResolve from '@rollup/plugin-node-resolve'

const plugins = [typescript(), nodeResolve()]
const pluginsMin = [typescript(), terser(), nodeResolve()]
const input = 'src/multitrack.ts'

export default [
  // ES module (non-minified)
  {
    input,
    output: {
      file: 'dist/multitrack.js',
      format: 'esm',
    },
    plugins,
  },
  // CommonJS module (Node.js, non-minified)
  {
    input,
    output: {
      file: 'dist/multitrack.cjs',
      format: 'cjs',
      exports: 'default',
    },
    plugins,
  },
  // UMD (browser script tag, non-minified)
  {
    input,
    output: {
      name: 'Multitrack',
      file: 'dist/multitrack.umd.js',
      format: 'umd',
      exports: 'default',
    },
    plugins,
  },
  // UMD (browser script tag, minified)
  {
    input,
    output: {
      name: 'Multitrack',
      file: 'dist/multitrack.min.js',
      format: 'umd',
      exports: 'default',
    },
    plugins: pluginsMin,
  },
]
