import DfuTransportSerial from './DfuTransportSerial';

const os = require('os');
const debug = require('debug')('dfu:usbserial');
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
                            debug(`Found port ${port.comName} with serial number ${this.serialNumber}`);
                            res(port);
                        } else if (retryCount < 50) {
                            retryCount += 1;
                            debug(`No port with serial number ${this.serialNumber} found. Retrying...`);
                            setTimeout(tryFindPort, retryDelay);
                        } else {
                            rej(new Error(`Unable to find port with serial number ${this.serialNumber}`));
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
                this.port = new SerialPort(port.comName, { baudRate: 115200, autoOpen: false });
                return super.open();
            });
    }

    // Waits for the target to disconnect. Times out if not
    // disconnected after 5000 ms.
    waitForDisconnect() {
        if (!this.port || !this.port.isOpen) {
            debug('Port is already closed.');
            return Promise.resolve();
        }

        // Close port on MacOS explicitly since MacOS does not close the port automatically.
        if (os.platform() === 'darwin') {
            return new Promise(resolve => {
                this.port.close(() => {
                    // resolve() must be delayed so macOS doesn't immediately
                    // open the same device again which occurs when it is plugged in a hub.
                    setTimeout(resolve, 1000);
                });
            });
        }

        debug('Waiting until the port is closed by the target...');

        // Some platforms have faulty implementations of serial-over-USB
        // drivers, so the `close` event might not be fired when the USB
        // device is disconnected, only when actively sending/receiving data.
        // The workaround here is to send CRC requests (which will not
        // modify the state of the DFU bootloader if it still hasn't rebooted/detached).
        // See https://github.com/node-serialport/node-serialport/issues/1334#issuecomment-331442883
        const interval = setInterval(() => {
            debug('Sending CRC request (and expecting it to fail and trigger a \'close\' event)');

            // Using this.writeCommand instead of this.crcObject because this.crcObject
            // will wait for a response. If the port is closed while waiting for a
            // response, then the next DFU transfer (if any) will fail because the
            // transport will keep waiting for a CRC response.
            this.writeCommand(new Uint8Array([
                0x03, // "CRC" opcode
            ]));
        }, 250);

        let timeout;
        return Promise.race([
            new Promise(res => {
                this.port.once('close', () => {
                    debug('Port was closed by the target, as expected.');
                    clearTimeout(timeout);
                    clearInterval(interval);
                    res();
                });
            }),
            new Promise((_, rej) => {
                timeout = setTimeout(() => {
                    clearInterval(interval);
                    rej(new Error('Timeout while waiting for serial port to be closed by DFU target.'));
                }, 5000);
            }),
        ]);
    }
}
