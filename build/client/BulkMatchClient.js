"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const url_1 = require("url");
const path_1 = require("path");
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = require("fs");
const FileDownload_1 = __importDefault(require("./FileDownload"));
const errors_1 = require("../lib/errors");
const utils_1 = require("../lib/utils");
const SmartOnFhirClient_1 = __importDefault(require("./SmartOnFhirClient"));
const debug = (0, util_1.debuglog)("bulk-match-client");
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
class BulkMatchClient extends SmartOnFhirClient_1.default {
    /**
     * Makes the kick-off request for Patient Match and resolves with the status endpoint URL
     */
    async kickOff() {
        const { fhirUrl } = this.options;
        const url = new url_1.URL("Patient/$bulk-match", fhirUrl);
        let capabilityStatement;
        try {
            capabilityStatement = await (0, utils_1.getCapabilityStatement)(fhirUrl);
        }
        catch {
            capabilityStatement = {};
        }
        const requestOptions = {
            headers: {
                "Content-Type": "application/json",
                accept: "application/fhir+ndjson",
                prefer: `respond-async`,
            },
        };
        requestOptions.method = "POST";
        // Body must be stringified
        requestOptions.body = JSON.stringify(this.buildKickoffPayload());
        this.emit("kickOffStart", requestOptions, String(url));
        return this._request(url, requestOptions, "kick-off patient match request")
            .then(async (res) => {
            const location = res.headers.get("content-location");
            if (!location) {
                throw new Error("The kick-off patient match response did not include content-location header");
            }
            this.emit("kickOffEnd", {
                response: res,
                requestOptions: requestOptions,
                capabilityStatement,
                responseHeaders: this._formatResponseHeaders(res.headers),
            });
            return location;
        })
            .catch((error) => {
            this.emit("kickOffError", error);
            throw error;
        });
    }
    /**
     * Build a POST-request JSON payload for a bulk match request
     * @returns
     */
    buildKickoffPayload() {
        const parameters = [];
        // _outputFormat ----------------------------------------------------------
        if (this.options._outputFormat) {
            parameters.push({
                name: "_outputFormat",
                valueString: this.options._outputFormat,
            });
        }
        // resource --------------------------------------------------------------
        let resource = JSON.parse(this.options.resource);
        if (!Array.isArray(resource)) {
            resource = [resource];
        }
        resource.forEach((res) => {
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
    async _statusCompleted(status, res) {
        const now = Date.now();
        const elapsedTime = now - status.startedAt;
        status.completedAt = now;
        status.percentComplete = 100;
        status.nextCheckAfter = -1;
        status.message = `Patient Match completed in ${(0, utils_1.formatDuration)(elapsedTime)}`;
        this.emit("matchProgress", { ...status, virtual: true });
        let body = "";
        try {
            // This should throw a TypeError if the response is not parsable as JSON
            // TODO: Add more checks here based on return type of match operation
            body = await res.text();
            debug("statusCompleted no problem!");
            debug(body);
            (0, utils_1.assert)(body !== null, "No match manifest returned");
            // expect(body.output, "The match manifest output is not an array").to.be.an.array();
            // expect(body.output, "The match manifest output contains no files").to.not.be.empty()
            this.emit("matchComplete", JSON.parse(body));
        }
        catch (ex) {
            debug("StatusCompleted In ERROR ");
            debug(body);
            this.emit("matchError", {
                body: body || null,
                code: res.status || null,
                message: ex.message,
                responseHeaders: this._formatResponseHeaders(res.headers),
            });
            throw ex;
        }
        return JSON.parse(body);
    }
    /**
     * Handle the pending workflow of MatchStatus requests, tracking metadata, calculating wait-time delays
     * and recursively calling checkStatus again
     * @param status The MatchStatus
     * @param statusEndpoint The endpoint against which statusRequests are made; needed to recursively call checkStatus
     * @param res The pending response from statusEndpoint
     * @returns A promise that waits, then invokes checkStatus again, ultimately resolving to a MatchManifest (or throwing an error)
     */
    async _statusPending(status, statusEndpoint, res) {
        const now = Date.now();
        const elapsedTime = now - status.startedAt;
        const progress = String(res.headers.get("x-progress") || "").trim();
        const retryAfter = String(res.headers.get("retry-after") || "").trim();
        const progressPct = parseInt(progress, 10);
        let retryAfterMSec = this.options.retryAfterMSec;
        if (retryAfter) {
            if (retryAfter.match(/\d+/)) {
                retryAfterMSec = parseInt(retryAfter, 10) * 1000;
            }
            else {
                const d = new Date(retryAfter);
                retryAfterMSec = Math.ceil(d.getTime() - now);
            }
        }
        const poolDelay = Math.min(Math.max(retryAfterMSec, 100), 1000 * 60);
        Object.assign(status, {
            percentComplete: isNaN(progressPct) ? -1 : progressPct,
            nextCheckAfter: poolDelay,
            message: isNaN(progressPct)
                ? `Patient Match: in progress for ${(0, utils_1.formatDuration)(elapsedTime)}${progress ? ". Server message: " + progress : ""}`
                : `Patient Match: ${progressPct}% complete in ${(0, utils_1.formatDuration)(elapsedTime)}`,
        });
        this.emit("matchProgress", {
            ...status,
            retryAfterHeader: retryAfter,
            xProgressHeader: progress,
            body: res.body,
        });
        return (0, utils_1.wait)(poolDelay, this.abortController.signal).then(() => this.checkStatus(status, statusEndpoint));
    }
    /**
     * Produce the error to throw when MatchStatus requests produce an unexpected response status
     * @param status The MatchStatus
     * @param res The statusEndpoint response
     * @returns An error to be thrown
     */
    async _statusError(status, res) {
        const msg = `Unexpected status response ${res.status} ${res.statusText}`;
        const body = await res.text();
        this.emit("matchError", {
            body: body || null,
            code: res.status || null,
            message: msg,
            responseHeaders: this._formatResponseHeaders(res.headers),
        });
        const error = new Error(msg);
        // @ts-ignore
        error.body = body || null;
        return error;
    }
    /**
     * A indirectly recursive method for making status requests and handling completion, pending and error cases
     * @param status The MatchStatus up to this point
     * @param statusEndpoint The statusEndpoint where we check on the status of the match request
     * @returns A Promise resolving to a MatchManifest (or throws an error)
     */
    async checkStatus(status, statusEndpoint) {
        debug("Making a status call");
        return this._request(statusEndpoint, {
            headers: {
                accept: "application/json, application/fhir+ndjson",
            },
        }, "status request").then(async (res) => {
            const now = Date.now();
            const elapsedTime = now - status.startedAt;
            status.elapsedTime = elapsedTime;
            // match is complete
            if (res.status === 200) {
                debug("COMPLETED STATUS REQUEST, RETURNING AFTER PARSING RESPONSE");
                return this._statusCompleted(status, res);
            }
            // match is in progress
            if (res.status === 202) {
                return this._statusPending(status, statusEndpoint, res);
            }
            // Match Error - await the error then throw it
            else {
                throw await this._statusError(status, res);
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
    async waitForMatch(statusEndpoint) {
        debug("Waiting for match to complete, making status requests");
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
    async downloadAllFiles(manifest) {
        debug("Downloading All Files");
        return new Promise((resolve, reject) => {
            const createDownloadJob = async (f, initialState = {}) => {
                const fileName = (0, path_1.basename)(f.url);
                const downloadMetadata = {
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
                    subFolder: downloadMetadata.exportType === "output"
                        ? ""
                        : downloadMetadata.exportType,
                    exportType: downloadMetadata.exportType,
                });
                if (this.options.addDestinationToManifest) {
                    // @ts-ignore
                    f.destination = (0, path_1.join)(this.options.destination, downloadMetadata.exportType === "output"
                        ? ""
                        : downloadMetadata.exportType, fileName);
                }
                return downloadMetadata;
            };
            const downloadJobs = [
                ...(manifest.output || []).map((f) => createDownloadJob(f, { exportType: "output" })),
                ...(manifest.error || []).map((f) => createDownloadJob(f, { exportType: "error" })),
            ];
            Promise.allSettled(downloadJobs).then((downloadOutcomes) => {
                debug("All downloads settled, processing them and saving manifest");
                // Save manifest if requested
                if (this.options.saveManifest) {
                    this.saveFile(JSON.stringify(manifest, null, 4), "manifest.json");
                }
                // Get outcome of downloads if they succeeded; else get failure instances
                const downloads = downloadOutcomes.map((outcome) => {
                    if (outcome.status === "fulfilled") {
                        return outcome.value;
                    }
                    else {
                        return outcome;
                    }
                });
                this.emit("allDownloadsComplete", downloads);
            });
        });
    }
    /**
     * Download a file from a provided URL
     * @param param0
     * @returns
     */
    async downloadFile({ file, fileName, authorize = false, subFolder = "", exportType = "output", }) {
        debug("Download starting for ", file);
        let accessToken = "";
        if (authorize) {
            accessToken = await this._getAccessToken();
        }
        this.emit("downloadStart", {
            fileUrl: file.url,
            itemType: exportType,
        });
        const download = new FileDownload_1.default(file.url);
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
            const response = await resp.text();
            debug(`Response for ${fileName}: ${response}`);
            await this.saveFile(response, fileName, subFolder);
        })
            .catch((e) => {
            if (e instanceof errors_1.FileDownloadError) {
                this.emit("downloadError", {
                    body: null,
                    code: e.code || null,
                    fileUrl: e.fileUrl,
                    message: String(e.message || "File download failed"),
                    responseHeaders: this._formatResponseHeaders(e.responseHeaders),
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
    async saveFile(data, fileName, subFolder = "") {
        debug(`Saving ${fileName} ${subFolder ? `with subfolder ${subFolder}` : ""}`);
        const destination = String(this.options.destination || "none").trim();
        // No destination, write nothing ---------------------------------------
        if (!destination || destination.toLowerCase() === "none") {
            return;
        }
        // local filesystem destinations ---------------------------------------
        let path = destination.startsWith("file://")
            ? (0, url_1.fileURLToPath)(destination)
            : destination.startsWith(path_1.sep)
                ? destination
                : (0, path_1.resolve)(__dirname, "../..", destination);
        (0, utils_1.assert)((0, fs_1.existsSync)(path), `Destination "${path}" does not exist`);
        (0, utils_1.assert)((0, fs_1.statSync)(path).isDirectory, `Destination "${path}" is not a directory`);
        // Create any necessary subfolders (for error responses)
        if (subFolder) {
            path = (0, path_1.join)(path, subFolder);
            if (!(0, fs_1.existsSync)(path)) {
                (0, fs_1.mkdirSync)(path);
            }
        }
        // Finally write the file to disc
        return promises_1.default.writeFile((0, path_1.join)(path, fileName), data);
    }
    /**
     * Cancels an active matching request
     * @param statusEndpoint
     * @returns
     */
    cancelMatch(statusEndpoint) {
        debug("Cancelling match request at statusEndpoint: ", statusEndpoint);
        this.abort();
        return this._request(statusEndpoint, {
            method: "DELETE",
        });
    }
    /**
     * Connects a logger
     * @param log
     */
    addLogger(logger) {
        const startTime = Date.now();
        // kickoff -----------------------------------------------------------------
        this.on("kickOffEnd", ({ capabilityStatement, response, responseHeaders, requestOptions }) => {
            logger.log("info", {
                eventId: "kickoff",
                eventDetail: {
                    exportUrl: response.url,
                    errorCode: response.status >= 400 ? response.status : null,
                    errorBody: response.status >= 400 ? response.body : null,
                    softwareName: capabilityStatement.software?.name || null,
                    softwareVersion: capabilityStatement.software?.version || null,
                    softwareReleaseDate: capabilityStatement.software?.releaseDate || null,
                    fhirVersion: capabilityStatement.fhirVersion || null,
                    requestOptions: requestOptions,
                    responseHeaders,
                },
            });
        });
        // status_progress ---------------------------------------------------------
        this.on("matchProgress", (e) => {
            if (!e.virtual) {
                // skip the artificially triggered 100% event
                logger.log("info", {
                    eventId: "status_progress",
                    eventDetail: {
                        body: e.body,
                        xProgress: e.xProgressHeader,
                        retryAfter: e.retryAfterHeader,
                    },
                });
            }
        });
        // status_error ------------------------------------------------------------
        this.on("matchError", (eventDetail) => {
            logger.log("error", {
                eventId: "status_error",
                eventDetail,
            });
        });
        // status_complete ---------------------------------------------------------
        this.on("matchComplete", (manifest) => {
            logger.log("info", {
                eventId: "status_complete",
                eventDetail: {
                    transactionTime: manifest.transactionTime,
                    outputFileCount: manifest.output.length,
                    errorFileCount: manifest.error.length,
                },
            });
        });
        // download_request --------------------------------------------------------
        this.on("downloadStart", (eventDetail) => {
            logger.log("info", { eventId: "download_request", eventDetail });
        });
        // download_complete -------------------------------------------------------
        this.on("downloadComplete", (eventDetail) => {
            logger.log("info", { eventId: "download_complete", eventDetail });
        });
        // download_error ----------------------------------------------------------
        this.on("downloadError", (eventDetail) => {
            logger.log("info", { eventId: "download_error", eventDetail });
        });
        // export_complete ---------------------------------------------------------
        this.on("allDownloadsComplete", (downloads) => {
            const eventDetail = {
                files: 0,
                resources: 0,
                bytes: 0,
                duration: Date.now() - startTime,
            };
            // TODO: Add download object back in?
            downloads.forEach(() => {
                eventDetail.files += 1;
            });
            logger.log("info", { eventId: "export_complete", eventDetail });
        });
    }
}
exports.default = BulkMatchClient;
