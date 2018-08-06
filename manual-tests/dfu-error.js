// This is just a manual test

let nrfDfu = require('../dist/nrf-dfu.cjs');

const Debug = require('debug');
debug = Debug('dfu:dfu-error-test');

// Enable logging from all DFU functionality (see https://github.com/visionmedia/debug#set-dynamically)
Debug.enable('*');

debug(new nrfDfu.DfuError(0x0100).message);
debug(new nrfDfu.DfuError(0x0002, `Expected 10 bytes to have been sent, actual is 8 bytes.`).message);