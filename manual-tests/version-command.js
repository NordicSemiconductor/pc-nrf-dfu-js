// This is just a manual test

let nrfDfu = require('../dist/nrf-dfu.cjs');

let SerialPort = require('serialport');


Promise.all([
    SerialPort.list().then((ports)=>{


        ports.forEach(port=>{
            console.log(port.vendorId + '/' + port.productId);
        })
        console.log('Scanned');
        ports = ports.filter(port=>(
            (port.vendorId === '1915' && port.productId === '521F') || // NordicSemi default USB SDFU, win
            (port.vendorId === '1915' && port.productId === 'nRF52 USB SDFU') // NordicSemi default USB SDFU, linux
        ));

        if (ports && ports[0]) {
            console.log(ports[0]);
            return new SerialPort(ports[0].comName, { baudRate: 115200, autoOpen: false});
        } else {
            throw new Error('No serial ports with a Segger are available');
        }

    }),
    nrfDfu.DfuUpdates.fromZipFilePath('./spec/test-data/blinky_s140.zip')
])
.then(([port, updates])=>{

    let serialTransport = new nrfDfu.DfuTransportSerial(port, 0);

    serialTransport.getFirmwareVersion()
    .then(res => {
        console.log(res);
    });
});