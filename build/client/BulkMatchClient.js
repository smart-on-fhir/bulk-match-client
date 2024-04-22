"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
const code_1 = require("@hapi/code");
const fs_1 = require("fs");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importStar(require("path"));
const url_1 = require("url");
const util_1 = require("util");
const lib_1 = require("../lib");
const SmartOnFhirClient_1 = __importDefault(require("./SmartOnFhirClient"));
const debug = (0, util_1.debuglog)("bulk-match-client");
/**
 * This class provides all the methods needed for making Bulk matches and
 * downloading data fom bulk match capable FHIR server.
 *
 * **Example:**
 * ```ts
 * const client = new Client({ ...options })
 *
 * // Start an match and get the status location
 * const statusEndpoint = await client.kickOff()
 *
 * // Wait for the match and get the manifest
 * const manifest = await client.waitForMatch(statusEndpoint)
 *
 * // Download everything in the manifest
 * const downloads = await client.downloadAllFiles(manifest)
 * ```
 */
class BulkMatchClient extends SmartOnFhirClient_1.default {
    /**
     * Internal method for formatting response headers for some emitted events
     * based on `options.logResponseHeaders`
     * @param headers Response Headers to format
     * @returns an object representation of only the relevant headers
     */
    formatResponseHeaders(headers) {
        if (this.options.logResponseHeaders.toString().toLocaleLowerCase() === "none")
            return undefined;
        if (this.options.logResponseHeaders.toString().toLocaleLowerCase() === "all")
            return Object.fromEntries(headers);
        // If not an array it must be a string or a RegExp
        if (!Array.isArray(this.options.logResponseHeaders)) {
            return lib_1.Utils.filterResponseHeaders(headers, [
                this.options.logResponseHeaders,
            ]);
        }
        // Else it must be an array
        return lib_1.Utils.filterResponseHeaders(headers, this.options.logResponseHeaders);
    }
    /**
     * Makes the kick-off request for Patient Match and resolves with the status endpoint URL
     */
    async kickOff() {
        const { fhirUrl } = this.options;
        const url = new url_1.URL("Patient/$bulk-match", fhirUrl);
        let capabilityStatement = {};
        try {
            capabilityStatement = await lib_1.Utils.getCapabilityStatement(fhirUrl);
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
            console.log(res);
            const location = res.response.headers.get("content-location");
            if (!location) {
                throw new Error("The kick-off patient match response did not include content-location header");
            }
            this.emit("kickOffEnd", {
                response: res,
                requestOptions: requestOptions,
                capabilityStatement: capabilityStatement,
                responseHeaders: this.formatResponseHeaders(res.response.headers),
            });
            return location;
        })
            .catch((error) => {
            this.emit("kickOffError", error);
            throw error;
        });
    }
    /**
     * Parses all possible string representations of resources into JSON
     * @param resource A resource parameter either as a filePath or stringified JSON
     * @returns JSON representation of FHIR resource(s) to match
     */
    _parseResourceStringOption(resource) {
        let localResource;
        // String resources can be inline JSON as string or paths to files
        try {
            localResource = JSON.parse(resource);
        }
        catch {
            try {
                // Should resolve both relative and absolute paths, assuming they are valid relative to CWD
                const resourcePath = path_1.default.resolve(resource);
                localResource = JSON.parse((0, fs_1.readFileSync)(resourcePath, "utf8"));
            }
            catch (e) {
                // Isn't stringified JSON or a valid path, must be incorrectly specified
                throw new Error(`Unknown string value provided as resource; must be valid, stringified JSON or valid filePath. Instead received: ${resource}`);
            }
        }
        return localResource;
    }
    /**
     * Parses all possible resource parameter representations into a standard format – an array of resources to match
     * @param resource A resource parameter to match against
     * @returns FHIR resources to match, represented as an array
     */
    _parseResourceOption(resource) {
        let localResource = resource;
        // Turn strings into JSON representation
        if (typeof resource === "string") {
            localResource = this._parseResourceStringOption(resource);
        }
        // Then turn all JSON into JsonArray
        if (Array.isArray(localResource)) {
            // noop – already an array
        }
        else {
            // Else, must be an object – needs to be turned into an array
            localResource = [localResource];
        }
        return localResource;
    }
    /**
     * Build a POST-request JSON payload for a bulk match request
     * @returns
     */
    buildKickoffPayload() {
        const parameters = [];
        // resource --------------------------------------------------------------
        const resource = this._parseResourceOption(this.options.resource);
        resource.forEach((res) => {
            parameters.push({
                name: "resource",
                resource: res,
            });
        });
        // _outputFormat ----------------------------------------------------------
        if (this.options._outputFormat) {
            parameters.push({
                name: "_outputFormat",
                valueString: this.options._outputFormat,
            });
        }
        // onlySingleMatch ---------------------------------------------------------------
        if (this.options.onlySingleMatch) {
            parameters.push({
                name: "onlySingleMatch",
                valueBoolean: lib_1.Utils.parseBoolean(this.options.onlySingleMatch),
            });
        }
        // onlyCertainMatches -----------------------------------------------------------
        if (this.options.onlyCertainMatches) {
            parameters.push({
                name: "onlyCertainMatches",
                valueBoolean: lib_1.Utils.parseBoolean(this.options.onlyCertainMatches),
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
        status.message = `Patient Match completed in ${lib_1.Utils.formatDuration(elapsedTime)}`;
        this.emit("jobProgress", { ...status, virtual: true });
        const { body } = res;
        try {
            (0, code_1.expect)(body, "No match manifest returned").to.be.null;
            (0, code_1.expect)(body.output, "The match manifest output is not an array").to.be.an.array();
            (0, code_1.expect)(body.output, "The match manifest output contains no files").to.not.be.empty();
            this.emit("jobComplete", body);
            return body;
        }
        catch (ex) {
            this.emit("jobError", {
                body: JSON.stringify(body) || null,
                code: res.response.status || null,
                message: ex.message,
                responseHeaders: this.formatResponseHeaders(res.response.headers),
            });
            throw ex;
        }
    }
    /**
     * Handle the pending workflow of MatchStatus requests, tracking metadata, calculating wait-time delays
     * and recursively calling _checkStatus again
     * @param status The MatchStatus
     * @param statusEndpoint The endpoint against which statusRequests are made; needed to recursively call _checkStatus
     * @param res The pending response from statusEndpoint
     * @returns A promise that waits, then invokes _checkStatus again, ultimately resolving to a MatchManifest (or throwing an error)
     */
    async _statusPending(status, statusEndpoint, res) {
        const now = Date.now();
        const elapsedTime = now - status.startedAt;
        const progress = String(res.response.headers.get("x-progress") || "").trim();
        const retryAfter = String(res.response.headers.get("retry-after") || "").trim();
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
                ? `Patient Match: in progress for ${lib_1.Utils.formatDuration(elapsedTime)}${progress ? ". Server message: " + progress : ""}`
                : `Patient Match: ${progressPct}% complete in ${lib_1.Utils.formatDuration(elapsedTime)}`,
        });
        this.emit("jobProgress", {
            ...status,
            retryAfterHeader: retryAfter,
            xProgressHeader: progress,
            body: res.body,
        });
        return lib_1.Utils.wait(poolDelay, this.abortController.signal).then(() => this._checkStatus(status, statusEndpoint));
    }
    /**
     * For 429 responses – check if the server response indicates a fatal/failing error, otherwise try again
     * @param status The MatchStatus
     * @param statusEndpoint The endpoint against which statusRequests are made; needed to recursively call _checkStatus
     * @param res The pending response from statusEndpoint
     * @returns If the operationOutcome is fatal, resolve to that operationOutcome; else call _statusPending
     */
    async _statusTooManyRequests(status, statusEndpoint, res) {
        // Make sure we stop if the
        const operationOutcome = res.body;
        if (operationOutcome.issue[0].severity === "fatal") {
            const msg = `Unexpected status response ${res.response.status} ${res.response.statusText}`;
            this.emit("jobError", {
                body: JSON.stringify(res.body) || null,
                code: res.response.status || null,
                message: msg,
                responseHeaders: this.formatResponseHeaders(res.response.headers),
            });
            throw new lib_1.Errors.OperationOutcomeError({
                res: res,
            });
        }
        return this._statusPending(status, statusEndpoint, res);
    }
    /**
     * Produce the error to throw when MatchStatus requests produce an unexpected response status
     * @param status The MatchStatus
     * @param res The statusEndpoint response
     * @returns An error to be thrown
     */
    _statusError(res) {
        const msg = `Unexpected status response ${res.response.status} ${res.response.statusText}`;
        this.emit("jobError", {
            body: JSON.stringify(res.body) || null,
            code: res.response.status || null,
            message: msg,
            responseHeaders: this.formatResponseHeaders(res.response.headers),
        });
        return new Error(msg);
    }
    /**
     * A indirectly recursive method for making status requests and handling completion, pending and error cases
     * @param status The MatchStatus up to this point
     * @param statusEndpoint The statusEndpoint where we check on the status of the match request
     * @returns A Promise resolving to a MatchManifest (or throws an error)
     */
    async _checkStatus(status, statusEndpoint) {
        return this._request(statusEndpoint, {
            headers: {
                accept: "application/json, application/fhir+ndjson",
            },
        }, "status request").then(async (res) => {
            const now = Date.now();
            const elapsedTime = now - status.startedAt;
            status.elapsedTime = elapsedTime;
            // match is complete
            if (res.response.status === 200) {
                return this._statusCompleted(status, res);
            }
            // match is in progress
            if (res.response.status === 202 || res.response.status === 429) {
                return this._statusPending(status, statusEndpoint, res);
            }
            // server needs us to slow down requests; recalculate delay and try again
            if (res.response.status === 429) {
                return this._statusTooManyRequests(status, statusEndpoint, res);
            }
            // Match Error - helper throws that error
            else {
                const error = this._statusError(res);
                throw error;
            }
        });
    }
    /**
     * Waits for the patient match to be completed and resolves with the export
     * manifest when done. Emits one "jobStart", multiple "jobProgress"
     * and one "jobComplete" events.
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
        this.emit("jobStart", status);
        return this._checkStatus(status, statusEndpoint);
    }
    /**
     * Download all the ndsjson files specified in the match-response's manifest
     * @param manifest
     * @returns
     */
    async downloadAllFiles(manifest) {
        debug("Downloading All Files");
        return new Promise(() => {
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
                    subFolder: downloadMetadata.exportType === "output"
                        ? ""
                        : downloadMetadata.exportType,
                    exportType: downloadMetadata.exportType,
                });
                // After saving files, optinoally add destination to manifest
                if (this.options.addDestinationToManifest) {
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
                    this.saveFile(manifest, "manifest.json");
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
    async downloadFile({ file, fileName, subFolder = "", exportType = "output", }) {
        this.emit("downloadStart", {
            fileUrl: file.url,
            itemType: exportType,
        });
        // Start the download, then parse as json
        return this._request(file.url)
            .then(async (resp) => {
            // Download is finished – emit event and save file off
            this.emit("downloadComplete", {
                fileUrl: file.url,
            });
            const response = resp.body;
            await this.saveFile(response, fileName, subFolder);
        })
            .catch((e) => {
            if (e instanceof lib_1.Errors.FileDownloadError) {
                this.emit("downloadError", {
                    body: null,
                    code: e.code || null,
                    fileUrl: e.fileUrl,
                    message: String(e.message || "File download failed"),
                    responseHeaders: this.formatResponseHeaders(e.responseHeaders),
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
        lib_1.Utils.assert((0, fs_1.existsSync)(path), `Destination "${path}" does not exist`);
        lib_1.Utils.assert((0, fs_1.statSync)(path).isDirectory, `Destination "${path}" is not a directory`);
        // Create any necessary subfolders (for error responses)
        if (subFolder) {
            path = (0, path_1.join)(path, subFolder);
            if (!(0, fs_1.existsSync)(path)) {
                (0, fs_1.mkdirSync)(path);
            }
        }
        // Finally write the file to disc
        return promises_1.default.writeFile((0, path_1.join)(path, fileName), JSON.stringify(data));
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
        this.on("kickOffEnd", ({ capabilityStatement, response: res, responseHeaders, requestOptions, }) => {
            logger.log("info", {
                eventId: "kickoff",
                eventDetail: {
                    exportUrl: res.response.url,
                    errorCode: res.response.status >= 400 ? res.response.status : null,
                    errorBody: res.response.status >= 400 ? res.body : null,
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
        this.on("jobProgress", (e) => {
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
        this.on("jobError", (eventDetail) => {
            logger.log("error", {
                eventId: "status_error",
                eventDetail,
            });
        });
        // status_complete ---------------------------------------------------------
        this.on("jobComplete", (manifest) => {
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
