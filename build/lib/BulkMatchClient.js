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
const util_1 = require("util");
const http_1 = __importDefault(require("http"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const node_jose_1 = __importDefault(require("node-jose"));
const url_1 = require("url");
const events_1 = require("events");
const path_1 = require("path");
const fs_1 = __importStar(require("fs"));
const stream_1 = require("stream");
const promises_1 = require("stream/promises");
// import request                          from "./request"
const request_1 = __importDefault(require("./request"));
const FileDownload_1 = __importDefault(require("./FileDownload"));
const errors_1 = require("./errors");
const utils_1 = require("./utils");
events_1.EventEmitter.defaultMaxListeners = 30;
const debug = (0, util_1.debuglog)("bulk-match");
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
class BulkMatchClient extends events_1.EventEmitter {
    /**
     * Nothing special is done here - just remember the options and create
     * AbortController instance
     */
    constructor(options) {
        super();
        /**
         * The last known access token is stored here. It will be renewed when it
         * expires.
         */
        this.accessToken = "";
        /**
         * Every time we get new access token, we set this field based on the
         * token's expiration time.
         */
        this.accessTokenExpiresAt = 0;
        this.options = options;
        this.abortController = new AbortController();
        this.abortController.signal.addEventListener("abort", () => {
            this.emit("abort");
        });
    }
    /**
     * Abort any current asynchronous task. This may include:
     * - pending HTTP requests
     * - wait timers
     * - streams and stream pipelines
     */
    abort() {
        this.abortController.abort();
    }
    /**
     * Used internally to make requests that will automatically authorize if
     * needed and that can be aborted using [this.abort()]
     * @param options Any request options
     * @param label Used to render an error message if the request is aborted
     */
    async request(url, options, label = "request") {
        const _options = {
            ...this.options.requests,
            ...options,
            headers: {
                ...this.options.requests?.headers,
                ...options.headers
            },
            // This should abort requests when the AbortController goes off
            signal: this.abortController.signal,
            context: {
                interactive: this.options.reporter === "cli"
            }
        };
        const accessToken = await this.getAccessToken();
        if (accessToken) {
            _options.headers = {
                ..._options.headers,
                authorization: `Bearer ${accessToken}`
            };
        }
        const req = (0, request_1.default)(url, _options);
        const abort = () => {
            debug(`Aborting ${label}`);
        };
        this.abortController.signal.addEventListener("abort", abort, { once: true });
        return req.then(res => {
            this.abortController.signal.removeEventListener("abort", abort);
            return res;
        });
    }
    /**
     * Internal method for formatting response headers for some emitted events
     * based on `options.logResponseHeaders`
     * @param headers
     * @returns responseHeaders
     */
    formatResponseHeaders(headers) {
        if (this.options.logResponseHeaders.toString().toLocaleLowerCase() === 'none')
            return undefined;
        if (this.options.logResponseHeaders.toString().toLocaleLowerCase() === 'all')
            return headers;
        // If not an array it must be a string or a RegExp 
        if (!Array.isArray(this.options.logResponseHeaders)) {
            return (0, utils_1.filterResponseHeaders)(headers, [this.options.logResponseHeaders]);
        }
        // Else it must be an array
        return (0, utils_1.filterResponseHeaders)(headers, this.options.logResponseHeaders);
    }
    /**
     * Get an access token to be used as bearer in requests to the server.
     * The token is cached so that we don't have to authorize on every request.
     * If the token is expired (or will expire in the next 10 seconds), a new
     * one will be requested and cached.
     */
    async getAccessToken() {
        if (this.accessToken && this.accessTokenExpiresAt - 10 > Date.now() / 1000) {
            return this.accessToken;
        }
        const { tokenUrl, clientId, accessTokenLifetime, privateKey } = this.options;
        if (!tokenUrl || tokenUrl == "none" || !clientId || !privateKey) {
            return "";
        }
        const claims = {
            iss: clientId,
            sub: clientId,
            aud: tokenUrl,
            exp: Math.round(Date.now() / 1000) + accessTokenLifetime,
            jti: node_jose_1.default.util.randomBytes(10).toString("hex")
        };
        const token = jsonwebtoken_1.default.sign(claims, privateKey.toPEM(true), {
            algorithm: privateKey.alg,
            keyid: privateKey.kid
        });
        const authRequestFormData = new FormData();
        authRequestFormData.append("scope", this.options.scope || "system/*.read");
        authRequestFormData.append("grant_type", "client_credentials");
        authRequestFormData.append("client_assertion_type", "urn:ietf:params:oauth:client-assertion-type:jwt-bearer");
        authRequestFormData.append("client_assertion", token);
        const authRequest = (0, request_1.default)(tokenUrl, {
            method: "POST",
            "headers": {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: authRequestFormData
        });
        const abort = () => {
            debug("Aborting authorization request");
        };
        this.abortController.signal.addEventListener("abort", abort, { once: true });
        return authRequest.then(async (res) => {
            const json = await res.json();
            (0, utils_1.assert)(json, "Authorization request got empty body");
            (0, utils_1.assert)(json.access_token, "Authorization response does not include access_token");
            (0, utils_1.assert)(json.expires_in, "Authorization response does not include expires_in");
            this.accessToken = json.access_token || "";
            this.accessTokenExpiresAt = (0, utils_1.getAccessTokenExpiration)(json);
            this.emit("authorize", this.accessToken);
            return json.access_token;
        }).finally(() => {
            this.abortController.signal.removeEventListener("abort", abort);
        });
    }
    /**
     * Makes the kick-off request for Patient Match and resolves with the status endpoint URL
     */
    async kickOff() {
        debug('kickoff');
        const { fhirUrl, lenient } = this.options;
        const url = new url_1.URL("Patient/$bulk-match", fhirUrl);
        let capabilityStatement;
        try {
            debug('searching for cap');
            capabilityStatement = await (0, utils_1.getCapabilityStatement)(fhirUrl);
        }
        catch {
            debug('failed to get one');
            capabilityStatement = {};
        }
        const requestOptions = {
            headers: {
                "Content-Type": "application/json",
                accept: "application/fhir+ndjson",
                prefer: `respond-async`
                // TODO: Add back in lenient? 
                // prefer: `respond-async${lenient ? ", handling=lenient" : ""}`
            }
        };
        requestOptions.method = "POST";
        // Body must be stringified
        requestOptions.body = JSON.stringify(this.buildKickoffPayload());
        debug("body: ", requestOptions.body);
        this.emit("kickOffStart", requestOptions);
        return this.request(url, requestOptions, "kick-off patient match request")
            .then(res => {
            const location = res.headers.get("content-location");
            if (!location) {
                throw new Error("The kick-off patient match response did not include content-location header");
            }
            this.emit("kickOffEnd", {
                response: res,
                capabilityStatement,
                responseHeaders: this.formatResponseHeaders(res.headers),
            });
            return location;
        })
            .catch(error => {
            this.emit("kickOffEnd", {
                response: error.response || {},
                capabilityStatement,
                responseHeaders: this.formatResponseHeaders(error.response.headers),
            });
            throw error;
        });
    }
    /**
     * Download all the ndsjson files specified in the match-response's manifest
     * @param manifest
     * @returns
     */
    async downloadAllFiles(manifest) {
        return new Promise((resolve, reject) => {
            // Count how many files we have gotten for each ResourceType. This
            // is needed if the forceStandardFileNames option is true
            const fileCounts = {};
            const createDownloadJob = (f, initialState = {}) => {
                if (!(f.type in fileCounts)) {
                    fileCounts[f.type] = 0;
                }
                fileCounts[f.type]++;
                let fileName = (0, path_1.basename)(f.url);
                const status = {
                    url: f.url,
                    type: f.type,
                    name: fileName,
                    downloadedChunks: 0,
                    downloadedBytes: 0,
                    uncompressedBytes: 0,
                    resources: 0,
                    running: false,
                    completed: false,
                    exportType: "output",
                    error: null,
                    ...initialState
                };
                return {
                    status,
                    descriptor: f,
                    worker: async () => {
                        status.running = true;
                        status.completed = false;
                        await this.downloadFile({
                            file: f,
                            fileName,
                            onProgress: state => {
                                Object.assign(status, state);
                                this.emit("downloadProgress", downloadJobs.map(j => j.status));
                            },
                            authorize: manifest.requiresAccessToken,
                            subFolder: status.exportType == "output" ? "" : status.exportType,
                            exportType: status.exportType
                        });
                        status.running = false;
                        status.completed = true;
                        if (this.options.addDestinationToManifest) {
                            // @ts-ignore
                            f.destination = (0, path_1.join)(this.options.destination, fileName);
                        }
                        tick();
                    }
                };
            };
            const downloadJobs = [
                ...(manifest.output || []).map(f => createDownloadJob(f, { exportType: "output" })),
                ...(manifest.deleted || []).map(f => createDownloadJob(f, { exportType: "deleted" })),
                ...(manifest.error || []).map(f => createDownloadJob(f, { exportType: "error" }))
            ];
            const tick = () => {
                let completed = 0;
                let running = 0;
                for (const job of downloadJobs) {
                    if (job.status.completed) {
                        completed += 1;
                        continue;
                    }
                    if (job.status.running) {
                        running += 1;
                        continue;
                    }
                    if (running < this.options.parallelDownloads) {
                        running += 1;
                        job.worker();
                    }
                }
                this.emit("downloadProgress", downloadJobs.map(j => j.status));
                if (completed === downloadJobs.length) {
                    const downloads = downloadJobs.map(j => j.status);
                    this.emit("allDownloadsComplete", downloads);
                    if (this.options.saveManifest) {
                        const readable = stream_1.Readable.from(JSON.stringify(manifest, null, 4));
                        (0, promises_1.pipeline)(readable, this.createDestinationStream("manifest.json")).then(() => {
                            resolve(downloads);
                        });
                    }
                    else {
                        resolve(downloads);
                    }
                }
            };
            tick();
        });
    }
    async downloadFile({ file, fileName, onProgress, authorize = false, subFolder = "", exportType = "output", }) {
        let accessToken = "";
        if (authorize) {
            accessToken = await this.getAccessToken();
        }
        this.emit("downloadStart", {
            fileUrl: file.url,
            itemType: exportType,
        });
        const download = new FileDownload_1.default(file.url);
        // Start the download (the stream will be paused though)
        let downloadFile = await download.run({
            accessToken,
            signal: this.abortController.signal,
            requestOptions: this.options.requests,
        }).catch(e => {
            if (e instanceof errors_1.FileDownloadError) {
                this.emit("downloadError", {
                    body: null, // Buffer
                    code: e.code || null,
                    fileUrl: e.fileUrl,
                    message: String(e.message || "File download failed"),
                    responseHeaders: this.formatResponseHeaders(e.responseHeaders),
                });
            }
            throw e;
        });
        this.emit("downloadComplete", {
            fileUrl: file.url,
            // fileSize: ???,
            // resourceCount: ???
        });
    }
    /**
    * Creates and returns a writable stream to the destination.
    * - For file system destination the files are written to the given location
    * - For S3 destinations the files are uploaded to S3
    * - For HTTP destinations the files are posted to the given URL
    * - If the destination is "" or "none" no action is taken (files are discarded)
    * @param fileName The desired fileName at destination
    * @param subFolder Optional subfolder
    */
    createDestinationStream(fileName, subFolder = "") {
        const destination = String(this.options.destination || "none").trim();
        // No destination ------------------------------------------------------
        if (!destination || destination.toLowerCase() == "none") {
            return new stream_1.Writable({ write(chunk, encoding, cb) { cb(); } });
        }
        // HTTP ----------------------------------------------------------------
        if (destination.match(/^https?\:\/\//)) {
            const url = new url_1.URL((0, path_1.join)(destination, fileName));
            if (subFolder) {
                url.searchParams.set("folder", subFolder);
            }
            const req = http_1.default.request(url, { method: 'POST' });
            req.on('error', error => {
                console.error(`Problem with upload request: ${error.message}`);
            });
            return req;
        }
        // local filesystem destinations ---------------------------------------
        let path = destination.startsWith("file://") ?
            (0, url_1.fileURLToPath)(destination) :
            destination.startsWith(path_1.sep) ?
                destination :
                (0, path_1.resolve)(__dirname, "../..", destination);
        (0, utils_1.assert)(fs_1.default.existsSync(path), `Destination "${path}" does not exist`);
        (0, utils_1.assert)(fs_1.default.statSync(path).isDirectory, `Destination "${path}" is not a directory`);
        if (subFolder) {
            path = (0, path_1.join)(path, subFolder);
            if (!fs_1.default.existsSync(path)) {
                (0, fs_1.mkdirSync)(path);
            }
        }
        return fs_1.default.createWriteStream((0, path_1.join)(path, fileName));
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
        const status = {
            startedAt: Date.now(),
            completedAt: -1,
            elapsedTime: 0,
            percentComplete: -1,
            nextCheckAfter: 1000,
            message: "Patient Match started",
            xProgressHeader: "",
            retryAfterHeader: "",
            statusEndpoint
        };
        this.emit("matchStart", status);
        const checkStatus = async () => {
            return this.request(statusEndpoint, {
                headers: {
                    accept: "application/json, application/fhir+ndjson"
                }
            }, "status request").then(async (res) => {
                const now = Date.now();
                const elapsedTime = now - status.startedAt;
                status.elapsedTime = elapsedTime;
                // Export is complete
                if (res.status == 200) {
                    status.completedAt = now;
                    status.percentComplete = 100;
                    status.nextCheckAfter = -1;
                    status.message = `Patient Match completed in ${(0, utils_1.formatDuration)(elapsedTime)}`;
                    this.emit("matchProgress", { ...status, virtual: true });
                    let body;
                    try {
                        // This should throw a TypeError if the response is not parsable as JSON
                        // TODO: Add more checks here based on return type of match operation
                        body = await res.json();
                        (0, utils_1.assert)(body !== null, "No export manifest returned");
                        // expect(body.output, "The export manifest output is not an array").to.be.an.array();
                        // expect(body.output, "The export manifest output contains no files").to.not.be.empty()
                        this.emit("matchComplete", body);
                    }
                    catch (ex) {
                        this.emit("matchError", {
                            body: body || null,
                            code: res.status || null,
                            message: ex.message,
                            responseHeaders: this.formatResponseHeaders(res.headers),
                        });
                        throw ex;
                    }
                    return body;
                }
                // Export is in progress
                if (res.status == 202) {
                    const now = Date.now();
                    const progress = String(res.headers.get("x-progress") || "").trim();
                    const retryAfter = String(res.headers.get("retry-after") || "").trim();
                    const progressPct = parseInt(progress, 10);
                    let retryAfterMSec = this.options.retryAfterMSec;
                    if (retryAfter) {
                        if (retryAfter.match(/\d+/)) {
                            retryAfterMSec = parseInt(retryAfter, 10) * 1000;
                        }
                        else {
                            let d = new Date(retryAfter);
                            retryAfterMSec = Math.ceil(d.getTime() - now);
                        }
                    }
                    const poolDelay = Math.min(Math.max(retryAfterMSec, 100), 1000 * 60);
                    Object.assign(status, {
                        percentComplete: isNaN(progressPct) ? -1 : progressPct,
                        nextCheckAfter: poolDelay,
                        message: isNaN(progressPct) ?
                            `Patient Match: in progress for ${(0, utils_1.formatDuration)(elapsedTime)}${progress ? ". Server message: " + progress : ""}` :
                            `Patient Match: ${progressPct}% complete in ${(0, utils_1.formatDuration)(elapsedTime)}`
                    });
                    this.emit("matchProgress", {
                        ...status,
                        retryAfterHeader: retryAfter,
                        xProgressHeader: progress,
                        body: res.body
                    });
                    // debug("%o", status)
                    return (0, utils_1.wait)(poolDelay, this.abortController.signal).then(checkStatus);
                }
                else {
                    const msg = `Unexpected status response ${res.status} ${res.statusText}`;
                    this.emit("matchError", {
                        body: res.body || null,
                        code: res.status || null,
                        message: msg,
                        responseHeaders: this.formatResponseHeaders(res.headers),
                    });
                    const error = new Error(msg);
                    // @ts-ignore
                    error.body = res.body || null;
                    throw error;
                }
            });
        };
        return checkStatus();
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
                valueString: this.options._outputFormat
            });
        }
        // resources --------------------------------------------------------------
        let resources = JSON.parse(this.options.resources);
        if (!Array.isArray(resources)) {
            resources = [resources];
        }
        resources.forEach((res) => {
            parameters.push({
                name: "resource",
                // TODO - handle more than inlined JSON
                resource: res
            });
        });
        // onlySingleMatch ---------------------------------------------------------------
        if (this.options.onlySingleMatch) {
            parameters.push({
                name: "onlySingleMatch",
                valueBoolean: Boolean(this.options.onlySingleMatch)
            });
        }
        // onlyCertainMatches -----------------------------------------------------------
        if (this.options.onlyCertainMatches) {
            parameters.push({
                name: "onlyCertainMatches",
                valueBoolean: Boolean(this.options.onlyCertainMatches)
            });
        }
        // count -------------------------------------------------------------
        if (this.options.count) {
            parameters.push({
                name: "count",
                valueInteger: parseInt(String(this.options.count), 10)
            });
        }
        return {
            resourceType: "Parameters",
            parameter: parameters
        };
    }
    /**
     * Cancels an active matching request
     * @param statusEndpoint
     * @returns
     */
    cancelMatch(statusEndpoint) {
        this.abort();
        return this.request(statusEndpoint, {
            method: "DELETE",
        });
    }
}
exports.default = BulkMatchClient;
