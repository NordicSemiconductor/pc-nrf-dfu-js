import crc32$1 from 'crc/lib/crc32';

/**
 * Represents an indicator of progress, in number of bytes.
 *
 *
 *
 */

class ProgressCounter {

    constructor(targetAmount) {
        this._target = targetAmount;
//         this._startTime = performance.now(); /// TODO: properly use timings
//         this._lastTime = performance.now();
        this._current = 0;

        this._waits = [];
    }

    // Returns a `Promise` that resolves when there has been a
    // progress update, with the progress information at that point.
    // Note that one can `await` for this.
    get nextProgressUpdate() {
        return new Promise((res)=>{
            this._waits.push(()=>{
                res({
                    amount: this._current,
                    percent: this._current / this._target
                });
            });
        });
    }

    // Advances the current progress by the given amount (or reduces it if negative)
    advance(amount){
        this._current += amount;
        this._waits.forEach((f)=>f());
    }

}

/**
 * Represents a DFU Operation - the act of updating the firmware on a
 * nRF device.
 *
 * A firmware update is composed of one or more updates - e.g. bootloader then application,
 * or softdevice then application, or bootloader+softdevice then application, or only
 * one of these pieces.
 *
 * A nRF device is represented by the transport used to update it - the DfuOperation does
 * not care if that device is connected through USB and has serial number 12345678, or if that
 * device is connected through Bluetooth Low Energy and has Bluetooth address AA:BB:CC:DD:EE:FF.
 *
 * The transport must be instantiated prior to instantiating the DFU operation. This includes
 * doing things such as service discovery, buttonless BLE DFU initialization, or claiming
 * a USB interface of a USB device.
 */
class DfuOperation {

    constructor(dfuUpdates, dfuTransport, autoStart=false) {
        this._updates = dfuUpdates.updates;
        this._updatesPerformed = 0;
        this._transport = dfuTransport;

//         let totalSize = this._updates.reduce((update)=>)
        this._progressCounter = new ProgressCounter(totalSize);

        if (this.autoStart) { this.start(); }
    }

    get progressGenerator() { return this._progressGenerator; }

    /**
     * Starts the DFU operation. Returns a Promise that resolves as soon as
     * the DFU has been performed (as in "everything has been sent to the
     * transport, and the CRCs back seem correct").
     *
     * Calling start() more than once has no effect, and will only return a
     * reference to the same Promise.
     */
    start() {
        if (this._finishPromise) { return this._finishPromise; }

        return this._finishPromise = this._start();
    }

    _start() {
        return this._performNextUpdate(0);
    }

    // Takes in an update from this._update, performs it. Returns a Promise
    // which resolves when all updates are done.
    // - Tell the transport to send the init packet
    // - Tell the transport to send the binary blob
    // - Proceed to the next update
    _performNextUpdate(updateNumber) {
        if (this._updates.length <= updateNumber) {
            return Promise.resolve();
        }

        return this._transport.sendInitPacket(this._updates[updateNumber][0])
        .then(()=>{
            return this._transport.sendFirmwareImage(this._updates[updateNumber][1])
        })
        .then(()=>{
            this._performNextUpdate(updateNumber+1);
        });
    }


}

/**
 * Implements the logic common to all transports, but not the transport itself.
 *
 * It says "Abstract" in the class name, so do not instantiate directly. Subclass,
 * and complete the functionality of the needed methods with the actual transport
 * logic.
 */

