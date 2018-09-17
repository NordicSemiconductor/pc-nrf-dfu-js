/* Copyright (c) 2010 - 2018, Nordic Semiconductor ASA
 *
 * All rights reserved.
 *
 * Use in source and binary forms, redistribution in binary form only, with
 * or without modification, are permitted provided that the following conditions
 * are met:
 *
 * 1. Redistributions in binary form, except as embedded into a Nordic
 *    Semiconductor ASA integrated circuit in a product or a software update for
 *    such product, must reproduce the above copyright notice, this list of
 *    conditions and the following disclaimer in the documentation and/or other
 *    materials provided with the distribution.
 *
 * 2. Neither the name of Nordic Semiconductor ASA nor the names of its
 *    contributors may be used to endorse or promote products derived from this
 *    software without specific prior written permission.
 *
 * 3. This software, with or without modification, must only be used with a Nordic
 *    Semiconductor ASA integrated circuit.
 *
 * 4. Any software provided in binary form under this license must not be reverse
 *    engineered, decompiled, modified and/or disassembled.
 *
 * THIS SOFTWARE IS PROVIDED BY Nordic Semiconductor ASA "AS IS" AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY, NONINFRINGEMENT, AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL Nordic Semiconductor ASA OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
 * TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

const nrfDfu = require('../dist/nrf-dfu.cjs');
const { findPort } = require('./util/common');

const testTimeout = 30000;
const testDelay = 3000;
const testSerialNumber = process.env.DFU_SERIAL_NUMBER;

describe('The DFU Transport', () => {
    let port;

    beforeEach(async () => {
        port = await findPort(testSerialNumber);
    }, testTimeout);

    it('shall crate serial transport', async () => {
        const transportSerial = new nrfDfu.DfuTransportSerial(port);
        expect(transportSerial).not.toBeNull();
        await new Promise(resolve => {
            port.close(() => setTimeout(resolve, testDelay));
        });
    }, testTimeout);

    it('shall write data through serial transport', async () => {
        expect(port).not.toBeNull();
        const transportSerial = new nrfDfu.DfuTransportSerial(port);
        const result = await transportSerial.writeData('whatever');
        expect(result).not.toBeNull();
        await new Promise(resolve => {
            port.close(() => setTimeout(resolve, testDelay));
        });
    }, testTimeout);

    it('shall get protocal version through serial transport', async () => {
        expect(port).not.toBeNull();
        const transportSerial = new nrfDfu.DfuTransportSerial(port);
        const result = await transportSerial.getProtocolVersion();
        expect(result).not.toBeNaN();
        await new Promise(resolve => {
            port.close(() => setTimeout(resolve, testDelay));
        });
    }, testTimeout);

    it('shall get all firmware versions through serial transport', async () => {
        expect(port).not.toBeNull();
        const transportSerial = new nrfDfu.DfuTransportSerial(port);
        const result = await transportSerial.getAllFirmwareVersions();
        expect(result).not.toBeNull();
        await new Promise(resolve => {
            port.close(() => setTimeout(resolve, testDelay));
        });
    }, testTimeout);

    it('shall abort', async () => {
        expect(port).not.toBeNull();
        const transportSerial = new nrfDfu.DfuTransportSerial(port);
        const result  = await transportSerial.abort();
        expect(result).not.toBeNull();
        await new Promise(resolve => {
            port.close(() => setTimeout(resolve, testDelay));
        });
    }, testTimeout);
});
