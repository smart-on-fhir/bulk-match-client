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
const errors_1 = require("../lib/errors");
const utils_1 = require("../lib/utils");
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
    _getRetryAfter(headers) {
        const now = Date.now();
        const retryAfter = String(headers.get("retry-after") || "").trim();
        let retryAfterMSec = this?.options?.retryAfterMSec;
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
        return [retryAfter, poolDelay];
    }
    /**
     * Internal method for formatting response headers for some emitted events
     * based on `options.logResponseHeaders`
     * @param headers Response Headers to format
     * @returns an object representation of only the relevant headers
     */
    _formatResponseHeaders(headers) {
        if (this.options.logResponseHeaders.toString().toLocaleLowerCase() === "none")
            return undefined;
        if (this.options.logResponseHeaders.toString().toLocaleLowerCase() === "all")
            return Object.fromEntries(headers);
        // If not an array it must be a string or a RegExp
        if (!Array.isArray(this.options.logResponseHeaders)) {
            return lib_1.Utils.filterResponseHeaders(headers, [this.options.logResponseHeaders]);
        }
        // Else it must be an array
        return lib_1.Utils.filterResponseHeaders(headers, this.options.logResponseHeaders);
    }
    /**
     * Iterate over a well-formed NDJSON file
     * @param resource
     * @returns that
     */
    _parseResourceNdjson(resource) {
        try {
            return resource
                .split("\n")
                .filter(Boolean)
                .map((j) => JSON.parse(j));
        }
        catch (e) {
            throw new errors_1.InvalidNdjsonError({
                resource,
                errorMessage: e.message,
            });
        }
    }
    /**
     * Parses all possible string representations of resources into JSON
     * @param resource A resource parameter either as a filePath or stringified JSON
     * @returns JSON representation of FHIR resource(s) to match
     */
    async _parseResourceStringOption(resource) {
        // See if this is a file – will throw an error if statSync received non-file/non-dir
        let resourcePath, resourceInfo;
        try {
            resourcePath = path_1.default.resolve(resource);
            resourceInfo = (0, fs_1.statSync)(resourcePath);
        }
        catch {
            // If its not a file, it should be inline JSON
            try {
                return JSON.parse(resource);
            }
            catch (e) {
                // Resource isn't stringified JSON or a valid path – must be incorrectly specified
                throw new errors_1.UnknownResourceStringError({
                    resource: resource,
                    errorMessage: e.message,
                });
            }
        }
        // String resources can be inline JSON, a file, or a directory
        if (resourceInfo.isDirectory()) {
            // Directory - call this method recursively on all files, relative to the provided directory
            const files = await promises_1.default.readdir(resourcePath);
            return Promise.all(files.map(async (file) => this._parseResourceStringOption(
            // Resolve this file relative to the directory specified
            path_1.default.resolve(resourcePath, file))));
        }
        else if (resourceInfo.isFile()) {
            // Files have two valid representations – json and ndjson
            const resourceFile = (0, fs_1.readFileSync)(resourcePath, "utf-8");
            const resourceExt = path_1.default.extname(resourcePath);
            if (resourceExt === ".json") {
                return JSON.parse(resourceFile);
            }
            else if (resourceExt === ".ndjson") {
                return this._parseResourceNdjson(resourceFile);
            }
            else {
                throw new errors_1.UnknownResourceStringError({
                    resource: resource,
                    errorMessage: "Unexpected extension type of " + resourceExt,
                });
            }
        }
        else {
            // We should get here, but throw an error just in case
            throw new errors_1.UnknownResourceStringError({
                resource: resource,
                errorMessage: "Unexpected resource type that parses via statSync, but isn't a file or a directory",
            });
        }
    }
    /**
     * Parses all possible resource parameter representations into a standard format – an array of resources to match
     * @param resource A resource parameter to match against
     * @returns FHIR resources to match, represented as an array
     */
    async _parseResourceOption(resource) {
        let localResource = resource;
        // Turn strings into JSON representation
        if (typeof resource === "string") {
            localResource = (await this._parseResourceStringOption(resource));
        }
        // Then turn all JSON into JsonArray
        if (!Array.isArray(localResource)) {
            localResource = [localResource];
        }
        return localResource;
    }
    /**
     * Build a POST-request JSON payload for a bulk match request
     * @returns
     */
    async _buildKickoffPayload() {
        const parameters = [];
        // resource --------------------------------------------------------------
        const resource = await this._parseResourceOption(this.options.resource);
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
                responseHeaders: this._formatResponseHeaders(res.response.headers),
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
        // Track status progress
        const progress = String(res.response.headers.get("x-progress") || "").trim();
        const progressPct = parseInt(progress, 10);
        // Get retryAfter info
        const [retryAfter, poolDelay] = this._getRetryAfter(res.response.headers);
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
        // Make sure we stop if the operation outcome is a fatal error
        const operationOutcome = res.body;
        if (operationOutcome?.issue[0]?.severity === "fatal") {
            const msg = `Unexpected status response ${res.response.status} ${res.response.statusText}`;
            this.emit("jobError", {
                body: (0, utils_1.stringifyBody)(res.body) || null,
                code: res.response.status || null,
                message: msg,
                responseHeaders: this._formatResponseHeaders(res.response.headers),
            });
            throw new lib_1.Errors.OperationOutcomeError({
                res: res,
            });
        }
        // Otherwise, handle the response as usual, which always respects the server-responded retryAfter
        return this._statusPending(status, statusEndpoint, res);
    }
    /**
     * Log any necessary information when MatchStatus requests produce a RequestError
     * @param err The error – either a RequestError itself or an error from making the status calls
     * @returns never; always throws an error
     */
    _statusError(err) {
        // Request errors should be logged in the context of the bulk workflow
        if (err instanceof errors_1.RequestError) {
            const msg = `Unexpected status response ${err.status} ${err.statusText}`;
            this.emit("jobError", {
                body: (0, utils_1.stringifyBody)(err.body) || null,
                code: err.status || null,
                message: msg,
                responseHeaders: this._formatResponseHeaders(err.responseHeaders),
            });
        }
        // Else, just keep passing the error up
        throw err;
    }
    /**
     * An indirectly recursive method for making status requests and handling completion, pending and error cases
     * @param status The MatchStatus up to this point
     * @param statusEndpoint The statusEndpoint where we check on the status of the match request
     * @returns A Promise resolving to a MatchManifest (or throws an error)
     */
    async _checkStatus(status, statusEndpoint) {
        return (this._request(statusEndpoint, {
            headers: {
                accept: "application/json, application/fhir+ndjson",
            },
        }, "status request")
            .then(async (res) => {
            const now = Date.now();
            const elapsedTime = now - status.startedAt;
            status.elapsedTime = elapsedTime;
            // match is complete
            if (res.response.status === 200) {
                return this._statusCompleted(status, res);
            }
            // match is in progress
            if (res.response.status === 202) {
                return this._statusPending(status, statusEndpoint, res);
            }
            // server needs us to slow down requests; recalculate delay and try again
            if (res.response.status === 429) {
                return this._statusTooManyRequests(status, statusEndpoint, res);
            }
            // Else, we're seeing an unexpected status code – throw an error ourselves
            const msg = `Unexpected status response ${res.response.status} ${res.response.statusText}`;
            this.emit("jobError", {
                body: (0, utils_1.stringifyBody)(res.body) || null,
                code: res.response.status || null,
                message: msg,
                responseHeaders: this._formatResponseHeaders(res.response.headers),
            });
            throw new Error(msg);
        })
            // This always throws, but allows for some middleware-style logging
            .catch((err) => this._statusError(err)));
    }
    /**
     * Makes the kick-off request for Patient Match and resolves with the status endpoint URL
     */
    async kickOff() {
        const { fhirUrl } = this.options;
        const url = new URL("Patient/$bulk-match", fhirUrl);
        // TODO: Check with vlad whether we want this or not
        // Always tries to get capability statement as part of kickoff process-used in logging below
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
        requestOptions.body = JSON.stringify(await this._buildKickoffPayload());
        this.emit("kickOffStart", requestOptions, String(url));
        // Get response and handle errors
        const res = await this._request(url, requestOptions, "kick-off patient match request").catch((error) => {
            this.emit("kickOffError", {
                requestOptions: requestOptions,
                capabilityStatement: capabilityStatement,
                error: error,
            });
            throw error;
        });
        // Optionally handle 429 responses gracefully
        if (res.response.status === 429) {
            const operationOutcome = res.body;
            if (operationOutcome?.issue[0]?.severity === "fatal") {
                const err = new Error(`Unexpected kick-off response ${res.response.status} ${res.response.statusText}`);
                this.emit("kickOffError", {
                    requestOptions: requestOptions,
                    capabilityStatement: capabilityStatement,
                    responseHeaders: this._formatResponseHeaders(res.response.headers),
                    error: err,
                });
                throw new lib_1.Errors.OperationOutcomeError({
                    res: res,
                });
            }
            // Otherwise, wait and try kickoff again
            const [, poolDelay] = this._getRetryAfter(res.response.headers);
            return lib_1.Utils.wait(poolDelay, this.abortController.signal).then(() => this.kickOff());
        }
        // Then parse location information
        const location = res.response.headers.get("content-location");
        if (!location) {
            this.emit("kickOffError", {
                requestOptions: requestOptions,
                capabilityStatement: capabilityStatement,
                responseHeaders: this._formatResponseHeaders(res.response.headers),
                error: new Error("No content location was specified in the response"),
            });
            throw new Error("The kick-off patient match response did not include content-location header");
        }
        this.emit("kickOffEnd", {
            response: res,
            requestOptions: requestOptions,
            capabilityStatement: capabilityStatement,
            responseHeaders: this._formatResponseHeaders(res.response.headers),
        });
        return location;
    }
    /**
     * Download a single File from a MatchManifest
     * @param file The file to download
     * @param fileName The name that should be used to save the file
     * @param subFolder What subfolder should the file be saved to; defaults to ""
     * @param matchType What kind of ManifestFile is this; defaults to "output" but could also be "error"
     * @returns
     */
    async _downloadFile({ file, fileName, subFolder = "", matchType = "output", }) {
        return this._downloadFileRecursive({ file, fileName, subFolder, matchType, retries: 3 });
    }
    async _downloadFileRecursive({ file, fileName, subFolder = "", matchType = "output", retries = 1, }) {
        const downloadStartTime = Date.now();
        this.emit("downloadStart", {
            fileUrl: file.url,
            itemType: matchType,
            startTime: downloadStartTime,
        });
        // Start the download for the ndjson file – ndjson means the response is a string
        return this._request(file.url)
            .then(async (res) => {
            // Download is finished – emit event and save file off
            this.emit("downloadComplete", {
                fileUrl: file.url,
                duration: (0, utils_1.formatDuration)(Date.now() - downloadStartTime),
            });
            const body = res.body;
            await this._saveFile(body, fileName, subFolder);
        })
            .catch((e) => {
            this.emit("downloadError", {
                fileUrl: file.url,
                message: String(e.message || "File download failed"),
                duration: (0, utils_1.formatDuration)(Date.now() - downloadStartTime),
                responseHeaders: this._formatResponseHeaders(e.responseHeaders),
            });
            // Only retry a fixed number of times
            if (retries > 0) {
                const [, poolDelay] = this._getRetryAfter(e.responseHeaders);
                return lib_1.Utils.wait(poolDelay, this.abortController.signal).then(() => this._downloadFileRecursive({
                    file,
                    fileName,
                    subFolder,
                    matchType,
                    retries: retries - 1,
                }));
            }
            else {
                throw e;
            }
        });
    }
    /**
     * Internal method for saving downloaded files to memory
     * @param data The information to save
     * @param fileName The name of the file to use
     * @param subFolder Where that file should live
     * @returns A promise associated with this save operation
     */
    async _saveFile(data, fileName, subFolder = "") {
        debug(`Saving ${fileName} ${subFolder ? `with subfolder ${subFolder}` : ""}`);
        const destination = String(this.options.destination || "none").trim();
        // No destination, write nothing ---------------------------------------
        if (!destination ||
            destination.toLowerCase() === "none" ||
            destination.toLowerCase().indexOf("/dev/null") !== -1) {
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
                (0, fs_1.mkdirSync)(path, { recursive: true });
            }
        }
        // Finally write the file to disc
        if (typeof data === "string") {
            return promises_1.default.writeFile((0, path_1.join)(path, fileName), data);
        }
        else {
            // IF not a string, it must be a JSON object
            return promises_1.default.writeFile((0, path_1.join)(path, fileName), JSON.stringify(data));
        }
    }
    /**
     * Waits for the patient match to be completed and resolves with the match
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
     * Download all the ndjson files specified in the match-response's manifest
     * @param manifest
     * @returns
     */
    async downloadAllFiles(manifest) {
        debug("Downloading All Files");
        const startTime = Date.now();
        return new Promise(() => {
            const createDownloadJob = async (f, initialState = {}) => {
                const fileName = (0, path_1.basename)(f.url);
                const downloadMetadata = {
                    url: f.url,
                    name: fileName,
                    matchType: "output",
                    error: null,
                    ...initialState,
                };
                await this._downloadFile({
                    file: f,
                    fileName,
                    subFolder: downloadMetadata.matchType === "output" ? "" : downloadMetadata.matchType,
                    matchType: downloadMetadata.matchType,
                });
                // After saving files, optionally add destination to manifest
                if (this.options.addDestinationToManifest) {
                    f.destination = (0, path_1.join)(this.options.destination, downloadMetadata.matchType === "output" ? "" : downloadMetadata.matchType, fileName);
                }
                return downloadMetadata;
            };
            const downloadJobs = [
                ...(manifest.output || []).map((f) => createDownloadJob(f, { matchType: "output" })),
                ...(manifest.error || []).map((f) => createDownloadJob(f, { matchType: "error" })),
            ];
            Promise.allSettled(downloadJobs).then((downloadOutcomes) => {
                debug("All downloads settled, processing them and saving manifest");
                // Save manifest if requested
                if (this.options.saveManifest) {
                    this._saveFile(manifest, "manifest.json");
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
                this.emit("allDownloadsComplete", downloads, (0, utils_1.formatDuration)(Date.now() - startTime));
            });
        });
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
     * Connects a logger, tapping into all emitted events
     * @param log
     */
    addLogger(logger) {
        this.on("authorize", () => {
            logger.log("info", {
                eventId: "authorize",
                eventDetail: "Successfully authorized against token endpoint",
            });
        });
        // kickoff ---------------------------------------------------------------------------------
        this.on("kickOffStart", (requestOptions, url) => {
            logger.log("info", {
                eventId: "kickoff_start",
                eventDetail: `Kick-off started with URL: ${url}\nOptions: ${JSON.stringify(requestOptions)}`,
            });
        });
        // kickoff_error ---------------------------------------------------------------------------
        this.on("kickOffError", ({ capabilityStatement, responseHeaders, requestOptions, error }) => {
            logger.log("info", {
                eventId: "kickoff_error",
                eventDetail: {
                    softwareName: capabilityStatement.software?.name || null,
                    softwareVersion: capabilityStatement.software?.version || null,
                    softwareReleaseDate: capabilityStatement.software?.releaseDate || null,
                    fhirVersion: capabilityStatement.fhirVersion || null,
                    requestOptions: requestOptions,
                    responseHeaders,
                    error: error.message,
                },
            });
        });
        // kickoff_complete ------------------------------------------------------------------------
        this.on("kickOffEnd", ({ capabilityStatement, response: res, responseHeaders, requestOptions }) => {
            logger.log("info", {
                eventId: "kickoff_complete",
                eventDetail: {
                    matchUrl: res.response.url,
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
        // Status request events -------------------------------------------------------------------
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
        this.on("jobError", (eventDetail) => {
            logger.log("error", {
                eventId: "status_error",
                eventDetail,
            });
        });
        // job completion --------------------------------------------------------------------------
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
        // download_request ------------------------------------------------------------------------
        this.on("downloadStart", (eventDetail) => {
            logger.log("info", { eventId: "download_request", eventDetail });
        });
        // download_complete -----------------------------------------------------------------------
        this.on("downloadComplete", (eventDetail) => {
            logger.log("info", { eventId: "download_complete", eventDetail });
        });
        // download_error --------------------------------------------------------------------------
        this.on("downloadError", (eventDetail) => {
            logger.log("info", { eventId: "download_error", eventDetail });
        });
        // export_complete -------------------------------------------------------------------------
        this.on("allDownloadsComplete", (downloads, duration) => {
            const eventDetail = {
                files: 0,
                duration,
            };
            downloads.forEach(() => {
                eventDetail.files += 1;
            });
            logger.log("info", { eventId: "all_downloads_complete", eventDetail });
        });
    }
}
exports.default = BulkMatchClient;
