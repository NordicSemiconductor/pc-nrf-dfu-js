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
import { DfuError, ErrorCode } from './DfuError';
import DfuTransportPrn from './DfuTransportPrn';

const debug = Debug('dfu:nfc');

/**
 * NFC DFU transport.
 *
 */
export default class DfuTransportNfc extends DfuTransportPrn {
    constructor(reader, packetReceiveNotification = 16, protocol = 2, maxMtu = 200) {
        super(packetReceiveNotification);

        this.reader = reader;
        this.protocol = protocol;
        // convert MTU to max payload length sending over NFC ( MTU - 1 byte OP code length)
        this.mtu = maxMtu - 1;
    }

    writeCommand(bytes) {
        const bytesBuf = Buffer.from(bytes);
        debug(' ctrl --> ', bytesBuf);
        let rxBuf;
        let that = this;

        return new Promise((res, rej) => {
            this.reader.transmit(bytesBuf, 255, this.protocol, function(err, data) {
                if (err) {
                    console.log(err);
                    return rej(err);
                } else {
                    debug(' recv <-- ', data);
                    rxBuf = Buffer.from(data);
                    that.onData(rxBuf);
                    return res();
                }
            });
        });
    }

    // Given some payload bytes, pack them into a 0x08 command.
    // The length of the bytes is guaranteed to be under this.mtu thanks
    // to the DfuTransportPrn functionality.
    writeData(bytes) {
        const dataBytes = new Uint8Array(bytes.length + 1);
        dataBytes.set([0x08], 0); // "Write" opcode
        dataBytes.set(bytes, 1);
        debug(`send ${dataBytes.length} bytes data --> `);
        let rxBuf;
        let that = this;

        return new Promise((res, rej) => {
            const readerTransmit  = () => {
                this.reader.transmit(dataBytes, 255, this.protocol, function(err, data) {
                    if (err) {
                        console.log(err);
                        return rej(err);
                    } else {
                        debug(' recv <-- ', data);
                        if(data[0] === 0x60) {
                            rxBuf = Buffer.from(data);
                            that.onData(rxBuf);
                            return res();
                        }
                        else if((data[0] === 0x90) && (data[1] === 0x00)) {
                            debug(' transmit data unit ok');
                            return res();
                        }
                        else if((data[0] === 0x63) && (data[1] === 0x86)) {
                            debug(' Resend frame after 100ms');
                            setTimeout(() => {
                                readerTransmit();
                            }, 100);
                        }
                    }
                });
            };
            readerTransmit();
        });
    }

    // Abstract method, called before any operation that would send bytes.
    // Concrete subclasses **must**:
    // - Check validity of the connection,
    // - Re-initialize connection if needed, including
    //   - Set up PRN
    //   - Request MTU (only if the transport has a variable MTU)
    // - Return a Promise whenever the connection is ready.
    ready() {
        if (this.readyPromise) {
            return this.readyPromise;
        }

        this.readyPromise = this.writeCommand(new Uint8Array([
            0x02, // "Set PRN" opcode
            // eslint-disable-next-line no-bitwise
            this.prn & 0xFF, // PRN LSB
            // eslint-disable-next-line no-bitwise
            (this.prn >> 8) & 0xFF, // PRN MSB
        ]))
            .then(this.read.bind(this))
            .then(this.assertPacket(0x02, 0))
            // Request MTU
            .then(() => this.writeCommand(new Uint8Array([
                0x07, // "Request MTU" opcode
            ])))
            .then(this.read.bind(this))
            .then(this.assertPacket(0x07, 2))
            .then(bytes => {
                let target_mtu = (bytes[1] * 256) + bytes[0];

                // Convert target MTU into max payload of payload sent over NFCbefore SLIP encoding:
                // This takes into account:
                // DFU command ( -1 )
                target_mtu -= 1;
                Math.min(target_mtu, this.mtu);
                this.mtu = Math.min(target_mtu, this.mtu);;

                // Round down to multiples of 4.
                // This is done to avoid errors while writing to flash memory:
                // writing an unaligned number of bytes will result in an
                // error in most chips.
                this.mtu -= this.mtu % 4;

                debug(`NFC MTU: ${this.mtu}`);
            });

        return this.readyPromise;
    }
}