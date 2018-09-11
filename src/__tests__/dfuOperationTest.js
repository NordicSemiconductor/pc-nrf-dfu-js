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

const path = require('path');
const SerialPort = require('serialport');
const nrfDfu = require('../../dist/nrf-dfu.cjs');

const testSoftDevicePath = path.resolve(__dirname, 'softdevice.zip');
const testTimeout = 30000;
const testDelay = 3000;

describe('The DFU Operation', () => {
    let port;

    beforeEach(async () => {
        await SerialPort.list().then(portList => {
            const ports = portList.filter(p => p.vendorId === '1915');
            if (ports && ports[0]) {
                port = new SerialPort(ports[0].comName, { baudRate: 115200, autoOpen: false });
            } else {
                throw new Error('No nordic serial device is available');
            }
        });
    }, testTimeout);

    it('shall dfu', async () => {
        expect(port).not.toBeNull();
        const updates = await nrfDfu.DfuUpdates.fromZipFilePath(testSoftDevicePath);
        const serialTransport = new nrfDfu.DfuTransportSerial(port, 4);
        const dfu = new nrfDfu.DfuOperation(updates, serialTransport);
        await dfu.start(true)
            .then(async () => {
                await new Promise(resolve => {
                    port.close(() => setTimeout(resolve, testDelay));
                });
            })
            .catch(() => {
                throw new Error('Test fails');
            });
    }, testTimeout);
});
