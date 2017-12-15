
import DfuTransportPrn from './DfuTransportPrn';

// FIXME: Should be `import {crc32} from 'crc'`, https://github.com/alexgorbatchev/node-crc/pull/50
// import * as crc from 'crc';
// const crc32 = crc.crc32;
// import {crc32} from 'crc';
// import crc32 from 'crc/src/crc32';

const debug = require('debug')('dfu:noble');

// const noble = require('noble');

/**
 * noble DFU transport.
 * 
 * 'noble' means "NOde Bluetooth Low Energy". The use case for this transport
 * is running it on a linux/MacOSX/windows host, which must have a BLE adapter itself.
 * See https://github.com/sandeepmistry/noble/blob/master/README.md
 * 
 * The "noble" transport must be given an instance of noble's "peripheral" when instantiated.
 */

export default class DfuTransportNoble extends DfuTransportPrn {
    constructor(peripheral, packetReceiveNotification = 16) {
        super(packetReceiveNotification);

        this._peripheral = peripheral;
        
        // These will be populated when connecting to the BLE peripheral
        this._dfuControlCharacteristic = undefined;
        this._dfuPacketCharacteristic = undefined;
        
        // Hard-coded BLE MTU
        this._mtu = 23;
    }


    // Given a command (including opcode), perform SLIP encoding and send it
    // through the wire.
    _writeCommand(bytes) {
        // Cast the Uint8Array info a Buffer so it works on nodejs v6
        bytes = new Buffer(bytes);
        debug(' ctrl --> ', bytes);

        
        return new Promise((res, rej)=>{
            setTimeout(()=>{

//                 this._dfuControlCharacteristic.once('write', ()=> {
//                     debug(' wire --> ', bytes);
//                     res();
//                 })

                this._dfuControlCharacteristic.write(bytes, false, (err)=>{
                    if (err) {
                        rej(err);
                    } else {
                        res();
                    }
                });
                
            }, 100);
        });
    }

    // Given some payload bytes, pack them into a 0x08 command.
    // The length of the bytes is guaranteed to be under this._mtu thanks
    // to the DfuTransportPrn functionality.
    _writeData(bytes) {
        // Cast the Uint8Array info a Buffer so it works on nodejs v6
        bytes = new Buffer(bytes);
        debug(' data --> ', bytes);
        
        return new Promise((res, rej)=>{
//             setTimeout(()=>{
            
//                 this._dfuPacketCharacteristic.once('write', ()=> {
//                     debug(' wire --> ', bytes);
//                     res();
//                 })
            
                this._dfuPacketCharacteristic.write(bytes, true, (err)=>{
                    if (err) {
                        rej(err);
                    } else {
                        res();
                    }
                });
//             }, 50);
        });
    }

//     _read() {
//         return new Promise((res, rej)=>{
//             this._dfuControlCharacteristic.read((err, data)=>{
//                 if (err) {
//                     rej(err);
//                 } else {
//         debug(' recv <-- ', data);
//                     res(this._parse(data));
//                 }
//             });
//         });
//     }
    
    // Called whenever the control characteristic sends some bytes back
//     _onData(bytes) {
//         debug('Got data: ', bytes);
//     }
//     
    // Aux. Connects to this._peripheral, discovers services and characteristics, 
    // and stores a reference into this._dfuControlCharacteristic and this._dfuPacketCharacteristic
    _getCharacteristics() {
        return new Promise((res, rej)=>{
            this._peripheral.connect((err)=>{
                if (err) {
                    return rej(err);
                }
                
                debug('Instantiating noble transport to: ', this._peripheral);
                
                this._peripheral.discoverServices(['fe59'], (err1, [dfuService])=>{
                    if (err1) { 
                        return rej(err1); 
                    }
                    debug('discovered dfuService');

                    dfuService.discoverCharacteristics(null, (err2, characteristics)=>{
                        if (err2) { 
                            return rej(err2); 
                        }
                        debug('discovered the following characteristics:');
                        for (var i in characteristics) {
                            debug('  ' + i + ' uuid: ' + characteristics[i].uuid);
                            
                            if (characteristics[i].uuid === '8ec90001f3154f609fb8838830daea50') {
                                this._dfuControlCharacteristic = characteristics[i];
//                                 debug(characteristics[i]);
                                
                            }
                            if (characteristics[i].uuid === '8ec90002f3154f609fb8838830daea50') {
                                this._dfuPacketCharacteristic = characteristics[i];
//                                 debug(characteristics[i]);
                            }
                        }
                        if (this._dfuControlCharacteristic && this._dfuPacketCharacteristic) {
                            return res();
                        } else {
                            return rej('Could not discover DFU control and packet characteristics')
                        }
                    });
                });
            });
        });
    }
    
    // Opens the port, sets the PRN, requests the MTU.
    // Returns a Promise when initialization is done.
    _ready() {
        if (this._readyPromise) {
            return this._readyPromise;
        }

        return this._readyPromise = Promise.race([
            this._getCharacteristics(),
            new Promise((res, rej)=>{ setTimeout(()=>rej('Timeout while fetching characteristics from BLE peripheral'), 500) })
        ])
        .then(()=>{
            // Subscribe to notifications on the control characteristic
            debug('control characteristic:', this._dfuControlCharacteristic.uuid, this._dfuControlCharacteristic.properties);
            
            return new Promise((res, rej)=>{
                debug('Subscribing to notifications on the ctrl characteristic');
                this._dfuControlCharacteristic.subscribe((err)=>{
                    if (err) { 
                        return rej('Could not subscribe to changes of the control characteristics'); 
                    }
//                     this._dfuControlCharacteristic.on('data', this._onData.bind(this));
                    this._dfuControlCharacteristic.on('data', (data)=>{
            debug(' recv <-- ', data);
                        return this._onData(data);
                    });
                    return res();
                });
            })
        })
        .then(()=>{
            // Set the PRN value
            return this._writeCommand(new Uint8Array([
                0x02,  // "Set PRN" opcode
                this._prn >> 0 & 0xFF, // PRN LSB
                this._prn >> 8 & 0xFF, // PRN MSB
            ]))
            .then(this._read.bind(this))
            .then(this._assertPacket(0x02, 0));
        });

                    

//                 // Set PRN
//                 let result = this._writeCommand(new Uint8Array([
//                     0x02,  // "Set PRN" opcode
//                     this._prn >> 0 & 0xFF, // PRN LSB
//                     this._prn >> 8 & 0xFF, // PRN MSB
//                 ]))
//                 .then(this._read.bind(this))
//                 .then(this._assertPacket(0x02, 0))
//                 // Request MTU
//                 .then(()=>this._writeCommand(new Uint8Array([
//                     0x07    // "Request serial MTU" opcode
//                 ])))
//                 .then(this._read.bind(this))
//                 .then(this._assertPacket(0x07, 2))
//                 .then((bytes)=>{
// //                     debug('Got MTU: ', bytes);
// 
//                     let mtu =
//                         bytes[1] * 256 +
//                         bytes[0];
// 
//                     // Convert wire MTU into max size of SLIP-decoded data:
//                     this._mtu = Math.floor((mtu / 2) - 2);
// debug(`Wire MTU: ${mtu}; un-encoded data max size: ${this._mtu}`);
//                 });

//                 return res(result);
//                 return res();
//         });
    }
}




