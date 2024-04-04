import { debuglog } from "util";
import { URL, fileURLToPath } from "url";
import { basename, join, resolve, sep } from "path";
import { default as fsPromises} from "fs/promises";
import { existsSync, statSync, mkdirSync } from "fs";
import FileDownload from "./FileDownload";
import { FileDownloadError } from "../lib/errors";
import { BulkMatchClient as Types } from "../..";
import {
    assert,
    formatDuration,
    getCapabilityStatement,
    wait,
} from "../lib/utils";
import { FhirResource } from "fhir/r4";
import SmartOnFhirClient, {
    SmartOnFhirClientEvents,
} from "./SmartOnFhirClient";


const debug = debuglog("bulk-match-client");

/**>>
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
            response: Response;
            capabilityStatement: fhir4.CapabilityStatement;
            responseHeaders?: object;
        }
    ) => void;

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
        }
    ) => void;

    /**
     * Emitted when the export is completed
     * @event
     */
    matchComplete: (
        this: BulkMatchClient,
        manifest: Types.MatchManifest
    ) => void;

    /**
     * Emitted when the download starts
     * @event
     */
    downloadStart: (
        this: BulkMatchClient,
        detail: {
            fileUrl: string;
            itemType: string;
        }
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
        }
    ) => void;

    /**
     * Emitted when any file has been downloaded
     * @event
     */
    downloadComplete: (
        this: BulkMatchClient,
        detail: {
            fileUrl: string;
        }
    ) => void;

    /**
     * Emitted when all files have been downloaded
     * @event
     */
    allDownloadsComplete: (
        this: BulkMatchClient,
        downloads: (Types.FileDownload | PromiseRejectedResult)[]
    ) => void;
}

interface BulkMatchClient extends SmartOnFhirClient {
    on<U extends keyof BulkMatchClientEvents>(
        event: U,
        listener: BulkMatchClientEvents[U]
    ): this;
    // on(event: string, listener: Function): this;

    emit<U extends keyof BulkMatchClientEvents>(
        event: U,
        ...args: Parameters<BulkMatchClientEvents[U]>
    ): boolean;
    // emit(event: string, ...args: any[]): boolean;

    off<U extends keyof BulkMatchClientEvents>(
        event: U,
        listener: BulkMatchClientEvents[U]
    ): this;
    // on(event: string, listener: Function): this;
}

/**
 * This class provides all the methods needed for making Bulk Data exports and
 * downloading data fom bulk data capable FHIR server.
 *
 * **Example:**
 * ```ts
 * const client = new Client({ ...options })
 *
 * // Start an export and get the status location
 * const statusEndpoint = await client.kickOff()
 *
 * // Wait for the export and get the manifest
 * const manifest = await client.waitForExport(statusEndpoint)
 *
 * // Download everything in the manifest
 * const downloads = await client.downloadFiles(manifest)
 * ```
 */
class BulkMatchClient extends SmartOnFhirClient {
    /**
     * Makes the kick-off request for Patient Match and resolves with the status endpoint URL
     */
    public async kickOff(): Promise<string> {
        const { fhirUrl, lenient } = this.options;

        const url = new URL("Patient/$bulk-match", fhirUrl);

        let capabilityStatement: any;
        try {
            capabilityStatement = await getCapabilityStatement(fhirUrl);
        } catch {
            capabilityStatement = {};
        }

        const requestOptions: RequestInit = {
            headers: {
                "Content-Type": "application/json",
                accept: "application/fhir+ndjson",
                prefer: `respond-async`,
                // TODO: Add back in lenient? Server needs to be flexible in parsing the prefer header
                // prefer: `respond-async${lenient ? ", handling=lenient" : ""}`
            },
        };

        requestOptions.method = "POST";
        // Body must be stringified
        requestOptions.body = JSON.stringify(this.buildKickoffPayload());

        this.emit("kickOffStart", requestOptions, String(url))

        return this._request(
            url,
            requestOptions,
            "kick-off patient match request"
        )
            .then((res) => {
                const location = res.headers.get("content-location");
                if (!location) {
                    throw new Error(
                        "The kick-off patient match response did not include content-location header"
                    );
                }
                this.emit("kickOffEnd", {
                    response: res,
                    capabilityStatement,
                    responseHeaders: this._formatResponseHeaders(res.headers),
                });
                return location;
            })
            .catch((error) => {
                this.emit("kickOffEnd", {
                    response: error.response || {},
                    capabilityStatement,
                    responseHeaders: this._formatResponseHeaders(
                        error.response.headers
                    ),
                });
                throw error;
            });
    }

