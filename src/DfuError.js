import { errorTypes, errorMessages, responseErrorMessages, extendedErrorMessages } from './DfuErrorConstants';

const debug = require('debug')('dfu:error');

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
