import { BulkMatchClient } from ".";
import { BulkMatchClient as Types } from "../..";
import { SmartOnFhirClientEvents } from "./SmartOnFhirClientEvents";

/**
 * The BulkMatchClient instances emit the following events:
 */
export interface BulkMatchClientEvents extends SmartOnFhirClientEvents {
    /**
     * Emitted when new patient match is started
     * @event
     */
    kickOffStart: (this: BulkMatchClient, requestOptions: RequestInit, url: string) => void;

    /**
     * Emitted when a kick-off patient match response is received
     * @event
     */
    kickOffEnd: (
        this: BulkMatchClient,
        data: {
            response: Types.CustomBodyResponse<object>;
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
    jobStart: (this: BulkMatchClient, status: Types.MatchStatus) => void;

    /**
     * Emitted for every status change while waiting for the patient match
     * @event
     */
    jobProgress: (this: BulkMatchClient, status: Types.MatchStatus) => void;

    jobError: (
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
    jobComplete: (this: BulkMatchClient, manifest: Types.MatchManifest) => void;

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
        duration: number,
    ) => void;

    // Extending types for SmartOnFhir Client Events
    /**
     * Emitted every time new access token is received
     * @event
     */
    authorize: (this: BulkMatchClient, accessToken: string) => void;

    /**
     * Emitted on error
     * @event
     */
    error: (this: BulkMatchClient, error: Error) => void;

    /**
     * Emitted when the flow is aborted by the user
     * @event
     */
    abort: (this: BulkMatchClient) => void;
}