    /**
     * Build a POST-request JSON payload for a bulk match request
     * @returns
     */
    protected buildKickoffPayload(): fhir4.Parameters {
        const parameters: fhir4.ParametersParameter[] = [];

        // _outputFormat ----------------------------------------------------------
        if (this.options._outputFormat) {
            parameters.push({
                name: "_outputFormat",
                valueString: this.options._outputFormat,
            });
        }

        // resources --------------------------------------------------------------
        let resources = JSON.parse(this.options.resources);
        if (!Array.isArray(resources)) {
            resources = [resources];
        }
        resources.forEach((res: FhirResource) => {
            parameters.push({
                name: "resource",
                // TODO - handle more than inlined JSON
                resource: res,
            });
        });

        // onlySingleMatch ---------------------------------------------------------------
        if (this.options.onlySingleMatch) {
            parameters.push({
                name: "onlySingleMatch",
                valueBoolean: Boolean(this.options.onlySingleMatch),
            });
        }

        // onlyCertainMatches -----------------------------------------------------------
        if (this.options.onlyCertainMatches) {
            parameters.push({
                name: "onlyCertainMatches",
                valueBoolean: Boolean(this.options.onlyCertainMatches),
            });
        }

        // count -------------------------------------------------------------
        if (this.options.count) {
            parameters.push({
                name: "count",
                valueInteger: parseInt(String(this.options.count), 10),
            });
        }

        return {
            resourceType: "Parameters",
            parameter: parameters,
        };
    }

    /**
     * Handle the completed workflow of MatchStatus requests
     * @param status The MatchStatus
     * @param res The completed response from the relevant statusEndpoint
     * @returns A Promise resolving to a MatchManifest
     */
    private async _statusCompleted(status: Types.MatchStatus, res: Response) : Promise<Types.MatchManifest> { 
        const now = Date.now();
        const elapsedTime = now - status.startedAt;
        status.completedAt = now;
        status.percentComplete = 100;
        status.nextCheckAfter = -1;
        status.message = `Patient Match completed in ${formatDuration(
            elapsedTime
        )}`;

        this.emit("matchProgress", { ...status, virtual: true });
        let body = '';
        try {
            // This should throw a TypeError if the response is not parsable as JSON
            // TODO: Add more checks here based on return type of match operation
            body = (await res.text());
            debug('statusCompleted no problem!')
            debug(body)
            assert(body !== null, "No match manifest returned");
            // expect(body.output, "The match manifest output is not an array").to.be.an.array();
            // expect(body.output, "The match manifest output contains no files").to.not.be.empty()
            this.emit("matchComplete", JSON.parse(body));
        } catch (ex) {
            debug("StatusCompleted In ERROR ")
            debug(body)
            this.emit("matchError", {
                body: (body as any) || null,
                code: res.status || null,
                message: (ex as Error).message,
                responseHeaders: this._formatResponseHeaders(
                    res.headers
                ),
            });
            throw ex;
        }
        return JSON.parse(body) as Types.MatchManifest;
    }

    /**
     * Handle the pending workflow of MatchStatus requests, tracking metadata, calculating wait-time delays
     * and recursively calling checkStatus again
     * @param status The MatchStatus
     * @param statusEndpoint The endpoint against which statusRequests are made; needed to recursively call checkStatus
     * @param res The pending response from statusEndpoint
     * @returns A promise that waits, then invokes checkStatus again, ultimately resolving to a MatchManifest (or throwing an error) 
     */
    private async _statusPending(status: Types.MatchStatus, statusEndpoint: string, res: Response): Promise<Types.MatchManifest> { 
        const now = Date.now();
        const elapsedTime = now - status.startedAt;

        const progress = String(
            res.headers.get("x-progress") || ""
        ).trim();
        const retryAfter = String(
            res.headers.get("retry-after") || ""
        ).trim();
        const progressPct = parseInt(progress, 10);

        let retryAfterMSec = this.options.retryAfterMSec;
        if (retryAfter) {
            if (retryAfter.match(/\d+/)) {
                retryAfterMSec = parseInt(retryAfter, 10) * 1000;
            } else {
                let d = new Date(retryAfter);
                retryAfterMSec = Math.ceil(d.getTime() - now);
            }
        }

        const poolDelay = Math.min(
            Math.max(retryAfterMSec, 100),
            1000 * 60
        );

        Object.assign(status, {
            percentComplete: isNaN(progressPct) ? -1 : progressPct,
            nextCheckAfter: poolDelay,
            message: isNaN(progressPct)
                ? `Patient Match: in progress for ${formatDuration(
                        elapsedTime
                    )}${
                        progress
                            ? ". Server message: " + progress
                            : ""
                    }`
                : `Patient Match: ${progressPct}% complete in ${formatDuration(
                        elapsedTime
                    )}`,
        });

        this.emit("matchProgress", {
            ...status,
            retryAfterHeader: retryAfter,
            xProgressHeader: progress,
            body: res.body,
        });

        return wait(poolDelay, this.abortController.signal).then(
            () => this.checkStatus(status, statusEndpoint)
        );
    }

