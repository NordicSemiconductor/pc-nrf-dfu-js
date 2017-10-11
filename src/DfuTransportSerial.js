
import DfuAbstractTransport from './DfuAbstractTransport';

// FIXME: Should be `import {crc32} from 'crc'`, https://github.com/alexgorbatchev/node-crc/pull/50
// import * as crc from 'crc';
// const crc32 = crc.crc32;
// import {crc32} from 'crc';
import crc32 from 'crc/src/crc32';


import * as slip from 'slip';

/**
 * Serial DFU transport.
 * This needs to be given a `serialport` instance when instantiating.
 * Will encode actual requests with SLIP
 */

export default class DfuTransportSerial extends DfuAbstractTransport {
    constructor(serialPort, packetReceiveNotification = 16) {
        super();

        if (packetReceiveNotification > 0xFFFF) { // Ensure it fits in 16 bits
            throw new Error('Serial DFU procotol cannot use a PRN higher than 0xFFFF.');
        }

        this._port = serialPort;
        this._prn = packetReceiveNotification;


        // Store *one* SLIP message
        this._lastReceivedPacket;

        // Store *one* reference to a callback function
        this._waitingForPacket;


        // Temporary value for the MTU. Will be reset during init.
        this._mtu = 16;
    }

    // Encodes a Uint8Array with SLIP, writes it to the serialport, returns a Promise.
    // Expects the port to be already open.
    _write(bytes) {
        let encoded = slip.encode(bytes);

        // Strip the heading 0xC0 character, as to avoid a bug in the nRF SDK implementation
        // of the SLIP encoding/decoding protocol
        encoded = encoded.subarray(1);

        // Cast the Uint8Array info a Buffer so it works on nodejs v6
        encoded = new Buffer(encoded);

        return new Promise((res, rej)=>{
//             console.log('Sending packet: ', bytes, ' encoded as ', encoded);
            console.log('Sending packet encoded as ', encoded);
            this._port.write(encoded, res);
        });
    }

    // Requests a decoded and parsed SLIP packet/message.
    // Returns a Promise to [opcode, Uint8Array].
    // Cannot have more than one pending request at any time.
    _read() {
        if (this._waitingForPacket) {
            throw new Error('SLIP transport tried to _read() while another _read() was still waiting');
        }

        if (this._lastReceivedPacket) {
            let packet = this._lastReceivedPacket;
            delete this._lastReceivedPacket;
            return Promise.resolve(packet);
        }

        /// Store the callback so it can be called as soon as a SLIP packet is
        /// decoded. Add a 5sec timeout while we're at it.
        return Promise.race([
            new Promise((res)=>{
                this._waitingForPacket = res;
            }),
            new Promise((res, rej)=>{
                setTimeout(()=>rej('Timeout while reading from serial port. Is the nRF in bootloader mode?'), 5000);
            })
        ]);
    }

    // Called when decoded data is received. Either stores the packet
    // just received, or calls the pending _read() callback to unlock it
    _onData(bytes) {
        if (this._lastReceivedPacket) {
            throw new Error('SLIP transport received two messages at once');
        }

        if (this._waitingForPacket) {
            let callback = this._waitingForPacket;
            delete this._waitingForPacket;
            return callback(this._parse(bytes));
        }

        this._lastReceivedPacket = this._parse(bytes);
    }

