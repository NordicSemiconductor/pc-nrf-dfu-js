
import DfuAbstractTransport from './DfuAbstractTransport';

// FIXME: Should be `import {crc32} from 'crc'`, https://github.com/alexgorbatchev/node-crc/pull/50
// import * as crc from 'crc';
// const crc32 = crc.crc32;
// import {crc32} from 'crc';
import crc32 from 'crc/src/crc32';

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

        this._bytesPerMilliSecond = bytesPerSecond * 1000;
        this._chunkSize = chunkSize;

        this._offsets = {1: 0, 2: 0};
        this._crcs = {1: undefined, 2: undefined};
        this._sizes = {1: 0, 2: 0};

        this._selected = undefined;
    }

    _createObject(type, size) {
        this._selectObject(type);
        this._sizes[type] = size;
        debug(`Sink DFU transport: created object of type ${type}, size ${size}`);
        return Promise.resolve();
    }

    _writeObject(bytes, crcSoFar) {
        if (!this._selected) {
            throw new Error('Must create/select a payload type first.');
        }
        if (crcSoFar !== this._crcs[this._selected]) {
            throw new Error('Invoked with a mismatched CRC32 checksum.');
        }
        if (bytes.length > this._sizes[this._selected]) {
            throw new Error('Tried to push more bytes to a chunk than the chunk size.');
        }
        this._offsets[this._selected] += bytes.length;
        this._crcs[this._selected] = crc32(bytes, crcSoFar);
        return new Promise((res, rej)=>{
            setTimeout(()=>{
                debug(`Sink DFU transport: consumed ${bytes.length} bytes`);
                res([this._offsets[this._selected], this._crcs[this._selected]])
            }, bytes / this._bytesPerMilliSecond);
        });

    }

    _crcObject() {
        if (!this._selected) {
            throw new Error('Must create/select a payload type first.');
        }
        return Promise.resolve();
    }

    _executeObject() {
        if (!this._selected) {
            throw new Error('Must create/select a payload type first.');
        }
        return Promise.resolve();
    }

    _selectObject(type) {
        if (!this._offsets.hasOwnProperty(type)) {
            throw new Error('Tried to select invalid payload type. Valid types are 0x01 and 0x02.');
        }
        this._selected = type;
        return Promise.resolve([ this._offsets[type], this._crcs[type], this._chunkSize ]);
    }
}




