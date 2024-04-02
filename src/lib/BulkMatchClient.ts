import { debuglog }                     from "util"
import http                             from "http"
import jwt                              from "jsonwebtoken"
import jose                             from "node-jose"
import { URL, fileURLToPath }           from "url"
import { EventEmitter }                 from "events"
import { basename, join, resolve, sep } from "path"
import FS, { mkdirSync }                from "fs"
import { PassThrough, Readable, Writable } from "stream"
import { pipeline }                     from "stream/promises"
// import request                          from "./request"
import request                          from "./request"
import FileDownload                     from "./FileDownload"
import { FileDownloadError }            from "./errors"
import { JsonObject, BulkMatchClient as Types }      from "../.."
import {
    assert,
    fhirInstant,
    filterResponseHeaders,
    formatDuration,
    getAccessTokenExpiration,
    getCapabilityStatement,
    wait
} from "./utils"
import { FhirResource } from "fhir/r4"


EventEmitter.defaultMaxListeners = 30;


const debug = debuglog("bulk-match")

/**>>
 * The BulkMatchClient instances emit the following events:
 */
export interface BulkMatchClientEvents {
    /**
     * Emitted every time new access token is received
     * @event
     */
    "authorize": (this: BulkMatchClient, accessToken: string) => void;

    /**
     * Emitted when new patient match is started
     * @event
     */
    "kickOffStart": (this: BulkMatchClient, requestOptions: RequestInit) => void;
    
    /**
     * Emitted when a kick-off patient match response is received
     * @event
     */
    "kickOffEnd": (this: BulkMatchClient, data: {
        response            : Response
        capabilityStatement : fhir4.CapabilityStatement
        responseHeaders    ?: object
    }) => void;

    /**
     * Emitted when the patient match has began
     * @event
     */
    "matchStart": (this: BulkMatchClient, status: Types.MatchStatus) => void;
    
    /**
     * Emitted for every status change while waiting for the patient match
     * @event
     */
    "matchProgress": (this: BulkMatchClient, status: Types.MatchStatus) => void;

    "matchError": (this: BulkMatchClient, details: {
        body             : string | fhir4.OperationOutcome | null
        code             : number | null
        message         ?: string
        responseHeaders ?: object 
    }) => void;
    
    /**
     * Emitted when the export is completed
     * @event
     */
    "matchComplete": (this: BulkMatchClient, manifest: Types.MatchManifest) => void;
    
    /**
     * Emitted when the download starts
     * @event
     */
    "downloadStart": (this: BulkMatchClient, detail: {
        fileUrl: string
        itemType: string
    }) => void;
    
    /**
     * Emitted for any status change while files are being downloaded
     * @event
     */
    "downloadProgress": (this: BulkMatchClient, downloads: Types.FileDownload[]) => void;

    /**
     * Emitted for every file which fails to download
     * @event
     */
    "downloadError": (this: BulkMatchClient, details: {
        body             : string | fhir4.OperationOutcome | null // Buffer
        code             : number | null
        fileUrl          : string
        message         ?: string
        responseHeaders ?: object
    }) => void;

    /**
     * Emitted when any file has been downloaded
     * @event
     */
    "downloadComplete": (this: BulkMatchClient, detail: {
        fileUrl      : string
        // fileSize     : number
        // resourceCount: number 
    }) => void;

    /**
     * Emitted when all files have been downloaded
     * @event
     */
    "allDownloadsComplete": (this: BulkMatchClient, downloads: Types.FileDownload[]) => void;
    
    /**
     * Emitted on error
     * @event
     */
    "error": (this: BulkMatchClient, error: Error) => void;
    
    /**
     * Emitted when the flow is aborted by the user
     * @event
     */
    "abort": (this: BulkMatchClient) => void;
}

interface BulkMatchClient {

    on<U extends keyof BulkMatchClientEvents>(event: U, listener: BulkMatchClientEvents[U]): this;
    // on(event: string, listener: Function): this;
    
    emit<U extends keyof BulkMatchClientEvents>(event: U, ...args: Parameters<BulkMatchClientEvents[U]>): boolean;
    // emit(event: string, ...args: any[]): boolean;

