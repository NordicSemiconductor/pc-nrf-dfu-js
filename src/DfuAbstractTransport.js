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

import crc32 from './util/crc32';
import { DfuError, ErrorCode } from './DfuError';

const debug = require('debug')('dfu:transport');

/**
 * Implements the logic common to all transports, but not the transport itself.
 *
 * It says "Abstract" in the class name, so do not instantiate directly. Subclass,
 * and complete the functionality of the needed methods with the actual transport
 * logic.
 */
export default class DfuAbstractTransport {
    constructor() {
        if (this.constructor === DfuAbstractTransport) {
            throw new DfuError(ErrorCode.ERROR_CAN_NOT_INIT_ABSTRACT_TRANSPORT);
        }
    }

    // Restarts the DFU procedure by sending a create command of
    // type 1 (init payload / "command object").
    // By default, CRC checks are done in order to continue an interrupted
    // transfer. Calling this before a sendInitPacket() will forcefully
    // re-send everything.
    restart() {
        debug('Forcefully restarting DFU procedure');
        return this.createObject(1, 0x10);
    }

    // Abort the DFU procedure, which means exiting the bootloader mode
    // and trying to switch back to the app mode
    abort() {
        debug('Exit Bootloader Mode');
        return this.abortObject();
    }

    // Given a Uint8Array, sends it as an init payload / "command object".
    // Returns a Promise.
    sendInitPacket(bytes) {
        return this.sendPayload(0x01, bytes);
    }

    // Given a Uint8Array, sends it as the main payload / "data object".
    // Returns a Promise.
    sendFirmwareImage(bytes) {
        return this.sendPayload(0x02, bytes);
    }


    // Sends either a init payload ("init packet"/"command object") or a data payload
    // ("firmware image"/"data objects")
    sendPayload(type, bytes, resumeAtChunkBoundary = false) {
        debug(`Sending payload of type ${type}`);
        return this.selectObject(type).then(([offset, crcSoFar, chunkSize]) => {
            if (offset !== 0) {
                debug(`Offset is not zero (${offset}). Checking if graceful continuation is possible.`);
                const crc = crc32(bytes.subarray(0, offset));

                if (crc === crcSoFar) {
                    debug('CRC match');
                    if (offset === bytes.length) {
                        debug('Payload already transferred sucessfully, sending execute command just in case.');

                        // Send an exec command, just in case the previous connection broke
                        // just before the exec command. An extra exec command will have no
                        // effect.
                        return this.executeObject(type, chunkSize);
                    }
                    if ((offset % chunkSize) === 0 && !resumeAtChunkBoundary) {
                        // Edge case: when an exact multiple of the chunk size has
                        // been transferred, the host side cannot be sure if the last
                        // chunk has been marked as ready ("executed") or not.
                        // Fortunately, if an "execute" command is sent right after
                        // another "execute" command, the second one will do nothing
                        // and yet receive an "OK" response code.
                        debug('Edge case: payload transferred up to page boundary; previous execute command might have been lost, re-sending.');

                        return this.executeObject(type, chunkSize)
                            .then(() => this.sendPayload(type, bytes, true));
                    }
                    debug(`Payload partially transferred sucessfully, continuing from offset ${offset}.`);

                    // Send the remainder of a half-finished chunk
                    const end = Math.min(bytes.length, (offset + chunkSize) - (offset % chunkSize));

                    return this.sendAndExecutePayloadChunk(
                        type, bytes, offset,
                        end, chunkSize, crc
                    );
                }

                // Note that these are CRC mismatches at a chunk level, not at a
                // transport level. Individual transports might decide to roll back
                // parts of a chunk (re-creating it) on PRN CRC failures.
                // But here it means that there is a CRC mismatch while trying to
                // continue an interrupted DFU, and the behaviour in this case is to panic.
                debug(`CRC mismatch: expected/actual 0x${crc.toString(16)}/0x${crcSoFar.toString(16)}`);

                return Promise.reject(new DfuError(ErrorCode.ERROR_PRE_DFU_INTERRUPTED));
            }
            const end = Math.min(bytes.length, chunkSize);

            return this.createObject(type, end)
                .then(() => this.sendAndExecutePayloadChunk(type, bytes, 0, end, chunkSize));
        });
    }


