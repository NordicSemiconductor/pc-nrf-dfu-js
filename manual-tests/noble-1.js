var noble = require('noble');
let nrfDfu = require('../dist/nrf-dfu.cjs');

// noble.startScanning(); // any service UUID, no duplicates 

noble.on('stateChange', (state)=>{
    console.log(state);
  
    if (state === 'poweredOn') {
        noble.startScanning();
    } else {
        noble.stopScanning();
    }
});

const updatesPromise = nrfDfu.DfuUpdates.fromZipFilePath('./spec/test-data/ble_app_buttonless_dfu_with_bonds_s132.zip')


noble.on('discover', function(peripheral) {
    console.log(`Found device with local name: ${peripheral.advertisement.localName}, address ${peripheral.addressType} ${peripheral.address}, service UUIDS ${peripheral.advertisement.serviceUuids}, RSSI ${peripheral.rssi}`);
//     console.log(peripheral);
//     console.log('id', peripheral.id);
//     console.log('uuid', peripheral.id);
//     console.log('advertisement', peripheral.advertisement);
//     console.log('connectable', peripheral.connectable);
//     console.log('services', peripheral.services);
    console.log();
    
    // If the device is advertising a Nordic Secure DFU (0xfe59) service...
//     if (peripheral.advertisement.serviceUuids.indexOf('fe59') !== 1){
    
    // If the device is advertiing a "DfuTest" name...
    if (peripheral.advertisement.localName === 'DfuTest'){
        noble.stopScanning();   // Stop scanning for more devices
        
        let nobleTransport = new nrfDfu.DfuTransportNoble(peripheral, 1);
        
//         nobleTransport.ready().then(()=>{
//             nobleTransport.writeCommand(new Uint8Array([0x06, 0x02]));
//             
//             nobleTransport.read().then((bytes)=>{
//                 console.log('Received: ', bytes);
//             });
//         });
        
        updatesPromise.then((updates)=>{
            let dfu = new nrfDfu.DfuOperation(updates, nobleTransport);
            dfu.start(true)
            .then(()=>{
                console.log('Seems like the DFU completed successfully!!')
            })
            .catch((err)=>{
                console.error('DFU failed. Reason:');
                console.error(err);
            })
            .then(()=>{
//                 port.close()
            });
        });
        
//         console.log('Device has a Nordic DFU BLE service; connecting...');
//         peripheral.connect(function(error) {
//             console.log('connected to peripheral: ' + peripheral.uuid);
//             peripheral.discoverServices(['fe59'], function(error, services) {
//                 var deviceInformationService = services[0];
//                 console.log('discovered device information service');
// 
//                 deviceInformationService.discoverCharacteristics(null, function(error, characteristics) {
//                     console.log('discovered the following characteristics:');
//                     for (var i in characteristics) {
//                         console.log('  ' + i + ' uuid: ' + characteristics[i].uuid);
//                     }
//                 });
//             });
//         });
    }
    
});








// noble.startScanning([], true); // any service UUID, allow duplicates 
  
// var serviceUUIDs = ["<service UUID 1>", ...]; // default: [] => all 
// var allowDuplicates = <false|true>; // default: false 
 
// noble.startScanning(serviceUUIDs, allowDuplicates[, callback(error)]); // particular UUID's 

