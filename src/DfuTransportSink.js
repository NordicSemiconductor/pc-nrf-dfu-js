/**
 * copyright (c) 2015 - 2018, Nordic Semiconductor ASA
 *
 * all rights reserved.
 *
 * redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * 1. redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 *
 * 2. redistributions in binary form, except as embedded into a nordic
 *    semiconductor asa integrated circuit in a product or a software update for
 *    such product, must reproduce the above copyright notice, this list of
 *    conditions and the following disclaimer in the documentation and/or other
 *    materials provided with the distribution.
 *
 * 3. neither the name of Nordic Semiconductor ASA nor the names of its
 *    contributors may be used to endorse or promote products derived from this
 *    software without specific prior written permission.
 *
 * 4. this software, with or without modification, must only be used with a
 *    Nordic Semiconductor ASA integrated circuit.
 *
 * 5. any software provided in binary form under this license must not be reverse
 *    engineered, decompiled, modified and/or disassembled.
 *
 * this software is provided by Nordic Semiconductor ASA "as is" and any express
 * or implied warranties, including, but not limited to, the implied warranties
 * of merchantability, noninfringement, and fitness for a particular purpose are
 * disclaimed. in no event shall Nordic Semiconductor ASA or contributors be
 * liable for any direct, indirect, incidental, special, exemplary, or
 * consequential damages (including, but not limited to, procurement of substitute
 * goods or services; loss of use, data, or profits; or business interruption)
 * however caused and on any theory of liability, whether in contract, strict
 * liability, or tort (including negligence or otherwise) arising in any way out
 * of the use of this software, even if advised of the possibility of such damage.
 *
 */
import Debug from 'debug';
import { crc32 } from 'crc';
import { DfuError, ErrorCode } from './DfuError';
import DfuAbstractTransport from './DfuAbstractTransport';

const debug = Debug('dfu:sink');

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
            throw new DfuError(ErrorCode.ERROR_MUST_HAVE_PAYLOAD);
        }
        if (crcSoFar !== this.crcs[this.selected]) {
            throw new DfuError(ErrorCode.ERROR_INVOKED_MISMATCHED_CRC32);
        }
        if (bytes.length > this.sizes[this.selected]) {
            throw new DfuError(ErrorCode.ERROR_MORE_BYTES_THAN_CHUNK_SIZE);
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
            throw new DfuError(ErrorCode.ERROR_MUST_HAVE_PAYLOAD);
        }
        return Promise.resolve();
    }

    executeObject() {
        if (!this.selected) {
            throw new DfuError(ErrorCode.ERROR_MUST_HAVE_PAYLOAD);
        }
        return Promise.resolve();
    }

    selectObject(type) {
        if (!Object.prototype.hasOwnProperty.call(this.offsets, type)) {
            throw new DfuError(ErrorCode.ERROR_INVALID_PAYLOAD_TYPE);
        }
        this.selected = type;
        return Promise.resolve([this.offsets[type], this.crcs[type], this.chunkSize]);
    }
}
