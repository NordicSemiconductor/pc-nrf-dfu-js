
let nrfDfu = require('../dist/nrf-dfu.cjs');
let SerialPort = require('serialport');

const debug = require('debug');

// Enable logging from all DFU functionality (see https://github.com/visionmedia/debug#set-dynamically)
// debug.enable('dfu:*');

// Enable logging for individual functionality with:
// debug.enable('dfu:updates');
// debug.enable('dfu:transport');
// debug.enable('dfu:prntransport');
// debug.enable('dfu:serial');

// Logging can also be enabled via environment variables. See https://github.com/visionmedia/debug



Promise.all([
    SerialPort.list().then((ports)=>{

        ports.forEach(port=>{
            console.log('Serial port present: VID/PID ', port.vendorId + '/' + port.productId);
        })

        ports = ports.filter(port=>(
//             (port.vendorId === '1366') || // Segger
            (port.vendorId === '1915' && port.productId === '521F') || // NordicSemi default USB SDFU, win
            (port.vendorId === '1915' && port.productId === 'nRF52 USB SDFU') // NordicSemi default USB SDFU, linux
        ));

    //     console.log('serial ports: ', ports);

        if (ports && ports[0]) {
            console.log('Using serial port: ', ports[0]);
            const speed = 115200;   // 9600, 57600, 115200
            return new SerialPort(ports[0].comName, { baudRate: 115200, autoOpen: false});
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
    let serialTransport = new nrfDfu.DfuTransportSerial(port, 4);

    let dfu = new nrfDfu.DfuOperation(updates, serialTransport);

    dfu.start(true)
//     dfu.start()
    .then(()=>{
        console.log('Seems like the DFU completed successfully!!')
    })
    .catch((err)=>{
        console.error('DFU failed. Reason:');
        console.error(err);
    })
    .then(()=>{
        port.close();
    });
});








