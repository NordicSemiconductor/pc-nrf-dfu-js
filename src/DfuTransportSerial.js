import * as slip from 'slip';

import DfuTransportPrn from './DfuTransportPrn';

const debug = require('debug')('dfu:serial');


/**
 * Serial DFU transport.
 * This needs to be given a `serialport` instance when instantiating.
 * Will encode actual requests with SLIP
 */

export default class DfuTransportSerial extends DfuTransportPrn {
    constructor(serialPort, packetReceiveNotification = 16) {
        super(packetReceiveNotification);

        this.port = serialPort;
    }


    // Given a command (including opcode), perform SLIP encoding and send it
    // through the wire.
    writeCommand(bytes) {
        let encoded = slip.encode(bytes);

        // Strip the heading 0xC0 character, as to avoid a bug in the nRF SDK implementation
        // of the SLIP encoding/decoding protocol
        encoded = encoded.subarray(1);

        // Cast the Uint8Array info a Buffer so it works on nodejs v6
        encoded = new Buffer(encoded);

        return new Promise(res => {
            debug(' send --> ', encoded);
            this.port.write(encoded, res);
        });
    }

    // Given some payload bytes, pack them into a 0x08 command.
    // The length of the bytes is guaranteed to be under this.mtu thanks
    // to the DfuTransportPrn functionality.
    writeData(bytes) {
        const commandBytes = new Uint8Array(bytes.length + 1);
        commandBytes.set([0x08], 0); // "Write" opcode
        commandBytes.set(bytes, 1);
        return this.writeCommand(commandBytes);
    }

    // Opens the port, sets the PRN, requests the MTU.
    // Returns a Promise when initialization is done.
    ready() {
        if (this.readyPromise) {
            return this.readyPromise;
        }

        this.readyPromise = new Promise(res => {
            debug('Opening serial port.');

            this.port.open(() => {
                debug('Initializing DFU protocol (PRN and MTU).');
                // Start listening for data, and pipe it all through a SLIP decoder.
                // This code will listen to events from the SLIP decoder instead
                // of from the serial port itself.
                this.slipDecoder = new slip.Decoder({
                    onMessage: this.onData.bind(this),
                });
//                 this.port.on('data', (data)=>this.slipDecoder.decode(data));

                this.port.on('data', data => {
                    debug(' recv <-- ', data);
//                     return this.slipDecoder.decode.bind(this.slipDecoder)(data);
                    return this.slipDecoder.decode(data);
                });

//                 this.port.on('data', this.slipDecoder.decode.bind(this.slipDecoder));


                // Ping
//                 let result = this._write(new Uint8Array([
//                     0x09,   // "Ping" opcode
//                     0xAB    // Ping ID
//                 ]))
//                 .then(this.read.bind(this))
//                 .then(this.assertPacket(0x09, 1))
//                 .then((bytes)=>{
//                     if (bytes[0] !== 0xAB) {
//                         throw new Error('Expected a ping ID of 0xAB, got ' + bytes + ' instead');
//                     }
//                 })

                // Set PRN
                const result = this.writeCommand(new Uint8Array([
                    0x02,  // "Set PRN" opcode
                    // eslint-disable-next-line no-bitwise
                    this.prn & 0xFF, // PRN LSB
                    // eslint-disable-next-line no-bitwise
                    (this.prn >> 8) & 0xFF, // PRN MSB
                ]))
                .then(this.read.bind(this))
                .then(this.assertPacket(0x02, 0))
                // Request MTU
                .then(() => this.writeCommand(new Uint8Array([
                    0x07,    // "Request serial MTU" opcode
                ])))
                .then(this.read.bind(this))
                .then(this.assertPacket(0x07, 2))
                .then(bytes => {
                    const mtu = (bytes[1] * 256) + bytes[0];

                    // Convert wire MTU into max size of data before SLIP encoding:
                    // This takes into account:
                    // - SLIP encoding ( /2 )
                    // - SLIP end separator ( -1 )
                    // - Serial DFU write command ( -1 )
                    this.mtu = Math.floor((mtu / 2) - 2);

                    // Round down to multiples of 4.
                    // This is done to avoid errors while writing to flash memory:
                    // writing an unaligned number of bytes will result in an
                    // error in most chips.
                    this.mtu -= this.mtu % 4;

                    // DEBUG: Force a specific MTU.
                    this.mtu = Math.min(this.mtu, 20);

                    debug(`Serial wire MTU: ${mtu}; un-encoded data max size: ${this.mtu}`);
                });

                return res(result);
            });
        });
        return this.readyPromise;
    }

