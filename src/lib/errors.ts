import { BulkMatchClient as Types } from "../..";
import { displayCodeableConcept } from "./utils";

/**
 * For throwing operationOutcome-related information as an error
 */
type OperationOutcomeErrorArgs = {
    res: Types.CustomBodyResponse<fhir4.OperationOutcome>;
};

export class OperationOutcomeError extends Error {
    readonly url: string;
    readonly operationOutcomeSeverity: string;
    readonly operationOutcomeCode: string;
    readonly operationOutcomeDetails?: string;

    constructor({ res }: OperationOutcomeErrorArgs) {
        const url = res.response.url;
        const operationOutcome = res.body as fhir4.OperationOutcome;
        const operationOutcomeSeverity = operationOutcome.issue[0].severity;
        const operationOutcomeCode = operationOutcome.issue[0].code;
        const operationOutcomeDetails = operationOutcome.issue[0].details
            ? displayCodeableConcept(operationOutcome.issue[0].details)
            : "";
        super(
            `Request to ${url} led to OperationOutcome with severity ${operationOutcomeSeverity} and code ${operationOutcomeCode}.${
                operationOutcomeDetails
                    ? " Details: " + JSON.stringify(operationOutcomeDetails)
                    : ""
            }`,
        );

        this.url = url;
        this.operationOutcomeSeverity = operationOutcomeSeverity;
        this.operationOutcomeCode = operationOutcomeCode;
        this.operationOutcomeDetails = operationOutcomeDetails;

        Error.captureStackTrace(this, this.constructor);
    }
}

/////////////////////////////////////////////
// Resource Option Parsing Errors
/////////////////////////////////////////////

/**
 * When an unknown string resource type is provided to resource parsing
 */
type UnknownResourceStringErrorArgs = {
    resource: string;
    errorMessage: string;
};

export class UnknownResourceStringError extends Error {
    readonly resource: string;
    readonly errorMessage: string;

    constructor({ resource, errorMessage }: UnknownResourceStringErrorArgs) {
        super(
            `Attempted parsing of ${resource} as a resource led to the following error: ${errorMessage}. Without a valid resource, we cannot proceed`,
        );
        this.resource = resource;
        this.errorMessage = errorMessage;

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * When an invalid NDJSON string is provided to parse
 */
type InvalidNdjsonErrorArgs = {
    resource: string;
    errorMessage: string;
};

export class InvalidNdjsonError extends Error {
    readonly resource: string;
    readonly errorMessage: string;

    constructor({ resource, errorMessage }: InvalidNdjsonErrorArgs) {
        super(
            `Attempted parsing of ${resource} as ndjson led to the following error: ${errorMessage}. Without a valid resource, we cannot proceed`,
        );
        this.resource = resource;
        this.errorMessage = errorMessage;

        Error.captureStackTrace(this, this.constructor);
    }
}
