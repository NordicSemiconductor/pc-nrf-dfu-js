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

const debug = Debug('dfu:slowserial');

/**
 * Slow serial DFU transport.
 *
 * Just like the Serial DFU transport, but adds a synthetic delay when
 * receiving SLIP packets.
 * It can also lower the data MTU, to trigger sending more messages for
 * each data payload.
 */
export default class DfuTransportSlowSerial extends DfuTransportSerial {
    // Delay is in milliseconds
    constructor(serialPort, delay = 50, packetReceiveNotification = 16, maxMtu = Infinity) {
        super(serialPort, packetReceiveNotification);

        this.delay = delay;
        this.maxMtu = maxMtu;
    }

    // Callback when raw (yet undecoded by SLIP) data is being read from the serial port instance.
    // Called only internally.
    onRawData(data) {
        setTimeout(() => {
            super.onRawData(data);
        }, this.delay);
    }

    // Decorate ready() so it hijacks the value of the MTU.
    ready() {
        if (this.readyPromise) {
            return this.readyPromise;
        }

        return super.ready().then(() => {
            const mtu = Math.min(this.mtu, this.maxMtu);
            debug(`Hijacking MTU value, now: ${mtu}`);
            this.mtu = mtu;
        });
    }
}
