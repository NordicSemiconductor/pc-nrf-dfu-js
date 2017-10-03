'use strict';

if (!nrfDfu) {
    nrfDfu = typeof window !== 'undefined' ?
        module.exports : // When running specRunner on a browser
        require('../src/index');    // When running on node
}


// Aux. Don't want to include the TextDecoder logic here
function stringToUint8Array(str) {
    return new Uint8Array( str.split('').map((char)=>char.codePointAt(0)) );
}

describe("DFU to a sink", function() {

    let basicUpdates = new nrfDfu.DfuUpdates([
        [
            new stringToUint8Array("Init packet"),
            new stringToUint8Array("Binary payload")
        ]
    ]);


    it('Sends an init packet to the sink', () => {

        let sink = new nrfDfu.DfuTransportSink();
        let dfu = new nrfDfu.DfuOperation(basicUpdates, sink);


        return dfu.start(); // Returning a Promise lets Jasmine know that this is async.

    });


});
