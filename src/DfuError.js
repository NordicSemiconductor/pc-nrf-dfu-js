const debug = require('debug')('dfu:error');

export const errorCode = {
    // Error message types
    ERROR_MESSAGE: 0x00,
    ERROR_MESSAGE_RSP: 0x01,
    ERROR_MESSAGE_EXT: 0x02,

    // Error code for DfuAbstractTransport
    ERROR_CAN_NOT_INIT_ABSTRACT_TRANSPORT: 0x0000,
    ERROR_PRE_DFU_INTERRUPTED: 0x0001,
    ERROR_UNEXPECTED_BYTES: 0x0002,
    ERROR_CRC_MISMATCH: 0x0003,
    ERROR_TOO_MANY_WRITE_FAILURES: 0x0004,

    // Error code for DfuTransportPrn
    ERROR_CAN_NOT_INIT_PRN_TRANSPORT: 0x0010,
    ERROR_CAN_NOT_USE_HIGHER_PRN: 0x0011,
    ERROR_READ_CONFLICT: 0x0012,
    ERROR_TIMEOUT_READING_SERIAL: 0x0013,
    ERROR_RECEIVE_TWO_MESSAGES: 0x0014,
    ERROR_RESPONSE_NOT_START_WITH_0x60: 0x0015,
    ERROR_ASSERT_EMPTY_RESPONSE: 0x0016,
    ERROR_UNEXPECTED_RESPONSE_OPCODE: 0x0017,
    ERROR_UNEXPECTED_RESPONSE_BYTES: 0x0018,

    // Error code for DfuTransportSink
    ERROR_MUST_HAVE_PAYLOAD: 0x0031,
    ERROR_INVOKED_MISMATCHED_CRC32: 0x0032,
    ERROR_MORE_BYTES_THAN_CHUNK_SIZE: 0x0033,
    ERROR_INVALID_PAYLOAD_TYPE: 0x0034,

    // Error code for DfuTransportNoble
    ERROR_CAN_NOT_DISCOVER_DFU_CONTROL: 0x0051,
    ERROR_TIMEOUT_FETCHING_CHARACTERISTICS: 0x0052,
    ERROR_CAN_NOT_SUBSCRIBE_CHANGES: 0x0053,

    // Error code for DfuTransportSerial(including slow and usb)
    ERROR_UNKNOWN_FIRMWARE_TYPE: 0x0071,
    ERROR_UNABLE_FIND_PORT: 0x0072,

    // Error code for response error messages
    ERROR_RSP_OPCODE_MISSING_MALFORMED: 0x0100,
    ERROR_RSP_OPCODE_UNKNOWN: 0x0102,
    ERROR_RSP_PARAMETER_MISSING: 0x0103,
    ERROR_RSP_NOT_ENOUGH_MEMORY: 0x0104,
    ERROR_RSP_DATA_OBJECT_NOT_MATCH: 0x0105,
    ERROR_RSP_UNSUPPORTED_OBJECT_TYPE:0x0107,
    ERRRO_RSP_INCORRECT_STATE: 0x0108,
    ERROR_RSP_OPERATION_FAILED: 0x010A,

    // Error code for extended error messages
    ERROR_EXT_ERROR_CODE_NOT_SET: 0x0200,
    ERROR_EXT_ERROR_CODE_INCORRECT: 0x0201,
    ERROR_EXT_COMMAND_FORMAT_INCORRECT: 0x0203,
    ERROR_EXT_COMMAND_PARSED_BUT_UNKNOWN: 0x0204,
    ERROR_EXT_FIRMWARE_VERSION_LOW: 0x0205,
    ERROR_EXT_HARDWARE_VERSION_NOT_MATCH: 0x0206,
    ERROR_EXT_SOFTDEVICE_NOT_CONTAINED: 0x0207,
    ERROR_EXT_INIT_PACKT_NO_SIGNATURE: 0x0208,
    ERROR_EXT_HASH_TYPE_NOT_SUPPORT: 0x0209,
    ERROR_EXT_FIRMWARE_HASH_CAN_NOT_CALCULATED: 0x020A,
    ERROR_EXT_SIGNATURE_TYPE_NOT_SUPPORT: 0x020B,
    ERROR_EXT_FIRMWARE_HASH_NOT_MATCH: 0x020C,
    ERROR_EXT_SPACE_INSUFFICIENT: 0x020D,
    ERROR_EXT_FIRMWARE_ALREADY_PRESENT: 0x020E,
}

// Error types for errorMessages, responseErrorMessages and extendedErrorMessages
export const errorTypes = {
    [errorCode.ERROR_MESSAGE]: 'Error message',
    [errorCode.ERROR_MESSAGE_RSP]: 'Error message for known response code from DFU target',
    [errorCode.ERROR_MESSAGE_EXT]: 'Error message for known extended error code from DFU target',
}