    // Opens the port, sets the PRN, requests the MTU.
    // Returns a Promise when initialization is done.
    _ready() {
        if (this._readyPromise) {
            return this._readyPromise;
        }

        return this._readyPromise = new Promise((res)=>{
            this._port.open(()=>{

                // Start listening for data, and pipe it all through a SLIP decoder.
                // This code will listen to events from the SLIP decoder instead
                // of from the serial port itself.
                this._slipDecoder = new slip.Decoder({
                    onMessage: this._onData.bind(this)
                });
            //         this._port.on('data', (data)=>this._slipDecoder.decode(data));
                this._port.on('data', (data)=>{
// console.log('Received raw data: ', data);
                    return this._slipDecoder.decode(data);
                });


                // Ping
                let result = this._write(new Uint8Array([
                    0x09,   // "Ping" opcode
                    0xAB    // Ping ID
                ]))
                .then(this._read.bind(this))
                .then(this._assertPacket(0x09, 1))
                .then((bytes)=>{
                    if (bytes[0] !== 0xAB) {
                        throw new Error('Expected a ping ID of 0xAB, got ' + bytes + ' instead');
                    }
                })
                // Set PRN
                .then(()=>this._write(new Uint8Array([
                    0x02,  // "Set PRN" opcode
                    this._prn >> 0 & 0xFF, // PRN LSB
                    this._prn >> 8 & 0xFF, // PRN MSB
                ])))
                .then(this._read.bind(this))
                .then(this._assertPacket(0x02, 0))
                // Request MTU
                .then(()=>this._write(new Uint8Array([
                    0x07    // "Request serial MTU" opcode
                ])))
                .then(this._read.bind(this))
                .then(this._assertPacket(0x07, 2))
                .then((bytes)=>{
//                     console.log('Got MTU: ', bytes);

                    let mtu =
                        bytes[1] * 256 +
                        bytes[0];

                    // Convert wire MTU into max size of SLIP-decoded data:
                    this._mtu = Math.floor((mtu / 2) - 2);
console.log(`Wire MTU: ${mtu}; un-encoded data max size: ${this._mtu}`);
                });

                return res(result);
            });
        });
    }

    // Parses a received SLIP packet/message, does a couple of checks,
    // then returns an array of the form [opcode, payload] if the
    // operation was sucessful.
    _parse(bytes) {
console.log('Received SLIP packet: ', bytes);
        if (bytes[0] !== 0x60) {
            return Promise.reject('SLIP response from devkit did not start with 0x60');
        }
        const opcode = bytes[1];
        const resultCode = bytes[2];
        if (resultCode === 0x01) {
console.log('Parsed SLIP packet: ', [opcode, bytes.subarray(3)]);
            return Promise.resolve([opcode, bytes.subarray(3)]);
        } else if (resultCode === 0x00) {
            return Promise.reject('Received SLIP error: Missing or malformed opcode');
        } else if (resultCode === 0x02) {
            return this._read();
//             return Promise.reject('Received SLIP error: Invalid opcode');
            return Promise.reject('Received SLIP error: Invalid opcode');
        } else if (resultCode === 0x03) {
            return Promise.reject('Received SLIP error: A parameter for the opcode was missing');
        } else if (resultCode === 0x04) {
            return Promise.reject('Received SLIP error: Not enough memory for the data object');
        } else if (resultCode === 0x05) {
            return Promise.reject('Received SLIP error: The data object didn\'t match firmware/hardware, or missing crypto signature, or command parse failed');
        } else if (resultCode === 0x07) {
            return Promise.reject('Received SLIP error: Unsupported object type for create/read operation');
        } else if (resultCode === 0x08) {
            return Promise.reject('Received SLIP error: Cannot allow this operation in the current DFU state');
        } else if (resultCode === 0x0A) {
            return Promise.reject('Received SLIP error: Operation failed');
        } else {
            return Promise.reject('Received unknown result code from SLIP: ' + resultCode);
        }
    }


    // Returns a *function* that checks a [opcode, bytes] parameter against the given
    // opcode and byte length, and returns only the bytes.
    _assertPacket(expectedOpcode, expectedLength) {
        return ([opcode, bytes])=>{
            if (opcode !== expectedOpcode) {
                return Promise.reject(`Expected a response with opcode ${expectedOpcode}, got ${opcode} instead.`);
            }

            if (bytes.length !== expectedLength) {
                return Promise.reject(`Expected ${expectedLength} in response to opcode ${expectedOpcode}, got ${bytes.length}.`);
            }

            return bytes;
        };
    }


    _createObject(type, size) {
console.log(`CreateObject type ${type}, size ${size}`);

        return this._ready().then(()=>{
            return this._write(new Uint8Array([
                0x01,   // "Create object" opcode
                type,
                size >> 0  & 0xFF,
                size >> 8  & 0xFF,
                size >> 16 & 0xFF,
                size >> 24 & 0xFF
            ]))
            .then(this._read.bind(this))
            .then(this._assertPacket(0x01, 0));

//             console.log('Should send select message');
        });
    }

