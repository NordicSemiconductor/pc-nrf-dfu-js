
import ProgressCounter from './ProgressCounter';


/**
 * Represents a DFU Operation - the act of updating the firmware on a
 * nRF device.
 *
 * A firmware update is composed of one or more updates - e.g. bootloader then application,
 * or softdevice then application, or bootloader+softdevice then application, or only
 * one of these pieces.
 *
 * A nRF device is represented by the transport used to update it - the DfuOperation does
 * not care if that device is connected through USB and has serial number 12345678, or if that
 * device is connected through Bluetooth Low Energy and has Bluetooth address AA:BB:CC:DD:EE:FF.
 *
 * The transport must be instantiated prior to instantiating the DFU operation. This includes
 * doing things such as service discovery, buttonless BLE DFU initialization, or claiming
 * a USB interface of a USB device.
 */
export default class DfuOperation {

    constructor(dfuUpdates, dfuTransport, autoStart=false) {
        this._updates = dfuUpdates.updates;
        this._updatesPerformed = 0;
        this._transport = dfuTransport;

//         let totalSize = this._updates.reduce((update)=>)
//         this._progressCounter = new ProgressCounter(totalSize);

        if (this.autoStart) { this.start(); }
    }

    get progressGenerator() { return this._progressGenerator; }

    /**
     * Starts the DFU operation. Returns a Promise that resolves as soon as
     * the DFU has been performed (as in "everything has been sent to the
     * transport, and the CRCs back seem correct").
     *
     * If called with a truthy value for the 'forceful' parameter, then
     * the DFU procedure will skip the steps that detect whether a previous
     * DFU procedure has been interrupted and can be continued. In other
     * words, the DFU procedure will be started from the beginning, regardless.
     *
     * Calling start() more than once has no effect, and will only return a
     * reference to the first Promise that was returned.
     */
    start(forceful = false) {
        if (this._finishPromise) { return this._finishPromise; }

        return this._finishPromise = this._start(forceful);
    }

    _start(forceful) {
        return this._performNextUpdate(0, forceful);
    }

    // Takes in an update from this._update, performs it. Returns a Promise
    // which resolves when all updates are done.
    // - Tell the transport to send the init packet
    // - Tell the transport to send the binary blob
    // - Proceed to the next update
    _performNextUpdate(updateNumber, forceful) {
        if (this._updates.length <= updateNumber) {
            return Promise.resolve();
        }

        let start;
        if (forceful) {
            start = this._transport.restart();
        } else {
            start = Promise.resolve();
        }

        return start
        .then(()=>{
            return this._transport.sendInitPacket(this._updates[updateNumber].initPacket)
        })
        .then(()=>{
            return this._transport.sendFirmwareImage(this._updates[updateNumber].firmwareImage)
        })
        .then(()=>{
            this._performNextUpdate(updateNumber+1, forceful);
        });
    }


}












