import DfuTransportPrn from './DfuTransportPrn';

const debug = require('debug')('dfu:noble');

// const noble = require('noble');

/**
 * noble DFU transport.
 *
 * 'noble' means "NOde Bluetooth Low Energy". The use case for this transport
 * is running it on a linux/MacOSX/windows host, which must have a BLE adapter itself.
 * See https://github.com/sandeepmistry/noble/blob/master/README.md
 *
 * The "noble" transport must be given an instance of noble's "peripheral" when instantiated.
 */

export default class DfuTransportNoble extends DfuTransportPrn {
    constructor(peripheral, packetReceiveNotification = 16) {
        super(packetReceiveNotification);

        this.peripheral = peripheral;

        // These will be populated when connecting to the BLE peripheral
        this.dfuControlCharacteristic = undefined;
        this.dfuPacketCharacteristic = undefined;

        // Hard-coded BLE MTU
        this.mtu = 23;
    }


    // Given a command (including opcode), perform SLIP encoding and send it
    // through the wire.
    writeCommand(bytes) {
        // Cast the Uint8Array info a Buffer so it works on nodejs v6
        const bytesBuf = Buffer.from(bytes);
        debug(' ctrl --> ', bytesBuf);

        return new Promise((res, rej) => {
            setTimeout(() => {
                //                 this.dfuControlCharacteristic.once('write', () => {
                //                     debug(' wire --> ', bytesBuf);
                //                     res();
                //                 })

                this.dfuControlCharacteristic.write(bytesBuf, false, err => {
                    if (err) {
                        rej(err);
                    } else {
                        res();
                    }
                });
            }, 100);
        });
    }

    // Given some payload bytes, pack them into a 0x08 command.
    // The length of the bytes is guaranteed to be under this.mtu thanks
    // to the DfuTransportPrn functionality.
    writeData(bytes) {
        // Cast the Uint8Array info a Buffer so it works on nodejs v6
        const bytesBuf = Buffer.from(bytes);
        debug(' data --> ', bytesBuf);

        return new Promise((res, rej) => {
            //             setTimeout(()=>{

            //                 this.dfuPacketCharacteristic.once('write', () => {
            //                     debug(' wire --> ', bytesBuf);
            //                     res();
            //                 })

            this.dfuPacketCharacteristic.write(bytesBuf, true, err => {
                if (err) {
                    rej(err);
                } else {
                    res();
                }
            });
            //             }, 50);
        });
    }

    //     read() {
    //         return new Promise((res, rej)=>{
    //             this.dfuControlCharacteristic.read((err, data)=>{
    //                 if (err) {
    //                     rej(err);
    //                 } else {
    //         debug(' recv <-- ', data);
    //                     res(this.parse(data));
    //                 }
    //             });
    //         });
    //     }

    // Called whenever the control characteristic sends some bytes back
    //     onData(bytes) {
    //         debug('Got data: ', bytes);
    //     }
    //
    // Aux. Connects to this.peripheral, discovers services and characteristics,
    // and stores a reference into this.dfuControlCharacteristic and this.dfuPacketCharacteristic
    getCharacteristics() {
        return new Promise((res, rej) => {
            this.peripheral.connect(err => {
                if (err) {
                    return rej(err);
                }

                debug('Instantiating noble transport to: ', this.peripheral);

                this.peripheral.discoverServices(['fe59'], (err1, [dfuService]) => {
                    if (err1) {
                        return rej(err1);
                    }
                    debug('discovered dfuService');

                    dfuService.discoverCharacteristics(null, (err2, characteristics) => {
                        if (err2) {
                            return rej(err2);
                        }
                        debug('discovered the following characteristics:');
                        for (let i = 0, l = characteristics.length; i < l; i += 1) {
                            debug(`  ${i} uuid: ${characteristics[i].uuid}`);

                            if (characteristics[i].uuid === '8ec90001f3154f609fb8838830daea50') {
                                this.dfuControlCharacteristic = characteristics[i];
                                //                                 debug(characteristics[i]);
                            }
                            if (characteristics[i].uuid === '8ec90002f3154f609fb8838830daea50') {
                                this.dfuPacketCharacteristic = characteristics[i];
                                //                                 debug(characteristics[i]);
                            }
                        }
                        if (this.dfuControlCharacteristic && this.dfuPacketCharacteristic) {
                            return res();
                        }
                        return rej(new DfuError(0x0051));
                    });
                    return undefined;
                });
                return undefined;
            });
        });
    }

    // Opens the port, sets the PRN, requests the MTU.
    // Returns a Promise when initialization is done.
    ready() {
        if (this.readyPromise) {
            return this.readyPromise;
        }

        this.readyPromise = Promise.race([
            this.getCharacteristics(),
            new Promise((res, rej) => {
                setTimeout(() => rej(new DfuError(0x0052)), 500);
            }),
        ])
            .then(() => {
            // Subscribe to notifications on the control characteristic
                debug('control characteristic:', this.dfuControlCharacteristic.uuid, this.dfuControlCharacteristic.properties);

                return new Promise((res, rej) => {
                    debug('Subscribing to notifications on the ctrl characteristic');
                    this.dfuControlCharacteristic.subscribe(err => {
                        if (err) {
                            return rej(new DfuError(0x0053));
                        }
                        // this.dfuControlCharacteristic.on('data', this.onData.bind(this));
                        this.dfuControlCharacteristic.on('data', data => {
                            debug(' recv <-- ', data);
                            return this.onData(data);
                        });
                        return res();
                    });
                });
            })
            .then(() =>
            // Set the PRN value
                this.writeCommand(new Uint8Array([
                    0x02, // "Set PRN" opcode
                    // eslint-disable-next-line no-bitwise
                    this.prn & 0xFF, // PRN LSB
                    // eslint-disable-next-line no-bitwise
                    (this.prn >> 8) & 0xFF, // PRN MSB
                ]))
                    .then(this.read.bind(this))
                    .then(this.assertPacket(0x02, 0)));

        return this.readyPromise;

        //                 // Set PRN
        //                 let result = this.writeCommand(new Uint8Array([
        //                     0x02,  // "Set PRN" opcode
        //                     this.prn >> 0 & 0xFF, // PRN LSB
        //                     this.prn >> 8 & 0xFF, // PRN MSB
        //                 ]))
        //                 .then(this.read.bind(this))
        //                 .then(this.assertPacket(0x02, 0))
        //                 // Request MTU
        //                 .then(()=>this.writeCommand(new Uint8Array([
        //                     0x07    // "Request serial MTU" opcode
        //                 ])))
        //                 .then(this.read.bind(this))
        //                 .then(this.assertPacket(0x07, 2))
        //                 .then((bytes)=>{
        // //                     debug('Got MTU: ', bytes);
        //
        //                     let mtu =
        //                         bytes[1] * 256 +
        //                         bytes[0];
        //
        //                     // Convert wire MTU into max size of SLIP-decoded data:
        //                     this.mtu = Math.floor((mtu / 2) - 2);
        // debug(`Wire MTU: ${mtu}; un-encoded data max size: ${this.mtu}`);
        //                 });

        //                 return res(result);
        //                 return res();
        //         });
    }
}
