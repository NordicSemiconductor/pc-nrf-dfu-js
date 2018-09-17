# nRF DFU
[![License](https://img.shields.io/badge/license-Modified%20BSD%20License-blue.svg)](LICENSE)

`pc-nrf-dfu-js` is a Javascript module which provides DFU (Device Firmware Upgrade) via USB CDC ACM transport for Nordic devices.

This module is primarily used by the [nRF Connect](https://github.com/NordicSemiconductor/pc-nrfconnect-core) framework and
[nRF Device Setup]

The following devices are supported:

* USB SDFU:
    * PCA10056 nRF52840 Development Kit
    * PCA10059 nRF52840 Dongle

## Installation

```
$ npm install pc-nrf-dfu-js
```

### Dependency requirements

#### USB SDFU devices

##### Windows

In order to access Nordic USB devices on Windows, specific device drivers must be installed. The device drivers are automatically installed by the nRF Connect installer, starting from version 2.4. The drivers can also be found [here](https://github.com/NordicSemiconductor/pc-nrfconnect-core/tree/master/build/drivers).

##### Linux
Linux requires correct permissions to access these devices. For this purpose please install udev rules from [nrf-udev](https://github.com/NordicSemiconductor/nrf-udev) repository, follow instructions there.

## Usage

```js
import { DfuUpdates, DfuTransportSerial, DfuOperation } from 'nrf-device-setup';

// Create DfuUpdates
const updates = await DfuUpdates.fromZipFilePath(firmwarePath);

// Create DfuTransportSerial
const serialTransport = new DfuTransportSerial(port, 16);

// Create DfuOperation
const dfu = new nrfDfu.DfuOperation(updates, serialTransport);

// Start dfu
dfu.start(true)
    .then(() => {
        ...
    })
    .catch(() => {
        ...
    });
```

## USB SDFU

PCA10059 is a nRF52840 dongle which does not have a JLink debugger, so the USB device
that the operating system _sees_ depends on the firmware that is currently running on the Nordic chip.

This can be either a _bootloader_ or an _application firmware_.

### Bootloader mode

The pre-programmed bootloader provides a USB device with vendor ID `0x1915` and product ID `0x521f`.
This device has a USB CDC ACM (serialport) interface which handles the DFU operation.
In case you need to manually trigger the bootloader, press the RESET button on the dongle.

### Application mode

The dongle will be in application mode if it is plugged in and is programmed with a valid application. It will also switch to application mode after a successful DFU operation.

In application mode the USB device visible to the OS depends on the application firmware.
For further documentation please refer to the [Nordic SDK](https://developer.nordicsemi.com/nRF5_SDK/).

In application mode it is **expected** that the visible USB device to the OS has a _DFU trigger interface_.
This interface provides a `semver` string which identifies the application firmware currently running.
If the `semver` doesn't match the expected value, the device will be reset into bootloader mode.

Changing between bootloader and application also implies that the USB device is detached and attached,
so there is an underlying functionality based on _nrf-device-lister_ which looks for the newly
attached USB device and tries to match by its _serialNumber_.


## Development

### Build

The project is using `rollup.js`, so the following command is needed to run the build:
    npm run rollup


### Test

The project comes with automated integration tests in the `test` directory. In order to run the test, nRF52840 development kit must be attached to the PC on CDC ACM port or nRF52840 dongle must be attached to the PC.
The environment variable `DFU_SERIAL_NUMBER` needs to be set to specify a certain nRF52840 dongle.
Or if it is not specified, then the first found nRF52840 dongle by `SerialPort` will be used for the test.
Otherwise, the test will fail.

To run the tests:

    npm test