    off<U extends keyof BulkMatchClientEvents>(event: U, listener: BulkMatchClientEvents[U]): this;
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
class BulkMatchClient extends EventEmitter
{
    /**
     * The options of the instance
     */
    readonly options: Types.NormalizedOptions;

    /**
     * Used internally to emit abort signals to pending requests and other async
     * jobs.
     */
    private abortController: AbortController;

    /**
     * The last known access token is stored here. It will be renewed when it
     * expires. 
     */
    private accessToken: string = "";

    /**
     * Every time we get new access token, we set this field based on the
     * token's expiration time.
     */
    private accessTokenExpiresAt: number = 0;

    /**
     * Nothing special is done here - just remember the options and create
     * AbortController instance
     */
    constructor(options: Types.NormalizedOptions)
    {
        super();
        this.options = options;
        this.abortController = new AbortController();
        this.abortController.signal.addEventListener("abort", () => {
            this.emit("abort")
        });
    }

    /**
     * Abort any current asynchronous task. This may include:
     * - pending HTTP requests
     * - wait timers
     * - streams and stream pipelines
     */
    public abort() {
        this.abortController.abort()
    }

    /**
     * Used internally to make requests that will automatically authorize if
     * needed and that can be aborted using [this.abort()]
     * @param options Any request options
     * @param label Used to render an error message if the request is aborted
     */
    public async request(url: RequestInfo | URL, options: RequestInit, label = "request"): Promise<Response> {
        const _options: Types.AugmentedRequestInit = {
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
        }

        const accessToken = await this.getAccessToken();

        if (accessToken) {
            _options.headers = {
                ..._options.headers,
                authorization: `Bearer ${ accessToken }`
            };
        }

        const req = request(url, _options as any);

        const abort = () => {
            debug(`Aborting ${label}`)
        };

        this.abortController.signal.addEventListener("abort", abort, { once: true });

        return req.then(res => {
            this.abortController.signal.removeEventListener("abort", abort);
            return res
        });
    }

    /**
     * Internal method for formatting response headers for some emitted events 
     * based on `options.logResponseHeaders`
     * @param headers 
     * @returns responseHeaders
     */
    private formatResponseHeaders(headers: Types.ResponseHeaders) : object | undefined {
        if (this.options.logResponseHeaders.toString().toLocaleLowerCase() === 'none') return undefined
        if (this.options.logResponseHeaders.toString().toLocaleLowerCase() === 'all') return headers
        // If not an array it must be a string or a RegExp 
        if (!Array.isArray(this.options.logResponseHeaders)) {
            return filterResponseHeaders(headers, [this.options.logResponseHeaders])
        } 
        // Else it must be an array
        return filterResponseHeaders(headers, this.options.logResponseHeaders)
    }

    /**
     * Get an access token to be used as bearer in requests to the server.
     * The token is cached so that we don't have to authorize on every request.
     * If the token is expired (or will expire in the next 10 seconds), a new
     * one will be requested and cached.
     */
    private async getAccessToken() {
        if (this.accessToken && this.accessTokenExpiresAt - 10 > Date.now() / 1000) {
            return this.accessToken;
        }

        const { tokenUrl, clientId, accessTokenLifetime, privateKey } = this.options;
        if (!tokenUrl || tokenUrl == "none" || !clientId || !privateKey) {
            return ""
        }

        const claims = {
            iss: clientId,
            sub: clientId,
            aud: tokenUrl,
            exp: Math.round(Date.now() / 1000) + accessTokenLifetime,
            jti: jose.util.randomBytes(10).toString("hex")
        };

        const token = jwt.sign(claims, privateKey.toPEM(true), {
            algorithm: privateKey.alg as jwt.Algorithm,
            keyid: privateKey.kid
        });

        const authRequestFormData = new FormData()
        authRequestFormData.append("scope", this.options.scope || "system/*.read")
        authRequestFormData.append("grant_type", "client_credentials")
        authRequestFormData.append("client_assertion_type", "urn:ietf:params:oauth:client-assertion-type:jwt-bearer")
        authRequestFormData.append("client_assertion", token)
        
        const authRequest = request<Types.TokenResponse>(tokenUrl, {
            method: "POST",
            "headers": { 
                "Content-Type": "application/x-www-form-urlencoded"
            }, 
            body: authRequestFormData
        });

        const abort = () => {
            debug("Aborting authorization request")
        };

        this.abortController.signal.addEventListener("abort", abort, { once: true });

        return authRequest.then(async res => {
            const json = await res.json()
            assert(json, "Authorization request got empty body")
            assert(json.access_token, "Authorization response does not include access_token")
            assert(json.expires_in, "Authorization response does not include expires_in")
            this.accessToken = json.access_token || ""
            this.accessTokenExpiresAt = getAccessTokenExpiration(json)
            this.emit("authorize", this.accessToken)
            return json.access_token
        }).finally(() => {
            this.abortController.signal.removeEventListener("abort", abort);
        });
    }
    
