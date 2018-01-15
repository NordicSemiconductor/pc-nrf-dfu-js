
import DfuTransportSerial from './DfuTransportSerial';

const debug = require('debug')('dfu:slowserial');

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

