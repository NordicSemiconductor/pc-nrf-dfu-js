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

import fs from 'fs';
import Debug from 'debug';

const JSZip = require('jszip/dist/jszip');

const debug = Debug('dfu:updates');

// Object.entries polyfill, as per
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries
if (!Object.entries) {
    Object.entries = obj => {
        const ownProps = Object.keys(obj);
        let i = ownProps.length;
        const resArray = new Array(i); // preallocate the Array
        while (i) {
            i -= 1;
            resArray[i] = [ownProps[i], obj[ownProps[i]]];
        }
        return resArray;
    };
}

/**
 * Represents a set of DFU updates.
 *
 * A DFU update is an update of either:
 * - The bootloader
 * - The SoftDevice
 * - The user application
 * - The bootloader plus the SoftDevice
 *
 * From the technical side, a DFU update is a tuple of an init packet and
 * a binary blob. Typically, the init packet is a protocol buffer ("protobuf"
 * or "pbf" for short) indicating the kind of memory region to update,
 * the size to update, whether to reset the device, extra checksums, which
 * kind of nRF chip family this update is meant for, and maybe a crypto signature.
 *
 * Nordic provides a default pbf definition, and *usually* a DFU update will use
 * that. However, there are use cases for using custom pbf definitions (which
 * imply using a custom DFU bootloader). Thus, this code does NOT perform any
 * checks on the init packet (nor on the binary blob, for that matter).
 *
 * An instance of DfuUpdates might be shared by several operations using different
 * transports at the same time.
 *
 * The constructor expects an Array of Objects containing two `Uint8Arrays`. `updates` is an
 * Array of `update`s, and each `update` is an Object of the form
 * `{ initPacket: Uint8Array, firmwareImage: Uint8Array }`.
 *
 */
export default class DfuUpdates {
    constructor(updates) {
        this.updates = updates || [];
        // FIXME: Perform extra sanity checks, check types of the "updates" array.
    }

    /**
     * Instantiates a set of DfuUpdates given the *path* of a .zip file.
     * That .zip file is expected to have been created by nrfutil, having
     * a valid manifest.
     *
     * This requires your environment to have access to the local filesystem.
     * (i.e. works in nodejs, not in a web browser)
     *
     * @param {String} path The full file path to the .zip file
     * @return {Promise} A Promise to an instance of DfuUpdates
     */
    static fromZipFilePath(path) {
        return new Promise((res, rej) => {
            fs.readFile(path, (err, data) => {
                if (err) { return rej(err); }
                return res(this.fromZipFile(data));
            });
        });
    }

    /**
     * Instantiates a set of DfuUpdates given the *contents* of a .zip file,
     * as an ArrayBuffer, a Uint8Array, Buffer, Blob, or other data type accepted by
     * [JSZip](https://stuk.github.io/jszip/documentation/api_jszip/load_async.html).
     * That .zip file is expected to have been created by nrfutil, having
     * a valid manifest.
     *
     * @param {String} zipBytes The full file path to the .zip file
     * @return {Promise} A Promise to an instance of DfuUpdates
     */
    static fromZipFile(zipBytes) {
        return (new JSZip()).loadAsync(zipBytes)
            .then(zippedFiles => (
                zippedFiles.file('manifest.json').async('text').then(manifestString => {
                    debug('Unzipped manifest: ', manifestString);

                    return JSON.parse(manifestString).manifest;
                }).then(manifestJson => {
                // The manifest should have up to 2 properties along
                // "softdevice", "bootloader", "softdevice_bootloader",
                // or "application". At least that's what the standard
                // Nordic DFU does, but nothing stops other implementations
                // and more types of payload. So we don't check for this.

                    debug('Parsed manifest:', manifestJson);

                    const updates = Object.entries(manifestJson).map(([, updateJson]) => {
                        const initPacketPromise = zippedFiles.file(updateJson.dat_file).async('uint8array');
                        const firmwareImagePromise = zippedFiles.file(updateJson.bin_file).async('uint8array');

                        return Promise.all([initPacketPromise, firmwareImagePromise])
                            .then(([initPacketBytes, firmwareImageBytes]) => ({
                                initPacket: initPacketBytes,
                                firmwareImage: firmwareImageBytes,
                            }));
                    });

                    return Promise.all(updates)
                        .then(resolvedUpdates => new DfuUpdates(resolvedUpdates));
                })
            ));
    }
}
