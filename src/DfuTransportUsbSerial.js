import DfuTransportSerial from './DfuTransportSerial';

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
