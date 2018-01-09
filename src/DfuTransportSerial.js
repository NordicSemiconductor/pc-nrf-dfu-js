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
    // This ensures that the serial port is open by calling this.open() - the first
    // call to writeCommand will actually open the port.
    writeCommand(bytes) {
        let encoded = slip.encode(bytes);

        // Strip the heading 0xC0 character, as to avoid a bug in the nRF SDK implementation
        // of the SLIP encoding/decoding protocol
        encoded = encoded.subarray(1);

        // Cast the Uint8Array info a Buffer so it works on nodejs v6
        encoded = new Buffer(encoded);

        return this.open().then(() =>
            new Promise(res => {
                debug(' send --> ', encoded);
                this.port.write(encoded, res);
            }),
        );
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

    // Opens the port, sets up the event handlers and logging.
    // Returns a Promise when opening is done.
    open() {
        if (this.openPromise) {
            return this.openPromise;
        }

        this.openPromise = new Promise(res => {
            debug('Opening serial port.');

            this.port.open(() => {
                debug('Initializing DFU protocol (PRN and MTU).');
                // Start listening for data, and pipe it all through a SLIP decoder.
                // This code will listen to events from the SLIP decoder instead
                // of from the serial port itself.
                this.slipDecoder = new slip.Decoder({
                    onMessage: this.onData.bind(this),
                });

                this.port.on('data', data => {
                    debug(' recv <-- ', data);
                    return this.slipDecoder.decode(data);
                });

                res();
            });
        });
        return this.openPromise;
    }

    // Initializes DFU procedure: after opening the port, sets the PRN and requests the MTU.
    // Returns a Promise when initialization is done.
    ready() {
        if (this.readyPromise) {
            return this.readyPromise;
        }


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

        this.readyPromise = this.writeCommand(new Uint8Array([
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

        return this.readyPromise;
    }

    // Returns a Promise to the version of the DFU protocol that the target implements, as
    // a single integer between 0 to 255.
    // Only bootloaders from 2018 (SDK >= v15) for development boards implement this command.
    getProtocolVersion() {
        debug('GetProtocolVersion');

        return this.writeCommand(new Uint8Array([
            0x00,  // "Version Command" opcode
        ]))
        .then(this.read.bind(this))
        .then(this.assertPacket(0x00, 1))
        .then(bytes => bytes[0]);
    }

    // Returns a Promise to the version of the DFU protocol that the target implements, as
    // an object with descriptive property names.
    // Only bootloaders from 2018 (SDK >= v15) for development boards implement this command.
    getHardwareVersion() {
        debug('GetHardwareVersionn');

        return this.writeCommand(new Uint8Array([
            0x0A,  // "Version Command" opcode
        ]))
        .then(this.read.bind(this))
        .then(this.assertPacket(0x0A, 16))
        .then(bytes => {
            const dataView = new DataView(bytes.buffer);
            return {
                part: dataView.getInt32(bytes.byteOffset + 0, true),
                variant: dataView.getInt32(bytes.byteOffset + 4, true),
                memory: {
                    romSize: dataView.getInt32(bytes.byteOffset + 8, true),
                    ramSize: dataView.getInt32(bytes.byteOffset + 12, true),
                },
            };
        });
    }

    // Given an image number (0-indexed), returns a Promise to a plain object describing
    // that firmware image, or undefined if there is no image at that index.
    // Only bootloaders from 2018 (SDK >= v15) for development boards implement this command.
    getFirmwareVersion(imageCount = 0) {
        debug('GetFirmwareVersion');

        return this.writeCommand(new Uint8Array([
            0x0B,  // "Version Command" opcode
            `0x${imageCount.toString(16)}`,
        ]))
        .then(this.read.bind(this))
        .then(this.assertPacket(0x0B, 13))
        .then(bytes => {
            const dataView = new DataView(bytes.buffer);
            let imgType = dataView.getUint8(bytes.byteOffset + 0, true);

            switch (imgType) {
                case 0xFF:
                    // Meaning "no image at this index"
                    return;
                case 0:
                    imgType = 'SoftDevice';
                    break;
                case 1:
                    imgType = 'Application';
                    break;
                case 2:
                    imgType = 'Bootloader';
                    break;
                default:
                    throw new Error('Unkown firmware image type');
            }

            return {
                version: dataView.getUint32(bytes.byteOffset + 1, true),
                addr: dataView.getUint32(bytes.byteOffset + 5, true),
                length: dataView.getUint32(bytes.byteOffset + 9, true),
                imageType: imgType,
            };
        });
    }

    // Returns an array containing information about all available firmware images, by
    // sending several GetFirmwareVersion commands.
    getAllFirmwareVersions(index = 0, accum = []) {
        return this.getFirmwareVersion(index)
        .then(imageInfo => {
            if (imageInfo) {
                accum.push(imageInfo);
                return this.getAllFirmwareVersions(index + 1, accum);
            }
            return accum;
        });
    }
}
