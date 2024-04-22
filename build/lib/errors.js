"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationOutcomeError = exports.FileDownloadError = void 0;
const utils_1 = require("./utils");
class FileDownloadError extends Error {
    constructor({ body, code, responseHeaders, fileUrl }) {
        super(`Downloading the file from ${fileUrl} returned HTTP status code ${code}.${body ? " Body: " + JSON.stringify(body) : ""}`);
        this.code = code;
        this.body = body;
        this.responseHeaders = responseHeaders;
        this.fileUrl = fileUrl;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.FileDownloadError = FileDownloadError;
class OperationOutcomeError extends Error {
    constructor({ res }) {
        const url = res.response.url;
        const operationOutcome = res.body;
        const operationOutcomeSeverity = operationOutcome.issue[0].severity;
        const operationOutcomeCode = operationOutcome.issue[0].code;
        const operationOutcomeDetails = operationOutcome.issue[0].details
            ? (0, utils_1.displayCodeableConcept)(operationOutcome.issue[0].details)
            : "";
        super(`Request to ${url} led to OperationOutcome with severity ${operationOutcomeSeverity} and code ${operationOutcomeCode}.${operationOutcomeDetails
            ? " Details: " + JSON.stringify(operationOutcomeDetails)
            : ""}`);
        this.url = url;
        this.operationOutcomeSeverity = operationOutcomeSeverity;
        this.operationOutcomeCode = operationOutcomeCode;
        this.operationOutcomeDetails = operationOutcomeDetails;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.OperationOutcomeError = OperationOutcomeError;
