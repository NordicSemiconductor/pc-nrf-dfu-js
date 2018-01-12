// FIXME: Should be `import {crc32} from 'crc'`, https://github.com/alexgorbatchev/node-crc/pull/50
// import * as crc from 'crc';
// const crc32 = crc.crc32;
// import {crc32} from 'crc';
import crc32 from 'crc/src/crc32';

import DfuAbstractTransport from './DfuAbstractTransport';

const debug = require('debug')('dfu:sink');

/**
 * Dummy DFU transport.
 * This will just consume bytes, sending them to /dev/null.
 * It will also handle a CRC32 accumulator, to report back the checksums to
 * the higher level logic.
 */


export default class DfuTransportSink extends DfuAbstractTransport {
    constructor(bytesPerSecond = Infinity, chunkSize = 0x1000) {
        super();

        this.bytesPerMilliSecond = bytesPerSecond * 1000;
        this.chunkSize = chunkSize;

        this.offsets = { 1: 0, 2: 0 };
        this.crcs = { 1: undefined, 2: undefined };
        this.sizes = { 1: 0, 2: 0 };

        this.selected = undefined;
    }

    createObject(type, size) {
        this.selectObject(type);
        this.sizes[type] = size;
        debug(`Sink DFU transport: created object of type ${type}, size ${size}`);
        return Promise.resolve();
    }

    writeObject(bytes, crcSoFar) {
        if (!this.selected) {
            throw new Error('Must create/select a payload type first.');
        }
        if (crcSoFar !== this.crcs[this.selected]) {
            throw new Error('Invoked with a mismatched CRC32 checksum.');
        }
        if (bytes.length > this.sizes[this.selected]) {
            throw new Error('Tried to push more bytes to a chunk than the chunk size.');
        }
        this.offsets[this.selected] += bytes.length;
        this.crcs[this.selected] = crc32(bytes, crcSoFar);
        return new Promise(res => {
            setTimeout(() => {
                debug(`Sink DFU transport: consumed ${bytes.length} bytes`);
                res([this.offsets[this.selected], this.crcs[this.selected]]);
            }, bytes / this.bytesPerMilliSecond);
        });
    }

    crcObject() {
        if (!this.selected) {
            throw new Error('Must create/select a payload type first.');
        }
        return Promise.resolve();
    }

    executeObject() {
        if (!this.selected) {
            throw new Error('Must create/select a payload type first.');
        }
        return Promise.resolve();
    }

    selectObject(type) {
        if (!Object.prototype.hasOwnProperty.call(this.offsets, type)) {
            throw new Error('Tried to select invalid payload type. Valid types are 0x01 and 0x02.');
        }
        this.selected = type;
        return Promise.resolve([this.offsets[type], this.crcs[type], this.chunkSize]);
    }
}
