import * as JSZip from 'jszip';
import fs from 'fs';

const debug = require('debug')('dfu:updates');


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
        .then(zippedFiles =>
            zippedFiles.file('manifest.json').async('text').then(manifestString => {
                debug('Unzipped manifest: ', manifestString);

                return JSON.parse(manifestString).manifest;
            }).then(manifestJson => {
                // The manifest should have up to 2 properties along
                // "softdevice", "bootloader", "softdevice_bootloader",
                // or "application". At least that's what the standard
                // Nordic DFU does, but nothing stops other implementations
                // from creating more init packets (with more protobuf defs)
                // and more types of payload. So we don't check for this.

                debug('Parsed manifest:', manifestJson);

                const updates = Object.entries(manifestJson).map(([, updateJson]) => {
                    const { dat_file, bin_file } = updateJson;
                    const initPacketPromise = zippedFiles.file(dat_file).async('uint8array');
                    const firmwareImagePromise = zippedFiles.file(bin_file).async('uint8array');

                    return Promise.all([initPacketPromise, firmwareImagePromise])
                        .then(([initPacketBytes, firmwareImageBytes]) => ({
                            initPacket: initPacketBytes,
                            firmwareImage: firmwareImageBytes,
                        }));
                });

                return Promise.all(updates)
                .then(resolvedUpdates => new DfuUpdates(resolvedUpdates));
            }));
    }
}
