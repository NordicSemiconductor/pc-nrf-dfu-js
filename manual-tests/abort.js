// This is just a manual test

const nrfDfu = require('../dist/nrf-dfu.cjs');

const SerialPort = require('serialport');

const Debug = require('debug');
debug = Debug('dfu:abort-test');

// Enable logging from all DFU functionality (see https://github.com/visionmedia/debug#set-dynamically)
Debug.enable('*');

SerialPort.list().then(ports => {
    ports.forEach(port => {
        debug(`${port.vendorId}/${port.productId}`);
    });
    debug('Scanned');
    const filteredPorts = ports.filter(port => (
        (port.vendorId === '1915' && port.productId === '521F') ||              // NordicSemi default USB SDFU, Windows
        (port.vendorId === '1915' && port.productId === 'nRF52 USB SDFU') ||    // NordicSemi default USB SDFU, Linux
        (port.vendorId === '1915' && port.productId === '521f')                 // NordicSemi default USB SDFU, MacOS
    ));

    if (filteredPorts && filteredPorts[0]) {
        debug(filteredPorts[0]);
        return new SerialPort(filteredPorts[0].comName, { baudRate: 115200, autoOpen: false });
    }
    throw new Error('No serial ports with a Segger are available');
})
.then(port => {
    const serialTransport = new nrfDfu.DfuTransportSerial(port, 0);

    serialTransport.abortObject()
        .then(() => port.close());
})
.catch(debug);
