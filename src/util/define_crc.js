/*
The MIT License (MIT)

Copyright 2014 Alex Gorbatchev

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const { Buffer } = require('buffer');

let castToBytes;

if (typeof Uint8Array !== 'undefined' && Uint8Array.from &&
    typeof TextDecoder !== 'undefined') {
    const utf8Decoder = new TextDecoder('utf-8');

    castToBytes = arr => {
        if (arr instanceof Uint8Array) {
            return arr;
        } else if (typeof arr === 'string') {
            return utf8Decoder(arr);
        }
        return Uint8Array.from(arr);
    };
} else {
    castToBytes = Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow
        ? (arr => (Buffer.isBuffer(arr) ? arr : Buffer.from(arr)))
        // support for Node < 5.10
        // eslint-disable-next-line
        : (arr => (Buffer.isBuffer(arr) ? arr : new Buffer(arr)));
}

export default function defineCrc(model, calc) {
    // eslint-disable-next-line no-bitwise
    const fn = (buf, previous) => calc(castToBytes(buf), previous) >>> 0;
    fn.signed = calc;
    fn.unsigned = fn;
    fn.model = model;

    return fn;
}
