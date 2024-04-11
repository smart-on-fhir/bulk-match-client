import { BulkMatchClient as Types } from "../..";
import {
  SmartOnFhirClientType,
  SmartOnFhirClientEvents,
} from "./SmartOnFhirClient.types";

export interface BulkMatchClientType extends SmartOnFhirClientType {
  on<U extends keyof BulkMatchClientEvents>(
    event: U,
    listener: BulkMatchClientEvents[U],
  ): this;

  emit<U extends keyof BulkMatchClientEvents>(
    event: U,
    ...args: Parameters<BulkMatchClientEvents[U]>
  ): boolean;

  off<U extends keyof BulkMatchClientEvents>(
    event: U,
    listener: BulkMatchClientEvents[U],
  ): this;
}

/**>>
 * The BulkMatchClient instances emit the following events:
 */
export interface BulkMatchClientEvents extends SmartOnFhirClientEvents {
  /**
   * Emitted when new patient match is started
   * @event
   */
  kickOffStart: (
    this: BulkMatchClientType,
    requestOptions: RequestInit,
    url: string,
  ) => void;

  /**
   * Emitted when a kick-off patient match response is received
   * @event
   */
  kickOffEnd: (
    this: BulkMatchClientType,
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
  kickOffError: (this: BulkMatchClientType, error: Error) => void;

  /**
   * Emitted when the patient match has began
   * @event
   */
  matchStart: (this: BulkMatchClientType, status: Types.MatchStatus) => void;

  /**
   * Emitted for every status change while waiting for the patient match
   * @event
   */
  matchProgress: (this: BulkMatchClientType, status: Types.MatchStatus) => void;

  matchError: (
    this: BulkMatchClientType,
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
  matchComplete: (
    this: BulkMatchClientType,
    manifest: Types.MatchManifest,
  ) => void;

  /**
   * Emitted when the download starts
   * @event
   */
  downloadStart: (
    this: BulkMatchClientType,
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
    this: BulkMatchClientType,
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
    this: BulkMatchClientType,
    detail: {
      fileUrl: string;
    },
  ) => void;

  /**
   * Emitted when all files have been downloaded
   * @event
   */
  allDownloadsComplete: (
    this: BulkMatchClientType,
    downloads: (Types.FileDownload | PromiseRejectedResult)[],
  ) => void;
}
