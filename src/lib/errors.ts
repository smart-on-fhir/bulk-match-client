import { BulkMatchClient as Types } from "../..";
import { displayCodeableConcept } from "./utils";

type FileDownloadErrorArgs = {
  code: number;
  body: string | fhir4.OperationOutcome | null; // Buffer
  responseHeaders: Types.ResponseHeaders;
  fileUrl: string;
};
export class FileDownloadError extends Error {
  readonly code: number;
  readonly body: string | object | null;
  readonly responseHeaders: Types.ResponseHeaders;
  readonly fileUrl: string;

  constructor({ body, code, responseHeaders, fileUrl }: FileDownloadErrorArgs) {
    super(
      `Downloading the file from ${fileUrl} returned HTTP status code ${code}.${
        body ? " Body: " + JSON.stringify(body) : ""
      }`,
    );

    this.code = code;
    this.body = body;
    this.responseHeaders = responseHeaders;
    this.fileUrl = fileUrl;

    Error.captureStackTrace(this, this.constructor);
  }
}

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