    getProtocolVersion() {
        if (this.readyPromise) {
            return this.readyPromise;
        }
        this.readyPromise = new Promise(res => {
            this.port.open(() => {
                this.slipDecoder = new slip.Decoder({
                    onMessage: this.onData.bind(this),
                });

                this.port.on('data', data => this.slipDecoder.decode(data));

                const result = this.writeCommand(new Uint8Array([
                    0x00,  // "Version Command" opcode
                ]))
                .then(this.read.bind(this))
                .then(this.assertPacket(0x00, 1))
                .then(protocolVersion => protocolVersion[0])
                .catch(debug);

                return res(result);
            });
        });
        return this.readyPromise;
    }

    getHardwareVersion() {
        if (this.readyPromise) {
            return this.readyPromise;
        }
        this.readyPromise = new Promise(res => {
            this.port.open(() => {
                this.slipDecoder = new slip.Decoder({
                    onMessage: this.onData.bind(this),
                });

                this.port.on('data', data => {
                    debug('on event');
                    return this.slipDecoder.decode(data);
                });

                const result = this.writeCommand(new Uint8Array([
                    0x0A,  // "Version Command" opcode
                ]))
                .then(this.read.bind(this))
                .then(this.assertPacket(0x0A, 16))
                .then(hardwareVersion => {
                    const dataView = new DataView(hardwareVersion.buffer);
                    return {
                        part: dataView.getInt32(0),
                        variant: dataView.getInt32(4),
                        memory: {
                            romSize: dataView.getInt32(8),
                            ramSize: dataView.getInt32(12),
                        },
                    };
                })
                .catch(debug);

                return res(result);
            });
        });
        return this.readyPromise;
    }

    getFirmwareVersionPromise(imageCount = 0, firmwareVersion = {}) {
        return this.writeCommand(new Uint8Array([
            0x0B,  // "Version Command" opcode
            `0x${imageCount.toString(16)}`,
        ]))
        .then(this.read.bind(this))
        .then(this.assertPacket(0x0B, 13))
        .then(data => {
            const dataView = new DataView(data.buffer);
            const imgType = dataView.getUint8(3);
            if (imgType !== 0xFF) {
                const firmware = {};
                firmware.version = dataView.getUint32(4);
                firmware.addr = dataView.getUint32(8);
                firmware.len = dataView.getUint32(12);
                const fwVer = Object.assign(firmwareVersion);
                switch (imgType) {
                    case 0:
                        fwVer.softdevice = firmware;
                        break;
                    case 1:
                        fwVer.application.push(firmware);
                        break;
                    case 2:
                        fwVer.bootloader = firmware;
                        break;
                    default:
                        throw new Error('Unkown firmware image type');
                }
                return this.getFirmwareVersionPromise(imageCount + 1, fwVer);
            }
            return firmwareVersion;
        })
        .catch(debug);
    }

    getFirmwareVersion() {
        if (this.readyPromise) {
            return this.readyPromise;
        }
        this.readyPromise = new Promise(res => {
            this.port.open(() => {
                this.slipDecoder = new slip.Decoder({
                    onMessage: this.onData.bind(this),
                });

                this.port.on('data', data => {
                    const resultData = this.slipDecoder.decode(data);

                    return resultData;
                });


                const result = this.getFirmwareVersionPromise()
                    .then(firmwareVersion => firmwareVersion);
                return res(result);
            });
        });

        return this.readyPromise;
    }
}