    // Sends *one* chunk.
    // Sending a chunk involves:
    // - (Creating a payload chunk) (this is done *before* sending the current chunk)
    // - Writing the payload chunk (wire implementation might perform fragmentation)
    // - Check CRC32 and offset of payload so far
    // - Execute the payload chunk (target might write a flash page)
    sendAndExecutePayloadChunk(type, bytes, start, end, chunkSize, crcSoFar = undefined) {
        return this.sendPayloadChunk(type, bytes, start, end, chunkSize, crcSoFar)
            .then(() => this.executeObject())
            .then(() => {
                if (end >= bytes.length) {
                    debug(`Sent ${end} bytes, this payload type is finished`);
                    return Promise.resolve();
                }
                // Send next chunk
                debug(`Sent ${end} bytes, not finished yet (until ${bytes.length})`);
                const nextEnd = Math.min(bytes.length, end + chunkSize);

                return this.createObject(type, nextEnd - end)
                    .then(() => this.sendAndExecutePayloadChunk(
                        type, bytes, end, nextEnd, chunkSize,
                        crc32(bytes.subarray(0, end))
                    ));
            });
    }

    // Sends one payload chunk, retrying if necessary.
    // This is done without checksums nor sending the "execute" command. The reason
    // for splitting this code apart is that retrying a chunk is easier when abstracting away
    // the "execute" and "next chunk" logic
    sendPayloadChunk(type, bytes, start, end, chunkSize, crcSoFar = undefined, retries = 0) {
        const subarray = bytes.subarray(start, end);
        const crcAtChunkEnd = crc32(subarray, crcSoFar);

        return this.writeObject(subarray, crcSoFar, start)
            .then(() => {
                debug('Payload type fully transferred, requesting explicit checksum');
                return this.crcObject(end, crcAtChunkEnd);
            })
            .then(([offset, crc]) => {
                if (offset !== end) {
                    throw new DfuError(ErrorCode.ERROR_UNEXPECTED_BYTES, `Expected ${end} bytes to have been sent, actual is ${offset} bytes.`);
                }

                if (crcAtChunkEnd !== crc) {
                    throw new DfuError(ErrorCode.ERROR_CRC_MISMATCH, `CRC mismatch after ${end} bytes have been sent: expected ${crcAtChunkEnd}, got ${crc}.`);
                } else {
                    debug(`Explicit checksum OK at ${end} bytes`);
                }
            })
            .catch(err => {
                if (retries >= 5) {
                    return Promise.reject(new DfuError(ErrorCode.ERROR_TOO_MANY_WRITE_FAILURES, `Last failure: ${err}`));
                }
                debug(`Chunk write failed (${err}) Re-sending the whole chunk starting at ${start}. Times retried: ${retries}`);

                // FIXME: Instead of re-creating the whole chunk, select the payload
                // type again and check the CRC so far.

                const newStart = start - (start % chunkSize);
                // Rewind to the start of the block
                const rewoundCrc = newStart === 0 ? undefined : crc32(bytes.subarray(0, newStart));

                return this.createObject(type, end - start)
                    .then(() => this.sendPayloadChunk(
                        type, bytes, newStart, end,
                        chunkSize, rewoundCrc, retries + 1
                    ));
            });
    }


    // The following 5 methods have a 1-to-1 mapping to the 5 DFU requests
    // documented at http://infocenter.nordicsemi.com/index.jsp?topic=%2Fcom.nordic.infocenter.sdk5.v14.0.0%2Flib_dfu_transport.html
    // These are meant as abstract methods, meaning they do nothing and subclasses
    // must provide an implementation.

    /* eslint-disable class-methods-use-this, no-unused-vars */

    // Allocate space for a new payload chunk. Resets the progress
    // since the last Execute command, and selects the newly created object.
    // Must return a Promise
    // Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
    createObject(type, size) {}

    // Fill the space previously allocated with createObject() with the given bytes.
    // Also receives the absolute offset and CRC32 so far, as some wire
    // implementations perform extra CRC32 checks as the fragmented data is being
    // checksummed (and the return value for those checks involves both the absolute
    // offset and the CRC32 value). Note that the CRC and offset are not part of the
    // SDK implementation.
    // Must return a Promise to an array of [offset, crc]
    // Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
    writeObject(bytes, crcSoFar, offsetSoFar) {}

    // Trigger a CRC calculation of the data sent so far.
    // Must return a Promise to an array of [offset, crc]
    // Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
    crcObject() {}

    // Marks payload chunk as fully sent. The target may write a page of flash memory and
    // prepare to receive the next chunk (if not all pages have been sent), or start
    // firmware postvalidation (if all pages have been sent).
    // Must return a Promise
    // Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
    executeObject() {}

    // Marks the last payload type as "active".
    // Returns a Promise to an array of [offset, crc, max chunk size].
    // The offset is *absolute* - it includes all chunks sent so far, and so can be several
    // times larger than the max chunk size.
    // Typically the chunk size will be the size of a page of flash memory.
    // Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
    selectObject(type) {}

    // Abort bootloader mode and try to switch back to app mode
    abortObject() {}
}
