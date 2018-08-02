const { errorTypes, errorMessages, responseErrorMessages, extendedErrorMessages } = require('./DfuErrorConstants');

/**
 * Error class for DFU
 */
export default class DfuError extends Error {
    constructor(errorCode) {
        this.code = errorCode;
        super(this.getErrorMessage(errorCode));
    }

    getErrorMessage(code) {
        let errorMsg;
        const errorType = code >> 8;
        const errorCode = code - errorType;

        errorMsg = errorTypes[errorType];
        errorMsg += ': ';
        switch (errorType) {
            case 0x00:
                errorMsg += errorMessages[errorCode];
                break;
            case 0x01:
                errorMsg += errorResponseMessages[errorCode];
                break;
            case 0x00:
                errorMsg += errorExtendedMessages[errorCode];
                break;
        }

        return errorMsg;
    }
}