    /**
     * Produce the error to throw when MatchStatus requests produce an unexpected response status
     * @param status The MatchStatus
     * @param res The statusEndpoint response
     * @returns An error to be thrown 
     */
    private async _statusError(status: Types.MatchStatus, res: Response): Promise<Error>{ 
        const msg = `Unexpected status response ${res.status} ${res.statusText}`;
        const body = await res.text()
        this.emit("matchError", {
            body: (body as any) || null,
            code: res.status || null,
            message: msg,
            responseHeaders: this._formatResponseHeaders(
                res.headers
            ),
        });

        const error = new Error(msg);
        // @ts-ignore
        error.body = (body as any) || null;
        return error;
    }

    /**
     * A indirectly recursive method for making status requests and handling completion, pending and error cases
     * @param status The MatchStatus up to this point
     * @param statusEndpoint The statusEndpoint where we check on the status of the match request
     * @returns A Promise resolving to a MatchManifest (or throws an error)
     */
    public async checkStatus(status: Types.MatchStatus, statusEndpoint: string) : Promise<Types.MatchManifest> { 
        debug('Making a status call')
        return this._request(
            statusEndpoint,
            {
                headers: {
                    accept: "application/json, application/fhir+ndjson",
                },
            },
            "status request"
        ).then(async (res: Response) => {
            const now = Date.now();
            const elapsedTime = now - status.startedAt;

            status.elapsedTime = elapsedTime;

            // match is complete
            if (res.status === 200) {
                debug('COMPLETED STATUS REQUEST, RETURNING AFTER PARSING RESPONSE')
                return this._statusCompleted(status, res)
            }

            // match is in progress
            if (res.status === 202) {
                return this._statusPending(status, statusEndpoint, res)
            } 
            // Match Error - await the error then throw it
            else {
                throw await this._statusError(status, res)
            }
        });
    }

    /**
     * Waits for the patient match to be completed and resolves with the export
     * manifest when done. Emits one "matchStart", multiple "matchProgress"
     * and one "matchComplete" events.
     *
     * If the server replies with "retry-after" header we will use that to
     * compute our pooling frequency, but the next pool will be scheduled for
     * not sooner than 1 second and not later than 10 seconds from now.
     * Otherwise, the default pooling frequency is 1 second.
     */
    public async waitForMatch(
        statusEndpoint: string
    ): Promise<Types.MatchManifest> {
        debug("Waiting for match to complete, making status requests")
        const status = {
            startedAt: Date.now(),
            completedAt: -1,
            elapsedTime: 0,
            percentComplete: -1,
            nextCheckAfter: 1000,
            message: "Patient Match started",
            xProgressHeader: "",
            retryAfterHeader: "",
            statusEndpoint,
        };

        this.emit("matchStart", status);

        return this.checkStatus(status, statusEndpoint);
    }

