
# v0.2.0 (2018-05-18)

* Serial transport: Use return value of write() to wait before further writes, in the rare case that `serialport`'s internal send buffer fills up.
* Bump `serialport` dependency to v^6.0.0, put it into `peerDependencies` too. DFU procedure is known to fail with previous versions of serialport.
* Add DfuTransportUsbSerial with support for Nordic USB devices without J-Link debugger.
* Reject an error in DfuTransportPrn instead of a string when receiving an error code from target.
* Fix it's vs its typo in error strings in DfuErrorConstants.js.

# v0.1.1 (2018-04-19)

* Fix failed rollup by avoiding unnamed export.
* Moved external util repos (crc, slip) to local files.

# v0.1.0 (2018-01-24)

* Initial release