// Error messages for pc-nrf-dfu-js
export const errorMessages = {
    [errorCode.ERROR_CAN_NOT_INIT_ABSTRACT_TRANSPORT]: 'Cannot instantiate DfuAbstractTransport, use a concrete subclass instead.',
    [errorCode.ERROR_PRE_DFU_INTERRUPTED]: 'A previous DFU process was interrupted, and it was left in such a state that cannot be continued. Please perform a DFU procedure disabling continuation.',
    [errorCode.ERROR_UNEXPECTED_BYTES]: 'Unexpected bytes to be sent.',
    [errorCode.ERROR_CRC_MISMATCH]: 'CRC mismatches.',
    [errorCode.ERROR_TOO_MANY_WRITE_FAILURES]: 'Too many write failures.',
    [errorCode.ERROR_CAN_NOT_INIT_PRN_TRANSPORT]: 'Cannot instantiate DfuTransportPrn, use a concrete subclass instead.',
    [errorCode.ERROR_CAN_NOT_USE_HIGHER_PRN]: 'DFU procotol cannot use a PRN higher than 0xFFFF.',
    [errorCode.ERROR_READ_CONFLICT]: 'DFU transport tried to read() while another read() was still waiting',
    [errorCode.ERROR_TIMEOUT_READING_SERIAL]: 'Timeout while reading from serial transport. See https://github.com/NordicSemiconductor/pc-nrfconnect-core/blob/master/doc/serial-timeout-troubleshoot.md',
    [errorCode.ERROR_RECEIVE_TWO_MESSAGES]: 'DFU transport received two messages at once',
    [errorCode.ERROR_RESPONSE_NOT_START_WITH_0x60]: 'Response from DFU target did not start with 0x60',
    [errorCode.ERROR_ASSERT_EMPTY_RESPONSE]: 'Tried to assert an empty parsed response',
    [errorCode.ERROR_UNEXPECTED_RESPONSE_OPCODE]: 'Unexpected opcode in response',
    [errorCode.ERROR_UNEXPECTED_RESPONSE_BYTES]: 'Unexpected bytes in response',
    [errorCode.ERROR_MUST_HAVE_PAYLOAD]: 'Must create/select a payload type first.',
    [errorCode.ERROR_INVOKED_MISMATCHED_CRC32]: 'Invoked with a mismatched CRC32 checksum.',
    [errorCode.ERROR_MORE_BYTES_THAN_CHUNK_SIZE]: 'Tried to push more bytes to a chunk than the chunk size.',
    [errorCode.ERROR_INVALID_PAYLOAD_TYPE]: 'Tried to select invalid payload type. Valid types are 0x01 and 0x02.',
    [errorCode.ERROR_CAN_NOT_DISCOVER_DFU_CONTROL]: 'Could not discover DFU control and packet characteristics',
    [errorCode.ERROR_TIMEOUT_FETCHING_CHARACTERISTICS]: 'Timeout while fetching characteristics from BLE peripheral',
    [errorCode.ERROR_CAN_NOT_SUBSCRIBE_CHANGES]: 'Could not subscribe to changes of the control characteristics',
    [errorCode.ERROR_UNKNOWN_FIRMWARE_TYPE]: 'Unkown firmware image type',
    [errorCode.ERROR_UNABLE_FIND_PORT]: 'Unable to find port.'
}


// Error messages for the known response codes.
// See http://infocenter.nordicsemi.com/index.jsp?topic=%2Fcom.nordic.infocenter.sdk5.v14.2.0%2Fgroup__nrf__dfu__rescodes.html
// as well as the response codes at
// http://infocenter.nordicsemi.com/index.jsp?topic=%2Fcom.nordic.infocenter.sdk5.v14.2.0%2Flib_dfu_transport_serial.html

export const responseErrorMessages = {
    [errorCode.ERROR_RSP_OPCODE_MISSING_MALFORMED]: 'Missing or malformed opcode.',
    //  0x01: success
    [errorCode.ERROR_RSP_OPCODE_UNKNOWN]: 'Opcode unknown or not supported.',
    [errorCode.ERROR_RSP_PARAMETER_MISSING]: 'A parameter for the opcode was missing.',
    [errorCode.ERROR_RSP_NOT_ENOUGH_MEMORY]: 'Not enough memory for the data object.',
    // 0x05 should not happen. Bootloaders starting from late 2017 and later will
    // use extended error codes instead.
    [errorCode.ERROR_RSP_DATA_OBJECT_NOT_MATCH]: 'The data object didn\'t match firmware/hardware, or missing crypto signature, or malformed protocol buffer, or command parse failed.',
    //  0x06: missing from the spec
    [errorCode.ERROR_RSP_UNSUPPORTED_OBJECT_TYPE]: 'Unsupported object type for create/read operation.',
    [errorCode.ERRRO_RSP_INCORRECT_STATE]: 'Cannot allow this operation in the current DFU state.',
    //  0x09: missing from the spec
    [errorCode.ERROR_RSP_OPERATION_FAILED]: 'Operation failed.',
//  0x0B: extended error, will read next byte from the response and use it as extended error code
};


