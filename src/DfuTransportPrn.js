// FIXME: Should be `import {crc32} from 'crc'`, https://github.com/alexgorbatchev/node-crc/pull/50
import crc32 from './util/crc32';

import DfuAbstractTransport from './DfuAbstractTransport';
import { errorMessages, extendedErrorMessages } from './DfuErrorConstants';

const debug = require('debug')('dfu:prntransport');


/**
 * PRN-capable abstract DFU transport.
 *
 * This abstract class inherits from DfuAbstractTransport, and implements
 * PRN (Packet Receive Notification) and the splitting of a page of data
 * into smaller chunks.
 *
 * Both the Serial DFU and the BLE DFU protocols implement these common bits of
 * logic, but they do so in a lower level than the abstract 5-commands DFU protocol.
 */

export default class DfuTransportPrn extends DfuAbstractTransport {
    // The constructor takes the value for the PRN interval. It should be
    // provided by the concrete subclasses.
    constructor(packetReceiveNotification = 16) {
        super();

        if (this.constructor === DfuTransportPrn) {
            throw new Error('Cannot instantiate DfuTransportPrn, use a concrete subclass instead.');
        }

        if (packetReceiveNotification > 0xFFFF) { // Ensure it fits in 16 bits
            throw new Error('DFU procotol cannot use a PRN higher than 0xFFFF.');
        }

        this.prn = packetReceiveNotification;


        // Store *one* message waitig to be read()
        this.lastReceivedPacket = undefined;

        // Store *one* reference to a read() callback function
        this.waitingForPacket = undefined;

        // Maximum Transmission Unit. The maximum amount of bytes that can be sent to a
        // writeData() call. Its value **must** be filled in by the concrete subclasses
        // before any data is sent.
        this.mtu = undefined;
    }

    // The following are meant as abstract methods, meaning they do nothing and subclasses
    // must provide an implementation.

    /* eslint-disable class-methods-use-this, no-unused-vars */

    // Abstract method. Concrete subclasses shall implement sending the bytes
    // into the wire/air.
    // The bytes shall include an opcode and payload.
    writeCommand(bytes) {}

    // Abstract method. Concrete subclasses shall implement sending the bytes
    // into the wire/air.
    // The bytes are all data bytes. Subclasses are responsible for packing
    // this into a command (serial DFU) or sending them through the wire/air
    // through an alternate channel (BLE DFU)
    writeData(bytes) {}

    // Abstract method, called before any operation that would send bytes.
    // Concrete subclasses **must**:
    // - Check validity of the connection,
    // - Re-initialize connection if needed, including
    //   - Set up PRN
    //   - Request MTU (only if the transport has a variable MTU)
    // - Return a Promise whenever the connection is ready.
    ready() {}

    /* eslint-enable class-methods-use-this, no-unused-vars */


    // Requests a (decoded and) parsed packet/message, either a response
    // to a previous command or a PRN notification.
    // Returns a Promise to [opcode, Uint8Array].
    // Cannot have more than one pending request at any time.
    read() {
        if (this.waitingForPacket) {
            throw new Error('DFU transport tried to read() while another read() was still waiting');
        }

        if (this.lastReceivedPacket) {
            const packet = this.lastReceivedPacket;
            delete this.lastReceivedPacket;
            return Promise.resolve(packet);
        }

        // Store the callback so it can be called as soon as the wire packet is
        // ready. Add a 5sec timeout while we're at it.
        return Promise.race([
            new Promise(res => {
                this.waitingForPacket = res;
            }),
            new Promise((res, rej) => {
                setTimeout(() => {
                    if (this.waitingForPacket && this.waitingForPacket === res) {
                        delete this.waitingForPacket;
                    }
                    rej(new Error('Timeout while reading from transport. Is the nRF in bootloader mode?'));
                }, 5000);
            }),
        ]);
    }

