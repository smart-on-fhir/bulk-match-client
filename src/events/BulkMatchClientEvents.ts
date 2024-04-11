import { BulkMatchClient as Types } from "../..";
import { BulkMatchClient } from "../client";
import { SmartOnFhirClientEvents } from "./SmartOnFhirClientEvents";

/**>>
 * The BulkMatchClient instances emit the following events:
 */
export interface BulkMatchClientEvents extends SmartOnFhirClientEvents {
  /**
   * Emitted when new patient match is started
   * @event
   */
  kickOffStart: (
    this: BulkMatchClient,
    requestOptions: RequestInit,
    url: string,
  ) => void;

  /**
   * Emitted when a kick-off patient match response is received
   * @event
   */
  kickOffEnd: (
    this: BulkMatchClient,
    data: {
      response: Response;
      capabilityStatement: fhir4.CapabilityStatement;
      requestOptions: object;
      responseHeaders?: object;
    },
  ) => void;

  /**
   * Emitted when a kick-off patient match response is received
   * @event
   */
  kickOffError: (this: BulkMatchClient, error: Error) => void;

  /**
   * Emitted when the patient match has began
   * @event
   */
  matchStart: (this: BulkMatchClient, status: Types.MatchStatus) => void;

  /**
   * Emitted for every status change while waiting for the patient match
   * @event
   */
  matchProgress: (this: BulkMatchClient, status: Types.MatchStatus) => void;

  matchError: (
    this: BulkMatchClient,
    details: {
      body: string | fhir4.OperationOutcome | null;
      code: number | null;
      message?: string;
      responseHeaders?: object;
    },
  ) => void;

  /**
   * Emitted when the export is completed
   * @event
   */
  matchComplete: (this: BulkMatchClient, manifest: Types.MatchManifest) => void;

  /**
   * Emitted when the download starts
   * @event
   */
  downloadStart: (
    this: BulkMatchClient,
    detail: {
      fileUrl: string;
      itemType: string;
    },
  ) => void;

  /**
   * Emitted for every file which fails to download
   * @event
   */
  downloadError: (
    this: BulkMatchClient,
    details: {
      body: string | fhir4.OperationOutcome | null; // Buffer
      code: number | null;
      fileUrl: string;
      message?: string;
      responseHeaders?: object;
    },
  ) => void;

  /**
   * Emitted when any file has been downloaded
   * @event
   */
  downloadComplete: (
    this: BulkMatchClient,
    detail: {
      fileUrl: string;
    },
  ) => void;

  /**
   * Emitted when all files have been downloaded
   * @event
   */
  allDownloadsComplete: (
    this: BulkMatchClient,
    downloads: (Types.FileDownload | PromiseRejectedResult)[],
  ) => void;
}
