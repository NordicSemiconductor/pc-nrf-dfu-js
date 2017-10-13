
let nrfDfu = require('../dist/nrf-dfu.cjs');

let SerialPort = require('serialport');


Promise.all([
    SerialPort.list().then((ports)=>{
// console.log(ports);

        ports.forEach(port=>{
            console.log(port.vendorId + '/' + port.productId);
        })

        ports = ports.filter(port=>(
//             (port.vendorId === '1366') || // Segger
            (port.vendorId === '1915' && port.productId === '521F') // NordicSemi default USB SDFU
        ));

    //     console.log('serial ports: ', ports);

        if (ports && ports[0]) {
            console.log(ports[0]);
    //         return new SerialPort(ports[0].comName, { baudRate: 57600} );
    //         return new SerialPort(ports[0].comName, { baudRate: 9600, autoOpen: false});
            return new SerialPort(ports[0].comName, { baudRate: 115200, autoOpen: false});
    //         return new SerialPort(ports[0].comName, { baudRate: 57600, autoOpen: false});
        } else {
            throw new Error('No serial ports with a Segger are available');
        }

    }),
    nrfDfu.DfuUpdates.fromZipFilePath('./spec/test-data/ble_app_buttonless_dfu_with_bonds_s132.zip')
//     nrfDfu.DfuUpdates.fromZipFilePath('./spec/test-data/52840/dfu app update/keyboard_app_debug.zip')
])
.then(([port, updates])=>{

    let serialTransport = new nrfDfu.DfuTransportSerial(port, 8);

    let dfu = new nrfDfu.DfuOperation(updates, serialTransport);

//     dfu.start(true)
    dfu.start()
    .then(()=>{
        console.log('Seems like the DFU completed successfully!!')
    })
    .catch((err)=>{
        console.error('DFU failed. Reason:');
        console.error(err);
    })
    .then(()=>{
        port.close() // <--- I'm NOT closing the serial port connection
    });

//     port.on('error', function(err) {
//         console.log('Error: ', err);
//     });
//
//     port.on('data', function(data) {
//         console.log('Data: ', data, data.toString());
//     });
//
//     port.open(()=>{
//         console.log('Opened');
//
// //         port.write('echo(true);\n');
// //         port.write('5+5;\n');
//
// //         setTimeout( ()=>{
// //             port.write(new Uint8Array( [ 0xC0, 0x08, 0xAB, 0xC0 ] ));
// //             port.write(new Uint8Array( [ 0x08, 0xAB, 0xC0 ] ));
// //         }, 500);
//
//
//         let interval = setInterval(()=>{
//             console.log('Sending 0xC0');
//             port.write(new Uint8Array( [ 0xC0 ] ));
//         }, 250);
//
//
//         setTimeout( ()=> {
//             clearInterval(interval);
//         }, 4500);
//
//
//         setTimeout( ()=> {
// //             console.log('Sending 0x02, 0x00, 0x10, 0xC0 ');
// //             port.write(new Uint8Array( [ 0x02, 0x00, 0x10, 0xC0 ] ));
//
// //             console.log('Sending 0x09, 0xAB, 0xC0 ');
// //             port.write(new Uint8Array( [ 0x09, 0xAB, 0xC0 ] ));
//
//             console.log('Sending 0xC0, 0x09, 0xAB, 0xC0 ');
//             port.write(new Uint8Array( [ 0xC0, 0xC0, 0xC0, 0xC0, 0xC0, 0xC0, 0xC0, 0x09, 0xAC, 0xC0 ] ));
//         }, 2000);
//
//         // This corresponds to a SLIP-encoded (0xC0s) set PRN request (2) of size 16 (0 16)
// //         port.write(new Uint8Array( [ 0xC0, 0xC0, 0xC0, 0xC0, 0xC0, 2, 0, 16, 0xC0 ] )); //, ()=>{
// //         port.write(new Uint8Array( [ 2, 0, 16, 0xC0 ] ), ()=>{
// //             console.log('Written');
// //             port.drain(()=>{
// //                 console.log('Drained');
// //             });
// //         });
//
//
//         setTimeout( ()=> {
//             port.close();
//         }, 5000);
//     });


});