class DfuAbstractTransport {
    constructor() {
        throw new Error("Cannot instantiate DfuAbstractTransport, use a concrete subclass instead.");
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
    _sendPayloadChunk(type, bytes) {
        return this._selectObject(type).then(([offset, undefined, chunkSize])=>{
            if (offset !== 0) {
                throw new Error('Could not create payload with offset zero');
            }

            return this._writeChunkedBytes(bytes, 0, chunkSize, undefined);
        });
    }


    // Sends *one* chunk.
    // Sending a chunk involves:
    // - Creating a payload chunk
    // - Writing the payload chunk (wire implementation might perform fragmentation)
    // - Check CRC32 and offset of payload so far
    // - Execute the payload chunk (target might write a flash page)
    _sendPayloadChunk(bytes, start, chunkSize, crcSoFar) {
        if (start >= bytes.length) {
            return Promise.resolve();
        }

        const end = Math.min(bytes.length, start + chunkSize);
        const subarray = bytes.subarray(start, end);
        const crcAtChunkEnd = crc32$1(subarray, crcSoFar);

        return this._createObject(type, end - start)
        .then(()=>{
            let [offset, crc] = this._writeObject( subarray );
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
            return this._writeChunkedBytes(bytes, end, chunkSize, crcAtChunkEnd);
        });
    }


    // The following 5 methods have a 1-to-1 mapping to the 5 DFU requests
    // documented at http://infocenter.nordicsemi.com/index.jsp?topic=%2Fcom.nordic.infocenter.sdk5.v14.0.0%2Flib_dfu_transport.html

    // Allocate space for a new payload chunk. Resets the progress
    // since the last Execute command, and selects the newly created object.
    // Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
    _createObject(type, size) {}

    // Fill the space previously allocated with _createObject with the given bytes.
    // Also receives the CRC32 so far, as some wire implementations perform extra CRC32 checks
    // as the fragmented data is being checksummed.
    // Must return an array of [offset, crc]
    // Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
    _writeObject(bytes, crcSoFar) {}

    // Trigger a CRC calculation of the data sent so far.
    // Must return an array of [offset, crc]
    // Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
    _crcObject() {}

    // Marks payload chunk as fully sent. The target may write a page of flash memory and
    // prepare to receive the next chunk (if not all pages have been sent), or start
    // firmware postvalidation (if all pages have been sent).
    // Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
    _executeObject() {}

    // Marks the last payload type as "active".
    // Returns an array of [offset, crc, max chunk size].
    // The offset is *absolute* - it includes all chunks sent so far, and so can be several
    // times larger than the max chunk size.
    // Typically the chunk size will be the size of a page of flash memory.
    // Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
    _selectObject(type) {}

}

/**
 * Represents a set of DFU updates.
 *
 * A DFU update is an update of either:
 * - The bootloader
 * - The SoftDevice
 * - The user application
 * - The bootloader plus the SoftDevice
 *
 * From the technical side, a DFU update is a tuple of an init packet and
 * a binary blob. Typically, the init packet is a protocol buffer ("protobuf"
 * or "pbf" for short) indicating the kind of memory region to update,
 * the size to update, whether to reset the device, extra checksums, which
 * kind of nRF chip family this update is meant for, and maybe a crypto signature.
 *
 * Nordic provides a default pbf definition, and *usually* a DFU update will use
 * that. However, there are use cases for using custom pbf definitions (which
 * imply using a custom DFU bootloader). Thus, this code does NOT perform any
 * checks on the init packet (nor on the binary blob, for that matter).
 *
 * An instance of DfuUpdates might be shared by several operations using different
 * transports at the same time.
 *
 * The constructor expects an Array of Arrays of two `Uint8Arrays`. `updates` is an
 * Array of `update`s, and each `update` is an Array of two elements, each element
 * being an `Uint8Array`.
 *
 */

class DfuUpdates {
    constructor(updates) {
        this._updates = updates || [];
        // FIXME: Perform extra sanity checks, check types of the "updates" array.
    }

    get updates() {
        return this._updates;
    }

    /**
     * Instantiates a set of DfuUpdates given the path of a .zip file.
     * That .zip file is expected to have been created by nrfutil, having
     * a valid manifest.
     *
     * @param String path The full file path to the .zip file
     * @return An instance of DfuUpdates
     */
    static fromZipFile(path) {
        // FIXME
    }

}

/**
 * Dummy DFU transport.
 * This will just consume bytes, sending them to /dev/null.
 * It will also handle a CRC32 accumulator, to report back the checksums to
 * the higher level logic.
 */



class DfuTransportSink {
    constructor(bytesPerSecond = Infinity, chunkSize = 0x1000) {
        this._bytesPerMilliSecond = bytesPerSecond * 1000;
        this._chunkSize = chunkSize;

        this._offsets = [0, 0];
        this._crcs = [0, 0];
        this._sizes = [0, 0];

        this._selected = undefined;
    }

    _createObject(type, size) {
        this._selectObject(type);
        this._sizes[type] = size;
        console.info(`Sink DFU transport: created object of type ${type}, size ${size}`);
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
                console.info(`Sink DFU transport: consumed ${bytes.length} bytes`);
                res([this._offsets[this._selected], this._crcs[this._selected]]);
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

export { DfuOperation, DfuAbstractTransport, DfuUpdates, DfuTransportSink, ProgressCounter };
