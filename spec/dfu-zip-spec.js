'use strict';

var nrfDfu;

if (!nrfDfu) {
    nrfDfu = typeof window !== 'undefined' ?
        module.exports : // When running specRunner on a browser
        require('../dist/nrf-dfu.cjs');    // When running on node
}


// Aux. Don't want to include the TextDecoder logic here
function stringToUint8Array(str) {
    return new Uint8Array( str.split('').map((char)=>char.codePointAt(0)) );
}

describe("DfuUpdates", function() {

    it('Instantiates from a .zip file with manifest made with nrfutil', () => {

        return nrfDfu.DfuUpdates.fromZipFile('./spec/test-data/softdevice_bootloader_secure_ble_debug_with_bonds_s132.zip')
//         return nrfDfu.DfuUpdates.fromZipFile('.\\test-data\\softdevice_bootloader_secure_ble_debug_with_bonds_s132.zip')
        .then(updates=>{
            console.log(updates);
            return updates;
        });

    });


});
