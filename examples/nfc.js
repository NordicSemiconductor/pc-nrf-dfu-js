let nrfDfu = require('../dist/nrf-dfu.cjs');

let pcsc = require('pcsclite');

let maxMtu;
let packetReceiveNotification;
let filePath;

pcsc = pcsc();

console.log('NFC DFU Transport example');
console.log('-m: max mtu. default value: 200');
console.log('-n: packet receive notification. default value: 16');
console.log('-f: dfu file path');

process.argv.forEach(function(val, index, array) {
    if (val === '-m') {
        if (process.argv[index + 1]) {
            maxMtu = process.argv[index + 1];
        }
    }
    if (val === '-n') {
        if (process.argv[index + 1]) {
            packetReceiveNotification = process.argv[index + 1];
        }
    }
    if (val === '-f') {
        if (process.argv[index + 1]) {
            filePath = process.argv[index + 1];
        }
    }
});

const updatesPromise = nrfDfu.DfuUpdates.fromZipFilePath(filePath)

pcsc.on('reader', function(reader) {
    console.log('New reader detected', reader.name);

    reader.on('error', function(err) {
        console.log('Error(', this.name, '):', err.message);
    });

	
    reader.on('status', function(status) {
        console.log('Status(', this.name, '):', status);
        /* check what has changed */
        var changes = this.state ^ status.state;
        if (changes) {
            if ((changes & this.SCARD_STATE_EMPTY) && (status.state & this.SCARD_STATE_EMPTY)) {
                console.log("card removed");/* card removed */
                reader.disconnect(reader.SCARD_LEAVE_CARD, function(err) {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('Disconnected');
                    }
                });
            } else if ((changes & this.SCARD_STATE_PRESENT) && (status.state & this.SCARD_STATE_PRESENT)) {
                console.log("card inserted");/* card inserted */

                reader.connect({ share_mode : this.SCARD_SHARE_SHARED }, function(err, protocol) {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('Protocol(', reader.name, '):', protocol);

                        let nfcTransport = new nrfDfu.DfuTransportNfc(reader, packetReceiveNotification, protocol, maxMtu);
                        updatesPromise.then((updates)=>{
                            let dfu = new nrfDfu.DfuOperation(updates, nfcTransport);
                            
                            dfu.start(true)
                            .then(()=>{
                                console.log('Seems like the DFU completed successfully!!')
                            })
                            .catch((err)=>{
                                console.error('DFU failed. Reason:');
                                console.error(err);
                            })
                            .then(()=>{
                                // TODO: close port
                                //                 port.close()
                            });
                        });
                    }
                });

            }
        }
    });

    reader.on('end', function() {
        console.log('Reader',  this.name, 'removed');
    });
});

pcsc.on('error', function(err) {
    console.log('PCSC error', err.message);
});