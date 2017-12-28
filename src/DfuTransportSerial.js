
import DfuTransportPrn from './DfuTransportPrn';

// FIXME: Should be `import {crc32} from 'crc'`, https://github.com/alexgorbatchev/node-crc/pull/50
// import * as crc from 'crc';
// const crc32 = crc.crc32;
// import {crc32} from 'crc';
// import crc32 from 'crc/src/crc32';


import * as slip from 'slip';

/**
 * Serial DFU transport.
 * This needs to be given a `serialport` instance when instantiating.
 * Will encode actual requests with SLIP
 */

export default class DfuTransportSerial extends DfuTransportPrn {
    constructor(serialPort, packetReceiveNotification = 16) {
        super(packetReceiveNotification);

        this._port = serialPort;
    }


    // Given a command (including opcode), perform SLIP encoding and send it
    // through the wire.
    _writeCommand(bytes) {
        let encoded = slip.encode(bytes);

        // Strip the heading 0xC0 character, as to avoid a bug in the nRF SDK implementation
        // of the SLIP encoding/decoding protocol
        encoded = encoded.subarray(1);

        // Cast the Uint8Array info a Buffer so it works on nodejs v6
        encoded = new Buffer(encoded);

        return new Promise((res, rej)=>{
            console.log(' send --> ', encoded);
            this._port.write(encoded, res);
        });
    }

    // Given some payload bytes, pack them into a 0x08 command.
    // The length of the bytes is guaranteed to be under this._mtu thanks
    // to the DfuTransportPrn functionality.
    _writeData(bytes) {
        const commandBytes = new Uint8Array(bytes.length + 1);
        commandBytes.set([0x08], 0); // "Write" opcode
        commandBytes.set(bytes, 1);
        return this._writeCommand(commandBytes);
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
//                 this._port.on('data', (data)=>this._slipDecoder.decode(data));

                this._port.on('data', (data)=>{
console.log(' recv <-- ', data);
//                     return this._slipDecoder.decode.bind(this._slipDecoder)(data);
                    return this._slipDecoder.decode(data);
                });

//                 this._port.on('data', this._slipDecoder.decode.bind(this._slipDecoder));


                // Ping
//                 let result = this._write(new Uint8Array([
//                     0x09,   // "Ping" opcode
//                     0xAB    // Ping ID
//                 ]))
//                 .then(this._read.bind(this))
//                 .then(this._assertPacket(0x09, 1))
//                 .then((bytes)=>{
//                     if (bytes[0] !== 0xAB) {
//                         throw new Error('Expected a ping ID of 0xAB, got ' + bytes + ' instead');
//                     }
//                 })

                // Set PRN
                let result = this._writeCommand(new Uint8Array([
                    0x02,  // "Set PRN" opcode
                    this._prn >> 0 & 0xFF, // PRN LSB
                    this._prn >> 8 & 0xFF, // PRN MSB
                ]))
                .then(this._read.bind(this))
                .then(this._assertPacket(0x02, 0))
                // Request MTU
                .then(()=>this._writeCommand(new Uint8Array([
                    0x07    // "Request serial MTU" opcode
                ])))
                .then(this._read.bind(this))
                .then(this._assertPacket(0x07, 2))
                .then((bytes)=>{
//                     console.log('Got MTU: ', bytes);

                    let mtu =
                        bytes[1] * 256 +
                        bytes[0];

                    // Convert wire MTU into max size of data before SLIP encoding:
                    // This takes into account:
                    // - SLIP encoding ( /2 )
                    // - SLIP end separator ( -1 )
                    // - Serial DFU write command ( -1 )
                    this._mtu = Math.floor((mtu / 2) - 2);

                    // Round down to multiples of 4.
                    // This is done to avoid errors while writing to flash memory:
                    // writing an unaligned number of bytes will result in an
                    // error in most chips.
                    this._mtu -= this._mtu % 4;

// DEBUG: Force a specific MTU.
// this._mtu = Math.min(this._mtu, 133);

console.log(`Wire MTU: ${mtu}; un-encoded data max size: ${this._mtu}`);
                });

                return res(result);
            });
        });
    }

    getProtocolVersion() {
        if (this._readyPromise) {
            return this._readyPromise;
        }
        return this._readyPromise = new Promise(res => {
            this._port.open(() => {
                this._slipDecoder = new slip.Decoder({
                    onMessage: this._onData.bind(this)
                });

                this._port.on('data', (data)=>{
                    return this._slipDecoder.decode(data);
                });

                const result = this._writeCommand(new Uint8Array([
                    0x00,  // "Version Command" opcode
                ]))
                .then(this._read.bind(this))
                .then(this._assertPacket(0x00, 1))
                .then(protocolVersion => {
                    return protocolVersion[0];
                })
                .catch(err => {
                    console.log(err);
                });

                return res(result);
            });
        });
    }

    getHardwareVersion() {
        if (this._readyPromise) {
            return this._readyPromise;
        }
        return this._readyPromise = new Promise(res => {
            this._port.open(() => {
                this._slipDecoder = new slip.Decoder({
                    onMessage: this._onData.bind(this)
                });

                this._port.on('data', (data)=>{
                    console.log('on event');
                    return this._slipDecoder.decode(data);
                });

                const result = this._writeCommand(new Uint8Array([
                    0x0A,  // "Version Command" opcode
                ]))
                .then(this._read.bind(this))
                .then(this._assertPacket(0x0A, 16))
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
                .catch(err => {
                    console.log(err);
                });

                return res(result);
            });
        });
    }
    
    getFirmwareVersionPromise(imageCount, firmwareVersion) {
        if (!imageCount) {
            imageCount = 0;
        }
        if (!firmwareVersion) {
            firmwareVersion = {};
        }
        return this._writeCommand(new Uint8Array([
                0x0B,  // "Version Command" opcode
                '0x' + imageCount.toString(16),
            ]))
            .then(this._read.bind(this))
            .then(this._assertPacket(0x0B, 13))
            .then(data => {
                const dataView = new DataView(data.buffer);
                const imgType = dataView.getUint8(3);
                if (imgType !== parseInt('0xFF')) {
                    let firmware = {};
                    firmware.version = dataView.getUint32(4);
                    firmware.addr = dataView.getUint32(8);
                    firmware.len = dataView.getUint32(12);
                    switch (imgType) {
                        case 0:
                            firmwareVersion.softdevice = firmware;
                            break;
                        case 1:
                            firmwareVersion.application.push(firmware);
                            break;
                        case 2:
                            firmwareVersion.bootloader = firmware;
                            break;
                        default:
                            throw new Error('Unkown firmware image type');
                    }
                    ++imageCount;
                    return this.getFirmwareVersionPromise(imageCount, firmwareVersion);
                }
                else {
                    return firmwareVersion;
                }
            })
            .catch(err => {
                console.log(err);
            });
    }

    getFirmwareVersion() {
        if (this._readyPromise) {
            return this._readyPromise;
        }
        return this._readyPromise = new Promise(res => {
            this._port.open(() => {
                const promises = [];

                this._slipDecoder = new slip.Decoder({
                    onMessage: this._onData.bind(this)
                });

                this._port.on('data', (data)=>{
                    const resultData = this._slipDecoder.decode(data);

                    return resultData; 
                });


                const result = this.getFirmwareVersionPromise()
                    .then(firmwareVersion => {
                        return firmwareVersion;
                    })
                return res(result);
            });
        });
    }
}