    // Must be called when a (complete) packet/message is received, with the
    // (decoded) bytes of the entire packet/message. Either stores the packet
    // just received, or calls the pending read() callback to unlock it
    onData(bytes) {
        if (this.lastReceivedPacket) {
            throw new Error('DFU transport received two messages at once');
        }

        if (this.waitingForPacket) {
            const callback = this.waitingForPacket;
            delete this.waitingForPacket;
            return callback(this.parse(bytes));
        }

        this.lastReceivedPacket = this.parse(bytes);
        return undefined;
    }

    // Parses a received DFU response packet/message, does a couple of checks,
    // then returns an array of the form [opcode, payload] if the
    // operation was sucessful.
    // If there were any errors, returns a rejected Promise with an error message.
    parse(bytes) { // eslint-disable-line class-methods-use-this
        if (bytes[0] !== 0x60) {
            return Promise.reject(new Error('Response from DFU target did not start with 0x60'));
        }
        const opcode = bytes[1];
        const resultCode = bytes[2];
        if (resultCode === 0x01) {
            debug('Parsed DFU response packet: opcode ', opcode, ', payload: ', bytes.subarray(3));
            return Promise.resolve([opcode, bytes.subarray(3)]);
        }

        let errorStr;
        if (resultCode in errorMessages) {
            errorStr = `Received error from DFU target: ${errorMessages[resultCode]}`;
        } else if (resultCode === 0x0B) {
            const extendedErrorCode = bytes[3];
            if (extendedErrorCode in extendedErrorMessages) {
                errorStr = `Received extended error from DFU target: ${extendedErrorMessages[extendedErrorCode]}`;
            } else {
                errorStr = `Received unknown extended result code from DFU target: 0x0B 0x${extendedErrorCode.toString(16)}`;
            }
        } else {
            errorStr = `Received unknown result code from DFU target: 0x${resultCode.toString(16)}`;
        }

        debug(errorStr);
        return Promise.reject(errorStr);
    }


    // Returns a *function* that checks a [opcode, bytes] parameter against the given
    // opcode and byte length, and returns only the bytes.
    // If the opcode is different, or the payload length is different, an error is thrown.
    assertPacket(expectedOpcode, expectedLength) { // eslint-disable-line class-methods-use-this
        return response => {
            if (!response) {
                debug('Tried to assert an empty parsed response!');
                debug('response: ', response);
                throw new Error('Tried to assert an empty parsed response!');
            }
            const [opcode, bytes] = response;

            if (opcode !== expectedOpcode) {
                throw new Error(`Expected a response with opcode ${expectedOpcode}, got ${opcode} instead.`);
            }

            if (bytes.length !== expectedLength) {
                throw new Error(`Expected ${expectedLength} bytes in response to opcode ${expectedOpcode}, got ${bytes.length} bytes instead.`);
            }

            return bytes;
        };
    }


    createObject(type, size) {
        debug(`CreateObject type ${type}, size ${size}`);

        return this.ready().then(() =>
            this.writeCommand(new Uint8Array([
                0x01, // "Create object" opcode
                type,
                size & 0xFF, // eslint-disable-line no-bitwise
                (size >> 8) & 0xFF, // eslint-disable-line no-bitwise
                (size >> 16) & 0xFF, // eslint-disable-line no-bitwise
                (size >> 24) & 0xFF, // eslint-disable-line no-bitwise
            ]))
                .then(this.read.bind(this))
                .then(this.assertPacket(0x01, 0)));
    }

    writeObject(bytes, crcSoFar, offsetSoFar) {
        debug('WriteObject');
        return this.ready().then(() =>
            this.writeObjectPiece(bytes, crcSoFar, offsetSoFar, 0));
    }

