
let nrfDfu = require('../dist/nrf-dfu.cjs');

let SerialPort = require('serialport');


Promise.all([
    SerialPort.list().then((ports)=>{
// console.log(ports);

        ports.forEach(port=>{
            console.log(port.vendorId + '/' + port.productId);
        })
        console.log('Scanned');
        ports = ports.filter(port=>(
//             (port.vendorId === '1366') || // Segger
            (port.vendorId === '1915' && port.productId === '521F') || // NordicSemi default USB SDFU, win
            (port.vendorId === '1915' && port.productId === 'nRF52 USB SDFU') // NordicSemi default USB SDFU, linux
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
//     nrfDfu.DfuUpdates.fromZipFilePath('./spec/test-data/ble_app_buttonless_dfu_with_bonds_s132.zip')
    nrfDfu.DfuUpdates.fromZipFilePath('./spec/test-data/blinky_s140.zip')
//     nrfDfu.DfuUpdates.fromZipFilePath('./spec/test-data/52840/dfu app update/keyboard_app_debug.zip')
])
.then(([port, updates])=>{

    //                                                 port, PRN
    let serialTransport = new nrfDfu.DfuTransportSerial(port, 0);

    // console.log(serialTransport);
    serialTransport.getFirmwareVersion()
    // serialTransport.getHardwareVersion()
    .then(res => {
        // console.log('lalalalalalal');
        console.log(res);
    });
    // console.log(response);
    // let dfu = new nrfDfu.DfuOperation(updates, serialTransport);

//     dfu.start(true)
// //     dfu.start()
//     .then(()=>{
//         console.log('Seems like the DFU completed successfully!!')
//     })
//     .catch((err)=>{
//         console.error('DFU failed. Reason:');
//         console.error(err);
//     })
//     .then(()=>{
//         port.close();
//     });
});