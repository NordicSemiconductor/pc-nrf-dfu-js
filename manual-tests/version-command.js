// This is just a manual test

const nrfDfu = require('../dist/nrf-dfu.cjs');

const SerialPort = require('serialport');

SerialPort.list().then(ports => {
    ports.forEach(port => {
        console.log(`${port.vendorId}/${port.productId}`);
    });
    console.log('Scanned');
    const filteredPorts = ports.filter(port => (
        (port.vendorId === '1915' && port.productId === '521F') || // NordicSemi default USB SDFU, win
        (port.vendorId === '1915' && port.productId === 'nRF52 USB SDFU') // NordicSemi default USB SDFU, linux
    ));

    if (filteredPorts && filteredPorts[0]) {
        console.log(filteredPorts[0]);
        return new SerialPort(filteredPorts[0].comName, { baudRate: 115200, autoOpen: false });
    }
    throw new Error('No serial ports with a Segger are available');
})
.then(port => {
    const serialTransport = new nrfDfu.DfuTransportSerial(port, 0);

    serialTransport.getFirmwareVersion()
    .then(console.log)
    .then(() => port.close());
})
.catch(console.log);
