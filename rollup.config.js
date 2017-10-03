
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import pkg from './package.json';

export default [
    // browser-friendly UMD build
    {
        input: 'src/index.js',
        output: {
            file: pkg.browser,
            format: 'iife'
        },
        name: 'nrfDfu',
        plugins: [
            resolve(), // so Rollup can find `crc32`
            commonjs()
//             builtins()
        ]
    },

    // CommonJS (for Node) and ES module (for bundlers) build.
    // (We could have three entries in the configuration array
    // instead of two, but it's quicker to generate multiple
    // builds from a single configuration where possible, using
    // the `targets` option which can specify `dest` and `format`)
    {
        input: 'src/index.js',
		external: ['buffer'],
        output: [
            { file: pkg.main, format: 'cjs' },
            { file: pkg.module, format: 'es' }
        ],
        plugins: [
            resolve(), // so Rollup can find `crc32`
// 			commonjs() // so Rollup can convert `crc32` to an ES module
        ]
    }
];
