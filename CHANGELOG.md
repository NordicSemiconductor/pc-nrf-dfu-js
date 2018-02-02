
# v0.1.1 (2018-02-02)

* Serial transport: Use return value of write() to wait before further writes, in the rare case that `serialport`'s internal send buffer fills up.
* Bump `serialport` dependency to v^6.0.0, put it into `peerDependencies` too. DFU procedure is known to fail with previous versions of serialport.

# v0.1.0 (2018-01-24)

* Initial release
