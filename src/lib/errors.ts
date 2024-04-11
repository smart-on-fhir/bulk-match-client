import { BulkMatchClient as Types } from "../..";

export class FileDownloadError extends Error {
  readonly code: number;
  readonly body: string | object | null;
  readonly responseHeaders: Types.ResponseHeaders;
  readonly fileUrl: string;

  constructor({
    body,
    code,
    responseHeaders,
    fileUrl,
  }: {
    code: number;
    body: string | fhir4.OperationOutcome | null; // Buffer
    responseHeaders: Types.ResponseHeaders;
    fileUrl: string;
  }) {
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