    /**
     * Download all the ndsjson files specified in the match-response's manifest
     * @param manifest
     * @returns
     */
    public async downloadAllFiles(
        manifest: Types.MatchManifest
    ): Promise<Types.FileDownload[]> {
        debug('Downloading All Files')
        return new Promise((resolve, reject) => {
            const createDownloadJob = async (
                f: Types.MatchManifestFile,
                initialState: Partial<Types.FileDownload> = {}
            ) : Promise<Types.FileDownload> => {

                let fileName = basename(f.url);

                const downloadMetadata: Types.FileDownload = {
                    url: f.url,
                    name: fileName,
                    exportType: "output",
                    error: null,
                    ...initialState,
                };
                await this.downloadFile({
                    file: f,
                    fileName,
                    authorize: manifest.requiresAccessToken,
                    subFolder:
                        downloadMetadata.exportType === "output"
                            ? ""
                            : downloadMetadata.exportType,
                    exportType: downloadMetadata.exportType,
                });

                if (this.options.addDestinationToManifest) {
                    // @ts-ignore
                    f.destination = join(
                        this.options.destination,
                        downloadMetadata.exportType === "output" ? "" : downloadMetadata.exportType,
                        fileName
                    );
                }
                return downloadMetadata
            }

            const downloadJobs = [
                ...(manifest.output || []).map((f) =>
                    createDownloadJob(f, { exportType: "output" })
                ),
                ...(manifest.error || []).map((f) =>
                    createDownloadJob(f, { exportType: "error" })
                ),
            ];

            Promise.allSettled(downloadJobs)
                .then((downloadOutcomes) => {
                    debug('All downloads settled, processing them and saving manifest')
                    // Save manifest if requested
                    if (this.options.saveManifest) {
                        this.saveFile(JSON.stringify(manifest, null, 4), "manifest.json")
                    }
                    // Get outcome of downloads if they succeeded; else get failure instances
                    const downloads = downloadOutcomes.map((outcome) => { 
                        if (outcome.status === 'fulfilled') { 
                            return outcome.value
                        } else { 
                            return outcome
                        }
                    })
                    this.emit("allDownloadsComplete", downloads);
                })
        });
    }

    protected async downloadFile({
        file,
        fileName,
        authorize = false,
        subFolder = "",
        exportType = "output",
    }: {
        file: Types.MatchManifestFile;
        fileName: string;
        authorize?: boolean;
        subFolder?: string;
        exportType?: string;
    }): Promise<void> {
        debug("Download starting for ", file)
        let accessToken = "";

        if (authorize) {
            accessToken = await this._getAccessToken();
        }

        this.emit("downloadStart", {
            fileUrl: file.url,
            itemType: exportType,
        });

        const download = new FileDownload(file.url);

        // Start the download, then parse as json
        return download
            .run({
                accessToken,
                signal: this.abortController.signal,
                requestOptions: this.options.requests,
            })
            .then(async (resp) => {
                // Download is finished – emit event and save file off
                this.emit("downloadComplete", {
                    fileUrl: file.url,
                });
                const response = await resp.text()
                debug(`Response for ${fileName}: ${response}`)
                await this.saveFile(response, fileName, subFolder)
            })
            .catch((e) => {
                if (e instanceof FileDownloadError) {
                    this.emit("downloadError", {
                        body: null,
                        code: e.code || null,
                        fileUrl: e.fileUrl,
                        message: String(e.message || "File download failed"),
                        responseHeaders: this._formatResponseHeaders(
                            e.responseHeaders
                        ),
                    });
                }
                throw e;
            });
    }

    /**
     * Internal method for saving downloaded files to memory
     * @param data The information to save
     * @param fileName The name of the file to use 
     * @param subFolder Where that file should live
     * @returns A promise corresponding to that save operation 
     */
    protected async saveFile(data: string, fileName: string, subFolder = ""): Promise<void> {
        debug(`Saving ${fileName} ${subFolder ? `with subfolder ${subFolder}`: ''}`)
        const destination = String(this.options.destination || "none").trim();
        // No destination, write nothing ---------------------------------------
        if (!destination || destination.toLowerCase() === "none") {
            return
        }

        // local filesystem destinations ---------------------------------------
        let path = destination.startsWith("file://") ?
            fileURLToPath(destination) :
            destination.startsWith(sep) ?
                destination :
                resolve(__dirname, "../..", destination);

        assert(existsSync(path), `Destination "${path}" does not exist`)
        assert(statSync(path).isDirectory, `Destination "${path}" is not a directory`)

        // Create any necessary subfolders (for error responses)
        if (subFolder) {
            path = join(path, subFolder)
            if (!existsSync(path)) {
                mkdirSync(path)
            }
        }
 
        // Finally write the file to disc
        return fsPromises.writeFile(join(path, fileName), data);
    }


    /**
     * Cancels an active matching request
     * @param statusEndpoint
     * @returns
     */
    public cancelMatch(statusEndpoint: string) {
        debug("Cancelling match request at statusEndpoint: ", statusEndpoint)
        this.abort();
        return this._request(statusEndpoint, {
            method: "DELETE",
        });
    }
}

export default BulkMatchClient;
