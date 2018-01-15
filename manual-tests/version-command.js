// This is just a manual test

const nrfDfu = require('../dist/nrf-dfu.cjs');

const SerialPort = require('serialport');

const debug = require('debug');

// Enable logging from all DFU functionality (see https://github.com/visionmedia/debug#set-dynamically)
debug.enable('*');


SerialPort.list().then(ports => {
    ports.forEach(port => {
        console.log(`${port.vendorId}/${port.productId}`);
    });
    console.log('Scanned');
    const filteredPorts = ports.filter(port => (
        (port.vendorId === '1915' && port.productId === '521F') ||              // NordicSemi default USB SDFU, Windows
        (port.vendorId === '1915' && port.productId === 'nRF52 USB SDFU') ||    // NordicSemi default USB SDFU, Linux
        (port.vendorId === '1915' && port.productId === '521f')                 // NordicSemi default USB SDFU, MacOS
    ));

    if (filteredPorts && filteredPorts[0]) {
        console.log(filteredPorts[0]);
        return new SerialPort(filteredPorts[0].comName, { baudRate: 115200, autoOpen: false });
    }
    throw new Error('No serial ports with a Segger are available');
})
.then(port => {
    const serialTransport = new nrfDfu.DfuTransportSerial(port, 0);

    serialTransport.getProtocolVersion()
    .then(version=>console.log('DFU protocol version: ', version))
    .then(()=>serialTransport.getHardwareVersion())
    .then(version=>{
        console.log('HW version part: ', version.part.toString(16))
        console.log('HW version variant: ', version.variant.toString(16))
        console.log('HW version ROM: ', version.memory.romSize)
        console.log('HW version RAM: ', version.memory.ramSize)
    })
    .then(()=>serialTransport.getAllFirmwareVersions())
    .then(version=>console.log('FW images: ', version))
    .then(() => port.close());
})
.catch(console.log);