    _writeObject(bytes, crcSoFar, offsetSoFar) {
console.log('WriteObject');
        return this._ready().then(()=>{
            return this._writeObjectPiece(bytes, crcSoFar, offsetSoFar, 0);
        })
// //         .catch((err)=>{
// //             console.warn('Caught: ', err, '; retrying chunk');
// //
// //             /// Handle failed PRN CRC checks by retrying up to 5 times
// //             if (retriesLeft > 0) {
// //                 return this._writeObject(bytes, crcSoFar, retriesLeft - 1);
// //             } else {
// //                 return Promise.reject('Too many transport failures while sending data');
// //             }
// //         });
    }

    // Sends *one* write operation (with up to this._mtu bytes of un-encoded data)
    // Triggers a counter-based PRN confirmation
    _writeObjectPiece(bytes, crcSoFar, offsetSoFar, prnCount) {
        return this._ready().then(()=>{

            const sendLength = Math.min(this._mtu - 1, bytes.length);

            const bytesToSend = bytes.subarray(0, sendLength);
            const packet = new Uint8Array(sendLength + 1);
            packet.set([0x08], 0);    // "Write" opcode
            packet.set(bytesToSend, 1);

            offsetSoFar += sendLength;
            crcSoFar = crc32(bytesToSend, crcSoFar);
            prnCount += 1;

            return this._write(packet)
            .then(()=>{
                if (prnCount >= this._prn) {
console.log('PRN hit, expecting CRC');
                    // Expect a CRC due to PRN
                    prnCount = 0;
                    return this._readCrc().then(([offset, crc])=>{
                        if (offsetSoFar === offset && crcSoFar === crc) {
                            return;
                        } else {
                            return Promise.reject(`CRC mismatch during PRN at byte ${offset}/${offsetSoFar}, expected 0x${crcSoFar.toString(16)} but got 0x${crc.toString(16)} instead`);
//                             console.warn(`CRC mismatch during PRN at byte ${offset}/${offsetSoFar}, expected 0x${crcSoFar.toString(16)} but got 0x${crc.toString(16)} instead`);
                        }
                    });
                } else {
                    // Expect no explicit response
                    return;
                }
            })
            .then(()=>{
                if (sendLength < bytes.length) {
                    // Send more stuff
                    return this._writeObjectPiece(bytes.subarray(sendLength), crcSoFar, offsetSoFar, prnCount);
                } else {
                    return [offsetSoFar, crcSoFar];
                }
            })
        });
    }

    // Reads a PRN CRC response and returns the offset/CRC pair
    _readCrc() {
        return this._ready().then(()=>{
            return this._read()
            .then(this._assertPacket(0x03, 8))
            .then((bytes)=>{
                // Decode little-endian fields
                const bytesView = new DataView( bytes.buffer );
                const offset    = bytesView.getUint32(bytes.byteOffset + 0, true);
                const crc       = bytesView.getUint32(bytes.byteOffset + 4, true);
console.log(`read checksum: `, bytes, [offset, crc])

                return [offset, crc];
            });
        });
    }

    _crcObject() {
console.log('Request CRC');

        return this._ready().then(()=>{
            return this._write(new Uint8Array([
                0x03   // "CRC" opcode
            ]))
            .then(this._readCrc.bind(this));
        });
    }

    _executeObject() {
console.log('Execute (mark payload chunk as ready)')
        return this._ready().then(()=>{
            return this._write(new Uint8Array([
                0x04   // "Execute" opcode
            ]))
            .then(this._read.bind(this))
            .then(this._assertPacket(0x04, 0));
        });
    }

    _selectObject(type) {
        return this._ready().then(()=>{
            return this._write(new Uint8Array([
                0x06,   // "Select object" opcode
                type
            ]))
            .then(this._read.bind(this))
            .then(this._assertPacket(0x06, 12))
            .then((bytes)=>{

                // Decode little-endian fields
                const bytesView = new DataView( bytes.buffer );
                const chunkSize = bytesView.getUint32(bytes.byteOffset + 0, true);
                const offset    = bytesView.getUint32(bytes.byteOffset + 4, true);
                const crc       = bytesView.getUint32(bytes.byteOffset + 8, true);
console.log(`select ${type}: `, bytes, [offset, crc, chunkSize])
                return [offset, crc, chunkSize];
            });

//             console.log('Should send select message');
        });
    }
}




