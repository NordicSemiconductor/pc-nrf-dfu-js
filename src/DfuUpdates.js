
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
 * The constructor expects an Array of Arrays of two `Uint8Arrays`. `updates` is an
 * Array of `update`s, and each `update` is an Array of two elements, each element
 * being an `Uint8Array`.
 *
 */

export default class DfuUpdates {
    constructor(updates) {
        this._updates = updates || [];
        // FIXME: Perform extra sanity checks, check types of the "updates" array.
    }

    get updates() {
        return this._updates;
    }

    /**
     * Instantiates a set of DfuUpdates given the path of a .zip file.
     * That .zip file is expected to have been created by nrfutil, having
     * a valid manifest.
     *
     * @param String path The full file path to the .zip file
     * @return An instance of DfuUpdates
     */
    static fromZipFile(path) {
        // FIXME
    }

}














