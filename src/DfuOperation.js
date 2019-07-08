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
    constructor(dfuUpdates, dfuTransport, autoStart = false) {
        this.updates = dfuUpdates.updates;
        this.transport = dfuTransport;

        if (autoStart) {
            this.start();
        }
    }

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
     *
     * @param {Bool} forceful if should skip the steps
     * @return {Promise} a Promise that resolves as soon as the DFU has been performed
     */
    start(forceful = false) {
        if (this.finishPromise) {
            return this.finishPromise;
        }
        this.finishPromise = this.performNextUpdate(0, forceful);
        return this.finishPromise;
    }

    // Takes in an update from this._update, performs it. Returns a Promise
    // which resolves when all updates are done.
    // - Tell the transport to send the init packet
    // - Tell the transport to send the binary blob
    // - Proceed to the next update
    performNextUpdate(updateNumber, forceful) {
        if (this.updates.length <= updateNumber) {
            return Promise.resolve();
        }

        let start;
        if (forceful) {
            start = this.transport.restart();
        } else {
            start = Promise.resolve();
        }

        return start
            .then(() => this.transport.sendInitPacket(this.updates[updateNumber].initPacket))
            .then(() => this.transport.sendFirmwareImage(this.updates[updateNumber].firmwareImage))
            .then(() => this.performNextUpdate(updateNumber + 1, forceful));
    }
}
