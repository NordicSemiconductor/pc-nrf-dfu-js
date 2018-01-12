

// Error messages for the known response codes.
// See http://infocenter.nordicsemi.com/index.jsp?topic=%2Fcom.nordic.infocenter.sdk5.v14.2.0%2Fgroup__nrf__dfu__rescodes.html
// as well as the response codes at
// http://infocenter.nordicsemi.com/index.jsp?topic=%2Fcom.nordic.infocenter.sdk5.v14.2.0%2Flib_dfu_transport_serial.html

export const errorMessages = {
    0x00: 'Missing or malformed opcode',
    //  0x01: success
    0x02: 'Opcode unknown or not supported',
    0x03: 'A parameter for the opcode was missing',
    0x04: 'Not enough memory for the data object',

    // 0x05 should not happen. Bootloaders starting from late 2017 and later will
    // use extended error codes instead.
    0x05: 'The data object didn\'t match firmware/hardware, or missing crypto signature, or malformed protocol buffer, or command parse failed',

    //  0x06: missing from the spec
    0x07: 'Unsupported object type for create/read operation',
    0x08: 'Cannot allow this operation in the current DFU state',
    //  0x09: missing from the spec
    0x0A: 'Operation failed',
//  0x0B: extended error, will read next byte from the response and use it as extended error code
};


// Error messages for the known extended error codes.
// See http://infocenter.nordicsemi.com/index.jsp?topic=%2Fcom.nordic.infocenter.sdk5.v14.2.0%2Fgroup__sdk__nrf__dfu__transport.html
export const extendedErrorMessages = {
    0x00: 'An error happened, but it\'s extended error code hasn\'t been set.',
    0x01: 'An error happened, but it\'s extended error code is incorrect.',

    // Extended 0x02 should never happen, because responses 0x02 and 0x03
    // should cover all possible incorrect inputs
    0x02: 'The format of the command was incorrect.',

    0x03: 'Command successfully parsed, but it is not supported or unknown.',
    0x04: 'The init command is invalid. The init packet either has an invalid update type or it is missing required fields for the update type (for example, the init packet for a SoftDevice update is missing the SoftDevice size field).',
    0x05: 'The firmware version is too low. For an application, the version must be greater than the current application. For a bootloader, it must be greater than or equal to the current version. This requirement prevents downgrade attacks.',
    0x06: 'The hardware version of the device does not match the required hardware version for the update.',
    0x07: 'The array of supported SoftDevices for the update does not contain the FWID of the current SoftDevice.',
    0x08: 'The init packet does not contain a signature. This bootloader requires DFU updates to be signed.',
    0x09: 'The hash type that is specified by the init packet is not supported by the DFU bootloader.',
    0x0A: 'The hash of the firmware image cannot be calculated.',
    0x0B: 'The type of the signature is unknown or not supported by the DFU bootloader.',
    0x0C: 'The hash of the received firmware image does not match the hash in the init packet.',
    0x0D: 'The available space on the device is insufficient to hold the firmware.',
    0x0E: 'The requested firmware to update was already present on the system.',
};

