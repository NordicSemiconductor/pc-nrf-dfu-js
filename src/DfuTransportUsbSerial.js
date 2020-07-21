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
import DfuTransportSerial from './DfuTransportSerial';
import { DfuError, ErrorCode } from './DfuError';

const debug = Debug('dfu:usbserial');
const SerialPort = require('serialport');


/**
 * USB serial DFU transport. Supports Nordic USB devices.
 *
 * Compared to DfuTransportSerial, this transport expects that the target
 * device disconnects/closes the serial port after a firmware image has
 * been sent. It is also instantiated with a serial number instead of a
 * serialport instance.
 */
export default class DfuTransportUsbSerial extends DfuTransportSerial {
    // Creates the transport. A serialNumber (string) is required,
    // and packetReceiptNotification may also be provided (defaults
    // to 16).
    constructor(serialNumber, packetReceiveNotification = 16) {
        super(null, packetReceiveNotification);

        this.serialNumber = serialNumber;
    }

    // Given a Uint8Array, sends it as the main payload / "data object".
    // Returns a Promise that resolves when payload has been transferred
    // and target has disconnected.
    sendFirmwareImage(bytes) {
        return super.sendFirmwareImage(bytes)
            .then(() => this.waitForDisconnect());
    }

    // Looks for a serial port that matches the serial number provided to
    // this transport. Will try to poll for the port a few times, because
    // it may not be available for a short period between DFU updates.
    // Could also have used the usb module to listen for "attach" events,
    // but prefer not to include it as a dependency just for this.
    findPort() {
        debug(`Looking for port with serial number ${this.serialNumber}.`);
        return new Promise((res, rej) => {
            let retryCount = 0;
            const retryDelay = 200;
            const tryFindPort = () => {
                SerialPort.list()
                    .then(ports => {
                        const port = ports.find(p => p.serialNumber === this.serialNumber);
                        if (port) {
                            debug(`Found port ${port.path} with serial number ${this.serialNumber}`);
                            res(port);
                        } else if (retryCount < 50) {
                            retryCount += 1;
                            debug(`No port with serial number ${this.serialNumber} found. Retrying...`);
                            setTimeout(tryFindPort, retryDelay);
                        } else {
                            rej(new DfuError(ErrorCode.ERROR_UNABLE_FIND_PORT, `With serial number ${this.serialNumber}`));
                        }
                    });
            };
            tryFindPort();
        });
    }

    // Opens the port that matches the serial number provided to the transport.
    // Returns a Promise when opening is done.
    open() {
        if (this.port && this.port.isOpen) {
            return Promise.resolve();
        }
        return this.findPort()
            .then(port => {
                this.port = new SerialPort(port.path, { baudRate: 115200, autoOpen: false });
                return super.open();
            });
    }

    // Ideally, this should *wait* for the DFU target to be disconnected
    // (by means of listening to the serialport's `close` event). Unfortunately
    // there are several scenarios where this doesn't happen: macOS and
    // 64-bit win. Previous implementations ( < v0.2.5) had workarounds,
    // but those workarounds created problems on a specific USB XHCI root hub
    // on win7 64-bit.
    // The current implementation **assumes** that the DFU target will reset
    // itself.
    waitForDisconnect() {
        if (!this.port || !this.port.isOpen) {
            debug('Port is already closed.');
            return Promise.resolve();
        }

        // Explicit close in all cases
        return new Promise(resolve => {
            this.port.close(() => {
                // resolve() must be delayed so macOS doesn't immediately
                // open the same device again which occurs when it is plugged in a hub,
                // and win7-x64 might also have the chance to clean up.
                setTimeout(resolve, 2000);
            });
        });
    }
}
