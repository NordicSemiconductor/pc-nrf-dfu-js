'use strict';

var nrfDfu;

if (!nrfDfu) {
    nrfDfu = typeof window !== 'undefined' ?
        module.exports : // When running specRunner on a browser
        require('../dist/nrf-dfu.cjs');    // When running on node
}

const hasFs = (typeof require !== "undefined" && require('fs'));

// Aux. Don't want to include the TextDecoder logic here
function stringToUint8Array(str) {
    return new Uint8Array( str.split('').map((char)=>char.codePointAt(0)) );
}

describe("DfuUpdates", function() {

    describe('Instantiates from a .zip file with manifest made with nrfutil', () => {

        it('From the local filesystem', () => {

            if (!hasFs) { return pending('No fs support in this environment') }

            return nrfDfu.DfuUpdates.fromZipFile('./spec/test-data/softdevice_bootloader_secure_ble_debug_with_bonds_s132.zip')
            .then(updates=>{
//                 console.log(updates._updates[0].initPacket.length);

                expect(updates.updates.length).toEqual(1);
                expect(updates.updates[0].initPacket instanceof Uint8Array).toEqual(true);
                expect(updates.updates[0].firmwareImage instanceof Uint8Array).toEqual(true);
                expect(updates.updates[0].initPacket.length).toEqual(140);
                expect(updates.updates[0].firmwareImage.length).toEqual(177416);

                return updates;
            });
        });

        it('Fetched from the network', () => {

            if (typeof fetch === 'undefined') { return pending('No fetch support in this environment'); }

            return fetch('./test-data/softdevice_bootloader_secure_ble_debug_with_bonds_s132.zip')
            .then(response=>{
                return response.arrayBuffer();
            }).then(zipBytes=>{
                return nrfDfu.DfuUpdates.fromZipFile(zipBytes)
        //         return nrfDfu.DfuUpdates.fromZipFile('.\\test-data\\softdevice_bootloader_secure_ble_debug_with_bonds_s132.zip')
                .then(updates=>{
    //                 console.log(updates._updates[0].initPacket.length);

                    expect(updates.updates.length).toEqual(1);
                    expect(updates.updates[0].initPacket instanceof Uint8Array).toEqual(true);
                    expect(updates.updates[0].firmwareImage instanceof Uint8Array).toEqual(true);
                    expect(updates.updates[0].initPacket.length).toEqual(140);
                    expect(updates.updates[0].firmwareImage.length).toEqual(177416);

                    return updates;
                });
            });
        });
    });


});
