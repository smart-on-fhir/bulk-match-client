"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestError = exports.InvalidNdjsonError = exports.UnknownResourceStringError = exports.OperationOutcomeError = void 0;
const utils_1 = require("./utils");
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
class UnknownResourceStringError extends Error {
    constructor({ resource, errorMessage }) {
        super(`Attempted parsing of ${resource} as a resource led to the following error: ${errorMessage}. Without a valid resource, we cannot proceed`);
        this.resource = resource;
        this.errorMessage = errorMessage;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.UnknownResourceStringError = UnknownResourceStringError;
class InvalidNdjsonError extends Error {
    constructor({ resource, errorMessage }) {
        super(`Attempted parsing of ${resource} as ndjson led to the following error: ${errorMessage}. Without a valid resource, we cannot proceed`);
        this.resource = resource;
        this.errorMessage = errorMessage;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.InvalidNdjsonError = InvalidNdjsonError;
class RequestError extends Error {
    constructor({ res, method }) {
        const url = res.response.url;
        const status = res.response.status;
        const statusText = res.response.statusText;
        const responseHeaders = res.response.headers;
        const body = res.body;
        super(`${method || "GET"} ${url} FAILED with ` +
            `${status}` +
            `${statusText ? ` and message ${statusText}` : ""}.` +
            `${body ? " Body: " + (0, utils_1.stringifyBody)(body) : ""}`);
        this.method = method;
        this.url = url;
        this.status = status;
        this.statusText = statusText;
        this.responseHeaders = responseHeaders;
        this.body = body;
    }
}
exports.RequestError = RequestError;