    // Sends *one* write operation (with up to this.mtu bytes of un-encoded data)
    // Triggers a counter-based PRN confirmation
    writeObjectPiece(bytes, crcSoFar, offsetSoFar, prnCount) {
        return this.ready().then(() => {
            const sendLength = Math.min(this.mtu, bytes.length);
            //             const sendLength = 1; // DEBUG

            const bytesToSend = bytes.subarray(0, sendLength);
            //             const packet = new Uint8Array(sendLength + 1);
            //             packet.set([0x08], 0);    // "Write" opcode
            //             packet.set(bytesToSend, 1);

            const newOffsetSoFar = offsetSoFar + sendLength;
            const newCrcSoFar = crc32(bytesToSend, crcSoFar);
            let newPrnCount = prnCount + 1;

            return this.writeData(bytesToSend)
                .then(() => {
                    if (this.prn > 0 && newPrnCount >= this.prn) {
                        debug('PRN hit, expecting CRC');
                        // Expect a CRC due to PRN
                        newPrnCount = 0;
                        return this.readCrc().then(([offset, crc]) => {
                            if (newOffsetSoFar === offset && newCrcSoFar === crc) {
                                debug(`PRN checksum OK at offset ${offset} (0x${offset.toString(16)}) (0x${crc.toString(16)})`);
                                return undefined;
                            }
                            return Promise.reject(new Error(`CRC mismatch during PRN at byte ${offset}/${newOffsetSoFar}, expected 0x${newCrcSoFar.toString(16)} but got 0x${crc.toString(16)} instead`));
                        });
                    }
                    return undefined;
                })
                .then(() => {
                    if (sendLength < bytes.length) {
                    // Send more stuff
                        return this.writeObjectPiece(
                            bytes.subarray(sendLength),
                            newCrcSoFar, newOffsetSoFar, newPrnCount
                        );
                    }
                    return [newOffsetSoFar, newCrcSoFar];
                });
        });
    }

    // Reads a PRN CRC response and returns the offset/CRC pair
    readCrc() {
        return this.ready().then(() =>
            this.read()
                .then(this.assertPacket(0x03, 8))
                .then(bytes => {
                // Decode little-endian fields, by using a DataView with the
                // same buffer *and* offset than the Uint8Array for the packet payload
                    const bytesView = new DataView(bytes.buffer, bytes.byteOffset);
                    const offset = bytesView.getUint32(0, true);
                    const crc = bytesView.getUint32(4, true);

                    // // DEBUG: Once in every 11 CRC responses, apply a XOR to the CRC
                    // // to make it look like something has failed.

                    // if ((this._crcFailCounter = (this._crcFailCounter || 0) + 1) >= 11) {
                    //  // if (Math.random() < 0.05) {
                    //     debug('DEBUG: mangling CRC response to make it look like a failure');
                    //     this._crcFailCounter = 0;
                    //     return [offset, Math.abs(crc - 0x1111)];
                    // }

                    return [offset, crc];
                }));
    }

    crcObject() {
        debug('Request CRC explicitly');

        return this.ready().then(() =>
            this.writeCommand(new Uint8Array([
                0x03, // "CRC" opcode
            ]))
                .then(this.readCrc.bind(this)));
    }

    executeObject() {
        debug('Execute (mark payload chunk as ready)');
        return this.ready().then(() =>
            this.writeCommand(new Uint8Array([
                0x04, // "Execute" opcode
            ]))
                .then(this.read.bind(this))
                .then(this.assertPacket(0x04, 0)));
    }

    selectObject(type) {
        debug('Select (report max size and current offset/crc)');

        return this.ready().then(() =>
            this.writeCommand(new Uint8Array([
                0x06, // "Select object" opcode
                type,
            ]))
                .then(this.read.bind(this))
                .then(this.assertPacket(0x06, 12))
                .then(bytes => {
                // Decode little-endian fields
                    const bytesView = new DataView(bytes.buffer);
                    const chunkSize = bytesView.getUint32(bytes.byteOffset + 0, true);
                    const offset = bytesView.getUint32(bytes.byteOffset + 4, true);
                    const crc = bytesView.getUint32(bytes.byteOffset + 8, true);
                    debug(`selected ${type}: offset ${offset}, crc ${crc}, max size ${chunkSize}`);
                    return [offset, crc, chunkSize];
                }));
    }
}