    /**
     * Makes the kick-off request for Patient Match and resolves with the status endpoint URL
     */
    public async kickOff(): Promise<string>
    {
        debug('kickoff')
        const { fhirUrl, lenient } = this.options;
        
        const url = new URL("Patient/$bulk-match", fhirUrl);

        let capabilityStatement: any;
        try {
            debug('searching for cap')
            capabilityStatement = await getCapabilityStatement(fhirUrl)
        } catch {
            debug('failed to get one')
            capabilityStatement = {}
        }

        const requestOptions: RequestInit = {
            headers: {
                "Content-Type": "application/json",
                accept: "application/fhir+ndjson",
                prefer: `respond-async`
                // TODO: Add back in lenient? 
                // prefer: `respond-async${lenient ? ", handling=lenient" : ""}`
            }
        }

        requestOptions.method = "POST";
        // Body must be stringified
        requestOptions.body   = JSON.stringify(this.buildKickoffPayload());
        debug("body: ", requestOptions.body)

        this.emit("kickOffStart", requestOptions)

        return this.request(url, requestOptions, "kick-off patient match request")
            .then(res => {
                const location = res.headers.get("content-location");
                if (!location) {
                    throw new Error("The kick-off patient match response did not include content-location header")
                }
                this.emit("kickOffEnd", { 
                    response: res, 
                    capabilityStatement, 
                    responseHeaders: this.formatResponseHeaders(res.headers),
                })
                return location
            })
            .catch(error => {
                this.emit("kickOffEnd", { 
                    response: error.response || {}, 
                    capabilityStatement, 
                    responseHeaders: this.formatResponseHeaders(error.response.headers),
                })
                throw error
            });
    }

    /**
     * Download all the ndsjson files specified in the match-response's manifest
     * @param manifest 
     * @returns 
     */
    public async downloadAllFiles(manifest: Types.MatchManifest): Promise<Types.FileDownload[]>
    {
        
        return new Promise((resolve, reject) => {

            // Count how many files we have gotten for each ResourceType. This
            // is needed if the forceStandardFileNames option is true
            const fileCounts: { [key: string]: number } = {}

            const createDownloadJob = (f: Types.MatchManifestFile, initialState: Partial<Types.FileDownload> = {}) => {

                if (!(f.type in fileCounts)) {
                    fileCounts[f.type] = 0;
                }
                fileCounts[f.type]++;

                let fileName = basename(f.url)

                const status: Types.FileDownload = {
                    url              : f.url,
                    type             : f.type,
                    name             : fileName,
                    downloadedChunks : 0,
                    downloadedBytes  : 0,
                    uncompressedBytes: 0,
                    resources        : 0,
                    running          : false,
                    completed        : false,
                    exportType       : "output",
                    error            : null,
                    ...initialState
                }

                return {
                    status,
                    descriptor: f,
                    worker: async () => {
                        status.running = true
                        status.completed = false
                        await this.downloadFile({
                            file: f,
                            fileName,
                            onProgress: state => {
                                Object.assign(status, state)
                                this.emit("downloadProgress", downloadJobs.map(j => j.status))
                            },
                            authorize: manifest.requiresAccessToken,
                            subFolder: status.exportType == "output" ? "" : status.exportType,
                            exportType: status.exportType
                        })

                        status.running = false
                        status.completed = true

                        if (this.options.addDestinationToManifest) {
                            // @ts-ignore
                            f.destination = join(this.options.destination, fileName)
                        }

                        tick()
                    }
                };
            };

            const downloadJobs = [
                ...(manifest.output  || []).map(f => createDownloadJob(f, { exportType: "output"  })),
                ...(manifest.deleted || []).map(f => createDownloadJob(f, { exportType: "deleted" })),
                ...(manifest.error   || []).map(f => createDownloadJob(f, { exportType: "error"   }))
            ];

            const tick = () => {
                let completed = 0
                let running   = 0
                for (const job of downloadJobs) {
                    if (job.status.completed) {
                        completed += 1
                        continue
                    }
                    if (job.status.running) {
                        running += 1
                        continue
                    }
                    if (running < this.options.parallelDownloads) {
                        running += 1
                        job.worker()
                    }
                }

                this.emit("downloadProgress", downloadJobs.map(j => j.status))

                if (completed === downloadJobs.length) {
                    const downloads = downloadJobs.map(j => j.status)
                    this.emit("allDownloadsComplete", downloads)
                    if (this.options.saveManifest) {
                        const readable = Readable.from(JSON.stringify(manifest, null, 4));
                        pipeline(readable, this.createDestinationStream("manifest.json")).then(() => {
                            resolve(downloads)
                        });
                    } else {
                        resolve(downloads)
                    }
                }
            };

            tick()
        })
    }

