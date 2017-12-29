
let nrfDfu = require('../dist/nrf-dfu.cjs');

let SerialPort = require('serialport');


// Aux. Don't want to include the TextDecoder logic here
function stringToUint8Array(str) {
    return new Uint8Array( str.split('').map((char)=>char.codePointAt(0)) );
}
let basicUpdates = new nrfDfu.DfuUpdates([
    {
        initPacket: new stringToUint8Array("Init packet"),
        firmwareImage: new stringToUint8Array(`
Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur`)
    }
]);


SerialPort.list().then((ports)=>{

    ports = ports.filter(port=>{ return port.vendorId === '1366' })

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

}).then((port)=>{

    let serialTransport = new nrfDfu.DfuTransportSerial(port, 8);

    let dfu = new nrfDfu.DfuOperation(basicUpdates, serialTransport);

    dfu.start()
    .then(()=>{
        console.log('Seems like the DFU completed successfully!!')
    })
    .catch((err)=>{
        console.error('DFU failed. Reason:');
        console.error(err);
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


})
.catch(console.log);
