
// FIXME: Should be `import {crc32} from 'crc'`, https://github.com/alexgorbatchev/node-crc/pull/50
// import * as crc from 'crc';
// const crc32 = crc.crc32;
// import {crc32} from 'crc';
import crc32 from 'crc/src/crc32';


import ProgressCounter from './ProgressCounter';


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
            throw new Error("Cannot instantiate DfuAbstractTransport, use a concrete subclass instead.");
        }
    }

    // Given a Uint8Array, sends it as an init payload / "command object".
    // Returns a Promise.
    sendInitPacket(bytes) {
        return this._sendPayload(0x01, bytes);
    }

    // Given a Uint8Array, sends it as the main payload / "data object".
    // Returns a Promise.
    sendFirmwareImage(bytes) {
        return this._sendPayload(0x02, bytes);
    }


    // Sends either a init payload ("init packet"/"command object") or a data payload
    // ("firmware image"/"data objects")
    _sendPayload(type, bytes) {
        return this._selectObject(type).then(([offset, undefined, chunkSize])=>{
//             if (offset !== 0) {
//                 throw new Error('Could not create payload with offset zero');
//             }

            return this._sendPayloadChunk(type, bytes, 0, chunkSize, 0);
        });
    }


    // Sends *one* chunk.
    // Sending a chunk involves:
    // - Creating a payload chunk
    // - Writing the payload chunk (wire implementation might perform fragmentation)
    // - Check CRC32 and offset of payload so far
    // - Execute the payload chunk (target might write a flash page)
    _sendPayloadChunk(type, bytes, start, chunkSize, crcSoFar) {
        if (start >= bytes.length) {
            return Promise.resolve();
        }

        const end = Math.min(bytes.length, start + chunkSize);
        const subarray = bytes.subarray(start, end);
        const crcAtChunkEnd = crc32(subarray, crcSoFar);

        return this._createObject(type, end - start)
        .then(()=>{
            return this._writeObject(subarray, crcSoFar);
        })
        .then(()=>{
            return this._crcObject(end, crcAtChunkEnd);
        })
        .then(([offset, crc])=>{
            if (offset !== end) {
                throw new Error(`Expected ${end} bytes to have been sent, actual is ${offset} bytes.`);
            }

            if (crcAtChunkEnd !== crc) {
                throw new Error(`CRC mismatch after ${end} bytes have been sent.`);
            }
        })
        .then(()=>{
            this._executeObject();
        })
        .then(()=>{
            return this._sendPayloadChunk(type, bytes, end, chunkSize, crcAtChunkEnd);
        });
    }


    // The following 5 methods have a 1-to-1 mapping to the 5 DFU requests
    // documented at http://infocenter.nordicsemi.com/index.jsp?topic=%2Fcom.nordic.infocenter.sdk5.v14.0.0%2Flib_dfu_transport.html

    // Allocate space for a new payload chunk. Resets the progress
    // since the last Execute command, and selects the newly created object.
    // Must return a Promise
    // Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
    _createObject(type, size) {}

    // Fill the space previously allocated with _createObject with the given bytes.
    // Also receives the CRC32 so far, as some wire implementations perform extra CRC32 checks
    // as the fragmented data is being checksummed.
    // Must return a Promise to an array of [offset, crc]
    // Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
    _writeObject(bytes, crcSoFar) {}

    // Trigger a CRC calculation of the data sent so far.
    // Must return a Promise to an array of [offset, crc]
    // Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
    _crcObject() {}

    // Marks payload chunk as fully sent. The target may write a page of flash memory and
    // prepare to receive the next chunk (if not all pages have been sent), or start
    // firmware postvalidation (if all pages have been sent).
    // Must return a Promise
    // Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
    _executeObject() {}

    // Marks the last payload type as "active".
    // Returns a Promise to an array of [offset, crc, max chunk size].
    // The offset is *absolute* - it includes all chunks sent so far, and so can be several
    // times larger than the max chunk size.
    // Typically the chunk size will be the size of a page of flash memory.
    // Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
    _selectObject(type) {}

}





