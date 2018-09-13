# nRF DFU
[![License](https://img.shields.io/badge/license-Modified%20BSD%20License-blue.svg)](LICENSE)

`pc-nrf-dfu-js` is a Javascript module which provides DFU (Device Firmware Upgrade) via USB CDC ACM transport for Nordic devices.

This module is primarily used by the [nRF Connect](https://github.com/NordicSemiconductor/pc-nrfconnect-core) framework and
[nRF Device Setup]

The following devices are supported:

* JLink:
    * PCA10028 nRF51 Development Kit
    * PCA10031 nRF51 Dongle
    * PCA10040 nRF52 Development Kit
    * PCA10056 nRF52 Development Kit
* USB SDFU:
    * PCA10059 nRF52 Dongle

## Installation

```
$ npm install pc-nrf-dfu-js
```

### Dependency requirements

#### USB SDFU devices

##### Windows

In order to access Nordic USB devices specific drivers must be installed on Windows, which are automatically installed by nRF Connect for Desktop (starting from version 2.4). The drivers can be found [here](https://github.com/NordicSemiconductor/pc-nrfconnect-core/tree/master/build/drivers).

##### Linux
Linux requires correct permissions to access these devices. For this purpose please install udev rules from [nrf-udev](https://github.com/NordicSemiconductor/nrf-udev) repository, follow instructions there.

## Usage

```js
import { DfuUpdates, DfuTransportSerial, DfuOperation } from 'nrf-device-setup';

// Create DfuUpdates
const updates = await DfuUpdates.fromZipFilePath(firmwarePath);

// Create DfuTransportSerial
const serialTransport = new DfuTransportSerial(port, 16);

// Create DfuOperatin
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

The bootloader provides a USB device with vendor ID `0x1915` and product ID `0x521f`.
This device has a USB CDC ACM (serialport) interface which handles the DFU operation.
In case you need to manually trigger the bootloader, press the RESET button on the dongle.

### Application mode

The dongle is in application mode if it has an application to run and is simply plugged in,
or after a successful DFU operation.

In application mode the visible USB device depends on the application firmware.
For further documentation please refer to the [Nordic SDK]().

In application mode it is **expected** that the visible USB device has a _DFU trigger interface_.
This interface provides a `semver` string which identifies the application firmware currently running,
and is also able to reset the device into bootloader.
In case the `semver` doesn't match the bootloader will be triggered.

Changing between bootloader and application also implies that the USB device is detached and attached,
so there is an underlying functionality based on _nrf-device-lister_ which looks for the newly
attached USB device and tries to match by its _serialNumber_.


## Development

### Build

The project is using `rollup.js`, so the following command is needed to run the build:
    npm run rollup


### Test

The project comes with automated integration tests in the `test` directory. In order to run the test, nRF52840 development kit must be attached to the PC on both JLink and CDC ACM ports. To run the tests:

    npm test