    private async downloadFile({
        file,
        fileName,
        onProgress,
        authorize = false,
        subFolder = "",
        exportType = "output",
    }:
    {
        file       : Types.MatchManifestFile
        fileName   : string
        onProgress : (state: Partial<Types.FileDownloadProgress>) => any
        authorize ?: boolean
        subFolder ?: string
        exportType?: string
    })
    {
        let accessToken = ""

        if (authorize) {
            accessToken = await this.getAccessToken()
        }

        this.emit("downloadStart", {
            fileUrl     : file.url,
            itemType    : exportType,
        })

        const download = new FileDownload(file.url)

        // Start the download (the stream will be paused though)
        let downloadFile: Response = await download.run({
            accessToken,
            signal              : this.abortController.signal,
            requestOptions      : this.options.requests,
        }).catch(e => {
            if (e instanceof FileDownloadError) {
                this.emit("downloadError", {
                    body            : null, // Buffer
                    code            : e.code || null,
                    fileUrl         : e.fileUrl,
                    message         : String(e.message || "File download failed"),
                    responseHeaders : this.formatResponseHeaders(e.responseHeaders),
                })
            }
            throw e
        });
        

        this.emit("downloadComplete", {
            fileUrl: file.url,
            // fileSize: ???,
            // resourceCount: ???
        })
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
     private createDestinationStream(fileName: string, subFolder = ""): Writable {
        const destination = String(this.options.destination || "none").trim();

        // No destination ------------------------------------------------------
        if (!destination || destination.toLowerCase() == "none") {
            return new Writable({ write(chunk, encoding, cb) { cb() } })
        }

        // HTTP ----------------------------------------------------------------
        if (destination.match(/^https?\:\/\//)) {
            const url = new URL(join(destination, fileName));
            if (subFolder) {
                url.searchParams.set("folder", subFolder)
            }
            const req = http.request(url, { method: 'POST' });
              
            req.on('error', error => {
                console.error(`Problem with upload request: ${error.message}`);
            });

            return req
        }

        // local filesystem destinations ---------------------------------------
        let path = destination.startsWith("file://") ?
            fileURLToPath(destination) :
            destination.startsWith(sep) ?
                destination :
                resolve(__dirname, "../..", destination);

        assert(FS.existsSync(path), `Destination "${path}" does not exist`)
        assert(FS.statSync(path).isDirectory, `Destination "${path}" is not a directory`)

        if (subFolder) {
            path = join(path, subFolder)
            if (!FS.existsSync(path)) {
                mkdirSync(path)
            }
        }

        return FS.createWriteStream(join(path, fileName));
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
    public async waitForMatch(statusEndpoint: string): Promise<Types.MatchManifest>
    {
        const status = {
            startedAt       : Date.now(),
            completedAt     : -1,
            elapsedTime     : 0,
            percentComplete : -1,
            nextCheckAfter  : 1000,
            message         : "Patient Match started",
            xProgressHeader : "",
            retryAfterHeader: "",
            statusEndpoint
        };

        this.emit("matchStart", status)

        const checkStatus: () => Promise<Types.MatchManifest> = async () => {
            
            return this.request(statusEndpoint, {
                headers: {
                    accept: "application/json, application/fhir+ndjson"
                }
            }, "status request").then(async res => {
                const now = Date.now();
                const elapsedTime = now - status.startedAt
                
                status.elapsedTime = elapsedTime

                // Export is complete
                if (res.status == 200) {
                    status.completedAt = now
                    status.percentComplete = 100
                    status.nextCheckAfter = -1
                    status.message = `Patient Match completed in ${formatDuration(elapsedTime)}`

                    this.emit("matchProgress", { ...status, virtual: true })
                    let body;
                    try {
                        // This should throw a TypeError if the response is not parsable as JSON
                        // TODO: Add more checks here based on return type of match operation
                        body = await res.json() as Types.MatchManifest
                        assert(body !== null, "No export manifest returned")
                        // expect(body.output, "The export manifest output is not an array").to.be.an.array();
                        // expect(body.output, "The export manifest output contains no files").to.not.be.empty()
                        this.emit("matchComplete", body)
                    } catch (ex) {
                        this.emit("matchError", {
                            body: body as any || null,
                            code: res.status || null,
                            message: (ex as Error).message,
                            responseHeaders: this.formatResponseHeaders(res.headers),
                        });
                        throw ex
                    }

                    return body
                }

                // Export is in progress
                if (res.status == 202) {
                    const now = Date.now();

                    const progress    = String(res.headers.get("x-progress" ) || "").trim();
                    const retryAfter  = String(res.headers.get("retry-after") || "").trim();
                    const progressPct = parseInt(progress, 10);

                    let retryAfterMSec = this.options.retryAfterMSec;
                    if (retryAfter) {
                        if (retryAfter.match(/\d+/)) {
                            retryAfterMSec = parseInt(retryAfter, 10) * 1000
                        } else {
                            let d = new Date(retryAfter);
                            retryAfterMSec = Math.ceil(d.getTime() - now)
                        }
                    }

                    const poolDelay = Math.min(Math.max(retryAfterMSec, 100), 1000*60)

                    Object.assign(status, {
                        percentComplete: isNaN(progressPct) ? -1 : progressPct,
                        nextCheckAfter: poolDelay,
                        message: isNaN(progressPct) ?
                            `Patient Match: in progress for ${formatDuration(elapsedTime)}${progress ? ". Server message: " + progress : ""}`:
                            `Patient Match: ${progressPct}% complete in ${formatDuration(elapsedTime)}`
                    });

                    this.emit("matchProgress", {
                        ...status,
                        retryAfterHeader: retryAfter,
                        xProgressHeader : progress,
                        body            : res.body
                    })
                    // debug("%o", status)
                    
                    return wait(poolDelay, this.abortController.signal).then(checkStatus)
                }
                else {
                    const msg = `Unexpected status response ${res.status} ${res.statusText}`
                    
                    this.emit("matchError", {
                        body            : res.body as any || null,
                        code            : res.status || null,
                        message         : msg,
                        responseHeaders : this.formatResponseHeaders(res.headers),
                    });

                    const error = new Error(msg)
                    // @ts-ignore
                    error.body = res.body as any || null
                    throw error
                }
            });

        };
        
        return checkStatus()
    }


    /**
     * Build a POST-request JSON payload for a bulk match request
     * @returns 
     */
    private buildKickoffPayload(): fhir4.Parameters
    {
        const parameters: fhir4.ParametersParameter[] = []

        // _outputFormat ----------------------------------------------------------
        if (this.options._outputFormat) {
            parameters.push({
                name: "_outputFormat", 
                valueString: this.options._outputFormat
            });
        }

        // resources --------------------------------------------------------------
        let resources = JSON.parse(this.options.resources)
        if (!Array.isArray(resources)){ 
            resources = [resources]
        }
        resources.forEach((res: FhirResource) => {
            parameters.push({
                name: "resource",
                // TODO - handle more than inlined JSON
                resource: res
            })
        })
        
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
    public cancelMatch(statusEndpoint: string) {
        this.abort();
        return this.request(statusEndpoint,  {
            method: "DELETE", 
        });
    }
}

export default BulkMatchClient
