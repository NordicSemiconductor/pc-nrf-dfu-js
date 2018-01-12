
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import builtins from 'rollup-plugin-node-builtins';
import globals from 'rollup-plugin-node-globals';
import eslint from 'rollup-plugin-eslint';
import pkg from './package.json';

export default [
    // browser-friendly UMD build
    {
        input: 'src/index.js',
        output: {
            file: pkg.browser,
            format: 'iife',
            sourcemap: true
        },
        external: ['jszip'],
        globals: {
            jszip: 'JSZip'
        },
        name: 'nrfDfu',
        plugins: [
            eslint(),
            resolve(), // so Rollup can find `crc32`
            commonjs(),
            builtins(),
            globals()
        ]
    },

    // CommonJS (for Node) and ES module (for bundlers) build.
    // (We could have three entries in the configuration array
    // instead of two, but it's quicker to generate multiple
    // builds from a single configuration where possible, using
    // the `targets` option which can specify `dest` and `format`)
    {
        input: 'src/index.js',
        external: ['buffer', 'fs', 'jszip', 'debug'],
        output: [
            { file: pkg.main, format: 'cjs', sourcemap: true },
//             { file: pkg.module, format: 'es', sourcemap: true }
        ],
        plugins: [
            eslint(),
            resolve(), // so Rollup can find `crc32`
// 			commonjs() // so Rollup can convert `crc32` to an ES module
        ]
    }
];
