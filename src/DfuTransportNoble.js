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
import DfuTransportPrn from './DfuTransportPrn';
import { DfuError, ErrorCode } from './DfuError';

const debug = Debug('dfu:noble');

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
                            }
                            if (characteristics[i].uuid === '8ec90002f3154f609fb8838830daea50') {
                                this.dfuPacketCharacteristic = characteristics[i];
                            }
                        }
                        if (this.dfuControlCharacteristic && this.dfuPacketCharacteristic) {
                            return res();
                        }
                        return rej(new DfuError(ErrorCode.ERROR_CAN_NOT_DISCOVER_DFU_CONTROL));
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
                setTimeout(
                    () => rej(new DfuError(ErrorCode.ERROR_TIMEOUT_FETCHING_CHARACTERISTICS)),
                    500
                );
            }),
        ])
            .then(() => {
                // Subscribe to notifications on the control characteristic
                debug('control characteristic:', this.dfuControlCharacteristic.uuid, this.dfuControlCharacteristic.properties);

                return new Promise((res, rej) => {
                    debug('Subscribing to notifications on the ctrl characteristic');
                    this.dfuControlCharacteristic.subscribe(err => {
                        if (err) {
                            return rej(new DfuError(ErrorCode.ERROR_CAN_NOT_SUBSCRIBE_CHANGES));
                        }
                        this.dfuControlCharacteristic.on('data', data => {
                            debug(' recv <-- ', data);
                            return this.onData(data);
                        });
                        return res();
                    });
                });
            })
            .then(() =>
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
    }
}