// Error messages for the known extended error codes.
// See http://infocenter.nordicsemi.com/index.jsp?topic=%2Fcom.nordic.infocenter.sdk5.v14.2.0%2Fgroup__sdk__nrf__dfu__transport.html
export const extendedErrorMessages = {
    [errorCode.ERROR_EXT_ERROR_CODE_NOT_SET]: 'An error happened, but its extended error code hasn\'t been set.',
    [errorCode.ERROR_EXT_COMMAND_FORMAT_INCORRECT]: 'An error happened, but its extended error code is incorrect.',
    // Extended 0x02 should never happen, because responses 0x02 and 0x03
    // should cover all possible incorrect inputs
    [errorCode.ERROR_EXT_COMMAND_PARSED_BUT_UNKNOWN]: 'The format of the command was incorrect.',
    [errorCode.ERROR_EXT_COMMAND_FORMAT_INCORRECT]: 'Command successfully parsed, but it is not supported or unknown.',
    [errorCode.ERROR_EXT_COMMAND_PARSED_BUT_UNKNOWN]: 'The init command is invalid. The init packet either has an invalid update type or it is missing required fields for the update type (for example, the init packet for a SoftDevice update is missing the SoftDevice size field).',
    [errorCode.ERROR_EXT_FIRMWARE_VERSION_LOW]: 'The firmware version is too low. For an application, the version must be greater than the current application. For a bootloader, it must be greater than or equal to the current version. This requirement prevents downgrade attacks.',
    [errorCode.ERROR_EXT_HARDWARE_VERSION_NOT_MATCH]: 'The hardware version of the device does not match the required hardware version for the update.',
    [errorCode.ERROR_EXT_SOFTDEVICE_NOT_CONTAINED]: 'The array of supported SoftDevices for the update does not contain the FWID of the current SoftDevice.',
    [errorCode.ERROR_EXT_INIT_PACKT_NO_SIGNATURE]: 'The init packet does not contain a signature. This bootloader requires DFU updates to be signed.',
    [errorCode.ERROR_EXT_SIGNATURE_TYPE_NOT_SUPPORT]: 'The hash type that is specified by the init packet is not supported by the DFU bootloader.',
    [errorCode.ERROR_EXT_FIRMWARE_HASH_CAN_NOT_CALCULATED]: 'The hash of the firmware image cannot be calculated.',
    [errorCode.ERROR_EXT_HASH_TYPE_NOT_SUPPORT]: 'The type of the signature is unknown or not supported by the DFU bootloader.',
    [errorCode.ERROR_EXT_FIRMWARE_HASH_NOT_MATCH]: 'The hash of the received firmware image does not match the hash in the init packet.',
    [errorCode.ERROR_EXT_SPACE_INSUFFICIENT]: 'The available space on the device is insufficient to hold the firmware.',
    [errorCode.ERROR_EXT_FIRMWARE_ALREADY_PRESENT]: 'The requested firmware to update was already present on the system.',
};

/**
 * Error class for DFU
 */
export default class DfuError extends Error {
    constructor(code, message = undefined) {
        super()
        this.code = code;
        this.message = this.getErrorMessage(code);
        if (message) {
            this.message += ` ${message}`;
        }
    }

    getErrorMessage(code) {
        let errorMsg;
        const errorType = code >> 8;
        const errorCode = code - (errorType << 8);

        debug(`Error type is ${errorType}.`);
        debug(`Error code is ${errorCode}.`);

        errorMsg = errorTypes[errorType];
        if (!errorMsg) {
            throw new Error('Error type is unknown.');
        }

        errorMsg += ': ';
        switch (errorType) {
            case 0x00:
                debug('This is an error message.');
                errorMsg += errorMessages[errorCode];
                break;
            case 0x01:
                debug('This is a response error message.');
                errorMsg += responseErrorMessages[errorCode];
                break;
            case 0x02:
                debug('This is an extended error message.');
                errorMsg += extendedErrorMessages[errorCode];
                break;
            default:
                debug('This is an unknown error message.');
        }

        return errorMsg;
    }
}
